// ========================================
// TerminalDashboardPage Tests
// ========================================

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithI18n, screen, fireEvent } from '@/test/i18n';
import { TerminalDashboardPage } from './TerminalDashboardPage';

const mockState = vi.hoisted(() => ({
  currentProjectPath: 'D:/workspace-a',
  toggleImmersiveMode: vi.fn(),
}));

vi.mock('allotment', () => {
  const Pane = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Allotment = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Object.assign(Allotment, { Pane });
  return { Allotment };
});

vi.mock('@/components/terminal-dashboard/AssociationHighlight', () => ({
  AssociationHighlightProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/terminal-dashboard/DashboardToolbar', () => ({
  DashboardToolbar: ({ activePanel, onTogglePanel }: { activePanel: string | null; onTogglePanel: (panelId: 'queue') => void }) => (
    <div>
      <div data-testid="active-panel">{activePanel ?? 'none'}</div>
      <button type="button" onClick={() => onTogglePanel('queue')}>
        open-queue
      </button>
    </div>
  ),
}));

vi.mock('@/components/terminal-dashboard/FloatingPanel', () => ({
  FloatingPanel: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="floating-panel-open">{children}</div> : null,
}));

vi.mock('@/components/terminal-dashboard/TerminalGrid', () => ({ TerminalGrid: () => <div>terminal-grid</div> }));
vi.mock('@/components/terminal-dashboard/SessionGroupTree', () => ({ SessionGroupTree: () => <div>session-tree</div> }));
vi.mock('@/components/terminal-dashboard/IssuePanel', () => ({ IssuePanel: () => <div>issue-panel</div> }));
vi.mock('@/components/terminal-dashboard/QueuePanel', () => ({ QueuePanel: () => <div>queue-panel</div> }));
vi.mock('@/components/terminal-dashboard/QueueListColumn', () => ({ QueueListColumn: () => <div>queue-list</div> }));
vi.mock('@/components/terminal-dashboard/SchedulerPanel', () => ({ SchedulerPanel: () => <div>scheduler-panel</div> }));
vi.mock('@/components/terminal-dashboard/BottomInspector', () => ({ InspectorContent: () => <div>inspector-panel</div> }));
vi.mock('@/components/terminal-dashboard/ExecutionMonitorPanel', () => ({ ExecutionMonitorPanel: () => <div>execution-panel</div> }));
vi.mock('@/components/terminal-dashboard/FileSidebarPanel', () => ({
  FileSidebarPanel: () => <div>file-sidebar</div>,
}));

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: (selector: (state: { projectPath: string | null }) => unknown) =>
    selector({ projectPath: mockState.currentProjectPath }),
  selectProjectPath: (state: { projectPath: string | null }) => state.projectPath,
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (state: { isImmersiveMode: boolean; toggleImmersiveMode: () => void }) => unknown) =>
    selector({ isImmersiveMode: false, toggleImmersiveMode: mockState.toggleImmersiveMode }),
  selectIsImmersiveMode: (state: { isImmersiveMode: boolean }) => state.isImmersiveMode,
}));

vi.mock('@/stores/configStore', () => ({
  useConfigStore: (selector: (state: { featureFlags: Record<string, boolean> }) => unknown) =>
    selector({
      featureFlags: {
        dashboardQueuePanelEnabled: true,
        dashboardInspectorEnabled: true,
        dashboardExecutionMonitorEnabled: true,
      },
    }),
}));

describe('TerminalDashboardPage', () => {
  beforeEach(() => {
    mockState.currentProjectPath = 'D:/workspace-a';
    mockState.toggleImmersiveMode.mockReset();
  });

  it('clears the active floating panel when workspace changes', () => {
    const view = renderWithI18n(<TerminalDashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'open-queue' }));

    expect(screen.getByTestId('active-panel').textContent).toBe('queue');
    expect(screen.getByText('queue-panel')).toBeInTheDocument();

    mockState.currentProjectPath = 'D:/workspace-b';
    view.rerender(<TerminalDashboardPage />);

    expect(screen.getByTestId('active-panel').textContent).toBe('none');
    expect(screen.queryByText('queue-panel')).not.toBeInTheDocument();
  });
});
