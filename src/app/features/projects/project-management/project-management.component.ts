// src/app/features/projects/project-management/project-management.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Project } from '../../../core/models/project.model';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService, UserListItem } from '../../../core/services/auth.service';
import { parseApiDate, formatDateIST } from '../../../core/utils/date-time.util';

export interface ProjectWithStats extends Project {
  progress: number;
  tasksCount: {
    total: number;
    completed: number;
    pending: number;
    in_progress: number;
  };
  teamMembers: UserListItem[];
  isOverdue?: boolean;
  daysUntilDeadline?: number;
}

@Component({
  selector: 'app-project-management',
  templateUrl: './project-management.component.html',
  styleUrls: ['./project-management.component.scss']
})
export class ProjectManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // Data
  projects: ProjectWithStats[] = [];
  filteredProjects: ProjectWithStats[] = [];
  currentUser: UserListItem | null = null;
  allUsers: UserListItem[] = [];

  // UI State
  isLoading = false;
  errorMessage: string | null = null;
  viewMode: 'grid' | 'list' | 'kanban' = 'grid';
  showCreateModal = false;
  showEditModal = false;
  selectedProject: ProjectWithStats | null = null;
  openProjectMenuId: number | null = null;

  // Filters
  searchTerm = '';
  statusFilter = 'all';
  ownerFilter = 'all';
  sortBy = 'updated_at';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Forms
  createProjectForm: FormGroup;
  editProjectForm: FormGroup;

  // Filter Options
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'PLANNING', label: 'Planning' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ON_HOLD', label: 'On Hold' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  // Project Status Colors
  statusColors = {
    'PLANNING': '#6b7280',
    'ACTIVE': '#10b981',
    'ON_HOLD': '#f59e0b',
    'COMPLETED': '#3b82f6',
    'CANCELLED': '#ef4444'
  };

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.createProjectForm = this.createForm();
    this.editProjectForm = this.createForm();

    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.applyFilters();
    });
  }

  ngOnInit(): void {
    // Get current user
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser = user;
    });

    this.loadProjects();
    this.loadUsers();

    if (this.route.snapshot.routeConfig?.path === 'create') {
      this.createProject();
    }

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params.get('create') === '1' && !this.showCreateModal) {
          this.createProject();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: [''],
      status: ['PLANNING', [Validators.required]],
      budget: [null, [Validators.min(0)]]
    });
  }

  // Fixed: Add trackBy function
  trackByProjectId(index: number, project: ProjectWithStats): number {
    return project.id;
  }

  loadProjects(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.projectService.getProjects().subscribe({
      next: (response) => {
        // Fixed: Handle paginated response properly
        const projectsArray = Array.isArray(response) ? response : response.data || [];
        this.projects = projectsArray.map((project: Project) => this.enrichProjectWithStats(project));
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
        this.projects = [];
        this.filteredProjects = [];
        this.isLoading = false;
      }
    });
  }

  loadUsers(): void {
    this.authService.getUsers().subscribe({
      next: (users) => {
        this.allUsers = users;
      },
      error: (error) => {
        console.error('Error loading users:', error);
      }
    });
  }

  private enrichProjectWithStats(project: Project): ProjectWithStats {
    // Use real data from project model fields
    const totalTasks = project.tasks_count || 0;
    const completedTasks = project.completed_tasks_count || 0;
    const pendingTasks = Math.max(0, totalTasks - completedTasks);
    const inProgressTasks = 0; // Not separately tracked in project model

    const progress = totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;

    // Calculate deadline info
    const endDate = project.end_date ? new Date(project.end_date) : null;
    const now = new Date();
    const daysUntilDeadline = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;

    return {
      ...project,
      progress,
      tasksCount: {
        total: totalTasks,
        completed: completedTasks,
        pending: pendingTasks,
        in_progress: inProgressTasks
      },
      teamMembers: project.team_members || [],
      isOverdue,
      daysUntilDeadline: daysUntilDeadline !== null ? daysUntilDeadline : undefined
    };
  }

  applyFilters(): void {
    let filtered = [...this.projects];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchLower) ||
        project.description.toLowerCase().includes(searchLower)
        // Fixed: Removed client_name check since it doesn't exist in Project model
      );
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === this.statusFilter);
    }

    // Apply owner filter
    if (this.ownerFilter !== 'all') {
      const ownerId = parseInt(this.ownerFilter, 10);
      filtered = filtered.filter(project => project.created_by?.id === ownerId);
    }

    // Apply sorting
    filtered = this.sortProjects(filtered);

    this.filteredProjects = filtered;
  }

  private sortProjects(projects: ProjectWithStats[]): ProjectWithStats[] {
    return projects.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (this.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'end_date':
          aValue = a.end_date ? new Date(a.end_date).getTime() : 0;
          bValue = b.end_date ? new Date(b.end_date).getTime() : 0;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default: // updated_at
          aValue = new Date(a.updated_at || a.created_at).getTime();
          bValue = new Date(b.updated_at || b.created_at).getTime();
      }

      if (this.sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }

  // Event Handlers
  onSearchChange(term: string): void {
    this.searchSubject.next(term);
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter = status;
    this.applyFilters();
  }

  onOwnerFilterChange(owner: string): void {
    this.ownerFilter = owner;
    this.applyFilters();
  }

  onSortChange(sortBy: string): void {
    if (this.sortBy === sortBy) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy;
      this.sortOrder = 'asc';
    }
    this.applyFilters();
  }

  onViewModeChange(mode: 'grid' | 'list' | 'kanban'): void {
    this.viewMode = mode;
    this.openProjectMenuId = null;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openProjectMenuId = null;
  }

  toggleProjectMenu(projectId: number, event: Event): void {
    event.stopPropagation();
    this.openProjectMenuId = this.openProjectMenuId === projectId ? null : projectId;
  }

  onProjectMenuAction(action: 'view' | 'edit' | 'delete', project: ProjectWithStats, event: Event): void {
    event.stopPropagation();
    this.openProjectMenuId = null;

    if (action === 'view') {
      this.viewProject(project);
      return;
    }

    if (action === 'edit') {
      this.editProject(project, event);
      return;
    }

    this.deleteProject(project, event);
  }

  // Project Actions
  viewProject(project: ProjectWithStats): void {
    this.router.navigate(['/projects', project.id]);
  }

  createProject(): void {
    this.showCreateModal = true;
    this.createProjectForm.reset();
    this.createProjectForm.patchValue({ status: 'PLANNING' });
  }

  editProject(project: ProjectWithStats, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedProject = project;
    this.showEditModal = true;
    this.editProjectForm.patchValue({
      name: project.name,
      description: project.description,
      start_date: this.formatDateForInput(project.start_date || ''),
      end_date: this.formatDateForInput(project.end_date || ''),
      status: project.status,
      budget: project.budget || null
    });
  }

  deleteProject(project: ProjectWithStats, event: Event): void {
    event.stopPropagation();
    
    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.projects = this.projects.filter(p => p.id !== project.id);
          this.applyFilters();
        },
        error: (error) => {
          this.errorMessage = this.getErrorMessage(error);
        }
      });
    }
  }

  // Modal Actions
  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createProjectForm.reset();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedProject = null;
    this.editProjectForm.reset();
  }

  submitCreateProject(): void {
    if (this.createProjectForm.invalid) {
      this.markFormGroupTouched(this.createProjectForm);
      return;
    }

    const formData = this.createProjectForm.value;
    const projectData = this.prepareProjectData(formData);

    this.projectService.createProject(projectData).subscribe({
      next: (project) => {
        const enrichedProject = this.enrichProjectWithStats(project);
        this.projects.unshift(enrichedProject);
        this.applyFilters();
        this.closeCreateModal();
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  submitEditProject(): void {
    if (this.editProjectForm.invalid || !this.selectedProject) {
      this.markFormGroupTouched(this.editProjectForm);
      return;
    }

    const formData = this.editProjectForm.value;
    const projectData = this.prepareProjectData(formData);

    this.projectService.updateProject(this.selectedProject.id, projectData).subscribe({
      next: (project) => {
        const index = this.projects.findIndex(p => p.id === this.selectedProject!.id);
        if (index !== -1) {
          this.projects[index] = this.enrichProjectWithStats(project);
          this.applyFilters();
        }
        this.closeEditModal();
      },
      error: (error) => {
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  private prepareProjectData(formData: any): any {
    return {
      name: formData.name,
      description: formData.description,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      status: formData.status,
      budget: formData.budget || null
    };
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.ownerFilter = 'all';
    this.applyFilters();
  }

  refreshProjects(): void {
    this.loadProjects();
  }

  // Utility Methods
  getProjectsByStatus(status: string): ProjectWithStats[] {
    return this.filteredProjects.filter(project => project.status === status);
  }

  getStatusLabel(status: string): string {
    const option = this.statusOptions.find(opt => opt.value === status);
    return option?.label || status;
  }

  getStatusColor(status: string): string {
    return this.statusColors[status as keyof typeof this.statusColors] || '#6b7280';
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return '#10b981'; // green
    if (progress >= 60) return '#3b82f6'; // blue
    if (progress >= 40) return '#f59e0b'; // orange
    return '#ef4444'; // red
  }

  formatDateForInput(date: string): string {
    if (!date) return '';
    const parsedDate = parseApiDate(date);
    return parsedDate ? parsedDate.toISOString().split('T')[0] : '';
  }

  formatDate(date: string | null): string {
    if (!date) return 'No date set';
    const parsedDate = parseApiDate(date);
    return parsedDate ? formatDateIST(date) : 'No date set';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getDaysUntilDeadline(project: ProjectWithStats): string {
    if (!project.end_date) return 'No deadline';
    
    const days = project.daysUntilDeadline;
    if (days === undefined) return 'No deadline';
    
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `${days} days left`;
  }

  getDeadlineClass(project: ProjectWithStats): string {
    if (!project.daysUntilDeadline) return '';
    
    const days = project.daysUntilDeadline;
    if (days < 0) return 'overdue';
    if (days <= 3) return 'due-soon';
    if (days <= 7) return 'due-this-week';
    return '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
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

  // Form validation helpers
  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
      if (field.errors['minlength']) return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Project name',
      description: 'Description',
      start_date: 'Start date',
      end_date: 'End date',
      status: 'Status'
    };
    return labels[fieldName] || fieldName;
  }
}