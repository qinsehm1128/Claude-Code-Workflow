// ========================================
// Stores Barrel Export
// ========================================
// Re-export all stores for convenient imports

// App Store
export {
  useAppStore,
  selectTheme,
  selectResolvedTheme,
  selectSidebarOpen,
  selectCurrentView,
  selectIsLoading,
  selectError,
} from './appStore';

// Workflow Store
export {
  useWorkflowStore,
  selectWorkflowData,
  selectActiveSessions,
  selectArchivedSessions,
  selectActiveSessionId,
  selectProjectPath,
  selectFilters,
  selectSorting,
} from './workflowStore';

// Config Store
export {
  useConfigStore,
  selectCliTools,
  selectDefaultCliTool,
  selectApiEndpoints,
  selectUserPreferences,
  selectFeatureFlags,
  getFirstEnabledCliTool,
} from './configStore';

// Notification Store
export {
  useNotificationStore,
  selectToasts,
  selectWsStatus,
  selectWsLastMessage,
  selectIsPanelVisible,
  selectPersistentNotifications,
  selectCurrentQuestion,
  selectCurrentPopupCard,
  toast,
} from './notificationStore';

// Flow Store
export {
  useFlowStore,
  selectCurrentFlow,
  selectNodes,
  selectEdges,
  selectSelectedNodeId,
  selectSelectedEdgeId,
  selectFlows,
  selectIsModified,
  selectIsLoadingFlows,
  selectIsPaletteOpen,
  selectIsPropertyPanelOpen,
} from './flowStore';

// Execution Store
export {
  useExecutionStore,
  selectCurrentExecution,
  selectNodeStates,
  selectLogs,
  selectIsMonitorPanelOpen,
  selectAutoScrollLogs,
  selectIsExecuting,
  selectNodeStatus,
} from './executionStore';

// Viewer Store
export {
  useViewerStore,
  useViewerActions,
  useViewerLayout,
  useViewerPanes,
  useViewerTabs,
  useFocusedPaneId,
  selectPane,
  selectTab,
  selectPaneTabs,
  selectActiveTab,
} from './viewerStore';

// Terminal Panel Store
export {
  useTerminalPanelStore,
  selectIsPanelOpen as selectIsTerminalPanelOpen,
  selectActiveTerminalId,
  selectPanelView,
  selectTerminalOrder,
  selectTerminalCount,
} from './terminalPanelStore';

// Queue Execution Store
export {
  useQueueExecutionStore,
  selectQueueExecutions,
  selectActiveExecutions,
  selectByQueueItem,
  selectExecutionStats,
  selectHasActiveExecution,
} from './queueExecutionStore';

// Orchestrator Store
export {
  useOrchestratorStore,
  selectActivePlans,
  selectPlan,
  selectStepStatuses,
  selectStepRunState,
  selectHasRunningPlan,
  selectActivePlanCount,
  selectPlanStepByExecutionId,
} from './orchestratorStore';

// Session Manager Store
export {
  useSessionManagerStore,
  selectGroups,
  selectLayout,
  selectSessionManagerActiveTerminalId,
  selectTerminalMetas,
  selectTerminalMeta,
} from './sessionManagerStore';

// Issue Queue Integration Store
export {
  useIssueQueueIntegrationStore,
  selectSelectedIssueId,
  selectAssociationChain,
  selectQueueByIssue,
  selectIssueById,
} from './issueQueueIntegrationStore';

// Terminal Panel Store Types
export type {
  PanelView,
  TerminalPanelState,
  TerminalPanelActions,
  TerminalPanelStore,
} from './terminalPanelStore';

// Queue Execution Store Types
export type {
  QueueExecutionType,
  QueueExecutionStatus,
  QueueExecutionMode,
  QueueExecution,
  QueueExecutionStats,
  QueueExecutionState,
  QueueExecutionActions,
  QueueExecutionStore,
} from './queueExecutionStore';

// Orchestrator Store Types
export type {
  StepRunState,
  OrchestrationRunState,
  OrchestratorState,
  OrchestratorActions,
  OrchestratorStore,
} from './orchestratorStore';

// Re-export types for convenience
export type {
  // App Store Types
  AppStore,
  AppState,
  AppActions,
  Theme,
  ViewMode,
  SessionFilter,
  LiteTaskType,

  // Workflow Store Types
  WorkflowStore,
  WorkflowState,
  WorkflowActions,
  WorkflowData,
  WorkflowFilters,
  WorkflowSorting,
  SessionMetadata,
  TaskData,
  LiteTaskSession,

  // Config Store Types
  ConfigStore,
  ConfigState,
  ConfigActions,
  CliToolConfig,
  ApiEndpoints,
  UserPreferences,

  // Notification Store Types
  NotificationStore,
  NotificationState,
  NotificationActions,
  Toast,
  ToastType,
  WebSocketStatus,
  WebSocketMessage,
  QuestionType,
  Question,
  AskQuestionPayload,
} from '../types/store';

// Viewer Store Types
export type {
  PaneId,
  CliExecutionId,
  TabId,
  TabState,
  PaneState,
  AllotmentLayoutGroup,
  AllotmentLayout,
  ViewerState,
} from './viewerStore';

// Execution Types
export type {
  ExecutionStatus,
  NodeExecutionStatus,
  LogLevel,
  ExecutionLog,
  NodeExecutionState,
  ExecutionState,
  OrchestratorWebSocketMessage,
  ExecutionStore,
  ExecutionStoreState,
  ExecutionStoreActions,
  FlowTemplate,
  TemplateInstallRequest,
  TemplateExportRequest,
} from '../types/execution';

// Flow Types
export type {
  FlowNodeType,
  PromptTemplateNodeData,
  NodeData,
  FlowNode,
  FlowEdge,
  FlowEdgeData,
  Flow,
  FlowMetadata,
  FlowState,
  FlowActions,
  FlowStore,
  NodeTypeConfig,
} from '../types/flow';

export { NODE_TYPE_CONFIGS } from '../types/flow';

// Session Manager Store Types
export type {
  SessionGridLayout,
  SessionLayout,
  TerminalStatus,
  TerminalMeta,
  SessionGroup,
  SessionManagerState,
  SessionManagerActions,
  SessionManagerStore,
  AlertSeverity,
  MonitorAlert,
} from '../types/terminal-dashboard';

// Terminal Grid Store
export {
  useTerminalGridStore,
  selectTerminalGridLayout,
  selectTerminalGridPanes,
  selectTerminalGridFocusedPaneId,
  selectTerminalPane,
} from './terminalGridStore';

export type {
  TerminalPaneState,
  TerminalGridState,
  TerminalGridActions,
  TerminalGridStore,
} from './terminalGridStore';

// Issue Queue Integration Store Types
export type {
  AssociationChain,
  IssueQueueIntegrationState,
  IssueQueueIntegrationActions,
  IssueQueueIntegrationStore,
} from '../types/terminal-dashboard';

// Issue Dialog Store
export {
  useIssueDialogStore,
} from './issueDialogStore';

export type {
  IssueType,
  IssuePriority,
  IssueFormData,
  IssueDialogState,
} from './issueDialogStore';
