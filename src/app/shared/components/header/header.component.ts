import { Component, OnInit, OnDestroy, Input, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// Core Services and Models
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService, AppNotification } from '../../../core/services/notification.service';
import { SearchService, GlobalSearchResponse, SearchResult } from '../../../core/services/search.service';
import { AppearanceService } from '../../../core/services/appearance.service';
import { User } from '../../../core/models';

// Shared Directives
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchInput$ = new Subject<string>();

  @ViewChild('searchInputRef') searchInputRef!: ElementRef<HTMLInputElement>;

  // Input to receive sidebar state from parent
  @Input() sidebarCollapsed = false;

  currentUser: User | null = null;
  unreadNotificationCount = 0;
  showNotificationPanel = false;
  searchQuery = '';
  notifications: AppNotification[] = [];
  isDarkMode = false;
  notificationsLoading = false;
  notificationError: string | null = null;

  // Live search state
  searchResults: GlobalSearchResponse | null = null;
  isSearching = false;
  showSearchDropdown = false;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private searchService: SearchService,
    private appearanceService: AppearanceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.setupLiveSearch();
    this.loadInitialData();
    this.isDarkMode = this.appearanceService.isDarkModeActive();

    this.appearanceService.appearance$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isDarkMode = this.appearanceService.isDarkModeActive();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    // Current user subscription
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // console.log('Header: Current user updated:', user);
      });

    // Notification count subscription
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadNotificationCount = count;
        // console.log('Header: Unread notification count:', count);
      });

    // Loading state subscription
    this.notificationService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.notificationsLoading = this.showNotificationPanel ? loading : false;
      });
  }

  private loadInitialData(): void {
    // Load notification summary on component init
    this.notificationService.getNotificationSummary().subscribe({
      next: (summary) => {
        // console.log('Notification summary loaded:', summary);
      },
      error: (error) => {
        console.error('Failed to load notification summary:', error);
      }
    });
  }

  private setupLiveSearch(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.trim().length < 2) {
            this.searchResults = null;
            this.showSearchDropdown = false;
            this.isSearching = false;
            return of(null);
          }
          this.isSearching = true;
          this.showSearchDropdown = true;
          return this.searchService.globalSearch(q, 8);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(results => {
        this.isSearching = false;
        if (results) {
          this.searchResults = results as GlobalSearchResponse;
        }
      });
  }

  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.searchInput$.next(value);
  }

  onSearch(): void {
    // Enter key — navigate to the tasks list filtered by query
    if (this.searchQuery.trim().length >= 2) {
      this.closeSearchDropdown();
      this.router.navigate(['/tasks'], { queryParams: { search: this.searchQuery.trim() } });
    }
  }

  onResultClick(result: SearchResult): void {
    this.closeSearchDropdown();
    this.searchQuery = '';
    this.router.navigateByUrl(result.route);
  }

  closeSearchDropdown(): void {
    this.showSearchDropdown = false;
  }

  get hasSearchResults(): boolean {
    return !!this.searchResults && this.searchResults.total > 0;
  }

  get totalSearchResults(): number {
    return this.searchResults?.total ?? 0;
  }

  onNotificationClick(): void {
    this.showNotificationPanel = false;
    this.router.navigate(['/notifications']);
  }

  private loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationError = null;

    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications.slice(0, 5); // Show only recent 5
        this.notificationsLoading = false;
      },
      error: (error) => {
        console.error('Failed to load notifications:', error);
        this.notificationError = error?.message || 'Failed to load notifications';
        this.notificationsLoading = false;
      }
    });
  }

  onSettingsClick(): void {
    this.router.navigate(['/settings']);
  }

  onLogout(): void {
    // Show confirmation before logout
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }

  getUserInitials(): string {
    if (!this.currentUser?.name) return 'U';
    
    const names = this.currentUser.name.split(' ').filter(name => name.length > 0);
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  markAllNotificationsAsRead(): void {
    if (this.unreadNotificationCount === 0) return;

    this.notificationsLoading = true;
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map(notif => ({
          ...notif,
          read: true
        }));
        this.notificationsLoading = false;
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
        this.notificationError = error?.message || 'Failed to mark all notifications as read';
        this.notificationsLoading = false;
      }
    });
  }

  closeNotificationPanel(): void {
    this.showNotificationPanel = false;
    this.notificationsLoading = false;
  }

  onNotificationItemClick(notification: AppNotification): void {
    // Mark notification as read if not already read
    if (!notification.read) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.read = true;
        },
        error: (error) => {
          console.error('Error marking notification as read:', error);
        }
      });
    }

    this.router.navigate(['/notifications']);
    this.closeNotificationPanel();
  }

  viewAllNotifications(): void {
    this.router.navigate(['/notifications']);
    this.closeNotificationPanel();
  }

  // Helper method to get user role display name
  getUserRoleDisplay(): string {
    if (!this.currentUser?.role) return '';
    return this.currentUser.role.replace('_', ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Quick action methods
  createTask(): void {
    this.router.navigate(['/tasks'], { queryParams: { create: 1 } });
  }

  createProject(): void {
    this.router.navigate(['/projects/management'], { queryParams: { create: 1 } });
  }

  openQuickSearch(): void {
    // Focus the header search input
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.search-field input');
      el?.focus();
    }, 50);
  }

  // Track by function for notification list performance
  trackByNotificationId(index: number, notification: AppNotification): number {
    return notification.id;
  }

  // Method to handle keyboard navigation in notifications
  onNotificationKeyDown(event: KeyboardEvent, notification: AppNotification): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onNotificationItemClick(notification);
    }
  }

  toggleDarkMode(): void {
    const enableDarkMode = !this.appearanceService.isDarkModeActive();
    this.appearanceService.setTheme(enableDarkMode ? 'dark' : 'light');
    this.isDarkMode = enableDarkMode;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) { img.style.display = 'none'; }
  }

  private getNotificationRoute(notification: AppNotification): string | null {
    if (notification.action_url) {
      const normalized = this.normalizeActionUrl(notification.action_url);
      if (normalized) {
        return normalized;
      }
    }

    const taskId = notification.task_id ?? (notification as any).related_task_id;
    const projectId = notification.project_id ?? (notification as any).related_project_id;
    const sprintId = notification.sprint_id ?? (notification as any).related_sprint_id;

    if (taskId) {
      return `/tasks/${taskId}`;
    }

    if (projectId) {
      return `/projects/${projectId}`;
    }

    if (sprintId) {
      if (projectId) {
        return `/sprints/${projectId}`;
      }
      return '/sprints';
    }

    return '/notifications';
  }

  private normalizeActionUrl(actionUrl: string): string | null {
    if (!actionUrl) {
      return null;
    }

    if (actionUrl.startsWith('/api/')) {
      return actionUrl.replace('/api', '');
    }

    if (actionUrl.startsWith('/')) {
      return actionUrl;
    }

    try {
      const parsed = new URL(actionUrl);
      if (parsed.origin === window.location.origin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return null;
    }

    return null;
  }
}