// src/app/features/time-tracking/time-tracking/time-tracking.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, interval, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, switchMap, map } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { Task, User, TimeLog } from '../../core/models';

interface TimeEntry {
  id: number;
  taskId: number;
  taskTitle: string;
  projectName: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  description: string;
  date: string;
  isRunning: boolean;
}

interface DailyTimeLog {
  date: string;
  totalMinutes: number;
  entries: TimeEntry[];
}

interface WeeklyStats {
  totalHours: number;
  dailyAverages: number;
  mostProductiveDay: string;
  projectBreakdown: { [projectName: string]: number };
}

@Component({
  selector: 'app-time-tracking',
  template: `
    <div class="time-tracking-container">
      <!-- Header -->
      <div class="time-tracking-header">
        <div class="header-content">
          <h1>
            <mat-icon>schedule</mat-icon>
            Time Tracking
          </h1>
          <p>Track your time and boost productivity</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="accent" (click)="exportTimesheet()">
            <mat-icon>file_download</mat-icon>
            Export Timesheet
          </button>
        </div>
      </div>

      <!-- Timer Section -->
      <mat-card class="timer-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>timer</mat-icon>
            Active Timer
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="timer-display">
            <div class="time-display">
              {{ formatTime(currentDuration) }}
            </div>
            <div class="timer-status" [ngClass]="{ 'running': isTimerRunning }">
              {{ isTimerRunning ? 'Running' : 'Stopped' }}
            </div>
          </div>

          <div class="timer-controls">
            <mat-form-field appearance="outline" class="task-select">
              <mat-label>Select Task</mat-label>
              <mat-select [(value)]="selectedTaskId" [disabled]="isTimerRunning">
                <mat-option *ngFor="let task of availableTasks" [value]="task.id">
                  {{ formatTaskOption(task) }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="description-field">
              <mat-label>Description (Optional)</mat-label>
              <input matInput [(ngModel)]="timerDescription" [disabled]="isTimerRunning" 
                     placeholder="What are you working on?">
            </mat-form-field>

            <div class="timer-buttons">
              <button mat-raised-button 
                      [color]="isTimerRunning ? 'warn' : 'primary'"
                      [disabled]="!selectedTaskId && !isTimerRunning"
                      (click)="toggleTimer()">
                <mat-icon>{{ isTimerRunning ? 'stop' : 'play_arrow' }}</mat-icon>
                {{ isTimerRunning ? 'Stop' : 'Start' }}
              </button>
              
              <button mat-button 
                      *ngIf="isTimerRunning"
                      (click)="pauseTimer()">
                <mat-icon>pause</mat-icon>
                Pause
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Weekly Stats -->
      <div class="stats-section">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ weeklyStats.totalHours }}h</h3>
              <p>This Week</p>
            </div>
            <mat-icon>schedule</mat-icon>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ weeklyStats.dailyAverages }}h</h3>
              <p>Daily Average</p>
            </div>
            <mat-icon>trending_up</mat-icon>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ weeklyStats.mostProductiveDay }}</h3>
              <p>Most Productive</p>
            </div>
            <mat-icon>star</mat-icon>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-info">
              <h3>{{ todayHours }}h</h3>
              <p>Today</p>
            </div>
            <mat-icon>today</mat-icon>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Time Logs -->
      <mat-card class="time-logs-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>history</mat-icon>
            Recent Time Logs
          </mat-card-title>
          <div class="card-actions">
            <mat-form-field appearance="outline" class="date-filter">
              <mat-label>Filter by Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="selectedDate" 
                     (dateChange)="onDateFilterChange()">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>
        </mat-card-header>
        <mat-card-content>
          <!-- Loading State -->
          <app-loading *ngIf="isLoading" message="Loading time logs..."></app-loading>

          <!-- Daily Time Logs -->
          <div class="daily-logs" *ngIf="!isLoading">
            <div class="daily-log" *ngFor="let dailyLog of dailyTimeLogs">
              <div class="daily-header">
                <h3>{{ dailyLog.date | date:'fullDate' }}</h3>
                <span class="daily-total">{{ formatMinutesToHours(dailyLog.totalMinutes) }}</span>
              </div>

              <div class="time-entries">
                <div class="time-entry" *ngFor="let entry of dailyLog.entries">
                  <div class="entry-info">
                    <div class="entry-task">
                      <strong>{{ entry.taskTitle }}</strong>
                      <span class="project-name">{{ entry.projectName }}</span>
                    </div>
                    <div class="entry-description" *ngIf="entry.description">
                      {{ entry.description }}
                    </div>
                    <div class="entry-time">
                      {{ entry.startTime | date:'shortTime' }} - 
                      {{ entry.endTime | date:'shortTime' }}
                    </div>
                  </div>
                  <div class="entry-duration">
                    {{ formatMinutesToHours(entry.duration) }}
                  </div>
                  <div class="entry-actions">
                    <button mat-icon-button (click)="editTimeEntry(entry)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="deleteTimeEntry(entry)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div class="empty-state" *ngIf="!isLoading && dailyTimeLogs.length === 0">
            <mat-icon>schedule</mat-icon>
            <h3>No Time Logs Found</h3>
            <p>Start tracking your time to see logs here</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Project Time Breakdown -->
      <mat-card class="project-breakdown-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>pie_chart</mat-icon>
            Project Time Breakdown
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="project-breakdown">
            <div class="project-item" *ngFor="let project of getProjectBreakdownArray()">
              <div class="project-info">
                <span class="project-name">{{ project.name }}</span>
                <span class="project-time">{{ formatMinutesToHours(project.minutes) }}</span>
              </div>
              <mat-progress-bar 
                mode="determinate" 
                [value]="getProjectPercentage(project.minutes)"
                color="primary">
              </mat-progress-bar>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .time-tracking-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .time-tracking-header {
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
      color: #666;
    }

    .timer-card {
      margin-bottom: 2rem;
      border-radius: 12px;
    }

    .timer-display {
      text-align: center;
      margin-bottom: 2rem;
    }

    .time-display {
      font-size: 4rem;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      color: #667eea;
      margin-bottom: 0.5rem;
    }

    .timer-status {
      font-size: 1.2rem;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .timer-status.running {
      color: #10b981;
      animation: pulse 2s infinite;
    }

    .timer-controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      align-items: start;
    }

    .task-select, .description-field {
      width: 100%;
    }

    .timer-buttons {
      grid-column: 1 / -1;
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-top: 1rem;
    }

    .stats-section {
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
      color: #667eea;
    }

    .stat-info p {
      margin: 0.5rem 0 0;
      color: #666;
      font-size: 0.9rem;
    }

    .stat-card mat-icon {
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
      color: #667eea;
      opacity: 0.7;
    }

    .time-logs-card {
      margin-bottom: 2rem;
      border-radius: 12px;
    }

    .card-actions {
      display: flex;
      gap: 1rem;
    }

    .date-filter {
      min-width: 150px;
    }

    .daily-logs {
      max-height: 500px;
      overflow-y: auto;
    }

    .daily-log {
      margin-bottom: 2rem;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .daily-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .daily-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .daily-total {
      font-weight: 600;
      color: #667eea;
    }

    .time-entries {
      padding: 0;
    }

    .time-entry {
      display: flex;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s;
    }

    .time-entry:hover {
      background: #f8f9fa;
    }

    .time-entry:last-child {
      border-bottom: none;
    }

    .entry-info {
      flex: 1;
    }

    .entry-task {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .project-name {
      background: #e3f2fd;
      color: #1976d2;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .entry-description {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
    }

    .entry-time {
      color: #999;
      font-size: 0.8rem;
    }

    .entry-duration {
      font-weight: 600;
      color: #667eea;
      margin-right: 1rem;
      min-width: 60px;
    }

    .entry-actions {
      display: flex;
      gap: 0.25rem;
    }

    .project-breakdown-card {
      border-radius: 12px;
    }

    .project-breakdown {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .project-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .project-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .project-name {
      font-weight: 500;
    }

    .project-time {
      color: #667eea;
      font-weight: 600;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #666;
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
      margin: 0;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (max-width: 768px) {
      .time-tracking-container {
        padding: 1rem;
      }

      .time-tracking-header {
        flex-direction: column;
        gap: 1rem;
      }

      .timer-controls {
        grid-template-columns: 1fr;
      }

      .time-display {
        font-size: 3rem;
      }

      .daily-header {
        flex-direction: column;
        gap: 0.5rem;
        text-align: center;
      }

      .time-entry {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .entry-duration {
        margin-right: 0;
      }
    }
  `]
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private timerSubscription$ = new Subject<void>();

  // Timer State
  isTimerRunning = false;
  currentDuration = 0; // in seconds
  selectedTaskId: number | null = null;
  timerDescription = '';
  timerStartTime: Date | null = null;

  // Data
  availableTasks: Task[] = [];
  dailyTimeLogs: DailyTimeLog[] = [];
  weeklyStats: WeeklyStats = {
    totalHours: 0,
    dailyAverages: 0,
    mostProductiveDay: 'Monday',
    projectBreakdown: {}
  };

  // UI State
  isLoading = false;
  selectedDate: Date | null = null;
  todayHours = 0;

  constructor(
    private authService: AuthService,
    private taskService: TaskService
  ) {}

  ngOnInit(): void {
    this.loadAvailableTasksAndTimeLogs();
    this.calculateWeeklyStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.timerSubscription$.next();
    this.timerSubscription$.complete();
  }

  loadAvailableTasksAndTimeLogs(): void {
    this.taskService.getAllTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.availableTasks = Array.isArray(tasks) ? tasks : [tasks];
          this.loadTimeLogs();
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
        }
      });
  }

  loadAvailableTasks(): void {
    this.taskService.getAllTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.availableTasks = Array.isArray(tasks) ? tasks : [tasks];
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
        }
      });
  }

  loadTimeLogs(): void {
    this.isLoading = true;
    this.dailyTimeLogs = [];

    const dateFilter = this.selectedDate ? this.selectedDate.toISOString().split('T')[0] : undefined;

    this.taskService.getUserTimeLogs({
      limit: 200,
      start_date: dateFilter,
      end_date: dateFilter
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const taskMap = new Map(this.availableTasks.map(task => [task.id, task]));

          this.dailyTimeLogs = (result.daily_breakdown || []).map(daily => {
            const entries: TimeEntry[] = (daily.logs || []).map(log => {
              const matchedTask = taskMap.get(log.task_id);
              const dateStr = log.logged_at || log.created_at || new Date().toISOString();
              const date = (log.work_date || dateStr.split('T')[0]);
              const durationHours = (typeof log.hours === 'number' ? log.hours : (log.hours_logged || 0));
              const durationMinutes = Math.round(durationHours * 60);
              const loggedAt = new Date(dateStr);

              return {
                id: log.id,
                taskId: log.task_id,
                taskTitle: matchedTask?.title || `Task #${log.task_id}`,
                projectName: matchedTask?.project?.name || 'Unknown Project',
                startTime: loggedAt,
                endTime: loggedAt,
                duration: durationMinutes,
                description: log.description || '',
                date,
                isRunning: false
              };
            });

            const totalMinutes = Math.round((daily.total_hours || 0) * 60);
            return {
              date: daily.date,
              totalMinutes,
              entries
            };
          }).sort((a, b) => b.date.localeCompare(a.date));

          this.isLoading = false;
          this.calculateWeeklyStats();
        },
        error: (error) => {
          console.error('Error loading user time logs:', error);
          this.isLoading = false;
          this.calculateWeeklyStats();
        }
      });
  }

  calculateWeeklyStats(): void {
    if (!this.dailyTimeLogs.length) {
      this.weeklyStats = {
        totalHours: 0,
        dailyAverages: 0,
        mostProductiveDay: '-',
        projectBreakdown: {}
      };
      this.todayHours = 0;
      return;
    }

    console.log('Calculating weekly stats from daily logs:', this.dailyTimeLogs);
    const totalMinutes = this.dailyTimeLogs.reduce((sum, log) => sum + log.totalMinutes, 0);
    this.weeklyStats.totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    this.weeklyStats.dailyAverages = Math.round(totalMinutes / 7 / 60 * 10) / 10;
    
    // Calculate today's hours
    const today = new Date().toISOString().split('T')[0];
    const todayLog = this.dailyTimeLogs.find(log => log.date === today);
    this.todayHours = todayLog ? Math.round(todayLog.totalMinutes / 60 * 10) / 10 : 0;
    
    // Find most productive day
    const maxLog = this.dailyTimeLogs.reduce((max, log) => 
      log.totalMinutes > max.totalMinutes ? log : max, this.dailyTimeLogs[0]);
    // console.log('Most productive day:', maxLog);
    this.weeklyStats.mostProductiveDay = new Date(maxLog.date).toLocaleDateString('en', { weekday: 'long' });
    
    // Calculate project breakdown
    this.weeklyStats.projectBreakdown = {};
    this.dailyTimeLogs.forEach(log => {
      log.entries.forEach(entry => {
        if (!this.weeklyStats.projectBreakdown[entry.projectName]) {
          this.weeklyStats.projectBreakdown[entry.projectName] = 0;
        }
        this.weeklyStats.projectBreakdown[entry.projectName] += entry.duration;
      });
    });
  }

  toggleTimer(): void {
    if (this.isTimerRunning) {
      this.stopTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer(): void {
    if (!this.selectedTaskId) return;
    
    this.isTimerRunning = true;
    this.timerStartTime = new Date();
    this.currentDuration = 0;
    
    // Start the timer
    interval(1000)
      .pipe(takeUntil(this.timerSubscription$))
      .subscribe(() => {
        this.currentDuration++;
      });
  }

  stopTimer(): void {
    if (!this.isTimerRunning || !this.timerStartTime) return;
    
    this.isTimerRunning = false;
    this.timerSubscription$.next();

    const durationSeconds = this.currentDuration;
    const hoursLogged = Math.round((durationSeconds / 3600) * 100) / 100;

    if (this.selectedTaskId && hoursLogged > 0) {
      const selectedTask = this.availableTasks.find(task => task.id === this.selectedTaskId);
      this.taskService.createTimeLog(this.selectedTaskId, {
        hours: hoursLogged,
        hours_logged: hoursLogged,
        description: this.timerDescription || undefined,
        work_date: new Date().toISOString().split('T')[0]
      }).subscribe({
        next: (log) => {
          if (selectedTask) {
            const durationMinutes = Math.round(hoursLogged * 60);
            const date = new Date().toISOString().split('T')[0];
            const newEntry: TimeEntry = {
              id: log.id,
              taskId: this.selectedTaskId!,
              taskTitle: selectedTask.title,
              projectName: selectedTask.project?.name || 'Unknown Project',
              startTime: this.timerStartTime!,
              endTime: new Date(),
              duration: durationMinutes,
              description: this.timerDescription,
              date,
              isRunning: false
            };
            this.addTimeEntry(newEntry);
          }
        },
        error: (err) => {
          console.error('Failed to save time log:', err);
        }
      });
    }
    
    // Reset timer
    this.currentDuration = 0;
    this.timerStartTime = null;
    this.timerDescription = '';
  }

  pauseTimer(): void {
    this.timerSubscription$.next();
    this.isTimerRunning = false;
  }

  private addTimeEntry(entry: TimeEntry): void {
    const todayLog = this.dailyTimeLogs.find(log => log.date === entry.date);
    if (todayLog) {
      todayLog.entries.unshift(entry);
      todayLog.totalMinutes += entry.duration;
    } else {
      this.dailyTimeLogs.unshift({
        date: entry.date,
        totalMinutes: entry.duration,
        entries: [entry]
      });
    }
    this.calculateWeeklyStats();
  }

  onDateFilterChange(): void {
    this.loadTimeLogs();
  }

  editTimeEntry(entry: TimeEntry): void {
    const currentHours = (entry.duration / 60).toFixed(2);
    const updatedHoursInput = window.prompt('Update logged hours', currentHours);
    if (updatedHoursInput === null) {
      return;
    }

    const updatedHours = Number(updatedHoursInput);
    if (Number.isNaN(updatedHours) || updatedHours <= 0) {
      window.alert('Please enter a valid number of hours greater than 0.');
      return;
    }

    const updatedDescription = window.prompt('Update description', entry.description || '') ?? entry.description;

    this.taskService.updateTimeLog(entry.taskId, entry.id, {
      hours: updatedHours,
      hours_logged: updatedHours,
      description: updatedDescription,
      work_date: entry.date
    }).subscribe({
      next: () => {
        this.loadTimeLogs();
      },
      error: (error) => {
        console.error('Failed to update time log:', error);
        window.alert(error?.message || 'Failed to update time log');
      }
    });
  }

  deleteTimeEntry(entry: TimeEntry): void {
    if (confirm('Are you sure you want to delete this time entry?')) {
      this.taskService.deleteTimeLog(entry.taskId, entry.id).subscribe({
        next: () => {
          this.loadTimeLogs();
        },
        error: (error) => {
          console.error('Failed to delete time log:', error);
          window.alert(error?.message || 'Failed to delete time log');
        }
      });
    }
  }

  exportTimesheet(): void {
    const rows = this.dailyTimeLogs.flatMap(log =>
      log.entries.map(entry => ({
        date: log.date,
        task: entry.taskTitle,
        project: entry.projectName,
        description: entry.description || '',
        start: entry.startTime.toLocaleTimeString(),
        end: entry.endTime ? entry.endTime.toLocaleTimeString() : '',
        duration: this.formatMinutesToHours(entry.duration)
      }))
    );

    if (!rows.length) {
      window.alert('No time logs available to export.');
      return;
    }

    const csvHeader = ['Date', 'Task', 'Project', 'Description', 'Start Time', 'End Time', 'Duration'];
    const csvBody = rows.map(row => [
      row.date,
      row.task,
      row.project,
      row.description,
      row.start,
      row.end,
      row.duration
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));

    const csvContent = [csvHeader.join(','), ...csvBody].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `timesheet-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatMinutesToHours(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

  getProjectBreakdownArray(): { name: string; minutes: number }[] {
    return Object.entries(this.weeklyStats.projectBreakdown)
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  getProjectPercentage(minutes: number): number {
    const totalMinutes = Object.values(this.weeklyStats.projectBreakdown)
      .reduce((sum, mins) => sum + mins, 0);
    return totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
  }

  formatTaskOption(task: Task): string {
    const projectName = task.project?.name || 'No Project';
    return `${task.title} (${projectName})`;
  }
}