
// src/app/features/analytics/analytics-overview/analytics-overview.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { ProjectService } from '../../core/services/project.service';
import { Router } from '@angular/router';

interface AnalyticsCard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: string;
  color: string;
}

interface ChartData {
  labels: string[];
  datasets: any[];
}

@Component({
  selector: 'app-analytics-overview',
  template: `
    <div class="analytics-container">
      <!-- Header -->
      <div class="analytics-header">
        <div class="header-content">
          <h1>
            <mat-icon>analytics</mat-icon>
            Analytics Overview
          </h1>
          <p>Track your team's performance and productivity</p>
        </div>
        <div class="header-actions">
          <mat-form-field appearance="outline">
            <mat-label>Time Period</mat-label>
            <mat-select [(value)]="selectedPeriod" (selectionChange)="onPeriodChange()">
              <mat-option value="7d">Last 7 days</mat-option>
              <mat-option value="30d">Last 30 days</mat-option>
              <mat-option value="3m">Last 3 months</mat-option>
              <mat-option value="1y">Last year</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-raised-button color="primary" routerLink="/analytics/advanced">
            <mat-icon>insights</mat-icon>
            Advanced Analytics
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <app-loading *ngIf="isLoading" message="Loading analytics data..."></app-loading>

      <!-- Error State -->
      <mat-card *ngIf="errorMessage && !isLoading" class="error-card">
        <mat-card-content>
          <mat-icon color="warn">error</mat-icon>
          <p>{{ errorMessage }}</p>
          <button mat-raised-button color="primary" (click)="loadAnalyticsData()">
            <mat-icon>refresh</mat-icon>
            Retry
          </button>
        </mat-card-content>
      </mat-card>

      <!-- Analytics Cards -->
      <div class="analytics-cards" *ngIf="!isLoading && !errorMessage">
        <mat-card class="analytics-card" *ngFor="let card of analyticsCards">
          <mat-card-content>
            <div class="card-header">
              <div class="card-info">
                <h3>{{ card.title }}</h3>
                <div class="card-value" [style.color]="card.color">
                  {{ card.value }}
                </div>
              </div>
              <mat-icon [style.color]="card.color">{{ card.icon }}</mat-icon>
            </div>
            <div class="card-change" [ngClass]="'change-' + card.changeType">
              <mat-icon>
                {{ card.changeType === 'increase' ? 'trending_up' : 
                   card.changeType === 'decrease' ? 'trending_down' : 'trending_flat' }}
              </mat-icon>
              <span>{{ card.change > 0 ? '+' : '' }}{{ card.change }}%</span>
              <span class="change-label">vs last period</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Charts Section -->
      <div class="charts-section" *ngIf="!isLoading && !errorMessage">
        
        <!-- Task Completion Chart -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>assignment_turned_in</mat-icon>
              Task Completion Trend
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-placeholder">
              <canvas #taskChart width="400" height="200"></canvas>
              <!-- Placeholder for actual chart -->
              <div class="chart-mock">
                <div class="chart-bars">
                  <div class="bar" *ngFor="let value of taskCompletionData" 
                       [style.height.%]="value" 
                       [style.background]="getBarColor(value)">
                  </div>
                </div>
                <div class="chart-labels">
                  <span *ngFor="let label of chartLabels">{{ label }}</span>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Project Progress Chart -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>donut_large</mat-icon>
              Project Progress
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="project-progress-list">
              <div class="progress-item" *ngFor="let project of projectProgressData">
                <div class="progress-info">
                  <span class="project-name">{{ project.name }}</span>
                  <span class="progress-value">{{ project.progress }}%</span>
                </div>
                <mat-progress-bar 
                  mode="determinate" 
                  [value]="project.progress"
                  [color]="getProgressColor(project.progress)">
                </mat-progress-bar>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Team Performance -->
        <mat-card class="chart-card full-width">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>people</mat-icon>
              Team Performance
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="team-performance-grid">
              <div class="team-member" *ngFor="let member of teamPerformanceData">
                <div class="member-info">
                  <div class="member-avatar">
                    <img *ngIf="member.avatar; else avatarFallback" 
                         [src]="member.avatar" 
                         [alt]="member.name">
                    <ng-template #avatarFallback>
                      <div class="avatar-initials">{{ getInitials(member.name) }}</div>
                    </ng-template>
                  </div>
                  <div class="member-details">
                    <h4>{{ member.name }}</h4>
                    <p>{{ member.role }}</p>
                  </div>
                </div>
                <div class="member-stats">
                  <div class="stat-item">
                    <span class="stat-label">Tasks Completed</span>
                    <span class="stat-value">{{ member.tasksCompleted }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">Productivity</span>
                    <span class="stat-value">{{ member.productivity }}%</span>
                  </div>
                  <div class="productivity-bar">
                    <mat-progress-bar 
                      mode="determinate" 
                      [value]="member.productivity"
                      [color]="getProductivityColor(member.productivity)">
                    </mat-progress-bar>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

      </div>

      <!-- Quick Insights -->
      <mat-card class="insights-card" *ngIf="!isLoading && !errorMessage">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>lightbulb</mat-icon>
            Quick Insights
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="insights-list">
            <div class="insight-item" *ngFor="let insight of insights">
              <mat-icon [style.color]="insight.color">{{ insight.icon }}</mat-icon>
              <div class="insight-content">
                <h4>{{ insight.title }}</h4>
                <p>{{ insight.description }}</p>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .analytics-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .analytics-header {
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

    .header-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
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

    .analytics-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .analytics-card {
      border-radius: 12px;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .analytics-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .card-info h3 {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-value {
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1;
    }

    .card-header mat-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
      opacity: 0.8;
    }

    .card-change {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 500;
    }

    .card-change mat-icon {
      font-size: 1rem;
      width: 1rem;
      height: 1rem;
    }

    .change-increase {
      color: #10b981;
    }

    .change-decrease {
      color: #ef4444;
    }

    .change-neutral {
      color: #6b7280;
    }

    .change-label {
      color: #999;
      font-weight: 400;
    }

    .charts-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .chart-card {
      border-radius: 12px;
    }

    .chart-card.full-width {
      grid-column: 1 / -1;
    }

    .chart-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .chart-placeholder {
      height: 250px;
      position: relative;
    }

    .chart-mock {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 1rem;
    }

    .chart-bars {
      display: flex;
      align-items: flex-end;
      gap: 1rem;
      height: 200px;
      margin-bottom: 1rem;
    }

    .bar {
      flex: 1;
      min-height: 20px;
      border-radius: 4px 4px 0 0;
      transition: all 0.3s ease;
    }

    .chart-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #666;
    }

    .project-progress-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .progress-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .project-name {
      font-weight: 500;
    }

    .progress-value {
      font-weight: 600;
      color: #667eea;
    }

    .team-performance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .team-member {
      padding: 1rem;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      transition: box-shadow 0.3s ease;
    }

    .team-member:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .member-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
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
      background: linear-gradient(45deg, #667eea, #764ba2);
      color: white;
      font-weight: 600;
      font-size: 1.2rem;
    }

    .member-details h4 {
      margin: 0 0 0.25rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .member-details p {
      margin: 0;
      font-size: 0.85rem;
      color: #666;
    }

    .member-stats {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #666;
    }

    .stat-value {
      font-weight: 600;
      color: #333;
    }

    .productivity-bar {
      margin-top: 0.5rem;
    }

    .insights-card {
      border-radius: 12px;
    }

    .insights-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .insights-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .insight-item {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .insight-item mat-icon {
      margin-top: 0.25rem;
      font-size: 1.5rem;
      width: 1.5rem;
      height: 1.5rem;
    }

    .insight-content h4 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .insight-content p {
      margin: 0;
      font-size: 0.9rem;
      color: #666;
      line-height: 1.5;
    }

    @media (max-width: 1024px) {
      .charts-section {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .analytics-container {
        padding: 1rem;
      }

      .analytics-header {
        flex-direction: column;
        gap: 1rem;
      }

      .header-actions {
        width: 100%;
        justify-content: space-between;
      }

      .analytics-cards {
        grid-template-columns: 1fr;
      }

      .team-performance-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AnalyticsOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage: string | null = null;
  selectedPeriod = '30d';

  analyticsCards: AnalyticsCard[] = [];
  taskCompletionData: number[] = [];
  chartLabels: string[] = [];
  projectProgressData: any[] = [];
  teamPerformanceData: any[] = [];
  insights: any[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private taskService: TaskService,
    private projectService: ProjectService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.loadAnalyticsData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAnalyticsData(): void {
    this.isLoading = true;
    this.errorMessage = null;

    const periodMap: { [key: string]: string } = {
      '7d': 'week',
      '30d': 'month',
      '3m': 'month',
      '1y': 'year'
    };
    const period = periodMap[this.selectedPeriod] || 'month';

    forkJoin({
      taskCompletion: this.analyticsService.getTaskCompletionRate(period).pipe(catchError(() => of(null))),
      userProductivity: this.analyticsService.getUserProductivity().pipe(catchError(() => of(null))),
      projectAnalytics: this.analyticsService.getProjectAnalytics().pipe(catchError(() => of([]))),
      teamPerformance: this.analyticsService.getTeamPerformanceMetrics().pipe(catchError(() => of(null))),
      comparison: this.analyticsService.getComparisonAnalytics().pipe(catchError(() => of(null)))
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.buildAnalyticsCards(data.taskCompletion, data.userProductivity, data.teamPerformance, data.comparison);
        this.buildChartData(data.taskCompletion);
        this.buildProjectProgress(data.projectAnalytics as any[]);
        this.buildTeamPerformance(data.teamPerformance);
        this.buildInsights(data.taskCompletion, data.userProductivity, data.teamPerformance, data.comparison);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load analytics data. Please try again.';
        this.isLoading = false;
      }
    });
  }

  private buildAnalyticsCards(taskCompletion: any, userProductivity: any, teamPerformance: any, comparison: any): void {
    const completionRateChange = comparison?.change?.completion_rate_change ?? 0;
    const tasksChange = comparison?.change?.total_tasks_change ?? 0;
    const completedChange = comparison?.change?.completed_tasks_change ?? 0;

    this.analyticsCards = [
      {
        title: 'Total Tasks',
        value: taskCompletion?.total_tasks ?? 0,
        change: tasksChange,
        changeType: tasksChange > 0 ? 'increase' : tasksChange < 0 ? 'decrease' : 'neutral',
        icon: 'assignment',
        color: '#667eea'
      },
      {
        title: 'Completed Tasks',
        value: taskCompletion?.completed_tasks ?? 0,
        change: completedChange,
        changeType: completedChange > 0 ? 'increase' : completedChange < 0 ? 'decrease' : 'neutral',
        icon: 'task_alt',
        color: '#10b981'
      },
      {
        title: 'Team Productivity',
        value: `${Math.round(teamPerformance?.average_completion_rate ?? 0)}%`,
        change: Math.round(completionRateChange),
        changeType: completionRateChange > 0 ? 'increase' : completionRateChange < 0 ? 'decrease' : 'neutral',
        icon: 'trending_up',
        color: '#f59e0b'
      },
      {
        title: 'Avg. Completion Time',
        value: `${(userProductivity?.average_completion_time_days ?? 0).toFixed(1)}d`,
        change: 0,
        changeType: 'neutral',
        icon: 'schedule',
        color: '#ef4444'
      }
    ];
  }

  private buildChartData(taskCompletion: any): void {
    const daily = taskCompletion?.daily_completion ?? [];
    const slice = daily.slice(-7);
    if (slice.length > 0) {
      this.chartLabels = slice.map((d: any) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      });
      const maxVal = Math.max(...slice.map((d: any) => d.completed), 1);
      this.taskCompletionData = slice.map((d: any) => Math.round((d.completed / maxVal) * 100));
    } else {
      this.chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      this.taskCompletionData = [0, 0, 0, 0, 0, 0, 0];
    }
  }

  private buildProjectProgress(projectAnalytics: any[]): void {
    this.projectProgressData = (projectAnalytics ?? [])
      .slice(0, 5)
      .map((p: any) => ({
        name: p.project_name,
        progress: Math.round(p.completion_rate ?? 0)
      }));
  }

  private buildTeamPerformance(teamPerformance: any): void {
    const members: any[] = [];
    if (teamPerformance?.most_productive_member) {
      members.push({
        name: teamPerformance.most_productive_member.user_name,
        role: 'Top Performer',
        avatar: null,
        tasksCompleted: teamPerformance.completed_tasks ?? 0,
        productivity: Math.round(teamPerformance.most_productive_member.completion_rate ?? 0)
      });
    }
    if (teamPerformance?.least_productive_member &&
        teamPerformance.least_productive_member.user_id !== teamPerformance.most_productive_member?.user_id) {
      members.push({
        name: teamPerformance.least_productive_member.user_name,
        role: 'Team Member',
        avatar: null,
        tasksCompleted: 0,
        productivity: Math.round(teamPerformance.least_productive_member.completion_rate ?? 0)
      });
    }
    this.teamPerformanceData = members;
  }

  private buildInsights(taskCompletion: any, userProductivity: any, teamPerformance: any, comparison: any): void {
    const insights: any[] = [];
    const rate = taskCompletion?.completion_rate ?? 0;
    const avgRate = teamPerformance?.average_completion_rate ?? 0;
    const rateChange = comparison?.change?.completion_rate_change ?? 0;

    if (rate >= 75) {
      insights.push({
        title: 'Strong Completion Rate',
        description: `Your task completion rate is ${Math.round(rate)}%, which is above the typical 75% benchmark. Keep it up!`,
        icon: 'insights',
        color: '#10b981'
      });
    } else if (rate > 0) {
      insights.push({
        title: 'Completion Rate Needs Attention',
        description: `Your task completion rate is ${Math.round(rate)}%. Focus on completing in-progress tasks to improve this metric.`,
        icon: 'warning',
        color: '#f59e0b'
      });
    }

    if (rateChange !== 0) {
      insights.push({
        title: rateChange > 0 ? 'Improving Trend' : 'Declining Trend',
        description: rateChange > 0
          ? `Completion rate improved by ${Math.abs(rateChange).toFixed(1)}% compared to the previous period.`
          : `Completion rate decreased by ${Math.abs(rateChange).toFixed(1)}% compared to the previous period. Consider reviewing workload distribution.`,
        icon: rateChange > 0 ? 'trending_up' : 'trending_down',
        color: rateChange > 0 ? '#10b981' : '#ef4444'
      });
    }

    if (teamPerformance?.team_size > 0) {
      insights.push({
        title: 'Team Overview',
        description: `Your team of ${teamPerformance.team_size} members has an average productivity of ${Math.round(avgRate)}%. ${
          teamPerformance.most_productive_member ? `Top performer: ${teamPerformance.most_productive_member.user_name}.` : ''
        }`,
        icon: 'group',
        color: '#667eea'
      });
    }

    if (userProductivity?.overdue_tasks > 0) {
      insights.push({
        title: 'Overdue Tasks',
        description: `You have ${userProductivity.overdue_tasks} overdue task${userProductivity.overdue_tasks > 1 ? 's' : ''}. Prioritize these to stay on track.`,
        icon: 'schedule',
        color: '#ef4444'
      });
    }

    this.insights = insights;
  }

  onPeriodChange(): void {
    this.loadAnalyticsData();
  }

  getBarColor(value: number): string {
    if (value >= 80) return '#10b981';
    if (value >= 60) return '#667eea';
    if (value >= 40) return '#f59e0b';
    return '#ef4444';
  }

  getProgressColor(progress: number): 'primary' | 'accent' | 'warn' {
    if (progress >= 80) return 'primary';
    if (progress >= 50) return 'accent';
    return 'warn';
  }

  getProductivityColor(productivity: number): 'primary' | 'accent' | 'warn' {
    if (productivity >= 85) return 'primary';
    if (productivity >= 70) return 'accent';
    return 'warn';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}