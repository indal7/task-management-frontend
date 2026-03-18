import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, interval } from 'rxjs';
import { map, catchError, tap, switchMap, startWith } from 'rxjs/operators';

import { API_ENDPOINTS, APP_CONFIG } from '../constants/api.constants';
import { parseApiDate } from '../utils/date-time.util';
import { 
  Notification, 
  CreateNotificationRequest,
  NotificationSummary,
  ApiResponse,
  PaginatedResponse
} from '../models';

// FIXED: Add AppNotification interface that components expect
export interface AppNotification {
  id: number;
  message: string;
  read: boolean;
  createdAt: Date;
  type?: string;
  title?: string;
  user_id?: number;
  action_url?: string;
  task_id?: number;
  related_task_id?: number;
  project_id?: number;
  related_project_id?: number;
  sprint_id?: number;
  related_sprint_id?: number;
}

interface NotificationCollectionResponse {
  unread_count?: number;
  total_notifications?: number;
  recent_notifications?: Notification[];
}

// Export the interface so it can be used elsewhere
export interface NotificationFilters {
  type?: string;
  is_read?: boolean;
  user_id?: number;
  related_task_id?: number;
  related_project_id?: number;
  related_sprint_id?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  // Auto-refresh notifications every 30 seconds
  // public autoRefresh$ = interval(APP_CONFIG.NOTIFICATION_CHECK_INTERVAL)
  //   .pipe(
  //     startWith(0),
  //     switchMap(() => this.getNotifications())
  //   );

  constructor(private http: HttpClient) {
    // Initialize notifications on service creation
    this.initializeNotifications();
  }

  private initializeNotifications(): void {
    this.getNotifications().subscribe();
    this.getNotificationSummary().subscribe();
  }

  // startPolling(): void {
  //   // Start auto-refresh
  //   this.autoRefresh$.subscribe();
  // }

  getUnreadCount(): Observable<number> {
    return this.unreadCount$;
  }

  // 🔧 IMPROVED: Handle new response format with success validation
  getNotifications(unreadOnly: boolean = false): Observable<AppNotification[]> {
    this.loadingSubject.next(true);
    
    let params = new HttpParams();
    if (unreadOnly) {
      params = params.set('unread_only', 'true');
    }

    return this.http.get<ApiResponse<Notification[] | NotificationCollectionResponse>>(API_ENDPOINTS.NOTIFICATIONS.BASE, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            const notifications = this.extractNotifications(response.data);
            const unreadCount = this.extractUnreadCount(response.data, notifications, unreadOnly);

            return {
              notifications: notifications.map(notification => this.convertToAppNotification(notification)),
              unreadCount
            };
          } else {
            throw new Error(response.message || 'Failed to load notifications');
          }
        }),
        tap(({ notifications, unreadCount }) => {
          this.notificationsSubject.next(notifications);
          if (unreadCount !== undefined) {
            this.unreadCountSubject.next(unreadCount);
          }
          this.loadingSubject.next(false);
        }),
        map(({ notifications }) => notifications),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for paginated results
  getNotificationsWithFilters(filters?: NotificationFilters): Observable<PaginatedResponse<Notification>> {
    this.loadingSubject.next(true);
    
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<PaginatedResponse<Notification>>>(API_ENDPOINTS.NOTIFICATIONS.BASE, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load notifications with filters');
          }
        }),
        tap(paginatedResponse => {
          const appNotifications = paginatedResponse.data.map(n => this.convertToAppNotification(n));
          this.notificationsSubject.next(appNotifications);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format
  getNotificationById(id: number): Observable<Notification> {
    return this.http.get<ApiResponse<Notification>>(`${API_ENDPOINTS.NOTIFICATIONS.BASE}/${id}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load notification');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for mark as read
  markAsRead(id: number): Observable<AppNotification> {
    return this.http.post<ApiResponse<Notification>>(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id), {})
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return this.convertToAppNotification(response.data);
          } else {
            throw new Error(response.message || 'Failed to mark notification as read');
          }
        }),
        tap(updatedNotification => {
          const currentNotifications = this.notificationsSubject.value;
          const index = currentNotifications.findIndex(notif => notif.id === id);
          if (index !== -1) {
            currentNotifications[index] = updatedNotification;
            this.notificationsSubject.next([...currentNotifications]);
          }
          // Update unread count
          this.updateUnreadCount();
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format
  markAllAsRead(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(API_ENDPOINTS.NOTIFICATIONS.READ_ALL, {})
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to mark all notifications as read');
          }
          return response;
        }),
        tap(() => {
          const currentNotifications = this.notificationsSubject.value;
          const updatedNotifications = currentNotifications.map(notif => ({
            ...notif,
            read: true
          }));
          this.notificationsSubject.next(updatedNotifications);
          this.unreadCountSubject.next(0);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format
  createNotification(notificationData: CreateNotificationRequest): Observable<Notification> {
    return this.http.post<ApiResponse<Notification>>(API_ENDPOINTS.NOTIFICATIONS.BASE, notificationData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to create notification');
          }
        }),
        tap(notification => {
          const appNotification = this.convertToAppNotification(notification);
          const currentNotifications = this.notificationsSubject.value;
          this.notificationsSubject.next([appNotification, ...currentNotifications]);
          this.updateUnreadCount();
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for delete
  deleteNotification(id: number): Observable<void> {
    return this.http.delete<ApiResponse>(API_ENDPOINTS.NOTIFICATIONS.DELETE(id))
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to delete notification');
          }
          return void 0; // Return void as expected by components
        }),
        tap(() => {
          const currentNotifications = this.notificationsSubject.value;
          const filteredNotifications = currentNotifications.filter(notif => notif.id !== id);
          this.notificationsSubject.next(filteredNotifications);
          this.updateUnreadCount();
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for summary
  getNotificationSummary(): Observable<NotificationSummary> {
    return this.http.get<ApiResponse<NotificationSummary>>(`${API_ENDPOINTS.NOTIFICATIONS.BASE}/summary`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load notification summary');
          }
        }),
        tap(summary => {
          this.unreadCountSubject.next(summary.unread_count);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // Utility methods
  getUnreadNotifications(): Observable<AppNotification[]> {
    return this.getNotifications(true);
  }

  getNotificationsByType(type: string): Observable<AppNotification[]> {
    return this.getNotificationsWithFilters({ type })
      .pipe(
        map(response => response.data.map(this.convertToAppNotification))
      );
  }

  private updateUnreadCount(): void {
    const unreadCount = this.notificationsSubject.value.filter(notif => !notif.read).length;
    this.unreadCountSubject.next(unreadCount);
  }

  private extractNotifications(data: Notification[] | NotificationCollectionResponse): Notification[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.recent_notifications)) {
      return data.recent_notifications;
    }

    return [];
  }

  private extractUnreadCount(
    data: Notification[] | NotificationCollectionResponse,
    notifications: Notification[],
    unreadOnly: boolean
  ): number | undefined {
    if (!Array.isArray(data) && typeof data.unread_count === 'number') {
      return data.unread_count;
    }

    if (!unreadOnly) {
      return notifications.filter(notification => this.isNotificationRead(notification) === false).length;
    }

    return undefined;
  }

  private isNotificationRead(notification: Notification): boolean {
    return notification.read ?? notification.is_read ?? false;
  }

  // FIXED: Convert API Notification to AppNotification format
  private convertToAppNotification(notification: Notification): AppNotification {
    const taskId = notification.task_id ?? notification.related_task_id;
    const projectId = notification.project_id ?? notification.related_project_id;
    const sprintId = notification.sprint_id ?? notification.related_sprint_id;

    return {
      id: notification.id,
      message: notification.message,
      read: this.isNotificationRead(notification),
      createdAt: parseApiDate(notification.created_at) || new Date(),
      type: notification.type,
      title: notification.title,
      user_id: notification.user_id ?? notification.user?.id ?? notification.related_user?.id,
      action_url: notification.action_url,
      task_id: taskId,
      related_task_id: notification.related_task_id,
      project_id: projectId,
      related_project_id: notification.related_project_id,
      sprint_id: sprintId,
      related_sprint_id: notification.related_sprint_id
    };
  }

  // 🔧 IMPROVED: Better error handling for new response format
  private handleError(error: HttpErrorResponse): Observable<never> {
    this.loadingSubject.next(false);
    
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
    
    console.error('Notification Service Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}