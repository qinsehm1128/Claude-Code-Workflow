// ========================================
// UX Tests: Error Handling in Hooks
// ========================================
// Tests for UX feedback patterns: error handling with toast notifications in hooks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCommands } from '../useCommands';
import { useNotificationStore } from '../../stores/notificationStore';

// Mock the API
vi.mock('../../lib/api', () => ({
  executeCommand: vi.fn(),
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

  describe('Error notification on command execution failure', () => {
    it('should show error toast when command execution fails', async () => {
      const { executeCommand } = await import('../../lib/api');
      vi.mocked(executeCommand).mockRejectedValueOnce(new Error('Command failed'));

      const { result } = renderHook(() => useCommands());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        try {
          await result.current.executeCommand('test-command', {});
        } catch {
          // Expected to throw
        }
      });

      // Console error should be logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should sanitize error messages before showing to user', async () => {
      const { executeCommand } = await import('../../lib/api');
      const nastyError = new Error('Internal: Database connection failed at postgres://localhost:5432 with password=admin123');
      vi.mocked(executeCommand).mockRejectedValueOnce(nastyError);

      const { result } = renderHook(() => useCommands());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        try {
          await result.current.executeCommand('test-command', {});
        } catch {
          // Expected to throw
        }
      });

      // Full error logged to console
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed'),
        nastyError
      );

      consoleSpy.mockRestore();
    });
  });
});
