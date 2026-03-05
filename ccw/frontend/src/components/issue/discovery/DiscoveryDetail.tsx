// ========================================
// Discovery Detail Component
// ========================================
// Displays findings detail panel with tabs and export functionality

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Download, FileText, BarChart3, Info, Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { IssueDrawer } from '@/components/issue/hub/IssueDrawer';
import { FindingDrawer } from './FindingDrawer';
import type { DiscoverySession, Finding } from '@/lib/api';
import type { Issue } from '@/lib/api';
import type { FindingFilters } from '@/hooks/useIssues';
import { FindingList } from './FindingList';

interface DiscoveryDetailProps {
  sessionId: string;
  session: DiscoverySession | null;
  findings: Finding[];
  filters: FindingFilters;
  onFilterChange: (filters: FindingFilters) => void;
  onExport: () => void;
  onExportSelected?: (findingIds: string[]) => Promise<{ success: boolean; message?: string; exported?: number }>;
  isExporting?: boolean;
  issues?: Issue[]; // Optional: pass issues to find related ones
}

export function DiscoveryDetail({
  sessionId: _sessionId,
  session,
  findings,
  filters,
  onFilterChange,
  onExport,
  onExportSelected,
  isExporting = false,
  issues = [],
}: DiscoveryDetailProps) {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState('findings');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleFindingClick = (finding: Finding) => {
    // If finding has an associated issue_id, find and show that issue
    if (finding.issue_id) {
      const relatedIssue = issues.find(i => i.id === finding.issue_id);
      if (relatedIssue) {
        setSelectedIssue(relatedIssue);
        return;
      }
    }
    // Otherwise, show the finding details in FindingDrawer
    setSelectedFinding(finding);
  };

  const handleCloseIssueDrawer = () => {
    setSelectedIssue(null);
  };

  const handleCloseFindingDrawer = () => {
    setSelectedFinding(null);
  };

  const handleExportSelected = async () => {
    if (onExportSelected && selectedIds.length > 0) {
      await onExportSelected(selectedIds);
      setSelectedIds([]); // Clear selection after export
    }
  };

  if (!session) {
    return (
      <Card className="p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.discovery.noSessionSelected' })}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'issues.discovery.selectSession' })}
        </p>
      </Card>
    );
  }

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  const typeCounts = findings.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{session.name}</h2>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'issues.discovery.sessionId' })}: {session.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && onExportSelected && (
            <Button
              variant="default"
              onClick={handleExportSelected}
              disabled={isExporting || selectedIds.length === 0}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isExporting
                ? formatMessage({ id: 'issues.discovery.exporting' })
                : formatMessage({ id: 'issues.discovery.exportSelected' }, { count: selectedIds.length })
              }
            </Button>
          )}
          <Button variant="outline" onClick={onExport} disabled={findings.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.export' })}
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <Badge
          variant={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'destructive' : 'warning'}
        >
          {formatMessage({ id: `issues.discovery.session.status.${session.status}` })}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatMessage({ id: 'issues.discovery.createdAt' })}: {formatDate(session.created_at)}
        </span>
        {session.completed_at && (
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'issues.discovery.completedAt' })}: {formatDate(session.completed_at)}
          </span>
        )}
      </div>

      {/* Progress Bar for Running Sessions */}
      {session.status === 'running' && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{formatMessage({ id: 'issues.discovery.progress' })}</span>
            <span className="font-medium">{session.progress}%</span>
          </div>
          <Progress value={session.progress} className="h-2" />
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="findings">
            <FileText className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.tabFindings' })} ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="progress">
            <BarChart3 className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.tabProgress' })}
          </TabsTrigger>
          <TabsTrigger value="info">
            <Info className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'issues.discovery.tabInfo' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="mt-4">
          <FindingList
            findings={findings}
            filters={filters}
            onFilterChange={onFilterChange}
            onFindingClick={handleFindingClick}
            selectedIds={selectedIds}
            onSelectionChange={onExportSelected ? setSelectedIds : undefined}
          />
        </TabsContent>

        <TabsContent value="progress" className="mt-4 space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-foreground mb-4">
              {formatMessage({ id: 'issues.discovery.severityBreakdown' })}
            </h3>
            <div className="space-y-3">
              {Object.entries(severityCounts).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <Badge
                    variant={severity === 'critical' || severity === 'high' ? 'destructive' : severity === 'medium' ? 'warning' : 'secondary'}
                  >
                    {formatMessage({ id: `issues.discovery.findings.severity.${severity}` })}
                  </Badge>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          {Object.keys(typeCounts).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-medium text-foreground mb-4">
                {formatMessage({ id: 'issues.discovery.typeBreakdown' })}
              </h3>
              <div className="space-y-3">
                {Object.entries(typeCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <Badge variant="outline">{type}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.sessionId' })}
              </h3>
              <p className="text-foreground font-mono text-sm">{session.id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.name' })}
              </h3>
              <p className="text-foreground">{session.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.status' })}
              </h3>
              <Badge
                variant={session.status === 'completed' ? 'success' : session.status === 'failed' ? 'destructive' : 'warning'}
              >
                {formatMessage({ id: `issues.discovery.session.status.${session.status}` })}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.progress' })}
              </h3>
              <p className="text-foreground">{session.progress}%</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.findingsCount' })}
              </h3>
              <p className="text-foreground">{session.findings_count}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {formatMessage({ id: 'issues.discovery.createdAt' })}
              </h3>
              <p className="text-foreground">{formatDate(session.created_at)}</p>
            </div>
            {session.completed_at && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {formatMessage({ id: 'issues.discovery.completedAt' })}
                </h3>
                <p className="text-foreground">{formatDate(session.completed_at)}</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Issue Detail Drawer */}
      <IssueDrawer
        issue={selectedIssue}
        isOpen={selectedIssue !== null}
        onClose={handleCloseIssueDrawer}
      />

      {/* Finding Detail Drawer */}
      <FindingDrawer
        finding={selectedFinding}
        isOpen={selectedFinding !== null}
        onClose={handleCloseFindingDrawer}
      />
    </div>
  );
}

export default DiscoveryDetail;
