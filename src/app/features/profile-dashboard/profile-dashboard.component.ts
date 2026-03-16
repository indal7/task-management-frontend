import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, Subject, of } from 'rxjs';
import { takeUntil, catchError, map } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { AnalyticsService, TaskCompletionRate, UserPerformance } from '../../core/services/analytics.service';
import { ProjectService } from '../../core/services/project.service';
import { EnumService } from '../../core/services/enum.service';
import { User, ProfileUpdateRequest } from '../../core/models';

export interface ProjectSummary {
  id: number;
  name: string;
  status: string;
  progress: number;
}

export interface ActivityItem {
  icon: string;
  title: string;
  description: string;
  time: string;
  color: string;
}

@Component({
  selector: 'app-profile-dashboard',
  templateUrl: './profile-dashboard.component.html',
  styleUrls: ['./profile-dashboard.component.scss']
})
export class ProfileDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  taskStats: TaskCompletionRate | null = null;
  userPerformance: UserPerformance | null = null;

  isLoading = true;
  isSaving = false;
  isEditMode = false;
  loadError: string | null = null;
  saveError: string | null = null;
  saveSuccess: string | null = null;

  editForm: FormGroup;

  recentProjects: ProjectSummary[] = [];
  recentActivity: ActivityItem[] = [];

  constructor(
    private authService: AuthService,
    private analyticsService: AnalyticsService,
    private projectService: ProjectService,
    private enumService: EnumService,
    private fb: FormBuilder
  ) {
    this.editForm = this.buildEditForm();
  }

  ngOnInit(): void {
    this.loadData();

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        if (user && this.isEditMode) {
          this.populateForm(user);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildEditForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      bio: ['', [Validators.maxLength(500)]],
      skills: [''],
      github_username: ['', [Validators.maxLength(50)]],
      linkedin_url: ['', [Validators.pattern(/^https?:\/\/(www\.)?linkedin\.com\/.*$/)]],
      phone: ['', [Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      timezone: ['UTC'],
      daily_work_hours: [8, [Validators.required, Validators.min(1), Validators.max(24)]],
      hourly_rate: [null, [Validators.min(0)]]
    });
  }

  private loadData(): void {
    this.isLoading = true;
    this.loadError = null;

    forkJoin({
      user: this.authService.getCurrentUser().pipe(catchError(() => of(null))),
      taskStats: this.analyticsService.getTaskCompletionRate('month').pipe(catchError(() => of(null))),
      performance: this.analyticsService.getUserProductivity().pipe(catchError(() => of(null))),
      projectAnalytics: this.analyticsService.getProjectAnalytics().pipe(catchError(() => of([]))),
      projects: this.projectService.getProjects().pipe(
        map(resp => resp.data),
        catchError(() => of([] as any[]))
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ user, taskStats, performance, projectAnalytics, projects }) => {
          if (user) {
            this.currentUser = user;
          }
          this.taskStats = taskStats;
          this.userPerformance = performance;
          this.buildActivityFeed();

          const projectStatusMap: { [id: number]: string } = {};
          for (const p of projects) {
            projectStatusMap[p.id] = p.status;
          }

          this.recentProjects = (projectAnalytics as any[]).slice(0, 5).map((p: any) => ({
            id: p.project_id,
            name: p.project_name,
            status: projectStatusMap[p.project_id] || 'ACTIVE',
            progress: Math.round(p.completion_rate ?? 0)
          }));
          this.isLoading = false;
        },
        error: () => {
          this.loadError = 'Failed to load profile data. Please try again.';
          this.isLoading = false;
        }
      });
  }

  private populateForm(user: User): void {
    this.editForm.patchValue({
      name: user.name,
      email: user.email,
      bio: user.bio || '',
      skills: user.skills ? user.skills.join(', ') : '',
      github_username: user.github_username || '',
      linkedin_url: user.linkedin_url || '',
      phone: user.phone || '',
      timezone: user.timezone || 'UTC',
      daily_work_hours: user.daily_work_hours || 8,
      hourly_rate: user.hourly_rate || null
    });
  }

  private buildActivityFeed(): void {
    const now = new Date();
    this.recentActivity = [
      {
        icon: 'task_alt',
        title: 'Profile loaded',
        description: 'Your professional profile is up to date.',
        time: 'Just now',
        color: 'green'
      },
      {
        icon: 'login',
        title: 'Last login',
        description: this.currentUser?.last_login
          ? `Logged in on ${new Date(this.currentUser.last_login).toLocaleString()}`
          : 'Login activity tracked',
        time: this.currentUser?.last_login
          ? this.getRelativeTime(this.currentUser.last_login)
          : '',
        color: 'blue'
      },
      {
        icon: 'account_circle',
        title: 'Account created',
        description: `Member since ${new Date(this.currentUser?.created_at || now).toLocaleDateString()}`,
        time: this.currentUser?.created_at ? this.getRelativeTime(this.currentUser.created_at) : '',
        color: 'purple'
      }
    ];
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    this.saveError = null;
    this.saveSuccess = null;

    if (this.isEditMode && this.currentUser) {
      this.populateForm(this.currentUser);
    }
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.saveError = null;
    this.saveSuccess = null;
    this.editForm.reset();
  }

  saveProfile(): void {
    if (this.editForm.invalid) {
      this.markAllTouched();
      return;
    }

    this.isSaving = true;
    this.saveError = null;
    this.saveSuccess = null;

    const v = this.editForm.value;
    const payload: ProfileUpdateRequest = {
      name: v.name,
      email: v.email,
      bio: v.bio || undefined,
      skills: v.skills
        ? v.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : undefined,
      github_username: v.github_username || undefined,
      linkedin_url: v.linkedin_url || undefined,
      phone: v.phone || undefined,
      timezone: v.timezone || undefined,
      daily_work_hours: v.daily_work_hours || undefined,
      hourly_rate: v.hourly_rate || undefined
    };

    this.authService.updateProfile(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.saveSuccess = 'Profile updated successfully!';
          this.isEditMode = false;
          setTimeout(() => { this.saveSuccess = null; }, 4000);
        },
        error: (err) => {
          this.isSaving = false;
          this.saveError = err.message || 'Failed to update profile. Please try again.';
        }
      });
  }

  refreshData(): void {
    this.loadData();
  }

  // ── Computed helpers ──────────────────────────────────────────────

  getUserInitials(): string {
    if (!this.currentUser?.name) return 'U';
    const parts = this.currentUser.name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  }

  getUserRoleLabel(): string {
    return this.enumService.getUserRoleLabel(this.currentUser?.role || '');
  }

  getRoleBadgeClass(): string {
    const role = this.currentUser?.role || '';
    const map: Record<string, string> = {
      ADMIN: 'badge-red',
      PROJECT_MANAGER: 'badge-purple',
      TEAM_LEAD: 'badge-blue',
      SENIOR_DEVELOPER: 'badge-indigo',
      DEVELOPER: 'badge-green',
      QA_ENGINEER: 'badge-orange',
      DEVOPS_ENGINEER: 'badge-teal',
      UI_UX_DESIGNER: 'badge-pink',
      BUSINESS_ANALYST: 'badge-yellow',
      PRODUCT_OWNER: 'badge-cyan',
      SCRUM_MASTER: 'badge-lime'
    };
    return map[role] || 'badge-gray';
  }

  getCompletionRate(): number {
    if (!this.taskStats) return 0;
    return Math.round(this.taskStats.completion_rate);
  }

  getProductivityScore(): number {
    return this.userPerformance?.productivity_score ?? 0;
  }

  getCompletionRateColor(): string {
    const rate = this.getCompletionRate();
    if (rate >= 80) return '#4caf50';
    if (rate >= 60) return '#ff9800';
    return '#f44336';
  }

  getProjectStatusClass(status: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'status-completed',
      IN_PROGRESS: 'status-in-progress',
      PLANNING: 'status-planning',
      ON_HOLD: 'status-on-hold'
    };
    return map[status] || 'status-default';
  }

  getProjectStatusLabel(status: string): string {
    const map: Record<string, string> = {
      COMPLETED: 'Completed',
      IN_PROGRESS: 'In Progress',
      PLANNING: 'Planning',
      ON_HOLD: 'On Hold'
    };
    return map[status] || status;
  }

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  getTimezoneOptions(): { value: string; label: string }[] {
    return [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
      { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
      { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
      { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
      { value: 'Europe/London', label: 'London Time (UTC+0)' },
      { value: 'Europe/Paris', label: 'Central European Time (UTC+1)' },
      { value: 'Asia/Tokyo', label: 'Japan Time (UTC+9)' },
      { value: 'Asia/Shanghai', label: 'China Time (UTC+8)' },
      { value: 'Asia/Kolkata', label: 'India Time (UTC+5:30)' },
      { value: 'Australia/Sydney', label: 'Australian Eastern Time (UTC+10)' }
    ];
  }

  isFieldInvalid(fieldName: string): boolean {
    const ctrl = this.editForm.get(fieldName);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  getFieldError(fieldName: string): string {
    const ctrl = this.editForm.get(fieldName);
    if (!ctrl?.errors || !ctrl.touched) return '';
    if (ctrl.errors['required']) return `${this.fieldLabel(fieldName)} is required`;
    if (ctrl.errors['email']) return 'Please enter a valid email address';
    if (ctrl.errors['minlength']) return `Minimum ${ctrl.errors['minlength'].requiredLength} characters`;
    if (ctrl.errors['maxlength']) return `Maximum ${ctrl.errors['maxlength'].requiredLength} characters`;
    if (ctrl.errors['min']) return `Minimum value is ${ctrl.errors['min'].min}`;
    if (ctrl.errors['max']) return `Maximum value is ${ctrl.errors['max'].max}`;
    if (ctrl.errors['pattern']) {
      if (fieldName === 'linkedin_url') return 'Please enter a valid LinkedIn URL';
      if (fieldName === 'phone') return 'Please enter a valid phone number';
    }
    return 'Invalid value';
  }

  private fieldLabel(name: string): string {
    const map: Record<string, string> = {
      name: 'Full Name', email: 'Email', bio: 'Bio',
      github_username: 'GitHub Username', linkedin_url: 'LinkedIn URL',
      phone: 'Phone', timezone: 'Timezone',
      daily_work_hours: 'Daily Work Hours', hourly_rate: 'Hourly Rate'
    };
    return map[name] || name;
  }

  private markAllTouched(): void {
    Object.values(this.editForm.controls).forEach(c => c.markAsTouched());
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
