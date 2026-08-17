import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApiService } from '../../services/admin-api.service';
import { AdminStats, IncidentItem, RequestLogItem } from '../../services/admin-api.types';
import { buildCsvRow } from '../../services/csv.util';

interface ProtectionLayer {
  label: string;
  active: boolean;
}

@Component({
    selector: 'app-traffic-page',
    imports: [CommonModule, RouterLink],
    templateUrl: './traffic-page.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./traffic-page.component.css']
})
export class TrafficPageComponent implements OnInit {
  private readonly layerStorageKey = 'limitr_traffic_layers';
  private readonly profileStorageKey = 'limitr_traffic_profile';
  private readonly defaultLayers: ProtectionLayer[] = [
    { label: 'IP Rotation Check', active: true },
    { label: 'Geo-Fencing', active: true },
    { label: 'Bot Fingerprinting', active: false }
  ];
  private readonly defaultRateLimit = 1200;
  private readonly defaultBurstTolerance = 35;

  loading = true;
  applying = false;
  message = '';
  error = '';

  stats: AdminStats | null = null;
  logs: RequestLogItem[] = [];
  incidents: IncidentItem[] = [];

  protectionLayers: ProtectionLayer[] = this.createDefaultLayers();
  rateLimit = this.defaultRateLimit;
  burstTolerance = this.defaultBurstTolerance;
  lastUpdated: Date | null = null;

  constructor(private adminApiService: AdminApiService) {}

  ngOnInit(): void {
    this.loadSavedLayers();
    this.loadSavedProfile();
    this.refresh();
  }

  get totalReqPerMinute(): number {
    return this.stats?.requestsPerMinute ?? 0;
  }

  get blockedCount(): number {
    return this.logs.filter((row) => row.statusCode === 429 || row.statusCode === 403).length;
  }

  get averageLatencyMs(): number {
    if (this.logs.length === 0) {
      return 0;
    }
    const sum = this.logs.reduce((total, row) => total + row.latencyMs, 0);
    return Math.round(sum / this.logs.length);
  }

  get rateLimitPercent(): number {
    return this.toPercent(this.rateLimit, 5000);
  }

  get burstTolerancePercent(): number {
    return this.toPercent(this.burstTolerance, 100);
  }

  get formattedRateLimit(): string {
    return this.rateLimit.toLocaleString('en-US');
  }

  get displayIncidents(): IncidentItem[] {
    return this.incidents.slice(0, 8);
  }

  get blobSizePx(): number {
    const size = 140 + (this.volumeScore * 0.7) + (this.errorScore * 0.6);
    return Math.round(this.clamp(size, 130, 260));
  }

  get blobOpacity(): number {
    return Number((0.12 + this.errorScore / 250).toFixed(3));
  }

  get blobScale(): number {
    return Number((0.88 + ((this.latencyScore + this.botScore) / 220)).toFixed(3));
  }

  get blobAnimationSeconds(): number {
    return Number((6 - this.volumeScore / 40).toFixed(2));
  }

  get marker1Top(): string {
    return `${Math.round(70 - this.errorScore * 0.45)}%`;
  }

  get marker1Left(): string {
    return `${Math.round(20 + this.volumeScore * 0.6)}%`;
  }

  get marker2Bottom(): string {
    return `${Math.round(20 + this.latencyScore * 0.5)}%`;
  }

  get marker2Right(): string {
    return `${Math.round(20 + this.botScore * 0.5)}%`;
  }

  get blobBorderRadius(): string {
    const volume = Math.round(this.volumeScore / 4);
    const errors = Math.round(this.errorScore / 5);
    const latency = Math.round(this.latencyScore / 4);
    const bot = Math.round(this.botScore / 4);
    const tl = this.clamp(32 + volume - errors, 22, 68);
    const tr = this.clamp(64 - volume + bot, 22, 68);
    const br = this.clamp(64 + errors - latency, 22, 72);
    const bl = this.clamp(36 + latency - bot, 22, 72);
    const vtl = this.clamp(34 + latency - errors, 22, 72);
    const vtr = this.clamp(52 + volume - bot, 22, 72);
    const vbr = this.clamp(62 + errors - volume, 22, 72);
    const vbl = this.clamp(48 + bot - latency, 22, 72);
    return `${tl}% ${tr}% ${br}% ${bl}% / ${vtl}% ${vtr}% ${vbr}% ${vbl}%`;
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.message = '';
    forkJoin({
      stats: this.adminApiService.getStats(),
      logs: this.adminApiService.getLogs({}),
      incidents: this.adminApiService.getIncidents(false)
    }).subscribe({
      next: ({ stats, logs, incidents }) => {
        this.stats = stats;
        this.logs = logs.items ?? [];
        this.incidents = incidents.items ?? [];
        this.lastUpdated = new Date();
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load live traffic telemetry.';
        this.loading = false;
      }
    });
  }

  setRateLimit(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.rateLimit = Number.isNaN(value) ? 0 : value;
  }

  setBurstTolerance(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.burstTolerance = Number.isNaN(value) ? 0 : value;
  }

  toggleLayer(index: number): void {
    this.protectionLayers[index].active = !this.protectionLayers[index].active;
    localStorage.setItem(this.layerStorageKey, JSON.stringify(this.protectionLayers));
  }

  resetConfig(): void {
    this.message = '';
    this.error = '';
    this.protectionLayers = this.createDefaultLayers();
    this.rateLimit = this.defaultRateLimit;
    this.burstTolerance = this.defaultBurstTolerance;
    localStorage.setItem(this.layerStorageKey, JSON.stringify(this.protectionLayers));
    this.saveProfile();
  }

  applyConfig(): void {
    this.message = '';
    this.error = '';
    this.applying = true;
    this.saveProfile();
    this.applying = false;
    this.message = 'Traffic profile saved. Rules remain unchanged.';
  }

  exportLog(): void {
    if (this.incidents.length === 0) {
      return;
    }

    const csvRows = [
      buildCsvRow(['timestamp', 'principalId', 'ruleTriggered', 'score', 'actionTaken', 'expiresAt']),
      ...this.incidents.map((item) =>
        buildCsvRow([
          item.timestamp,
          item.principalId,
          item.ruleTriggered,
          item.score,
          item.actionTaken,
          item.expiresAt ?? ''
        ])
      )
    ];
    const csv = csvRows.join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traffic-incidents-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  rangeFillWidth(percent: number): string {
    return `calc((100% - 32px) * ${this.toRatio(percent)})`;
  }

  rangeThumbLeft(percent: number): string {
    return `calc(16px + (100% - 32px) * ${this.toRatio(percent)})`;
  }

  private get volumeScore(): number {
    if (this.rateLimit <= 0) {
      return 0;
    }
    return this.clamp((this.totalReqPerMinute / this.rateLimit) * 100, 0, 100);
  }

  private get errorScore(): number {
    if (this.logs.length === 0) {
      return 0;
    }
    const errorCount = this.logs.filter((row) => row.statusCode >= 400).length;
    const sensitivityMultiplier = 0.7 + ((100 - this.burstTolerance) / 100);
    return this.clamp(((errorCount / this.logs.length) * 100) * sensitivityMultiplier, 0, 100);
  }

  private get latencyScore(): number {
    return this.clamp((this.averageLatencyMs / 250) * 100, 0, 100);
  }

  private get botScore(): number {
    if (this.incidents.length === 0) {
      return 0;
    }
    const suspicious = this.incidents.filter((incident) => {
      const rule = incident.ruleTriggered.toUpperCase();
      return rule.includes('BOT') || rule.includes('FRAUD') || rule.includes('BURST');
    }).length;
    return this.clamp((suspicious / this.incidents.length) * 100, 0, 100);
  }

  private loadSavedLayers(): void {
    const raw = localStorage.getItem(this.layerStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ProtectionLayer[];
      if (Array.isArray(parsed) && parsed.length === this.defaultLayers.length) {
        const valid = parsed.every(
          (item, index) =>
            item?.label === this.defaultLayers[index].label && typeof item.active === 'boolean'
        );
        if (valid) {
          this.protectionLayers = parsed.map((item) => ({ ...item }));
        }
      }
    } catch {
      this.protectionLayers = this.createDefaultLayers();
    }
  }

  private loadSavedProfile(): void {
    const raw = localStorage.getItem(this.profileStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { rateLimit?: number; burstTolerance?: number };
      if (typeof parsed.rateLimit === 'number') {
        this.rateLimit = this.clamp(parsed.rateLimit, 1, 5000);
      }
      if (typeof parsed.burstTolerance === 'number') {
        this.burstTolerance = this.clamp(parsed.burstTolerance, 1, 100);
      }
    } catch {
      this.rateLimit = this.defaultRateLimit;
      this.burstTolerance = this.defaultBurstTolerance;
    }
  }

  private saveProfile(): void {
    localStorage.setItem(
      this.profileStorageKey,
      JSON.stringify({
        rateLimit: this.rateLimit,
        burstTolerance: this.burstTolerance
      })
    );
  }

  private createDefaultLayers(): ProtectionLayer[] {
    return this.defaultLayers.map((layer) => ({ ...layer }));
  }

  private toPercent(value: number, max: number): number {
    return this.clamp((value / max) * 100, 0, 100);
  }

  private toRatio(percent: number): string {
    return (this.clamp(percent, 0, 100) / 100).toFixed(4);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
