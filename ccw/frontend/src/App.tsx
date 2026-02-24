// ========================================
// App Component
// ========================================
// Root application component with Router provider

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { router } from './router';
import queryClient from './lib/query-client';
import type { Locale } from './lib/i18n';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useActiveCliExecutions } from '@/hooks/useActiveCliExecutions';
import { DialogStyleProvider } from '@/contexts/DialogStyleContext';

interface AppProps {
  locale: Locale;
  messages: Record<string, string>;
}

/**
 * Root App component
 * Provides routing and global providers
 */
function App({ locale, messages }: AppProps) {
  return (
    <IntlProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <DialogStyleProvider>
          <QueryInvalidator />
          <CliExecutionSync />
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </DialogStyleProvider>
      </QueryClientProvider>
    </IntlProvider>
  );
}

/**
 * Query invalidator component
 * Registers callback with workflowStore to invalidate workspace queries on workspace switch
 */
function QueryInvalidator() {
  const registerQueryInvalidator = useWorkflowStore((state) => state.registerQueryInvalidator);

  useEffect(() => {
    // Register callback to invalidate all 'workspace' prefixed queries
    const callback = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          // Check if the first element of the query key is 'workspace'
          return Array.isArray(queryKey) && queryKey[0] === 'workspace';
        },
      });
    };

    registerQueryInvalidator(callback);
  }, [registerQueryInvalidator]);

  return null;
}

/**
 * CLI Execution Sync component
 * Syncs active CLI executions in the background to keep the count updated in Header
 */
function CliExecutionSync() {
  // Always sync active CLI executions with a longer polling interval
  // This ensures the activeCliCount badge in Header shows correct count on initial load
  useActiveCliExecutions(
    true, // enabled: always sync
    15000 // refetchInterval: 15 seconds (longer than monitor's 5 seconds to reduce load)
  );

  return null;
}

export default App;
