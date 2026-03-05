import type { TeamMessage, DynamicStage, DynamicStageStatus, PhaseInfo } from '@/types/team';

const LEGACY_STAGES = ['plan', 'impl', 'test', 'review'] as const;

/**
 * Capitalize first letter, lowercase rest.
 * "SCAN" -> "Scan", "review" -> "Review"
 */
export function formatStageLabel(stageId: string): string {
  if (!stageId) return '';
  return stageId.charAt(0).toUpperCase() + stageId.slice(1).toLowerCase();
}

/**
 * Derive the status of a pipeline stage from the message history.
 *
 * Matches messages whose `from` field equals or starts with `roleOrStage`
 * (case-insensitive). The status is determined by the LAST matching message's type.
 */
export function deriveStageStatus(
  roleOrStage: string,
  messages: TeamMessage[],
): DynamicStageStatus {
  const needle = roleOrStage.toLowerCase();
  const matching = messages.filter((m) => {
    const from = m.from.toLowerCase();
    return from === needle || from.startsWith(needle);
  });

  if (matching.length === 0) return 'pending';

  const last = matching[matching.length - 1];
  const completionTypes: string[] = ['shutdown', 'impl_complete', 'review_result', 'test_result'];

  if (completionTypes.includes(last.type)) return 'completed';
  if (last.type === 'error') return 'blocked';
  return 'in_progress';
}

/**
 * Four-tier pipeline stage detection.
 *
 * Tier 1 - explicit `pipeline_stages` from meta
 * Tier 2 - explicit `roles` list from meta (excluding coordinator)
 * Tier 3 - inferred from message senders (excluding "coordinator")
 * Tier 4 - legacy 4-stage fallback
 */
export function derivePipelineStages(
  meta: {
    pipeline_stages?: string[];
    role_state?: Record<string, Record<string, unknown>>;
    roles?: string[];
  },
  messages: TeamMessage[],
): DynamicStage[] {
  // Tier 1: explicit pipeline_stages
  if (meta.pipeline_stages && meta.pipeline_stages.length > 0) {
    return meta.pipeline_stages.map((stage) => {
      const id = stage.toUpperCase();
      const lowerStage = stage.toLowerCase();
      const role = meta.roles?.find((r) => r.toLowerCase().startsWith(lowerStage));
      return {
        id,
        label: formatStageLabel(stage),
        role,
        status: deriveStageStatus(stage, messages),
      };
    });
  }

  // Tier 2: explicit roles list from meta (authoritative source from coordinator)
  if (meta.roles && meta.roles.length > 0) {
    const workerRoles = meta.roles.filter((r) => r.toLowerCase() !== 'coordinator');
    if (workerRoles.length > 0) {
      return workerRoles.map((role) => ({
        id: role.toUpperCase(),
        label: formatStageLabel(role),
        role,
        status: deriveStageStatus(role, messages),
      }));
    }
  }

  // Tier 3: extract from message senders
  if (messages.length > 0) {
    const seen = new Map<string, string>(); // lowercase sender -> original sender
    for (const msg of messages) {
      const sender = msg.from;
      if (sender.toLowerCase() === 'coordinator') continue;
      const key = sender.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, sender);
      }
    }

    if (seen.size > 0) {
      return Array.from(seen.entries()).map(([, sender]) => ({
        id: sender.toUpperCase(),
        label: formatStageLabel(sender),
        role: sender,
        status: deriveStageStatus(sender, messages),
      }));
    }
  }

  // Tier 4: legacy fallback
  return LEGACY_STAGES.map((stage) => ({
    id: stage.toUpperCase(),
    label: formatStageLabel(stage),
    role: undefined,
    status: deriveStageStatus(stage, messages),
  }));
}

/**
 * Detect multi-phase execution from coordinator role state.
 * Returns PhaseInfo when the coordinator reports `current_phase`, otherwise null.
 */
export function detectMultiPhase(
  roleState?: Record<string, Record<string, unknown>>,
): PhaseInfo | null {
  if (!roleState || Object.keys(roleState).length === 0) return null;

  const coordinator = roleState['coordinator'];
  if (!coordinator || typeof coordinator.current_phase !== 'number') return null;

  return {
    currentPhase: coordinator.current_phase as number,
    totalPhases: typeof coordinator.total_phases === 'number' ? coordinator.total_phases : null,
    currentStep: typeof coordinator.current_step === 'string' ? coordinator.current_step : null,
    gapIteration: typeof coordinator.gap_iteration === 'number' ? coordinator.gap_iteration : 0,
  };
}
