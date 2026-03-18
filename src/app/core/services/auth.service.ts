import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval, throwError, of } from 'rxjs';
import { map, catchError, tap, finalize, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { API_ENDPOINTS, STORAGE_KEYS } from '../constants/api.constants';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  RefreshTokenRequest,
  ChangePasswordRequest,
  ProfileUpdateRequest,
  User,
  AuthUser,
  ApiResponse
} from '../models';
import { UpdateUserRequest } from '../models/user.model';

// FIXED: Add missing types that components expect
export interface UserListItem {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  is_active: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UserListFilters {
  page?: number;
  per_page?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}

export interface ActivityLogEntry {
  id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details?: any;
  created_at: string;
}

export interface UserActivityResponse {
  activity: ActivityLogEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface PresenceStatusResponse {
  user_id: number;
  is_online: boolean;
  last_seen_at: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private logoutInProgress = false;
  private presenceHeartbeatSubscription: Subscription | null = null;

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  redirectUrl: string = '/dashboard';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeAuth();
    this.registerUnloadLogoutBeacon();
  }

  private initializeAuth(): void {
    const token = this.getToken();
    const user = this.getStoredUser();
    
    if (token && user) {
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
      // Defer heartbeat start to avoid bootstrap-time interceptor DI cycles.
      setTimeout(() => this.startPresenceHeartbeat(), 0);
    }
  }

  // 🔧 FIXED: Updated login to handle new response format
  login(credentials: LoginRequest): Observable<AuthResponse> {
    this.loadingSubject.next(true);
    // console.log('Attempting login with credentials:', credentials);

    return this.http.post<ApiResponse<AuthResponse>>(API_ENDPOINTS.AUTH.LOGIN, credentials)
      .pipe(
        map(response => {
          // Handle new response format: { success: true, data: AuthResponse, ... }
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Login failed');
          }
        }),
        tap(authResponse => {
          this.handleAuthSuccess(authResponse);
          // console.log('Login successful:', authResponse);
        }),
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  // 🔧 FIXED: Updated register to handle new response format  
  register(userData: RegisterRequest): Observable<User> {
    this.loadingSubject.next(true);
    
    return this.http.post<ApiResponse<{ user: User }>>(API_ENDPOINTS.AUTH.REGISTER, userData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data.user;
          } else {
            throw new Error(response.message || 'Registration failed');
          }
        }),
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  // 🔧 FIXED: Updated refreshToken to handle new response format
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const request: RefreshTokenRequest = { refresh_token: refreshToken };
    
    return this.http.post<ApiResponse<AuthResponse>>(API_ENDPOINTS.AUTH.REFRESH, request)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Token refresh failed');
          }
        }),
        tap(authResponse => {
          this.handleAuthSuccess(authResponse);
        }),
        catchError(error => {
          this.logout(true);
          return throwError(() => error);
        })
      );
  }

  logout(localOnly = false): void {
    if (this.logoutInProgress) {
      return;
    }
    this.logoutInProgress = true;
    this.loadingSubject.next(true);

    if (localOnly) {
      this.clearClientSessionAndRedirect();
      return;
    }

    const token = this.getToken();
    if (!token) {
      this.clearClientSessionAndRedirect();
      return;
    }

    this.http.post<ApiResponse>(API_ENDPOINTS.AUTH.LOGOUT, {
      reason: 'manual_logout',
      source: 'ui'
    }).pipe(
      finalize(() => this.clearClientSessionAndRedirect())
    ).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  // 🔧 FIXED: Updated getCurrentUser to handle new response format
  getCurrentUser(): Observable<User> {
    return this.http.get<ApiResponse<User>>(API_ENDPOINTS.AUTH.ME)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get user profile');
          }
        }),
        tap(user => {
          this.currentUserSubject.next(user);
          this.storeUser(user);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 FIXED: Updated updateProfile to handle new response format
  updateProfile(profileData: ProfileUpdateRequest): Observable<User> {
    this.loadingSubject.next(true);
    
    return this.http.put<ApiResponse<any>>(API_ENDPOINTS.AUTH.PROFILE, profileData)
      .pipe(
        map(response => {
          if (response.success && response.data !== undefined) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to update profile');
          }
        }),
        switchMap((data: any) => {
          if (data && typeof data === 'object' && 'id' in data) {
            return of(data as User);
          }
          return this.getCurrentUser();
        }),
        tap(user => {
          this.currentUserSubject.next(user);
          this.storeUser(user);
        }),
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  // 🔧 FIXED: Updated changePassword to handle new response format
  changePassword(passwordData: ChangePasswordRequest): Observable<ApiResponse> {
    this.loadingSubject.next(true);
    
    return this.http.post<ApiResponse>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, passwordData)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to change password');
          }
          return response;
        }),
        catchError(this.handleError.bind(this)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  // 🔧 FIXED: Updated getUsers to handle new response format
  getUsers(): Observable<UserListItem[]> {
    return this.http.get<ApiResponse<User[]>>(API_ENDPOINTS.AUTH.USERS)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            const users = response.data;
            return users.map(user => ({
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              avatar_url: user.avatar_url,
              is_active: user.is_active
            }));
          } else {
            throw new Error(response.message || 'Failed to get users');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  listUsers(filters?: UserListFilters): Observable<UserListResponse> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }

    return this.http.get<ApiResponse<UserListResponse>>(API_ENDPOINTS.USERS.BASE, { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to load users');
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getUserById(userId: number): Observable<User> {
    return this.http.get<ApiResponse<User>>(API_ENDPOINTS.USERS.BY_ID(userId)).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to load user details');
      }),
      catchError(this.handleError.bind(this))
    );
  }

  updateUserByAdmin(userId: number, data: UpdateUserRequest): Observable<User> {
    return this.http.put<ApiResponse<User>>(API_ENDPOINTS.USERS.BY_ID(userId), data).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to update user');
      }),
      catchError(this.handleError.bind(this))
    );
  }

  deactivateUser(userId: number): Observable<void> {
    return this.http.delete<ApiResponse>(API_ENDPOINTS.USERS.BY_ID(userId)).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to deactivate user');
        }
        return void 0;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  activateUser(userId: number): Observable<void> {
    return this.http.post<ApiResponse>(API_ENDPOINTS.USERS.ACTIVATE(userId), {}).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to activate user');
        }
        return void 0;
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getUserActivity(userId: number, page = 1, perPage = 20): Observable<UserActivityResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    return this.http.get<ApiResponse<UserActivityResponse>>(API_ENDPOINTS.ACTIVITY.USER(userId), { params }).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to load user activity');
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getPresenceStatus(userId: number): Observable<PresenceStatusResponse> {
    return this.http.get<ApiResponse<PresenceStatusResponse>>(API_ENDPOINTS.AUTH.PRESENCE_STATUS(userId)).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to load presence status');
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // 🔧 FIXED: Updated ping to handle new response format
  ping(): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(API_ENDPOINTS.AUTH.PING)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Ping failed');
          }
          return response;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // Utility methods
  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  getStoredUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    // Check if token is expired
    if (this.isTokenExpired(token)) {
      this.logout(true);
      return false;
    }
    
    return this.isAuthenticatedSubject.value;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error parsing token:', error);
      return true; // Consider invalid tokens as expired
    }
  }

  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUserValue();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUserValue();
    return user ? roles.includes(user.role) : false;
  }

  private handleAuthSuccess(authResponse: AuthResponse): void {
    // console.log('Handling auth success:', authResponse);
    // Store tokens
    localStorage.setItem(STORAGE_KEYS.TOKEN, authResponse.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refresh_token);
    
    // Store user
    this.storeUser(authResponse.user);
    
    // Update subjects
    this.currentUserSubject.next(authResponse.user);
    this.isAuthenticatedSubject.next(true);
    this.startPresenceHeartbeat();
  }

  private storeUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  private registerUnloadLogoutBeacon(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('pagehide', () => {
      this.sendLogoutBeacon('pagehide');
    });
  }

  private startPresenceHeartbeat(): void {
    if (this.presenceHeartbeatSubscription) {
      return;
    }

    // Keep online status warm while app is active.
    this.presenceHeartbeatSubscription = interval(60000).subscribe(() => {
      this.sendPresenceHeartbeat();
    });
  }

  private stopPresenceHeartbeat(): void {
    if (this.presenceHeartbeatSubscription) {
      this.presenceHeartbeatSubscription.unsubscribe();
      this.presenceHeartbeatSubscription = null;
    }
  }

  private sendPresenceHeartbeat(): void {
    const token = this.getToken();
    const user = this.getCurrentUserValue();
    if (!token || !user?.id) {
      return;
    }

    this.http.post<ApiResponse>(API_ENDPOINTS.AUTH.PRESENCE_HEARTBEAT, {
      source: 'web_heartbeat'
    }).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  private sendLogoutBeacon(reason: string): void {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return;
    }

    if (this.logoutInProgress) {
      return;
    }

    const token = this.getToken();
    const currentUser = this.getCurrentUserValue();
    if (!token || !currentUser?.id) {
      return;
    }

    const payload = {
      token,
      reason,
      source: 'browser_beacon'
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(API_ENDPOINTS.AUTH.LOGOUT, blob);
  }

  private clearClientSessionAndRedirect(): void {
    this.stopPresenceHeartbeat();

    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);

    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.loadingSubject.next(false);
    this.logoutInProgress = false;

    this.router.navigate(['/auth/login']);
  }

  // 🔧 IMPROVED: Better error handling for new response format
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error - handle new response format
      if (error.error?.success === false) {
        // New standardized error format
        errorMessage = error.error.message || `Error ${error.status}`;
      } else if (error.error?.message) {
        // Legacy error format
        errorMessage = error.error.message;
      } else if (error.error?.errors && error.error.errors.length > 0) {
        errorMessage = error.error.errors[0];
      } else {
        errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Auth Service Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}