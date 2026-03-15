import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

import { Task } from '../../../core/models/task.model';
import { TaskComment } from '../../../core/models/task.model';
import { TaskService } from '../../../core/services/task.service';
import { EnumService } from '../../../core/services/enum.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-task-details',
  templateUrl: './task-details.component.html',
  styleUrls: ['./task-details.component.scss']
})
export class TaskDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  task: Task | null = null;
  comments: TaskComment[] = [];
  loading: boolean = true;
  error: string | null = null;
  newComment: string = '';
  isSubmittingComment: boolean = false;
  isUpdatingStatus: boolean = false;
  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService,
    private enumService: EnumService,
    public authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadTaskDetails();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTaskDetails(): void {
    this.loading = true;
    this.error = null;

    const taskId = this.getTaskIdFromRoute();
    if (!taskId) {
      this.error = 'Invalid task ID';
      this.loading = false;
      return;
    }

    this.taskService.getTaskById(taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (task) => {
          this.task = task;
          this.comments = (task as any).comments || [];
          this.loading = false;

          console.log('Task details loaded:', task);
          console.log('Comments loaded:', this.comments);
        },
        error: (error) => {
          console.error('Error loading task details:', error);
          this.error = this.getErrorMessage(error);
          this.loading = false;
        }
      });
  }


  private getTaskIdFromRoute(): number | null {
    const taskIdStr = this.route.snapshot.paramMap.get('id');
    if (!taskIdStr || taskIdStr === 'new') return null;
    
    const taskId = Number(taskIdStr);
    return isNaN(taskId) ? null : taskId;
  }

  // Navigation actions
  editTask(): void {
    if (this.task) {
      this.router.navigate(['/tasks/edit', this.task.id]);
    }
  }

  deleteTask(): void {
    if (!this.task) return;

    const confirmMessage = `Are you sure you want to delete "${this.task.title}"? This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      this.taskService.deleteTask(this.task.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.router.navigate(['/tasks']);
          },
          error: (error) => {
            this.error = this.getErrorMessage(error);
          }
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/tasks']);
  }

  // Status management
  markAsComplete(): void {
    this.updateTaskStatus('DONE');
  }

  markAsInProgress(): void {
    this.updateTaskStatus('IN_PROGRESS');
  }

  markAsBlocked(): void {
    this.updateTaskStatus('BLOCKED');
  }

  private updateTaskStatus(newStatus: string): void {
    if (!this.task) return;

    this.isUpdatingStatus = true;
    
    const updateData = { status: newStatus };
    this.taskService.updateTask(this.task.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTask) => {
          this.task = { ...this.task!, ...updatedTask };
          this.isUpdatingStatus = false;
        },
        error: (error) => {
          this.error = this.getErrorMessage(error);
          this.isUpdatingStatus = false;
        }
      });
  }

  // Comment management
  addComment(): void {
    if (!this.task || !this.newComment.trim()) return;

    this.isSubmittingComment = true;
    const commentData = { text: this.newComment.trim() };

    this.taskService.addComment(this.task.id, commentData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (comment) => {
          // Add the new comment to the list
          this.comments = [...this.comments, comment];
          this.newComment = '';
          this.isSubmittingComment = false;
        },
        error: (error) => {
          this.error = this.getErrorMessage(error);
          this.isSubmittingComment = false;
        }
      });
  }

  deleteComment(commentId: number): void {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    this.taskService.deleteTaskComment(commentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.comments = this.comments.filter(comment => comment.id !== commentId);
        },
        error: (error) => {
          this.error = this.getErrorMessage(error);
        }
      });
  }

  // Assignment actions
  assignToMe(): void {
    const currentUser = this.authService.getCurrentUserValue();
    if (!this.task || !currentUser) return;

    const assignData = { assigned_to_id: currentUser.id };
    this.taskService.assignTask(this.task.id, assignData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedTask) => {
          this.task = { ...this.task!, ...updatedTask };
        },
        error: (error) => {
          this.error = this.getErrorMessage(error);
        }
      });
  }

  // Helper methods for template
  getStatusLabel(status: string): string {
    return this.enumService.getTaskStatusLabel(status) || status;
  }

  getStatusClass(status: string): string {
    return status ? `status-${status.toLowerCase().replace('_', '-')}` : '';
  }

  getPriorityLabel(priority: string): string {
    return this.enumService.getTaskPriorityLabel(priority) || priority;
  }

  getPriorityClass(priority: string): string {
    return priority ? `priority-${priority.toLowerCase()}` : '';
  }

  getTaskTypeLabel(taskType: string): string {
    return this.enumService.getTaskTypeLabel(taskType) || taskType;
  }

  canEditTask(): boolean {
    const currentUser = this.authService.getCurrentUserValue();
    if (!currentUser || !this.task) return false;

    // User can edit if they are the assignee, creator, or admin
    return (
      this.task.assigned_to?.id === currentUser.id ||
      this.task.created_by?.id === currentUser.id ||
      ['ADMIN', 'PROJECT_MANAGER'].includes(currentUser.role)
    );
  }

  canDeleteTask(): boolean {
    const currentUser = this.authService.getCurrentUserValue();
    if (!currentUser || !this.task) return false;

    // Only creator and admins can delete
    return (
      this.task.created_by?.id === currentUser.id ||
      ['ADMIN', 'PROJECT_MANAGER'].includes(currentUser.role)
    );
  }

  isTaskOverdue(): boolean {
    if (!this.task?.due_date) return false;
    const dueDate = new Date(this.task.due_date);
    const now = new Date();
    return dueDate < now && !['DONE', 'COMPLETED', 'DEPLOYED', 'CANCELLED'].includes(this.task.status);
  }

  getDaysUntilDue(): number {
    if (!this.task?.due_date) return 0;
    const dueDate = new Date(this.task.due_date);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getProgressPercentage(): number {
    if (!this.task) return 0;
    
    // Simple progress calculation based on status
    switch (this.task.status) {
      case 'BACKLOG':
      case 'TODO':
        return 0;
      case 'IN_PROGRESS':
        return 50;
      case 'IN_REVIEW':
        return 75;
      case 'TESTING':
        return 85;
      case 'DONE':
      case 'DEPLOYED':
        return 100;
      case 'BLOCKED':
      case 'CANCELLED':
        return 0;
      default:
        return 0;
    }
  }

  getLabelsArray(): string[] {
    if (!this.task?.labels) return [];
    if (Array.isArray(this.task.labels)) return this.task.labels;
    if (typeof this.task.labels === 'string') {
      return (this.task.labels as string).split(',').map(label => label.trim()).filter(label => label);
    }
    return [];
  }

  formatDuration(hours: number | null): string {
    if (!hours) return 'Not specified';
    
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 8) {
      return `${hours} hours`;
    } else {
      const days = Math.floor(hours / 8);
      const remainingHours = hours % 8;
      return remainingHours > 0 
        ? `${days} days, ${remainingHours} hours`
        : `${days} days`;
    }
  }

  getRelativeTime(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
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

  private getErrorMessage(error: any): string {
    // Handle new standardized error format
    if (error?.error?.success === false) {
      return error.error.message || 'An error occurred';
    }
    
    // Handle legacy error format
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  }

  // Refresh task data
  refreshTask(): void {
    this.loadTaskDetails();
  }

  // Clear error message
  clearError(): void {
    this.error = null;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) { img.style.display = 'none'; }
  }
}