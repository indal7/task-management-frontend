// src/app/features/sprints/sprint-management/sprint-management.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
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
  currentProjectId: number | null = null;

  // UI State
  isLoading = false;
  errorMessage: string | null = null;
  showCreateSprintModal = false;
  showEditSprintModal = false;
  selectedTabIndex = 0;
  backlogSearchTerm = '';
  createSprintError: string | null = null;
  editSprintError: string | null = null;

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
      const projectIdParam = params['projectId'];
      const projectId = Number(projectIdParam);

      if (Number.isInteger(projectId) && projectId > 0) {
        this.loadProjectData(projectId);
      } else {
        this.currentProjectId = null;
        this.project = null;
        this.errorMessage = null;
        this.loadAvailableProjects();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSprintForm(): FormGroup {
    return this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(3)]],
        description: [''],
        start_date: [null, Validators.required],
        end_date: [null, Validators.required],
        goal: ['']
      },
      { validators: this.dateRangeValidator }
    );
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
    this.currentProjectId = Number(projectId);
    this.router.navigate(['/sprints', projectId]);
  }

  private loadProjectData(projectId: number): void {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      this.errorMessage = 'Invalid project selected.';
      this.isLoading = false;
      return;
    }

    this.currentProjectId = Number(projectId);
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
        this.findCurrentSprint();
        this.processSprintTasks(Array.isArray(data.tasks) ? data.tasks : []);
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
    const activeSprint = this.sprints.find(s => this.isSprintActive(s.status));
    const plannedSprint = this.sprints.find(s => this.isSprintPlanned(s.status));
    this.currentSprint = activeSprint || plannedSprint || null;
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
    this.createSprintError = null;
    this.createSprintForm.reset({
      name: '',
      description: '',
      start_date: null,
      end_date: null,
      goal: ''
    });
    this.showCreateSprintModal = true;
  }

  closeCreateSprintModal(): void {
    this.showCreateSprintModal = false;
    this.createSprintError = null;
  }

  createSprint(): void {
    const resolvedProjectId = this.getResolvedProjectId();

    if (!resolvedProjectId) {
      this.createSprintError = 'Select a project before creating a sprint.';
      return;
    }

    if (this.createSprintForm.invalid) {
      this.markFormGroupTouched(this.createSprintForm);
      this.createSprintError = 'Please fix the highlighted form errors before creating the sprint.';
      return;
    }

    const formData = this.createSprintForm.value;
    const sprintData = {
      name: formData.name,
      description: formData.description || undefined,
      project_id: Number(resolvedProjectId),
      start_date: this.toApiDate(formData.start_date),
      end_date: this.toApiDate(formData.end_date),
      goal: formData.goal || undefined
    };

    this.createSprintError = null;

    this.sprintService.createSprint(sprintData).subscribe({
      next: () => {
        this.closeCreateSprintModal();
        if (resolvedProjectId) {
          this.loadProjectData(resolvedProjectId);
        }
      },
      error: (error) => {
        this.createSprintError = this.getErrorMessage(error);
      }
    });
  }

  openEditSprintModal(sprint: Sprint): void {
    this.editingSprintId = sprint.id;
    this.editSprintError = null;
    this.editSprintForm.patchValue({
      name: sprint.name,
      description: sprint.description,
      start_date: this.toDateControlValue(sprint.start_date),
      end_date: this.toDateControlValue(sprint.end_date),
      goal: sprint.goal
    });
    this.showEditSprintModal = true;
  }

  closeEditSprintModal(): void {
    this.showEditSprintModal = false;
    this.editingSprintId = null;
    this.editSprintError = null;
  }

  updateSprint(): void {
    if (!this.editingSprintId) {
      this.editSprintError = 'No sprint selected for editing.';
      return;
    }

    if (this.editSprintForm.invalid) {
      this.markFormGroupTouched(this.editSprintForm);
      this.editSprintError = 'Please fix the highlighted form errors before updating the sprint.';
      return;
    }

    const formData = this.editSprintForm.value;
    const sprintData = {
      name: formData.name,
      description: formData.description || undefined,
      start_date: this.toApiDate(formData.start_date),
      end_date: this.toApiDate(formData.end_date),
      goal: formData.goal || undefined
    };

    this.editSprintError = null;

    this.sprintService.updateSprint(this.editingSprintId, sprintData).subscribe({
      next: () => {
        this.closeEditSprintModal();
        this.refreshData();
      },
      error: (error) => {
        this.editSprintError = this.getErrorMessage(error);
      }
    });
  }

  startSprint(sprint: Sprint): void {
    this.sprintService.startSprint(sprint.id).subscribe({
      next: () => {
        this.refreshData();
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  completeSprint(sprint: Sprint): void {
    this.sprintService.completeSprint(sprint.id).subscribe({
      next: () => {
        this.refreshData();
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  deleteSprint(sprint: Sprint): void {
    if (confirm(`Are you sure you want to delete "${sprint.name}"?`)) {
      this.sprintService.deleteSprint(sprint.id).subscribe({
        next: () => {
          this.refreshData();
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
        }
      });
    }
  }

  isSprintPlanned(status: string | undefined): boolean {
    return this.normalizeSprintStatus(status) === 'PLANNED';
  }

  isSprintActive(status: string | undefined): boolean {
    return this.normalizeSprintStatus(status) === 'ACTIVE';
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
    const resolvedProjectId = this.getResolvedProjectId();
    if (resolvedProjectId) {
      this.loadProjectData(resolvedProjectId);
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

  private normalizeSprintStatus(status: string | undefined): string {
    if (!status) {
      return '';
    }

    const normalizedStatus = status.toUpperCase();
    return normalizedStatus === 'PLANNING' ? 'PLANNED' : normalizedStatus;
  }

  private getResolvedProjectId(): number | null {
    const candidate =
      this.project?.id ??
      (this.project as any)?.project_id ??
      this.currentProjectId ??
      null;

    const parsedProjectId = Number(candidate);
    return Number.isInteger(parsedProjectId) && parsedProjectId > 0 ? parsedProjectId : null;
  }

  private toApiDate(value: string | Date | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const parsedDate = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return undefined;
    }

    return parsedDate.toISOString().split('T')[0];
  }

  private toDateControlValue(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('start_date')?.value;
    const endDate = control.get('end_date')?.value;

    if (!startDate || !endDate) {
      return null;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { invalidDate: true };
    }

    return start <= end ? null : { dateRange: true };
  }

  private markFormGroupTouched(form: FormGroup): void {
    form.markAllAsTouched();
    form.updateValueAndValidity();
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