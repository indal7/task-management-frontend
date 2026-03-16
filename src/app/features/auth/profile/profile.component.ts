import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { EnumService } from '../../../core/services/enum.service';
import { User, ProfileUpdateRequest, ChangePasswordRequest, DropdownOption } from '../../../core/models';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  currentUser: User | null = null;
  profileForm: FormGroup;
  passwordForm: FormGroup;
  
  isProfileLoading = false;
  isPasswordLoading = false;
  profileError: string | null = null;
  passwordError: string | null = null;
  profileSuccess: string | null = null;
  passwordSuccess: string | null = null;
  
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  
  roleOptions: DropdownOption[] = [];
  
  selectedTabIndex = 0;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private enumService: EnumService
  ) {
    this.profileForm = this.createProfileForm();
    this.passwordForm = this.createPasswordForm();
  }

  ngOnInit(): void {
    this.setupSubscriptions();
    this.loadRoleOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    // Current user
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.populateProfileForm(user);
        }
      });

    // Loading states
    this.authService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        // Handle specific loading states if needed
      });
  }

  private loadRoleOptions(): void {
    this.roleOptions = this.enumService.getUserRoleOptions();
  }

  private createProfileForm(): FormGroup {
    return this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      bio: ['', [Validators.maxLength(500)]],
      skills: [''],
      github_username: ['', [Validators.maxLength(50)]],
      linkedin_url: ['', [Validators.pattern(/^https?:\/\/(www\.)?linkedin\.com\/.*$/)]],
      phone: ['', [Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      timezone: ['UTC', [Validators.required]],
      daily_work_hours: [8, [Validators.required, Validators.min(1), Validators.max(24)]],
      hourly_rate: [null, [Validators.min(0)]]
    });
  }

  private createPasswordForm(): FormGroup {
    return this.formBuilder.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('new_password');
    const confirmPassword = form.get('confirm_password');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }

  private populateProfileForm(user: User): void {
    this.profileForm.patchValue({
      name: user.name,
      email: user.email,
      bio: user.bio || '',
      skills: user.skills ? user.skills.join(', ') : '',
      github_username: user.github_username || '',
      linkedin_url: user.linkedin_url || '',
      phone: user.phone || '',
      timezone: user.timezone,
      daily_work_hours: user.daily_work_hours,
      hourly_rate: user.hourly_rate
    });
  }

  onProfileSubmit(): void {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched(this.profileForm);
      return;
    }

    this.isProfileLoading = true;
    this.profileError = null;
    this.profileSuccess = null;

    const formValue = this.profileForm.value;
    const profileData: ProfileUpdateRequest = {
      name: formValue.name,
      email: formValue.email,
      bio: formValue.bio || undefined,
      skills: formValue.skills ? formValue.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s) : undefined,
      github_username: formValue.github_username || undefined,
      linkedin_url: formValue.linkedin_url || undefined,
      phone: formValue.phone || undefined,
      timezone: formValue.timezone,
      daily_work_hours: formValue.daily_work_hours,
      hourly_rate: formValue.hourly_rate,
    };

    this.authService.updateProfile(profileData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.isProfileLoading = false;
          this.profileSuccess = 'Profile updated successfully!';
          console.log('Profile updated:', user);
        },
        error: (error) => {
          this.isProfileLoading = false;
          this.profileError = error.message || 'Failed to update profile. Please try again.';
          console.error('Profile update failed:', error);
        }
      });
  }

  onPasswordSubmit(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      return;
    }

    this.isPasswordLoading = true;
    this.passwordError = null;
    this.passwordSuccess = null;

    const formValue = this.passwordForm.value;
    const passwordData: ChangePasswordRequest = {
      current_password: formValue.current_password,
      new_password: formValue.new_password
    };

    this.authService.changePassword(passwordData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isPasswordLoading = false;
          this.passwordSuccess = 'Password changed successfully!';
          this.passwordForm.reset();
        },
        error: (error) => {
          this.isPasswordLoading = false;
          this.passwordError = error.message || 'Failed to change password. Please try again.';
          console.error('Password change failed:', error);
        }
      });
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    // Clear messages when switching tabs
    this.profileError = null;
    this.profileSuccess = null;
    this.passwordError = null;
    this.passwordSuccess = null;
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

  getUserInitials(): string {
    if (!this.currentUser?.name) return 'U';
    
    const names = this.currentUser.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  }

  getUserRoleLabel(): string {
    return this.enumService.getUserRoleLabel(this.currentUser?.role || '');
  }

  // Form validation helpers
  getFieldError(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        const minLength = field.errors['minlength'].requiredLength;
        return `${this.getFieldLabel(fieldName)} must be at least ${minLength} characters long`;
      }
      if (field.errors['maxlength']) {
        const maxLength = field.errors['maxlength'].requiredLength;
        return `${this.getFieldLabel(fieldName)} cannot exceed ${maxLength} characters`;
      }
      if (field.errors['min']) {
        const min = field.errors['min'].min;
        return `${this.getFieldLabel(fieldName)} must be at least ${min}`;
      }
      if (field.errors['max']) {
        const max = field.errors['max'].max;
        return `${this.getFieldLabel(fieldName)} cannot exceed ${max}`;
      }
      if (field.errors['pattern']) {
        if (fieldName === 'linkedin_url') {
          return 'Please enter a valid LinkedIn URL';
        }
        if (fieldName === 'phone') {
          return 'Please enter a valid phone number';
        }
        return 'Please enter a valid format';
      }
      if (field.errors['passwordMismatch']) {
        return 'Passwords do not match';
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Full Name',
      email: 'Email',
      bio: 'Bio',
      skills: 'Skills',
      github_username: 'GitHub Username',
      linkedin_url: 'LinkedIn URL',
      phone: 'Phone',
      timezone: 'Timezone',
      daily_work_hours: 'Daily Work Hours',
      hourly_rate: 'Hourly Rate',
      current_password: 'Current Password',
      new_password: 'New Password',
      confirm_password: 'Confirm Password'
    };
    return labels[fieldName] || fieldName;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  // Get common timezones for the dropdown
  getTimezoneOptions(): { value: string; label: string }[] {
    return [
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
  }
}