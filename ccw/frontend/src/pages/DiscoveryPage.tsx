// ========================================
// Issue Discovery Page
// ========================================
// Track discovery sessions and view findings from multiple perspectives

import { useIntl } from 'react-intl';
import { Radar, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useIssueDiscovery, useIssues } from '@/hooks/useIssues';
import { DiscoveryCard } from '@/components/issue/discovery/DiscoveryCard';
import { DiscoveryDetail } from '@/components/issue/discovery/DiscoveryDetail';

export function DiscoveryPage() {
  const { formatMessage } = useIntl();

  const {
    sessions,
    activeSession,
    findings,
    isLoadingSessions,
    isLoadingFindings,
    error,
    filters,
    setFilters,
    selectSession,
    exportFindings,
    exportSelectedFindings,
    isExporting,
  } = useIssueDiscovery({ refetchInterval: 3000 });

  // Fetch issues to find related ones when clicking findings
  const { issues } = useIssues({
    // Don't apply filters to get all issues for matching
    filter: undefined
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Radar className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {formatMessage({ id: 'issues.discovery.title' })}
          </h1>
        </div>
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'common.error' })}
          </h3>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <Radar className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {formatMessage({ id: 'issues.discovery.title' })}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {formatMessage({ id: 'issues.discovery.description' })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{sessions.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.discovery.totalSessions' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Badge variant="success" className="w-5 h-5 flex items-center justify-center p-0">
              {sessions.filter(s => s.status === 'completed').length}
            </Badge>
            <span className="text-2xl font-bold">{sessions.filter(s => s.status === 'completed').length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.discovery.completedSessions' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="w-5 h-5 flex items-center justify-center p-0">
              {sessions.filter(s => s.status === 'running').length}
            </Badge>
            <span className="text-2xl font-bold">{sessions.filter(s => s.status === 'running').length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.discovery.runningSessions' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              {sessions.reduce((sum, s) => sum + s.findings_count, 0)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'issues.discovery.totalFindings' })}
          </p>
        </Card>
      </div>

      {/* Main Content: Split Pane */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Session List */}
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-lg font-medium text-foreground">
            {formatMessage({ id: 'issues.discovery.sessionList' })}
          </h2>

          {isLoadingSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <Card className="p-8 text-center">
              <Radar className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {formatMessage({ id: 'issues.discovery.noSessions' })}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatMessage({ id: 'issues.discovery.noSessionsDescription' })}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <DiscoveryCard
                  key={session.id}
                  session={session}
                  isActive={activeSession?.id === session.id}
                  onClick={() => selectSession(session.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Findings Detail */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-medium text-foreground">
            {formatMessage({ id: 'issues.discovery.findingsDetail' })}
          </h2>

          {isLoadingFindings ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DiscoveryDetail
              sessionId={activeSession?.id || ''}
              session={activeSession}
              findings={findings}
              filters={filters}
              onFilterChange={setFilters}
              onExport={exportFindings}
              onExportSelected={exportSelectedFindings}
              isExporting={isExporting}
              issues={issues}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default DiscoveryPage;
