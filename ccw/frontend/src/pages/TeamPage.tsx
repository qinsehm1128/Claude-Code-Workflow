// ========================================
// TeamPage
// ========================================
// Main page for team execution visualization

import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { useTeamStore } from '@/stores/teamStore';
import { useTeams, useTeamMessages, useTeamStatus } from '@/hooks/useTeamData';
import { TeamEmptyState } from '@/components/team/TeamEmptyState';
import { TeamHeader } from '@/components/team/TeamHeader';
import { TeamPipeline } from '@/components/team/TeamPipeline';
import { TeamMembersPanel } from '@/components/team/TeamMembersPanel';
import { TeamMessageFeed } from '@/components/team/TeamMessageFeed';

export function TeamPage() {
  const { formatMessage } = useIntl();
  const {
    selectedTeam,
    setSelectedTeam,
    autoRefresh,
    toggleAutoRefresh,
    messageFilter,
    setMessageFilter,
    clearMessageFilter,
    timelineExpanded,
    setTimelineExpanded,
  } = useTeamStore();

  // Data hooks
  const { teams, isLoading: teamsLoading } = useTeams();
  const { messages, total: messageTotal } = useTeamMessages(
    selectedTeam,
    messageFilter
  );
  const { members, totalMessages } = useTeamStatus(selectedTeam);

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeam && teams.length > 0) {
      setSelectedTeam(teams[0].name);
    }
  }, [selectedTeam, teams, setSelectedTeam]);

  // Show empty state when no teams exist
  if (!teamsLoading && teams.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5" />
          <h1 className="text-xl font-semibold">{formatMessage({ id: 'team.title' })}</h1>
        </div>
        <TeamEmptyState />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" />
        <h1 className="text-xl font-semibold">{formatMessage({ id: 'team.title' })}</h1>
      </div>

      {/* Team Header: selector + stats + controls */}
      <TeamHeader
        teams={teams}
        selectedTeam={selectedTeam}
        onSelectTeam={setSelectedTeam}
        members={members}
        totalMessages={totalMessages}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={toggleAutoRefresh}
      />

      {selectedTeam ? (
        <>
          {/* Main content grid: Pipeline (left) + Members (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline visualization */}
            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                <TeamPipeline messages={messages} />
              </CardContent>
            </Card>

            {/* Members panel */}
            <Card>
              <CardContent className="p-4">
                <TeamMembersPanel members={members} />
              </CardContent>
            </Card>
          </div>

          {/* Message timeline */}
          <TeamMessageFeed
            messages={messages}
            total={messageTotal}
            filter={messageFilter}
            onFilterChange={setMessageFilter}
            onClearFilter={clearMessageFilter}
            expanded={timelineExpanded}
            onExpandedChange={setTimelineExpanded}
          />
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {formatMessage({ id: 'team.noTeamSelected' })}
        </div>
      )}
    </div>
  );
}

export default TeamPage;
