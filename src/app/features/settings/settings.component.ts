// src/app/features/settings/settings.component.ts
import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivityLogEntry, AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { AppearanceService, ColorSchemeMode } from '../../core/services/appearance.service';
import { ChangePasswordRequest } from '../../core/models';

interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  colorScheme: ColorSchemeMode;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartDay: 'monday' | 'sunday';
  defaultView: 'list' | 'grid' | 'kanban';
  fontSize: 'normal' | 'large' | 'xlarge';
  density: 'comfortable' | 'compact' | 'standard';
}

interface WorkHoursSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  workDays: string[];
  breakDuration: number;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  taskReminders: boolean;
  projectUpdates: boolean;
  deadlineAlerts: boolean;
  teamMentions: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  reminderBefore: number;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'team' | 'private';
  activityTracking: boolean;
  dataSharing: boolean;
  marketingEmails: boolean;
  analytics: boolean;
}

interface SecuritySettings {
  twoFactorAuth: boolean;
  sessionTimeout: number; // minutes
  loginNotifications: boolean;
  apiAccess: boolean;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('changePasswordDialog') changePasswordDialog!: TemplateRef<unknown>;
  @ViewChild('loginHistoryDialog') loginHistoryDialog!: TemplateRef<unknown>;

  // Forms
  generalForm: FormGroup;
  workHoursForm: FormGroup;
  notificationsForm: FormGroup;
  privacyForm: FormGroup;
  securityForm: FormGroup;
  changePasswordForm: FormGroup;

  // UI State
  selectedTabIndex = 0;
  isGeneralLoading = false;
  isWorkHoursLoading = false;
  isNotificationsLoading = false;
  isPrivacyLoading = false;
  isSecurityLoading = false;
  isChangePasswordLoading = false;
  successMessage: string | null = null;
  passwordErrorMessage: string | null = null;
  private passwordDialogRef: MatDialogRef<unknown> | null = null;
  private loginHistoryDialogRef: MatDialogRef<unknown> | null = null;
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  loginHistoryItems: ActivityLogEntry[] = [];
  loginHistoryLoading = false;
  loginHistoryErrorMessage: string | null = null;

  // Work days checkboxes state
  workDayOptions = [
    { value: 'monday', label: 'Mon', selected: true },
    { value: 'tuesday', label: 'Tue', selected: true },
    { value: 'wednesday', label: 'Wed', selected: true },
    { value: 'thursday', label: 'Thu', selected: true },
    { value: 'friday', label: 'Fri', selected: true },
    { value: 'saturday', label: 'Sat', selected: false },
    { value: 'sunday', label: 'Sun', selected: false }
  ];

  // Options
  timezoneOptions = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
    { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
    { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
    { value: 'Europe/London', label: 'London Time (UTC+0)' },
    { value: 'Europe/Paris', label: 'Central European Time (UTC+1)' },
    { value: 'Asia/Tokyo', label: 'Japan Time (UTC+9)' },
    { value: 'Asia/Shanghai', label: 'China Time (UTC+8)' },
    { value: 'Asia/Kolkata', label: 'India Time (UTC+5:30)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (UTC+10)' }
  ];

  reminderOptions = [
    { value: 15, label: '15 minutes before' },
    { value: 30, label: '30 minutes before' },
    { value: 60, label: '1 hour before' },
    { value: 120, label: '2 hours before' },
    { value: 1440, label: '1 day before' }
  ];

  colorSchemeOptions: Array<{ value: ColorSchemeMode; label: string; description: string; previewClass: string }> = [
    {
      value: 'ocean',
      label: 'Ocean Teal',
      description: 'Deep blue with teal accents',
      previewClass: 'scheme-preview-ocean'
    },
    {
      value: 'forest',
      label: 'Forest Slate',
      description: 'Green slate with natural accents',
      previewClass: 'scheme-preview-forest'
    },
    {
      value: 'sunset',
      label: 'Sunset Ember',
      description: 'Warm coral with amber contrast',
      previewClass: 'scheme-preview-sunset'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private appearanceService: AppearanceService,
    private dialog: MatDialog
  ) {
    this.generalForm = this.createGeneralForm();
    this.workHoursForm = this.createWorkHoursForm();
    this.notificationsForm = this.createNotificationsForm();
    this.privacyForm = this.createPrivacyForm();
    this.securityForm = this.createSecurityForm();
    this.changePasswordForm = this.createChangePasswordForm();
  }

  ngOnInit(): void {
    this.loadCurrentSettings();
    this.setupAppearanceLivePreview();
  }

  ngOnDestroy(): void {
    if (this.passwordDialogRef) {
      this.passwordDialogRef.close();
      this.passwordDialogRef = null;
    }

    if (this.loginHistoryDialogRef) {
      this.loginHistoryDialogRef.close();
      this.loginHistoryDialogRef = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  private createGeneralForm(): FormGroup {
    return this.fb.group({
      theme: ['light', Validators.required],
      colorScheme: ['ocean', Validators.required],
      language: ['en', Validators.required],
      timezone: ['UTC', Validators.required],
      dateFormat: ['MM/DD/YYYY', Validators.required],
      timeFormat: ['12h', Validators.required],
      weekStartDay: ['sunday', Validators.required],
      defaultView: ['list', Validators.required],
      fontSize: ['normal', Validators.required],
      density: ['comfortable', Validators.required]
    });
  }

  private createWorkHoursForm(): FormGroup {
    return this.fb.group({
      enabled: [true],
      startTime: ['09:00', Validators.required],
      endTime: ['18:00', Validators.required],
      breakDuration: [60, Validators.required]
    });
  }

  private createNotificationsForm(): FormGroup {
    return this.fb.group({
      emailNotifications: [true],
      pushNotifications: [true],
      taskReminders: [true],
      projectUpdates: [true],
      deadlineAlerts: [true],
      teamMentions: [true],
      dailyDigest: [false],
      weeklyReport: [true],
      quietHoursEnabled: [false],
      quietHoursStart: ['22:00'],
      quietHoursEnd: ['08:00'],
      reminderBefore: [30]
    });
  }

  private createPrivacyForm(): FormGroup {
    return this.fb.group({
      profileVisibility: ['team', Validators.required],
      activityTracking: [true],
      dataSharing: [false],
      marketingEmails: [false],
      analytics: [true]
    });
  }

  private createSecurityForm(): FormGroup {
    return this.fb.group({
      twoFactorAuth: [false],
      sessionTimeout: [60, Validators.required],
      loginNotifications: [true],
      apiAccess: [false]
    });
  }

  private createChangePasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  private loadCurrentSettings(): void {
    // Load settings from localStorage or API
    const savedSettings = this.loadSettingsFromStorage();
    
    if (savedSettings.general) {
      this.generalForm.patchValue(savedSettings.general);
      this.appearanceService.updateAppearance({
        theme: savedSettings.general.theme,
        defaultView: savedSettings.general.defaultView,
        fontSize: savedSettings.general.fontSize,
        density: savedSettings.general.density,
        colorScheme: savedSettings.general.colorScheme
      }, false);
    }

    if (savedSettings.workHours) {
      this.workHoursForm.patchValue(savedSettings.workHours);
      if (savedSettings.workHours.workDays) {
        this.workDayOptions.forEach(day => {
          day.selected = savedSettings.workHours.workDays.includes(day.value);
        });
      }
    }
    
    if (savedSettings.notifications) {
      this.notificationsForm.patchValue(savedSettings.notifications);
    }
    
    if (savedSettings.privacy) {
      this.privacyForm.patchValue(savedSettings.privacy);
    }
    
    if (savedSettings.security) {
      this.securityForm.patchValue(savedSettings.security);
    }
  }

  private loadSettingsFromStorage(): any {
    const defaultSettings = {
      general: {
        theme: 'light',
        colorScheme: 'ocean',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        weekStartDay: 'sunday',
        defaultView: 'list',
        fontSize: 'normal',
        density: 'comfortable'
      },
      workHours: {
        enabled: true,
        startTime: '09:00',
        endTime: '18:00',
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        breakDuration: 60
      },
      notifications: {
        emailNotifications: true,
        pushNotifications: true,
        taskReminders: true,
        projectUpdates: true,
        deadlineAlerts: true,
        teamMentions: true,
        dailyDigest: false,
        weeklyReport: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        reminderBefore: 30
      },
      privacy: {
        profileVisibility: 'team',
        activityTracking: true,
        dataSharing: false,
        marketingEmails: false,
        analytics: true
      },
      security: {
        twoFactorAuth: false,
        sessionTimeout: 60,
        loginNotifications: true,
        apiAccess: false
      }
    };

    try {
      const stored = localStorage.getItem('userSettings');
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return defaultSettings;
    }
  }

  private saveSettingsToStorage(settings: any): void {
    try {
      const currentSettings = this.loadSettingsFromStorage();
      const updatedSettings = { ...currentSettings, ...settings };
      localStorage.setItem('userSettings', JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  saveGeneralSettings(): void {
    if (this.generalForm.invalid) return;

    this.isGeneralLoading = true;
    const formValue = this.generalForm.value;

    // Simulate API call
    setTimeout(() => {
      this.saveSettingsToStorage({ general: formValue });
      this.appearanceService.updateAppearance({
        theme: formValue.theme,
        defaultView: formValue.defaultView,
        fontSize: formValue.fontSize,
        density: formValue.density,
        colorScheme: formValue.colorScheme
      }, true);
      this.showSuccessMessage('General settings saved successfully!');
      this.isGeneralLoading = false;
    }, 1000);
  }

  resetAppearanceDefaults(): void {
    this.generalForm.patchValue({
      theme: 'light',
      colorScheme: 'ocean',
      defaultView: 'list',
      fontSize: 'normal',
      density: 'comfortable'
    });

    this.appearanceService.updateAppearance({
      theme: 'light',
      colorScheme: 'ocean',
      defaultView: 'list',
      fontSize: 'normal',
      density: 'comfortable'
    }, false);

    this.showSuccessMessage('Appearance reset to default values. Save to keep these changes.');
  }

  saveWorkHoursSettings(): void {
    if (this.workHoursForm.invalid) return;

    this.isWorkHoursLoading = true;
    const formValue = this.workHoursForm.value;
    const selectedDays = this.workDayOptions
      .filter(d => d.selected)
      .map(d => d.value);

    // Simulate API call
    setTimeout(() => {
      this.saveSettingsToStorage({ workHours: { ...formValue, workDays: selectedDays } });
      this.showSuccessMessage('Work hours saved successfully!');
      this.isWorkHoursLoading = false;
    }, 1000);
  }

  saveNotificationSettings(): void {
    if (this.notificationsForm.invalid) return;

    this.isNotificationsLoading = true;
    const formValue = this.notificationsForm.value;

    // Simulate API call
    setTimeout(() => {
      this.saveSettingsToStorage({ notifications: formValue });
      this.showSuccessMessage('Notification settings saved successfully!');
      this.isNotificationsLoading = false;
    }, 1000);
  }

  savePrivacySettings(): void {
    if (this.privacyForm.invalid) return;

    this.isPrivacyLoading = true;
    const formValue = this.privacyForm.value;

    // Simulate API call
    setTimeout(() => {
      this.saveSettingsToStorage({ privacy: formValue });
      this.showSuccessMessage('Privacy settings saved successfully!');
      this.isPrivacyLoading = false;
    }, 1000);
  }

  saveSecuritySettings(): void {
    if (this.securityForm.invalid) return;

    this.isSecurityLoading = true;
    const formValue = this.securityForm.value;

    // Simulate API call
    setTimeout(() => {
      this.saveSettingsToStorage({ security: formValue });
      this.showSuccessMessage('Security settings saved successfully!');
      this.isSecurityLoading = false;
    }, 1000);
  }

  private setupAppearanceLivePreview(): void {
    this.generalForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value: Partial<AppSettings>) => {
        this.appearanceService.updateAppearance({
          theme: (value.theme || 'light') as AppSettings['theme'],
          defaultView: (value.defaultView || 'list') as AppSettings['defaultView'],
          fontSize: (value.fontSize || 'normal') as AppSettings['fontSize'],
          density: (value.density || 'comfortable') as AppSettings['density'],
          colorScheme: (value.colorScheme || 'ocean') as AppSettings['colorScheme']
        }, false);
      });
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }

  // Computed helpers
  get selectedWorkDaysCount(): number {
    return this.workDayOptions.filter(d => d.selected).length;
  }

  get workHoursPerDay(): number {
    const start = this.workHoursForm.get('startTime')?.value || '09:00';
    const end = this.workHoursForm.get('endTime')?.value || '18:00';
    const breakMin = this.workHoursForm.get('breakDuration')?.value || 60;

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const totalMin = (eh * 60 + em) - (sh * 60 + sm) - breakMin;
    return Math.max(0, Math.round(totalMin / 60 * 10) / 10);
  }

  get weeklyWorkHours(): number {
    return Math.round(this.workHoursPerDay * this.selectedWorkDaysCount * 10) / 10;
  }

  // Security Actions
  changePassword(): void {
    this.passwordErrorMessage = null;
    this.isChangePasswordLoading = false;
    this.hideCurrentPassword = true;
    this.hideNewPassword = true;
    this.hideConfirmPassword = true;
    this.changePasswordForm.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    this.passwordDialogRef = this.dialog.open(this.changePasswordDialog, {
      width: '560px',
      maxWidth: '95vw',
      autoFocus: false,
      disableClose: this.isChangePasswordLoading,
      panelClass: 'change-password-dialog'
    });

    this.passwordDialogRef.afterOpened().subscribe(() => {
      // Guard against browser/password-manager autofill on dialog mount.
      setTimeout(() => {
        this.changePasswordForm.reset({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }, 0);
    });

    this.passwordDialogRef.afterClosed().subscribe(() => {
      this.passwordDialogRef = null;
    });
  }

  cancelPasswordChange(): void {
    this.passwordErrorMessage = null;
    this.changePasswordForm.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    if (this.passwordDialogRef) {
      this.passwordDialogRef.close();
      this.passwordDialogRef = null;
    }
  }

  submitPasswordChange(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    const currentPassword = this.changePasswordForm.get('currentPassword')?.value;
    const newPassword = this.changePasswordForm.get('newPassword')?.value;
    const confirmPassword = this.changePasswordForm.get('confirmPassword')?.value;

    if (newPassword !== confirmPassword) {
      this.passwordErrorMessage = 'New password and confirm password must match.';
      return;
    }

    if (currentPassword === newPassword) {
      this.passwordErrorMessage = 'New password must be different from current password.';
      return;
    }

    this.isChangePasswordLoading = true;
    this.passwordErrorMessage = null;

    const payload: ChangePasswordRequest = {
      current_password: currentPassword,
      new_password: newPassword
    };

    this.authService.changePassword(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isChangePasswordLoading = false;
          this.changePasswordForm.reset({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          });

          if (this.passwordDialogRef) {
            this.passwordDialogRef.close();
            this.passwordDialogRef = null;
          }

          this.showSuccessMessage('Password changed successfully.');
        },
        error: (error) => {
          this.isChangePasswordLoading = false;
          this.passwordErrorMessage = error?.message || 'Failed to change password. Please try again.';
        }
      });
  }

  toggleCurrentPasswordVisibility(): void {
    this.hideCurrentPassword = !this.hideCurrentPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.hideNewPassword = !this.hideNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  viewLoginHistory(): void {
    this.loginHistoryLoading = true;
    this.loginHistoryErrorMessage = null;
    this.loginHistoryItems = [];

    this.loginHistoryDialogRef = this.dialog.open(this.loginHistoryDialog, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'login-history-dialog'
    });

    this.loginHistoryDialogRef.afterClosed().subscribe(() => {
      this.loginHistoryDialogRef = null;
    });

    const currentUser = this.authService.getCurrentUserValue();
    if (!currentUser?.id) {
      this.loginHistoryLoading = false;
      this.loginHistoryErrorMessage = 'Unable to identify current user.';
      return;
    }

    this.authService.getUserActivity(currentUser.id, 1, 25)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const loginLikeActions = response.activity.filter(item =>
            (item.action || '').toLowerCase().includes('login') ||
            (item.action || '').toLowerCase().includes('logout') ||
            (item.action || '').toLowerCase().includes('auth')
          );

          this.loginHistoryItems = loginLikeActions;
          this.loginHistoryLoading = false;
        },
        error: (error) => {
          this.loginHistoryLoading = false;
          this.loginHistoryErrorMessage = error?.message || 'Failed to load login history.';
        }
      });
  }

  formatLoginAction(action: string): string {
    if (!action) {
      return 'Login activity';
    }

    return action
      .split('_')
      .join(' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  getLoginActionIcon(action: string): string {
    const normalized = (action || '').toLowerCase();
    if (normalized.includes('logout')) {
      return 'logout';
    }
    if (normalized.includes('failed')) {
      return 'error';
    }
    return 'login';
  }

  getLoginActionTone(action: string): 'login' | 'logout' | 'failed' {
    const normalized = (action || '').toLowerCase();
    if (normalized.includes('logout')) {
      return 'logout';
    }
    if (normalized.includes('failed')) {
      return 'failed';
    }
    return 'login';
  }

  getLoginEventDayLabel(createdAt: string): string {
    const eventDate = new Date(createdAt);
    if (Number.isNaN(eventDate.getTime())) {
      return 'Unknown';
    }

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfEventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

    const dayDiff = Math.round((startOfEventDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      return 'Today';
    }
    if (dayDiff === -1) {
      return 'Yesterday';
    }
    if (dayDiff === 1) {
      return 'Tomorrow';
    }
    return eventDate.toLocaleDateString();
  }

  closeLoginHistoryDialog(): void {
    if (this.loginHistoryDialogRef) {
      this.loginHistoryDialogRef.close();
      this.loginHistoryDialogRef = null;
    }
  }

  downloadData(): void {
    console.log('Download user data');
    // TODO: Implement data export functionality
    this.showSuccessMessage('Data export request submitted. You will receive an email when ready.');
  }

  deleteAccount(): void {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
    );
    
    if (confirmed) {
      const doubleConfirmed = confirm(
        'This is your final warning. Type "DELETE" to confirm account deletion.'
      );
      
      if (doubleConfirmed) {
        console.log('Delete account');
        // TODO: Implement account deletion
        this.showSuccessMessage('Account deletion request submitted.');
      }
    }
  }
}

