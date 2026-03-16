import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { forkJoin, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SupportedLang = 'es' | 'en';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  private readonly STORAGE_KEY = 'market-ai.lang';

  readonly currentLang = signal<SupportedLang>('es');

  initialize() {
    const saved = localStorage.getItem(this.STORAGE_KEY) as SupportedLang | null;
    const lang: SupportedLang = saved === 'es' || saved === 'en' ? saved : 'es';
    this.currentLang.set(lang);
    document.documentElement.lang = lang;

    const other: SupportedLang = lang === 'es' ? 'en' : 'es';
    return forkJoin([
      this.transloco.load(lang),
      this.transloco.load(other),
    ]).pipe(
      tap(() => this.transloco.setActiveLang(lang)),
    );
  }

  setLanguage(lang: SupportedLang): void {
    this.transloco.setActiveLang(lang);
    this.currentLang.set(lang);
    document.documentElement.lang = lang;
    localStorage.setItem(this.STORAGE_KEY, lang);
  }

  async syncToBackend(lang: SupportedLang): Promise<void> {
    try {
      await fetch(`${this.api}/users/language`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
        credentials: 'include',
      });
    } catch {
      // Silent fail — localStorage is the primary source
    }
  }
}
