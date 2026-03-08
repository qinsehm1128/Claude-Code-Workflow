// ========================================
// DashboardToolbar Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithI18n, screen, fireEvent } from '@/test/i18n';
import { DashboardToolbar } from './DashboardToolbar';

const mockState = vi.hoisted(() => ({
  currentProjectPath: 'D:/workspace-a',
  resetLayout: vi.fn(),
  createSessionAndAssign: vi.fn(),
  updateTerminalMeta: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/useIssues', () => ({
  useIssues: () => ({ openCount: 0 }),
  useIssueQueue: () => ({ data: { grouped_items: {} } }),
}));

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: (selector: (state: { projectPath: string | null }) => unknown) =>
    selector({ projectPath: mockState.currentProjectPath }),
  selectProjectPath: (state: { projectPath: string | null }) => state.projectPath,
}));

vi.mock('@/stores/issueQueueIntegrationStore', () => ({
  useIssueQueueIntegrationStore: (selector: (state: { associationChain: null }) => unknown) =>
    selector({ associationChain: null }),
  selectAssociationChain: (state: { associationChain: null }) => state.associationChain,
}));

vi.mock('@/stores/terminalGridStore', () => ({
  useTerminalGridStore: (selector: (state: {
    resetLayout: typeof mockState.resetLayout;
    focusedPaneId: string;
    createSessionAndAssign: typeof mockState.createSessionAndAssign;
  }) => unknown) =>
    selector({
      resetLayout: mockState.resetLayout,
      focusedPaneId: 'pane-1',
      createSessionAndAssign: mockState.createSessionAndAssign,
    }),
  selectTerminalGridFocusedPaneId: (state: { focusedPaneId: string }) => state.focusedPaneId,
}));

vi.mock('@/stores/executionMonitorStore', () => ({
  useExecutionMonitorStore: (selector: (state: { count: number }) => unknown) => selector({ count: 0 }),
  selectActiveExecutionCount: (state: { count: number }) => state.count,
}));

vi.mock('@/stores/sessionManagerStore', () => ({
  useSessionManagerStore: (selector: (state: { updateTerminalMeta: typeof mockState.updateTerminalMeta }) => unknown) =>
    selector({ updateTerminalMeta: mockState.updateTerminalMeta }),
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

vi.mock('@/stores/queueSchedulerStore', () => ({
  useQueueSchedulerStore: (selector: (state: { status: string }) => unknown) => selector({ status: 'idle' }),
  selectQueueSchedulerStatus: (state: { status: string }) => state.status,
}));

vi.mock('@/stores/notificationStore', () => ({
  toast: {
    error: mockState.toastError,
  },
}));

vi.mock('./CliConfigModal', () => ({
  CliConfigModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="cli-config-modal">open</div> : null,
}));

describe('DashboardToolbar', () => {
  beforeEach(() => {
    mockState.currentProjectPath = 'D:/workspace-a';
    mockState.resetLayout.mockReset();
    mockState.createSessionAndAssign.mockReset();
    mockState.updateTerminalMeta.mockReset();
    mockState.toastError.mockReset();
  });

  it('closes the CLI config modal when workspace changes', () => {
    const view = renderWithI18n(
      <DashboardToolbar
        activePanel={null}
        onTogglePanel={() => undefined}
        isFileSidebarOpen
        onToggleFileSidebar={() => undefined}
        isSessionSidebarOpen
        onToggleSessionSidebar={() => undefined}
        isFullscreen={false}
        onToggleFullscreen={() => undefined}
      />
    );

    fireEvent.click(screen.getByTitle('Click to configure and launch a CLI session'));
    expect(screen.getByTestId('cli-config-modal')).toBeInTheDocument();

    mockState.currentProjectPath = 'D:/workspace-b';
    view.rerender(
      <DashboardToolbar
        activePanel={null}
        onTogglePanel={() => undefined}
        isFileSidebarOpen
        onToggleFileSidebar={() => undefined}
        isSessionSidebarOpen
        onToggleSessionSidebar={() => undefined}
        isFullscreen={false}
        onToggleFullscreen={() => undefined}
      />
    );

    expect(screen.queryByTestId('cli-config-modal')).not.toBeInTheDocument();
  });
});
