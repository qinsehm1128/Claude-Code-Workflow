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

// Default CLI tools configuration - no model defaults, models come from user's cli-tools.json
const defaultCliTools: Record<string, CliToolConfig> = {
  gemini: {
    enabled: true,
    tags: ['analysis', 'debug'],
    type: 'builtin',
  },
  qwen: {
    enabled: true,
    tags: [],
    type: 'builtin',
  },
  codex: {
    enabled: true,
    tags: [],
    type: 'builtin',
  },
  claude: {
    enabled: true,
    tags: [],
    type: 'builtin',
  },
  opencode: {
    enabled: true,
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
    dashboardQueuePanelEnabled: false,
    dashboardInspectorEnabled: false,
    dashboardExecutionMonitorEnabled: false,
  },
};

function getBackendConfigUrl(): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  try {
    return new URL('/api/cli/config', window.location.origin).toString();
  } catch {
    return null;
  }
}

function extractCliToolsFromBackend(data: unknown): Record<string, CliToolConfig> | null {
  const backendTools = (data as { config?: { tools?: unknown } } | null | undefined)?.config?.tools;
  if (!backendTools || typeof backendTools !== 'object') {
    return null;
  }

  const validTypes = ['builtin', 'cli-wrapper', 'api-endpoint'] as const;
  const isValidType = (t: unknown): t is 'builtin' | 'cli-wrapper' | 'api-endpoint' =>
    typeof t === 'string' && (validTypes as readonly string[]).includes(t);

  const cliTools: Record<string, CliToolConfig> = {};
  for (const [key, tool] of Object.entries(backendTools)) {
    const typedTool = tool as Record<string, unknown>;
    cliTools[key] = {
      enabled: typeof typedTool.enabled === 'boolean' ? typedTool.enabled : false,
      primaryModel: typeof typedTool.primaryModel === 'string' ? typedTool.primaryModel : '',
      secondaryModel: typeof typedTool.secondaryModel === 'string' ? typedTool.secondaryModel : '',
      tags: Array.isArray(typedTool.tags) ? typedTool.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      type: isValidType(typedTool.type) ? typedTool.type : 'builtin',
      envFile: typeof typedTool.envFile === 'string' ? typedTool.envFile : undefined,
      settingsFile: typeof typedTool.settingsFile === 'string' ? typedTool.settingsFile : undefined,
      availableModels: Array.isArray(typedTool.availableModels)
        ? typedTool.availableModels.filter((model): model is string => typeof model === 'string')
        : undefined,
    };
  }

  return Object.keys(cliTools).length > 0 ? cliTools : null;
}

let backendConfigSyncPromise: Promise<void> | null = null;

export async function syncConfigStoreFromBackend(force = false): Promise<void> {
  if (!force && backendConfigSyncPromise) {
    return backendConfigSyncPromise;
  }

  backendConfigSyncPromise = (async () => {
    const configUrl = getBackendConfigUrl();
    if (!configUrl) {
      return;
    }

    const response = await fetch(configUrl);
    const data = await response.json();
    const cliTools = extractCliToolsFromBackend(data);
    if (cliTools) {
      useConfigStore.getState().loadConfig({ cliTools });
    }
  })().catch((err) => {
    console.warn('[ConfigStore] Backend config sync failed, using local state:', err);
  }).finally(() => {
    backendConfigSyncPromise = null;
  });

  return backendConfigSyncPromise;
}

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
