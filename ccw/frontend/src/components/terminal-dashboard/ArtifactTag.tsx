// ========================================
// ArtifactTag Component
// ========================================
// Colored, clickable tag for detected CCW artifacts in terminal output.

import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { badgeVariants } from '@/components/ui/Badge';
import type { ArtifactType } from '@/lib/ccw-artifacts';

export interface ArtifactTagProps {
  type: ArtifactType;
  path: string;
  onClick?: (path: string) => void;
  className?: string;
}

function getVariant(type: ArtifactType) {
  switch (type) {
    case 'workflow-session':
      return 'info';
    case 'lite-session':
      return 'success';
    case 'claude-md':
      return 'review';
    case 'ccw-config':
      return 'warning';
    case 'issue':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getLabelId(type: ArtifactType): string {
  switch (type) {
    case 'workflow-session':
      return 'terminalDashboard.artifacts.types.workflowSession';
    case 'lite-session':
      return 'terminalDashboard.artifacts.types.liteSession';
    case 'claude-md':
      return 'terminalDashboard.artifacts.types.claudeMd';
    case 'ccw-config':
      return 'terminalDashboard.artifacts.types.ccwConfig';
    case 'issue':
      return 'terminalDashboard.artifacts.types.issue';
  }
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/g);
  return parts[parts.length - 1] || p;
}

export function ArtifactTag({ type, path, onClick, className }: ArtifactTagProps) {
  const { formatMessage } = useIntl();
  const label = formatMessage({ id: getLabelId(type) });
  const display = basename(path);

  return (
    <button
      type="button"
      className={cn(
        badgeVariants({ variant: getVariant(type) as any }),
        'gap-1 cursor-pointer hover:opacity-90 active:opacity-100',
        'px-2 py-0.5 text-[11px] font-semibold',
        className
      )}
      onClick={() => onClick?.(path)}
      title={path}
    >
      <span>{label}</span>
      <span className="opacity-80 font-mono">{display}</span>
    </button>
  );
}

export default ArtifactTag;
