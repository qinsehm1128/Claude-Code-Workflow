// ========================================
// Shared Components Index
// ========================================
// Centralized exports for all shared components

// Card components
export { SessionCard, SessionCardSkeleton } from './SessionCard';
export type { SessionCardProps } from './SessionCard';

export { ConversationCard } from './ConversationCard';
export type { ConversationCardProps } from './ConversationCard';

export { IssueCard } from './IssueCard';
export type { IssueCardProps } from './IssueCard';

export { SkillCard } from './SkillCard';
export type { SkillCardProps } from './SkillCard';

export { SkillDetailPanel } from './SkillDetailPanel';
export type { SkillDetailPanelProps } from './SkillDetailPanel';

export { SkillCreateDialog } from './SkillCreateDialog';
export type { SkillCreateDialogProps } from './SkillCreateDialog';

export { StatCard, StatCardSkeleton } from './StatCard';
export type { StatCardProps } from './StatCard';

export { RuleCard } from './RuleCard';
export type { RuleCardProps } from './RuleCard';

export { PromptCard } from './PromptCard';
export type { PromptCardProps } from './PromptCard';

// Tree and file explorer components
export { TreeView } from './TreeView';
export type { TreeViewProps } from './TreeView';

export { FilePreview } from './FilePreview';
export type { FilePreviewProps } from './FilePreview';

// Graph visualization components
export { GraphToolbar } from './GraphToolbar';
export type { GraphToolbarProps } from './GraphToolbar';

export { GraphSidebar } from './GraphSidebar';
export type { GraphSidebarProps } from './GraphSidebar';

// Insights and analysis components
export { InsightsPanel } from './InsightsPanel';
export type { InsightsPanelProps } from './InsightsPanel';

export { PromptStats } from './PromptStats';
export type { PromptStatsProps } from './PromptStats';

// Workflow and task components
export { KanbanBoard } from './KanbanBoard';
export type { KanbanBoardProps } from './KanbanBoard';

export { TaskDrawer } from './TaskDrawer';
export type { TaskDrawerProps } from './TaskDrawer';

export { Flowchart } from './Flowchart';
export type { FlowchartProps } from './Flowchart';

// CLI and streaming components
export { CliStreamPanel } from './CliStreamPanel';
export type { CliStreamPanelProps } from './CliStreamPanel';

// CliStreamMonitor (updated with Tab + JSON Cards - v3 design)
export { default as CliStreamMonitor } from './CliStreamMonitorLegacy';
export type { CliStreamMonitorProps } from './CliStreamMonitorLegacy';

// Alternative: New message-based layout (CliStreamMonitorNew)
export { CliStreamMonitor as CliStreamMonitorNew } from './CliStreamMonitor/index';
export type { CliStreamMonitorProps as CliStreamMonitorNewProps } from './CliStreamMonitor/index';

export { StreamingOutput } from './StreamingOutput';
export type { StreamingOutputProps } from './StreamingOutput';

// CliStreamMonitor sub-components (new design)
export { MonitorHeader } from './CliStreamMonitor/index';
export type { MonitorHeaderProps } from './CliStreamMonitor/index';

export { MonitorToolbar } from './CliStreamMonitor/index';
export type { MonitorToolbarProps, FilterType, ViewMode } from './CliStreamMonitor/index';

export { MonitorBody } from './CliStreamMonitor/index';
export type { MonitorBodyProps, MonitorBodyRef } from './CliStreamMonitor/index';

export { MessageRenderer } from './CliStreamMonitor/index';
export type { MessageRendererProps } from './CliStreamMonitor/index';

// Message components for CLI streaming
export {
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ErrorMessage
} from './CliStreamMonitor/messages';
export type {
  SystemMessageProps,
  UserMessageProps,
  AssistantMessageProps,
  ErrorMessageProps
} from './CliStreamMonitor/messages';

// LogBlock components
export {
  LogBlock,
  LogBlockList,
  getOutputLineClass,
} from './LogBlock';
export type {
  LogBlockProps,
  LogBlockData,
  LogLine,
  LogBlockListProps,
} from './LogBlock';

// JsonFormatter
export { JsonFormatter } from './LogBlock/JsonFormatter';
export type { JsonFormatterProps } from './LogBlock/JsonFormatter';
export type { JsonDisplayMode } from './LogBlock/jsonUtils';

// JSON utilities
export {
  detectJson,
  detectJsonContent,
  extractJson,
  formatJson,
  getJsonSummary,
  getJsonValueTypeColor,
} from './LogBlock/jsonUtils';
export type { JsonDetectionResult, JsonDisplayMode as JsonMode } from './LogBlock/jsonUtils';

// Dialog components
export { RuleDialog } from './RuleDialog';
export type { RuleDialogProps } from './RuleDialog';

// Tools and utility components
export { ThemeSelector } from './ThemeSelector';

export { IndexManager } from './IndexManager';
export type { IndexManagerProps } from './IndexManager';

export { ExplorerToolbar } from './ExplorerToolbar';
export type { ExplorerToolbarProps } from './ExplorerToolbar';

// Ticker components
export { TickerMarquee } from './TickerMarquee';
export type { TickerMarqueeProps } from './TickerMarquee';

// Version check components
export { VersionCheck } from './VersionCheck';
export { VersionCheckModal } from './VersionCheckModal';

// Config sync components
export { ConfigSync } from './ConfigSync';
export { ConfigSyncModal } from './ConfigSyncModal';
export type { ConfigSyncProps, BackupInfo, SyncResult, BackupResult } from './ConfigSync';
export type { ConfigSyncModalProps } from './ConfigSyncModal';

// CLI execution settings
export { CliExecutionSettings } from './CliExecutionSettings';
export type {
  CliExecutionSettingsProps,
  ToolName,
  ExecutionMode,
  ResumeStrategy,
} from './CliExecutionSettings';
