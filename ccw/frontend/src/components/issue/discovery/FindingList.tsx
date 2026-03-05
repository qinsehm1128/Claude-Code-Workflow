// ========================================
// Finding List Component
// ========================================
// Displays findings with filters and severity badges

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Search, FileCode, AlertTriangle, ExternalLink, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import type { Finding } from '@/lib/api';
import type { FindingFilters } from '@/hooks/useIssues';

interface FindingListProps {
  findings: Finding[];
  filters: FindingFilters;
  onFilterChange: (filters: FindingFilters) => void;
  onFindingClick?: (finding: Finding) => void;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

const severityConfig: Record<string, { variant: 'destructive' | 'warning' | 'secondary' | 'outline' | 'success' | 'info' | 'default'; label: string }> = {
  critical: { variant: 'destructive', label: 'issues.discovery.findings.severity.critical' },
  high: { variant: 'destructive', label: 'issues.discovery.findings.severity.high' },
  medium: { variant: 'warning', label: 'issues.discovery.findings.severity.medium' },
  low: { variant: 'secondary', label: 'issues.discovery.findings.severity.low' },
};

function getSeverityConfig(severity: string) {
  return severityConfig[severity] || { variant: 'outline', label: 'issues.discovery.findings.severity.unknown' };
}

export function FindingList({
  findings,
  filters,
  onFilterChange,
  onFindingClick,
  selectedIds = [],
  onSelectionChange,
}: FindingListProps) {
  const { formatMessage } = useIntl();
  const [internalSelection, setInternalSelection] = useState<Set<string>>(new Set());

  // Use external selection if provided, otherwise use internal state
  const selectionSet = onSelectionChange
    ? new Set(selectedIds)
    : internalSelection;

  const handleToggleSelection = (findingId: string) => {
    const newSet = new Set(selectionSet);
    if (newSet.has(findingId)) {
      newSet.delete(findingId);
    } else {
      newSet.add(findingId);
    }
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSet));
    } else {
      setInternalSelection(newSet);
    }
  };

  const handleToggleAll = () => {
    const allSelected = selectionSet.size === findings.length && findings.length > 0;
    const newSet = allSelected ? new Set<string>() : new Set(findings.map(f => f.id));
    if (onSelectionChange) {
      onSelectionChange(Array.from(newSet));
    } else {
      setInternalSelection(newSet);
    }
  };

  const isAllSelected = findings.length > 0 && selectionSet.size === findings.length;
  const isSomeSelected = selectionSet.size > 0 && selectionSet.size < findings.length;

  // Extract unique types for filter
  const uniqueTypes = Array.from(new Set(findings.map(f => f.type))).sort();

  if (findings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.discovery.findings.noFindings' })}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'issues.discovery.findings.noFindingsDescription' })}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'issues.discovery.findings.searchPlaceholder' })}
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value || undefined })}
            className="pl-9"
          />
        </div>
        <Select
          value={filters.severity || 'all'}
          onValueChange={(v) => onFilterChange({ ...filters, severity: v === 'all' ? undefined : v as Finding['severity'] })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={formatMessage({ id: 'issues.discovery.findings.filterBySeverity' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'issues.discovery.findings.severity.all' })}</SelectItem>
            <SelectItem value="critical">{formatMessage({ id: 'issues.discovery.findings.severity.critical' })}</SelectItem>
            <SelectItem value="high">{formatMessage({ id: 'issues.discovery.findings.severity.high' })}</SelectItem>
            <SelectItem value="medium">{formatMessage({ id: 'issues.discovery.findings.severity.medium' })}</SelectItem>
            <SelectItem value="low">{formatMessage({ id: 'issues.discovery.findings.severity.low' })}</SelectItem>
          </SelectContent>
        </Select>
        {uniqueTypes.length > 0 && (
          <Select
            value={filters.type || 'all'}
            onValueChange={(v) => onFilterChange({ ...filters, type: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'issues.discovery.findings.filterByType' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'issues.discovery.findings.type.all' })}</SelectItem>
              {uniqueTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={filters.exported === undefined ? 'all' : filters.exported ? 'exported' : 'notExported'}
          onValueChange={(v) => {
            if (v === 'all') {
              onFilterChange({ ...filters, exported: undefined });
            } else if (v === 'exported') {
              onFilterChange({ ...filters, exported: true });
            } else {
              onFilterChange({ ...filters, exported: false });
            }
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={formatMessage({ id: 'issues.discovery.findings.filterByExported' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'issues.discovery.findings.exportedStatus.all' })}</SelectItem>
            <SelectItem value="exported">{formatMessage({ id: 'issues.discovery.findings.exportedStatus.exported' })}</SelectItem>
            <SelectItem value="notExported">{formatMessage({ id: 'issues.discovery.findings.exportedStatus.notExported' })}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.hasIssue === undefined ? 'all' : filters.hasIssue ? 'hasIssue' : 'noIssue'}
          onValueChange={(v) => {
            if (v === 'all') {
              onFilterChange({ ...filters, hasIssue: undefined });
            } else if (v === 'hasIssue') {
              onFilterChange({ ...filters, hasIssue: true });
            } else {
              onFilterChange({ ...filters, hasIssue: false });
            }
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={formatMessage({ id: 'issues.discovery.findings.filterByIssue' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'issues.discovery.findings.issueStatus.all' })}</SelectItem>
            <SelectItem value="hasIssue">{formatMessage({ id: 'issues.discovery.findings.issueStatus.hasIssue' })}</SelectItem>
            <SelectItem value="noIssue">{formatMessage({ id: 'issues.discovery.findings.issueStatus.noIssue' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Select All */}
      {onSelectionChange && (
        <button
          onClick={handleToggleAll}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className="w-4 h-4 border rounded flex items-center justify-center">
            {isAllSelected ? (
              <Check className="w-3 h-3" />
            ) : isSomeSelected ? (
              <div className="w-2 h-2 bg-foreground rounded-sm" />
            ) : null}
          </div>
          {isAllSelected
            ? formatMessage({ id: 'issues.discovery.findings.deselectAll' })
            : formatMessage({ id: 'issues.discovery.findings.selectAll' })}
        </button>
      )}

      {/* Findings List */}
      <div className="space-y-3">
        {findings.map((finding) => {
          const config = getSeverityConfig(finding.severity);
          const isSelected = selectionSet.has(finding.id);
          return (
            <Card
              key={finding.id}
              className={cn(
                "p-4 transition-colors",
                onFindingClick && "cursor-pointer hover:bg-muted/50"
              )}
              onClick={(e) => {
                // Don't trigger finding click when clicking checkbox
                if ((e.target as HTMLElement).closest('.selection-checkbox')) return;
                onFindingClick?.(finding);
              }}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                {onSelectionChange && (
                  <div
                    className="selection-checkbox flex-shrink-0 mt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelection(finding.id);
                    }}
                  >
                    <div className={cn(
                      "w-4 h-4 border rounded flex items-center justify-center cursor-pointer transition-colors",
                      isSelected ? "bg-primary border-primary" : "border-border hover:border-primary"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={config.variant}>
                        {formatMessage({ id: config.label })}
                      </Badge>
                      {finding.type && (
                        <Badge variant="outline" className="text-xs">
                          {finding.type}
                        </Badge>
                      )}
                      {finding.exported && (
                        <Badge variant="success" className="text-xs gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {formatMessage({ id: 'issues.discovery.findings.exported' })}
                        </Badge>
                      )}
                      {finding.issue_id && (
                        <Badge variant="info" className="text-xs">
                          {formatMessage({ id: 'issues.discovery.findings.hasIssue' })}: {finding.issue_id}
                        </Badge>
                      )}
                    </div>
                    {finding.file && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileCode className="w-3 h-3" />
                        <span>{finding.file}</span>
                        {finding.line && <span>:{finding.line}</span>}
                      </div>
                    )}
                  </div>
                  <h4 className="font-medium text-foreground mb-1">{finding.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
                  {finding.code_snippet && (
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                      <code>{finding.code_snippet}</code>
                    </pre>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Count */}
      <div className="text-center text-sm text-muted-foreground">
        {formatMessage({ id: 'issues.discovery.findings.showingCount' }, { count: findings.length })}
      </div>
    </div>
  );
}

export default FindingList;
