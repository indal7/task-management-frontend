import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Core Services and Models
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
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
  
  // 🔧 ADDED: Input to receive sidebar state from parent
  @Input() sidebarCollapsed = false;
  
  currentUser: User | null = null;
  unreadNotificationCount = 0;
  showNotificationPanel = false;
  searchQuery = '';
  isLoading = false;
  notifications: any[] = []; // Will be properly typed later
  isDarkMode = false;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadInitialData();
    this.isDarkMode = document.body.classList.contains('dark-theme');
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
        this.isLoading = loading;
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

  onSearch(): void {
    if (this.searchQuery.trim()) {
      // console.log('Searching for:', this.searchQuery);
      // Navigate to search results
      this.router.navigate(['/search'], { 
        queryParams: { q: this.searchQuery } 
      });
    }
  }

  onNotificationClick(): void {
    this.showNotificationPanel = !this.showNotificationPanel;
    
    if (this.showNotificationPanel && this.notifications.length === 0) {
      // Load notifications when panel is opened for the first time
      this.loadNotifications();
    }
  }

  private loadNotifications(): void {
    this.notificationService.getNotifications(true).subscribe({
      next: (notifications) => {
        this.notifications = notifications.slice(0, 5); // Show only recent 5
        // console.log('Recent notifications loaded:', this.notifications);
      },
      error: (error) => {
        console.error('Failed to load notifications:', error);
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

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        // console.log('All notifications marked as read');
        this.notifications = this.notifications.map(notif => ({
          ...notif,
          read: true
        }));
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      }
    });
  }

  closeNotificationPanel(): void {
    this.showNotificationPanel = false;
  }

  onNotificationItemClick(notification: any): void {
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

    // Navigate to related page if action_url exists
    if (notification.action_url) {
      this.router.navigate([notification.action_url]);
    }

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
    this.router.navigate(['/tasks/create']);
  }

  createProject(): void {
    this.router.navigate(['/projects/create']);
  }

  openQuickSearch(): void {
    // Focus on search input
    const searchInput = document.querySelector('.search-field input') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  }

  // Track by function for notification list performance
  trackByNotificationId(index: number, notification: any): number {
    return notification.id;
  }

  // Method to handle keyboard navigation in notifications
  onNotificationKeyDown(event: KeyboardEvent, notification: any): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onNotificationItemClick(notification);
    }
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(this.isDarkMode ? 'dark-theme' : 'light-theme');
    // Persist using the same key and structure as SettingsComponent
    const stored = JSON.parse(localStorage.getItem('userSettings') || '{}');
    stored.general = { ...(stored.general || {}), theme: this.isDarkMode ? 'dark' : 'light' };
    localStorage.setItem('userSettings', JSON.stringify(stored));
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) { img.style.display = 'none'; }
  }
}