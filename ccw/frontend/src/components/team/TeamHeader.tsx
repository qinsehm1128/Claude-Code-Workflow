// ========================================
// TeamHeader Component
// ========================================
// Detail view header with back button, stats, and controls

import { useIntl } from 'react-intl';
import { Users, MessageSquare, RefreshCw, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import type { TeamMember } from '@/types/team';

interface TeamHeaderProps {
  selectedTeam: string | null;
  onBack: () => void;
  members: TeamMember[];
  totalMessages: number;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export function TeamHeader({
  selectedTeam,
  onBack,
  members,
  totalMessages,
  autoRefresh,
  onToggleAutoRefresh,
}: TeamHeaderProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          {formatMessage({ id: 'team.detail.backToList' })}
        </Button>

        {/* Team name */}
        {selectedTeam && (
          <>
            <h2 className="text-lg font-semibold">{selectedTeam}</h2>

            {/* Stats chips */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {formatMessage({ id: 'team.members' })}: {members.length}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="w-3 h-3" />
                {formatMessage({ id: 'team.messages' })}: {totalMessages}
              </Badge>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={onToggleAutoRefresh}
          />
          <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground cursor-pointer">
            {formatMessage({ id: 'team.autoRefresh' })}
          </Label>
          {autoRefresh && (
            <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
          )}
        </div>
      </div>
    </div>
  );
}
