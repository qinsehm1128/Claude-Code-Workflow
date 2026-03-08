// ========================================
// SessionGroupTree Tests
// ========================================

import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithI18n, screen, fireEvent } from '@/test/i18n';
import { SessionGroupTree } from './SessionGroupTree';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useSessionManagerStore } from '@/stores/sessionManagerStore';
import { useTerminalGridStore } from '@/stores/terminalGridStore';
import { useWorkflowStore } from '@/stores/workflowStore';

describe('SessionGroupTree', () => {
  beforeEach(() => {
    useCliSessionStore.getState().resetState();
    useSessionManagerStore.getState().resetState();
    useTerminalGridStore.getState().resetLayout('single');

    act(() => {
      useWorkflowStore.setState({ projectPath: 'D:/workspace-a' });
    });

    useCliSessionStore.getState().setSessions([
      {
        sessionKey: 'session-1',
        shellKind: 'bash',
        workingDir: 'D:/workspace-a',
        tool: 'codex',
        createdAt: '2026-03-08T12:00:00.000Z',
        updatedAt: '2026-03-08T12:00:00.000Z',
        isPaused: false,
      },
    ]);
    useSessionManagerStore.getState().updateTerminalMeta('session-1', {
      tag: 'workspace-a-tag',
      status: 'active',
    });
  });

  it('collapses expanded tag groups when workspace changes', () => {
    renderWithI18n(<SessionGroupTree />);

    fireEvent.click(screen.getByRole('button', { name: /workspace-a-tag/i }));
    expect(screen.getByText('codex')).toBeInTheDocument();

    act(() => {
      useWorkflowStore.setState({ projectPath: 'D:/workspace-b' });
    });

    expect(screen.queryByText('codex')).not.toBeInTheDocument();
  });
});
