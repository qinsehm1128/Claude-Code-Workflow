// ========================================
// TeamPipeline Component
// ========================================
// CSS-based pipeline stage visualization: PLAN → IMPL → TEST + REVIEW

import { useIntl } from 'react-intl';
import { CheckCircle2, Circle, Loader2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamMessage, PipelineStage, PipelineStageStatus } from '@/types/team';

interface TeamPipelineProps {
  messages: TeamMessage[];
}

const STAGES: PipelineStage[] = ['plan', 'impl', 'test', 'review'];

/** Derive pipeline stage status from message history */
function derivePipelineStatus(messages: TeamMessage[]): Record<PipelineStage, PipelineStageStatus> {
  const status: Record<PipelineStage, PipelineStageStatus> = {
    plan: 'pending',
    impl: 'pending',
    test: 'pending',
    review: 'pending',
  };

  for (const msg of messages) {
    const t = msg.type;
    // Plan stage
    if (t === 'plan_ready') status.plan = 'in_progress';
    if (t === 'plan_approved') {
      status.plan = 'completed';
      if (status.impl === 'pending') status.impl = 'in_progress';
    }
    if (t === 'plan_revision') status.plan = 'in_progress';
    // Impl stage
    if (t === 'impl_progress') status.impl = 'in_progress';
    if (t === 'impl_complete') {
      status.impl = 'completed';
      if (status.test === 'pending') status.test = 'in_progress';
      if (status.review === 'pending') status.review = 'in_progress';
    }
    // Test stage
    if (t === 'test_result') {
      const passed = msg.data?.passed ?? msg.summary?.toLowerCase().includes('pass');
      status.test = passed ? 'completed' : 'in_progress';
    }
    // Review stage
    if (t === 'review_result') {
      const approved = msg.data?.approved ?? msg.summary?.toLowerCase().includes('approv');
      status.review = approved ? 'completed' : 'in_progress';
    }
    // Fix required resets impl
    if (t === 'fix_required') {
      status.impl = 'in_progress';
    }
    // Error blocks stages
    if (t === 'error') {
      // Keep current status, don't override to blocked
    }
  }

  return status;
}

const statusConfig: Record<PipelineStageStatus, { icon: typeof CheckCircle2; color: string; bg: string; animate?: boolean }> = {
  completed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30' },
  in_progress: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30', animate: true },
  pending: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted border-border' },
  blocked: { icon: Ban, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' },
};

function StageNode({ stage, status }: { stage: PipelineStage; status: PipelineStageStatus }) {
  const { formatMessage } = useIntl();
  const config = statusConfig[status];
  const Icon = config.icon;

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
        {formatMessage({ id: `team.pipeline.${stage}` })}
      </span>
      <span className={cn('text-[10px]', config.color)}>
        {formatMessage({ id: `team.pipeline.${status === 'in_progress' ? 'inProgress' : status}` })}
      </span>
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

export function TeamPipeline({ messages }: TeamPipelineProps) {
  const { formatMessage } = useIntl();
  const stageStatus = derivePipelineStatus(messages);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3 flex-1">
        <h3 className="text-sm font-medium text-muted-foreground">
          {formatMessage({ id: 'team.pipeline.title' })}
        </h3>

        {/* Desktop: horizontal layout */}
        <div className="hidden sm:flex items-center gap-0">
          <StageNode stage="plan" status={stageStatus.plan} />
          <Arrow />
          <StageNode stage="impl" status={stageStatus.impl} />
          <Arrow />
          <div className="flex flex-col gap-2">
            <StageNode stage="test" status={stageStatus.test} />
            <StageNode stage="review" status={stageStatus.review} />
          </div>
        </div>

        {/* Mobile: vertical layout */}
        <div className="flex sm:hidden flex-col items-center gap-2">
          {STAGES.map((stage) => (
            <StageNode key={stage} stage={stage} status={stageStatus[stage]} />
          ))}
        </div>
      </div>

      {/* Legend - pinned to bottom */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-auto pt-3 border-t border-border">
        {(['completed', 'in_progress', 'pending', 'blocked'] as PipelineStageStatus[]).map((s) => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          return (
            <span key={s} className="flex items-center gap-1">
              <Icon className={cn('w-3 h-3', cfg.color)} />
              {formatMessage({ id: `team.pipeline.${s === 'in_progress' ? 'inProgress' : s}` })}
            </span>
          );
        })}
      </div>
    </div>
  );
}
