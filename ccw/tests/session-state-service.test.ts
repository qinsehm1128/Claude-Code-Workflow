/**
 * Tests for SessionStateService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateSessionId,
  getSessionStatePath,
  loadSessionState,
  saveSessionState,
  clearSessionState,
  updateSessionState,
  incrementSessionLoad,
  SessionStateService,
  type SessionState
} from '../src/core/services/session-state-service.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('validateSessionId', () => {
  it('should accept valid session IDs', () => {
    expect(validateSessionId('abc123')).toBe(true);
    expect(validateSessionId('session-123')).toBe(true);
    expect(validateSessionId('test_session')).toBe(true);
    expect(validateSessionId('a')).toBe(true);
    expect(validateSessionId('ABC-123_XYZ')).toBe(true);
  });

  it('should reject invalid session IDs', () => {
    expect(validateSessionId('')).toBe(false);
    expect(validateSessionId('.hidden')).toBe(false);
    expect(validateSessionId('-starts-with-dash')).toBe(false);
    expect(validateSessionId('../../../etc')).toBe(false);
    expect(validateSessionId('has spaces')).toBe(false);
    expect(validateSessionId('has/slash')).toBe(false);
    expect(validateSessionId('has\\backslash')).toBe(false);
    expect(validateSessionId('has.dot')).toBe(false);
  });

  it('should reject non-string inputs', () => {
    expect(validateSessionId(null as any)).toBe(false);
    expect(validateSessionId(undefined as any)).toBe(false);
    expect(validateSessionId(123 as any)).toBe(false);
  });
});

describe('getSessionStatePath', () => {
  const testSessionId = 'test-session-123';

  describe('global storage (default)', () => {
    it('should return path in global state directory', () => {
      const path = getSessionStatePath(testSessionId);
      expect(path).toContain('.claude');
      expect(path).toContain('.ccw-sessions');
      expect(path).toContain(`session-${testSessionId}.json`);
    });

    it('should throw error for invalid session ID', () => {
      expect(() => getSessionStatePath('../../../etc')).toThrow('Invalid session ID');
    });
  });

  describe('session-scoped storage', () => {
    const projectPath = '/tmp/test-project';

    it('should return path in project session directory', () => {
      const path = getSessionStatePath(testSessionId, {
        storageType: 'session-scoped',
        projectPath
      });
      expect(path).toContain('.workflow');
      expect(path).toContain('sessions');
      expect(path).toContain(testSessionId);
      expect(path).toContain('state.json');
    });

    it('should throw error when projectPath is missing', () => {
      expect(() => getSessionStatePath(testSessionId, { storageType: 'session-scoped' }))
        .toThrow('projectPath is required');
    });
  });
});

describe('loadSessionState / saveSessionState', () => {
  const testSessionId = 'test-load-save-session';
  const testState: SessionState = {
    firstLoad: '2025-01-01T00:00:00.000Z',
    loadCount: 5,
    lastPrompt: 'test prompt'
  };

  afterEach(() => {
    // Cleanup
    try {
      clearSessionState(testSessionId);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return null for non-existent session', () => {
    const state = loadSessionState('non-existent-session-xyz');
    expect(state).toBeNull();
  });

  it('should save and load session state', () => {
    saveSessionState(testSessionId, testState);
    const loaded = loadSessionState(testSessionId);

    expect(loaded).not.toBeNull();
    expect(loaded!.firstLoad).toBe(testState.firstLoad);
    expect(loaded!.loadCount).toBe(testState.loadCount);
    expect(loaded!.lastPrompt).toBe(testState.lastPrompt);
  });

  it('should return null for invalid session ID', () => {
    expect(loadSessionState('../../../etc')).toBeNull();
  });

  it('should handle state without optional fields', () => {
    const minimalState: SessionState = {
      firstLoad: '2025-01-01T00:00:00.000Z',
      loadCount: 1
    };

    saveSessionState(testSessionId, minimalState);
    const loaded = loadSessionState(testSessionId);

    expect(loaded).not.toBeNull();
    expect(loaded!.lastPrompt).toBeUndefined();
    expect(loaded!.activeMode).toBeUndefined();
  });
});

describe('clearSessionState', () => {
  const testSessionId = 'test-clear-session';

  it('should clear existing session state', () => {
    saveSessionState(testSessionId, {
      firstLoad: new Date().toISOString(),
      loadCount: 1
    });

    expect(loadSessionState(testSessionId)).not.toBeNull();

    const result = clearSessionState(testSessionId);
    expect(result).toBe(true);
    expect(loadSessionState(testSessionId)).toBeNull();
  });

  it('should return false for non-existent session', () => {
    const result = clearSessionState('non-existent-session-xyz');
    expect(result).toBe(false);
  });

  it('should return false for invalid session ID', () => {
    expect(clearSessionState('../../../etc')).toBe(false);
  });
});

describe('updateSessionState', () => {
  const testSessionId = 'test-update-session';

  afterEach(() => {
    try {
      clearSessionState(testSessionId);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create new state if none exists', () => {
    const state = updateSessionState(testSessionId, { loadCount: 1 });

    expect(state.firstLoad).toBeDefined();
    expect(state.loadCount).toBe(1);
  });

  it('should merge updates with existing state', () => {
    saveSessionState(testSessionId, {
      firstLoad: '2025-01-01T00:00:00.000Z',
      loadCount: 5,
      lastPrompt: 'old prompt'
    });

    const state = updateSessionState(testSessionId, {
      loadCount: 6,
      lastPrompt: 'new prompt'
    });

    expect(state.firstLoad).toBe('2025-01-01T00:00:00.000Z');
    expect(state.loadCount).toBe(6);
    expect(state.lastPrompt).toBe('new prompt');
  });
});

describe('incrementSessionLoad', () => {
  const testSessionId = 'test-increment-session';

  afterEach(() => {
    try {
      clearSessionState(testSessionId);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create new state on first load', () => {
    const result = incrementSessionLoad(testSessionId, 'first prompt');

    expect(result.isFirstPrompt).toBe(true);
    expect(result.state.loadCount).toBe(1);
    expect(result.state.lastPrompt).toBe('first prompt');
  });

  it('should increment load count on subsequent loads', () => {
    incrementSessionLoad(testSessionId, 'first prompt');
    const result = incrementSessionLoad(testSessionId, 'second prompt');

    expect(result.isFirstPrompt).toBe(false);
    expect(result.state.loadCount).toBe(2);
    expect(result.state.lastPrompt).toBe('second prompt');
  });

  it('should preserve prompt when not provided', () => {
    incrementSessionLoad(testSessionId, 'first prompt');
    const result = incrementSessionLoad(testSessionId);

    expect(result.state.lastPrompt).toBe('first prompt');
  });
});

describe('SessionStateService class', () => {
  const testSessionId = 'test-service-class-session';
  let service: SessionStateService;

  beforeEach(() => {
    service = new SessionStateService();
  });

  afterEach(() => {
    try {
      service.clear(testSessionId);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should provide object-oriented interface', () => {
    const result = service.incrementLoad(testSessionId, 'test prompt');

    expect(result.isFirstPrompt).toBe(true);
    expect(service.getLoadCount(testSessionId)).toBe(1);
    expect(service.isFirstLoad(testSessionId)).toBe(false);
  });

  it('should support update method', () => {
    service.save(testSessionId, {
      firstLoad: new Date().toISOString(),
      loadCount: 1
    });

    const state = service.update(testSessionId, { activeMode: 'write' });
    expect(state.activeMode).toBe('write');
    expect(state.loadCount).toBe(1);
  });
});
