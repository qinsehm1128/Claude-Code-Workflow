// ========================================
// ReviewSessionPage Component
// ========================================
// Review session detail page with findings display, multi-select, dimension tabs, and fix progress carousel

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  FileText,
  Download,
  ChevronRight,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { useReviewSession } from '@/hooks/useReviewSession';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortField = 'severity' | 'dimension' | 'file';
type SortOrder = 'asc' | 'desc';

interface FindingWithSelection {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  dimension: string;
  category?: string;
  file?: string;
  line?: string;
  code_context?: string;
  recommendations?: string[];
  root_cause?: string;
  impact?: string;
}

// Fix Progress Types
interface FixStage {
  stage: number;
  status: 'completed' | 'in-progress' | 'pending';
  groups: string[];
}

interface FixProgressData {
  fix_session_id: string;
  phase: 'planning' | 'execution' | 'completion';
  total_findings: number;
  fixed_count: number;
  failed_count: number;
  in_progress_count: number;
  pending_count: number;
  percent_complete: number;
  current_stage: number;
  total_stages: number;
  stages: FixStage[];
  active_agents: Array<{
    agent_id: string;
    group_id: string;
    current_finding: { finding_title: string } | null;
  }>;
}

/**
 * Fix Progress Carousel Component
 * Displays fix progress with polling and carousel navigation
 */
function FixProgressCarousel({ sessionId }: { sessionId: string }) {
  const { formatMessage } = useIntl();
  const [fixProgressData, setFixProgressData] = React.useState<FixProgressData | null>(null);
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch fix progress data
  const fetchFixProgress = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/fix-progress?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        if (response.status === 404) {
          setFixProgressData(null);
        }
        return;
      }
      const data = await response.json();
      setFixProgressData(data);
    } catch (err) {
      console.error('Failed to fetch fix progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Poll for fix progress updates
  React.useEffect(() => {
    fetchFixProgress();

    // Stop polling if phase is completion
    if (fixProgressData?.phase === 'completion') {
      return;
    }

    const interval = setInterval(() => {
      fetchFixProgress();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchFixProgress, fixProgressData?.phase]);

  // Navigate carousel
  const navigateSlide = (direction: 'prev' | 'next' | number) => {
    if (!fixProgressData) return;

    const totalSlides = fixProgressData.active_agents.length > 0 ? 3 : 2;
    if (typeof direction === 'number') {
      setCurrentSlide(direction);
    } else if (direction === 'next') {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    } else if (direction === 'prev') {
      setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    }
  };

  if (isLoading && !fixProgressData) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!fixProgressData) {
    return null;
  }

  const { phase, total_findings, fixed_count, failed_count, in_progress_count, pending_count, percent_complete, current_stage, total_stages, stages, active_agents } = fixProgressData;

  const phaseIcon = phase === 'planning' ? '📝' : phase === 'execution' ? '⚡' : '✅';
  const totalSlides = active_agents.length > 0 ? 3 : 2;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔧</span>
            <span className="font-semibold text-sm">{formatMessage({ id: 'reviewSession.fixProgress.title' })}</span>
          </div>
          {/* Stage Dots */}
          <div className="flex gap-1">
            {stages.map((stage, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  stage.status === 'completed' ? 'bg-green-500' :
                  stage.status === 'in-progress' ? 'bg-blue-500' :
                  'bg-gray-300 dark:bg-gray-600'
                }`}
                title={`Stage ${i + 1}: ${stage.status}`}
              />
            ))}
          </div>
        </div>

        {/* Carousel */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* Slide 1: Overview */}
            <div className="w-full flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <Badge variant={phase === 'planning' ? 'secondary' : phase === 'execution' ? 'default' : 'success'}>
                  {phaseIcon} {formatMessage({ id: `reviewSession.fixProgress.phase.${phase}` })}
                </Badge>
                <span className="text-xs text-muted-foreground">{fixProgressData.fix_session_id}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percent_complete}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {formatMessage({ id: 'reviewSession.fixProgress.complete' }, { percent: percent_complete.toFixed(0) })} · {formatMessage({ id: 'reviewSession.fixProgress.stage' })} {current_stage}/{total_stages}
              </div>
            </div>

            {/* Slide 2: Stats */}
            <div className="w-full flex-shrink-0">
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 bg-muted rounded">
                  <div className="text-lg font-bold">{total_findings}</div>
                  <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.fixProgress.stats.total' })}</div>
                </div>
                <div className="text-center p-2 bg-green-100 dark:bg-green-900/20 rounded">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{fixed_count}</div>
                  <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.fixProgress.stats.fixed' })}</div>
                </div>
                <div className="text-center p-2 bg-red-100 dark:bg-red-900/20 rounded">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">{failed_count}</div>
                  <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.fixProgress.stats.failed' })}</div>
                </div>
                <div className="text-center p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{pending_count + in_progress_count}</div>
                  <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.fixProgress.stats.pending' })}</div>
                </div>
              </div>
            </div>

            {/* Slide 3: Active Agents (if any) */}
            {active_agents.length > 0 && (
              <div className="w-full flex-shrink-0">
                <div className="text-sm font-semibold mb-2">
                  {active_agents.length} {active_agents.length === 1 ? formatMessage({ id: 'reviewSession.fixProgress.activeAgents' }) : formatMessage({ id: 'reviewSession.fixProgress.activeAgentsPlural' })}
                </div>
                <div className="space-y-2">
                  {active_agents.slice(0, 2).map((agent, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <span>🤖</span>
                      <span className="text-sm">{agent.current_finding?.finding_title || formatMessage({ id: 'reviewSession.fixProgress.working' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Carousel Navigation */}
        {totalSlides > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateSlide('prev')}>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentSlide === i ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  onClick={() => navigateSlide(i)}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateSlide('next')}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ReviewSessionPage component - Display review session findings
 */
export function ReviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const {
    reviewSession,
    flattenedFindings,
    severityCounts,
    isLoading,
    error,
    refetch,
  } = useReviewSession(sessionId);

  const [severityFilter, setSeverityFilter] = React.useState<Set<SeverityFilter>>(
    new Set(['critical', 'high', 'medium', 'low'])
  );
  const [dimensionFilter, setDimensionFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortField, setSortField] = React.useState<SortField>('severity');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');
  const [selectedFindings, setSelectedFindings] = React.useState<Set<string>>(new Set());
  const [selectedFindingId, setSelectedFindingId] = React.useState<string | null>(null);

  const handleBack = () => {
    navigate('/sessions');
  };

  const toggleSeverity = (severity: SeverityFilter) => {
    setSeverityFilter(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSeverityFilter(new Set(['critical', 'high', 'medium', 'low']));
    setDimensionFilter('all');
    setSearchQuery('');
  };

  const toggleSelectFinding = (findingId: string) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) {
        next.delete(findingId);
      } else {
        next.add(findingId);
      }
      return next;
    });
  };

  const selectAllFindings = () => {
    const validIds = filteredFindings.map(f => f.id).filter((id): id is string => id !== undefined);
    setSelectedFindings(new Set(validIds));
  };

  const selectVisibleFindings = () => {
    const validIds = filteredFindings.map(f => f.id).filter((id): id is string => id !== undefined);
    setSelectedFindings(new Set(validIds));
  };

  const selectBySeverity = (severity: FindingWithSelection['severity']) => {
    const severityIds = flattenedFindings
      .filter(f => f.severity === severity && f.id !== undefined)
      .map(f => f.id!);
    setSelectedFindings(prev => {
      const next = new Set(prev);
      severityIds.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedFindings(new Set());
  };

  const handleFindingClick = (findingId: string) => {
    setSelectedFindingId(findingId);
  };

  const exportSelectedAsJson = () => {
    const selected = flattenedFindings.filter(f => f.id !== undefined && selectedFindings.has(f.id));
    if (selected.length === 0) return;

    const exportData = {
      session_id: sessionId,
      findings: selected.map(f => ({
        id: f.id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        dimension: f.dimension,
        file: f.file,
        line: f.line,
        recommendations: f.recommendations,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `review-${sessionId}-fix.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Severity order for sorting
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

  // Calculate dimension counts
  const dimensionCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: flattenedFindings.length };
    flattenedFindings.forEach(f => {
      counts[f.dimension] = (counts[f.dimension] || 0) + 1;
    });
    return counts;
  }, [flattenedFindings]);

  // Filter and sort findings
  const filteredFindings = React.useMemo(() => {
    let filtered = flattenedFindings;

    // Apply dimension filter
    if (dimensionFilter !== 'all') {
      filtered = filtered.filter(f => f.dimension === dimensionFilter);
    }

    // Apply severity filter
    if (severityFilter.size > 0) {
      filtered = filtered.filter(f => severityFilter.has(f.severity));
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.title.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query) ||
        f.file?.toLowerCase().includes(query) ||
        f.dimension.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'severity':
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'dimension':
          comparison = a.dimension.localeCompare(b.dimension);
          break;
        case 'file':
          comparison = (a.file || '').localeCompare(b.file || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [flattenedFindings, severityFilter, dimensionFilter, searchQuery, sortField, sortOrder]);

  // Get severity badge props
  const getSeverityBadge = (severity: FindingWithSelection['severity']) => {
    switch (severity) {
      case 'critical':
        return { variant: 'destructive' as const, icon: XCircle, label: formatMessage({ id: 'reviewSession.severity.critical' }) };
      case 'high':
        return { variant: 'warning' as const, icon: AlertTriangle, label: formatMessage({ id: 'reviewSession.severity.high' }) };
      case 'medium':
        return { variant: 'info' as const, icon: Info, label: formatMessage({ id: 'reviewSession.severity.medium' }) };
      case 'low':
        return { variant: 'secondary' as const, icon: CheckCircle, label: formatMessage({ id: 'reviewSession.severity.low' }) };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
          <p className="text-xs mt-0.5">{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {formatMessage({ id: 'common.actions.retry' })}
        </Button>
      </div>
    );
  }

  // Session not found
  if (!reviewSession) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'reviewSession.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'reviewSession.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.actions.back' })}
        </Button>
      </div>
    );
  }

  const dimensions = reviewSession.reviewDimensions || [];
  const totalFindings = flattenedFindings.length;

  // Determine session status (ACTIVE or ARCHIVED)
  const isActive = reviewSession._isActive !== false;
  const sessionStatus = isActive ? 'ACTIVE' : 'ARCHIVED';
  const phase = reviewSession.phase || 'in-progress';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              🔍 {reviewSession.session_id}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="review">Review</Badge>
              <Badge variant={isActive ? "success" : "secondary"} className="text-xs">
                {sessionStatus}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Review Progress Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Review Progress Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="font-semibold">{formatMessage({ id: 'reviewSession.progress.title' })}</span>
            </div>
            <Badge variant="secondary">{phase.toUpperCase()}</Badge>
          </div>

          {/* Summary Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-lg font-bold">{totalFindings}</div>
                <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.progress.totalFindings' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <span className="text-2xl">🔴</span>
              <div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">{severityCounts.critical}</div>
                <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.progress.critical' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <span className="text-2xl">🟠</span>
              <div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{severityCounts.high}</div>
                <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.progress.high' })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <span className="text-2xl">🎯</span>
              <div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{dimensions.length}</div>
                <div className="text-xs text-muted-foreground">{formatMessage({ id: 'reviewSession.stats.dimensions' })}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fix Progress Carousel */}
      {sessionId && <FixProgressCarousel sessionId={sessionId} />}

      {/* Unified Filter Card with Dimension Tabs */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Top Bar: Search + Sort + Reset */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={formatMessage({ id: 'reviewSession.search.placeholder' })}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
              className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="severity">{formatMessage({ id: 'reviewSession.sort.severity' })}</option>
              <option value="dimension">{formatMessage({ id: 'reviewSession.sort.dimension' })}</option>
              <option value="file">{formatMessage({ id: 'reviewSession.sort.file' })}</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-9 p-0"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground hover:text-foreground">
              ✕ {formatMessage({ id: 'reviewSession.filters.reset' })}
            </Button>
          </div>

          {/* Middle Row: Dimension Tabs + Severity Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Dimension Tabs - Horizontal Scrollable */}
            <div className="flex-1">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {formatMessage({ id: 'reviewSession.filters.dimension' })}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    dimensionFilter === 'all'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setDimensionFilter('all')}
                >
                  All ({dimensionCounts.all || 0})
                </button>
                {dimensions.map(dim => (
                  <button
                    key={dim.name}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      dimensionFilter === dim.name
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                    onClick={() => setDimensionFilter(dim.name)}
                  >
                    {dim.name} ({dim.findings?.length || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filters - Compact Pills */}
            <div className="sm:w-auto">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {formatMessage({ id: 'reviewSession.filters.severity' })}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
                  const isEnabled = severityFilter.has(severity);
                  const colors = {
                    critical: isEnabled ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
                    high: isEnabled ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
                    medium: isEnabled ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                    low: isEnabled ? 'bg-gray-500 text-white border-gray-500' : 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
                  };
                  return (
                    <label
                      key={severity}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                        colors[severity]
                      } ${isEnabled ? 'shadow-sm' : 'hover:opacity-80'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSeverity(severity)}
                        className="sr-only"
                      />
                      <span>{formatMessage({ id: `reviewSession.severity.short.${severity}` })}</span>
                      <span className="opacity-70">({flattenedFindings.filter(f => f.severity === severity).length})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Selection Actions + Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                {selectedFindings.size > 0
                  ? formatMessage({ id: 'reviewSession.selection.countSelected' }, { count: selectedFindings.size })
                  : formatMessage({ id: 'reviewSession.selection.total' }, { count: filteredFindings.length })
                }
              </span>
              {selectedFindings.size > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={clearSelection} className="h-8 text-xs">
                    {formatMessage({ id: 'reviewSession.selection.clear' })}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectBySeverity('critical')} className="h-8 text-xs">
                    🔥 {formatMessage({ id: 'reviewSession.selection.selectCritical' })}
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectVisibleFindings} className="h-8 text-xs">
                    {formatMessage({ id: 'reviewSession.selection.selectVisible' })}
                  </Button>
                </>
              )}
              {selectedFindings.size === 0 && (
                <Button variant="outline" size="sm" onClick={selectAllFindings} className="h-8 text-xs">
                  {formatMessage({ id: 'reviewSession.selection.selectAll' })}
                </Button>
              )}
            </div>
            <Button
              variant={selectedFindings.size > 0 ? 'default' : 'outline'}
              size="sm"
              onClick={exportSelectedAsJson}
              disabled={selectedFindings.size === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              🔧 {formatMessage({ id: 'reviewSession.export' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Split Panel: Findings List + Preview */}
      {filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {formatMessage({ id: 'reviewSession.empty.title' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'reviewSession.empty.message' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] gap-4">
          {/* Left Panel: Findings List */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">
                  {formatMessage({ id: 'reviewSession.findingsList.count' }, { count: filteredFindings.length })}
                </span>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredFindings.filter(f => f.id !== undefined).map(finding => {
                  const findingId = finding.id!;
                  const isSelected = selectedFindings.has(findingId);
                  const isPreviewing = selectedFindingId === findingId;
                  const badge = getSeverityBadge(finding.severity);
                  const BadgeIcon = badge.icon;

                  return (
                    <div
                      key={findingId}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isPreviewing
                          ? 'bg-primary/10 border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                      onClick={() => handleFindingClick(findingId)}
                    >
                      <div className="flex items-start gap-2">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectFinding(findingId);
                          }}
                          className="mt-0.5 flex-shrink-0"
                        />

                        {/* Compact Finding Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <Badge variant={badge.variant} className="gap-1 text-xs">
                              <BadgeIcon className="h-2.5 w-2.5" />
                              {badge.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {finding.dimension}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">
                            {finding.title}
                          </p>
                          {finding.file && (
                            <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                              {finding.file}:{finding.line || '?'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Panel: Enhanced Preview */}
          <Card className="sticky top-4 self-start">
            <CardContent className="p-0 h-full min-h-[500px]">
              {!selectedFindingId ? (
                // Enhanced Empty State
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center bg-gradient-to-br from-muted/30 to-muted/10">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {formatMessage({ id: 'reviewSession.preview.emptyTitle' })}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-[250px]">
                    {formatMessage({ id: 'reviewSession.preview.empty' })}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-lg border text-xs">
                      <span className="w-2 h-2 rounded-full bg-destructive"></span>
                      {formatMessage({ id: 'reviewSession.preview.emptyTipSeverity' })}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-lg border text-xs">
                      <span>📁</span>
                      {formatMessage({ id: 'reviewSession.preview.emptyTipFile' })}
                    </div>
                  </div>
                </div>
              ) : (
                // Preview Content
                (() => {
                  const finding = flattenedFindings.find(f => f.id === selectedFindingId);
                  if (!finding) return null;

                  const badge = getSeverityBadge(finding.severity);
                  const BadgeIcon = badge.icon;
                  const isSelected = selectedFindings.has(selectedFindingId);

                  // Find adjacent findings for navigation
                  const findingIndex = filteredFindings.findIndex(f => f.id === selectedFindingId);
                  const prevFinding = findingIndex > 0 ? filteredFindings[findingIndex - 1] : null;
                  const nextFinding = findingIndex < filteredFindings.length - 1 ? filteredFindings[findingIndex + 1] : null;

                  return (
                    <div className="flex flex-col h-full">
                      {/* Sticky Header */}
                      <div className="sticky top-0 z-10 bg-background border-b border-border p-4 space-y-3">
                        {/* Navigation + Badges Row */}
                        <div className="flex items-center justify-between gap-2">
                          {/* Navigation Buttons */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => prevFinding && handleFindingClick(prevFinding.id!)}
                              disabled={!prevFinding}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronRight className="h-4 w-4 rotate-180" />
                            </Button>
                            <span className="text-xs text-muted-foreground px-2">
                              {findingIndex + 1} / {filteredFindings.length}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => nextFinding && handleFindingClick(nextFinding.id!)}
                              disabled={!nextFinding}
                              className="h-8 w-8 p-0"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={badge.variant} className="gap-1 text-xs">
                              <BadgeIcon className="h-3 w-3" />
                              {badge.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {finding.dimension}
                            </Badge>
                          </div>

                          {/* Select Button */}
                          <Button
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectFinding(selectedFindingId);
                            }}
                            className="h-8 text-xs"
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                {formatMessage({ id: 'reviewSession.preview.selected' })}
                              </>
                            ) : (
                              <>
                                <span className="mr-1">⊕</span>
                                {formatMessage({ id: 'reviewSession.preview.selectForFix' })}
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-foreground line-clamp-2">
                          {finding.title}
                        </h3>

                        {/* Quick Info Bar */}
                        <div className="flex items-center gap-3 text-xs">
                          {finding.file && (
                            <div className="flex items-center gap-1 text-muted-foreground flex-1 min-w-0">
                              <span className="flex-shrink-0">📁</span>
                              <code className="truncate">{finding.file}:{finding.line || '?'}</code>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Scrollable Content */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Description */}
                        {finding.description && (
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                              <span>📝</span>
                              {formatMessage({ id: 'reviewSession.preview.description' })}
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">
                              {finding.description}
                            </p>
                          </div>
                        )}

                        {/* Code Context */}
                        {finding.code_context && (
                          <div>
                            <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                              <span>💻</span>
                              {formatMessage({ id: 'reviewSession.preview.codeContext' })}
                            </div>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto border border-border">
                              <code className="text-foreground">{finding.code_context}</code>
                            </pre>
                          </div>
                        )}

                        {/* Root Cause */}
                        {finding.root_cause && (
                          <div>
                            <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                              <span>🎯</span>
                              {formatMessage({ id: 'reviewSession.preview.rootCause' })}
                            </div>
                            <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">
                              {finding.root_cause}
                            </p>
                          </div>
                        )}

                        {/* Impact */}
                        {finding.impact && (
                          <div>
                            <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                              <span>⚠️</span>
                              {formatMessage({ id: 'reviewSession.preview.impact' })}
                            </div>
                            <p className="text-sm text-foreground bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 leading-relaxed border border-orange-200 dark:border-orange-800">
                              {finding.impact}
                            </p>
                          </div>
                        )}

                        {/* Recommendations */}
                        {finding.recommendations && finding.recommendations.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                              <span>✅</span>
                              {formatMessage({ id: 'reviewSession.preview.recommendations' })}
                            </div>
                            <ul className="space-y-2">
                              {finding.recommendations.map((rec, idx) => (
                                <li key={idx} className="text-sm text-foreground flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                                  <span className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5">✓</span>
                                  <span className="leading-relaxed">{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ReviewSessionPage;
