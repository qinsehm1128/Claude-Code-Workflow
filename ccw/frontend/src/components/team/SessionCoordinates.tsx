// ========================================
// SessionCoordinates Component
// ========================================
// Compact inline display of phase/step/gap using Badge components

import { useIntl } from 'react-intl';
import { Badge } from '@/components/ui/Badge';
import type { PhaseInfo } from '@/types/team';

interface SessionCoordinatesProps {
  phaseInfo: PhaseInfo;
}

export function SessionCoordinates({ phaseInfo }: SessionCoordinatesProps) {
  const { formatMessage } = useIntl();

  return (
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
  );
}
