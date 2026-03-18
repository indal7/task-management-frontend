import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest,
  ProjectMember,
  AddProjectMemberRequest,
  ApiResponse,
  PaginatedResponse
} from '../models';

export interface ProjectFilters {
  status?: string;
  created_by_id?: number;
  project_manager_id?: number;
  team_member_id?: number;
  start_date_from?: string;
  start_date_to?: string;
  end_date_from?: string;
  end_date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public projects$ = this.projectsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // 🔧 IMPROVED: Handle new response format for projects list
  getProjects(filters?: ProjectFilters): Observable<PaginatedResponse<Project>> {
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

    return this.http.get<ApiResponse<any>>(API_ENDPOINTS.PROJECTS.BASE, { params })
      .pipe(
        map(response => {
          if (response.success && response.data !== undefined) {
            const rawProjects = Array.isArray(response.data) ? response.data : [];
            const projects: Project[] = rawProjects.map(project => this.normalizeProject(project));
            // Backend returns a plain array; wrap it in PaginatedResponse shape for consistency
            return {
              success: true,
              message: response.message,
              data: projects,
              pagination: {
                page: 1,
                per_page: projects.length,
                total: projects.length,
                pages: 1,
                has_prev: false,
                has_next: false,
                prev_num: null,
                next_num: null
              }
            } as PaginatedResponse<Project>;
          } else {
            throw new Error(response.message || 'Failed to load projects');
          }
        }),
        tap(paginatedResponse => {
          this.projectsSubject.next(paginatedResponse.data);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format
  getProjectById(id: number): Observable<Project> {
    return this.http.get<ApiResponse<Project>>(API_ENDPOINTS.PROJECTS.BY_ID(id))
      .pipe(
        map(response => {
          if (response.success && response.data) {
            const projectRecord = this.extractProjectRecord(response.data as any, id);
            if (!projectRecord) {
              throw new Error('Project data was empty');
            }
            return this.normalizeProject(projectRecord);
          } else {
            throw new Error(response.message || 'Failed to load project');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for create
  createProject(projectData: CreateProjectRequest): Observable<Project> {
    this.loadingSubject.next(true);
    
    return this.http.post<ApiResponse<Project>>(API_ENDPOINTS.PROJECTS.BASE, projectData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return this.normalizeProject(response.data as any);
          } else {
            throw new Error(response.message || 'Failed to create project');
          }
        }),
        tap(project => {
          const currentProjects = this.projectsSubject.value;
          this.projectsSubject.next([project, ...currentProjects]);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for update
  updateProject(id: number, projectData: UpdateProjectRequest): Observable<Project> {
    this.loadingSubject.next(true);
    
    return this.http.put<ApiResponse<Project>>(API_ENDPOINTS.PROJECTS.BY_ID(id), projectData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return this.normalizeProject(response.data as any);
          } else {
            throw new Error(response.message || 'Failed to update project');
          }
        }),
        tap(updatedProject => {
          const currentProjects = this.projectsSubject.value;
          const index = currentProjects.findIndex(project => project.id === id);
          if (index !== -1) {
            currentProjects[index] = updatedProject;
            this.projectsSubject.next([...currentProjects]);
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for delete
  deleteProject(id: number): Observable<ApiResponse> {
    this.loadingSubject.next(true);
    
    return this.http.delete<ApiResponse>(API_ENDPOINTS.PROJECTS.BY_ID(id))
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to delete project');
          }
          return response;
        }),
        tap(() => {
          const currentProjects = this.projectsSubject.value;
          const filteredProjects = currentProjects.filter(project => project.id !== id);
          this.projectsSubject.next(filteredProjects);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Handle new response format for recent projects
  getRecentProjects(): Observable<Project[]> {
    return this.http.get<ApiResponse<Project[]>>(API_ENDPOINTS.PROJECTS.RECENT)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return (response.data as any[]).map(project => this.normalizeProject(project));
          } else {
            throw new Error(response.message || 'Failed to load recent projects');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // 🔧 IMPROVED: Project Members with new response format
  getProjectMembers(projectId: number): Observable<ProjectMember[]> {
    return this.http.get<ApiResponse<ProjectMember[]>>(`${API_ENDPOINTS.PROJECTS.BY_ID(projectId)}/members`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load project members');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  addProjectMember(projectId: number, memberData: AddProjectMemberRequest): Observable<ProjectMember> {
    return this.http.post<ApiResponse<ProjectMember>>(`${API_ENDPOINTS.PROJECTS.BY_ID(projectId)}/members`, memberData)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to add project member');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  removeProjectMember(projectId: number, userId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${API_ENDPOINTS.PROJECTS.BY_ID(projectId)}/members/${userId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to remove project member');
          }
          return response;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  updateProjectMemberRole(projectId: number, userId: number, role: string): Observable<ProjectMember> {
    return this.http.put<ApiResponse<ProjectMember>>(`${API_ENDPOINTS.PROJECTS.BY_ID(projectId)}/members/${userId}`, { role })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to update member role');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  // Utility methods
  getMyProjects(): Observable<Project[]> {
    const userId = this.getCurrentUserId();
    return this.getProjects({ team_member_id: userId })
      .pipe(
        map(response => response.data)
      );
  }

  getProjectsByManager(managerId: number): Observable<Project[]> {
    return this.getProjects({ project_manager_id: managerId })
      .pipe(
        map(response => response.data)
      );
  }

  getActiveProjects(): Observable<Project[]> {
    return this.getProjects({ status: 'ACTIVE' })
      .pipe(
        map(response => response.data)
      );
  }

  getProjectsByStatus(status: string): Observable<Project[]> {
    return this.getProjects({ status })
      .pipe(
        map(response => response.data)
      );
  }

  searchProjects(query: string): Observable<Project[]> {
    return this.getProjects({ search: query })
      .pipe(
        map(response => response.data)
      );
  }

  // 🔧 IMPROVED: Project Statistics with new response format
  getProjectStats(projectId: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${API_ENDPOINTS.PROJECTS.BY_ID(projectId)}/stats`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load project statistics');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  getProjectProgress(projectId: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${API_ENDPOINTS.PROJECTS.BY_ID(projectId)}/progress`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          } else {
            throw new Error(response.message || 'Failed to load project progress');
          }
        }),
        catchError(this.handleError.bind(this))
      );
  }

  private getCurrentUserId(): number {
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

  private normalizeProject(project: any): Project {
    const owner = project?.created_by || project?.owner || null;
    const rawTeamMembers = Array.isArray(project?.team_members) ? project.team_members : [];
    const teamMembers = rawTeamMembers
      .map((member: any) => member?.user || member)
      .filter((member: any) => member && member.id);

    return {
      id: project?.id,
      name: project?.name || '',
      description: project?.description || '',
      status: (project?.status || 'PLANNING') as Project['status'],
      start_date: project?.start_date || undefined,
      end_date: project?.end_date || undefined,
      budget: project?.budget ?? project?.estimated_hours ?? undefined,
      created_by: owner,
      project_manager: project?.project_manager || undefined,
      team_members: teamMembers,
      created_at: project?.created_at,
      updated_at: project?.updated_at,
      tasks_count: project?.tasks_count ?? 0,
      completed_tasks_count: project?.completed_tasks_count ?? 0,
      sprints_count: project?.sprints_count ?? 0,
      active_sprints_count: project?.active_sprints_count ?? 0
    };
  }

  private extractProjectRecord(payload: any, requestedId?: number): any {
    if (!payload) {
      return null;
    }

    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return null;
      }

      if (requestedId !== undefined) {
        const matched = payload.find((item: any) => Number(item?.id) === Number(requestedId));
        if (matched) {
          return matched;
        }
      }

      return payload[0];
    }

    if (payload.project) {
      return this.extractProjectRecord(payload.project, requestedId);
    }

    if (payload.data) {
      return this.extractProjectRecord(payload.data, requestedId);
    }

    return payload;
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
    
    console.error('Project Service Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}