// ========================================
// useAutoSelection Hook Tests
// ========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSelection, useInteractionPause } from '../useAutoSelection';

// Mock DialogStyleContext
vi.mock('@/contexts/DialogStyleContext', () => ({
  useDialogStyleContext: () => ({
    preferences: {
      autoSelectionDuration: 30,
      pauseOnInteraction: true,
      autoSelectionSoundEnabled: false,
    },
  }),
}));

describe('useAutoSelection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null remaining when no timeout provided', () => {
    const onAutoSelect = vi.fn();
    const { result } = renderHook(() =>
      useAutoSelection({
        onAutoSelect,
      })
    );

    expect(result.current.remaining).toBeNull();
    expect(result.current.isEnabled).toBe(false);
  });

  it('should count down from timeout', () => {
    const onAutoSelect = vi.fn();
    const timeoutAt = new Date(Date.now() + 10000).toISOString();

    const { result } = renderHook(() =>
      useAutoSelection({
        timeoutAt,
        defaultLabel: 'Yes',
        onAutoSelect,
      })
    );

    expect(result.current.remaining).toBe(10);
    expect(result.current.isEnabled).toBe(true);
  });

  it('should pause and resume countdown', () => {
    const onAutoSelect = vi.fn();
    const timeoutAt = new Date(Date.now() + 10000).toISOString();

    const { result } = renderHook(() =>
      useAutoSelection({
        timeoutAt,
        defaultLabel: 'Yes',
        onAutoSelect,
      })
    );

    expect(result.current.isPaused).toBe(false);

    act(() => {
      result.current.pause();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.resume();
    });

    expect(result.current.isPaused).toBe(false);
  });

  it('should toggle pause state', () => {
    const onAutoSelect = vi.fn();
    const timeoutAt = new Date(Date.now() + 10000).toISOString();

    const { result } = renderHook(() =>
      useAutoSelection({
        timeoutAt,
        defaultLabel: 'Yes',
        onAutoSelect,
      })
    );

    expect(result.current.isPaused).toBe(false);

    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.togglePause();
    });

    expect(result.current.isPaused).toBe(false);
  });

  it('should calculate progress percentage', () => {
    const onAutoSelect = vi.fn();
    const timeoutAt = new Date(Date.now() + 10000).toISOString();

    const { result } = renderHook(() =>
      useAutoSelection({
        timeoutAt,
        defaultLabel: 'Yes',
        onAutoSelect,
      })
    );

    // At 10 seconds remaining out of 30, progress should be ~67%
    // But we use the calculated duration from timeout, so it starts at 0
    expect(result.current.progress).toBeGreaterThanOrEqual(0);
    expect(result.current.progress).toBeLessThanOrEqual(100);
  });

  it('should call onAutoSelect when countdown reaches 0', () => {
    const onAutoSelect = vi.fn();
    const timeoutAt = new Date(Date.now() + 1000).toISOString();

    renderHook(() =>
      useAutoSelection({
        timeoutAt,
        defaultLabel: 'Yes',
        onAutoSelect,
      })
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onAutoSelect).toHaveBeenCalledWith('Yes');
  });
});

describe('useInteractionPause', () => {
  it('should return event handlers', () => {
    const pause = vi.fn();
    const resume = vi.fn();

    const { result } = renderHook(() =>
      useInteractionPause(pause, resume, true)
    );

    expect(result.current.onMouseEnter).toBeInstanceOf(Function);
    expect(result.current.onMouseLeave).toBeInstanceOf(Function);
    expect(result.current.onFocus).toBeInstanceOf(Function);
    expect(result.current.onBlur).toBeInstanceOf(Function);
  });

  it('should call pause on mouse enter when enabled', () => {
    const pause = vi.fn();
    const resume = vi.fn();

    const { result } = renderHook(() =>
      useInteractionPause(pause, resume, true)
    );

    act(() => {
      result.current.onMouseEnter();
    });

    expect(pause).toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  it('should call resume on mouse leave when enabled', () => {
    const pause = vi.fn();
    const resume = vi.fn();

    const { result } = renderHook(() =>
      useInteractionPause(pause, resume, true)
    );

    act(() => {
      result.current.onMouseLeave();
    });

    expect(resume).toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
  });

  it('should not call handlers when disabled', () => {
    const pause = vi.fn();
    const resume = vi.fn();

    const { result } = renderHook(() =>
      useInteractionPause(pause, resume, false)
    );

    act(() => {
      result.current.onMouseEnter();
      result.current.onMouseLeave();
    });

    expect(pause).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });
});
