import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ScheduledReportItem {
  id: string;
  enabled: boolean;
  label: string;
  symbols: string[];
  cron_hour: number;
  cron_minute: number;
  user_id: string;
  user: { id: string; name: string; email: string };
  created_at: string;
  updated_at: string;
}

export interface ScheduledRunStatus {
  triggeredAt: string;
  finishedAt?: string;
  symbols: string[];
  status: 'running' | 'completed' | 'completed_with_errors';
  completed: number;
  failed: number;
  total: number;
}

export interface CreateScheduleRequest {
  label: string;
  enabled: boolean;
  symbols: string[];
  cronHour: number;
  cronMinute: number;
}

@Injectable({ providedIn: 'root' })
export class ScheduledReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/scheduled-reports`;

  getAll(): Promise<ScheduledReportItem[]> {
    return lastValueFrom(this.http.get<ScheduledReportItem[]>(this.base));
  }

  getOne(id: string): Promise<ScheduledReportItem> {
    return lastValueFrom(this.http.get<ScheduledReportItem>(`${this.base}/${id}`));
  }

  create(dto: CreateScheduleRequest): Promise<ScheduledReportItem> {
    return lastValueFrom(this.http.post<ScheduledReportItem>(this.base, dto));
  }

  update(id: string, dto: Partial<CreateScheduleRequest>): Promise<ScheduledReportItem> {
    return lastValueFrom(this.http.put<ScheduledReportItem>(`${this.base}/${id}`, dto));
  }

  remove(id: string): Promise<{ ok: boolean }> {
    return lastValueFrom(this.http.delete<{ ok: boolean }>(`${this.base}/${id}`));
  }

  getStatus(id: string): Promise<ScheduledRunStatus | null> {
    return lastValueFrom(this.http.get<ScheduledRunStatus | null>(`${this.base}/${id}/status`));
  }

  triggerNow(id: string): Promise<{ ok: boolean; message: string }> {
    return lastValueFrom(this.http.post<{ ok: boolean; message: string }>(`${this.base}/${id}/trigger`, {}));
  }
}
