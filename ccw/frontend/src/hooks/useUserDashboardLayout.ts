// ========================================
// useUserDashboardLayout Hook
// ========================================
// Hook for managing user's dashboard layout with localStorage persistence

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useLocalStorage } from './useLocalStorage';
import type { DashboardLayouts, WidgetConfig } from '@/types/store';
import { DEFAULT_DASHBOARD_LAYOUT } from '@/components/dashboard/defaultLayouts';

const DEBOUNCE_DELAY = 1000; // 1 second debounce for layout saves
const STORAGE_KEY = 'ccw-dashboard-layout';

// Version for layout schema - increment when widget IDs change
const LAYOUT_VERSION = 2; // v2: workflow-task + recent-sessions

export interface UseUserDashboardLayoutResult {
  /** Current dashboard layouts */
  layouts: DashboardLayouts;
  /** Current widget configurations */
  widgets: WidgetConfig[];
  /** Update layouts (debounced) */
  updateLayouts: (newLayouts: DashboardLayouts) => void;
  /** Update widgets configuration */
  updateWidgets: (newWidgets: WidgetConfig[]) => void;
  /** Reset to default layout */
  resetLayout: () => void;
  /** Whether layout is being saved */
  isSaving: boolean;
}

/**
 * Hook for managing dashboard layout with localStorage and Zustand persistence
 *
 * Features:
 * - Loads layout from Zustand store (persisted to localStorage via Zustand)
 * - Debounced layout updates (1s delay)
 * - Reset to default layout
 * - Additional localStorage backup for redundancy
 *
 * @example
 * ```tsx
 * const { layouts, updateLayouts, resetLayout } = useUserDashboardLayout();
 *
 * const handleLayoutChange = (newLayouts) => {
 *   updateLayouts(newLayouts);
 * };
 * ```
 */
export function useUserDashboardLayout(): UseUserDashboardLayoutResult {
  // Get layout from Zustand store
  const dashboardLayout = useAppStore((state) => state.dashboardLayout);
  const setDashboardLayouts = useAppStore((state) => state.setDashboardLayouts);
  const setDashboardWidgets = useAppStore((state) => state.setDashboardWidgets);
  const resetDashboardLayout = useAppStore((state) => state.resetDashboardLayout);

  // Additional localStorage backup (for redundancy)
  const [, setLocalStorageLayout] = useLocalStorage(STORAGE_KEY, DEFAULT_DASHBOARD_LAYOUT);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Initialize layout if not set or version mismatch
  useEffect(() => {
    // Check if stored version matches current version
    const storedVersion = localStorage.getItem(`${STORAGE_KEY}-version`);
    const versionMismatch = storedVersion !== String(LAYOUT_VERSION);

    if (versionMismatch) {
      // Version mismatch - reset to default and update version
      console.log(`Dashboard layout version changed (${storedVersion} -> ${LAYOUT_VERSION}), resetting to default`);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(`${STORAGE_KEY}-version`, String(LAYOUT_VERSION));

      // Also clear dashboardLayout from Zustand persist storage
      try {
        const zustandStorage = localStorage.getItem('ccw-app-store');
        if (zustandStorage) {
          const parsed = JSON.parse(zustandStorage);
          if (parsed.state?.dashboardLayout) {
            delete parsed.state.dashboardLayout;
            localStorage.setItem('ccw-app-store', JSON.stringify(parsed));
          }
        }
      } catch (e) {
        console.warn('Failed to clear Zustand dashboard layout:', e);
      }

      resetDashboardLayout();
      return;
    }

    if (!dashboardLayout) {
      // Try to load from localStorage first
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setDashboardLayouts(parsed.layouts);
          setDashboardWidgets(parsed.widgets);
        } else {
          // Use default layout
          resetDashboardLayout();
        }
      } catch (error) {
        console.warn('Failed to load dashboard layout from localStorage:', error);
        resetDashboardLayout();
      }
    }
  }, [dashboardLayout, setDashboardLayouts, setDashboardWidgets, resetDashboardLayout]);

  // Update layouts with debouncing
  const updateLayouts = useCallback(
    (newLayouts: DashboardLayouts) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set saving state
      isSavingRef.current = true;

      // Debounce the update
      debounceTimerRef.current = setTimeout(() => {
        // Update Zustand store (which will persist to localStorage)
        setDashboardLayouts(newLayouts);

        // Also save to additional localStorage backup with version
        const currentWidgets = dashboardLayout?.widgets || DEFAULT_DASHBOARD_LAYOUT.widgets;
        setLocalStorageLayout({ layouts: newLayouts, widgets: currentWidgets });
        localStorage.setItem(`${STORAGE_KEY}-version`, String(LAYOUT_VERSION));

        // TODO: When backend API is ready, uncomment this:
        // syncToBackend({ layouts: newLayouts, widgets: currentWidgets });

        isSavingRef.current = false;
      }, DEBOUNCE_DELAY);
    },
    [dashboardLayout, setDashboardLayouts, setLocalStorageLayout]
  );

  // Update widgets configuration
  const updateWidgets = useCallback(
    (newWidgets: WidgetConfig[]) => {
      setDashboardWidgets(newWidgets);

      // Also save to localStorage backup with version
      const currentLayouts = dashboardLayout?.layouts || DEFAULT_DASHBOARD_LAYOUT.layouts;
      setLocalStorageLayout({ layouts: currentLayouts, widgets: newWidgets });
      localStorage.setItem(`${STORAGE_KEY}-version`, String(LAYOUT_VERSION));

      // TODO: When backend API is ready, uncomment this:
      // syncToBackend({ layouts: currentLayouts, widgets: newWidgets });
    },
    [dashboardLayout, setDashboardWidgets, setLocalStorageLayout]
  );

  // Reset to default layout
  const resetLayout = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Reset Zustand store
    resetDashboardLayout();

    // Reset localStorage backup with version
    setLocalStorageLayout(DEFAULT_DASHBOARD_LAYOUT);
    localStorage.setItem(`${STORAGE_KEY}-version`, String(LAYOUT_VERSION));

    // TODO: When backend API is ready, uncomment this:
    // syncToBackend(DEFAULT_DASHBOARD_LAYOUT);
  }, [resetDashboardLayout, setLocalStorageLayout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    layouts: dashboardLayout?.layouts || DEFAULT_DASHBOARD_LAYOUT.layouts,
    widgets: dashboardLayout?.widgets || DEFAULT_DASHBOARD_LAYOUT.widgets,
    updateLayouts,
    updateWidgets,
    resetLayout,
    isSaving: isSavingRef.current,
  };
}

/**
 * TODO: Implement backend sync when API is ready
 *
 * async function syncToBackend(layout: DashboardLayoutState) {
 *   try {
 *     await fetch('/api/user/dashboard-layout', {
 *       method: 'PUT',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify(layout),
 *     });
 *   } catch (error) {
 *     console.error('Failed to sync dashboard layout to backend:', error);
 *   }
 * }
 */
