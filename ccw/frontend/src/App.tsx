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
import { fetchCliSessions, initializeCsrfToken } from './lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { useCliStreamStore } from '@/stores/cliStreamStore';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useExecutionMonitorStore } from '@/stores/executionMonitorStore';
import { useSessionManagerStore } from '@/stores/sessionManagerStore';
import { syncConfigStoreFromBackend } from '@/stores/configStore';
import { useIssueQueueIntegrationStore } from '@/stores/issueQueueIntegrationStore';
import { useQueueExecutionStore } from '@/stores/queueExecutionStore';
import { useQueueSchedulerStore } from '@/stores/queueSchedulerStore';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useTerminalGridStore } from '@/stores/terminalGridStore';
import { useActiveCliExecutions, ACTIVE_CLI_EXECUTIONS_QUERY_KEY } from '@/hooks/useActiveCliExecutions';
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
  // Initialize CSRF token on app mount
  useEffect(() => {
    initializeCsrfToken().catch(console.error);
    syncConfigStoreFromBackend().catch(() => {
      // syncConfigStoreFromBackend already logs the failure reason
    });
  }, []);

  return (
    <IntlProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <DialogStyleProvider>
          <QueryInvalidator />
          <CliSessionSync />
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
    // Register callback to invalidate all workspace-related queries on workspace switch
    const callback = () => {
      useCliStreamStore.getState().resetState();
      useCliSessionStore.getState().resetState();
      useExecutionMonitorStore.getState().resetState();
      useSessionManagerStore.getState().resetState();
      useIssueQueueIntegrationStore.getState().resetState();
      useQueueExecutionStore.getState().resetState();
      const queueSchedulerStore = useQueueSchedulerStore.getState();
      queueSchedulerStore.resetState();
      const nextProjectPath = useWorkflowStore.getState().projectPath;
      if (nextProjectPath) {
        void queueSchedulerStore.loadInitialState().catch((error) => {
          console.error('[QueueSchedulerSync] Failed to sync scheduler state:', error);
        });
      }
      useTerminalPanelStore.getState().resetState();
      useTerminalGridStore.getState().resetWorkspaceState();
      queryClient.invalidateQueries({ queryKey: ACTIVE_CLI_EXECUTIONS_QUERY_KEY });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          if (!Array.isArray(queryKey)) return false;
          const prefix = queryKey[0];
          // Invalidate all query families that depend on workspace data
          return prefix === 'workspace'
            || prefix === 'projectOverview'
            || prefix === 'workflowStatusCounts'
            || prefix === 'dashboardStats';
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
function CliSessionSync() {
  const projectPath = useWorkflowStore(selectProjectPath);
  const setSessions = useCliSessionStore((state) => state.setSessions);

  useEffect(() => {
    let cancelled = false;

    if (!projectPath) {
      setSessions([]);
      return () => {
        cancelled = true;
      };
    }

    fetchCliSessions(projectPath)
      .then(({ sessions }) => {
        if (!cancelled) {
          setSessions(sessions);
        }
      })
      .catch((error) => {
        console.error('[CliSessionSync] Failed to sync CLI sessions:', error);
        if (!cancelled) {
          setSessions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath, setSessions]);

  return null;
}

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
