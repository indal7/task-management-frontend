import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role?: string;
  timezone?: string;
  daily_work_hours?: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

// export interface ChangePasswordRequest {
//   current_password: string;
//   new_password: string;
// }

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  timezone: string;
  daily_work_hours: number;
  is_active: boolean;
  last_login?: string;
  permissions?: string[];
}

export interface LoginResponse {
  message: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface ProfileUpdateRequest {
  name?: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  skills?: string[];
  github_username?: string;
  linkedin_url?: string;
  phone?: string;
  timezone?: string;
  daily_work_hours?: number;
  hourly_rate?: number;
}

export interface TokenInfo {
  token: string;
  expires_at: Date;
  is_expired: boolean;
  user_id: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}