// ========================================
// CodexLens Overview Tab
// ========================================
// Overview status display and quick actions for CodexLens

import { useIntl } from 'react-intl';
import {
  Database,
  FileText,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { CodexLensVenvStatus, CodexLensConfig } from '@/lib/api';
import { IndexOperations } from './IndexOperations';
import { FileWatcherCard } from './FileWatcherCard';
import { LspServerCard } from './LspServerCard';

interface OverviewTabProps {
  installed: boolean;
  status?: CodexLensVenvStatus;
  config?: CodexLensConfig;
  isLoading: boolean;
  onRefresh?: () => void;
}

export function OverviewTab({ installed, status, config, isLoading, onRefresh }: OverviewTabProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!installed) {
    return (
      <Card className="p-8 text-center">
        <Database className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'codexlens.overview.notInstalled.title' })}
        </h3>
        <p className="text-muted-foreground">
          {formatMessage({ id: 'codexlens.overview.notInstalled.message' })}
        </p>
      </Card>
    );
  }

  const isReady = status?.ready ?? false;
  const version = status?.version ?? 'Unknown';
  const indexDir = config?.index_dir ?? '~/.codexlens/indexes';
  const indexCount = config?.index_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Installation Status */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isReady ? 'bg-success/10' : 'bg-warning/10'
            )}>
              {isReady ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-warning" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.installation' })}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {isReady
                  ? formatMessage({ id: 'codexlens.overview.status.ready' })
                  : formatMessage({ id: 'codexlens.overview.status.notReady' })
                }
              </p>
            </div>
          </div>
        </Card>

        {/* Version */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.version' })}
              </p>
              <p className="text-lg font-semibold text-foreground">{version}</p>
            </div>
          </div>
        </Card>

        {/* Index Path */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <FileText className="w-5 h-5 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.indexPath' })}
              </p>
              <p className="text-sm font-semibold text-foreground truncate" title={indexDir}>
                {indexDir}
              </p>
            </div>
          </div>
        </Card>

        {/* Index Count */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.indexCount' })}
              </p>
              <p className="text-lg font-semibold text-foreground">{indexCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Service Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileWatcherCard disabled={!isReady} />
        <LspServerCard disabled={!isReady} />
      </div>

      {/* Index Operations */}
      <IndexOperations disabled={!isReady} onRefresh={onRefresh} />

      {/* Venv Details */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {formatMessage({ id: 'codexlens.overview.venv.title' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'codexlens.overview.venv.pythonVersion' })}
                </span>
                <span className="text-foreground font-mono">{status.pythonVersion || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'codexlens.overview.venv.venvPath' })}
                </span>
                <span className="text-foreground font-mono truncate ml-4" title={status.venvPath}>
                  {status.venvPath || 'Unknown'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
