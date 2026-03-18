// Fixed core/services/index.ts - Correct barrel exports for services

// Export all services individually
export { AuthService } from './auth.service';
export { TaskService } from './task.service';
export { ProjectService } from './project.service';
export { SprintService } from './sprint.service';
export { NotificationService } from './notification.service';
export { AnalyticsService } from './analytics.service';
export { EnumService } from './enum.service';
export { LayoutService } from './layout.service';
export { AppearanceService } from './appearance.service';
export { ErrorHandlerService } from './error-handler.service';

// Export service filter types
export type { TaskFilters } from './task.service';
export type { ProjectFilters } from './project.service';
export type { SprintFilters } from './sprint.service';
export type { NotificationFilters } from './notification.service';

// Export LoadingService from interceptors
export { LoadingService } from '../interceptors/loading.interceptor';