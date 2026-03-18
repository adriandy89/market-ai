import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { TelegramCodeResponse } from '../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class TelegramApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/telegram`;

  getStatus() {
    return firstValueFrom(this.http.get<{ linked: boolean }>(this.base + '/status'));
  }

  generateCode() {
    return firstValueFrom(this.http.post<TelegramCodeResponse>(this.base + '/generate-code', {}));
  }

  unlink() {
    return firstValueFrom(this.http.delete<{ success: boolean }>(this.base + '/unlink'));
  }
}
