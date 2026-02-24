// ========================================
// Hooks Barrel Export
// ========================================
// Re-export all custom hooks for convenient imports

export { useTheme } from './useTheme';
export type { UseThemeReturn } from './useTheme';

export { useSession } from './useSession';
export type { UseSessionReturn } from './useSession';

export { useConfig } from './useConfig';
export type { UseConfigReturn } from './useConfig';

export { useNotifications } from './useNotifications';
export type { UseNotificationsReturn, ToastOptions } from './useNotifications';

export { useWebSocket } from './useWebSocket';
export type { UseWebSocketOptions, UseWebSocketReturn } from './useWebSocket';

export { useWebSocketNotifications } from './useWebSocketNotifications';

export { useCompletionCallbackChain } from './useCompletionCallbackChain';

export { useSystemNotifications } from './useSystemNotifications';
export type { UseSystemNotificationsReturn, SystemNotificationOptions } from './useSystemNotifications';

export { useDashboardStats, usePrefetchDashboardStats, dashboardStatsKeys } from './useDashboardStats';
export type { UseDashboardStatsOptions, UseDashboardStatsReturn } from './useDashboardStats';

export {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useArchiveSession,
  useDeleteSession,
  useSessionMutations,
  usePrefetchSessions,
  sessionsKeys,
} from './useSessions';
export type {
  SessionsFilter,
  UseSessionsOptions,
  UseSessionsReturn,
  UseCreateSessionReturn,
  UseUpdateSessionReturn,
  UseArchiveSessionReturn,
  UseDeleteSessionReturn,
} from './useSessions';

// ========== Loops ==========
export {
  useLoops,
  useLoop,
  useCreateLoop,
  useUpdateLoopStatus,
  useDeleteLoop,
  useLoopMutations,
} from './useLoops';
export type {
  LoopsFilter,
  UseLoopsOptions,
  UseLoopsReturn,
  UseCreateLoopReturn,
  UseUpdateLoopStatusReturn,
  UseDeleteLoopReturn,
} from './useLoops';

// ========== Issues ==========
export {
  useIssues,
  useIssueQueue,
  useIssueQueueById,
  useQueueHistory,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  useIssueMutations,
  useQueueMutations,
  useIssueDiscovery,
  issuesKeys,
} from './useIssues';
export type {
  IssuesFilter,
  UseIssuesOptions,
  UseIssuesReturn,
  UseCreateIssueReturn,
  UseUpdateIssueReturn,
  UseDeleteIssueReturn,
  UseQueueMutationsReturn,
  FindingFilters,
  UseIssueDiscoveryReturn,
} from './useIssues';

// ========== Audit ==========
export {
  useCliSessionAudit,
} from './useAudit';
export type {
  UseCliSessionAuditOptions,
} from './useAudit';

// ========== Skills ==========
export {
  useSkills,
  useToggleSkill,
  useSkillMutations,
  skillsKeys,
} from './useSkills';
export type {
  SkillsFilter,
  UseSkillsOptions,
  UseSkillsReturn,
  UseToggleSkillReturn,
} from './useSkills';

// ========== Commands ==========
export {
  useCommands,
  useCommandSearch,
  useCommandMutations,
} from './useCommands';
export type {
  CommandsFilter,
  UseCommandsOptions,
  UseCommandsReturn,
  UseCommandMutationsReturn,
} from './useCommands';

// ========== Memory ==========
export {
  useMemory,
  useCreateMemory,
  useUpdateMemory,
  useDeleteMemory,
  useMemoryMutations,
  memoryKeys,
} from './useMemory';
export type {
  MemoryFilter,
  UseMemoryOptions,
  UseMemoryReturn,
  UseCreateMemoryReturn,
  UseUpdateMemoryReturn,
  UseDeleteMemoryReturn,
} from './useMemory';

// ========== Unified Memory ==========
export {
  useUnifiedSearch,
  useUnifiedStats,
  useRecommendations,
  useReindex,
} from './useUnifiedSearch';
export type {
  UseUnifiedSearchOptions,
  UseUnifiedSearchReturn,
  UseUnifiedStatsReturn,
  UseRecommendationsOptions,
  UseRecommendationsReturn,
  UseReindexReturn,
} from './useUnifiedSearch';

// ========== MCP Servers ==========
export {
  useMcpServers,
  useUpdateMcpServer,
  useCreateMcpServer,
  useDeleteMcpServer,
  useToggleMcpServer,
  useMcpServerMutations,
  useMcpTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useInstallTemplate,
  useProjectOperations,
  mcpServersKeys,
  mcpTemplatesKeys,
} from './useMcpServers';
export type {
  UseMcpServersOptions,
  UseMcpServersReturn,
  UseUpdateMcpServerReturn,
  UseCreateMcpServerReturn,
  UseDeleteMcpServerReturn,
  UseToggleMcpServerReturn,
  UseMcpTemplatesOptions,
  UseMcpTemplatesReturn,
  UseCreateTemplateReturn,
  UseDeleteTemplateReturn,
  UseInstallTemplateReturn,
  UseProjectOperationsReturn,
} from './useMcpServers';

// ========== CLI ==========
export {
  useCliEndpoints,
  useToggleCliEndpoint,
  useCreateCliEndpoint,
  useUpdateCliEndpoint,
  useDeleteCliEndpoint,
  cliEndpointsKeys,
  useCliInstallations,
  useInstallCliTool,
  useUninstallCliTool,
  useUpgradeCliTool,
  cliInstallationsKeys,
  useHooks,
  useToggleHook,
  hooksKeys,
  useRules,
  useToggleRule,
  useCreateRule,
  useDeleteRule,
  rulesKeys,
} from './useCli';
export type {
  UseCliEndpointsOptions,
  UseCliEndpointsReturn,
  UseCliInstallationsOptions,
  UseCliInstallationsReturn,
  UseHooksOptions,
  UseHooksReturn,
  UseRulesOptions,
  UseRulesReturn,
} from './useCli';

// ========== System Settings ==========
export {
  useChineseResponseStatus,
  useToggleChineseResponse,
  useWindowsPlatformStatus,
  useToggleWindowsPlatform,
  useCodexCliEnhancementStatus,
  useToggleCodexCliEnhancement,
  useRefreshCodexCliEnhancement,
  useCcwInstallStatus,
  useCliToolStatus,
  useCcwInstallations,
  useUpgradeCcwInstallation,
  systemSettingsKeys,
} from './useSystemSettings';
export type {
  UseChineseResponseStatusReturn,
  UseWindowsPlatformStatusReturn,
  UseCodexCliEnhancementStatusReturn,
  UseCcwInstallStatusReturn,
  UseCliToolStatusReturn,
  UseCcwInstallationsReturn,
} from './useSystemSettings';

// ========== CLI Execution ==========
export {
  useCliExecutionDetail,
  cliExecutionKeys,
} from './useCliExecution';
export type {
  UseCliExecutionOptions,
  UseCliExecutionReturn,
} from './useCliExecution';

// ========== CLI Session Core ==========
export { useCliSessionCore } from './useCliSessionCore';
export type {
  UseCliSessionCoreOptions,
  UseCliSessionCoreReturn,
} from './useCliSessionCore';

// ========== Workspace Query Keys ==========
export {
  useWorkspaceQueryKeys,
} from './useWorkspaceQueryKeys';
export type {
  WorkspaceQueryKeys,
} from './useWorkspaceQueryKeys';

// ========== CodexLens ==========
export {
  useCodexLensDashboard,
  useCodexLensStatus,
  useCodexLensWorkspaceStatus,
  useCodexLensConfig,
  useCodexLensModels,
  useCodexLensModelInfo,
  useCodexLensEnv,
  useCodexLensGpu,
  useCodexLensIgnorePatterns,
  useUpdateCodexLensConfig,
  useBootstrapCodexLens,
  useUninstallCodexLens,
  useDownloadModel,
  useDeleteModel,
  useUpdateCodexLensEnv,
  useSelectGpu,
  useUpdateIgnorePatterns,
  useCodexLensMutations,
  codexLensKeys,
  useCodexLensIndexes,
  useCodexLensIndexingStatus,
  useRebuildIndex,
  useUpdateIndex,
  useCancelIndexing,
  useCodexLensWatcher,
  useCodexLensWatcherMutations,
  useCodexLensLspStatus,
  useCodexLensLspMutations,
  useCodexLensRerankerConfig,
  useUpdateRerankerConfig,
  useCcwToolsList,
} from './useCodexLens';
export type {
  UseCodexLensDashboardOptions,
  UseCodexLensDashboardReturn,
  UseCodexLensStatusOptions,
  UseCodexLensStatusReturn,
  UseCodexLensWorkspaceStatusOptions,
  UseCodexLensWorkspaceStatusReturn,
  UseCodexLensConfigOptions,
  UseCodexLensConfigReturn,
  UseCodexLensModelsOptions,
  UseCodexLensModelsReturn,
  UseCodexLensModelInfoOptions,
  UseCodexLensModelInfoReturn,
  UseCodexLensEnvOptions,
  UseCodexLensEnvReturn,
  UseCodexLensGpuOptions,
  UseCodexLensGpuReturn,
  UseCodexLensIgnorePatternsOptions,
  UseCodexLensIgnorePatternsReturn,
  UseUpdateCodexLensConfigReturn,
  UseBootstrapCodexLensReturn,
  UseUninstallCodexLensReturn,
  UseDownloadModelReturn,
  UseDeleteModelReturn,
  UseUpdateCodexLensEnvReturn,
  UseSelectGpuReturn,
  UseUpdateIgnorePatternsReturn,
  UseCodexLensIndexesOptions,
  UseCodexLensIndexesReturn,
  UseCodexLensIndexingStatusReturn,
  UseRebuildIndexReturn,
  UseUpdateIndexReturn,
  UseCancelIndexingReturn,
  UseCodexLensWatcherOptions,
  UseCodexLensWatcherReturn,
  UseCodexLensWatcherMutationsReturn,
  UseCodexLensLspStatusOptions,
  UseCodexLensLspStatusReturn,
  UseCodexLensLspMutationsReturn,
  UseCodexLensRerankerConfigOptions,
  UseCodexLensRerankerConfigReturn,
  UseUpdateRerankerConfigReturn,
  UseCcwToolsListReturn,
} from './useCodexLens';

// ========== Skill Hub ==========
export {
  useRemoteSkills,
  useLocalSkills,
  useInstalledSkills,
  useSkillHubUpdates,
  useInstallSkill,
  useCacheSkill,
  useUninstallSkill,
  useSkillHubStats,
  useSkillHub,
  skillHubKeys,
} from './useSkillHub';
export type {
  CliType,
  SkillSource,
  RemoteSkill,
  LocalSkill,
  InstalledSkill,
  RemoteSkillsResponse,
  LocalSkillsResponse,
  InstalledSkillsResponse,
  SkillInstallRequest,
  SkillInstallResponse,
  SkillCacheRequest,
  SkillCacheResponse,
  SkillHubStats,
} from './useSkillHub';
