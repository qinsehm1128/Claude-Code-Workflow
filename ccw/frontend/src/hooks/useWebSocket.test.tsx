// ========================================
// useWebSocket Hook Tests
// ========================================

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from './useWebSocket';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useExecutionMonitorStore } from '@/stores/executionMonitorStore';
import { useSessionManagerStore } from '@/stores/sessionManagerStore';
import { useWorkflowStore } from '@/stores/workflowStore';

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

function createSession(sessionKey: string, workingDir = 'D:/workspace-a') {
  return {
    sessionKey,
    shellKind: 'pwsh',
    workingDir,
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    isPaused: false,
  };
}

function connectHook() {
  const hook = renderHook(() => useWebSocket({ enabled: true }));
  const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!socket) {
    throw new Error('Expected WebSocket to be created');
  }

  act(() => {
    socket.open();
  });

  return { ...hook, socket };
}

describe('useWebSocket workspace scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    MockWebSocket.instances = [];

    useCliSessionStore.getState().resetState();
    useExecutionMonitorStore.getState().resetState();
    useSessionManagerStore.getState().resetState();
    useWorkflowStore.setState({ projectPath: 'D:\\workspace-a' });

    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    useCliSessionStore.getState().resetState();
    useExecutionMonitorStore.getState().resetState();
    useSessionManagerStore.getState().resetState();
    vi.unstubAllGlobals();
  });

  it('ignores scoped CLI and execution messages from another workspace', () => {
    const { socket } = connectHook();

    act(() => {
      socket.message({
        type: 'CLI_SESSION_CREATED',
        payload: {
          session: createSession('session-foreign', 'D:/workspace-b'),
          timestamp: '2026-03-08T12:00:01.000Z',
          projectPath: 'D:/workspace-b',
        },
      });
      socket.message({
        type: 'CLI_SESSION_LOCKED',
        payload: {
          sessionKey: 'session-foreign',
          reason: 'Foreign execution',
          executionId: 'exec-foreign',
          timestamp: '2026-03-08T12:00:02.000Z',
          projectPath: 'D:/workspace-b',
        },
      });
      socket.message({
        type: 'EXECUTION_STARTED',
        payload: {
          executionId: 'exec-foreign',
          flowId: 'flow-foreign',
          sessionKey: 'session-foreign',
          stepName: 'Foreign flow',
          totalSteps: 2,
          timestamp: '2026-03-08T12:00:03.000Z',
          projectPath: 'D:/workspace-b',
        },
      });
    });

    expect(useCliSessionStore.getState().sessions['session-foreign']).toBeUndefined();
    expect(useSessionManagerStore.getState().terminalMetas['session-foreign']).toBeUndefined();
    expect(useExecutionMonitorStore.getState().activeExecutions['exec-foreign']).toBeUndefined();
  });

  it('handles matching scoped messages and legacy messages for known sessions', () => {
    const { socket } = connectHook();

    act(() => {
      socket.message({
        type: 'CLI_SESSION_CREATED',
        payload: {
          session: createSession('session-local', 'D:/workspace-a/subdir'),
          timestamp: '2026-03-08T12:00:01.000Z',
          projectPath: 'd:/workspace-a',
        },
      });
      socket.message({
        type: 'CLI_SESSION_OUTPUT',
        payload: {
          sessionKey: 'session-local',
          data: 'hello from current workspace',
          timestamp: '2026-03-08T12:00:02.000Z',
        },
      });
      socket.message({
        type: 'CLI_SESSION_LOCKED',
        payload: {
          sessionKey: 'session-local',
          reason: 'Current execution',
          executionId: 'exec-local',
          timestamp: '2026-03-08T12:00:03.000Z',
          projectPath: 'D:/workspace-a',
        },
      });
      socket.message({
        type: 'EXECUTION_STARTED',
        payload: {
          executionId: 'exec-local',
          flowId: 'flow-local',
          sessionKey: 'session-local',
          stepName: 'Current flow',
          totalSteps: 3,
          timestamp: '2026-03-08T12:00:04.000Z',
        },
      });
    });

    const cliState = useCliSessionStore.getState();
    expect(cliState.sessions['session-local']?.workingDir).toBe('D:/workspace-a/subdir');
    expect(cliState.outputChunks['session-local']).toEqual([
      {
        data: 'hello from current workspace',
        timestamp: expect.any(Number),
      },
    ]);

    const sessionManagerState = useSessionManagerStore.getState();
    expect(sessionManagerState.terminalMetas['session-local']?.isLocked).toBe(true);
    expect(sessionManagerState.terminalMetas['session-local']?.lockedByExecutionId).toBe('exec-local');

    const executionState = useExecutionMonitorStore.getState();
    expect(executionState.activeExecutions['exec-local']?.sessionKey).toBe('session-local');
    expect(executionState.currentExecutionId).toBe('exec-local');
  });

  it('ignores legacy unscoped messages when session is unknown', () => {
    const { socket } = connectHook();

    act(() => {
      socket.message({
        type: 'CLI_SESSION_OUTPUT',
        payload: {
          sessionKey: 'session-unknown',
          data: 'should be ignored',
          timestamp: '2026-03-08T12:00:02.000Z',
        },
      });
      socket.message({
        type: 'EXECUTION_STARTED',
        payload: {
          executionId: 'exec-unknown',
          flowId: 'flow-unknown',
          sessionKey: 'session-unknown',
          stepName: 'Unknown flow',
          totalSteps: 1,
          timestamp: '2026-03-08T12:00:03.000Z',
        },
      });
    });

    expect(useCliSessionStore.getState().outputChunks['session-unknown']).toBeUndefined();
    expect(useExecutionMonitorStore.getState().activeExecutions['exec-unknown']).toBeUndefined();
  });
});
