// ========================================
// Discovery Card Component
// ========================================
// Displays a discovery session card with status, progress, and findings count

import { useIntl } from 'react-intl';
import { Radar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';
import type { DiscoverySession } from '@/lib/api';

interface DiscoveryCardProps {
  session: DiscoverySession;
  isActive: boolean;
  onClick: () => void;
}

const statusConfig = {
  running: {
    icon: Clock,
    variant: 'warning' as const,
    label: 'issues.discovery.session.status.running',
  },
  completed: {
    icon: CheckCircle,
    variant: 'success' as const,
    label: 'issues.discovery.session.status.completed',
  },
  failed: {
    icon: XCircle,
    variant: 'destructive' as const,
    label: 'issues.discovery.session.status.failed',
  },
};

export function DiscoveryCard({ session, isActive, onClick }: DiscoveryCardProps) {
  const { formatMessage } = useIntl();
  const config = statusConfig[session.status];
  const StatusIcon = config.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md',
        isActive && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Radar className="w-5 h-5 text-primary flex-shrink-0" />
          <h3 className="font-medium text-foreground truncate">{session.name}</h3>
        </div>
        <Badge variant={config.variant} className="flex-shrink-0">
          <StatusIcon className="w-3 h-3 mr-1" />
          {formatMessage({ id: config.label })}
        </Badge>
      </div>

      {/* Progress Bar for Running Sessions */}
      {session.status === 'running' && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{formatMessage({ id: 'issues.discovery.progress' })}</span>
            <span>{session.progress}%</span>
          </div>
          <Progress value={session.progress} className="h-2" />
        </div>
      )}

      {/* Findings Count */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{formatMessage({ id: 'issues.discovery.session.findings' }, { count: session.findings_count })}:</span>
            <span className="font-medium text-foreground">{session.findings_count}</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(session.created_at)}
        </span>
      </div>
    </Card>
  );
}
