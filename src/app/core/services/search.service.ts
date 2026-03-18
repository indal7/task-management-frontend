import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { API_ENDPOINTS } from '../constants/api.constants';

export interface SearchResultTask {
  type: 'task';
  id: number;
  title: string;
  status: string;
  priority: string;
  project_id: number | null;
  project_name?: string;
  task_type?: string;
  route: string;
}

export interface SearchResultProject {
  type: 'project';
  id: number;
  name: string;
  status: string;
  team_members_count?: number;
  route: string;
}

export interface SearchResultSprint {
  type: 'sprint';
  id: number;
  name: string;
  status: string;
  project_id: number;
  project_name?: string;
  completion_percentage?: number;
  route: string;
}

export interface SearchResultUser {
  type: 'user';
  id: number;
  name: string;
  email: string;
  role: string;
  route: string;
}

export type SearchResult = SearchResultTask | SearchResultProject | SearchResultSprint | SearchResultUser;

export interface GlobalSearchResponse {
  tasks: SearchResultTask[];
  projects: SearchResultProject[];
  sprints: SearchResultSprint[];
  users: SearchResultUser[];
  total: number;
  query: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private http: HttpClient) {}

  /**
   * Call GET /api/search/global?q=...&limit=...
   * Returns typed arrays already shaped for the UI.
   */
  globalSearch(query: string, limit = 8): Observable<GlobalSearchResponse> {
    const params = new HttpParams()
      .set('q', query.trim())
      .set('limit', limit.toString());

    return this.http
      .get<{ status: string; message: string; data: any }>(
        API_ENDPOINTS.SEARCH.GLOBAL,
        { params }
      )
      .pipe(
        map(resp => {
          const data = resp.data ?? {};
          const tasks: SearchResultTask[] = (data.tasks ?? []).map((t: any) => ({
            type: 'task' as const,
            id: t.id,
            title: t.title,
            status: t.status ?? '',
            priority: t.priority ?? '',
            project_id: t.project_id ?? null,
            project_name: t.project?.name ?? '',
            task_type: t.task_type ?? '',
            route: `/tasks/${t.id}`,
          }));
          const projects: SearchResultProject[] = (data.projects ?? []).map((p: any) => ({
            type: 'project' as const,
            id: p.id,
            name: p.name,
            status: p.status ?? '',
            team_members_count: p.team_members_count ?? 0,
            route: `/projects/${p.id}`,
          }));
          const sprints: SearchResultSprint[] = (data.sprints ?? []).map((s: any) => ({
            type: 'sprint' as const,
            id: s.id,
            name: s.name,
            status: s.status ?? '',
            project_id: s.project_id,
            project_name: s.project?.name ?? '',
            completion_percentage: s.completion_percentage ?? 0,
            route: `/sprints/${s.project_id}`,
          }));
          const users: SearchResultUser[] = (data.users ?? []).map((u: any) => ({
            type: 'user' as const,
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role ?? '',
            route: `/team`,
          }));
          return {
            tasks,
            projects,
            sprints,
            users,
            total: tasks.length + projects.length + sprints.length + users.length,
            query,
          };
        }),
        catchError(() => of({ tasks: [], projects: [], sprints: [], users: [], total: 0, query }))
      );
  }
}
