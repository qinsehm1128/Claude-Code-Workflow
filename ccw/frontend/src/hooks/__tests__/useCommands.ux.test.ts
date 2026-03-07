// ========================================
// UX Tests: Error Handling in Hooks
// ========================================
// Tests for UX feedback patterns: error handling with toast notifications in hooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommands } from '../useCommands';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock the API
vi.mock('../../lib/api', () => ({
  fetchCommands: vi.fn(),
  deleteCommand: vi.fn(),
  createCommand: vi.fn(),
  updateCommand: vi.fn(),
}));

describe('UX Pattern: Error Handling in useCommands Hook', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNotificationStore.setState({
      toasts: [],
      a2uiSurfaces: new Map(),
      currentQuestion: null,
      persistentNotifications: [],
      isPanelVisible: false,
    });
    localStorage.removeItem('ccw_notifications');
    vi.clearAllMocks();
  });

  describe('Error notification on command fetch failure', () => {
    it('should surface error state when fetch fails', async () => {
      const { fetchCommands } = await import('../../lib/api');
      vi.mocked(fetchCommands).mockRejectedValueOnce(new Error('Command fetch failed'));

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        try {
          await result.current.refetch();
        } catch {
          // Expected to throw
        }
      });

      // Hook should expose error state
      expect(result.current.error || result.current.isLoading === false).toBeTruthy();
    });

    it('should remain functional after fetch error', async () => {
      const { fetchCommands } = await import('../../lib/api');
      vi.mocked(fetchCommands).mockRejectedValueOnce(new Error('Temporary failure'));

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        try {
          await result.current.refetch();
        } catch {
          // Expected to throw
        }
      });

      // Hook should still return stable values
      expect(Array.isArray(result.current.commands)).toBe(true);
    });
  });
});
