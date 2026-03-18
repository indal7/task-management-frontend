import { Component, OnInit, OnDestroy, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TaskService } from '../../../core/services/task.service';
import { AuthService, UserListItem } from '../../../core/services/auth.service';
import { ProjectService } from '../../../core/services/project.service';
import { SprintService } from '../../../core/services/sprint.service';
import { EnumService } from '../../../core/services/enum.service';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '../../../core/models/task.model';
import { Project } from '../../../core/models/project.model';
import { Sprint } from '../../../core/models/sprint.model';

@Component({
  selector: 'app-task-form',
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.scss']
})
export class TaskFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  taskForm!: FormGroup;
  task: Task | null = null;
  taskId: number | null = null;
  users: UserListItem[] = [];
  projects: Project[] = [];
  sprints: Sprint[] = [];
  
  submitted = false;
  isEditMode = false;
  isLoading = false;
  errorMessage = '';
  @Input() dialogMode = false;
  @Output() taskSaved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  // 🔧 FIXED: Use API-compliant enum values
  priorityOptions: any[] = [];
  statusOptions: any[] = [];
  taskTypeOptions: any[] = [];
  estimationUnitOptions: any[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService,
    private authService: AuthService,
    private projectService: ProjectService,
    private sprintService: SprintService,
    private enumService: EnumService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadFormData();
    this.checkEditMode();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkEditMode(): void {
    // console.log('Checking edit mode...', this.route.snapshot.paramMap);
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      // console.log('Edit mode for task ID:', id);
      this.taskId = parseInt(id, 10);
      this.isEditMode = true;
      this.loadTask();
    }
  }

  // 🔧 FIXED: Load all required form data
  private loadFormData(): void {
    // Load dropdown options from EnumService
    this.loadEnumOptions();
    
    // Load users for assignment
    this.loadUsers();
    
    // Load projects
    this.loadProjects();
  }

  private loadEnumOptions(): void {
    // Load enum options
    this.priorityOptions = this.enumService.getTaskPriorityOptions();
    this.statusOptions = this.enumService.getTaskStatusOptions();
    this.taskTypeOptions = this.enumService.getTaskTypeOptions();
    // console.log('Task Type Options:', this.taskTypeOptions);
    this.estimationUnitOptions = this.enumService.getEstimationUnitOptions();

    // If enums are not loaded yet, try loading them
    if (this.priorityOptions.length === 0) {
      this.enumService.loadAllEnums()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.priorityOptions = this.enumService.getTaskPriorityOptions();
            this.statusOptions = this.enumService.getTaskStatusOptions();
            this.taskTypeOptions = this.enumService.getTaskTypeOptions();
            // console.log('Task Type Options after loading:', this.taskTypeOptions);
            this.estimationUnitOptions = this.enumService.getEstimationUnitOptions();
          },
          error: (error) => {
            console.error('Error loading enums:', error);
            // Fallback options
            this.setFallbackOptions();
          }
        });
    }
  }

  private setFallbackOptions(): void {
    this.priorityOptions = [
      { value: 'LOW', label: 'Low' },
      { value: 'MEDIUM', label: 'Medium' },
      { value: 'HIGH', label: 'High' },
      { value: 'CRITICAL', label: 'Critical' }
    ];

    this.statusOptions = [
      { value: 'BACKLOG', label: 'Backlog' },
      { value: 'TODO', label: 'To Do' },
      { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'IN_REVIEW', label: 'In Review' },
      { value: 'TESTING', label: 'Testing' },
      { value: 'DONE', label: 'Done' },
      { value: 'BLOCKED', label: 'Blocked' },
      { value: 'CANCELLED', label: 'Cancelled' }
    ];

    this.taskTypeOptions = [
      { value: 'FEATURE', label: 'Feature' },
      { value: 'BUG', label: 'Bug' },
      { value: 'ENHANCEMENT', label: 'Enhancement' },
      { value: 'REFACTOR', label: 'Refactor' },
      { value: 'DOCUMENTATION', label: 'Documentation' },
      { value: 'TESTING', label: 'Testing' },
      { value: 'MAINTENANCE', label: 'Maintenance' }
    ];

    this.estimationUnitOptions = [
      { value: 'HOURS', label: 'Hours' },
      { value: 'DAYS', label: 'Days' },
      { value: 'STORY_POINTS', label: 'Story Points' }
    ];
  }

  private loadUsers(): void {
    this.authService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
        },
        error: (error) => {
          console.error('Error loading users:', error);
        }
      });
  }

  private loadProjects(): void {
    this.projectService.getProjects({ page: 1, per_page: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.projects = response.data || [];
        },
        error: (error) => {
          console.error('Error loading projects:', error);
        }
      });
  }

  private loadSprints(projectId: number): void {
    // console.log('Loading sprints for project:', projectId);
    if (!projectId) {
      this.sprints = [];
      return;
    }

    this.sprintService.getSprintsByProject(projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sprints) => {
          this.sprints = sprints;
        },
        error: (error) => {
          console.error('Error loading sprints:', error);
          this.sprints = [];
        }
      });
  }

  private loadTask(): void {
    if (!this.taskId) return;

    this.isLoading = true;
    this.taskService.getTaskById(this.taskId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (task) => {
          this.task = task;
          this.populateForm();
          this.isLoading = false;
          
          // Load sprints for selected project
          if (task.project?.id) {
            this.loadSprints(task.project.id);
          }
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
          this.isLoading = false;
        }
      });
  }

  get f() { 
    return this.taskForm.controls; 
  }

  get subtasks(): FormArray {
    return this.taskForm.get('subtasks') as FormArray;
  }

  // 🔧 FIXED: Complete form with all API fields
  private initForm(): void {
    this.taskForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      priority: ['MEDIUM'],
      task_type: ['FEATURE'],
      status: [{ value: 'BACKLOG', disabled: !this.isEditMode }],
      project_id: [null],
      sprint_id: [null],
      assigneeId: [null],
      due_date: [null],
      start_date: [null],
      estimated_hours: [null, [Validators.min(0.1)]],
      story_points: [null, [Validators.min(1)]],
      estimation_unit: ['HOURS'],
      labels: [''],
      acceptance_criteria: [''],
      parent_task_id: [null]
    });

    // Watch for project changes to load sprints
    this.taskForm.get('project_id')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(projectId => {
        // console.log('Project changed:', projectId);
        if (projectId) {
          this.loadSprints(projectId);
        } else {
          this.sprints = [];
        }
        // Clear sprint selection when project changes
        this.taskForm.patchValue({ sprint_id: null });
      });
  }

  private populateForm(): void {
    if (!this.task) return;

    this.taskForm.patchValue({
      title: this.task.title,
      description: this.task.description || '',
      priority: this.task.priority,
      task_type: this.task.task_type,
      status: this.task.status,
      project_id: this.task.project?.id || null,
      sprint_id: this.task.sprint?.id || null,
      assigneeId: this.task.assigned_to?.id || null,
      due_date: this.formatDateForInput(this.task.due_date || null),
      start_date: this.formatDateForInput(this.task.start_date || null),
      estimated_hours: this.task.estimated_hours,
      story_points: this.task.story_points,
      estimation_unit: this.task.estimation_unit || 'HOURS',
      labels: Array.isArray(this.task.labels) ? this.task.labels.join(', ') : '',
      acceptance_criteria: this.task.acceptance_criteria || '',
      parent_task_id: this.task.parent_task_id
    });

    // Enable status field for edit mode
    if (this.isEditMode) {
      this.taskForm.get('status')?.enable();
    }
  }

  private formatDateForInput(date: string | Date | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.taskForm.invalid) {
      this.markFormGroupTouched(this.taskForm);
      return;
    }

    this.isLoading = true;
    const formValue = this.taskForm.value;

    // 🔧 FIXED: Prepare API-compliant payload
    const taskData: CreateTaskRequest | UpdateTaskRequest = {
      title: formValue.title.trim(),
      description: formValue.description?.trim() || '',
      priority: formValue.priority,
      task_type: formValue.task_type,
    project_id: formValue.project_id ? Number(formValue.project_id) : undefined,
    sprint_id: formValue.sprint_id ? Number(formValue.sprint_id) : undefined,
    assigned_to_id: formValue.assigneeId ? Number(formValue.assigneeId) : undefined,
    due_date: formValue.due_date ? new Date(formValue.due_date).toISOString() : undefined,
    start_date: formValue.start_date ? new Date(formValue.start_date).toISOString() : undefined,
    estimated_hours: formValue.estimated_hours ? Number(formValue.estimated_hours) : undefined,
    story_points: formValue.story_points ? Number(formValue.story_points) : undefined,
      estimation_unit: formValue.estimation_unit,
      labels: formValue.labels ? 
        formValue.labels.split(',').map((label: string) => label.trim()).filter((label: string) => label) : 
        [],
      acceptance_criteria: formValue.acceptance_criteria?.trim() || '',
      parent_task_id: formValue.parent_task_id ? Number(formValue.parent_task_id) : undefined
    };

    // Add status for updates
    if (this.isEditMode) {
      (taskData as UpdateTaskRequest).status = formValue.status;
    }

    const apiCall = this.isEditMode && this.taskId
      ? this.taskService.updateTask(this.taskId, taskData as UpdateTaskRequest)
      : this.taskService.createTask(taskData as CreateTaskRequest);

    apiCall
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          // console.log('Task saved successfully:', response);
          if (this.dialogMode) {
            this.taskSaved.emit();
            return;
          }
          // Navigate back to task list
          this.router.navigate(['/tasks']);
        },      
        error: (error) => {
          this.isLoading = false;
          console.error('Error saving task:', error);
          this.errorMessage = this.getErrorMessage(error);
        }
      });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  onCancel(): void {
    if (this.dialogMode) {
      this.cancelled.emit();
      return;
    }

    if (this.isEditMode && this.taskId) {
      this.router.navigate(['/tasks', this.taskId]);
    } else {
      this.router.navigate(['/tasks']);
    }
  }

  // 🔧 IMPROVED: Better error handling
  private getErrorMessage(error: any): string {
    // Handle new standardized error format
    if (error?.error?.success === false) {
      return error.error.message || 'Failed to save task';
    }
    
    // Handle validation errors
    if (error?.status === 422) {
      return 'Validation failed. Please check your input and try again.';
    }
    
    // Handle legacy error format
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    return 'Failed to save task. Please try again.';
  }

  // Helper methods for the template
  getProjectName(projectId: number): string {
    const project = this.projects.find(p => p.id === projectId);
    return project?.name || '';
  }

  getSprintName(sprintId: number): string {
    const sprint = this.sprints.find(s => s.id === sprintId);
    return sprint?.name || '';
  }

  getUserName(userId: number): string {
    const user = this.users.find(u => u.id === userId);
    return user?.name || '';
  }

  // Quick actions
  assignToMe(): void {
    const currentUser = this.authService.getCurrentUserValue();
    if (currentUser) {
      this.taskForm.patchValue({ assigneeId: currentUser.id });
    }
  }

  setTodayAsStartDate(): void {
    const today = new Date();
    this.taskForm.patchValue({ start_date: this.formatDateForInput(today) });
  }

  setDueDateNextWeek(): void {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    this.taskForm.patchValue({ due_date: this.formatDateForInput(nextWeek) });
  }
}