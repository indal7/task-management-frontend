import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type DefaultView = 'list' | 'grid' | 'kanban';
export type FontSizeMode = 'normal' | 'large' | 'xlarge';
export type DensityMode = 'comfortable' | 'standard' | 'compact';
export type ColorSchemeMode = 'ocean' | 'forest' | 'sunset';

export interface AppearanceSettings {
  theme: ThemeMode;
  defaultView: DefaultView;
  fontSize: FontSizeMode;
  density: DensityMode;
  colorScheme: ColorSchemeMode;
}

interface UserSettingsShape {
  general?: Partial<AppearanceSettings> & Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class AppearanceService {
  private readonly storageKey = 'userSettings';
  private readonly defaults: AppearanceSettings = {
    theme: 'light',
    defaultView: 'list',
    fontSize: 'normal',
    density: 'comfortable',
    colorScheme: 'ocean'
  };

  private readonly appearanceSubject = new BehaviorSubject<AppearanceSettings>(this.readAppearanceFromStorage());
  readonly appearance$: Observable<AppearanceSettings> = this.appearanceSubject.asObservable();

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

  initialize(): void {
    const current = this.readAppearanceFromStorage();
    this.appearanceSubject.next(current);
    this.applyAppearance(current);
    this.bindSystemThemeListener(current.theme);
  }

  getCurrentSettings(): AppearanceSettings {
    return this.appearanceSubject.value;
  }

  updateAppearance(partial: Partial<AppearanceSettings>, persist = true): void {
    const next: AppearanceSettings = {
      ...this.appearanceSubject.value,
      ...partial
    };

    this.appearanceSubject.next(next);
    this.applyAppearance(next);
    this.bindSystemThemeListener(next.theme);

    if (persist) {
      this.persistAppearance(next);
    }
  }

  setTheme(theme: ThemeMode, persist = true): void {
    this.updateAppearance({ theme }, persist);
  }

  setDefaultView(defaultView: DefaultView, persist = true): void {
    this.updateAppearance({ defaultView }, persist);
  }

  setFontSize(fontSize: FontSizeMode, persist = true): void {
    this.updateAppearance({ fontSize }, persist);
  }

  setDensity(density: DensityMode, persist = true): void {
    this.updateAppearance({ density }, persist);
  }

  setColorScheme(colorScheme: ColorSchemeMode, persist = true): void {
    this.updateAppearance({ colorScheme }, persist);
  }

  isDarkModeActive(): boolean {
    return document.body.classList.contains('dark-theme');
  }

  private readAppearanceFromStorage(): AppearanceSettings {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed: UserSettingsShape = raw ? JSON.parse(raw) : {};
      const general = parsed?.general || {};

      return {
        theme: this.normalizeTheme(general.theme),
        defaultView: this.normalizeDefaultView(general.defaultView),
        fontSize: this.normalizeFontSize(general.fontSize),
        density: this.normalizeDensity(general.density),
        colorScheme: this.normalizeColorScheme(general.colorScheme)
      };
    } catch {
      return { ...this.defaults };
    }
  }

  private persistAppearance(settings: AppearanceSettings): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed: UserSettingsShape = raw ? JSON.parse(raw) : {};
      parsed.general = {
        ...(parsed.general || {}),
        ...settings
      };
      localStorage.setItem(this.storageKey, JSON.stringify(parsed));
    } catch {
      // Swallow localStorage errors to avoid breaking app rendering.
    }
  }

  private applyAppearance(settings: AppearanceSettings): void {
    this.applyTheme(settings.theme);
    this.applyFontSize(settings.fontSize);
    this.applyDensity(settings.density);
    this.applyColorScheme(settings.colorScheme);
  }

  private applyTheme(theme: ThemeMode): void {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
      return;
    }

    body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
  }

  private applyFontSize(fontSize: FontSizeMode): void {
    const root = document.documentElement;
    root.classList.remove('font-normal', 'font-large', 'font-xlarge');
    root.classList.add(`font-${fontSize}`);
  }

  private applyDensity(density: DensityMode): void {
    const body = document.body;
    body.classList.remove('density-comfortable', 'density-standard', 'density-compact');
    body.classList.add(`density-${density}`);
  }

  private applyColorScheme(colorScheme: ColorSchemeMode): void {
    const body = document.body;
    body.classList.remove('scheme-ocean', 'scheme-forest', 'scheme-sunset');
    body.classList.add(`scheme-${colorScheme}`);
  }

  private bindSystemThemeListener(theme: ThemeMode): void {
    if (!this.mediaQuery) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    if (!this.mediaListener) {
      this.mediaListener = () => {
        if (this.appearanceSubject.value.theme === 'auto') {
          this.applyTheme('auto');
        }
      };
    }

    this.mediaQuery.removeEventListener('change', this.mediaListener);
    if (theme === 'auto') {
      this.mediaQuery.addEventListener('change', this.mediaListener);
    }
  }

  private normalizeTheme(theme: unknown): ThemeMode {
    return theme === 'dark' || theme === 'auto' ? theme : 'light';
  }

  private normalizeDefaultView(defaultView: unknown): DefaultView {
    return defaultView === 'grid' || defaultView === 'kanban' ? defaultView : 'list';
  }

  private normalizeFontSize(fontSize: unknown): FontSizeMode {
    return fontSize === 'large' || fontSize === 'xlarge' ? fontSize : 'normal';
  }

  private normalizeDensity(density: unknown): DensityMode {
    if (density === 'standard' || density === 'compact') {
      return density;
    }
    return 'comfortable';
  }

  private normalizeColorScheme(colorScheme: unknown): ColorSchemeMode {
    if (colorScheme === 'forest' || colorScheme === 'sunset') {
      return colorScheme;
    }
    return 'ocean';
  }
}