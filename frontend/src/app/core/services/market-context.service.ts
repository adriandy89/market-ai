import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevance: 'high' | 'medium' | 'low';
  kind: string;
}

export interface NewsContext {
  symbol: string;
  items: NewsItem[];
  overallSentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  fetchedAt: string;
}

export interface SentimentContext {
  fearGreedIndex: {
    value: number;
    classification: string;
    trend: { value: number; classification: string; timestamp: string }[];
  };
  globalMarket: {
    totalMarketCap: number;
    totalVolume24h: number;
    btcDominance: number;
    marketCapChange24h: number;
  };
  fetchedAt: string;
}

export interface FullMarketContext {
  news: NewsContext;
  sentiment: SentimentContext;
  macro: {
    regulatoryNews: NewsItem[];
    macroEvents: NewsItem[];
    marketRegime: 'risk-on' | 'risk-off' | 'neutral';
    fetchedAt: string;
  };
}

@Injectable({ providedIn: 'root' })
export class MarketContextApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  getNews(symbol: string): Promise<NewsContext> {
    return firstValueFrom(
      this.http.get<NewsContext>(`${this.api}/market-context/${symbol}/news`),
    );
  }

  getSentiment(): Promise<SentimentContext> {
    return firstValueFrom(
      this.http.get<SentimentContext>(`${this.api}/market-context/sentiment`),
    );
  }

  getFullContext(symbol: string): Promise<FullMarketContext> {
    return firstValueFrom(
      this.http.get<FullMarketContext>(`${this.api}/market-context/${symbol}/full`),
    );
  }
}
