// ========================================
// DashboardToolbar Component
// ========================================
// Top toolbar for Terminal Dashboard V2.
// Provides toggle buttons for floating panels (Issues/Queue/Inspector)
// and layout preset controls. Sessions sidebar is always visible.

import { useCallback, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  ListChecks,
  Info,
  FolderOpen,
  LayoutGrid,
  Columns2,
  Rows2,
  Square,
  Loader2,
  Folder,
  Maximize2,
  Minimize2,
  Activity,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import { useIssues, useIssueQueue } from '@/hooks/useIssues';
import { useTerminalGridStore, selectTerminalGridFocusedPaneId } from '@/stores/terminalGridStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { toast } from '@/stores/notificationStore';
import { useExecutionMonitorStore, selectActiveExecutionCount } from '@/stores/executionMonitorStore';
import { useSessionManagerStore } from '@/stores/sessionManagerStore';
import { useConfigStore } from '@/stores/configStore';
import { CliConfigModal, type CliSessionConfig } from './CliConfigModal';

// ========== Types ==========

export type PanelId = 'issues' | 'queue' | 'inspector' | 'execution';

interface DashboardToolbarProps {
  activePanel: PanelId | null;
  onTogglePanel: (panelId: PanelId) => void;
  /** Whether the file sidebar is open */
  isFileSidebarOpen?: boolean;
  /** Callback to toggle file sidebar */
  onToggleFileSidebar?: () => void;
  /** Whether the session sidebar is open */
  isSessionSidebarOpen?: boolean;
  /** Callback to toggle session sidebar */
  onToggleSessionSidebar?: () => void;
  /** Whether fullscreen mode is active */
  isFullscreen?: boolean;
  /** Callback to toggle fullscreen mode */
  onToggleFullscreen?: () => void;
}

// ========== Layout Presets ==========

const LAYOUT_PRESETS = [
  { id: 'single' as const, icon: Square, labelId: 'terminalDashboard.toolbar.layoutSingle' },
  { id: 'split-h' as const, icon: Columns2, labelId: 'terminalDashboard.toolbar.layoutSplitH' },
  { id: 'split-v' as const, icon: Rows2, labelId: 'terminalDashboard.toolbar.layoutSplitV' },
  { id: 'grid-2x2' as const, icon: LayoutGrid, labelId: 'terminalDashboard.toolbar.layoutGrid' },
];

// ========== Component ==========

export function DashboardToolbar({ activePanel, onTogglePanel, isFileSidebarOpen, onToggleFileSidebar, isSessionSidebarOpen, onToggleSessionSidebar, isFullscreen, onToggleFullscreen }: DashboardToolbarProps) {
  const { formatMessage } = useIntl();

  // Issues count
  const { openCount } = useIssues();

  // Queue count
  const queueQuery = useIssueQueue();
  const queueCount = useMemo(() => {
    if (!queueQuery.data) return 0;
    const grouped = queueQuery.data.grouped_items ?? {};
    let count = 0;
    for (const items of Object.values(grouped)) {
      count += items.length;
    }
    return count;
  }, [queueQuery.data]);

  // Inspector chain indicator
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const hasChain = associationChain !== null;

  // Execution monitor count
  const executionCount = useExecutionMonitorStore(selectActiveExecutionCount);

  // Feature flags for panel visibility
  const featureFlags = useConfigStore((s) => s.featureFlags);
  const showQueue = featureFlags.dashboardQueuePanelEnabled;
  const showInspector = featureFlags.dashboardInspectorEnabled;
  const showExecution = featureFlags.dashboardExecutionMonitorEnabled;

  // Layout preset handler
  const resetLayout = useTerminalGridStore((s) => s.resetLayout);
  const handlePreset = useCallback(
    (preset: 'single' | 'split-h' | 'split-v' | 'grid-2x2') => {
      resetLayout(preset);
    },
    [resetLayout]
  );

  // Launch CLI handlers
  const projectPath = useWorkflowStore(selectProjectPath);
  const focusedPaneId = useTerminalGridStore(selectTerminalGridFocusedPaneId);
  const createSessionAndAssign = useTerminalGridStore((s) => s.createSessionAndAssign);
  const updateTerminalMeta = useSessionManagerStore((s) => s.updateTerminalMeta);
  const [isCreating, setIsCreating] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Helper to get or create a focused pane
  const getOrCreateFocusedPane = useCallback(() => {
    if (focusedPaneId) return focusedPaneId;
    // No focused pane - reset layout to create a single pane
    resetLayout('single');
    // Get the new focused pane id from store
    return useTerminalGridStore.getState().focusedPaneId;
  }, [focusedPaneId]);

  // Open config modal
  const handleOpenConfig = useCallback(() => {
    setIsConfigOpen(true);
  }, []);

  // Create session from config modal
  const handleCreateConfiguredSession = useCallback(async (config: CliSessionConfig) => {
    if (!projectPath) throw new Error('No project path');
    setIsCreating(true);
    try {
      const targetPaneId = getOrCreateFocusedPane();
      if (!targetPaneId) throw new Error('Failed to create pane');

      const result = await createSessionAndAssign(
        targetPaneId,
        {
          workingDir: config.workingDir || projectPath,
          preferredShell: config.preferredShell,
          tool: config.tool,
          model: config.model,
          launchMode: config.launchMode,
          settingsEndpointId: config.settingsEndpointId,
        },
        projectPath
      );

      // Store tag in terminalMetas for grouping
      if (result?.session?.sessionKey) {
        updateTerminalMeta(result.session.sessionKey, {
          tag: config.tag,
          title: config.tag,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message
          ? (error as { message: string }).message
          : String(error);
      toast.error(`CLI 会话创建失败 (${config.tool})`, message);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [projectPath, createSessionAndAssign, getOrCreateFocusedPane, updateTerminalMeta]);

  return (
    <>
      <div className="flex items-center gap-1 px-2 h-[40px] border-b border-border bg-muted/30 shrink-0">
        {/* Launch CLI button - opens config dialog */}
        <button
          onClick={handleOpenConfig}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
            isCreating && 'opacity-50 cursor-wait'
          )}
          disabled={isCreating || !projectPath}
          title={formatMessage({ id: 'terminalDashboard.toolbar.launchCliHint', defaultMessage: 'Click to configure and launch a CLI session' })}
        >
          {isCreating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>{formatMessage({ id: 'terminalDashboard.toolbar.launchCli' })}</span>
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Session sidebar toggle */}
        <ToolbarButton
          icon={Folder}
          label={formatMessage({ id: 'terminalDashboard.toolbar.sessions', defaultMessage: 'Sessions' })}
          isActive={isSessionSidebarOpen ?? true}
          onClick={() => onToggleSessionSidebar?.()}
        />

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Panel toggle buttons */}
        <ToolbarButton
          icon={AlertCircle}
          label={formatMessage({ id: 'terminalDashboard.toolbar.issues' })}
          isActive={activePanel === 'issues'}
          onClick={() => onTogglePanel('issues')}
          badge={openCount > 0 ? openCount : undefined}
        />
        {showQueue && (
          <ToolbarButton
            icon={ListChecks}
            label={formatMessage({ id: 'terminalDashboard.toolbar.queue' })}
            isActive={activePanel === 'queue'}
            onClick={() => onTogglePanel('queue')}
            badge={queueCount > 0 ? queueCount : undefined}
          />
        )}
        {showInspector && (
          <ToolbarButton
            icon={Info}
            label={formatMessage({ id: 'terminalDashboard.toolbar.inspector' })}
            isActive={activePanel === 'inspector'}
            onClick={() => onTogglePanel('inspector')}
            dot={hasChain}
          />
        )}
        {showExecution && (
          <ToolbarButton
            icon={Activity}
            label={formatMessage({ id: 'terminalDashboard.toolbar.executionMonitor', defaultMessage: 'Execution Monitor' })}
            isActive={activePanel === 'execution'}
            onClick={() => onTogglePanel('execution')}
            badge={executionCount > 0 ? executionCount : undefined}
          />
        )}
        <ToolbarButton
          icon={FolderOpen}
          label={formatMessage({ id: 'terminalDashboard.toolbar.files', defaultMessage: 'Files' })}
          isActive={isFileSidebarOpen ?? false}
          onClick={() => onToggleFileSidebar?.()}
        />

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Layout presets */}
        {LAYOUT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            className={cn(
              'p-1.5 rounded transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={formatMessage({ id: preset.labelId })}
          >
            <preset.icon className="w-3.5 h-3.5" />
          </button>
        ))}

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className={cn(
            'p-1.5 rounded transition-colors',
            isFullscreen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isFullscreen
            ? formatMessage({ id: 'terminalDashboard.toolbar.exitFullscreen', defaultMessage: 'Exit Fullscreen' })
            : formatMessage({ id: 'terminalDashboard.toolbar.fullscreen', defaultMessage: 'Fullscreen' })
          }
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Right-aligned title */}
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {formatMessage({ id: 'terminalDashboard.page.title' })}
        </span>
      </div>

      <CliConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        defaultWorkingDir={projectPath}
        onCreateSession={handleCreateConfiguredSession}
      />
    </>
  );
}

// ========== Toolbar Button ==========

function ToolbarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  dot,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
          {badge}
        </Badge>
      )}
      {dot && (
        <span className="ml-0.5 w-2 h-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}
