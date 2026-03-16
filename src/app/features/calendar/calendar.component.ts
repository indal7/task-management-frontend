import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

// Core Services and Models
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { Task, User } from '../../core/models';

interface CalendarDay {
  date: Date;
  tasks: Task[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  hasOverdueTasks: boolean;
  taskCount: number;
}

interface FilterOptions {
  showMyTasks: boolean;
  showCompleted: boolean;
  priorities: string[];
  statuses: string[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatCheckboxModule,
    MatSnackBarModule
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Calendar State
  currentDate = new Date();
  calendarDays: CalendarDay[] = [];
  weekDays: CalendarDay[] = [];
  selectedDay: CalendarDay | null = null;
  viewMode: 'month' | 'week' | 'day' = 'month';
  
  // Data
  tasks: Task[] = [];
  currentUser: User | null = null;
  
  // UI State
  loading = false;
  error: string | null = null;
  
  // Calendar Constants
  readonly dayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  readonly dayHeadersShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly timeSlots = Array.from({ length: 24 }, (_, i) => i);
  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Filter Options
  filterOptions: FilterOptions = {
    showMyTasks: true,
    showCompleted: false,
    priorities: ['HIGH', 'MEDIUM', 'LOW'],
    statuses: ['TODO', 'IN_PROGRESS', 'IN_REVIEW']
  };

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          if (user) {
            this.loadTasks();
          } else {
            this.tasks = [];
            this.generateCalendar();
          }
        },
        error: (error) => {
          console.error('Auth error:', error);
          this.showError('Authentication error occurred');
        }
      });
  }

  private loadInitialData(): void {
    this.generateCalendar();
    if (this.currentUser) {
      this.loadTasks();
    }
  }

  loadTasks(): void {
    if (!this.currentUser) {
      console.warn('No current user, skipping task load');
      return;
    }

    this.setLoading(true);
    this.error = null;

    const { startDate, endDate } = this.getDateRange();
    
    const filters = this.buildFilters(startDate, endDate);

    this.taskService.getTasks(filters)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading tasks:', error);
          this.showError('Failed to load tasks. Please try again.');
          return of({ data: [], total: 0 }); // Return empty result
        }),
        finalize(() => this.setLoading(false))
      )
      .subscribe({
        next: (response) => {
          this.tasks = response.data || [];
          this.generateCalendar();
          console.log(`Calendar: Loaded ${this.tasks.length} tasks`);
        }
      });
  }

  private buildFilters(startDate: Date, endDate: Date): any {
    const filters: any = {
      start_date: this.formatDateForAPI(startDate),
      end_date: this.formatDateForAPI(endDate)
    };

    if (this.filterOptions.showMyTasks && this.currentUser) {
      filters.assigned_to_id = this.currentUser.id;
    }

    if (this.filterOptions.priorities.length > 0) {
      filters.priority = this.filterOptions.priorities.join(',');
    }

    if (!this.filterOptions.showCompleted) {
      filters.status = this.filterOptions.statuses.join(',');
    }

    return filters;
  }

  private formatDateForAPI(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private setLoading(loading: boolean): void {
    this.loading = loading;
    this.cdr.detectChanges();
  }

  private showError(message: string): void {
    this.error = message;
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private getDateRange(): { startDate: Date; endDate: Date } {
    let startDate: Date;
    let endDate: Date;

    if (this.viewMode === 'month') {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      
      startDate = new Date(year, month, 1);
      startDate = new Date(startDate.getTime() - (startDate.getDay() * 24 * 60 * 60 * 1000));
      
      endDate = new Date(year, month + 1, 0);
      endDate = new Date(endDate.getTime() + ((6 - endDate.getDay()) * 24 * 60 * 60 * 1000));
    } else if (this.viewMode === 'week') {
      const dayOfWeek = this.currentDate.getDay();
      startDate = new Date(this.currentDate.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
      endDate = new Date(startDate.getTime() + (6 * 24 * 60 * 60 * 1000));
    } else { // day view
      startDate = new Date(this.currentDate);
      endDate = new Date(this.currentDate);
    }

    return { startDate, endDate };
  }

  generateCalendar(): void {
    try {
      switch (this.viewMode) {
        case 'month':
          this.generateMonthView();
          break;
        case 'week':
          this.generateWeekView();
          break;
        case 'day':
          this.generateDayView();
          break;
      }
    } catch (error) {
      console.error('Error generating calendar:', error);
      this.showError('Error generating calendar view');
    }
  }

  private generateMonthView(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    this.calendarDays = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayTasks = this.getTasksForDate(current);
      const overdueTasks = this.getOverdueTasksForDate(current);
      
      this.calendarDays.push({
        date: new Date(current),
        tasks: dayTasks,
        isCurrentMonth: current.getMonth() === month,
        isToday: this.isToday(current),
        isSelected: this.selectedDay?.date.toDateString() === current.toDateString(),
        isWeekend: current.getDay() === 0 || current.getDay() === 6,
        hasOverdueTasks: overdueTasks.length > 0,
        taskCount: dayTasks.length
      });
      
      current.setDate(current.getDate() + 1);
    }
  }

  private generateWeekView(): void {
    const startOfWeek = new Date(this.currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    this.weekDays = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      
      const dayTasks = this.getTasksForDate(date);
      const overdueTasks = this.getOverdueTasksForDate(date);
      
      this.weekDays.push({
        date,
        tasks: dayTasks,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        isSelected: this.selectedDay?.date.toDateString() === date.toDateString(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        hasOverdueTasks: overdueTasks.length > 0,
        taskCount: dayTasks.length
      });
    }
  }

  private generateDayView(): void {
    const dayTasks = this.getTasksForDate(this.currentDate);
    const overdueTasks = this.getOverdueTasksForDate(this.currentDate);
    
    this.selectedDay = {
      date: new Date(this.currentDate),
      tasks: dayTasks,
      isCurrentMonth: true,
      isToday: this.isToday(this.currentDate),
      isSelected: true,
      isWeekend: this.currentDate.getDay() === 0 || this.currentDate.getDay() === 6,
      hasOverdueTasks: overdueTasks.length > 0,
      taskCount: dayTasks.length
    };
  }

  private getTasksForDate(date: Date): Task[] {
    return this.tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      return this.isSameDate(taskDate, date);
    });
  }

  private getOverdueTasksForDate(date: Date): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.tasks.filter(task => {
      if (!task.due_date || task.status === 'DONE') return false;
      const taskDate = new Date(task.due_date);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate < today && this.isSameDate(taskDate, date);
    });
  }

  private isSameDate(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return this.isSameDate(date, today);
  }

  // Navigation Methods
  previousPeriod(): void {
    const newDate = new Date(this.currentDate);
    
    switch (this.viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
    }
    
    this.currentDate = newDate;
    this.loadTasks();
  }

  nextPeriod(): void {
    const newDate = new Date(this.currentDate);
    
    switch (this.viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
    }
    
    this.currentDate = newDate;
    this.loadTasks();
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.selectedDay = null;
    this.loadTasks();
  }

  onViewModeChange(): void {
    this.selectedDay = null;
    this.generateCalendar();
    this.loadTasks(); // Reload tasks for new view range
  }

  // Selection Methods
  selectDay(day: CalendarDay): void {
    // Clear previous selections
    [...this.calendarDays, ...this.weekDays].forEach(d => d.isSelected = false);
    
    // Set new selection
    day.isSelected = true;
    this.selectedDay = { ...day }; // Create a copy to avoid reference issues
    
    console.log('Selected day:', day.date.toDateString(), 'Tasks:', day.tasks.length);
  }

  // Task Actions
  viewTaskDetails(task: Task): void {
    if (!task?.id) {
      this.showError('Invalid task selected');
      return;
    }
    
    console.log('Viewing task details:', task.title);
    this.router.navigate(['/tasks', task.id]).catch(err => {
      console.error('Navigation error:', err);
      this.showError('Failed to navigate to task details');
    });
  }

  createTask(date?: Date): void {
    const taskDate = date || this.selectedDay?.date || new Date();
    this.router.navigate(['/tasks/create'], {
      queryParams: { 
        due_date: this.formatDateForAPI(taskDate)
      }
    }).catch(err => {
      console.error('Navigation error:', err);
      this.showError('Failed to navigate to create task');
    });
  }

  editTask(task: Task): void {
    if (!task?.id) {
      this.showError('Invalid task selected');
      return;
    }
    
    this.router.navigate(['/tasks', task.id, 'edit']).catch(err => {
      console.error('Navigation error:', err);
      this.showError('Failed to navigate to edit task');
    });
  }

  // Filter Methods
  toggleFilter(filterType: string): void {
    switch (filterType) {
      case 'myTasks':
        this.filterOptions.showMyTasks = !this.filterOptions.showMyTasks;
        break;
      case 'completed':
        this.filterOptions.showCompleted = !this.filterOptions.showCompleted;
        if (this.filterOptions.showCompleted) {
          // Include completed status when showing completed tasks
          this.filterOptions.statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
        } else {
          // Exclude completed status when not showing completed tasks
          this.filterOptions.statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];
        }
        break;
    }
    this.loadTasks();
  }

  // Utility Methods
  getFormattedDate(): string {
    try {
      switch (this.viewMode) {
        case 'month':
          return `${this.monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        case 'week':
          const startOfWeek = new Date(this.currentDate);
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
        case 'day':
          return this.currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        default:
          return '';
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  }

  getTaskPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'CRITICAL': '#b71c1c',
      'HIGH': '#f44336',
      'MEDIUM': '#ff9800',
      'LOW': '#4caf50'
    };
    return colors[priority] || '#757575';
  }

  getTaskStatusColor(status: string): string {
    const colors = {
      'TODO': '#2196f3',
      'IN_PROGRESS': '#ff9800',
      'IN_REVIEW': '#9c27b0',
      'TESTING': '#607d8b',
      'DONE': '#4caf50',
      'BLOCKED': '#f44336'
    };
    return colors[status as keyof typeof colors] || '#757575';
  }

  // Track by functions for performance
  trackByDay(index: number, day: CalendarDay): string {
    return `${day.date.toDateString()}-${day.taskCount}`;
  }

  trackByTask(index: number, task: Task): number | string {
    return task.id || index;
  }

  // Refresh data
  refreshTasks(): void {
    if (this.loading) return; // Prevent multiple simultaneous requests
    this.loadTasks();
  }
}