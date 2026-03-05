// ========================================
// Terminal Dashboard Page (V2)
// ========================================
// Terminal-first layout with fixed session sidebar + floating panels + right file sidebar.
// Left sidebar: SessionGroupTree (always visible)
// Main area: TerminalGrid (tmux-style split panes)
// Right sidebar: FileSidebarPanel (file tree, resizable)
// Top: DashboardToolbar with panel toggles and layout presets
// Floating panels: Issues, Queue, Inspector, Execution Monitor (overlay, mutually exclusive)
// Fullscreen mode: Uses global isImmersiveMode to hide app chrome (Header + Sidebar)

import { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { AssociationHighlightProvider } from '@/components/terminal-dashboard/AssociationHighlight';
import { DashboardToolbar, type PanelId } from '@/components/terminal-dashboard/DashboardToolbar';
import { TerminalGrid } from '@/components/terminal-dashboard/TerminalGrid';
import { FloatingPanel } from '@/components/terminal-dashboard/FloatingPanel';
import { SessionGroupTree } from '@/components/terminal-dashboard/SessionGroupTree';
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel';
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel';
import { QueueListColumn } from '@/components/terminal-dashboard/QueueListColumn';
import { SchedulerPanel } from '@/components/terminal-dashboard/SchedulerPanel';
import { InspectorContent } from '@/components/terminal-dashboard/BottomInspector';
import { ExecutionMonitorPanel } from '@/components/terminal-dashboard/ExecutionMonitorPanel';
import { FileSidebarPanel } from '@/components/terminal-dashboard/FileSidebarPanel';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import { useConfigStore } from '@/stores/configStore';

// ========== Main Page Component ==========

export function TerminalDashboardPage() {
  const { formatMessage } = useIntl();
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [isFileSidebarOpen, setIsFileSidebarOpen] = useState(true);
  const [isSessionSidebarOpen, setIsSessionSidebarOpen] = useState(true);

  const projectPath = useWorkflowStore(selectProjectPath);

  // Feature flags for panel visibility
  const featureFlags = useConfigStore((s) => s.featureFlags);

  // Use global immersive mode state (only affects AppShell chrome)
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  const togglePanel = useCallback((panelId: PanelId) => {
    setActivePanel((prev) => (prev === panelId ? null : panelId));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  return (
    <div className={`flex flex-col overflow-hidden ${isImmersiveMode ? 'h-screen' : 'h-[calc(100vh-56px)]'}`}>
      <AssociationHighlightProvider>
        {/* Global toolbar */}
        <DashboardToolbar
          activePanel={activePanel}
          onTogglePanel={togglePanel}
          isFileSidebarOpen={isFileSidebarOpen}
          onToggleFileSidebar={() => setIsFileSidebarOpen((prev) => !prev)}
          isSessionSidebarOpen={isSessionSidebarOpen}
          onToggleSessionSidebar={() => setIsSessionSidebarOpen((prev) => !prev)}
          isFullscreen={isImmersiveMode}
          onToggleFullscreen={toggleImmersiveMode}
        />

        {/* Main content with three-column layout */}
        <div className="flex-1 min-h-0">
          <Allotment className="h-full">
            {/* Session sidebar (controlled by local state, not immersive mode) */}
            {isSessionSidebarOpen && (
              <Allotment.Pane preferredSize={240} minSize={180} maxSize={320}>
                <div className="h-full flex flex-col border-r border-border">
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <SessionGroupTree />
                  </div>
                </div>
              </Allotment.Pane>
            )}

            {/* Terminal grid (flexible) */}
            <Allotment.Pane preferredSize={-1} minSize={300}>
              <TerminalGrid />
            </Allotment.Pane>

            {/* File sidebar (controlled by local state, not immersive mode) */}
            {isFileSidebarOpen && (
              <Allotment.Pane preferredSize={280} minSize={200} maxSize={400}>
                <FileSidebarPanel
                  rootPath={projectPath ?? '/'}
                  enabled={!!projectPath}
                  onCollapse={() => setIsFileSidebarOpen(false)}
                />
              </Allotment.Pane>
            )}
          </Allotment>
        </div>

        {/* Floating panels (always available) */}
        <FloatingPanel
          isOpen={activePanel === 'issues'}
          onClose={closePanel}
          title={formatMessage({ id: 'terminalDashboard.toolbar.issues' })}
          side="left"
          width={700}
        >
          <div className="flex h-full">
            <div className="flex-1 min-w-0 border-r border-border">
              <IssuePanel />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="px-3 py-2 border-b border-border shrink-0">
                <h3 className="text-sm font-semibold">{formatMessage({ id: 'terminalDashboard.toolbar.queue' })}</h3>
              </div>
              <QueueListColumn />
            </div>
          </div>
        </FloatingPanel>

        {featureFlags.dashboardQueuePanelEnabled && (
          <FloatingPanel
            isOpen={activePanel === 'queue'}
            onClose={closePanel}
            title={formatMessage({ id: 'terminalDashboard.toolbar.queue' })}
            side="right"
            width={400}
          >
            <QueuePanel />
          </FloatingPanel>
        )}

        {featureFlags.dashboardInspectorEnabled && (
          <FloatingPanel
            isOpen={activePanel === 'inspector'}
            onClose={closePanel}
            title={formatMessage({ id: 'terminalDashboard.toolbar.inspector' })}
            side="right"
            width={360}
          >
            <InspectorContent />
          </FloatingPanel>
        )}

        {featureFlags.dashboardExecutionMonitorEnabled && (
          <FloatingPanel
            isOpen={activePanel === 'execution'}
            onClose={closePanel}
            title={formatMessage({ id: 'terminalDashboard.toolbar.executionMonitor', defaultMessage: 'Execution Monitor' })}
            side="right"
            width={380}
          >
            <ExecutionMonitorPanel />
          </FloatingPanel>
        )}

        <FloatingPanel
          isOpen={activePanel === 'scheduler'}
          onClose={closePanel}
          title={formatMessage({ id: 'terminalDashboard.toolbar.scheduler', defaultMessage: 'Scheduler' })}
          side="right"
          width={340}
        >
          <SchedulerPanel />
        </FloatingPanel>
      </AssociationHighlightProvider>
    </div>
  );
}

export default TerminalDashboardPage;
