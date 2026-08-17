import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '../../services/admin-api.service';
import { RequestLogItem } from '../../services/admin-api.types';
import { buildCsvRow } from '../../services/csv.util';

@Component({
    selector: 'app-logs-page',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './logs-page.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./logs-page.component.css']
})
export class LogsPageComponent implements OnInit {
  loading = false;
  error = '';
  rows: RequestLogItem[] = [];

  filterForm = this.formBuilder.group({
    principalId: [''],
    statusCode: ['']
  });

  constructor(
    private formBuilder: FormBuilder,
    private adminApiService: AdminApiService
  ) {}

  ngOnInit(): void {
    this.search();
  }

  get errorResponsesCount(): number {
    return this.rows.filter((row) => row.statusCode >= 400).length;
  }

  get averageLatencyMs(): number {
    if (this.rows.length === 0) {
      return 0;
    }

    const total = this.rows.reduce((sum, row) => sum + row.latencyMs, 0);
    return Math.round(total / this.rows.length);
  }

  search(): void {
    this.loading = true;
    this.error = '';
    this.rows = [];
    const values = this.filterForm.getRawValue();
    this.adminApiService.getLogs({
      principalId: values.principalId || undefined,
      statusCode: values.statusCode || undefined
    }).subscribe({
      next: (response) => {
        this.rows = response.items ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load request logs. Check the filters and backend connection, then try again.';
        this.loading = false;
      }
    });
  }

  clearFilters(): void {
    this.filterForm.reset({
      principalId: '',
      statusCode: ''
    });
    this.search();
  }

  exportCsv(): void {
    if (this.rows.length === 0) {
      return;
    }

    const header = [
      'timestamp',
      'principalId',
      'ipAddress',
      'httpMethod',
      'path',
      'statusCode',
      'latencyMs'
    ];

    const csvRows = [
      buildCsvRow(header),
      ...this.rows.map((row) =>
        buildCsvRow([
          row.timestamp,
          row.principalId,
          row.ipAddress,
          row.httpMethod,
          row.path,
          row.statusCode,
          row.latencyMs
        ])
      )
    ];

    const csv = csvRows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `request-logs-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
