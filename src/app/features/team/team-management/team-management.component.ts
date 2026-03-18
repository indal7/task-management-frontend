import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

import { AuthService } from '../../../core/services/auth.service';
import { TaskService } from '../../../core/services/task.service';
import { User, UpdateUserRequest, Task } from '../../../core/models';

// 🔧 IMPROVED: Enhanced TeamMember interface with better type safety
interface TeamMember {
  id: number;
  name: string;
  email: string;
  rawRole: string;
  role: string;
  avatar_url?: string | null;
  department: string;
  joinDate: string;
  status: 'active' | 'away' | 'offline';
  tasksCount: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  skills: string[];
  workload: number; // percentage
  isActive: boolean;
  lastLogin?: string;
}

// 🔧 NEW: Search and filter interface
interface TeamFilters {
  search: string;
  department: string;
  role: string;
  status: string;
}

@Component({
  selector: 'app-team-management',
  template: `
    <div class="team-container">
      <!-- Header -->
      <div class="team-header">
        <div class="header-content">
          <h1>
            <mat-icon>group</mat-icon>
            Team Management
          </h1>
          <p>Manage your team members and their assignments</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" (click)="inviteNewMember()">
            <mat-icon>person_add</mat-icon>
            Invite Member
          </button>
          <button mat-icon-button (click)="refreshTeamData()" matTooltip="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-section" *ngIf="!isLoading && !errorMessage">
        <mat-card class="filters-card">
          <mat-card-content>
            <div class="filter-row">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>Search team members</mat-label>
                <input 
                  matInput 
                  [(ngModel)]="filters.search" 
                  (input)="applyFilters()"
                  placeholder="Search by name or email">
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Department</mat-label>
                <mat-select [(value)]="filters.department" (selectionChange)="applyFilters()">
                  <mat-option value="">All Departments</mat-option>
                  <mat-option *ngFor="let dept of departments" [value]="dept">{{dept}}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Role</mat-label>
                <mat-select [(value)]="filters.role" (selectionChange)="applyFilters()">
                  <mat-option value="">All Roles</mat-option>
                  <mat-option *ngFor="let role of roles" [value]="role">{{role}}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select [(value)]="filters.status" (selectionChange)="applyFilters()">
                  <mat-option value="">All Status</mat-option>
                  <mat-option value="active">Active</mat-option>
                  <mat-option value="away">Away</mat-option>
                  <mat-option value="offline">Offline</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Loading State -->
      <app-loading *ngIf="isLoading" message="Loading team members..."></app-loading>

      <!-- Error State -->
      <mat-card *ngIf="errorMessage && !isLoading" class="error-card">
        <mat-card-content>
          <mat-icon color="warn">error</mat-icon>
          <p>{{ errorMessage }}</p>
          <button mat-raised-button color="primary" (click)="loadTeamMembers()">
            <mat-icon>refresh</mat-icon>
            Retry
          </button>
        </mat-card-content>
      </mat-card>

      <!-- Team Stats -->
      <div class="team-stats" *ngIf="!isLoading && !errorMessage && teamMembers.length > 0">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ filteredMembers.length }}</h3>
              <p>{{ filters.search || filters.department || filters.role || filters.status ? 'Filtered' : 'Total' }} Members</p>
            </div>
            <mat-icon>group</mat-icon>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ activeMembers }}</h3>
              <p>Active Members</p>
            </div>
            <mat-icon>person</mat-icon>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ averageWorkload }}%</h3>
              <p>Avg. Workload</p>
            </div>
            <mat-icon>trending_up</mat-icon>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ overloadedMembers }}</h3>
              <p>High Workload</p>
            </div>
            <mat-icon [style.color]="overloadedMembers > 0 ? 'var(--color-danger)' : 'var(--color-success)'">warning</mat-icon>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Team Members Grid -->
      <div class="team-grid" *ngIf="!isLoading && !errorMessage && filteredMembers.length > 0">
        <mat-card class="member-card" *ngFor="let member of filteredMembers">
          <mat-card-header>
            <div mat-card-avatar class="member-avatar">
              <img *ngIf="member.avatar_url; else avatarFallback" 
                   [src]="member.avatar_url" 
                   [alt]="member.name">
              <ng-template #avatarFallback>
                <div class="avatar-initials">{{ getInitials(member.name) }}</div>
              </ng-template>
            </div>
            <mat-card-title>{{ member.name }}</mat-card-title>
            <mat-card-subtitle>{{ member.role }}</mat-card-subtitle>
            <div class="member-status" [ngClass]="member.status">
              <span class="status-dot"></span>
              {{ member.status | titlecase }}
            </div>
          </mat-card-header>

          <mat-card-content>
            <div class="member-info">
              <div class="info-item">
                <mat-icon>email</mat-icon>
                <span>{{ member.email }}</span>
              </div>
              <div class="info-item">
                <mat-icon>business</mat-icon>
                <span>{{ member.department }}</span>
              </div>
              <div class="info-item">
                <mat-icon>date_range</mat-icon>
                <span>Joined {{ member.joinDate | date:'MMM yyyy' }}</span>
              </div>
              <div class="info-item" *ngIf="member.lastLogin">
                <mat-icon>schedule</mat-icon>
                <span>Last login {{ member.lastLogin | date:'short' }}</span>
              </div>
            </div>

            <div class="task-stats">
              <h4>Task Statistics</h4>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-number">{{ member.tasksCount.total }}</span>
                  <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number" style="color: var(--color-success);">{{ member.tasksCount.completed }}</span>
                  <span class="stat-label">Completed</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number" style="color: var(--color-primary);">{{ member.tasksCount.inProgress }}</span>
                  <span class="stat-label">In Progress</span>
                </div>
                <div class="stat-item" *ngIf="member.tasksCount.overdue > 0">
                  <span class="stat-number" style="color: var(--color-danger);">{{ member.tasksCount.overdue }}</span>
                  <span class="stat-label">Overdue</span>
                </div>
              </div>
            </div>

            <div class="workload-section">
              <div class="workload-header">
                <h4>Current Workload</h4>
                <span class="workload-text" [style.color]="getWorkloadTextColor(member.workload)">
                  {{ member.workload }}%
                </span>
              </div>
              <mat-progress-bar 
                mode="determinate" 
                [value]="member.workload"
                [color]="getWorkloadColor(member.workload)">
              </mat-progress-bar>
            </div>

            <div class="skills-section" *ngIf="member.skills && member.skills.length > 0">
              <h4>Skills</h4>
              <div class="skills-chips">
                <mat-chip-listbox>
                  <mat-chip *ngFor="let skill of member.skills" [disabled]="true">{{ skill }}</mat-chip>
                </mat-chip-listbox>
              </div>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button (click)="viewMemberDetails(member)">
              <mat-icon>visibility</mat-icon>
              View Details
            </button>
            <button mat-button (click)="assignTasks(member)">
              <mat-icon>assignment</mat-icon>
              Assign Tasks
            </button>
            <button mat-icon-button [matMenuTriggerFor]="memberMenu">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #memberMenu="matMenu">
              <button mat-menu-item (click)="editMember(member)">
                <mat-icon>edit</mat-icon>
                Edit Member
              </button>
              <button mat-menu-item (click)="viewMemberTasks(member)">
                <mat-icon>list</mat-icon>
                View Tasks
              </button>
              <button mat-menu-item (click)="sendMessage(member)">
                <mat-icon>message</mat-icon>
                Send Message
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="removeMember(member)" class="warn-action">
                <mat-icon>{{ member.isActive ? 'person_remove' : 'person_add' }}</mat-icon>
                {{ member.isActive ? 'Deactivate User' : 'Activate User' }}
              </button>
            </mat-menu>
          </mat-card-actions>
        </mat-card>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!isLoading && !errorMessage && filteredMembers.length === 0 && teamMembers.length > 0">
        <mat-icon>search_off</mat-icon>
        <h3>No Members Found</h3>
        <p>Try adjusting your search criteria or filters</p>
        <button mat-raised-button (click)="clearFilters()">
          <mat-icon>clear</mat-icon>
          Clear Filters
        </button>
      </div>

      <!-- No Team Members State -->
      <div class="empty-state" *ngIf="!isLoading && !errorMessage && teamMembers.length === 0">
        <mat-icon>group_off</mat-icon>
        <h3>No Team Members</h3>
        <p>Start building your team by inviting new members</p>
        <button mat-raised-button color="primary" (click)="inviteNewMember()">
          <mat-icon>person_add</mat-icon>
          Invite Your First Member
        </button>
      </div>

      <ng-template #assignTaskDialog>
        <h2 mat-dialog-title>Assign Task</h2>
        <mat-dialog-content>
          <p *ngIf="selectedMember">Assign a task to <strong>{{ selectedMember.name }}</strong>.</p>

          <div *ngIf="assignDialogLoadingTasks" style="display:flex; align-items:center; gap:0.5rem; margin: 0.5rem 0 1rem;">
            <mat-icon class="spinning">refresh</mat-icon>
            <span>Loading tasks...</span>
          </div>

          <mat-form-field appearance="outline" style="width: 100%; margin-top: 0.5rem;">
            <mat-label>Search task</mat-label>
            <input
              matInput
              [(ngModel)]="taskSearchQuery"
              (input)="onTaskSearchInput()"
              [matAutocomplete]="taskSearchAuto"
              placeholder="Search by task ID, name, status, priority">
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <mat-autocomplete #taskSearchAuto="matAutocomplete" (optionSelected)="onTaskOptionSelected($event.option.value)">
            <mat-option *ngFor="let task of taskSuggestions" [value]="task.id">
              <div style="display:flex; flex-direction:column; line-height:1.35;">
                <span><strong>#{{ task.id }}</strong> - {{ task.title }}</span>
                <small style="opacity:0.75;">
                  {{ task.status }} | {{ task.priority }} | {{ task.assigned_to?.name || 'Unassigned' }}
                </small>
                <small style="opacity:0.72;">
                  {{ task.project?.name || 'No Project' }} | Due: {{ task.due_date ? (task.due_date | date:'mediumDate') : 'No due date' }}
                </small>
              </div>
            </mat-option>
          </mat-autocomplete>

          <mat-form-field appearance="outline" style="width: 100%;">
            <mat-label>Select task</mat-label>
            <mat-select [(value)]="assignTaskIdInput" [disabled]="assignDialogLoadingTasks">
              <mat-option *ngFor="let task of filteredAssignableTasks" [value]="task.id">
                #{{ task.id }} - {{ task.title }} ({{ task.status }}, {{ task.priority }})
                <span style="opacity:0.7"> - {{ task.assigned_to?.name || 'Unassigned' }}</span>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <p *ngIf="!assignDialogLoadingTasks && filteredAssignableTasks.length === 0" style="opacity:0.75; margin-top: -0.5rem;">
            No matching tasks found.
          </p>

          <p class="dialog-error" *ngIf="dialogError">{{ dialogError }}</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button mat-button (click)="closeDialog()">Cancel</button>
          <button mat-raised-button color="primary" [disabled]="dialogLoading || assignDialogLoadingTasks" (click)="submitAssignTask()">Assign</button>
        </mat-dialog-actions>
      </ng-template>

      <ng-template #editMemberDialog>
        <h2 mat-dialog-title>Edit Member</h2>
        <mat-dialog-content>
          <mat-form-field appearance="outline" style="width: 100%; margin-top: 0.5rem;">
            <mat-label>Name</mat-label>
            <input matInput [(ngModel)]="editMemberName" placeholder="Enter full name">
          </mat-form-field>

          <mat-form-field appearance="outline" style="width: 100%;">
            <mat-label>Role</mat-label>
            <mat-select [(value)]="editMemberRole">
              <mat-option *ngFor="let role of availableRoles" [value]="role">{{ role }}</mat-option>
            </mat-select>
          </mat-form-field>

          <p class="dialog-error" *ngIf="dialogError">{{ dialogError }}</p>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button mat-button (click)="closeDialog()">Cancel</button>
          <button mat-raised-button color="primary" [disabled]="dialogLoading" (click)="submitEditMember()">Save</button>
        </mat-dialog-actions>
      </ng-template>
    </div>
  `,
  styles: [`
    :host {
      --team-text-primary: var(--color-text-primary);
      --team-text-secondary: var(--color-text-secondary);
      --team-text-muted: var(--color-text-muted);
      --team-primary: var(--color-primary);
      --team-accent: var(--color-accent);
      --team-surface: var(--color-surface);
      --team-surface-alt: var(--color-surface-alt);
      --team-border: var(--color-border);
      --team-success: var(--color-success);
      --team-warning: var(--color-warning);
      --team-danger: var(--color-danger);
      --team-shadow: 0 8px 25px rgba(15, 23, 42, 0.12);
    }

    .team-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .team-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
    }

    .header-content h1 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
      font-size: 2rem;
      font-weight: 600;
    }

    .header-content p {
      margin: 0;
      color: var(--team-text-secondary);
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .filters-section {
      margin-bottom: 2rem;
    }

    .filters-card {
      border-radius: 12px;
      background: var(--team-surface);
      border: 1px solid var(--team-border);
    }

    .filter-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 1rem;
      align-items: center;
    }

    .search-field {
      min-width: 300px;
    }

    .error-card {
      text-align: center;
      margin: 2rem 0;
    }

    .error-card mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .team-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card mat-card-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stat-info h3 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: var(--team-primary);
    }

    .stat-info p {
      margin: 0.5rem 0 0;
      color: var(--team-text-secondary);
      font-size: 0.9rem;
    }

    .stat-card mat-icon {
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
      color: var(--team-primary);
      opacity: 0.7;
    }

    .team-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .member-card {
      border-radius: 12px;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      background: var(--team-surface);
      border: 1px solid var(--team-border);
    }

    .member-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--team-shadow);
    }

    .member-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      overflow: hidden;
    }

    .member-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(45deg, var(--team-primary), var(--team-accent));
      color: white;
      font-weight: 600;
      font-size: 1.2rem;
    }

    .member-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      margin-top: 0.5rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .member-status.active .status-dot { background: var(--team-success); }
    .member-status.away .status-dot { background: var(--team-warning); }
    .member-status.offline .status-dot { background: var(--team-text-muted); }

    .member-info {
      margin-bottom: 1rem;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      color: var(--team-text-secondary);
    }

    .info-item mat-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }

    .task-stats, .workload-section, .skills-section {
      margin-bottom: 1rem;
    }

    .task-stats h4, .workload-section h4, .skills-section h4 {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--team-text-primary);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
      gap: 0.5rem;
      text-align: center;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-number {
      font-size: 1.2rem;
      font-weight: 600;
      line-height: 1;
    }

    .stat-label {
      font-size: 0.7rem;
      color: var(--team-text-secondary);
      margin-top: 0.2rem;
    }

    .workload-section {
      position: relative;
    }

    .workload-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .workload-text {
      font-size: 0.9rem;
      font-weight: 600;
    }

    .skills-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .skills-chips mat-chip {
      font-size: 0.7rem;
    }

    .warn-action {
      color: var(--team-danger) !important;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--team-text-secondary);
    }

    .empty-state mat-icon {
      font-size: 4rem;
      width: 4rem;
      height: 4rem;
      opacity: 0.5;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      margin: 0 0 1rem;
      font-size: 1.5rem;
    }

    .empty-state p {
      margin: 0 0 2rem;
    }

    @media (max-width: 768px) {
      .team-container {
        padding: 1rem;
      }

      .team-header {
        flex-direction: column;
        gap: 1rem;
      }

      .filter-row {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .search-field {
        min-width: auto;
      }

      .team-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class TeamManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dialogRef: MatDialogRef<any> | null = null;

  @ViewChild('assignTaskDialog') assignTaskDialog!: TemplateRef<any>;
  @ViewChild('editMemberDialog') editMemberDialog!: TemplateRef<any>;

  teamMembers: TeamMember[] = [];
  filteredMembers: TeamMember[] = [];
  isLoading = false;
  errorMessage: string | null = null;

  // 🔧 NEW: Filters
  filters: TeamFilters = {
    search: '',
    department: '',
    role: '',
    status: ''
  };

  departments: string[] = [];
  roles: string[] = [];

  // Stats
  activeMembers = 0;
  averageWorkload = 0;
  overloadedMembers = 0;

  selectedMember: TeamMember | null = null;
  assignTaskIdInput: number | null = null;
  assignDialogLoadingTasks = false;
  taskSearchQuery = '';
  assignableTasks: Task[] = [];
  filteredAssignableTasks: Task[] = [];
  taskSuggestions: Task[] = [];
  editMemberName = '';
  editMemberRole = '';
  dialogError: string | null = null;
  dialogLoading = false;

  availableRoles: string[] = [
    'ADMIN',
    'PROJECT_MANAGER',
    'TEAM_LEAD',
    'SENIOR_DEVELOPER',
    'DEVELOPER',
    'QA_ENGINEER',
    'DEVOPS_ENGINEER',
    'UI_UX_DESIGNER',
    'BUSINESS_ANALYST',
    'PRODUCT_OWNER',
    'SCRUM_MASTER'
  ];

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTeamMembers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🔧 IMPROVED: Enhanced team loading with real API integration
  loadTeamMembers(): void {
    this.isLoading = true;
    this.errorMessage = null;

    // console.log('🔄 Loading team members...');

    this.authService.listUsers({ per_page: 100 })
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('❌ Failed to load users:', error);
          this.errorMessage = 'Failed to load team members. Please try again.';
          this.isLoading = false;
          return of({ users: [], total: 0, page: 1, per_page: 100, total_pages: 0 });
        })
      )
      .subscribe({
        next: ({ users }) => {
          // console.log('✅ Users loaded:', users);
          this.teamMembers = this.transformUsersToTeamMembers(users);
          this.extractFilterOptions();
          this.loadPresenceForMembers();
          this.applyFilters();
          this.calculateStats();
          this.isLoading = false;
          this.loadTaskStatsForMembers();
        }
      });
  }

  private transformUsersToTeamMembers(users: User[]): TeamMember[] {
    return users.map(user => {
      const role = user.role || 'DEVELOPER';
      const name = user.name || 'Unknown User';
      const lastLogin = user.last_login || undefined;
      const joinDate = user.created_at || new Date().toISOString();
      const isAway = !!lastLogin && (Date.now() - new Date(lastLogin).getTime()) > (1000 * 60 * 60 * 24 * 3);
      const presenceStatus: TeamMember['status'] = !user.is_active
        ? 'offline'
        : (isAway ? 'away' : 'active');
      
      return {
        id: user.id,
        name: name,
        email: user.email,
        rawRole: role,
        role: this.formatRole(role),
        avatar_url: user.avatar_url || null,
        department: this.getDepartmentFromRole(role),
        joinDate,
        status: presenceStatus,
        tasksCount: {
          total: 0,
          completed: 0,
          inProgress: 0,
          overdue: 0
        },
        skills: user.skills && user.skills.length > 0 ? user.skills : this.getSkillsFromRole(role),
        workload: 0,
        isActive: user.is_active || false,
        lastLogin
      };
    });
  }

  private formatRole(role: string): string {
    return role.replace('_', ' ')
               .toLowerCase()
               .replace(/\b\w/g, l => l.toUpperCase());
  }

  private getDepartmentFromRole(role: string): string {
    const departments: { [key: string]: string } = {
      'ADMIN': 'Administration',
      'PROJECT_MANAGER': 'Management',
      'TEAM_LEAD': 'Management',
      'SENIOR_DEVELOPER': 'Engineering',
      'DEVELOPER': 'Engineering',
      'QA_ENGINEER': 'Quality Assurance',
      'DEVOPS_ENGINEER': 'DevOps',
      'UI_UX_DESIGNER': 'Design',
      'BUSINESS_ANALYST': 'Business Analysis',
      'PRODUCT_OWNER': 'Product',
      'SCRUM_MASTER': 'Agile Coaching'
    };
    return departments[role] || 'General';
  }

  private getSkillsFromRole(role: string): string[] {
    const skillSets: { [key: string]: string[] } = {
      'DEVELOPER': ['JavaScript', 'TypeScript', 'Angular', 'Node.js'],
      'SENIOR_DEVELOPER': ['JavaScript', 'TypeScript', 'Angular', 'Node.js', 'Architecture'],
      'QA_ENGINEER': ['Testing', 'Automation', 'Selenium', 'Jest'],
      'DEVOPS_ENGINEER': ['Docker', 'Kubernetes', 'AWS', 'CI/CD'],
      'UI_UX_DESIGNER': ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
      'PROJECT_MANAGER': ['Scrum', 'Agile', 'Planning', 'Leadership'],
      'BUSINESS_ANALYST': ['Requirements', 'Analysis', 'Documentation', 'SQL']
    };
    return skillSets[role] || ['Communication', 'Teamwork'];
  }

  private loadTaskStatsForMembers(): void {
    if (!this.teamMembers.length) {
      return;
    }

    const requests = this.teamMembers.map(member => {
      return forkJoin({
        total: this.taskService.getTasks({ assigned_to_id: member.id, per_page: 200 }).pipe(catchError(() => of({ data: [], total: 0, page: 1, per_page: 200, total_pages: 0, has_next: false, has_prev: false } as any))),
        completed: this.taskService.getTasks({ assigned_to_id: member.id, status: 'DONE', per_page: 200 }).pipe(catchError(() => of({ data: [], total: 0, page: 1, per_page: 200, total_pages: 0, has_next: false, has_prev: false } as any))),
        inProgress: this.taskService.getTasks({ assigned_to_id: member.id, status: 'IN_PROGRESS,IN_REVIEW,TESTING,BLOCKED', per_page: 200 }).pipe(catchError(() => of({ data: [], total: 0, page: 1, per_page: 200, total_pages: 0, has_next: false, has_prev: false } as any))),
        overdue: this.taskService.getTasks({ assigned_to_id: member.id, overdue: true, per_page: 200 }).pipe(catchError(() => of({ data: [], total: 0, page: 1, per_page: 200, total_pages: 0, has_next: false, has_prev: false } as any)))
      }).pipe(
        map(stats => ({
          memberId: member.id,
          total: stats.total.total || 0,
          completed: stats.completed.total || 0,
          inProgress: stats.inProgress.total || 0,
          overdue: stats.overdue.total || 0
        }))
      );
    });

    forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe((stats) => {
      const statsMap = new Map(stats.map(s => [s.memberId, s]));
      this.teamMembers = this.teamMembers.map(member => {
        const memberStats = statsMap.get(member.id);
        if (!memberStats) {
          return member;
        }

        const computedWorkload = Math.min(100, Math.max(0, memberStats.inProgress * 20 + memberStats.overdue * 15));

        return {
          ...member,
          tasksCount: {
            total: memberStats.total,
            completed: memberStats.completed,
            inProgress: memberStats.inProgress,
            overdue: memberStats.overdue
          },
          workload: computedWorkload
        } as TeamMember;
      });

      this.applyFilters();
    });
  }

  private loadPresenceForMembers(): void {
    if (!this.teamMembers.length) {
      return;
    }

    const requests = this.teamMembers.map(member =>
      this.authService.getPresenceStatus(member.id).pipe(
        map(presence => ({ memberId: member.id, isOnline: presence.is_online })),
        catchError(() => of({ memberId: member.id, isOnline: false }))
      )
    );

    forkJoin(requests)
      .pipe(takeUntil(this.destroy$))
      .subscribe((presenceStatuses) => {
        const presenceMap = new Map(presenceStatuses.map(p => [p.memberId, p.isOnline]));

        this.teamMembers = this.teamMembers.map(member => {
          const isOnline = presenceMap.get(member.id) || false;
          return {
            ...member,
            status: this.deriveStatusFromPresence(member, isOnline)
          };
        });

        this.applyFilters();
      });
  }

  private deriveStatusFromPresence(member: TeamMember, isOnline: boolean): TeamMember['status'] {
    if (!member.isActive) {
      return 'offline';
    }

    if (isOnline) {
      return 'active';
    }

    const hasRecentLogin = !!member.lastLogin &&
      (Date.now() - new Date(member.lastLogin).getTime()) <= (1000 * 60 * 60 * 24 * 3);

    return hasRecentLogin ? 'away' : 'offline';
  }

  // 🔧 NEW: Extract filter options from data
  private extractFilterOptions(): void {
    this.departments = [...new Set(this.teamMembers.map(m => m.department))].sort();
    this.roles = [...new Set(this.teamMembers.map(m => m.role))].sort();
  }

  // 🔧 NEW: Apply filters functionality
  applyFilters(): void {
    this.filteredMembers = this.teamMembers.filter(member => {
      const matchesSearch = !this.filters.search || 
        member.name.toLowerCase().includes(this.filters.search.toLowerCase()) ||
        member.email.toLowerCase().includes(this.filters.search.toLowerCase());
      
      const matchesDepartment = !this.filters.department || 
        member.department === this.filters.department;
      
      const matchesRole = !this.filters.role || 
        member.role === this.filters.role;
      
      const matchesStatus = !this.filters.status || 
        member.status === this.filters.status;

      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    });

    this.calculateStats();
  }

  // 🔧 NEW: Clear all filters
  clearFilters(): void {
    this.filters = {
      search: '',
      department: '',
      role: '',
      status: ''
    };
    this.applyFilters();
  }

  private calculateStats(): void {
    const members = this.filteredMembers;
    this.activeMembers = members.filter(m => m.status === 'active').length;
    this.overloadedMembers = members.filter(m => m.workload >= 90).length;
    
    if (members.length > 0) {
      this.averageWorkload = Math.round(
        members.reduce((sum, member) => sum + member.workload, 0) / members.length
      );
    } else {
      this.averageWorkload = 0;
    }
  }

  // 🔧 NEW: Refresh functionality
  refreshTeamData(): void {
    this.loadTeamMembers();
  }

  getInitials(name: string): string {
    if (!name) return 'UN';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getWorkloadColor(workload: number): 'primary' | 'accent' | 'warn' {
    if (workload >= 90) return 'warn';
    if (workload >= 75) return 'accent';
    return 'primary';
  }

  getWorkloadTextColor(workload: number): string {
    if (workload >= 90) return 'var(--color-danger)';
    if (workload >= 75) return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  // Action Methods
  inviteNewMember(): void {
    // console.log('🔄 Invite new member functionality');
    // TODO: Implement invite functionality
  }

  viewMemberDetails(member: TeamMember): void {
    this.router.navigate(['/team'], { queryParams: { member_id: member.id } });
  }

  assignTasks(member: TeamMember): void {
    this.selectedMember = member;
    this.assignTaskIdInput = null;
    this.taskSearchQuery = '';
    this.assignableTasks = [];
    this.filteredAssignableTasks = [];
    this.dialogError = null;
    this.dialogRef = this.dialog.open(this.assignTaskDialog, { width: '680px' });
    this.loadAssignableTasks();
  }

  viewMemberTasks(member: TeamMember): void {
    this.router.navigate(['/tasks'], { queryParams: { assigned_to_id: member.id } });
  }

  editMember(member: TeamMember): void {
    if (!this.authService.hasRole('ADMIN')) {
      alert('Only admin can edit users.');
      return;
    }

    this.selectedMember = member;
    this.editMemberName = member.name;
    this.editMemberRole = member.rawRole;
    this.dialogError = null;
    this.dialogRef = this.dialog.open(this.editMemberDialog, { width: '460px' });
  }

  sendMessage(member: TeamMember): void {
    // console.log('💬 Send message to:', member.name);
    // TODO: Open messaging interface
  }

  removeMember(member: TeamMember): void {
    if (!this.authService.hasRole('ADMIN')) {
      alert('Only admin can activate/deactivate users.');
      return;
    }

    const action = member.isActive ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} ${member.name}?`)) {
      const request$ = member.isActive
        ? this.authService.deactivateUser(member.id)
        : this.authService.activateUser(member.id);

      request$.pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          alert(`User ${action}d successfully.`);
          this.loadTeamMembers();
        },
        error: (error) => {
          alert(error?.message || `Failed to ${action} user.`);
        }
      });
    }
  }

  closeDialog(): void {
    this.dialogLoading = false;
    this.assignDialogLoadingTasks = false;
    this.dialogError = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private loadAssignableTasks(): void {
    this.assignDialogLoadingTasks = true;
    this.taskService.getTasks({ per_page: 200, status: 'BACKLOG,TODO,IN_PROGRESS,IN_REVIEW,TESTING,BLOCKED' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.assignableTasks = response.data || [];
          this.applyTaskFilter();
          this.assignDialogLoadingTasks = false;
        },
        error: (error) => {
          this.assignDialogLoadingTasks = false;
          this.dialogError = error?.message || 'Failed to load tasks list.';
        }
      });
  }

  onTaskSearchInput(): void {
    this.assignTaskIdInput = null;
    this.applyTaskFilter();
  }

  onTaskOptionSelected(taskId: number): void {
    const selectedTask = this.assignableTasks.find(task => task.id === taskId);
    if (!selectedTask) {
      this.assignTaskIdInput = null;
      return;
    }

    this.assignTaskIdInput = selectedTask.id;
    this.taskSearchQuery = `#${selectedTask.id} - ${selectedTask.title}`;
  }

  applyTaskFilter(): void {
    const query = (this.taskSearchQuery || '').trim().toLowerCase();
    if (!query) {
      this.filteredAssignableTasks = [...this.assignableTasks];
      this.taskSuggestions = this.filteredAssignableTasks.slice(0, 8);
      return;
    }

    this.filteredAssignableTasks = this.assignableTasks.filter(task => {
      const haystack = [
        task.id,
        task.title,
        task.status,
        task.priority,
        task.task_type,
        task.assigned_to?.name || '',
        task.project?.name || '',
        task.due_date || ''
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    this.taskSuggestions = this.filteredAssignableTasks.slice(0, 8);
  }

  submitAssignTask(): void {
    if (!this.selectedMember) {
      this.dialogError = 'No team member selected.';
      return;
    }

    const taskId = Number(this.assignTaskIdInput);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      this.dialogError = 'Please select a valid task.';
      return;
    }

    this.dialogLoading = true;
    this.dialogError = null;
    this.taskService.assignTask(taskId, { assigned_to_id: this.selectedMember.id }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeDialog();
        this.loadTaskStatsForMembers();
      },
      error: (error) => {
        this.dialogLoading = false;
        this.dialogError = error?.message || 'Failed to assign task.';
      }
    });
  }

  submitEditMember(): void {
    if (!this.selectedMember) {
      this.dialogError = 'No team member selected.';
      return;
    }

    const updatedName = this.editMemberName.trim();
    const updatedRole = this.editMemberRole.trim().toUpperCase();

    const updatePayload: UpdateUserRequest = {};
    if (updatedName && updatedName !== this.selectedMember.name) {
      updatePayload.name = updatedName;
    }
    if (updatedRole && updatedRole !== this.selectedMember.rawRole) {
      updatePayload.role = updatedRole;
    }

    if (!Object.keys(updatePayload).length) {
      this.closeDialog();
      return;
    }

    this.dialogLoading = true;
    this.dialogError = null;
    this.authService.updateUserByAdmin(this.selectedMember.id, updatePayload).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeDialog();
        this.loadTeamMembers();
      },
      error: (error) => {
        this.dialogLoading = false;
        this.dialogError = error?.message || 'Failed to update user.';
      }
    });
  }
}