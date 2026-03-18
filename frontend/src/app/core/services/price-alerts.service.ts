import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  alert_type: 'PERCENTAGE_CHANGE_WINDOW' | 'PERCENTAGE_CHANGE_FROM_PRICE' | 'FIXED_PRICE';
  direction: 'UP' | 'DOWN' | 'BOTH';
  threshold_percent: number | null;
  threshold_price: number | null;
  time_window_hours: number | null;
  base_price: number;
  is_recurring: boolean;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface CreateAlertRequest {
  symbol: string;
  name: string;
  alertType: PriceAlert['alert_type'];
  direction: PriceAlert['direction'];
  thresholdPercent?: number;
  thresholdPrice?: number;
  timeWindowHours?: number;
  isRecurring?: boolean;
}

export interface UpdateAlertRequest {
  direction?: PriceAlert['direction'];
  thresholdPercent?: number;
  thresholdPrice?: number;
  timeWindowHours?: number;
  isRecurring?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PriceAlertsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/price-alerts`;

  getAlerts(symbol?: string) {
    const params: any = {};
    if (symbol) params.symbol = symbol;
    return firstValueFrom(this.http.get<PriceAlert[]>(this.base, { params }));
  }

  getAlert(id: string) {
    return firstValueFrom(this.http.get<PriceAlert>(`${this.base}/${id}`));
  }

  createAlert(dto: CreateAlertRequest) {
    return firstValueFrom(this.http.post<PriceAlert>(this.base, dto));
  }

  updateAlert(id: string, dto: UpdateAlertRequest) {
    return firstValueFrom(this.http.put<PriceAlert>(`${this.base}/${id}`, dto));
  }

  deleteAlert(id: string) {
    return firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }

  toggleAlert(id: string) {
    return firstValueFrom(this.http.put<PriceAlert>(`${this.base}/${id}/toggle`, {}));
  }
}
