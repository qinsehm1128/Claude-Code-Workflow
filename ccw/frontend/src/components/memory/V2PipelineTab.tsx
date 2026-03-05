// ========================================
// V2PipelineTab Component
// ========================================
// Memory V2 Pipeline management UI

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { formatDistanceToNow } from 'date-fns';
import {
  Zap,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Eye,
  Loader2,
  RefreshCw,
  FileText,
  Database,
  Activity,
  Copy,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { SessionPreviewPanel } from '@/components/memory/SessionPreviewPanel';
import 'highlight.js/styles/github-dark.css';
import {
  useExtractionStatus,
  useConsolidationStatus,
  useV2Jobs,
  useTriggerExtraction,
  useTriggerConsolidation,
} from '@/hooks/useMemoryV2';
import { cn } from '@/lib/utils';

// ========== Helper Functions ==========

/**
 * Format a timestamp to relative time string
 */
function formatRelativeTime(timestamp: number | string | undefined): string | null {
  if (!timestamp) return null;

  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

// ========== Status Badge ==========

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  idle: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: <Clock className="w-3 h-3" />, label: 'Idle' },
  running: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Running' },
  completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
  done: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: <CheckCircle className="w-3 h-3" />, label: 'Done' },
  error: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: <AlertCircle className="w-3 h-3" />, label: 'Error' },
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  return (
    <Badge className={cn('flex items-center gap-1', config.color)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ========== Extraction Card ==========

function ExtractionCard() {
  const intl = useIntl();
  const { data: status, isLoading, refetch } = useExtractionStatus();
  const trigger = useTriggerExtraction();
  const [maxSessions, setMaxSessions] = useState(10);
  const [showPreview, setShowPreview] = useState(false);

  const handleTrigger = () => {
    trigger.mutate(maxSessions);
  };

  // Check if any job is running
  const hasRunningJob = status?.jobs?.some(j => j.status === 'running');
  const lastRunText = formatRelativeTime(status?.lastRun);

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-medium flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Phase 1: {intl.formatMessage({ id: 'memory.v2.extraction.title', defaultMessage: 'Extraction' })}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {intl.formatMessage({ id: 'memory.v2.extraction.description', defaultMessage: 'Extract structured memories from CLI sessions' })}
            </p>
            {lastRunText && (
              <p className="text-xs text-muted-foreground mt-1">
                {intl.formatMessage({ id: 'memory.v2.extraction.lastRun', defaultMessage: 'Last run' })}: {lastRunText}
              </p>
            )}
          </div>
          {status && (
            <div className="text-right">
              <div className="text-2xl font-bold">{status.total_stage1}</div>
              <div className="text-xs text-muted-foreground">
                {intl.formatMessage({ id: 'memory.v2.extraction.extracted', defaultMessage: 'Extracted' })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="number"
            value={maxSessions}
            onChange={(e) => setMaxSessions(Math.max(1, parseInt(e.target.value) || 10))}
            className="w-20 px-2 py-1 text-sm border rounded bg-background"
            min={1}
            max={64}
          />
          <span className="text-sm text-muted-foreground">sessions max</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTrigger}
            disabled={trigger.isPending || hasRunningJob}
            size="sm"
          >
            {trigger.isPending || hasRunningJob ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {intl.formatMessage({ id: 'memory.v2.extraction.extracting', defaultMessage: 'Extracting...' })}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                {intl.formatMessage({ id: 'memory.v2.extraction.trigger', defaultMessage: 'Trigger Extraction' })}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
            title={intl.formatMessage({ id: 'memory.v2.preview.previewQueue', defaultMessage: 'Preview Queue' })}
          >
            <Eye className="w-4 h-4 mr-1" />
            {intl.formatMessage({ id: 'memory.v2.preview.previewQueue', defaultMessage: 'Preview Queue' })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {status?.jobs && status.jobs.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground mb-2">
              {intl.formatMessage({ id: 'memory.v2.extraction.recentJobs', defaultMessage: 'Recent Jobs' })}
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {status.jobs.slice(0, 5).map((job) => (
                <div key={job.job_key} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs truncate max-w-[150px]">{job.job_key}</span>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Preview Queue Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <SessionPreviewPanel
            onClose={() => setShowPreview(false)}
            onExtractComplete={() => {
              setShowPreview(false);
              refetch();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== Consolidation Card ==========

function ConsolidationCard() {
  const intl = useIntl();
  const { data: status, isLoading, refetch } = useConsolidationStatus();
  const trigger = useTriggerConsolidation();
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTrigger = () => {
    trigger.mutate();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(status?.memoryMdPreview || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isRunning = status?.status === 'running';
  const lastRunText = formatRelativeTime(status?.lastRun);

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-medium flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Phase 2: {intl.formatMessage({ id: 'memory.v2.consolidation.title', defaultMessage: 'Consolidation' })}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {intl.formatMessage({ id: 'memory.v2.consolidation.description', defaultMessage: 'Merge extracted results into MEMORY.md' })}
            </p>
            {lastRunText && (
              <p className="text-xs text-muted-foreground mt-1">
                {intl.formatMessage({ id: 'memory.v2.consolidation.lastRun', defaultMessage: 'Last run' })}: {lastRunText}
              </p>
            )}
          </div>
          {status && <StatusBadge status={status.status} />}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-lg font-bold">
              {status?.memoryMdAvailable ? '✅' : '❌'}
            </div>
            <div className="text-xs text-muted-foreground">MEMORY.md</div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-lg font-bold">{status?.inputCount ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Inputs</div>
          </div>
        </div>

        {status?.lastError && (
          <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-300">
            {status.lastError}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTrigger}
            disabled={trigger.isPending || isRunning}
            size="sm"
          >
            {trigger.isPending || isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {intl.formatMessage({ id: 'memory.v2.consolidation.consolidating', defaultMessage: 'Consolidating...' })}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                {intl.formatMessage({ id: 'memory.v2.consolidation.trigger', defaultMessage: 'Trigger Consolidation' })}
              </>
            )}
          </Button>

          {status?.memoryMdAvailable && (
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="w-4 h-4 mr-1" />
              {intl.formatMessage({ id: 'memory.v2.consolidation.preview', defaultMessage: 'Preview' })}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </Card>

      {/* MEMORY.md Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                MEMORY.md
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2"
                title={copied
                  ? intl.formatMessage({ id: 'memory.v2.consolidation.copySuccess', defaultMessage: 'Copied' })
                  : intl.formatMessage({ id: 'memory.actions.copy', defaultMessage: 'Copy' })
                }
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1 markdown-preview">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {status?.memoryMdPreview || intl.formatMessage({
                  id: 'memory.v2.consolidation.noContent',
                  defaultMessage: 'No content available'
                })}
              </ReactMarkdown>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== Jobs List ==========

interface V2Job {
  kind: string;
  job_key: string;
  status: 'pending' | 'running' | 'done' | 'error';
  last_error?: string;
  worker_id?: string;
  started_at?: number;
  finished_at?: number;
  retry_remaining?: number;
}

function JobsList() {
  const intl = useIntl();
  const [kindFilter, setKindFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<V2Job | null>(null);
  const [copiedError, setCopiedError] = useState(false);

  // Build filters object
  const filters = {
    ...(kindFilter && { kind: kindFilter }),
    ...(statusFilter && { status_filter: statusFilter }),
  };

  const { data, isLoading, refetch } = useV2Jobs(Object.keys(filters).length > 0 ? filters : undefined);

  // Format timestamp to readable string
  const formatTimestamp = (timestamp: number | undefined): string => {
    if (!timestamp) return '-';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return '-';
    }
  };

  // Copy error to clipboard
  const handleCopyError = async () => {
    if (selectedJob?.last_error) {
      try {
        await navigator.clipboard.writeText(selectedJob.last_error);
        setCopiedError(true);
        setTimeout(() => setCopiedError(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          {intl.formatMessage({ id: 'memory.v2.jobs.title', defaultMessage: 'Jobs' })}
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-2 py-1 text-sm border rounded bg-background"
          >
            <option value="">
              {intl.formatMessage({ id: 'memory.v2.jobs.allKinds', defaultMessage: 'All Kinds' })}
            </option>
            <option value="phase1_extraction">
              {intl.formatMessage({ id: 'memory.v2.jobs.extraction', defaultMessage: 'Extraction' })}
            </option>
            <option value="memory_consolidate_global">
              {intl.formatMessage({ id: 'memory.v2.jobs.consolidation', defaultMessage: 'Consolidation' })}
            </option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-sm border rounded bg-background"
          >
            <option value="">
              {intl.formatMessage({ id: 'memory.v2.jobs.statusFilter.all', defaultMessage: 'All Status' })}
            </option>
            <option value="pending">
              {intl.formatMessage({ id: 'memory.v2.jobs.statusFilter.pending', defaultMessage: 'Pending' })}
            </option>
            <option value="running">
              {intl.formatMessage({ id: 'memory.v2.jobs.statusFilter.running', defaultMessage: 'Running' })}
            </option>
            <option value="done">
              {intl.formatMessage({ id: 'memory.v2.jobs.statusFilter.done', defaultMessage: 'Done' })}
            </option>
            <option value="error">
              {intl.formatMessage({ id: 'memory.v2.jobs.statusFilter.error', defaultMessage: 'Error' })}
            </option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {data?.jobs && data.jobs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">
                  {intl.formatMessage({ id: 'memory.v2.jobs.kind', defaultMessage: 'Kind' })}
                </th>
                <th className="text-left p-2">
                  {intl.formatMessage({ id: 'memory.v2.jobs.key', defaultMessage: 'Key' })}
                </th>
                <th className="text-left p-2">
                  {intl.formatMessage({ id: 'memory.v2.jobs.status', defaultMessage: 'Status' })}
                </th>
                <th className="text-left p-2">
                  {intl.formatMessage({ id: 'memory.v2.jobs.error', defaultMessage: 'Error' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr
                  key={`${job.kind}-${job.job_key}`}
                  className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedJob(job)}
                >
                  <td className="p-2">
                    <Badge variant="outline" className="text-xs">
                      {job.kind === 'phase1_extraction' ? 'Extraction' :
                        job.kind === 'memory_consolidate_global' ? 'Consolidation' : job.kind}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-xs truncate max-w-[150px]">{job.job_key}</td>
                  <td className="p-2"><StatusBadge status={job.status} /></td>
                  <td className="p-2 text-red-500 text-xs truncate max-w-[200px]">{job.last_error || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8">
          {intl.formatMessage({ id: 'memory.v2.jobs.noJobs', defaultMessage: 'No jobs found' })}
        </div>
      )}

      {/* 按状态统计 */}
      {data?.byStatus && Object.keys(data.byStatus).length > 0 && (
        <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm flex-wrap">
          {Object.entries(data.byStatus).map(([status, count]) => (
            <span key={status} className="flex items-center gap-1">
              <StatusBadge status={status} />
              <span className="font-bold">{count}</span>
            </span>
          ))}
          <span className="text-muted-foreground ml-auto">
            Total: {data.total}
          </span>
        </div>
      )}

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {intl.formatMessage({ id: 'memory.v2.jobs.detail.title', defaultMessage: 'Job Details' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.kind', defaultMessage: 'Kind' })}
                </label>
                <p className="text-sm font-medium">
                  {selectedJob?.kind === 'phase1_extraction' ? 'Extraction' :
                    selectedJob?.kind === 'memory_consolidate_global' ? 'Consolidation' : selectedJob?.kind}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.status', defaultMessage: 'Status' })}
                </label>
                <div className="mt-1">
                  {selectedJob && <StatusBadge status={selectedJob.status} />}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.jobKey', defaultMessage: 'Job ID' })}
                </label>
                <p className="text-sm font-mono break-all">{selectedJob?.job_key}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.startedAt', defaultMessage: 'Started At' })}
                </label>
                <p className="text-sm">{formatTimestamp(selectedJob?.started_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.finishedAt', defaultMessage: 'Finished At' })}
                </label>
                <p className="text-sm">{formatTimestamp(selectedJob?.finished_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.workerId', defaultMessage: 'Worker ID' })}
                </label>
                <p className="text-sm font-mono truncate">{selectedJob?.worker_id || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.retryRemaining', defaultMessage: 'Retry Remaining' })}
                </label>
                <p className="text-sm">{selectedJob?.retry_remaining ?? '-'}</p>
              </div>
            </div>

            {/* Error Section */}
            {selectedJob?.last_error && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    {intl.formatMessage({ id: 'memory.v2.jobs.detail.error', defaultMessage: 'Error' })}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyError}
                    className="h-6 px-2"
                    title={copiedError
                      ? intl.formatMessage({ id: 'memory.actions.copySuccess', defaultMessage: 'Copied' })
                      : intl.formatMessage({ id: 'memory.actions.copy', defaultMessage: 'Copy' })
                    }
                  >
                    {copiedError ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap break-all">
                  {selectedJob.last_error}
                </pre>
              </div>
            )}

            {!selectedJob?.last_error && (
              <div>
                <label className="text-xs text-muted-foreground">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.error', defaultMessage: 'Error' })}
                </label>
                <p className="text-sm text-muted-foreground italic">
                  {intl.formatMessage({ id: 'memory.v2.jobs.detail.noError', defaultMessage: 'No error' })}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ========== Pipeline Status Banner ==========

function PipelineStatusBanner() {
  const intl = useIntl();
  const { data } = useV2Jobs();

  // Detect running and error jobs
  const jobs = data?.jobs || [];
  const runningJobs = jobs.filter(j => j.status === 'running');
  const errorJobs = jobs.filter(j => j.status === 'error');
  const hasRunningJobs = runningJobs.length > 0;
  const errorCount = errorJobs.length;
  const runningCount = runningJobs.length;

  if (hasRunningJobs) {
    return (
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-700 dark:text-blue-300">
          {intl.formatMessage(
            { id: 'memory.v2.statusBanner.running', defaultMessage: 'Pipeline Running - {count} job(s) in progress' },
            { count: runningCount }
          )}
        </span>
      </div>
    );
  }

  if (errorCount > 0) {
    return (
      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-500" />
        <span className="text-sm text-yellow-700 dark:text-yellow-300">
          {intl.formatMessage(
            { id: 'memory.v2.statusBanner.hasErrors', defaultMessage: 'Pipeline Idle - {count} job(s) failed' },
            { count: errorCount }
          )}
        </span>
      </div>
    );
  }

  return null;
}

// ========== Main Component ==========

export function V2PipelineTab() {
  return (
    <div className="space-y-4">
      <PipelineStatusBanner />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExtractionCard />
        <ConsolidationCard />
      </div>
      <JobsList />
    </div>
  );
}

export default V2PipelineTab;
