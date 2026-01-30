// ========================================
// useConfig Hook
// ========================================
// Convenient hook for configuration management

import { useCallback } from 'react';
import {
  useConfigStore,
  selectCliTools,
  selectDefaultCliTool,
  selectApiEndpoints,
  selectUserPreferences,
  selectFeatureFlags,
  getFirstEnabledCliTool,
} from '../stores/configStore';
import type { CliToolConfig, ApiEndpoints, UserPreferences, ConfigState } from '../types/store';

export interface UseConfigReturn {
  /** CLI tools configuration */
  cliTools: Record<string, CliToolConfig>;
  /** Default CLI tool ID */
  defaultCliTool: string;
  /** First enabled CLI tool (fallback) */
  firstEnabledTool: string;
  /** API endpoints */
  apiEndpoints: ApiEndpoints;
  /** User preferences */
  userPreferences: UserPreferences;
  /** Feature flags */
  featureFlags: Record<string, boolean>;
  /** Update CLI tool config */
  updateCliTool: (toolId: string, updates: Partial<CliToolConfig>) => void;
  /** Set default CLI tool */
  setDefaultCliTool: (toolId: string) => void;
  /** Update user preferences */
  setUserPreferences: (prefs: Partial<UserPreferences>) => void;
  /** Reset user preferences to defaults */
  resetUserPreferences: () => void;
  /** Set a feature flag */
  setFeatureFlag: (flag: string, enabled: boolean) => void;
  /** Check if a feature is enabled */
  isFeatureEnabled: (flag: string) => boolean;
  /** Load full config */
  loadConfig: (config: Partial<ConfigState>) => void;
}

/**
 * Hook for managing configuration state
 * @returns Config state and actions
 *
 * @example
 * ```tsx
 * const { cliTools, defaultCliTool, userPreferences, setUserPreferences } = useConfig();
 *
 * return (
 *   <SettingsPanel
 *     preferences={userPreferences}
 *     onUpdate={setUserPreferences}
 *   />
 * );
 * ```
 */
export function useConfig(): UseConfigReturn {
  const cliTools = useConfigStore(selectCliTools);
  const defaultCliTool = useConfigStore(selectDefaultCliTool);
  const apiEndpoints = useConfigStore(selectApiEndpoints);
  const userPreferences = useConfigStore(selectUserPreferences);
  const featureFlags = useConfigStore(selectFeatureFlags);

  // Actions
  const updateCliToolAction = useConfigStore((state) => state.updateCliTool);
  const setDefaultCliToolAction = useConfigStore((state) => state.setDefaultCliTool);
  const setUserPreferencesAction = useConfigStore((state) => state.setUserPreferences);
  const resetUserPreferencesAction = useConfigStore((state) => state.resetUserPreferences);
  const setFeatureFlagAction = useConfigStore((state) => state.setFeatureFlag);
  const loadConfigAction = useConfigStore((state) => state.loadConfig);

  // Computed values
  const firstEnabledTool = getFirstEnabledCliTool(cliTools);

  // Callbacks
  const updateCliTool = useCallback(
    (toolId: string, updates: Partial<CliToolConfig>) => {
      updateCliToolAction(toolId, updates);
    },
    [updateCliToolAction]
  );

  const setDefaultCliTool = useCallback(
    (toolId: string) => {
      setDefaultCliToolAction(toolId);
    },
    [setDefaultCliToolAction]
  );

  const setUserPreferences = useCallback(
    (prefs: Partial<UserPreferences>) => {
      setUserPreferencesAction(prefs);
    },
    [setUserPreferencesAction]
  );

  const resetUserPreferences = useCallback(() => {
    resetUserPreferencesAction();
  }, [resetUserPreferencesAction]);

  const setFeatureFlag = useCallback(
    (flag: string, enabled: boolean) => {
      setFeatureFlagAction(flag, enabled);
    },
    [setFeatureFlagAction]
  );

  const isFeatureEnabled = useCallback(
    (flag: string): boolean => {
      return featureFlags[flag] ?? false;
    },
    [featureFlags]
  );

  const loadConfig = useCallback(
    (config: Partial<ConfigState>) => {
      loadConfigAction(config);
    },
    [loadConfigAction]
  );

  return {
    cliTools,
    defaultCliTool,
    firstEnabledTool,
    apiEndpoints,
    userPreferences,
    featureFlags,
    updateCliTool,
    setDefaultCliTool,
    setUserPreferences,
    resetUserPreferences,
    setFeatureFlag,
    isFeatureEnabled,
    loadConfig,
  };
}
