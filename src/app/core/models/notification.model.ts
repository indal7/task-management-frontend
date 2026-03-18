import { User } from './user.model';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'TASK_OVERDUE' | 'PROJECT_UPDATED' | 'SPRINT_STARTED' | 'SPRINT_COMPLETED' | 'COMMENT_ADDED' | 'SYSTEM' | 'REMINDER';
  is_read?: boolean;
  read?: boolean;
  user?: User;
  user_id?: number;
  related_user?: User;
  related_user_id?: number;
  related_task_id?: number;
  related_project_id?: number;
  related_sprint_id?: number;
  task_id?: number;
  project_id?: number;
  sprint_id?: number;
  action_url?: string;
  created_at: string;
  read_at?: string;
}

export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: string;
  user_id: number;
  related_task_id?: number;
  related_project_id?: number;
  related_sprint_id?: number;
  action_url?: string;
}

export interface NotificationSummary {
  unread_count: number;
  total_count?: number;
  total_notifications?: number;
  recent_notifications?: Notification[];
  type_summary?: Record<string, number>;
  task_notifications?: number;
  project_notifications?: number;
  sprint_notifications?: number;
  system_notifications?: number;
}