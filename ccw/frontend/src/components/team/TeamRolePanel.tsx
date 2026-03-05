// ========================================
// TeamRolePanel Component
// ========================================
// Member-to-pipeline-role mapping with fallback to TeamMembersPanel

import { useIntl } from 'react-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { TeamMembersPanel } from './TeamMembersPanel';
import type { TeamMember, DynamicStage } from '@/types/team';

interface TeamRolePanelProps {
  members: TeamMember[];
  stages: DynamicStage[];
  roleState?: Record<string, Record<string, unknown>>;
}

function formatRelativeTime(isoString: string): string {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getMemberStatus(member: TeamMember): 'active' | 'idle' {
  if (!member.lastSeen) return 'idle';
  const diffMs = Date.now() - new Date(member.lastSeen).getTime();
  // Active if seen in last 2 minutes
  return diffMs < 2 * 60 * 1000 ? 'active' : 'idle';
}

/** Find the matching dynamic stage for a member */
function findMatchingStage(member: TeamMember, stages: DynamicStage[]): DynamicStage | undefined {
  const memberLower = member.member.toLowerCase();
  return stages.find(
    (stage) =>
      (stage.role && stage.role.toLowerCase() === memberLower) ||
      stage.id.toLowerCase() === memberLower
  );
}

const stageBadgeVariant: Record<string, 'success' | 'info' | 'secondary' | 'destructive' | 'warning'> = {
  completed: 'success',
  in_progress: 'info',
  pending: 'secondary',
  blocked: 'destructive',
  skipped: 'warning',
};

export function TeamRolePanel({ members, stages, roleState: _roleState }: TeamRolePanelProps) {
  const { formatMessage } = useIntl();

  // Fallback to static members panel when no dynamic stages
  if (stages.length === 0) {
    return <TeamMembersPanel members={members} />;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {formatMessage({ id: 'team.membersPanel.title' })}
      </h3>
      <div className="space-y-2">
        {members.map((m) => {
          const status = getMemberStatus(m);
          const isActive = status === 'active';
          const matchedStage = findMatchingStage(m, stages);

          return (
            <Card key={m.member} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div className="pt-0.5">
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        isActive
                          ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                          : 'bg-muted-foreground/40'
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Name + status badge + stage badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{m.member}</span>
                      <Badge
                        variant={isActive ? 'success' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {formatMessage({ id: `team.membersPanel.${status}` })}
                      </Badge>
                      {matchedStage && (
                        <Badge
                          variant={stageBadgeVariant[matchedStage.status] ?? 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {matchedStage.label}
                        </Badge>
                      )}
                    </div>

                    {/* Last action */}
                    {m.lastAction && (
                      <p className="text-xs text-muted-foreground truncate">
                        {m.lastAction}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>
                        {m.messageCount} {formatMessage({ id: 'team.messages' }).toLowerCase()}
                      </span>
                      {m.lastSeen && (
                        <span>
                          {formatRelativeTime(m.lastSeen)} {formatMessage({ id: 'team.membersPanel.ago' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {members.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {formatMessage({ id: 'team.empty.noMessages' })}
          </p>
        )}
      </div>
    </div>
  );
}
