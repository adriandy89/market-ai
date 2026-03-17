import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  private readonly defaultTitle = 'Market AI - Análisis Cripto con IA';
  private readonly defaultDescription =
    'Plataforma de análisis de criptomonedas con IA. Datos en tiempo real, indicadores técnicos, sentimiento de mercado y reportes inteligentes.';

  setTitle(pageTitle?: string): void {
    if (!pageTitle) {
      this.title.setTitle(this.defaultTitle);
      return;
    }
    const full = pageTitle.includes('Market AI') ? pageTitle : `${pageTitle} | Market AI`;
    this.title.setTitle(full);
  }

  setDescription(description?: string): void {
    this.meta.updateTag({
      name: 'description',
      content: description || this.defaultDescription,
    });
  }

  update(opts: { title?: string; description?: string }): void {
    this.setTitle(opts.title);
    if (opts.description) {
      this.setDescription(opts.description);
    }
  }

  reset(): void {
    this.title.setTitle(this.defaultTitle);
    this.setDescription();
  }
}
