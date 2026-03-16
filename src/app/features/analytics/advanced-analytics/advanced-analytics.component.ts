// src/app/features/analytics/advanced-analytics/advanced-analytics.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';

// Register Chart.js components
Chart.register(...registerables);

export interface AnalyticsData {
  taskCompletion: any;
  userProductivity: any;
  statusDistribution: any;
  priorityDistribution: any;
  timeTracking: any;
  projectProgress: any;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  tasksCompleted: number;
  averageCompletionTime: number;
  productivity: number;
  currentTasks: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  progress: number;
  tasksCount: number;
  completedTasks: number;
  overdueTasks: number;
  teamSize: number;
  status: string;
}

@Component({
  selector: 'app-advanced-analytics',
  templateUrl: './advanced-analytics.component.html',
  styleUrls: ['./advanced-analytics.component.scss']
})
export class AdvancedAnalyticsComponent implements OnInit, OnDestroy {
  @ViewChild('burndownChart', { static: true }) burndownChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('velocityChart', { static: true }) velocityChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('workloadChart', { static: true }) workloadChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart', { static: true }) trendChartRef!: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();
  private charts: Chart[] = [];

  // Data
  analyticsData: AnalyticsData | null = null;
  teamMembers: TeamMember[] = [];
  projectSummaries: ProjectSummary[] = [];
  private userProductivityList: any[] = [];
  
  // UI State
  isLoading = false;
  errorMessage: string | null = null;
  activeTab: 'overview' | 'productivity' | 'projects' | 'trends' = 'overview';
  selectedTimeframe = '30d';
  selectedProject = 'all';
  selectedTeamMember = 'all';

  // Forms
  filtersForm: FormGroup;

  // Filter Options
  timeframeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '3m', label: 'Last 3 months' },
    { value: '6m', label: 'Last 6 months' },
    { value: '1y', label: 'Last year' }
  ];

  projects: any[] = [];
  users: any[] = [];

  // Summary Stats
  summaryStats = {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    averageCompletionTime: 0,
    teamProductivity: 0,
    projectsOnTrack: 0,
    upcomingDeadlines: 0
  };

  constructor(
    private fb: FormBuilder,
    private analyticsService: AnalyticsService,
    private taskService: TaskService,
    private projectService: ProjectService,
    private authService: AuthService
  ) {
    this.filtersForm = this.fb.group({
      timeframe: [this.selectedTimeframe],
      project: [this.selectedProject],
      teamMember: [this.selectedTeamMember]
    });
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
  }

  private setupFormSubscriptions(): void {
    this.filtersForm.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(values => {
      this.selectedTimeframe = values.timeframe;
      this.selectedProject = values.project;
      this.selectedTeamMember = values.teamMember;
      this.loadAnalyticsData();
    });
  }

  private loadInitialData(): void {
    this.isLoading = true;
    
    forkJoin({
      projects: this.projectService.getProjects(),
      users: this.authService.getUsers()
    }).subscribe({
      next: (data) => {
        const projectsResponse = data.projects as any;
        this.projects = projectsResponse.data || projectsResponse.results || (Array.isArray(projectsResponse) ? projectsResponse : []);
        this.users = data.users;
        this.loadAnalyticsData();
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }

  private loadAnalyticsData(): void {
    this.isLoading = true;
    this.errorMessage = null;

    forkJoin({
      taskCompletion: this.analyticsService.getTaskCompletionRate(this.selectedTimeframe),
      userProductivity: this.analyticsService.getUserProductivity(),
      userProductivityList: this.analyticsService.getUserProductivityAnalytics(),
      statusDistribution: this.analyticsService.getTaskStatusDistributionData(),
      priorityDistribution: this.analyticsService.getTaskPriorityDistribution()
    }).subscribe({
      next: (data) => {
        this.analyticsData = data as any;
        this.userProductivityList = Array.isArray(data.userProductivityList) ? data.userProductivityList : [];
        this.processSummaryStats();
        this.generateTeamMemberData();
        this.generateProjectSummaries();
        this.createCharts();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }

  private processSummaryStats(): void {
    if (!this.analyticsData) return;

    const { taskCompletion, statusDistribution, userProductivity } = this.analyticsData;

    this.summaryStats = {
      totalTasks: taskCompletion?.total_tasks || 0,
      completedTasks: taskCompletion?.completed_tasks || 0,
      inProgressTasks: taskCompletion?.in_progress_tasks || 0,
      overdueTasks: userProductivity?.overdue_tasks || 0,
      averageCompletionTime: userProductivity?.average_completion_time_days || 0,
      teamProductivity: this.calculateTeamProductivity(),
      projectsOnTrack: this.calculateProjectsOnTrack(),
      upcomingDeadlines: this.calculateUpcomingDeadlines()
    };
  }

  private generateTeamMemberData(): void {
    this.teamMembers = this.users.map((user) => {
      const productivity = this.userProductivityList.find(p => p.user_id === user.id);
      return {
        id: user.id,
        name: user.name,
        role: user.role || 'Developer',
        tasksCompleted: productivity?.completed_tasks || 0,
        averageCompletionTime: productivity ? Math.round(productivity.average_completion_time_hours / 24) : 0,
        productivity: productivity?.completion_rate || 0,
        currentTasks: productivity?.in_progress_tasks || 0
      };
    });
  }

  private generateProjectSummaries(): void {
    // Use real project data from API
    this.projectSummaries = this.projects.map(project => ({
      id: project.id,
      name: project.name,
      progress: project.tasks_count > 0
        ? Math.floor((project.completed_tasks_count / project.tasks_count) * 100)
        : 0,
      tasksCount: project.tasks_count || 0,
      completedTasks: project.completed_tasks_count || 0,
      overdueTasks: 0,
      teamSize: project.team_members ? project.team_members.length : 0,
      status: project.status
    }));
  }

  private createCharts(): void {
    this.destroyCharts();
    
    setTimeout(() => {
      this.createBurndownChart();
      this.createVelocityChart();
      this.createWorkloadChart();
      this.createTrendChart();
    }, 0);
  }

  private createBurndownChart(): void {
    const ctx = this.burndownChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Use real status distribution data instead of mock burndown
    const statusDistribution: any[] = this.analyticsData?.statusDistribution || [];
    const labels = statusDistribution.length > 0
      ? statusDistribution.map((d: any) => d.status || d.label || 'Unknown')
      : ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
    const counts = statusDistribution.length > 0
      ? statusDistribution.map((d: any) => d.count || 0)
      : [0, 0, 0, 0];

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Tasks by Status',
            data: counts,
            backgroundColor: [
              'rgba(156, 163, 175, 0.8)',
              'rgba(59, 130, 246, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(16, 185, 129, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              'rgba(139, 92, 246, 0.8)'
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Task Status Distribution' }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Number of Tasks' }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private createVelocityChart(): void {
    const ctx = this.velocityChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Use real priority distribution data
    const priorityDistribution: any[] = this.analyticsData?.priorityDistribution || [];
    const labels = priorityDistribution.length > 0
      ? priorityDistribution.map((d: any) => d.priority || d.label || 'Unknown')
      : ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const totals = priorityDistribution.length > 0
      ? priorityDistribution.map((d: any) => d.count || 0)
      : [0, 0, 0, 0];
    const completed = priorityDistribution.length > 0
      ? priorityDistribution.map((d: any) => d.completed_count || 0)
      : [0, 0, 0, 0];

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Total',
            data: totals,
            backgroundColor: 'rgba(156, 163, 175, 0.8)',
            borderColor: '#9ca3af',
            borderWidth: 1
          },
          {
            label: 'Completed',
            data: completed,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: '#3b82f6',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Tasks by Priority' }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Number of Tasks' }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private createWorkloadChart(): void {
    const ctx = this.workloadChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Use real project data for workload distribution
    const projectLabels = this.projectSummaries.slice(0, 6).map(p => p.name);
    const taskCounts = this.projectSummaries.slice(0, 6).map(p => p.tasksCount);

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: projectLabels.length > 0 ? projectLabels : ['No Projects'],
        datasets: [{
          data: taskCounts.length > 0 ? taskCounts : [1],
          backgroundColor: [
            '#ef4444',
            '#f97316',
            '#eab308',
            '#22c55e',
            '#06b6d4',
            '#8b5cf6'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          title: { display: true, text: 'Tasks per Project' }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private createTrendChart(): void {
    const ctx = this.trendChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Use real daily completion data from task analytics
    const dailyCompletion: any[] = this.analyticsData?.taskCompletion?.daily_completion || [];
    const labels = dailyCompletion.length > 0
      ? dailyCompletion.map((d: any) => d.date || '')
      : [];
    const completedData = dailyCompletion.map((d: any) => d.completed || 0);
    const createdData = dailyCompletion.map((d: any) => d.created || 0);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Tasks Completed',
            data: completedData.length > 0 ? completedData : [0],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4
          },
          {
            label: 'Tasks Created',
            data: createdData.length > 0 ? createdData : [0],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Task Creation vs Completion Trend' }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Number of Tasks' }
          }
        }
      }
    };

    this.charts.push(new Chart(ctx, config));
  }

  private destroyCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  // Tab Management
  setActiveTab(tab: 'overview' | 'productivity' | 'projects' | 'trends'): void {
    this.activeTab = tab;
    
    // Recreate charts when switching tabs to ensure proper rendering
    if (tab !== 'overview') {
      setTimeout(() => this.createCharts(), 100);
    }
  }

  // Export Functions
  exportReport(format: 'pdf' | 'excel' | 'csv'): void {
    // Mock export function - implement actual export logic
    console.log(`Exporting report as ${format}`);
    
    // In a real implementation, you would:
    // 1. Gather all current data
    // 2. Format it according to the selected format
    // 3. Generate and download the file
    
    const data = {
      summaryStats: this.summaryStats,
      teamMembers: this.teamMembers,
      projectSummaries: this.projectSummaries,
      timeframe: this.selectedTimeframe,
      generatedAt: new Date().toISOString()
    };
    
    switch (format) {
      case 'pdf':
        this.generatePDFReport(data);
        break;
      case 'excel':
        this.generateExcelReport(data);
        break;
      case 'csv':
        this.generateCSVReport(data);
        break;
    }
  }

  private generatePDFReport(data: any): void {
    // Mock PDF generation
    console.log('Generating PDF report with data:', data);
    // Use libraries like jsPDF or pdfmake
  }

  private generateExcelReport(data: any): void {
    // Mock Excel generation
    console.log('Generating Excel report with data:', data);
    // Use libraries like xlsx or exceljs
  }

  private generateCSVReport(data: any): void {
    // Mock CSV generation
    console.log('Generating CSV report with data:', data);
    // Convert data to CSV format and download
  }

  // Helper Methods
  private calculateTeamProductivity(): number {
    if (!this.analyticsData?.userProductivity) return 0;
    return this.analyticsData.userProductivity.productivity_score || 0;
  }

  private calculateProjectsOnTrack(): number {
    return this.projectSummaries.filter(project =>
      project.progress >= 75 && project.overdueTasks < 3
    ).length;
  }

  private calculateUpcomingDeadlines(): number {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return this.projectSummaries.filter(project => {
      const projectData = this.projects.find(p => p.id === project.id);
      if (!projectData?.end_date) return false;
      const endDate = new Date(projectData.end_date);
      return endDate >= now && endDate <= sevenDaysFromNow;
    }).length;
  }

  getProductivityColor(productivity: number): string {
    if (productivity >= 90) return '#10b981'; // green
    if (productivity >= 75) return '#3b82f6'; // blue
    if (productivity >= 60) return '#f59e0b'; // orange
    return '#ef4444'; // red
  }

  getProjectStatusColor(status: string): string {
    const colors: {[key: string]: string} = {
      'ACTIVE': '#10b981',
      'PLANNING': '#6b7280',
      'ON_HOLD': '#f59e0b',
      'COMPLETED': '#3b82f6',
      'CANCELLED': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  refreshData(): void {
    this.loadAnalyticsData();
  }

  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return 'An unexpected error occurred while loading analytics data';
  }
}