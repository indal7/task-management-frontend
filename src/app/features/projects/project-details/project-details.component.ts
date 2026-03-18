import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

import { Project, ProjectMember } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { parseApiDate } from '../../../core/utils/date-time.util';

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.scss']
})
export class ProjectDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  project: Project | null = null;
  members: ProjectMember[] = [];
  stats: any = null;

  isLoading = false;
  errorMessage: string | null = null;
  activeTab: 'overview' | 'tasks' | 'sprints' | 'team' | 'activity' = 'overview';

  constructor(
    private projectService: ProjectService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = Number(params.get('id'));
      if (!id || Number.isNaN(id)) {
        this.errorMessage = 'Invalid project id.';
        return;
      }
      this.loadProjectDetails(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProjectDetails(projectId: number): void {
    this.isLoading = true;
    this.errorMessage = null;

    forkJoin({
      project: this.projectService.getProjectById(projectId),
      members: this.projectService.getProjectMembers(projectId).pipe(catchError(() => of([]))),
      stats: this.projectService.getProjectStats(projectId).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ project, members, stats }) => {
        this.project = project;
        this.members = this.normalizeProjectMembers(members as any[], project);
        this.stats = stats;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || error?.message || 'Failed to load project details.';
        this.isLoading = false;
      }
    });
  }

  goBackToProjects(): void {
    this.router.navigate(['/projects/management']);
  }

  goToTasks(): void {
    if (!this.project) {
      return;
    }
    this.router.navigate(['/tasks'], { queryParams: { project_id: this.project.id } });
  }

  goToSprints(): void {
    if (!this.project) {
      return;
    }
    this.router.navigate(['/sprints', this.project.id]);
  }

  setActiveTab(tab: 'overview' | 'tasks' | 'sprints' | 'team' | 'activity'): void {
    this.activeTab = tab;
  }

  getStatusLabel(status: string | undefined): string {
    if (!status) {
      return 'Unknown';
    }
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  getProgressPercent(): number {
    if (this.stats && typeof this.stats.progress === 'number') {
      return Math.max(0, Math.min(100, Math.floor(this.stats.progress)));
    }

    if (!this.project) {
      return 0;
    }

    const total = this.project.tasks_count || 0;
    const done = this.project.completed_tasks_count || 0;
    if (total === 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.floor((done / total) * 100)));
  }

  formatDate(value?: string): string {
    if (!value) {
      return 'Not set';
    }

    const parsed = parseApiDate(value);
    if (!parsed) {
      return 'Not set';
    }

    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getDaysUntilEndDate(): string {
    if (!this.project?.end_date) {
      return 'No deadline';
    }

    const endDate = parseApiDate(this.project.end_date);
    if (!endDate) {
      return 'No deadline';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    }
    if (diffDays === 0) {
      return 'Due today';
    }
    return `${diffDays} days left`;
  }

  getInitials(name: string | undefined): string {
    if (!name) {
      return '--';
    }
    return name
      .split(' ')
      .filter(Boolean)
      .map((token) => token[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getMemberName(member: ProjectMember): string {
    return member?.user?.name || (member as any)?.name || 'Unknown user';
  }

  getMemberEmail(member: ProjectMember): string {
    return member?.user?.email || (member as any)?.email || 'No email';
  }

  getMemberRole(member: ProjectMember): string {
    return member?.role || 'Member';
  }

  private normalizeProjectMembers(rawMembers: any[], project: Project): ProjectMember[] {
    const members = Array.isArray(rawMembers) ? rawMembers : [];

    const normalizedFromResponse = members
      .map((entry) => {
        const user = entry?.user || (entry?.id && entry?.name ? entry : null);
        if (!user || !user.id) {
          return null;
        }

        return {
          id: entry?.id ?? user.id,
          project_id: entry?.project_id ?? project.id,
          user_id: entry?.user_id ?? user.id,
          role: entry?.role || 'Member',
          joined_at: entry?.joined_at || project.created_at,
          user
        } as ProjectMember;
      })
      .filter((member): member is ProjectMember => !!member);

    if (normalizedFromResponse.length > 0) {
      return normalizedFromResponse;
    }

    const fallbackTeam = Array.isArray(project.team_members) ? project.team_members : [];
    return fallbackTeam
      .filter((user) => !!user?.id)
      .map((user) => ({
        id: user.id,
        project_id: project.id,
        user_id: user.id,
        role: 'Member',
        joined_at: project.created_at,
        user
      } as ProjectMember));
  }

  getActivityItems(): Array<{ icon: string; title: string; date: string }> {
    if (!this.project) {
      return [];
    }

    const items: Array<{ icon: string; title: string; date: string }> = [
      {
        icon: 'flag',
        title: `Project status: ${this.getStatusLabel(this.project.status)}`,
        date: this.formatDate(this.project.updated_at)
      },
      {
        icon: 'rocket_launch',
        title: 'Project created',
        date: this.formatDate(this.project.created_at)
      }
    ];

    if (this.project.start_date) {
      items.push({
        icon: 'event_available',
        title: 'Planned start date',
        date: this.formatDate(this.project.start_date)
      });
    }

    if (this.project.end_date) {
      items.push({
        icon: 'event_busy',
        title: 'Target end date',
        date: this.formatDate(this.project.end_date)
      });
    }

    return items;
  }
}
