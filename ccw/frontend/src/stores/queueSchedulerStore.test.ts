// ========================================
// Queue Scheduler Store Tests
// ========================================

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueSchedulerState } from '@/types/queue-frontend-types';

type QueueSchedulerModule = typeof import('./queueSchedulerStore');

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createState(status: QueueSchedulerState['status'], issueId: string): QueueSchedulerState {
  return {
    status,
    items: [
      {
        item_id: `${issueId}-Q1`,
        issue_id: issueId,
        status: status === 'running' ? 'executing' : 'pending',
        tool: 'codex',
        prompt: `Handle ${issueId}`,
        depends_on: [],
        execution_order: 1,
        execution_group: 'wave-1',
        createdAt: '2026-03-08T12:00:00.000Z',
      },
    ],
    sessionPool: {},
    config: {
      maxConcurrentSessions: 3,
      sessionIdleTimeoutMs: 60_000,
      resumeKeySessionBindingTimeoutMs: 300_000,
    },
    currentConcurrency: status === 'running' ? 1 : 0,
    lastActivityAt: '2026-03-08T12:00:00.000Z',
    error: undefined,
  };
}

function createFetchResponse(state: QueueSchedulerState) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(state),
  };
}

describe('queueSchedulerStore', () => {
  let useQueueSchedulerStore: QueueSchedulerModule['useQueueSchedulerStore'];
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    ({ useQueueSchedulerStore } = await import('./queueSchedulerStore'));
  });

  afterAll(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    useQueueSchedulerStore.getState().resetState();
  });

  it('resetState clears workspace-scoped scheduler state', () => {
    useQueueSchedulerStore.getState().handleSchedulerMessage({
      type: 'QUEUE_SCHEDULER_STATE_UPDATE',
      state: createState('running', 'ISSUE-1'),
      timestamp: '2026-03-08T12:00:00.000Z',
    });

    expect(useQueueSchedulerStore.getState().status).toBe('running');
    expect(useQueueSchedulerStore.getState().items).toHaveLength(1);

    useQueueSchedulerStore.getState().resetState();

    const nextState = useQueueSchedulerStore.getState();
    expect(nextState.status).toBe('idle');
    expect(nextState.items).toEqual([]);
    expect(nextState.sessionPool).toEqual({});
    expect(nextState.currentConcurrency).toBe(0);
    expect(nextState.error).toBeNull();
  });

  it('ignores stale loadInitialState responses after workspace reset', async () => {
    const staleResponse = createDeferred<ReturnType<typeof createFetchResponse>>();
    const freshResponse = createDeferred<ReturnType<typeof createFetchResponse>>();

    fetchMock
      .mockImplementationOnce(() => staleResponse.promise)
      .mockImplementationOnce(() => freshResponse.promise);

    const firstLoad = useQueueSchedulerStore.getState().loadInitialState();

    useQueueSchedulerStore.getState().resetState();

    const secondLoad = useQueueSchedulerStore.getState().loadInitialState();

    freshResponse.resolve(createFetchResponse(createState('paused', 'ISSUE-NEW')));
    await secondLoad;

    expect(useQueueSchedulerStore.getState().status).toBe('paused');
    expect(useQueueSchedulerStore.getState().items[0]?.issue_id).toBe('ISSUE-NEW');

    staleResponse.resolve(createFetchResponse(createState('running', 'ISSUE-OLD')));
    await firstLoad;

    expect(useQueueSchedulerStore.getState().status).toBe('paused');
    expect(useQueueSchedulerStore.getState().items[0]?.issue_id).toBe('ISSUE-NEW');
  });
});
