import { User } from './user.model';
import { Project } from './project.model';
import { Sprint } from './sprint.model';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'CANCELLED' | 'DEPLOYED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  task_type: 'FEATURE' | 'BUG' | 'ENHANCEMENT' | 'REFACTOR' | 'DOCUMENTATION' | 'TESTING' | 'DEPLOYMENT' | 'RESEARCH' | 'MAINTENANCE' | 'SECURITY';
  assigned_to: User | null;
  created_by: User;
  project?: Project;
  sprint?: Sprint;
  due_date?: string;
  start_date?: string;
  completion_date?: string;
  estimated_hours?: number;
  actual_hours: number;
  story_points?: number;
  estimation_unit: 'HOURS' | 'DAYS' | 'STORY_POINTS';
  labels?: string[];
  acceptance_criteria?: string;
  parent_task_id?: number;
  created_at: string;
  updated_at: string;
  comments_count: number;
  attachments_count: number;
  time_logs_count: number;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  status?: string;
  priority: string;
  task_type: string;
  assigned_to_id?: number;
  project_id?: number;
  sprint_id?: number;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  story_points?: number;
  estimation_unit?: string;
  labels?: string[];
  acceptance_criteria?: string;
  parent_task_id?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  task_type?: string;
  assigned_to_id?: number;
  project_id?: number;
  sprint_id?: number;
  due_date?: string;
  start_date?: string;
  completion_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  story_points?: number;
  estimation_unit?: string;
  labels?: string[];
  acceptance_criteria?: string;
  parent_task_id?: number;
}

export interface AssignTaskRequest {
  assigned_to_id: number;
}

export interface Author {
  id: number;
  name: string;
  email: string;
}

export interface TaskComment {
  id: number;
  comment: string;
  task_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  author: Author;
  user: User;  // add this to match API response
}

export interface CreateCommentRequest {
  text: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface TimeLog {
  id: number;
  hours?: number;
  hours_logged?: number;
  description?: string;
  logged_by?: User;
  user?: User;
  user_id?: number;
  task_id: number;
  logged_at: string;
  work_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTimeLogRequest {
  hours?: number;
  hours_logged: number;
  description?: string;
  logged_at?: string;
  work_date?: string;
}

export interface UpdateTimeLogRequest {
  hours?: number;
  hours_logged?: number;
  description?: string;
  logged_at?: string;
  work_date?: string;
}