import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';
import { LoadingService } from './core/interceptors/loading.interceptor';
import { EnumService } from './core/services/enum.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  title = 'Task Management System';
  isAuthenticated = false;
  isLoading = false;
  showSidebar = true;
  sidebarCollapsed = false;

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService,
    private enumService: EnumService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    // Apply theme before any rendering occurs
    this.initializeTheme();
  }

  ngOnInit(): void {
    this.initializeApp();
    this.setupSubscriptions();
    this.initializeSidebarState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    const target = event.target as Window;
    const isMobile = target.innerWidth <= 768;
    if (isMobile && !this.sidebarCollapsed) {
      this.sidebarCollapsed = true;
    }
  }

  private initializeTheme(): void {
    try {
      const stored = JSON.parse(localStorage.getItem('userSettings') || '{}');
      const theme = (stored?.general?.theme as string) || 'light';
      const body = document.body;
      body.classList.remove('light-theme', 'dark-theme');
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
      } else {
        body.classList.add(`${theme}-theme`);
      }
    } catch {
      document.body.classList.add('light-theme');
    }
  }

  private initializeApp(): void {
    // Initialize enum service (loads all dropdown data)
    this.enumService.loadAllEnums().subscribe({
      error: (error) => {
        console.error('Failed to load enums:', error);
      }
    });
  }

  private setupSubscriptions(): void {
    // Authentication state
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuthenticated => {
        this.isAuthenticated = isAuthenticated;
        this.updateSidebarVisibility();
      });

    // Global HTTP loading state from interceptor
    this.loadingService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoading => {
        this.isLoading = isLoading;
      });

    // Router events for sidebar visibility
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.updateSidebarVisibility(event.url);
      });
  }

  // 🔧 ENHANCED: Better initialization with saved state
  private initializeSidebarState(): void {
    // Check if user has a saved preference
    const savedState = localStorage.getItem('sidebar-collapsed');
    
    if (savedState !== null) {
      this.sidebarCollapsed = JSON.parse(savedState);
    } else {
      // Default: collapse on mobile, expand on desktop
      this.sidebarCollapsed = window.innerWidth <= 768;
    }
    
    // console.log('Initialized sidebar state:', { 
    //   collapsed: this.sidebarCollapsed, 
    //   screenWidth: window.innerWidth 
    // });
  }

  private updateSidebarVisibility(url?: string): void {
    const currentUrl = url || this.router.url;
    
    // Hide sidebar on auth pages and access denied page
    const hideSidebarRoutes = ['/auth', '/access-denied'];
    // this.showSidebar = this.isAuthenticated && 
    //                  !hideSidebarRoutes.some(route => currentUrl.startsWith(route));
    this.showSidebar = true;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed));
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem('sidebar-collapsed', JSON.stringify(this.sidebarCollapsed));
  }

  getScreenInfo(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
    const width = window.innerWidth;
    return {
      isMobile: width <= 768,
      isTablet: width > 768 && width <= 1024,
      isDesktop: width > 1024
    };
  }
}