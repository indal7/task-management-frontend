import { environment } from '../../../environments/environment';

export const API_ENDPOINTS = {
  AUTH: {
    BASE: `${environment.apiUrl}/api/auth`,
    LOGIN: `${environment.apiUrl}/api/auth/login`,
    REGISTER: `${environment.apiUrl}/api/auth/register`,
    PROFILE: `${environment.apiUrl}/api/auth/profile`,
    ME: `${environment.apiUrl}/api/auth/me`,
    LOGOUT: `${environment.apiUrl}/api/auth/logout`,
    PRESENCE_HEARTBEAT: `${environment.apiUrl}/api/auth/presence/heartbeat`,
    PRESENCE_STATUS: (userId: number) => `${environment.apiUrl}/api/auth/presence/status/${userId}`,
    CHANGE_PASSWORD: `${environment.apiUrl}/api/auth/change-password`,
    USERS: `${environment.apiUrl}/api/auth/users`,
    PING: `${environment.apiUrl}/api/auth/ping`,
    REFRESH: `${environment.apiUrl}/api/auth/refresh`
  },
  TASKS: {
    BASE: `${environment.apiUrl}/api/tasks`,
    BY_ID: (id: number) => `${environment.apiUrl}/api/tasks/${id}`,
    ASSIGN: (id: number) => `${environment.apiUrl}/api/tasks/${id}/assign`,
    COMMENTS: (id: number) => `${environment.apiUrl}/api/tasks/${id}/comments`,
    TIME_LOG: (id: number) => `${environment.apiUrl}/api/tasks/${id}/time`,
    USER_TIME_LOGS: `${environment.apiUrl}/api/tasks/time-logs`,
    OVERDUE: `${environment.apiUrl}/api/tasks/overdue`,
    COMMENT_BY_ID: (commentId: number) => `${environment.apiUrl}/api/tasks/comments/${commentId}`,
    TIME_LOGS: (timeLogId: number) => `${environment.apiUrl}/api/tasks/timelogs/${timeLogId}`,
  },
  PROJECTS: {
    BASE: `${environment.apiUrl}/api/projects`,
    BY_ID: (id: number) => `${environment.apiUrl}/api/projects/${id}`,
    RECENT: `${environment.apiUrl}/api/projects/recent`
  },
  SPRINTS: {
    BASE: `${environment.apiUrl}/api/sprints`,
    BY_ID: (id: number) => `${environment.apiUrl}/api/sprints/${id}`,
    PROJECT: (projectId: number) => `${environment.apiUrl}/api/sprints/project/${projectId}`,
    START: (id: number) => `${environment.apiUrl}/api/sprints/${id}/start`,
    COMPLETE: (id: number) => `${environment.apiUrl}/api/sprints/${id}/complete`,
    BURNDOWN: (id: number) => `${environment.apiUrl}/api/sprints/${id}/burndown`,
    ADD_TASK: (sprintId: number, taskId: number) => `${environment.apiUrl}/api/sprints/${sprintId}/tasks/${taskId}`,
    REMOVE_TASK: (sprintId: number, taskId: number) => `${environment.apiUrl}/api/sprints/${sprintId}/tasks/${taskId}`
  },
  NOTIFICATIONS: {
    BASE: `${environment.apiUrl}/api/notifications`,
    MARK_READ: (id: number) => `${environment.apiUrl}/api/notifications/${id}/read`,
    READ_ALL: `${environment.apiUrl}/api/notifications/read-all`,
    DELETE: (id: number) => `${environment.apiUrl}/api/notifications/${id}`
  },
  ANALYTICS: {
    BASE: `${environment.apiUrl}/api/analytics`,
    TASK_COMPLETION: `${environment.apiUrl}/api/analytics/task-completion`,
    USER_PRODUCTIVITY: `${environment.apiUrl}/api/analytics/user-productivity`,
    STATUS_DISTRIBUTION: `${environment.apiUrl}/api/analytics/task-status-distribution`,
    PRIORITY_DISTRIBUTION: `${environment.apiUrl}/api/analytics/task-priority-distribution`
  },
  ACTIVITY: {
    BASE: `${environment.apiUrl}/api/activity`,
    USER: (userId: number) => `${environment.apiUrl}/api/activity/users/${userId}`,
    TASK: (taskId: number) => `${environment.apiUrl}/api/activity/tasks/${taskId}`,
    PROJECT: (projectId: number) => `${environment.apiUrl}/api/activity/projects/${projectId}`
  },
  SEARCH: {
    GLOBAL: `${environment.apiUrl}/api/search/global`,
    TASKS:  `${environment.apiUrl}/api/search/tasks`,
  },
  USERS: {
    BASE: `${environment.apiUrl}/api/users`,
    BY_ID: (id: number) => `${environment.apiUrl}/api/users/${id}`,
    ACTIVATE: (id: number) => `${environment.apiUrl}/api/users/${id}/activate`
  },
  ENUMS: {
    BASE: `${environment.apiUrl}/api/enums`,
    USER_ROLES: `${environment.apiUrl}/api/enums/user-roles`,
    TASK_STATUSES: `${environment.apiUrl}/api/enums/task-statuses`,
    TASK_PRIORITIES: `${environment.apiUrl}/api/enums/task-priorities`,
    TASK_TYPES: `${environment.apiUrl}/api/enums/task-types`,
    PROJECT_STATUSES: `${environment.apiUrl}/api/enums/project-statuses`,
    SPRINT_STATUSES: `${environment.apiUrl}/api/enums/sprint-statuses`
  },
  HEALTH: {
    BASE: `${environment.apiUrl}/api/health`,
    DB: `${environment.apiUrl}/api/health/db`
  }
};

export const STORAGE_KEYS = {
  TOKEN: environment.tokenKey,
  REFRESH_TOKEN: environment.refreshTokenKey,
  USER: environment.userKey
};

export const APP_CONFIG = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB to match API
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml'],
  SUPPORTED_DOC_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  TOKEN_EXPIRY_BUFFER: 5 * 60 * 1000, // 5 minutes in milliseconds
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  NOTIFICATION_CHECK_INTERVAL: 30000 // 30 seconds
};