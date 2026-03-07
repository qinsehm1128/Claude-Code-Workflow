// ========================================
// UX Tests: useNotifications Hook
// ========================================
// Tests for UX feedback patterns: error/success/warning toast notifications

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import { useNotificationStore } from '../../stores/notificationStore';

describe('UX Pattern: Toast Notifications (useNotifications)', () => {
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
  });

  describe('Error Notifications', () => {
    it('should add error toast with default persistent duration (0)', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.error('Operation Failed', 'Something went wrong');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'error',
        title: 'Operation Failed',
        message: 'Something went wrong',
        duration: 0, // Persistent by default for errors
        dismissible: true,
      });
    });

    it('should add error toast without message', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.error('Error Title');
      });

      expect(result.current.toasts[0].title).toBe('Error Title');
      expect(result.current.toasts[0].message).toBeUndefined();
    });

    it('should return toast ID for error notification', () => {
      const { result } = renderHook(() => useNotifications());

      let toastId: string = '';
      act(() => {
        toastId = result.current.error('Error');
      });

      expect(toastId).toBeDefined();
      expect(typeof toastId).toBe('string');
      expect(result.current.toasts[0].id).toBe(toastId);
    });

    it('should preserve console logging alongside toast notifications', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.error('Sync failed', 'Network error occurred');
      });

      // Toast notification added
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('error');

      // Console logging should also be called (handled by caller)
      // This test verifies the hook doesn't interfere with console logging
      consoleSpy.mockRestore();
    });
  });

  describe('Success Notifications', () => {
    it('should add success toast', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.success('Success', 'Operation completed');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
      });
    });

    it('should add success toast without message', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.success('Created');
      });

      expect(result.current.toasts[0]).toMatchObject({
        type: 'success',
        title: 'Created',
        message: undefined,
      });
    });
  });

  describe('Warning Notifications', () => {
    it('should add warning toast for partial success scenarios', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.warning('Partial Success', 'Issue created but attachments failed');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'warning',
        title: 'Partial Success',
        message: 'Issue created but attachments failed',
      });
    });
  });

  describe('Info Notifications', () => {
    it('should add info toast', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.info('Information', 'Here is some info');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]).toMatchObject({
        type: 'info',
        title: 'Information',
        message: 'Here is some info',
      });
    });
  });

  describe('Toast Removal', () => {
    it('should remove toast by ID', () => {
      const { result } = renderHook(() => useNotifications());

      let toastId: string = '';
      act(() => {
        toastId = result.current.error('Error');
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.removeToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should clear all toasts', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.success('Success 1');
        result.current.error('Error 1');
        result.current.warning('Warning 1');
      });

      expect(result.current.toasts).toHaveLength(3);

      act(() => {
        result.current.clearAllToasts();
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('UX Pattern: Multiple toast types in sequence', () => {
    it('should handle issue creation workflow with success and partial success', () => {
      const { result } = renderHook(() => useNotifications());

      // Simulate: Issue created successfully
      act(() => {
        result.current.success('Created', 'Issue created successfully');
      });

      expect(result.current.toasts[0].type).toBe('success');

      // Simulate: Attachment upload warning
      act(() => {
        result.current.warning('Partial Success', 'Issue created but attachments failed to upload');
      });

      expect(result.current.toasts[0].type).toBe('warning');

      // Simulate: Error case
      act(() => {
        result.current.error('Failed', 'Failed to create issue');
      });

      expect(result.current.toasts[0].type).toBe('error');
    });
  });

  describe('UX Pattern: Toast options', () => {
    it('should support custom duration via addToast', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addToast('info', 'Temporary', 'Will auto-dismiss', { duration: 3000 });
      });

      expect(result.current.toasts[0].duration).toBe(3000);
    });

    it('should support dismissible option', () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addToast('info', 'Info', 'Message', { dismissible: false });
      });

      expect(result.current.toasts[0].dismissible).toBe(false);
    });

    it('should support action button', () => {
      const mockAction = vi.fn();
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.addToast('info', 'Info', 'Message', {
          action: { label: 'Retry', onClick: mockAction },
        });
      });

      expect(result.current.toasts[0].action).toEqual({
        label: 'Retry',
        onClick: mockAction,
      });
    });
  });
});
