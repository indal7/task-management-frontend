// src/app/features/sprints/sprint-management/sprint-management.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

// Updated imports to match your models
import { Task } from '../../../core/models/task.model';
import { Project } from '../../../core/models/project.model';
import { User } from '../../../core/models/user.model';
import { Sprint, BurndownData, SprintBurndown } from '../../../core/models/sprint.model';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { SprintService } from '../../../core/services/sprint.service';
import { AuthService } from '../../../core/services/auth.service';

// Enhanced SprintTask interface to match your needs
export interface SprintTask extends Task {
  story_points?: number;
  sprint_id?: number | null;
  in_sprint?: boolean;
}

@Component({
  selector: 'app-sprint-management',
  templateUrl: './sprint-management.component.html',
  styleUrls: ['./sprint-management.component.scss']
})
export class SprintManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  project: Project | null = null;
  currentSprint: Sprint | null = null;
  sprints: Sprint[] = [];
  sprintTasks: SprintTask[] = [];
  backlogTasks: SprintTask[] = [];
  filteredBacklogTasks: SprintTask[] = [];
  burndownData: BurndownData[] = [];
  currentUser: User | null = null;
  availableProjects: Project[] = [];

  // UI State
  isLoading = false;
  errorMessage: string | null = null;
  showCreateSprintModal = false;
  showEditSprintModal = false;
  selectedTabIndex = 0;
  backlogSearchTerm = '';

  // Forms
  createSprintForm: FormGroup;
  editSprintForm: FormGroup;
  editingSprintId: number | null = null;

  // Sprint Board Columns - Updated status names
  sprintColumns = [
    { status: 'BACKLOG', title: 'Sprint Backlog', limit: null },
    { status: 'TODO', title: 'To Do', limit: 5 },
    { status: 'IN_PROGRESS', title: 'In Progress', limit: 3 },
    { status: 'IN_REVIEW', title: 'In Review', limit: 3 },
    { status: 'TESTING', title: 'Testing', limit: 2 },
    { status: 'DONE', title: 'Done', limit: null }
  ];

  get sprintColumnIds(): string[] {
    return this.sprintColumns.map(c => c.status);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private taskService: TaskService,
    private projectService: ProjectService,
    private sprintService: SprintService,
    private authService: AuthService
  ) {
    this.createSprintForm = this.initializeSprintForm();
    this.editSprintForm = this.initializeSprintForm();
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser = user;
    });

    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const projectId = params['projectId'];
      if (projectId) {
        this.loadProjectData(parseInt(projectId));
      } else {
        this.loadAvailableProjects();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSprintForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      start_date: [''],
      end_date: [''],
      goal: ['']
    });
  }

  private loadAvailableProjects(): void {
    this.projectService.getProjects().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.availableProjects = (response as any).data || (Array.isArray(response) ? response : []);
      },
      error: (error) => {
        console.error('Failed to load projects:', error);
      }
    });
  }

  onProjectSelect(projectId: number): void {
    this.router.navigate(['/sprints', projectId]);
  }

  private loadProjectData(projectId: number): void {
    this.isLoading = true;
    this.errorMessage = null;

    forkJoin({
      project: this.projectService.getProjectById(projectId),
      sprints: this.sprintService.getSprintsByProject(projectId),
      tasks: this.taskService.getAllTasks({ project_id: projectId })
    }).subscribe({
      next: (data: any) => {
        this.project = data.project;
        this.sprints = data.sprints || [];
        this.processSprintTasks(Array.isArray(data.tasks) ? data.tasks : []);
        this.findCurrentSprint();
        this.loadBurndownData();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
        this.isLoading = false;
      }
    });
  }

  private processSprintTasks(tasks: Task[]): void {
    this.sprintTasks = [];
    this.backlogTasks = [];

    tasks.forEach(task => {
      const sprintTask: SprintTask = {
        ...task,
        story_points: (task as any).story_points || 0,
        sprint_id: (task as any).sprint_id || null,
        in_sprint: !!(task as any).sprint_id
      };

      if (sprintTask.sprint_id === this.currentSprint?.id) {
        this.sprintTasks.push(sprintTask);
      } else if (!sprintTask.sprint_id) {
        this.backlogTasks.push(sprintTask);
      }
    });

    this.filteredBacklogTasks = [...this.backlogTasks];
  }

  private findCurrentSprint(): void {
    this.currentSprint = this.sprints.find(s => s.status === 'ACTIVE') || null;
  }

  private loadBurndownData(): void {
    if (!this.currentSprint) {
      this.burndownData = [];
      return;
    }

    this.sprintService.getSprintBurndown(this.currentSprint.id).subscribe({
      next: (burndown: SprintBurndown) => {
        this.burndownData = burndown.burndown_data || [];
      },
      error: (error) => {
        console.warn('Could not load burndown data:', error);
        this.generateMockBurndownData();
      }
    });
  }

  private generateMockBurndownData(): void {
    if (!this.currentSprint) return;

    const startDate = new Date(this.currentSprint.start_date || Date.now());
    const endDate = new Date(this.currentSprint.end_date || Date.now());
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalPoints = this.currentSprint.total_story_points || 0;

    this.burndownData = [];
    
    for (let i = 0; i <= totalDays; i++) {
      const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const idealRemaining = Math.max(0, totalPoints - (totalPoints / totalDays) * i);
      const actualProgress = Math.min(i / totalDays + (Math.random() - 0.5) * 0.2, 1);
      const actualRemaining = Math.max(0, totalPoints * (1 - actualProgress));

      this.burndownData.push({
        date: currentDate.toISOString().split('T')[0],
        remaining_story_points: Math.round(actualRemaining),
        ideal_remaining_story_points: Math.round(idealRemaining),
        completed_story_points: Math.round(totalPoints - actualRemaining),
        remaining_hours: Math.round(actualRemaining * 2), // Mock hours
        ideal_remaining_hours: Math.round(idealRemaining * 2),
        completed_hours: Math.round((totalPoints - actualRemaining) * 2)
      });
    }
  }

  // Updated helper methods to work with new model structure
  getSprintProgress(sprint: Sprint): number {
    if (!sprint.total_story_points) return 0;
    return Math.round((sprint.completed_story_points / sprint.total_story_points) * 100);
  }

  getDaysRemaining(endDate: string | undefined): number {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  getTasksByStatus(status: string): SprintTask[] {
    return this.sprintTasks.filter(task => task.status === status);
  }

  // Task Management
  onTaskDrop(event: CdkDragDrop<SprintTask[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update task status
      const task = event.container.data[event.currentIndex];
      const newStatus = event.container.id;
      this.moveTaskToColumn(task.id, newStatus);
    }
  }

  moveTaskToColumn(taskId: number, newStatus: string): void {
    const task = this.sprintTasks.find(t => t.id === taskId);
    if (task) {
      const updateData = { status: newStatus };
      
      this.taskService.updateTask(taskId, updateData).subscribe({
        next: (updatedTask) => {
          task.status = updatedTask.status;
          this.updateSprintStats();
        },
        error: (error) => {
          console.error('Failed to update task status:', error);
          // Revert the UI change
          this.loadProjectData(this.project?.id || 0);
        }
      });
    }
  }

  addTaskToSprint(task: SprintTask): void {
    if (!this.currentSprint) return;

    this.sprintService.addTaskToSprint(this.currentSprint.id, task.id).subscribe({
      next: () => {
        // Move task from backlog to sprint
        const index = this.backlogTasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
          const sprintTask = { ...this.backlogTasks[index], sprint_id: this.currentSprint!.id, in_sprint: true };
          this.sprintTasks.push(sprintTask);
          this.backlogTasks.splice(index, 1);
          this.filterBacklogTasks();
          this.updateSprintStats();
        }
      },
      error: (error) => {
        console.error('Failed to add task to sprint:', error);
      }
    });
  }

  removeTaskFromSprint(task: SprintTask): void {
    if (!this.currentSprint) return;

    this.sprintService.removeTaskFromSprint(this.currentSprint.id, task.id).subscribe({
      next: () => {
        // Move task from sprint to backlog
        const index = this.sprintTasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
          const backlogTask = { ...this.sprintTasks[index], sprint_id: null, in_sprint: false };
          this.backlogTasks.push(backlogTask);
          this.sprintTasks.splice(index, 1);
          this.filterBacklogTasks();
          this.updateSprintStats();
        }
      },
      error: (error) => {
        console.error('Failed to remove task from sprint:', error);
      }
    });
  }

  // Sprint Management
  openCreateSprintModal(): void {
    this.createSprintForm.reset();
    this.showCreateSprintModal = true;
  }

  closeCreateSprintModal(): void {
    this.showCreateSprintModal = false;
  }

  createSprint(): void {
    if (this.createSprintForm.invalid || !this.project) return;

    const formData = this.createSprintForm.value;
    const sprintData = {
      ...formData,
      project_id: this.project.id
    };

    this.sprintService.createSprint(sprintData).subscribe({
      next: (sprint) => {
        this.sprints.unshift(sprint);
        this.closeCreateSprintModal();
        // If this is the first sprint, make it current
        if (!this.currentSprint && sprint.status === 'ACTIVE') {
          this.currentSprint = sprint;
        }
      },
      error: (error) => {
        console.error('Failed to create sprint:', error);
      }
    });
  }

  openEditSprintModal(sprint: Sprint): void {
    this.editingSprintId = sprint.id;
    this.editSprintForm.patchValue({
      name: sprint.name,
      description: sprint.description,
      start_date: sprint.start_date,
      end_date: sprint.end_date,
      goal: sprint.goal
    });
    this.showEditSprintModal = true;
  }

  closeEditSprintModal(): void {
    this.showEditSprintModal = false;
    this.editingSprintId = null;
  }

  updateSprint(): void {
    if (this.editSprintForm.invalid || !this.editingSprintId) return;

    const formData = this.editSprintForm.value;
    
    this.sprintService.updateSprint(this.editingSprintId, formData).subscribe({
      next: (updatedSprint) => {
        const index = this.sprints.findIndex(s => s.id === this.editingSprintId);
        if (index !== -1) {
          this.sprints[index] = updatedSprint;
          if (this.currentSprint?.id === this.editingSprintId) {
            this.currentSprint = updatedSprint;
          }
        }
        this.closeEditSprintModal();
      },
      error: (error) => {
        console.error('Failed to update sprint:', error);
      }
    });
  }

  startSprint(sprint: Sprint): void {
    this.sprintService.startSprint(sprint.id).subscribe({
      next: (updatedSprint) => {
        const index = this.sprints.findIndex(s => s.id === sprint.id);
        if (index !== -1) {
          this.sprints[index] = updatedSprint;
        }
        // Set as current sprint if it's now active
        if (updatedSprint.status === 'ACTIVE') {
          this.currentSprint = updatedSprint;
        }
      },
      error: (error) => {
        console.error('Failed to start sprint:', error);
      }
    });
  }

  completeSprint(sprint: Sprint): void {
    this.sprintService.completeSprint(sprint.id).subscribe({
      next: (updatedSprint) => {
        const index = this.sprints.findIndex(s => s.id === sprint.id);
        if (index !== -1) {
          this.sprints[index] = updatedSprint;
        }
        // Clear current sprint if it was completed
        if (this.currentSprint?.id === sprint.id) {
          this.currentSprint = null;
          this.findCurrentSprint(); // Look for another active sprint
        }
      },
      error: (error) => {
        console.error('Failed to complete sprint:', error);
      }
    });
  }

  deleteSprint(sprint: Sprint): void {
    if (confirm(`Are you sure you want to delete "${sprint.name}"?`)) {
      this.sprintService.deleteSprint(sprint.id).subscribe({
        next: () => {
          this.sprints = this.sprints.filter(s => s.id !== sprint.id);
          if (this.currentSprint?.id === sprint.id) {
            this.currentSprint = null;
            this.findCurrentSprint();
          }
        },
        error: (error) => {
          console.error('Failed to delete sprint:', error);
        }
      });
    }
  }

  // UI Helper Methods
  filterBacklogTasks(): void {
    if (!this.backlogSearchTerm.trim()) {
      this.filteredBacklogTasks = [...this.backlogTasks];
    } else {
      const searchTerm = this.backlogSearchTerm.toLowerCase();
      this.filteredBacklogTasks = this.backlogTasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm) ||
        task.description?.toLowerCase().includes(searchTerm)
      );
    }
  }

  truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  formatDateRange(startDate?: string, endDate?: string): string {
    if (!startDate || !endDate) return 'No dates set';
    
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  }

  onTabChange(event: any): void {
    this.selectedTabIndex = event.index;
  }

  refreshData(): void {
    if (this.project) {
      this.loadProjectData(this.project.id);
    }
  }

  editTask(task: SprintTask): void {
    // Navigate to task edit or open task modal
    // console.log('Edit task:', task);
  }

  editSprint(sprint: Sprint): void {
    this.openEditSprintModal(sprint);
  }

  private updateSprintStats(): void {
    if (!this.currentSprint) return;

    // Recalculate sprint statistics
    const totalTasks = this.sprintTasks.length;
    const completedTasks = this.sprintTasks.filter(t => t.status === 'DONE').length;
    const totalPoints = this.sprintTasks.reduce((sum, task) => sum + (task.story_points || 0), 0);
    const completedPoints = this.sprintTasks
      .filter(t => t.status === 'DONE')
      .reduce((sum, task) => sum + (task.story_points || 0), 0);

    // Update current sprint object
    this.currentSprint.tasks_count = totalTasks;
    this.currentSprint.completed_tasks_count = completedTasks;
    this.currentSprint.total_story_points = totalPoints;
    this.currentSprint.completed_story_points = completedPoints;
  }

  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}