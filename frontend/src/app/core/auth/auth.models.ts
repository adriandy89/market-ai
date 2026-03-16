export interface SessionUser {
  id: string;
  email: string;
  name: string;
  disabled: boolean;
  role: string;
}

export interface SignInRequest {
  username: string;
  password: string;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignInResponse {
  user: SessionUser;
}

export interface ProfileResponse {
  user: SessionUser;
}

export interface SignUpResponse {
  ok: boolean;
  active?: boolean;
  message?: string;
}

export interface LogoutResponse {
  message: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}
