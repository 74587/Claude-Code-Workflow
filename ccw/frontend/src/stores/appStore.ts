// ========================================
// App Store
// ========================================
// Manages UI state: theme, sidebar, view, loading, error

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { AppStore, Theme, ColorScheme, GradientLevel, Locale, ViewMode, SessionFilter, LiteTaskType, DashboardLayouts, WidgetConfig } from '../types/store';
import { DEFAULT_DASHBOARD_LAYOUT } from '../components/dashboard/defaultLayouts';
import { getInitialLocale, updateIntl } from '../lib/i18n';
import { getThemeId } from '../lib/theme';
import { generateThemeFromHue } from '../lib/colorGenerator';

// Helper to resolve system theme
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Helper to resolve theme based on preference
const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

/**
 * DOM Theme Application Helper
 *
 * ARCHITECTURAL NOTE: This function contains DOM manipulation logic that ideally
 * belongs in a React component/hook rather than a store. However, it's placed
 * here for pragmatic reasons:
 * - Immediate theme application without React render cycle
 * - SSR compatibility (checks for document/window)
 * - Backward compatibility with existing codebase
 *
 * FUTURE IMPROVEMENT: Move theme application to a ThemeProvider component using
 * useEffect to listen for store changes. This would properly separate concerns.
 */
const applyThemeToDocument = (
  resolvedTheme: 'light' | 'dark',
  colorScheme: ColorScheme,
  customHue: number | null,
  gradientLevel: GradientLevel = 'standard',
  enableHoverGlow: boolean = true,
  enableBackgroundAnimation: boolean = false
): void => {
  if (typeof document === 'undefined') return;

  // Define the actual DOM update logic
  const performThemeUpdate = () => {
    // Update document classes
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);

    // Clear custom CSS variables list (includes both new and legacy variables)
    const customVars = [
      // New theme system variables
      '--bg', '--bg-secondary', '--surface', '--surface-hover',
      '--border', '--border-hover', '--text', '--text-secondary',
      '--text-tertiary', '--text-disabled', '--accent', '--accent-hover',
      '--accent-active', '--accent-light', '--accent-lighter', '--primary',
      '--primary-hover', '--primary-light', '--primary-lighter', '--secondary',
      '--secondary-hover', '--secondary-light', '--muted', '--muted-hover',
      '--muted-text', '--success', '--success-light', '--success-text',
      '--warning', '--warning-light', '--warning-text', '--error',
      '--error-light', '--error-text', '--info', '--info-light',
      '--info-text', '--destructive', '--destructive-hover', '--destructive-light',
      '--hover', '--active', '--focus',
      // Legacy shadcn/ui compatibility variables
      '--background', '--foreground', '--card', '--card-foreground',
      '--primary-foreground', '--secondary-foreground', '--accent-foreground',
      '--destructive-foreground', '--muted-foreground', '--sidebar-background',
      '--sidebar-foreground', '--input', '--ring', '--indigo', '--indigo-light',
      '--orange', '--orange-light'
    ];

    // Apply custom theme or preset theme
    if (customHue !== null) {
      const cssVars = generateThemeFromHue(customHue, resolvedTheme);
      Object.entries(cssVars).forEach(([varName, varValue]) => {
        document.documentElement.style.setProperty(varName, varValue);
      });
      document.documentElement.setAttribute('data-theme', `custom-${resolvedTheme}`);
    } else {
      // Clear custom CSS variables
      customVars.forEach(varName => {
        document.documentElement.style.removeProperty(varName);
      });
      // Apply preset theme
      const themeId = getThemeId(colorScheme, resolvedTheme);
      document.documentElement.setAttribute('data-theme', themeId);
    }

    // Set color scheme attribute
    document.documentElement.setAttribute('data-color-scheme', colorScheme);

    // Apply gradient settings
    document.documentElement.setAttribute('data-gradient', gradientLevel);
    document.documentElement.setAttribute('data-hover-glow', String(enableHoverGlow));
    document.documentElement.setAttribute('data-bg-animation', String(enableBackgroundAnimation));
  };

  // Use View Transition API for smooth transitions (progressive enhancement)
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as unknown as { startViewTransition: (callback: () => void) => void }).startViewTransition(performThemeUpdate);
  } else {
    // Fallback: apply immediately without transition
    performThemeUpdate();
  }
};

// Initial state
const initialState = {
  // Theme
  theme: 'system' as Theme,
  resolvedTheme: 'light' as 'light' | 'dark',
  colorScheme: 'blue' as ColorScheme, // New: default to blue scheme
  customHue: null as number | null,
  isCustomTheme: false,

  // Gradient settings
  gradientLevel: 'standard' as GradientLevel,
  enableHoverGlow: true,
  enableBackgroundAnimation: false,

  // Locale
  locale: getInitialLocale() as Locale,

  // Sidebar
  sidebarOpen: true,
  sidebarCollapsed: false,
  expandedNavGroups: ['overview', 'workflow', 'knowledge', 'issues', 'tools', 'configuration'] as string[],

  // View state
  currentView: 'sessions' as ViewMode,
  currentFilter: 'all' as SessionFilter,
  currentLiteType: null as LiteTaskType,
  currentSessionDetailKey: null as string | null,

  // Loading and error states
  isLoading: false,
  loadingMessage: null as string | null,
  error: null as string | null,

  // Dashboard layout
  dashboardLayout: null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========== Theme Actions ==========

        setTheme: (theme: Theme) => {
          const resolved = resolveTheme(theme);
          set({ theme, resolvedTheme: resolved }, false, 'setTheme');

          // Apply theme using helper (encapsulates DOM manipulation)
          const { colorScheme, customHue, gradientLevel, enableHoverGlow, enableBackgroundAnimation } = get();
          applyThemeToDocument(resolved, colorScheme, customHue, gradientLevel, enableHoverGlow, enableBackgroundAnimation);
        },

        setColorScheme: (colorScheme: ColorScheme) => {
          set({ colorScheme, customHue: null, isCustomTheme: false }, false, 'setColorScheme');

          // Apply color scheme using helper (encapsulates DOM manipulation)
          const { resolvedTheme, gradientLevel, enableHoverGlow, enableBackgroundAnimation } = get();
          applyThemeToDocument(resolvedTheme, colorScheme, null, gradientLevel, enableHoverGlow, enableBackgroundAnimation);
        },

        setCustomHue: (hue: number | null) => {
          if (hue === null) {
            // Reset to preset theme
            const { colorScheme, resolvedTheme, gradientLevel, enableHoverGlow, enableBackgroundAnimation } = get();
            set({ customHue: null, isCustomTheme: false }, false, 'setCustomHue');
            applyThemeToDocument(resolvedTheme, colorScheme, null, gradientLevel, enableHoverGlow, enableBackgroundAnimation);
            return;
          }

          // Apply custom hue
          set({ customHue: hue, isCustomTheme: true }, false, 'setCustomHue');
          const { resolvedTheme, colorScheme, gradientLevel, enableHoverGlow, enableBackgroundAnimation } = get();
          applyThemeToDocument(resolvedTheme, colorScheme, hue, gradientLevel, enableHoverGlow, enableBackgroundAnimation);
        },

        toggleTheme: () => {
          const { theme } = get();
          const newTheme: Theme = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'dark';
          get().setTheme(newTheme);
        },

        // ========== Gradient Settings Actions ==========

        setGradientLevel: (level: GradientLevel) => {
          set({ gradientLevel: level }, false, 'setGradientLevel');
          const { resolvedTheme, colorScheme, customHue, enableHoverGlow, enableBackgroundAnimation } = get();
          applyThemeToDocument(resolvedTheme, colorScheme, customHue, level, enableHoverGlow, enableBackgroundAnimation);
        },

        setEnableHoverGlow: (enabled: boolean) => {
          set({ enableHoverGlow: enabled }, false, 'setEnableHoverGlow');
          const { resolvedTheme, colorScheme, customHue, gradientLevel, enableBackgroundAnimation } = get();
          applyThemeToDocument(resolvedTheme, colorScheme, customHue, gradientLevel, enabled, enableBackgroundAnimation);
        },

        setEnableBackgroundAnimation: (enabled: boolean) => {
          set({ enableBackgroundAnimation: enabled }, false, 'setEnableBackgroundAnimation');
          const { resolvedTheme, colorScheme, customHue, gradientLevel, enableHoverGlow } = get();
          applyThemeToDocument(resolvedTheme, colorScheme, customHue, gradientLevel, enableHoverGlow, enabled);
        },

        // ========== Locale Actions ==========

        setLocale: (locale: Locale) => {
          set({ locale }, false, 'setLocale');
          updateIntl(locale);
        },

        // ========== Sidebar Actions ==========

        setSidebarOpen: (open: boolean) => {
          set({ sidebarOpen: open }, false, 'setSidebarOpen');
        },

        toggleSidebar: () => {
          set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, 'toggleSidebar');
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
        },

        setExpandedNavGroups: (groups: string[]) => {
          set({ expandedNavGroups: groups }, false, 'setExpandedNavGroups');
        },

        // ========== View Actions ==========

        setCurrentView: (view: ViewMode) => {
          set({ currentView: view }, false, 'setCurrentView');
        },

        setCurrentFilter: (filter: SessionFilter) => {
          set({ currentFilter: filter }, false, 'setCurrentFilter');
        },

        setCurrentLiteType: (type: LiteTaskType) => {
          set({ currentLiteType: type }, false, 'setCurrentLiteType');
        },

        setCurrentSessionDetailKey: (key: string | null) => {
          set({ currentSessionDetailKey: key }, false, 'setCurrentSessionDetailKey');
        },

        // ========== Loading/Error Actions ==========

        setLoading: (loading: boolean, message: string | null = null) => {
          set({ isLoading: loading, loadingMessage: message }, false, 'setLoading');
        },

        setError: (error: string | null) => {
          set({ error }, false, 'setError');
        },

        clearError: () => {
          set({ error: null }, false, 'clearError');
        },

        // ========== Dashboard Layout Actions ==========

        setDashboardLayouts: (layouts: DashboardLayouts) => {
          set(
            (state) => ({
              dashboardLayout: {
                widgets: state.dashboardLayout?.widgets || DEFAULT_DASHBOARD_LAYOUT.widgets,
                layouts,
              },
            }),
            false,
            'setDashboardLayouts'
          );
        },

        setDashboardWidgets: (widgets: WidgetConfig[]) => {
          set(
            (state) => ({
              dashboardLayout: {
                widgets,
                layouts: state.dashboardLayout?.layouts || DEFAULT_DASHBOARD_LAYOUT.layouts,
              },
            }),
            false,
            'setDashboardWidgets'
          );
        },

        resetDashboardLayout: () => {
          set({ dashboardLayout: DEFAULT_DASHBOARD_LAYOUT }, false, 'resetDashboardLayout');
        },
      }),
      {
        name: 'ccw-app-store',
        // Only persist theme and locale preferences
        partialize: (state) => ({
          theme: state.theme,
          colorScheme: state.colorScheme,
          customHue: state.customHue,
          gradientLevel: state.gradientLevel,
          enableHoverGlow: state.enableHoverGlow,
          enableBackgroundAnimation: state.enableBackgroundAnimation,
          locale: state.locale,
          sidebarCollapsed: state.sidebarCollapsed,
          expandedNavGroups: state.expandedNavGroups,
          dashboardLayout: state.dashboardLayout,
        }),
        onRehydrateStorage: () => (state) => {
          // Apply theme on rehydration
          if (state) {
            const resolved = resolveTheme(state.theme);
            state.resolvedTheme = resolved;
            state.isCustomTheme = state.customHue !== null;
            // Apply theme using helper (encapsulates DOM manipulation)
            applyThemeToDocument(
              resolved,
              state.colorScheme,
              state.customHue,
              state.gradientLevel ?? 'standard',
              state.enableHoverGlow ?? true,
              state.enableBackgroundAnimation ?? false
            );
          }
          // Apply locale on rehydration
          if (state) {
            updateIntl(state.locale);
          }
        },
      }
    ),
    { name: 'AppStore' }
  )
);

// Setup system theme listener
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const state = useAppStore.getState();
    if (state.theme === 'system') {
      const resolved = getSystemTheme();
      useAppStore.setState({ resolvedTheme: resolved });
      // Apply theme using helper (encapsulates DOM manipulation)
      applyThemeToDocument(
        resolved,
        state.colorScheme,
        state.customHue,
        state.gradientLevel,
        state.enableHoverGlow,
        state.enableBackgroundAnimation
      );
    }
  });
}

// Selectors for common access patterns
export const selectTheme = (state: AppStore) => state.theme;
export const selectResolvedTheme = (state: AppStore) => state.resolvedTheme;
export const selectColorScheme = (state: AppStore) => state.colorScheme;
export const selectCustomHue = (state: AppStore) => state.customHue;
export const selectIsCustomTheme = (state: AppStore) => state.isCustomTheme;
export const selectGradientLevel = (state: AppStore) => state.gradientLevel;
export const selectEnableHoverGlow = (state: AppStore) => state.enableHoverGlow;
export const selectEnableBackgroundAnimation = (state: AppStore) => state.enableBackgroundAnimation;
export const selectLocale = (state: AppStore) => state.locale;
export const selectSidebarOpen = (state: AppStore) => state.sidebarOpen;
export const selectCurrentView = (state: AppStore) => state.currentView;
export const selectIsLoading = (state: AppStore) => state.isLoading;
export const selectError = (state: AppStore) => state.error;
