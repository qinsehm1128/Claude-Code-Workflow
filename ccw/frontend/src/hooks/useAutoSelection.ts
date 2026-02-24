// ========================================
// useAutoSelection Hook
// ========================================
// Enhanced auto-selection with pause and sound notification
// Supports configurable duration and interaction pause

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDialogStyleContext } from '@/contexts/DialogStyleContext';

export interface AutoSelectionOptions {
  /** Timeout timestamp from backend (ISO string) */
  timeoutAt?: string;
  /** Default label to auto-select */
  defaultLabel?: string;
  /** Question ID for the action */
  questionId?: string;
  /** Callback when auto-selection triggers */
  onAutoSelect: (defaultLabel: string) => void;
}

export interface AutoSelectionState {
  /** Remaining seconds until auto-selection */
  remaining: number | null;
  /** Whether countdown is paused */
  isPaused: boolean;
  /** Whether auto-selection is enabled */
  isEnabled: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Pause the countdown */
  pause: () => void;
  /** Resume the countdown */
  resume: () => void;
  /** Toggle pause state */
  togglePause: () => void;
}

/**
 * Hook for managing auto-selection countdown with pause support
 */
export function useAutoSelection(options: AutoSelectionOptions): AutoSelectionState {
  const { timeoutAt, defaultLabel, onAutoSelect } = options;
  const { preferences } = useDialogStyleContext();
  
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [totalDuration, setTotalDuration] = useState<number>(preferences.autoSelectionDuration);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundPlayedRef = useRef(false);

  // Calculate total duration from timeout or preferences
  useEffect(() => {
    if (timeoutAt) {
      const target = new Date(timeoutAt).getTime();
      const now = Date.now();
      const calculated = Math.ceil((target - now) / 1000);
      if (calculated > 0) {
        setTotalDuration(calculated);
      }
    } else {
      setTotalDuration(preferences.autoSelectionDuration);
    }
  }, [timeoutAt, preferences.autoSelectionDuration]);

  // Countdown logic
  useEffect(() => {
    if (!timeoutAt || !defaultLabel) {
      setRemaining(null);
      return;
    }

    const target = new Date(timeoutAt).getTime();
    soundPlayedRef.current = false;

    const tick = () => {
      if (isPaused) return;

      const secs = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(secs);

      // Play sound notification 3 seconds before
      if (secs <= 3 && secs > 0 && !soundPlayedRef.current && preferences.autoSelectionSoundEnabled) {
        playNotificationSound();
        soundPlayedRef.current = true;
      }

      // Auto-select when countdown reaches 0
      if (secs === 0) {
        onAutoSelect(defaultLabel);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeoutAt, defaultLabel, isPaused, onAutoSelect, preferences.autoSelectionSoundEnabled]);

  // Pause/Resume handlers
  const pause = useCallback(() => {
    if (preferences.pauseOnInteraction) {
      setIsPaused(true);
    }
  }, [preferences.pauseOnInteraction]);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Calculate progress
  const progress = remaining !== null && totalDuration > 0
    ? Math.round(((totalDuration - remaining) / totalDuration) * 100)
    : 0;

  return {
    remaining,
    isPaused,
    isEnabled: !!timeoutAt && !!defaultLabel,
    progress,
    pause,
    resume,
    togglePause,
  };
}

/**
 * Play a short notification sound
 */
function playNotificationSound(): void {
  try {
    // Create a simple beep using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn('[useAutoSelection] Could not play notification sound:', error);
  }
}

/**
 * Hook for handling interaction pause
 * Automatically pauses countdown when user interacts with the dialog
 */
export function useInteractionPause(
  pause: () => void,
  resume: () => void,
  enabled: boolean
) {
  const handleMouseEnter = useCallback(() => {
    if (enabled) {
      pause();
    }
  }, [pause, enabled]);

  const handleMouseLeave = useCallback(() => {
    if (enabled) {
      resume();
    }
  }, [resume, enabled]);

  const handleFocus = useCallback(() => {
    if (enabled) {
      pause();
    }
  }, [pause, enabled]);

  const handleBlur = useCallback(() => {
    if (enabled) {
      resume();
    }
  }, [resume, enabled]);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };
}

export default useAutoSelection;
