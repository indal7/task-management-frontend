import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
// import { LoadingService } from '../services/loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private activeRequests = 0;
  private globalOverlayRequests = 0;
  private skippedEndpoints = [
    '/auth/ping',
    '/auth/me',
    '/auth/profile',
    '/health',
    '/notifications/summary'
  ];

  constructor(private loadingService: LoadingService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip loading for certain endpoints
    if (this.shouldSkipLoading(request)) {
      return next.handle(request);
    }

    // Start loading
    this.startLoading(request);

    return next.handle(request).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          this.handleResponse(request, event);
        }
      }),
      finalize(() => {
        this.stopLoading(request);
      })
    );
  }

  private shouldSkipLoading(request: HttpRequest<any>): boolean {
    // Skip loading for specified endpoints
    if (this.skippedEndpoints.some(endpoint => request.url.includes(endpoint))) {
      return true;
    }

    // Skip loading for requests with specific headers
    if (request.headers.get('X-Skip-Loading') === 'true') {
      return true;
    }

    // Skip loading for background requests (polling, etc.)
    if (request.headers.get('X-Background-Request') === 'true') {
      return true;
    }

    return false;
  }

  private startLoading(request: HttpRequest<any>): void {
    this.activeRequests++;

    if (this.shouldShowGlobalOverlay(request)) {
      this.globalOverlayRequests++;
    }

    if (this.globalOverlayRequests === 1 && this.shouldShowGlobalOverlay(request)) {
      this.loadingService.show();
    }

    // Set loading for specific request types
    this.setSpecificLoading(request, true);
  }

  private stopLoading(request: HttpRequest<any>): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    if (this.shouldShowGlobalOverlay(request)) {
      this.globalOverlayRequests = Math.max(0, this.globalOverlayRequests - 1);
    }

    if (this.globalOverlayRequests === 0) {
      this.loadingService.hide();
    }

    // Clear loading for specific request types
    this.setSpecificLoading(request, false);
  }

  private shouldShowGlobalOverlay(request: HttpRequest<any>): boolean {
    const method = request.method.toUpperCase();
    const url = request.url.toLowerCase();

    if (method !== 'GET') {
      return true;
    }

    return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
  }

  private setSpecificLoading(request: HttpRequest<any>, isLoading: boolean): void {
    const url = request.url.toLowerCase();
    const method = request.method.toUpperCase();

    // Set specific loading states based on endpoints
    if (url.includes('/tasks')) {
      if (method === 'GET') {
        this.loadingService.setTasksLoading(isLoading);
      } else if (method === 'POST') {
        this.loadingService.setTaskCreating(isLoading);
      } else if (method === 'PUT' || method === 'PATCH') {
        this.loadingService.setTaskUpdating(isLoading);
      } else if (method === 'DELETE') {
        this.loadingService.setTaskDeleting(isLoading);
      }
    } else if (url.includes('/projects')) {
      if (method === 'GET') {
        this.loadingService.setProjectsLoading(isLoading);
      } else if (method === 'POST') {
        this.loadingService.setProjectCreating(isLoading);
      } else if (method === 'PUT' || method === 'PATCH') {
        this.loadingService.setProjectUpdating(isLoading);
      } else if (method === 'DELETE') {
        this.loadingService.setProjectDeleting(isLoading);
      }
    } else if (url.includes('/sprints')) {
      if (method === 'GET') {
        this.loadingService.setSprintsLoading(isLoading);
      } else if (method === 'POST') {
        this.loadingService.setSprintCreating(isLoading);
      } else if (method === 'PUT' || method === 'PATCH') {
        this.loadingService.setSprintUpdating(isLoading);
      } else if (method === 'DELETE') {
        this.loadingService.setSprintDeleting(isLoading);
      }
    } else if (url.includes('/auth')) {
      if (url.includes('/login')) {
        this.loadingService.setAuthLoading(isLoading);
      } else if (url.includes('/register')) {
        this.loadingService.setAuthLoading(isLoading);
      } else if (url.includes('/profile')) {
        this.loadingService.setProfileUpdating(isLoading);
      }
    } else if (url.includes('/analytics')) {
      this.loadingService.setAnalyticsLoading(isLoading);
    } else if (url.includes('/notifications')) {
      this.loadingService.setNotificationsLoading(isLoading);
    }
  }

  private handleResponse(request: HttpRequest<any>, response: HttpResponse<any>): void {
    // Log response details in development
    if (!this.isProduction()) {
      // console.group(`📡 HTTP Response: ${request.method} ${request.url}`);
      // console.log('Status:', response.status);
      // console.log('Response Time:', this.getResponseTime(request));
      // console.log('Response Size:', this.getResponseSize(response));
      console.groupEnd();
    }

    // Handle specific response scenarios
    this.handleSpecificResponses(request, response);
  }

  private handleSpecificResponses(request: HttpRequest<any>, response: HttpResponse<any>): void {
    const url = request.url.toLowerCase();

    // Handle authentication responses
    if (url.includes('/auth/login') && response.status === 200) {
      // console.log('✅ Login successful');
    }

    // Handle creation responses
    if (request.method === 'POST' && response.status === 201) {
      // console.log('✅ Resource created successfully');
    }

    // Handle update responses
    if ((request.method === 'PUT' || request.method === 'PATCH') && response.status === 200) {
      // console.log('✅ Resource updated successfully');
    }

    // Handle deletion responses
    if (request.method === 'DELETE' && response.status === 200) {
      // console.log('✅ Resource deleted successfully');
    }
  }

  private getResponseTime(request: HttpRequest<any>): string {
    // This is a simplified version - in a real app you'd track start time
    return 'N/A';
  }

  private getResponseSize(response: HttpResponse<any>): string {
    const body = response.body;
    if (typeof body === 'string') {
      return `${body.length} bytes`;
    } else if (body) {
      return `${JSON.stringify(body).length} bytes`;
    }
    return '0 bytes';
  }

  private isProduction(): boolean {
    // You can inject environment here or check window.location
    return false; // Set this based on your environment detection
  }
}

// Loading Service
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private tasksLoadingSubject = new BehaviorSubject<boolean>(false);
  private projectsLoadingSubject = new BehaviorSubject<boolean>(false);
  private sprintsLoadingSubject = new BehaviorSubject<boolean>(false);
  private authLoadingSubject = new BehaviorSubject<boolean>(false);
  private analyticsLoadingSubject = new BehaviorSubject<boolean>(false);
  private notificationsLoadingSubject = new BehaviorSubject<boolean>(false);
  
  // Specific action loading states
  private taskCreatingSubject = new BehaviorSubject<boolean>(false);
  private taskUpdatingSubject = new BehaviorSubject<boolean>(false);
  private taskDeletingSubject = new BehaviorSubject<boolean>(false);
  private projectCreatingSubject = new BehaviorSubject<boolean>(false);
  private projectUpdatingSubject = new BehaviorSubject<boolean>(false);
  private projectDeletingSubject = new BehaviorSubject<boolean>(false);
  private sprintCreatingSubject = new BehaviorSubject<boolean>(false);
  private sprintUpdatingSubject = new BehaviorSubject<boolean>(false);
  private sprintDeletingSubject = new BehaviorSubject<boolean>(false);
  private profileUpdatingSubject = new BehaviorSubject<boolean>(false);

  // Observable streams
  public loading$ = this.loadingSubject.asObservable();
  public tasksLoading$ = this.tasksLoadingSubject.asObservable();
  public projectsLoading$ = this.projectsLoadingSubject.asObservable();
  public sprintsLoading$ = this.sprintsLoadingSubject.asObservable();
  public authLoading$ = this.authLoadingSubject.asObservable();
  public analyticsLoading$ = this.analyticsLoadingSubject.asObservable();
  public notificationsLoading$ = this.notificationsLoadingSubject.asObservable();
  
  // Action loading streams
  public taskCreating$ = this.taskCreatingSubject.asObservable();
  public taskUpdating$ = this.taskUpdatingSubject.asObservable();
  public taskDeleting$ = this.taskDeletingSubject.asObservable();
  public projectCreating$ = this.projectCreatingSubject.asObservable();
  public projectUpdating$ = this.projectUpdatingSubject.asObservable();
  public projectDeleting$ = this.projectDeletingSubject.asObservable();
  public sprintCreating$ = this.sprintCreatingSubject.asObservable();
  public sprintUpdating$ = this.sprintUpdatingSubject.asObservable();
  public sprintDeleting$ = this.sprintDeletingSubject.asObservable();
  public profileUpdating$ = this.profileUpdatingSubject.asObservable();

  show(): void {
    this.loadingSubject.next(true);
  }

  hide(): void {
    this.loadingSubject.next(false);
  }

  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  // Specific loading setters
  setTasksLoading(loading: boolean): void {
    this.tasksLoadingSubject.next(loading);
  }

  setProjectsLoading(loading: boolean): void {
    this.projectsLoadingSubject.next(loading);
  }

  setSprintsLoading(loading: boolean): void {
    this.sprintsLoadingSubject.next(loading);
  }

  setAuthLoading(loading: boolean): void {
    this.authLoadingSubject.next(loading);
  }

  setAnalyticsLoading(loading: boolean): void {
    this.analyticsLoadingSubject.next(loading);
  }

  setNotificationsLoading(loading: boolean): void {
    this.notificationsLoadingSubject.next(loading);
  }

  // Action loading setters
  setTaskCreating(loading: boolean): void {
    this.taskCreatingSubject.next(loading);
  }

  setTaskUpdating(loading: boolean): void {
    this.taskUpdatingSubject.next(loading);
  }

  setTaskDeleting(loading: boolean): void {
    this.taskDeletingSubject.next(loading);
  }

  setProjectCreating(loading: boolean): void {
    this.projectCreatingSubject.next(loading);
  }

  setProjectUpdating(loading: boolean): void {
    this.projectUpdatingSubject.next(loading);
  }

  setProjectDeleting(loading: boolean): void {
    this.projectDeletingSubject.next(loading);
  }

  setSprintCreating(loading: boolean): void {
    this.sprintCreatingSubject.next(loading);
  }

  setSprintUpdating(loading: boolean): void {
    this.sprintUpdatingSubject.next(loading);
  }

  setSprintDeleting(loading: boolean): void {
    this.sprintDeletingSubject.next(loading);
  }

  setProfileUpdating(loading: boolean): void {
    this.profileUpdatingSubject.next(loading);
  }
}