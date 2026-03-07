// ========================================
// useHasHydrated Hook
// ========================================
// Determines if the Zustand workflow store has been rehydrated from localStorage
// Uses Zustand persist middleware's onFinishHydration callback for reliable detection

import { useState, useEffect } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';

/**
 * A hook to determine if the Zustand workflow store has been rehydrated.
 * Returns `true` once the persisted state has been loaded from localStorage.
 * 
 * This hook uses the Zustand persist middleware's onFinishHydration callback
 * instead of relying on internal state management, which avoids circular
 * reference issues during store initialization.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const hasHydrated = useHasHydrated();
 *   
 *   useEffect(() => {
 *     if (!hasHydrated) return;
 *     // Safe to access persisted store values here
 *   }, [hasHydrated]);
 *   
 *   if (!hasHydrated) return <LoadingSpinner />;
 *   return <Content />;
 * }
 * ```
 */
export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => {
    // Check initial hydration status synchronously
    return useWorkflowStore.persist.hasHydrated();
  });

  useEffect(() => {
    // If already hydrated, no need to subscribe
    if (hydrated) return;

    // Subscribe to hydration completion event
    // onFinishHydration returns an unsubscribe function
    const unsubscribe = useWorkflowStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, [hydrated]);

  return hydrated;
}

export default useHasHydrated;
