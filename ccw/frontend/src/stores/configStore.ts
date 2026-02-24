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
  A2UIPreferences,
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

// Default A2UI preferences
const defaultA2uiPreferences: A2UIPreferences = {
  dialogStyle: 'modal',
  smartModeEnabled: true,
  autoSelectionDuration: 30,
  autoSelectionSoundEnabled: false,
  pauseOnInteraction: true,
  showA2UIButtonInToolbar: true,
  drawerSide: 'right',
  drawerSize: 'md',
};

// Initial state
const initialState: ConfigState = {
  cliTools: defaultCliTools,
  defaultCliTool: 'gemini',
  apiEndpoints: defaultApiEndpoints,
  userPreferences: defaultUserPreferences,
  a2uiPreferences: defaultA2uiPreferences,
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

        // ========== A2UI Preferences Actions ==========

        setA2uiPreferences: (prefs: A2UIPreferences) => {
          set({ a2uiPreferences: prefs }, false, 'setA2uiPreferences');
        },

        resetA2uiPreferences: () => {
          set({ a2uiPreferences: defaultA2uiPreferences }, false, 'resetA2uiPreferences');
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
        version: 1,
        migrate: (persistedState: any, version: number) => {
          if (version === 0) {
            return {
              ...persistedState,
              apiEndpoints: persistedState.apiEndpoints || defaultApiEndpoints,
            };
          }
          return persistedState as any;
        },
        partialize: (state) => ({
          cliTools: state.cliTools,
          defaultCliTool: state.defaultCliTool,
          apiEndpoints: state.apiEndpoints,
          userPreferences: state.userPreferences,
          featureFlags: state.featureFlags,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            fetch('/api/cli/config')
              .then((res) => res.json())
              .then((data) => {
                const backendTools = data?.config?.tools;
                if (backendTools && typeof backendTools === 'object') {
                  const cliTools: Record<string, CliToolConfig> = {};
                  for (const [key, tool] of Object.entries(backendTools)) {
                    const t = tool as any;
                    cliTools[key] = {
                      enabled: t.enabled ?? false,
                      primaryModel: t.primaryModel || '',
                      secondaryModel: t.secondaryModel || '',
                      tags: t.tags || [],
                      type: t.type || 'builtin',
                      // Load additional fields from backend (fixes cross-browser config sync)
                      envFile: t.envFile,
                      settingsFile: t.settingsFile,
                      availableModels: t.availableModels,
                    };
                  }
                  if (Object.keys(cliTools).length > 0) {
                    state.loadConfig({ cliTools });
                  }
                }
              })
              .catch((err) => {
                console.warn(
                  '[ConfigStore] Backend config sync failed, using local state:',
                  err
                );
              });
          }
        },
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
