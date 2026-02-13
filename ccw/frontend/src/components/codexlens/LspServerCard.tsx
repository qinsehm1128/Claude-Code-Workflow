// ========================================
// CodexLens LSP Server Card
// ========================================
// Displays LSP server status, stats, and start/stop/restart controls

import { useIntl } from 'react-intl';
import {
  Server,
  Power,
  PowerOff,
  RotateCw,
  FolderOpen,
  Layers,
  Cpu,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCodexLensLspStatus, useCodexLensLspMutations } from '@/hooks';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

interface LspServerCardProps {
  disabled?: boolean;
}

export function LspServerCard({ disabled = false }: LspServerCardProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);
  const {
    available,
    semanticAvailable,
    projectCount,
    modes,
    isLoading,
  } = useCodexLensLspStatus();
  const { startLsp, stopLsp, restartLsp, isStarting, isStopping, isRestarting } = useCodexLensLspMutations();

  const isMutating = isStarting || isStopping || isRestarting;

  const handleToggle = async () => {
    if (available) {
      await stopLsp(projectPath);
    } else {
      await startLsp(projectPath);
    }
  };

  const handleRestart = async () => {
    await restartLsp(projectPath);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <span>{formatMessage({ id: 'codexlens.lsp.title' })}</span>
          </div>
          <Badge variant={available ? 'success' : 'secondary'}>
            {available
              ? formatMessage({ id: 'codexlens.lsp.status.running' })
              : formatMessage({ id: 'codexlens.lsp.status.stopped' })
            }
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <FolderOpen className={cn('w-4 h-4', available ? 'text-success' : 'text-muted-foreground')} />
            <div>
              <p className="text-muted-foreground text-xs">
                {formatMessage({ id: 'codexlens.lsp.projects' })}
              </p>
              <p className="font-semibold text-foreground">
                {available ? projectCount : '--'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Cpu className={cn('w-4 h-4', semanticAvailable ? 'text-info' : 'text-muted-foreground')} />
            <div>
              <p className="text-muted-foreground text-xs">
                {formatMessage({ id: 'codexlens.lsp.semanticAvailable' })}
              </p>
              <p className="font-semibold text-foreground">
                {semanticAvailable
                  ? formatMessage({ id: 'codexlens.lsp.available' })
                  : formatMessage({ id: 'codexlens.lsp.unavailable' })
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Layers className={cn('w-4 h-4', available && modes.length > 0 ? 'text-accent' : 'text-muted-foreground')} />
            <div>
              <p className="text-muted-foreground text-xs">
                {formatMessage({ id: 'codexlens.lsp.modes' })}
              </p>
              <p className="font-semibold text-foreground">
                {available ? modes.length : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant={available ? 'outline' : 'default'}
            size="sm"
            className="flex-1"
            onClick={handleToggle}
            disabled={disabled || isMutating || isLoading}
          >
            {available ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                {isStopping
                  ? formatMessage({ id: 'codexlens.lsp.stopping' })
                  : formatMessage({ id: 'codexlens.lsp.stop' })
                }
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                {isStarting
                  ? formatMessage({ id: 'codexlens.lsp.starting' })
                  : formatMessage({ id: 'codexlens.lsp.start' })
                }
              </>
            )}
          </Button>
          {available && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestart}
              disabled={disabled || isMutating || isLoading}
            >
              <RotateCw className={cn('w-4 h-4 mr-2', isRestarting && 'animate-spin')} />
              {isRestarting
                ? formatMessage({ id: 'codexlens.lsp.restarting' })
                : formatMessage({ id: 'codexlens.lsp.restart' })
              }
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default LspServerCard;
