import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  TaskCompletionAnalytics,
  UserProductivityAnalytics,
  TaskStatusDistribution,
  TaskPriorityDistribution,
  AnalyticsFilters,
  TeamPerformanceMetrics,
  ProjectAnalytics,
  ApiResponse
} from '../models';

// FIXED: Add missing interfaces that components expect
export interface TaskCompletionRate {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completion_rate: number;
  period: string;
  daily_completion?: { date: string; completed: number; created: number; }[];
}

export interface UserPerformance {
  user_id?: number;
  average_completion_time_days: number;
  overdue_tasks: number;
  productivity_score: number;
  total_hours_logged: number;
}

export interface TaskDistribution {
  status?: string;
  priority?: string;
  count: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // FIXED: Add methods that components are calling
  getTaskCompletionRate(period: string = 'month'): Observable<TaskCompletionRate> {
    this.loadingSubject.next(true);
    
    const filters: AnalyticsFilters = { period: period as any };
    
    return this.getTaskCompletionAnalytics(filters).pipe(
      map(analytics => ({
        total_tasks: analytics.total_tasks,
        completed_tasks: analytics.completed_tasks,
        pending_tasks: analytics.total_tasks - analytics.completed_tasks,
        in_progress_tasks: 0,
        completion_rate: analytics.completion_rate,
        period: analytics.period,
        daily_completion: analytics.daily_completion
      })),
      tap(() => this.loadingSubject.next(false)),
      catchError(error => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  getUserProductivity(): Observable<UserPerformance> {
    this.loadingSubject.next(true);
    
    return this.getUserProductivityAnalytics().pipe(
      map(analytics => {
        if (Array.isArray(analytics) && analytics.length > 0) {
          const first = analytics[0];
          return {
            average_completion_time_days: first.average_completion_time_hours / 24,
            overdue_tasks: first.overdue_tasks,
            productivity_score: first.completion_rate,
            total_hours_logged: first.total_hours_logged
          };
        }
        return {
          average_completion_time_days: 0,
          overdue_tasks: 0,
          productivity_score: 0,
          total_hours_logged: 0
        };
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError(error => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  getTaskStatusDistribution(): Observable<TaskDistribution> {
    this.loadingSubject.next(true);
    
    return this.getTaskStatusDistributionData().pipe(
      map(distributions => ({
        status: 'mixed',
        priority: undefined,
        count: distributions.reduce((sum, d) => sum + d.count, 0),
        percentage: 100
      })),
      tap(() => this.loadingSubject.next(false)),
      catchError(error => {
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  // 🔧 IMPROVED: Better response handling for new format
  getTaskCompletionAnalytics(filters?: AnalyticsFilters): Observable<TaskCompletionAnalytics> {
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

    return this.http.get<ApiResponse<TaskCompletionAnalytics>>(API_ENDPOINTS.ANALYTICS.TASK_COMPLETION, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get task completion analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Better response handling for new format
  getUserProductivityAnalytics(filters?: AnalyticsFilters): Observable<UserProductivityAnalytics[]> {
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

    return this.http.get<ApiResponse<UserProductivityAnalytics[]>>(API_ENDPOINTS.ANALYTICS.USER_PRODUCTIVITY, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get user productivity analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Better response handling for new format
  getTaskStatusDistributionData(filters?: AnalyticsFilters): Observable<TaskStatusDistribution[]> {
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

    return this.http.get<ApiResponse<TaskStatusDistribution[]>>(API_ENDPOINTS.ANALYTICS.STATUS_DISTRIBUTION, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get task status distribution');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Better response handling for new format
  getTaskPriorityDistribution(filters?: AnalyticsFilters): Observable<TaskPriorityDistribution[]> {
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

    return this.http.get<ApiResponse<TaskPriorityDistribution[]>>(API_ENDPOINTS.ANALYTICS.PRIORITY_DISTRIBUTION, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get task priority distribution');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // Team Analytics
  getTeamPerformanceMetrics(filters?: AnalyticsFilters): Observable<TeamPerformanceMetrics> {
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

    return this.http.get<ApiResponse<TeamPerformanceMetrics>>(`${API_ENDPOINTS.ANALYTICS.BASE}/team-performance`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get team performance metrics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // Project Analytics
  getProjectAnalytics(projectId?: number, filters?: AnalyticsFilters): Observable<ProjectAnalytics[]> {
    this.loadingSubject.next(true);
    
    let params = new HttpParams();
    if (projectId) {
      params = params.set('project_id', projectId.toString());
    }
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<ProjectAnalytics[]>>(`${API_ENDPOINTS.ANALYTICS.BASE}/project-analytics`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get project analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // User-specific Analytics
  getUserAnalytics(userId: number, filters?: AnalyticsFilters): Observable<UserProductivityAnalytics> {
    this.loadingSubject.next(true);
    
    let params = new HttpParams();
    params = params.set('user_id', userId.toString());
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<UserProductivityAnalytics>>(`${API_ENDPOINTS.ANALYTICS.USER_PRODUCTIVITY}/${userId}`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get user analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // Time-based Analytics
  getDailyAnalytics(filters?: AnalyticsFilters): Observable<any> {
    const dailyFilters = { ...filters, period: 'daily' as const };
    return this.getTaskCompletionAnalytics(dailyFilters);
  }

  getWeeklyAnalytics(filters?: AnalyticsFilters): Observable<any> {
    const weeklyFilters = { ...filters, period: 'weekly' as const };
    return this.getTaskCompletionAnalytics(weeklyFilters);
  }

  getMonthlyAnalytics(filters?: AnalyticsFilters): Observable<any> {
    const monthlyFilters = { ...filters, period: 'monthly' as const };
    return this.getTaskCompletionAnalytics(monthlyFilters);
  }

  getYearlyAnalytics(filters?: AnalyticsFilters): Observable<any> {
    const yearlyFilters = { ...filters, period: 'yearly' as const };
    return this.getTaskCompletionAnalytics(yearlyFilters);
  }

  // Sprint Analytics
  getSprintAnalytics(sprintId: number, filters?: AnalyticsFilters): Observable<any> {
    this.loadingSubject.next(true);
    
    let params = new HttpParams();
    params = params.set('sprint_id', sprintId.toString());
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<any>>(`${API_ENDPOINTS.ANALYTICS.BASE}/sprint-analytics`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get sprint analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // Dashboard Analytics (combines multiple metrics)
  getDashboardAnalytics(filters?: AnalyticsFilters): Observable<any> {
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

    return this.http.get<ApiResponse<any>>(`${API_ENDPOINTS.ANALYTICS.BASE}/dashboard`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get dashboard analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // Comparison Analytics
  getComparisonAnalytics(filters?: AnalyticsFilters): Observable<any> {
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

    return this.http.get<ApiResponse<any>>(`${API_ENDPOINTS.ANALYTICS.BASE}/comparison`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to get comparison analytics');
          }
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  // Export Analytics
  exportAnalytics(type: string, filters?: AnalyticsFilters): Observable<Blob> {
    let params = new HttpParams();
    params = params.set('type', type);
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get(`${API_ENDPOINTS.ANALYTICS.BASE}/export`, { 
      params, 
      responseType: 'blob' 
    }).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Utility methods for date ranges
  getLastWeekFilters(): AnalyticsFilters {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  }

  getLastMonthFilters(): AnalyticsFilters {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 1);
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  }

  getLastQuarterFilters(): AnalyticsFilters {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 3);
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  }

  getLastYearFilters(): AnalyticsFilters {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
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
    
    console.error('Analytics Service Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}