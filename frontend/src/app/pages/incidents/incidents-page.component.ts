import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AdminApiService } from '../../services/admin-api.service';
import { IncidentItem } from '../../services/admin-api.types';

@Component({
    selector: 'app-incidents-page',
    imports: [CommonModule],
    templateUrl: './incidents-page.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./incidents-page.component.css']
})
export class IncidentsPageComponent implements OnInit {
  loading = false;
  error = '';
  activeOnly = false;
  rows: IncidentItem[] = [];

  constructor(private adminApiService: AdminApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.rows = [];
    this.adminApiService.getIncidents(this.activeOnly).subscribe({
      next: (response) => {
        this.rows = response.items ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load incidents. Check the backend connection and try again.';
        this.loading = false;
      }
    });
  }
}
