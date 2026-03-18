import { Injectable, Injector } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { STORAGE_KEYS, APP_CONFIG } from '../constants/api.constants';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(
    private injector: Injector,
    private router: Router
  ) {}

  private get authService(): AuthService {
    return this.injector.get(AuthService);
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Add auth header with jwt token if available
    const token = this.authService.getToken();
    
    if (token && this.isAuthenticatedRequest(request)) {
      request = this.addTokenHeader(request, token);
    }

    // Add common headers
    request = this.addCommonHeaders(request);

    return next.handle(request).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse) {
          switch (error.status) {
            case 401:
              return this.handle401Error(request, next);
            case 403:
              return this.handle403Error(error);
            case 500:
              return this.handle500Error(error);
            default:
              return this.handleGenericError(error);
          }
        }
        return throwError(() => error);
      })
    );
  }

  private isAuthenticatedRequest(request: HttpRequest<any>): boolean {
    // Don't add token to login/register requests
    const authEndpoints = ['/auth/login', '/auth/register', '/auth/refresh'];
    return !authEndpoints.some(endpoint => request.url.includes(endpoint));
  }

  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      headers: request.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  private addCommonHeaders(request: HttpRequest<any>): HttpRequest<any> {
    let headers = request.headers;

    // Add Content-Type for non-FormData requests
    if (!(request.body instanceof FormData)) {
      headers = headers.set('Content-Type', 'application/json');
    }

    // Add Accept header
    headers = headers.set('Accept', 'application/json');

    // Add custom headers
    headers = headers.set('X-Requested-With', 'XMLHttpRequest');
    headers = headers.set('X-Client-Version', '1.0.0');

    return request.clone({ headers });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.authService.getRefreshToken();

      if (refreshToken) {
        return this.authService.refreshToken().pipe(
          switchMap((authResponse: any) => {
            this.isRefreshing = false;
            this.refreshTokenSubject.next(authResponse.access_token);
            
            return next.handle(this.addTokenHeader(request, authResponse.access_token));
          }),
          catchError((error) => {
            this.isRefreshing = false;
            this.authService.logout(true);
            return throwError(() => error);
          })
        );
      } else {
        this.authService.logout(true);
        return throwError(() => new Error('No refresh token available'));
      }
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addTokenHeader(request, token)))
    );
  }

  private handle403Error(error: HttpErrorResponse): Observable<never> {
    console.error('Access forbidden:', error);
    
    // You might want to redirect to a "access denied" page
    // this.router.navigate(['/access-denied']);
    
    return throwError(() => new Error('Access forbidden. You do not have permission to perform this action.'));
  }

  private handle500Error(error: HttpErrorResponse): Observable<never> {
    console.error('Server error:', error);
    
    // You might want to show a global error message or redirect to an error page
    let errorMessage = 'Internal server error. Please try again later.';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }

  private handleGenericError(error: HttpErrorResponse): Observable<never> {
    console.error('HTTP Error:', error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
        errorMessage = error.error.errors[0];
      } else if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else {
        errorMessage = `Error ${error.status}: ${error.statusText || 'Unknown error'}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Utility method to check if token is expired
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      
      // Add buffer time (5 minutes) before actual expiry
      return (expiry - APP_CONFIG.TOKEN_EXPIRY_BUFFER) <= now;
    } catch {
      return true; // If we can't parse the token, consider it expired
    }
  }

  // Method to preemptively refresh token if it's about to expire
  private shouldRefreshToken(token: string): boolean {
    return this.isTokenExpired(token) && !this.isRefreshing;
  }
}