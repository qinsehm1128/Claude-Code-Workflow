// ========================================
// Types Index
// ========================================
// Centralized export point for all TypeScript types

// ========== Store Types ==========
export type {
  // App Store
  Theme,
  ColorScheme,
  Locale,
  ViewMode,
  SessionFilter,
  LiteTaskType,
  AppState,
  AppActions,
  AppStore,
  // Workflow Store
  SessionMetadata,
  TaskData,
  LiteTaskSession,
  WorkflowData,
  WorkflowFilters,
  WorkflowSorting,
  WorkflowState,
  WorkflowActions,
  WorkflowStore,
  // Config Store
  CliToolConfig,
  ApiEndpoints,
  UserPreferences,
  ConfigState,
  ConfigActions,
  ConfigStore,
  // Notification Store
  ToastType,
  WebSocketStatus,
  Toast,
  WebSocketMessage,
  NotificationState,
  NotificationActions,
  NotificationStore,
  // Index Manager
  IndexStatus,
  IndexRebuildRequest,
  // Rules
  Rule,
  RuleCreateInput,
  RuleUpdateInput,
  RulesResponse,
  // Prompt Assistant
  Prompt,
  PromptInsight,
  Pattern,
  Suggestion,
} from './store';

// ========== Flow Types ==========
export type {
  // Node Types
  FlowNodeType,
  ExecutionStatus,
  // Node Data
  PromptTemplateNodeData,
  NodeData,
  // Flow Types
  FlowNode,
  FlowEdgeData,
  FlowEdge,
  Flow,
  // Flow Store
  FlowState,
  FlowActions,
  FlowStore,
  // Node Config
  NodeTypeConfig,
} from './flow';

// ========== Execution Types ==========
export type {
  // Execution Status
  ExecutionStatus as NodeExecutionStatus,
  // Log Types
  LogLevel,
  ExecutionLog,
  // Node Execution
  NodeExecutionState,
  NodeExecutionOutput,
  // Execution State
  ExecutionState,
  // WebSocket Messages
  OrchestratorStateUpdateMessage,
  OrchestratorNodeStartedMessage,
  OrchestratorNodeCompletedMessage,
  OrchestratorNodeFailedMessage,
  OrchestratorLogMessage,
  OrchestratorWebSocketMessage,
  // Execution Store
  ExecutionStoreState,
  ExecutionStoreActions,
  ExecutionStore,
  // Templates
  FlowTemplate,
  TemplateInstallRequest,
  TemplateExportRequest,
} from './execution';

// ========== Orchestrator Types ==========
export type {
  SessionStrategy,
  ErrorHandlingStrategy,
  ErrorHandling,
  OrchestrationStatus,
  StepStatus,
  ExecutionType,
  OrchestrationMetadata,
  OrchestrationSource,
  OrchestrationStep,
  OrchestrationPlan,
  ManualOrchestrationParams,
} from './orchestrator';

// ========== Tool Call Types ==========
export type {
  ToolCallStatus,
  ToolCallKind,
  ToolCallOutputBuffer,
  ToolCallExecution,
  ToolCallStartData,
  ToolCallUpdate,
  ToolCallResult,
} from './toolCall';
export {
  DEFAULT_OUTPUT_BUFFER,
  createToolCallExecution,
  getToolCallStatusIconClass,
  getToolCallKindLabel,
} from './toolCall';

// ========== File Explorer Types ==========
export type {
  // File System
  NodeType as FileNodeType,
  FileSystemNode,
  FileContent,
  FileReadOptions,
  // Explorer State
  ExplorerViewMode,
  ExplorerSortOrder,
  ExplorerState,
  ExplorerActions,
  ExplorerStore,
  // File Tree
  FileTreeOptions,
  FileTreeResult,
} from './file-explorer';

// ========== Graph Explorer Types ==========
export type {
  // Node Types
  NodeType as GraphNodeType,
  NodeCategory,
  NodeSeverity,
  // Edge Types
  EdgeType,
  EdgeDirection,
  // Graph Elements
  GraphNodeData,
  GraphNode,
  GraphEdgeData,
  GraphEdge,
  GraphData,
  GraphMetadata,
  // Filters
  GraphFilters,
  GraphSortOptions,
  // Graph State
  GraphLayout,
  GraphExplorerState,
  GraphExplorerActions,
  GraphExplorerStore,
  // Analysis
  NodeComplexity,
  GraphAnalysis,
} from './graph-explorer';

// ========== Terminal Dashboard Types ==========
export type {
  // Session Manager
  SessionGridLayout,
  SessionLayout,
  TerminalStatus,
  TerminalMeta,
  SessionGroup,
  SessionManagerState,
  SessionManagerActions,
  SessionManagerStore,
  // Issue Queue Integration
  AssociationChain,
  IssueQueueIntegrationState,
  IssueQueueIntegrationActions,
  IssueQueueIntegrationStore,
} from './terminal-dashboard';
