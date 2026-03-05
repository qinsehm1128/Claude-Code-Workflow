// ========================================
// DynamicPipeline Component
// ========================================
// Dynamic pipeline stage visualization with fallback to static TeamPipeline

import { useIntl } from 'react-intl';
import { CheckCircle2, Circle, Loader2, Ban, SkipForward } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { DynamicStage, DynamicStageStatus, PhaseInfo } from '@/types/team';

interface DynamicPipelineProps {
  stages: DynamicStage[];
  phaseInfo?: PhaseInfo | null;
}

const statusConfig: Record<DynamicStageStatus, { icon: typeof CheckCircle2; color: string; bg: string; animate?: boolean }> = {
  completed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30' },
  in_progress: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30', animate: true },
  pending: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  blocked: { icon: Ban, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' },
  skipped: { icon: SkipForward, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30' },
};

const LEGEND_STATUSES: DynamicStageStatus[] = ['completed', 'in_progress', 'pending', 'blocked', 'skipped'];

function StageNode({ stage }: { stage: DynamicStage }) {
  const { formatMessage } = useIntl();
  const config = statusConfig[stage.status];
  const Icon = config.icon;

  const statusKey = stage.status === 'in_progress' ? 'inProgress' : stage.status;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border-2 min-w-[90px] transition-all',
        config.bg
      )}
    >
      <Icon
        className={cn('w-5 h-5', config.color, config.animate && 'animate-spin')}
        style={config.animate ? { animationDuration: '2s' } : undefined}
      />
      <span className="text-xs font-medium">
        {stage.label}
      </span>
      <span className={cn('text-[10px]', config.color)}>
        {formatMessage({ id: `team.pipeline.${statusKey}` })}
      </span>
      {stage.role && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
          {stage.role}
        </span>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center px-1">
      <div className="w-6 h-0.5 bg-border" />
      <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-border" />
    </div>
  );
}

export function DynamicPipeline({ stages, phaseInfo }: DynamicPipelineProps) {
  const { formatMessage } = useIntl();

  // Fallback: empty state when no dynamic stages are available
  if (stages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-muted-foreground">
          {formatMessage({ id: 'team.pipeline.title' })}
        </h3>
        <p className="text-xs text-muted-foreground text-center py-8">
          {formatMessage({ id: 'team.pipeline.noStages' })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3 flex-1">
        <h3 className="text-sm font-medium text-muted-foreground">
          {formatMessage({ id: 'team.pipeline.title' })}
        </h3>

        {/* Phase header */}
        {phaseInfo && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              {formatMessage({ id: 'team.coordinates.phase' })}: {phaseInfo.currentPhase}
              {phaseInfo.totalPhases != null && `/${phaseInfo.totalPhases}`}
            </Badge>
            {phaseInfo.currentStep && (
              <Badge variant="secondary">
                {formatMessage({ id: 'team.coordinates.step' })}: {phaseInfo.currentStep}
              </Badge>
            )}
            {phaseInfo.gapIteration > 0 && (
              <Badge variant="outline">
                {formatMessage({ id: 'team.coordinates.gap' })}: {phaseInfo.gapIteration}
              </Badge>
            )}
          </div>
        )}

        {/* Desktop: horizontal layout */}
        <div className="hidden sm:flex items-center gap-0">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              {idx > 0 && <Arrow />}
              <StageNode stage={stage} />
            </div>
          ))}
        </div>

        {/* Mobile: vertical layout */}
        <div className="flex sm:hidden flex-col items-center gap-2">
          {stages.map((stage) => (
            <StageNode key={stage.id} stage={stage} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-auto pt-3 border-t border-border">
        {LEGEND_STATUSES.map((s) => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          const statusKey = s === 'in_progress' ? 'inProgress' : s;
          return (
            <span key={s} className="flex items-center gap-1">
              <Icon className={cn('w-3 h-3', cfg.color)} />
              {formatMessage({ id: `team.pipeline.${statusKey}` })}
            </span>
          );
        })}
      </div>
    </div>
  );
}
