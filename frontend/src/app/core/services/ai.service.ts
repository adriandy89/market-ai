import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiReport {
  id: string;
  user_id: string;
  symbol: string;
  timeframe: string;
  report_type: string;
  content: any;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  generateReport(symbol: string, timeframe = '1D'): Promise<AiReport> {
    return firstValueFrom(
      this.http.post<AiReport>(`${this.api}/ai/report/${symbol}?timeframe=${timeframe}`, {}),
    );
  }

  getReports(page = 1, limit = 10): Promise<{ data: AiReport[]; meta: any }> {
    return firstValueFrom(
      this.http.get<{ data: AiReport[]; meta: any }>(`${this.api}/ai/reports?page=${page}&limit=${limit}`),
    );
  }

  getReport(id: string): Promise<AiReport> {
    return firstValueFrom(this.http.get<AiReport>(`${this.api}/ai/reports/${id}`));
  }
}
