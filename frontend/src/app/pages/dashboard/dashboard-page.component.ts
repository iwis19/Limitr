
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AdminApiService } from '../../services/admin-api.service';
import { AdminStats, SystemStatus } from '../../services/admin-api.types';

@Component({
    selector: 'app-dashboard-page',
    imports: [],
    templateUrl: './dashboard-page.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit {
  loading = true;
  error = '';
  stats: AdminStats | null = null;

  constructor(private adminApiService: AdminApiService) {}

  get systemStatus(): SystemStatus | null {
    return this.stats?.systemStatus ?? null;
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.stats = null;
    this.adminApiService.getStats().subscribe({
      next: (response) => {
        this.stats = response;
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load dashboard metrics. Check that the backend is running and try again.';
        this.loading = false;
      }
    });
  }
}
