import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change1h: number;
  change24h: number;
  change7d: number;
  rank: number;
}

export interface CoinPrice {
  symbol: string;
  id: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface OhlcCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  added_at: string;
}

export interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  rank: number | null;
}

@Injectable({ providedIn: 'root' })
export class CryptoApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  searchCoins(query: string): Promise<SearchResult[]> {
    return firstValueFrom(this.http.get<SearchResult[]>(`${this.api}/crypto/search?q=${encodeURIComponent(query)}`));
  }

  getTopCoins(limit = 20): Promise<CoinMarket[]> {
    return firstValueFrom(this.http.get<CoinMarket[]>(`${this.api}/crypto/top?limit=${limit}`));
  }

  getCoinPrice(symbol: string): Promise<CoinPrice> {
    return firstValueFrom(this.http.get<CoinPrice>(`${this.api}/crypto/price/${symbol}`));
  }

  getCoinHistory(symbol: string, days = 30): Promise<{ symbol: string; days: number; data: OhlcCandle[] }> {
    return firstValueFrom(this.http.get<any>(`${this.api}/crypto/history/${symbol}?days=${days}`));
  }

  getKlines(symbol: string, interval = '4h', limit = 300, endTime?: number): Promise<{ symbol: string; interval: string; data: Kline[] }> {
    let url = `${this.api}/crypto/klines/${symbol}?interval=${interval}&limit=${limit}`;
    if (endTime) url += `&endTime=${endTime}`;
    return firstValueFrom(this.http.get<any>(url));
  }

  getWatchlist(): Promise<WatchlistItem[]> {
    return firstValueFrom(this.http.get<WatchlistItem[]>(`${this.api}/crypto/watchlist`));
  }

  addToWatchlist(symbol: string, name: string): Promise<WatchlistItem> {
    return firstValueFrom(this.http.post<WatchlistItem>(`${this.api}/crypto/watchlist`, { symbol, name }));
  }

  removeFromWatchlist(symbol: string): Promise<any> {
    return firstValueFrom(this.http.delete(`${this.api}/crypto/watchlist/${symbol}`));
  }
}
