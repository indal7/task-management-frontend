// src/app/features/reports/reports.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  AnalyticsService, 
  TaskCompletionRate, 
  UserPerformance,
  TaskDistribution
} from '../../core/services/analytics.service';
import { AuthService, UserListItem } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { ProjectAnalytics } from '../../core/models';


// Interface to match your HTML template expectations
interface ReportData {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number;
}

interface ProjectReportDisplay {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  status: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  // Properties that match your HTML template
  reportData: ReportData = {
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    averageCompletionTime: 0
  };

  projectReports: ProjectReportDisplay[] = [];
  
  // API response data
  private taskCompletionData: TaskCompletionRate | null = null;
  private userProductivityData: UserPerformance | null = null;
  private taskStatusData: TaskDistribution | null = null;
  private taskPriorityData: TaskDistribution | null = null;
  
  // UI state
  loading = false;
  selectedPeriod = 'month';
  error: string | null = null;

  constructor(
    private analyticsService: AnalyticsService,
    private authService: AuthService,
    private projectService: ProjectService
  ) {}

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.loading = true;
    this.error = null;

    // Load task completion data
    this.analyticsService.getTaskCompletionRate(this.selectedPeriod).subscribe({
      next: (data) => {
        this.taskCompletionData = data;
        // console.log('Task Completion Data:', this.taskCompletionData);
        this.updateReportData();
      },
      error: (err) => {
        this.error = 'Failed to load task completion data';
        this.loading = false;
        console.error('Error loading task completion data:', err);
      }
    });

    // Load user productivity data
    this.analyticsService.getUserProductivity().subscribe({
      next: (data) => {
        this.userProductivityData = data;
        this.updateReportData();
      },
      error: (err) => {
        console.error('Error loading user productivity data:', err);
      }
    });

    // Load task status distribution
    this.analyticsService.getTaskStatusDistribution().subscribe({
      next: (data) => {
        this.taskStatusData = data;
        this.updateReportData();
      },
      error: (err) => {
        console.error('Error loading task status data:', err);
      }
    });

    // Simulate project reports (since your API doesn't have this endpoint)
    this.loadProjectReports();
  }

  private updateReportData() {
    if (this.taskCompletionData) {
      this.reportData = {
        totalTasks: this.taskCompletionData.total_tasks,
        completedTasks: this.taskCompletionData.completed_tasks,
        pendingTasks: this.taskCompletionData.pending_tasks,
        overdueTasks: this.userProductivityData?.overdue_tasks || 0,
        completionRate: Math.round(this.taskCompletionData.completion_rate),
        averageCompletionTime: this.userProductivityData?.average_completion_time_days || 0
      };
    }

    this.loading = false;
  }

private loadProjectReports() {
  this.loading = true;

  forkJoin({
    analytics: this.analyticsService.getProjectAnalytics().pipe(catchError(() => of([]))),
    projects: this.projectService.getProjects().pipe(catchError(() => of({ success: true, message: '', data: [], pagination: { page: 1, per_page: 0, total: 0, pages: 0, has_prev: false, has_next: false, prev_num: null, next_num: null } })))
  }).subscribe({
    next: ({ analytics, projects }) => {
      const projectStatusMap: { [id: number]: string } = {};
      for (const p of projects.data) {
        projectStatusMap[p.id] = p.status;
      }

      this.projectReports = (analytics as ProjectAnalytics[]).map((p: ProjectAnalytics) => ({
        id: String(p.project_id),
        name: p.project_name,
        totalTasks: p.total_tasks,
        completedTasks: p.completed_tasks,
        completionRate: Math.round(p.completion_rate),
        status: projectStatusMap[p.project_id] || 'ACTIVE'
      }));

      this.loading = false;
    },
    error: () => {
      this.loading = false;
    }
  });
}



  onPeriodChange() {
    this.loadReports();
  }

  exportReport() {
    // console.log('Exporting report...');
    // Implement export functionality here
    // You can generate PDF, Excel, or CSV
  }

  // Methods used in your HTML template
  getPercentage(type: string): number {
    if (this.reportData.totalTasks === 0) return 0;
    
    switch (type) {
      case 'completed':
        return (this.reportData.completedTasks / this.reportData.totalTasks) * 100;
      case 'pending':
        return (this.reportData.pendingTasks / this.reportData.totalTasks) * 100;
      case 'overdue':
        return (this.reportData.overdueTasks / this.reportData.totalTasks) * 100;
      default:
        return 0;
    }
  }

  getTasksPerDay(): number {
    // Calculate based on completion rate and average time
    if (this.reportData.averageCompletionTime === 0) return 0;
    return Math.round((1 / this.reportData.averageCompletionTime) * 10) / 10;
  }

  getProductivityScore(): number {
    // Calculate productivity score based on completion rate and efficiency
    const completionScore = this.reportData.completionRate;
    const efficiencyScore = this.reportData.averageCompletionTime > 0 ? 
      Math.max(0, 100 - (this.reportData.averageCompletionTime * 10)) : 0;
    
    return Math.round((completionScore + efficiencyScore) / 2);
  }

  getTeamEfficiency(): number {
    // Calculate team efficiency based on overdue tasks ratio
    if (this.reportData.totalTasks === 0) return 100;
    
    const overdueRatio = this.reportData.overdueTasks / this.reportData.totalTasks;
    return Math.round(Math.max(0, (1 - overdueRatio) * 100));
  }

  // Additional helper methods if needed
  refreshReports() {
    this.loadReports();
  }
}