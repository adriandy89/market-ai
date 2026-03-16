import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LanguageService, type SupportedLang } from '../services/language.service';
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LogoutResponse,
  MessageResponse,
  ProfileResponse,
  ResetPasswordRequest,
  SessionUser,
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly langService = inject(LanguageService);

  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly loading = signal(true);
  private readonly error = signal<string | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isLoading = this.loading.asReadonly();
  readonly authError = this.error.asReadonly();

  async initialize(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<ProfileResponse>(`${this.apiUrl}/auth/profile`),
      );
      this.currentUser.set(response.user);
      if (response.user?.language) {
        this.langService.setLanguage(response.user.language as SupportedLang);
      }
    } catch {
      this.currentUser.set(null);
    } finally {
      this.loading.set(false);
      this.readyResolve?.();
    }
  }

  async signIn(request: SignInRequest): Promise<SignInResponse> {
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<SignInResponse>(`${this.apiUrl}/auth/signin`, request),
      );
      this.currentUser.set(response.user);
      return response;
    } catch (err: unknown) {
      this.error.set(extractErrorMessage(err));
      throw err;
    }
  }

  async signUp(request: SignUpRequest): Promise<SignUpResponse> {
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<SignUpResponse>(`${this.apiUrl}/auth/signup`, request),
      );
      return response;
    } catch (err: unknown) {
      this.error.set(extractErrorMessage(err));
      throw err;
    }
  }

  async changePassword(request: ChangePasswordRequest): Promise<MessageResponse> {
    return firstValueFrom(
      this.http.put<MessageResponse>(`${this.apiUrl}/auth/change-password`, request),
    );
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<MessageResponse> {
    return firstValueFrom(
      this.http.post<MessageResponse>(`${this.apiUrl}/auth/forgot-password`, request),
    );
  }

  async resetPassword(request: ResetPasswordRequest): Promise<MessageResponse> {
    return firstValueFrom(
      this.http.post<MessageResponse>(`${this.apiUrl}/auth/reset-password`, request),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<LogoutResponse>(`${this.apiUrl}/auth/logout`, {}),
      );
    } finally {
      this.currentUser.set(null);
    }
  }

  private readyResolve?: () => void;
  private readonly readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  clearError(): void {
    this.error.set(null);
  }
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'error' in err) {
    const errObj = err as Record<string, unknown>;
    const body = errObj['error'];
    if (typeof body === 'object' && body !== null) {
      const httpError = body as Record<string, unknown>;
      if (typeof httpError['message'] === 'string') {
        return httpError['message'];
      }
      if (Array.isArray(httpError['message'])) {
        return (httpError['message'] as string[]).join('. ');
      }
    }
  }
  return 'An unexpected error occurred.';
}
