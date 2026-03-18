import { User } from './user.model';
import { Project } from './project.model';
import { Task } from './task.model';

export interface Sprint {
  id: number;
  name: string;
  description?: string;
  status: 'PLANNED' | 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  project_id?: number;
  start_date?: string;
  end_date?: string;
  goal?: string;
  project?: Project;
  created_by?: User;
  created_at: string;
  updated_at: string;
  tasks_count: number;
  completed_tasks_count: number;
  total_story_points: number;
  completed_story_points: number;
  total_estimated_hours: number;
  total_actual_hours: number;
}

export interface CreateSprintRequest {
  name: string;
  description?: string;
  project_id: number;
  start_date?: string;
  end_date?: string;
  goal?: string;
}

export interface UpdateSprintRequest {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  goal?: string;
  status?: string;
}

export interface SprintTask {
  id: number;
  sprint_id: number;
  task_id: number;
  added_at: string;
  task: Task;
}

export interface BurndownData {
  date: string;
  remaining_story_points: number;
  remaining_hours: number;
  ideal_remaining_story_points: number;
  ideal_remaining_hours: number;
  completed_story_points: number;
  completed_hours: number;
}

export interface SprintBurndown {
  sprint_id: number;
  sprint_name: string;
  start_date: string;
  end_date: string;
  total_story_points: number;
  total_estimated_hours: number;
  burndown_data: BurndownData[];
}