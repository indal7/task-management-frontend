import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Task } from '../../../core/models/task.model';
import { TaskService } from '../../../core/services/task.service';
import { AuthService } from '../../../core/services/auth.service';
import { EnumService } from '../../../core/services/enum.service';
import { ActivatedRoute } from '@angular/router';  // Add this line
import { parseApiDate } from '../../../core/utils/date-time.util';
import { AppearanceService } from '../../../core/services/appearance.service';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss']
})
export class TaskListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  filterStatus: string = 'all';
  searchTerm: string = '';
  isLoading: boolean = false;
  errorMessage: string | null = null;
  currentUserId: number = 0;

  // Add view mode and columns for different layouts
  viewMode: 'list' | 'grid' | 'kanban' = 'list';
  showCreateTaskModal = false;

  // 🔧 FIXED: Updated status columns to match API enum values
  statusColumns = [
    { status: 'BACKLOG', label: 'Backlog', color: '#6b7280' },
    { status: 'TODO', label: 'To Do', color: '#fbbf24' },
    { status: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6' },
    { status: 'IN_REVIEW', label: 'In Review', color: '#8b5cf6' },
    { status: 'TESTING', label: 'Testing', color: '#06b6d4' },
    { status: 'DONE', label: 'Done', color: '#10b981' },
    { status: 'BLOCKED', label: 'Blocked', color: '#dc2626' },
    { status: 'CANCELLED', label: 'Cancelled', color: '#ef4444' }
  ];

  // 🔧 FIXED: Updated status options to match API
  statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'BACKLOG', label: 'Backlog' },
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'TESTING', label: 'Testing' },
    { value: 'DONE', label: 'Done' },
    { value: 'BLOCKED', label: 'Blocked' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'DEPLOYED', label: 'Deployed' }
  ];

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private enumService: EnumService,
    public router: Router,
    private route: ActivatedRoute,
    private appearanceService: AppearanceService,

  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.viewMode = this.appearanceService.getCurrentSettings().defaultView;

    this.appearanceService.appearance$
      .pipe(takeUntil(this.destroy$))
      .subscribe(settings => {
        this.viewMode = settings.defaultView;
      });

    this.getCurrentUser();
    // this.loadTasks();
    this.determineTaskType();

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params.get('create') === '1') {
          this.showCreateTaskModal = true;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  private determineTaskType(): void {
    const currentRoute = this.route.snapshot.routeConfig?.path;

    switch (currentRoute) {
      case 'my-tasks':
        this.loadMyTasks();
        break;
      case 'overdue':
        this.loadOverdueTasks();
        break;
      default:
        this.loadAllTasks();  // Load all tasks for '/tasks' route
        break;
    }
  }

  loadAllTasks(): void {  // Change method name from loadTasks to loadAllTasks
    this.isLoading = true;
    this.errorMessage = null;

    // Remove assigned_to_id filter for all tasks
    const filters = {
      // assigned_to_id: this.currentUserId,  // Remove this line
      page: 1,
      per_page: 50,
      sort_by: 'created_at',
      sort_order: 'desc' as 'desc'
    };

    this.taskService.getTasks(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // console.log('Tasks response:', response);
          // Handle paginated response format
          this.tasks = Array.isArray(response.data) ? response.data : [];
          this.applyFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
          this.errorMessage = this.getErrorMessage(error);
          this.tasks = [];
          this.applyFilters();
          this.isLoading = false;
        }
      });
  }
  // ... rest of the method stays the same

  // 🔧 FIXED: Get current user ID properly
  private getCurrentUser(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.currentUserId = user.id;
        }
      });
  }

  // Performance optimization
  trackByTaskId(index: number, task: Task): number {
    return task.id;
  }

  // Get tasks by status for kanban view
  getTasksByStatus(status: string): Task[] {
    return this.filteredTasks.filter(task => task.status === status);
  }

  // 🔧 FIXED: Proper API integration with pagination handling
  loadTasks(): void {
    this.isLoading = true;
    this.errorMessage = null;

    // Load tasks with proper filters
    const filters = {
      assigned_to_id: this.currentUserId, // Get user's assigned tasks
      page: 1,
      per_page: 50, // Reasonable limit
      sort_by: 'created_at',
      sort_order: 'desc' as 'desc'
    };

    this.taskService.getTasks(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // console.log('Tasks response:', response);
          // Handle paginated response format
          this.tasks = Array.isArray(response.data) ? response.data : [];
          this.applyFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
          this.errorMessage = this.getErrorMessage(error);
          this.tasks = [];
          this.applyFilters();
          this.isLoading = false;
        }
      });
  }

  refreshTasks(): void {
    this.determineTaskType();  // Change from this.loadTasks() to this.determineTaskType()
  }

  applyFilters(): void {
    if (!Array.isArray(this.tasks)) {
      console.error('Tasks is not an array:', this.tasks);
      this.filteredTasks = [];
      return;
    }

    this.filteredTasks = this.tasks.filter(task => {
      const matchesStatus =
        this.filterStatus === 'all' ||
        (task.status && task.status === this.filterStatus);

      const matchesSearch =
        !this.searchTerm ||
        (task.title && task.title.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (task.description && task.description.toLowerCase().includes(this.searchTerm.toLowerCase()));

      return matchesStatus && matchesSearch;
    });
  }

  onStatusFilterChange(status: string): void {
    this.filterStatus = status;
    this.applyFilters();
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.applyFilters();
  }

  viewTaskDetails(taskId: number): void {
    this.router.navigate(['/tasks', taskId]);
  }

  createNewTask(): void {
    this.showCreateTaskModal = true;
  }

  closeCreateTaskModal(): void {
    this.showCreateTaskModal = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  onTaskCreatedFromModal(): void {
    this.closeCreateTaskModal();
    this.refreshTasks();
  }

  // 🔧 FIXED: Use proper API method for delete
  deleteTask(taskId: number, event: Event): void {
    event.stopPropagation();

    if (confirm('Are you sure you want to delete this task?')) {
      this.taskService.deleteTask(taskId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.applyFilters();
          },
          error: (error) => {
            this.errorMessage = this.getErrorMessage(error);
          }
        });
    }
  }

  // 🔧 IMPROVED: Use EnumService for consistent labeling
  getStatusLabel(status: string): string {
    if (!status) return 'Unknown';
    return this.enumService.getTaskStatusLabel(status) || status.replace('_', ' ');
  }

  getPriorityClass(priority: string): string {
    if (!priority) return 'priority-medium';
    return `priority-${priority.toLowerCase()}`;
  }

  getPriorityLabel(priority: string): string {
    if (!priority) return 'Medium';
    return this.enumService.getTaskPriorityLabel(priority) || priority.replace('_', ' ');
  }

  // Set view mode
  setViewMode(mode: 'list' | 'grid' | 'kanban'): void {
    this.viewMode = mode;
    this.appearanceService.setDefaultView(mode);
  }

  // Clear all filters
  clearFilters(): void {
    this.searchTerm = '';
    this.filterStatus = 'all';
    this.applyFilters();
  }

  // 🔧 IMPROVED: Use EnumService for colors
  getTaskPriorityColor(priority: string): string {
    if (!priority) return '#6b7280';
    return this.enumService.getTaskPriorityColor(priority) || '#6b7280';
  }

  getTaskStatusColor(status: string): string {
    if (!status) return '#6b7280';
    return this.enumService.getTaskStatusColor(status) || '#6b7280';
  }

  // Check if task is overdue
  isTaskOverdue(task: Task): boolean {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now && !['DONE', 'COMPLETED', 'DEPLOYED', 'CANCELLED'].includes(task.status);
  }

  // Get relative time for task creation
  getRelativeTime(dateString: string): string {
    if (!dateString) return '';

    const date = parseApiDate(dateString);
    if (!date) return '';
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} minutes ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // 🔧 IMPROVED: Better error handling for new API format
  private getErrorMessage(error: any): string {
    // Handle new standardized error format
    if (error?.error?.success === false) {
      return error.error.message || 'Failed to load tasks';
    }

    // Handle legacy error format
    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.message) {
      return error.message;
    }

    return 'An unexpected error occurred while loading tasks';
  }

  // 🔧 NEW: Load tasks by different criteria
  loadMyTasks(): void {
    this.isLoading = true;
    this.taskService.getMyTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.applyFilters();
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
          this.isLoading = false;
        }
      });
  }

  loadOverdueTasks(): void {
    this.isLoading = true;
    this.taskService.getOverdueTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.applyFilters();
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
          this.isLoading = false;
        }
      });
  }

  // 🔧 NEW: Quick actions for tasks
  markTaskAsComplete(taskId: number, event: Event): void {
    event.stopPropagation();

    const updateData = { status: 'DONE' };
    this.taskService.updateTask(taskId, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTask) => {
          // Update the task in the local array
          const index = this.tasks.findIndex(task => task.id === taskId);
          if (index !== -1) {
            this.tasks[index] = updatedTask;
            this.applyFilters();
          }
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
        }
      });
  }

  assignTaskToMe(taskId: number, event: Event): void {
    event.stopPropagation();

    if (!this.currentUserId) return;

    const assignData = { assigned_to_id: this.currentUserId };
    this.taskService.assignTask(taskId, assignData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTask) => {
          const index = this.tasks.findIndex(task => task.id === taskId);
          if (index !== -1) {
            this.tasks[index] = updatedTask;
            this.applyFilters();
          }
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
        }
      });
  }

  getKanbanColumnClass(status: string): string {
    return 'kanban-column status-' + status.toLowerCase().replace('_', '-');
  }
}