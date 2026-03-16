import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, forkJoin, combineLatest } from 'rxjs';
import { takeUntil, map, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { NotificationService } from '../../core/services/notification.service';
import { EnumService } from '../../core/services/enum.service';
import { User, Task, Project } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  recentTasks: Task[] = [];
  recentProjects: Project[] = [];
  overdueTasksCount = 0;
  inProgressTasksCount = 0;
  completedTasksCount = 0;
  totalProjectsCount = 0;
  unreadNotificationsCount = 0;

  isLoading = false;
  error: string | null = null;

  // Chart data (mock data for now)
  taskCompletionData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Tasks Completed',
      data: [3, 5, 2, 8, 4, 6, 7],
      backgroundColor: 'rgba(102, 126, 234, 0.2)',
      borderColor: 'rgba(102, 126, 234, 1)',
      borderWidth: 2,
      fill: true
    }]
  };

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private projectService: ProjectService,
    private notificationService: NotificationService,
    private enumService: EnumService,
    private router: Router
  ) { }

  ngOnInit(): void {

    // console.log('login data', this.authService.isLoggedIn())
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.setupSubscriptions();
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    // Current user
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // console.log('Current user:', user);
      });

    // Notifications count
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadNotificationsCount = count;
        // console.log('Unread notifications count:', count);
      });
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    this.error = null;

    // 🔧 FIXED: Use forkJoin to load all data simultaneously and handle errors properly
    const dashboardData$ = forkJoin({
      // Recent tasks - limit to 5 most recent
      recentTasks: this.taskService.getTasks({
        page: 1,
        per_page: 5,
        sort_by: 'created_at',
        sort_order: 'desc'
      }).pipe(
        map(response => response.data),
        catchError(error => {
          console.error('Error loading recent tasks:', error);
          return of([]);
        })
      ),

      // Recent projects - using the correct service method
    recentProjects: this.projectService.getRecentProjects().pipe(
      tap(response => {
        console.log('Recent projects API response:', response);
      }),
      catchError(error => {
        console.error('Error loading recent projects:', error);
        return of([]);
      })
    ),

      // Overdue tasks
      overdueTasks: this.taskService.getOverdueTasks().pipe(
        tap(response => {
          console.log('Overdue tasks API response:', response);
        }),
        catchError(error => {
          console.error('Error loading overdue tasks:', error);
          return of([]);
        })
      ),

      // Task counts by status
      inProgressTasks: this.taskService.getTasksByStatus('IN_PROGRESS').pipe(
        tap(response => {
          console.log('In-progress tasks API response:', response);
        }),
        catchError(error => {
          console.error('Error loading in-progress tasks:', error);
          return of([]);
        })
      ),

      completedTasks: this.taskService.getTasksByStatus('DONE').pipe(
        catchError(error => {
          console.error('Error loading completed tasks:', error);
          return of([]);
        })
      ),

      // All projects to get total count
      allProjects: this.projectService.getProjects({ page: 1, per_page: 1 }).pipe(
        // 
        map(response => response.pagination?.total || response.data?.length || 0),
        catchError(error => {
          console.error('Error loading project count:', error);
          return of(0);
        })
      ),

      // Notification summary
      notificationSummary: this.notificationService.getNotificationSummary().pipe(
        catchError(error => {
          console.error('Error loading notification summary:', error);
          return of({ unread_count: 0, total_notifications: 0, recent_notifications: [] });
        })
      )
    });

    // Subscribe to all dashboard data
    dashboardData$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // 🔧 FIXED: Properly assign data with null checks
          this.recentTasks = data.recentTasks || [];
          this.recentProjects = this.processRecentProjects(data.recentProjects || []);
          this.overdueTasksCount = data.overdueTasks?.length || 0;
          this.inProgressTasksCount = data.inProgressTasks?.length || 0;
          this.completedTasksCount = data.completedTasks?.length || 0;
          this.totalProjectsCount = data.allProjects || 0;
          this.unreadNotificationsCount = data.notificationSummary?.unread_count || 0;

          this.isLoading = false;
          this.error = null;

          // console.log('Dashboard data loaded successfully:', {
          //   recentTasks: this.recentTasks.length,
          //   recentProjects: this.recentProjects.length,
          //   overdueTasksCount: this.overdueTasksCount,
          //   inProgressTasksCount: this.inProgressTasksCount,
          //   completedTasksCount: this.completedTasksCount,
          //   totalProjectsCount: this.totalProjectsCount,
          //   unreadNotificationsCount: this.unreadNotificationsCount
          // });
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          this.error = 'Failed to load dashboard data. Please try again.';
          this.isLoading = false;
        }
      });
  }

  // 🔧 FIXED: Process recent projects to add missing computed properties
  private processRecentProjects(projects: Project[]): Project[] {
    return projects.map(project => {
      // Add computed properties that the template expects
      const processedProject = {
        ...project,
        tasks_count: project.tasks_count || 0,
        completed_tasks_count: this.calculateCompletedTasks(project),
      };
      console.log('Processed project:', processedProject);
      return processedProject;
    });
  }

      private calculateCompletedTasks(project: any): number {
        if (project.tasks && Array.isArray(project.tasks)) {
          return project.tasks.filter((task: any) => 
            task.status === 'DONE' || 
            task.status === 'COMPLETED' || 
            task.status === 'DEPLOYED'
          ).length;
        }
        return 0;
      }


  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  onCreateTask(): void {
    this.router.navigate(['/tasks/create']);
  }

  onCreateProject(): void {
    this.router.navigate(['/projects']);
  }

  onViewAllTasks(): void {
    this.router.navigate(['/tasks']);
  }

  onViewAllProjects(): void {
    this.router.navigate(['/projects']);
  }

  onRefreshData(): void {
    console.log('Refreshing dashboard data...');
    this.loadDashboardData();
  }

  // 🔧 IMPROVED: Add proper null checks for enum service calls
  getTaskStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    return this.enumService.getTaskStatusLabel(status) || status;
  }

  getTaskStatusColor(status: string): string {
    if (!status) return 'default';
    return this.enumService.getTaskStatusColor(status) || 'default';
  }

  getTaskPriorityLabel(priority: string): string {
    if (!priority) return 'Unknown';
    return this.enumService.getTaskPriorityLabel(priority) || priority;
  }

  getTaskPriorityColor(priority: string): string {
    if (!priority) return 'default';
    return this.enumService.getTaskPriorityColor(priority) || 'default';
  }

  getProjectStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    return this.enumService.getProjectStatusLabel(status) || status;
  }

  getProjectStatusColor(status: string): string {
    if (!status) return 'default';
    return this.enumService.getProjectStatusColor(status) || 'default';
  }

  // 🔧 NEW: Helper method to safely truncate text
  truncateText(text: string | undefined, length: number): string {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  // 🔧 NEW: Helper method to format relative time
  getRelativeTime(date: string | Date): string {
    if (!date) return '';

    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return past.toLocaleDateString();
  }

  // 🔧 NEW: Helper method for progress calculation
  calculateProgress(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) { img.style.display = 'none'; }
  }
}