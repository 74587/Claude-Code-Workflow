// ========================================
// Config Store
// ========================================
// Manages CLI tools, API endpoints, and user preferences with persistence

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type {
  ConfigStore,
  ConfigState,
  CliToolConfig,
  ApiEndpoints,
  UserPreferences,
} from '../types/store';

// Default CLI tools configuration
const defaultCliTools: Record<string, CliToolConfig> = {
  gemini: {
    enabled: true,
    primaryModel: 'gemini-2.5-pro',
    secondaryModel: 'gemini-2.5-flash',
    tags: ['analysis', 'debug'],
    type: 'builtin',
  },
  qwen: {
    enabled: true,
    primaryModel: 'coder-model',
    secondaryModel: 'coder-model',
    tags: [],
    type: 'builtin',
  },
  codex: {
    enabled: true,
    primaryModel: 'gpt-5.2',
    secondaryModel: 'gpt-5.2',
    tags: [],
    type: 'builtin',
  },
  claude: {
    enabled: true,
    primaryModel: 'sonnet',
    secondaryModel: 'haiku',
    tags: [],
    type: 'builtin',
  },
  opencode: {
    enabled: true,
    primaryModel: 'opencode/glm-4.7-free',
    secondaryModel: 'opencode/glm-4.7-free',
    tags: [],
    type: 'builtin',
  },
};

// Default API endpoints
const defaultApiEndpoints: ApiEndpoints = {
  base: '/api',
  sessions: '/api/sessions',
  tasks: '/api/tasks',
  loops: '/api/loops',
  issues: '/api/issues',
  orchestrator: '/api/orchestrator',
};

// Default user preferences
const defaultUserPreferences: UserPreferences = {
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
  notificationsEnabled: true,
  soundEnabled: false,
  compactView: false,
  showCompletedTasks: true,
  defaultSessionFilter: 'all',
  defaultSortField: 'created_at',
  defaultSortDirection: 'desc',
};

// Initial state
const initialState: ConfigState = {
  cliTools: defaultCliTools,
  defaultCliTool: 'gemini',
  apiEndpoints: defaultApiEndpoints,
  userPreferences: defaultUserPreferences,
  featureFlags: {
    orchestratorEnabled: true,
    darkModeEnabled: true,
    notificationsEnabled: true,
    experimentalFeatures: false,
  },
};

export const useConfigStore = create<ConfigStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ========== CLI Tools Actions ==========

        setCliTools: (tools: Record<string, CliToolConfig>) => {
          set({ cliTools: tools }, false, 'setCliTools');
        },

        updateCliTool: (toolId: string, updates: Partial<CliToolConfig>) => {
          set(
            (state) => ({
              cliTools: {
                ...state.cliTools,
                [toolId]: {
                  ...state.cliTools[toolId],
                  ...updates,
                },
              },
            }),
            false,
            'updateCliTool'
          );
        },

        setDefaultCliTool: (toolId: string) => {
          const { cliTools } = get();
          if (cliTools[toolId]?.enabled) {
            set({ defaultCliTool: toolId }, false, 'setDefaultCliTool');
          }
        },

        // ========== API Endpoints Actions ==========

        setApiEndpoints: (endpoints: Partial<ApiEndpoints>) => {
          set(
            (state) => ({
              apiEndpoints: {
                ...state.apiEndpoints,
                ...endpoints,
              },
            }),
            false,
            'setApiEndpoints'
          );
        },

        // ========== User Preferences Actions ==========

        setUserPreferences: (prefs: Partial<UserPreferences>) => {
          set(
            (state) => ({
              userPreferences: {
                ...state.userPreferences,
                ...prefs,
              },
            }),
            false,
            'setUserPreferences'
          );
        },

        resetUserPreferences: () => {
          set({ userPreferences: defaultUserPreferences }, false, 'resetUserPreferences');
        },

        // ========== Feature Flags Actions ==========

        setFeatureFlag: (flag: string, enabled: boolean) => {
          set(
            (state) => ({
              featureFlags: {
                ...state.featureFlags,
                [flag]: enabled,
              },
            }),
            false,
            'setFeatureFlag'
          );
        },

        // ========== Bulk Config Actions ==========

        loadConfig: (config: Partial<ConfigState>) => {
          set(
            (state) => ({
              ...state,
              ...config,
              // Deep merge nested objects
              cliTools: config.cliTools || state.cliTools,
              apiEndpoints: {
                ...state.apiEndpoints,
                ...(config.apiEndpoints || {}),
              },
              userPreferences: {
                ...state.userPreferences,
                ...(config.userPreferences || {}),
              },
              featureFlags: {
                ...state.featureFlags,
                ...(config.featureFlags || {}),
              },
            }),
            false,
            'loadConfig'
          );
        },
      }),
      {
        name: 'ccw-config-store',
        // Persist all config state
        partialize: (state) => ({
          cliTools: state.cliTools,
          defaultCliTool: state.defaultCliTool,
          userPreferences: state.userPreferences,
          featureFlags: state.featureFlags,
        }),
      }
    ),
    { name: 'ConfigStore' }
  )
);

// Selectors for common access patterns
export const selectCliTools = (state: ConfigStore) => state.cliTools;
export const selectDefaultCliTool = (state: ConfigStore) => state.defaultCliTool;
export const selectApiEndpoints = (state: ConfigStore) => state.apiEndpoints;
export const selectUserPreferences = (state: ConfigStore) => state.userPreferences;
export const selectFeatureFlags = (state: ConfigStore) => state.featureFlags;

// Helper to get first enabled CLI tool
export const getFirstEnabledCliTool = (cliTools: Record<string, CliToolConfig>): string => {
  const entries = Object.entries(cliTools);
  const enabled = entries.find(([, config]) => config.enabled);
  return enabled ? enabled[0] : 'gemini';
};
