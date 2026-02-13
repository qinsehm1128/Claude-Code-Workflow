// ========================================
// TeamHeader Component
// ========================================
// Team selector, stats chips, and controls

import { useIntl } from 'react-intl';
import { Users, MessageSquare, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { TeamSummary, TeamMember } from '@/types/team';

interface TeamHeaderProps {
  teams: TeamSummary[];
  selectedTeam: string | null;
  onSelectTeam: (name: string | null) => void;
  members: TeamMember[];
  totalMessages: number;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export function TeamHeader({
  teams,
  selectedTeam,
  onSelectTeam,
  members,
  totalMessages,
  autoRefresh,
  onToggleAutoRefresh,
}: TeamHeaderProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Team Selector */}
        <Select
          value={selectedTeam ?? ''}
          onValueChange={(v) => onSelectTeam(v || null)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={formatMessage({ id: 'team.selectTeam' })} />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.name} value={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stats chips */}
        {selectedTeam && (
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
