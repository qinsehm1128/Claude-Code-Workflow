// ========================================
// IssueDrawer Component
// ========================================
// Right-side issue detail drawer with Overview/Solutions/History tabs

import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { X, FileText, CheckCircle, Circle, Loader2, Tag, History, Hash, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { Issue } from '@/lib/api';
import { useOpenTerminalPanel } from '@/stores/terminalPanelStore';

// ========== Types ==========
export interface IssueDrawerProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabValue;
}

type TabValue = 'overview' | 'solutions' | 'history' | 'terminal' | 'json';

// ========== Status Configuration ==========
const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; icon: React.ComponentType<{ className?: string }> }> = {
  open: { label: 'issues.status.open', variant: 'info', icon: Circle },
  in_progress: { label: 'issues.status.inProgress', variant: 'warning', icon: Loader2 },
  resolved: { label: 'issues.status.resolved', variant: 'success', icon: CheckCircle },
  closed: { label: 'issues.status.closed', variant: 'secondary', icon: Circle },
  completed: { label: 'issues.status.completed', variant: 'success', icon: CheckCircle },
};

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
  low: { label: 'issues.priority.low', variant: 'secondary' },
  medium: { label: 'issues.priority.medium', variant: 'default' },
  high: { label: 'issues.priority.high', variant: 'warning' },
  critical: { label: 'issues.priority.critical', variant: 'destructive' },
};

// ========== Component ==========

export function IssueDrawer({ issue, isOpen, onClose, initialTab = 'overview' }: IssueDrawerProps) {
  const { formatMessage } = useIntl();
  const openTerminal = useOpenTerminalPanel();
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  // Reset to initial tab when opening/switching issues
  useEffect(() => {
    if (!isOpen || !issue) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen, issue?.id]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!issue || !isOpen) {
    return null;
  }

  const status = statusConfig[issue.status] || statusConfig.open;
  const priority = priorityConfig[issue.priority] || priorityConfig.medium;

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-1/2 bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        style={{ minWidth: '400px', maxWidth: '800px' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{issue.id}</span>
              <Badge variant={status.variant} className="gap-1">
                <status.icon className="h-3 w-3" />
                {formatMessage({ id: status.label })}
              </Badge>
              <Badge variant={priority.variant}>
                {formatMessage({ id: priority.label })}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {issue.title}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0 hover:bg-secondary">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 bg-card">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.detail.tabs.overview' })}
              </TabsTrigger>
              <TabsTrigger value="solutions" className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.detail.tabs.solutions' })}
                {issue.solutions && issue.solutions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {issue.solutions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                <History className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.detail.tabs.history' })}
              </TabsTrigger>
              <TabsTrigger value="terminal" className="flex-1">
                <Terminal className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'issues.detail.tabs.terminal' })}
              </TabsTrigger>
              <TabsTrigger value="json" className="flex-1">
                <Hash className="h-4 w-4 mr-2" />
                JSON
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <div className="overflow-y-auto pr-2" style={{ height: 'calc(100vh - 200px)' }}>
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4 pb-6 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Context */}
                  {issue.context && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">
                        {formatMessage({ id: 'issues.detail.overview.context' })}
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {issue.context}
                      </p>
                    </div>
                  )}

                  {/* Labels */}
                  {issue.labels && issue.labels.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">
                        {formatMessage({ id: 'issues.detail.overview.labels' })}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {issue.labels.map((label, index) => (
                          <Badge key={index} variant="outline" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.detail.overview.createdAt' })}</p>
                      <p className="text-sm">{new Date(issue.createdAt).toLocaleString()}</p>
                    </div>
                    {issue.updatedAt && (
                      <div className="p-3 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{formatMessage({ id: 'issues.detail.overview.updatedAt' })}</p>
                        <p className="text-sm">{new Date(issue.updatedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Solutions Tab */}
              <TabsContent value="solutions" className="mt-4 pb-6 focus-visible:outline-none">
                {!issue.solutions || issue.solutions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">{formatMessage({ id: 'issues.detail.solutions.empty' })}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {issue.solutions.map((solution, index) => (
                      <div key={solution.id || index} className="p-4 bg-muted/50 rounded-md border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={solution.status === 'completed' ? 'success' : 'secondary'}>
                            {solution.status}
                          </Badge>
                          {solution.estimatedEffort && (
                            <span className="text-xs text-muted-foreground">
                              {solution.estimatedEffort}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium mb-1">{solution.description}</p>
                        {solution.approach && (
                          <p className="text-xs text-muted-foreground">{solution.approach}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Terminal Tab - Link to Terminal Panel */}
              <TabsContent value="terminal" className="mt-4 pb-6 focus-visible:outline-none">
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Terminal className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm mb-4">{formatMessage({ id: 'home.terminalPanel.openInPanel' })}</p>
                  <Button
                    onClick={() => {
                      openTerminal(issue.id);
                      onClose();
                    }}
                  >
                    <Terminal className="h-4 w-4 mr-2" />
                    {formatMessage({ id: 'home.terminalPanel.openInPanel' })}
                  </Button>
                </div>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-4 pb-6 focus-visible:outline-none">
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">{formatMessage({ id: 'issues.detail.history.empty' })}</p>
                </div>
              </TabsContent>

              {/* JSON Tab */}
              <TabsContent value="json" className="mt-4 pb-6 focus-visible:outline-none">
                <pre className="p-4 bg-muted rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(issue, null, 2)}
                </pre>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </>
  );
}

export default IssueDrawer;
