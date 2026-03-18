import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  Task, 
  CreateTaskRequest, 
  UpdateTaskRequest, 
  AssignTaskRequest,
  TaskComment,
  CreateCommentRequest,
  UpdateCommentRequest,
  TimeLog,
  CreateTimeLogRequest,
  UpdateTimeLogRequest,
  ApiResponse,
  PaginatedResponse
} from '../models';

export interface TaskFilters {
  status?: string;
  priority?: string;
  task_type?: string;
  assigned_to_id?: number;
  project_id?: number;
  sprint_id?: number;
  created_by_id?: number;
  created_by?: number; // Alternative field name
  overdue?: boolean;
  due_date_from?: string;
  due_date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public tasks$ = this.tasksSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // FIXED: Add getAllTasks method that components are calling
  getAllTasks(filters?: TaskFilters): Observable<Task[]> {
    return this.getTasks(filters).pipe(
      map(response => response.data)
    );
  }

  // 🔧 IMPROVED: Handle new response format for tasks list
  getTasks(filters?: TaskFilters): Observable<PaginatedResponse<Task>> {
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

    return this.http.get<ApiResponse<PaginatedResponse<Task>>>(API_ENDPOINTS.TASKS.BASE, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load tasks');
          }
        }),
        tap(paginatedResponse => {
          this.tasksSubject.next(paginatedResponse.data);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format
  getTaskById(id: number): Observable<Task> {
    return this.http.get<ApiResponse<Task>>(API_ENDPOINTS.TASKS.BY_ID(id))
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load task');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for create
  createTask(taskData: CreateTaskRequest): Observable<Task> {
    this.loadingSubject.next(true);
    
    return this.http.post<ApiResponse<Task>>(API_ENDPOINTS.TASKS.BASE, taskData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to create task');
          }
        }),
        tap(task => {
          const currentTasks = this.tasksSubject.value;
          this.tasksSubject.next([task, ...currentTasks]);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for update
  updateTask(id: number, taskData: UpdateTaskRequest): Observable<Task> {
    this.loadingSubject.next(true);
    
    return this.http.put<ApiResponse<Task>>(API_ENDPOINTS.TASKS.BY_ID(id), taskData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to update task');
          }
        }),
        tap(updatedTask => {
          const currentTasks = this.tasksSubject.value;
          const index = currentTasks.findIndex(task => task.id === id);
          if (index !== -1) {
            currentTasks[index] = updatedTask;
            this.tasksSubject.next([...currentTasks]);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for delete
  deleteTask(id: number): Observable<ApiResponse> {
    this.loadingSubject.next(true);
    
    return this.http.delete<ApiResponse>(API_ENDPOINTS.TASKS.BY_ID(id))
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to delete task');
          }
          return response;
        }),
        tap(() => {
          const currentTasks = this.tasksSubject.value;
          const filteredTasks = currentTasks.filter(task => task.id !== id);
          this.tasksSubject.next(filteredTasks);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for assign
  assignTask(id: number, assignData: AssignTaskRequest): Observable<Task> {
    const payload: { user_id: number } = {
      user_id: (assignData as any).user_id ?? (assignData as any).assigned_to_id
    };

    return this.http.post<ApiResponse<Task>>(API_ENDPOINTS.TASKS.ASSIGN(id), payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to assign task');
          }
        }),
        tap(updatedTask => {
          const currentTasks = this.tasksSubject.value;
          const index = currentTasks.findIndex(task => task.id === id);
          if (index !== -1) {
            currentTasks[index] = updatedTask;
            this.tasksSubject.next([...currentTasks]);
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for overdue tasks
  getOverdueTasks(): Observable<Task[]> {
    return this.http.get<ApiResponse<Task[]>>(API_ENDPOINTS.TASKS.OVERDUE)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            console.log('Overdue tasks data:', response);
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load overdue tasks');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Task Comments with new response format
  getTaskComments(taskId: number): Observable<TaskComment[]> {
    return this.http.get<ApiResponse<TaskComment[]>>(API_ENDPOINTS.TASKS.COMMENTS(taskId))
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load task comments');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  createTaskComment(taskId: number, commentData: CreateCommentRequest): Observable<TaskComment> {
    return this.http.post<ApiResponse<TaskComment>>(API_ENDPOINTS.TASKS.COMMENTS(taskId), commentData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to create task comment');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // FIXED: Add addComment method that components are calling
  addComment(taskId: number, commentData: { text: string }): Observable<TaskComment> {
    const createCommentRequest: CreateCommentRequest = {
      text: commentData.text
    };
    return this.createTaskComment(taskId, createCommentRequest);
  }

  updateTaskComment(commentId: number, commentData: UpdateCommentRequest): Observable<TaskComment> {
    return this.http.put<ApiResponse<TaskComment>>(API_ENDPOINTS.TASKS.COMMENT_BY_ID(commentId), commentData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to update task comment');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  deleteTaskComment(commentId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(API_ENDPOINTS.TASKS.COMMENT_BY_ID(commentId))
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to delete task comment');
          }
          return response;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Time Logs with new response format
  getTaskTimeLogs(taskId: number): Observable<TimeLog[]> {
    return this.http.get<ApiResponse<TimeLog[]>>(API_ENDPOINTS.TASKS.TIME_LOG(taskId))
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load task time logs');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  createTimeLog(taskId: number, timeLogData: CreateTimeLogRequest): Observable<TimeLog> {
    const normalizedHours = timeLogData.hours ?? timeLogData.hours_logged;
    const normalizedWorkDate = timeLogData.work_date || (timeLogData.logged_at ? timeLogData.logged_at.split('T')[0] : undefined);

    const payload: { hours?: number; description?: string; work_date?: string } = {
      hours: normalizedHours,
      description: timeLogData.description,
      work_date: normalizedWorkDate
    };

    return this.http.post<ApiResponse<TimeLog>>(API_ENDPOINTS.TASKS.TIME_LOG(taskId), payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to create time log');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  updateTimeLog(taskId: number, timeLogId: number, timeLogData: UpdateTimeLogRequest): Observable<TimeLog> {
    const normalizedHours = timeLogData.hours ?? timeLogData.hours_logged;
    const normalizedWorkDate = timeLogData.work_date || (timeLogData.logged_at ? timeLogData.logged_at.split('T')[0] : undefined);
    const payload: { hours?: number; description?: string; work_date?: string } = {
      hours: normalizedHours,
      description: timeLogData.description,
      work_date: normalizedWorkDate
    };

    return this.http.put<ApiResponse<TimeLog>>(`${API_ENDPOINTS.TASKS.TIME_LOG(taskId)}/${timeLogId}`, payload)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to update time log');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  deleteTimeLog(taskId: number, timeLogId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${API_ENDPOINTS.TASKS.TIME_LOG(taskId)}/${timeLogId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to delete time log');
          }
          return response;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: User time logs with new response format
  getUserTimeLogs(filters?: { start_date?: string; end_date?: string; limit?: number }): Observable<{
    time_logs: TimeLog[];
    total_hours: number;
    total_entries: number;
    daily_breakdown: Array<{ date: string; total_hours: number; logs: TimeLog[] }>;
  }> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = (filters as any)[key];
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, value.toString());
        }
      });
    }

    return this.http.get<ApiResponse<any>>(API_ENDPOINTS.TASKS.USER_TIME_LOGS, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load user time logs');
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // Utility methods
  getMyTasks(): Observable<Task[]> {
    return this.getTasks({ assigned_to_id: this.getCurrentUserId() })
      .pipe(
        map(response => response.data)
      );
  }

  getTasksByStatus(status: string): Observable<Task[]> {
    return this.getTasks({ status })
      .pipe(
        tap(response => {
          console.log(`Tasks with status ${status}:`, response);
        }),
        map(response => response.data)
      );
  }

  getTasksByProject(projectId: number): Observable<Task[]> {
    return this.getTasks({ project_id: projectId })
      .pipe(
        map(response => response.data)
      );
  }

  getTasksBySprint(sprintId: number): Observable<Task[]> {
    return this.getTasks({ sprint_id: sprintId })
      .pipe(
        map(response => response.data)
      );
  }

  searchTasks(query: string): Observable<Task[]> {
    return this.getTasks({ search: query })
      .pipe(
        map(response => response.data)
      );
  }

  private getCurrentUserId(): number {
    // Get from auth service or local storage
    const userStr = localStorage.getItem('user-info');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id;
      } catch {
        return 0;
      }
    }
    return 0;
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
    
    console.error('Task Service Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}