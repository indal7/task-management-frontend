// src/app/shared/components/sidebar/sidebar.component.ts - Enhanced with auth state
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthGuard } from '../../../core/guards/auth.guard';
import { User } from '../../../core/models';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  active: boolean;
  badge?: string | null;
  badgeCount?: number;
  roles?: string[];
  permissions?: string[];
  children?: MenuItem[];
  hidden?: boolean; // Add hidden property for dynamic hiding
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  animations: [
    trigger('slideInOut', [
      state('in', style({ height: '*', opacity: 1 })),
      transition(':enter', [
        style({ height: 0, opacity: 0 }),
        animate('300ms ease-in-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1 }),
        animate('300ms ease-in-out', style({ height: 0, opacity: 0 }))
      ])
    ])
  ]
})
export class SidebarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // 🔧 NEW: Output event to notify parent component of toggle
  @Output() sidebarToggle = new EventEmitter<boolean>();

  /** Receive the parent's collapsed state so both stay in sync after page refreshes. */
  @Input() set collapsed(value: boolean) {
    this.isCollapsed = value;
  }

  // 🔧 FIXED: Add authentication state tracking
  currentUser: User | null = null;
  isAuthenticated = false;
  unreadNotificationCount = 0;
  isCollapsed = false;
  
  // 🔧 FIXED: Enhanced menu items with better permission mapping
  menuItems: MenuItem[] = [
    { 
      icon: 'dashboard', 
      label: 'Dashboard', 
      route: '/dashboard',
      active: false,
      badge: null,
      hidden: false
    },
    { 
      icon: 'assignment', 
      label: 'Tasks', 
      route: '/tasks',
      active: false,
      badge: null,
      hidden: false,
      children: [
        { icon: 'list', label: 'All Tasks', route: '/tasks', active: false, hidden: false },
        { icon: 'person', label: 'My Tasks', route: '/tasks/my-tasks', active: false, hidden: false },
        { icon: 'warning', label: 'Overdue', route: '/tasks/overdue', active: false, hidden: false },
        { 
          icon: 'add_task', 
          label: 'Create Task', 
          route: '/tasks/create', 
          active: false, 
          hidden: false,
          // permissions: ['create_task'] 
        }
      ]
    },
    { 
      icon: 'folder', 
      label: 'Projects', 
      route: '/projects',
      active: false,
      badge: null,
      hidden: false,
      // permissions: ['view_all_projects', 'view_team_projects'],
      children: [
        { 
          icon: 'list', 
          label: 'All Projects', 
          route: '/projects', 
          active: false, 
          hidden: false,
          // permissions: ['view_all_projects', 'view_team_projects']
        },
        { 
          icon: 'add', 
          label: 'Create Project', 
          route: '/projects/create', 
          active: false, 
          hidden: false
        }
      ]
    },
    { 
      icon: 'track_changes', 
      label: 'Sprints', 
      route: '/sprints',
      active: false,
      badge: null,
      hidden: false,
      // permissions: ['manage_sprints', 'view_sprints']
    },
    { 
      icon: 'group', 
      label: 'Team', 
      route: '/team',
      active: false,
      badge: null,
      hidden: false,
      // permissions: ['manage_team', 'view_team_tasks']
    },
    { 
      icon: 'schedule', 
      label: 'Time Tracking', 
      route: '/time-tracking',
      active: false,
      badge: null,
      hidden: false
    },
    { 
      icon: 'calendar_today', 
      label: 'Calendar', 
      route: '/calendar',
      active: false,
      badge: null,
      hidden: false
    },
    { 
      icon: 'notifications', 
      label: 'Notifications', 
      route: '/notifications',
      active: false,
      badge: 'unreadCount',
      hidden: false
    },
    { 
      icon: 'assessment', 
      label: 'Analytics', 
      route: '/analytics',
      active: false,
      badge: null,
      hidden: false,
      // permissions: ['view_analytics']
    },
    { 
      icon: 'bar_chart', 
      label: 'Reports', 
      route: '/reports',
      active: false,
      badge: null,
      hidden: false,
      // permissions: ['view_analytics'],
      children: [
        { 
          icon: 'trending_up', 
          label: 'Performance Reports', 
          route: '/reports/performance', 
          active: false, 
          hidden: false,
          // permissions: ['view_analytics']
        },
        { 
          icon: 'pie_chart', 
          label: 'Project Reports', 
          route: '/reports/projects', 
          active: false, 
          hidden: false,
          // permissions: ['view_analytics']
        },
        { 
          icon: 'timeline', 
          label: 'Time Reports', 
          route: '/reports/time', 
          active: false, 
          hidden: false
        }
      ]
    },
    { 
      icon: 'settings', 
      label: 'Settings', 
      route: '/settings',
      active: false,
      badge: null,
      hidden: false
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private authGuard: AuthGuard
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    // 🔧 FIXED: Track authentication state properly
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuth => {
        this.isAuthenticated = isAuth;
        // console.log('Sidebar: Authentication state changed:', isAuth);
        
        if (isAuth) {
          this.filterMenuItemsByPermissions();
        } else {
          this.hideAllMenuItems();
        }
      });

    // Current user subscription
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        // console.log('Sidebar: Current user changed:', user);
        
        if (user) {
          this.filterMenuItemsByPermissions();
        }
      });

    // Router events
    this.setupRouterSubscription();
    
    // 🔧 FIXED: Only subscribe to notifications if authenticated
    this.setupNotificationSubscription();
  }

  private setupRouterSubscription(): void {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateActiveRoute(event.url);
      });
  }

  private setupNotificationSubscription(): void {
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuth => {
        if (isAuth) {
          this.notificationService.unreadCount$
            .pipe(takeUntil(this.destroy$))
            .subscribe(count => {
              this.unreadNotificationCount = count;
              this.updateNotificationBadge();
            });
        } else {
          this.unreadNotificationCount = 0;
          this.updateNotificationBadge();
        }
      });
  }

  private initializeComponent(): void {
    // Set initial active route
    this.updateActiveRoute(this.router.url);
    
    // Set initial sidebar state on mobile
    if (this.isMobile()) {
      this.isCollapsed = true;
      this.sidebarToggle.emit(true); // Emit initial state
    }
  }

  // 🔧 FIXED: Add method to check if sidebar should be visible
  shouldShowSidebar(): boolean {
    return this.isAuthenticated;
  }

  // 🔧 FIXED: Add method to hide all menu items when not authenticated
  private hideAllMenuItems(): void {
    this.menuItems.forEach(item => {
      item.hidden = true;
      if (item.children) {
        item.children.forEach(child => child.hidden = true);
      }
    });
  }

  // 🔧 IMPROVED: Enhanced permission filtering with better logic
  private filterMenuItemsByPermissions(): void {
    if (!this.isAuthenticated || !this.currentUser) {
      this.hideAllMenuItems();
      return;
    }

    // console.log('Filtering menu items for user role:', this.currentUser.role);

    // Show/hide main menu items
    this.menuItems.forEach(item => {
      item.hidden = !this.canShowMenuItem(item);
      
      // Filter child menu items
      if (item.children) {
        item.children.forEach(child => {
          child.hidden = !this.canShowMenuItem(child);
        });
        
        // Hide parent if all children are hidden
        const visibleChildren = item.children.filter(child => !child.hidden);
        if (visibleChildren.length === 0 && item.permissions) {
          item.hidden = true;
        }
      }
    });

    this.menuItems.map(item => ({
      label: item.label,
      hidden: item.hidden,
      children: item.children?.map(child => ({ label: child.label, hidden: child.hidden }))
    }));
  }

  private canShowMenuItem(item: MenuItem): boolean {
    // Always show items without restrictions
    if (!item.permissions && !item.roles) {
      return true;
    }

    // Check roles
    if (item.roles && !this.authService.hasAnyRole(item.roles)) {
      return false;
    }

    // Check permissions using AuthGuard
    if (item.permissions && item.permissions.length > 0) {
      const hasPermission = item.permissions.some(permission => 
        this.authGuard.hasPermission(permission)
      );
      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  // 🔧 IMPROVED: Better route matching logic
  private updateActiveRoute(url: string): void {
    this.menuItems.forEach(item => {
      item.active = false;
      if (item.children) {
        item.children.forEach(child => child.active = false);
      }

      // Handle root route
      if (url === '/' && item.route === '/dashboard') {
        item.active = true;
        return;
      }

      // Check exact route match first
      if (url === item.route) {
        item.active = true;
        return;
      }

      // Check if URL starts with route (for nested routes)
      if (url.startsWith(item.route + '/') || url.startsWith(item.route + '?')) {
        item.active = true;
      }

      // Check child routes
      if (item.children) {
        item.children.forEach(child => {
          if (url === child.route || url.startsWith(child.route + '/') || url.startsWith(child.route + '?')) {
            child.active = true;
            item.active = true;
          }
        });
      }
    });
  }

  private updateNotificationBadge(): void {
    const notificationItem = this.menuItems.find(item => item.route === '/notifications');
    if (notificationItem) {
      notificationItem.badgeCount = this.unreadNotificationCount;
    }
  }

  // 🔧 FIXED: Add permission checks for menu interactions
  onMenuItemClick(item: MenuItem): void {
    if (!this.isAuthenticated) {
      console.warn('Menu item clicked while not authenticated');
      return;
    }

    if (item.hidden) {
      console.warn('Attempted to access hidden menu item:', item.label);
      return;
    }

    if (item.children && item.children.length > 0) {
      // Toggle child menu
      item.active = !item.active;
    } else {
      // Navigate to route
      this.router.navigateByUrl(item.route);
      
      // Collapse sidebar on mobile after navigation
      if (this.isMobile()) {
        this.isCollapsed = true;
        this.sidebarToggle.emit(true);
      }
    }
  }

  onChildMenuClick(parent: MenuItem, child: MenuItem): void {
    if (!this.isAuthenticated) {
      console.warn('Child menu item clicked while not authenticated');
      return;
    }

    if (child.hidden) {
      console.warn('Attempted to access hidden child menu item:', child.label);
      return;
    }

    this.router.navigateByUrl(child.route);
    
    // Collapse sidebar on mobile after navigation
    if (this.isMobile()) {
      this.isCollapsed = true;
      this.sidebarToggle.emit(true);
    }
  }

  // 🔧 ENHANCED: Toggle sidebar and emit event to parent
  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarToggle.emit(this.isCollapsed); // Emit to parent component
    // console.log('Sidebar toggled, collapsed:', this.isCollapsed);
  }

  onLogout(): void {
    if (!this.isAuthenticated) {
      console.warn('Logout attempted while not authenticated');
      return;
    }
    
    // console.log('Logging out user from sidebar:', this.currentUser?.email);
    this.authService.logout();
  }

  // Helper methods
  getNotificationBadgeText(): string {
    return this.unreadNotificationCount > 99 ? '99+' : this.unreadNotificationCount.toString();
  }

  shouldShowBadge(item: MenuItem): boolean {
    return item.badge === 'unreadCount' && this.unreadNotificationCount > 0;
  }

  getUserInitials(): string {
    if (!this.currentUser?.name) return 'U';
    
    const names = this.currentUser.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  }

  getUserRole(): string {
    if (!this.currentUser?.role) return 'User';
    
    return this.currentUser.role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) { img.style.display = 'none'; }
  }

  // 🔧 NEW: Get visible menu items for template
  getVisibleMenuItems(): MenuItem[] {
    return this.menuItems.filter(item => !item.hidden);
  }

  // 🔧 NEW: Get visible child items
  getVisibleChildItems(item: MenuItem): MenuItem[] {
    if (!item.children) return [];
    return item.children.filter(child => !child.hidden);
  }
}