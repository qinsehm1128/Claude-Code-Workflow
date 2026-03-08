// ========================================
// QueuePanel Tests
// ========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithI18n, screen, fireEvent } from '@/test/i18n';
import { QueuePanel } from './QueuePanel';

const mockState = vi.hoisted(() => ({
  currentProjectPath: 'D:/workspace-a',
  loadInitialState: vi.fn(),
  buildAssociationChain: vi.fn(),
}));

vi.mock('@/hooks/useIssues', () => ({
  useIssueQueue: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: (selector: (state: { projectPath: string | null }) => unknown) =>
    selector({ projectPath: mockState.currentProjectPath }),
  selectProjectPath: (state: { projectPath: string | null }) => state.projectPath,
}));

vi.mock('@/stores/issueQueueIntegrationStore', () => ({
  useIssueQueueIntegrationStore: (selector: (state: {
    associationChain: null;
    buildAssociationChain: typeof mockState.buildAssociationChain;
  }) => unknown) =>
    selector({ associationChain: null, buildAssociationChain: mockState.buildAssociationChain }),
  selectAssociationChain: (state: { associationChain: null }) => state.associationChain,
}));

vi.mock('@/stores/queueExecutionStore', () => ({
  useQueueExecutionStore: () => [],
  selectByQueueItem: () => () => [],
}));

vi.mock('@/stores/queueSchedulerStore', () => ({
  useQueueSchedulerStore: (selector: (state: {
    status: string;
    items: never[];
    loadInitialState: typeof mockState.loadInitialState;
  }) => unknown) =>
    selector({ status: 'idle', items: [], loadInitialState: mockState.loadInitialState }),
  selectQueueSchedulerStatus: (state: { status: string }) => state.status,
  selectQueueItems: (state: { items: never[] }) => state.items,
}));

vi.mock('@/stores/orchestratorStore', () => ({
  useOrchestratorStore: (selector: (state: { activePlans: Record<string, never>; activePlanCount: number }) => unknown) =>
    selector({ activePlans: {}, activePlanCount: 0 }),
  selectActivePlans: (state: { activePlans: Record<string, never> }) => state.activePlans,
  selectActivePlanCount: (state: { activePlanCount: number }) => state.activePlanCount,
}));

describe('QueuePanel', () => {
  beforeEach(() => {
    mockState.currentProjectPath = 'D:/workspace-a';
    mockState.loadInitialState.mockReset();
    mockState.buildAssociationChain.mockReset();
  });

  it('resets the active tab back to queue when workspace changes', () => {
    const view = renderWithI18n(<QueuePanel />);

    fireEvent.click(screen.getByRole('button', { name: /orchestrator/i }));
    expect(screen.getByText('No active orchestrations')).toBeInTheDocument();

    mockState.currentProjectPath = 'D:/workspace-b';
    view.rerender(<QueuePanel />);

    expect(screen.queryByText('No active orchestrations')).not.toBeInTheDocument();
  });
});
