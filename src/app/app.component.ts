import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import { AuthService } from './core/services/auth.service';
import { LoadingService } from './core/interceptors/loading.interceptor';
import { EnumService } from './core/services/enum.service';
import { NotificationService } from './core/services/notification.service';
import { AppearanceService } from './core/services/appearance.service';

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
  showSidebar = false;
  sidebarCollapsed = false;

  constructor(
    private authService: AuthService,
    private loadingService: LoadingService,
    private enumService: EnumService,
    private notificationService: NotificationService,
    private appearanceService: AppearanceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    // Apply appearance preferences before first render.
    this.appearanceService.initialize();
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
    // Promise.resolve defers the update to after current CD cycle, preventing NG0100
    this.loadingService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoading => {
        Promise.resolve().then(() => {
          this.isLoading = isLoading;
          this.cdr.markForCheck();
        });
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

    // Keep auth screens isolated: no app shell (sidebar/header) on these routes.
    const isAuthRoute = currentUrl.startsWith('/auth');
    const isAccessDeniedRoute = currentUrl.startsWith('/access-denied');

    this.showSidebar = this.isAuthenticated && !isAuthRoute && !isAccessDeniedRoute;
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