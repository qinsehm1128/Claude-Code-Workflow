// ========================================
// TeamPage
// ========================================
// Main page for team execution - list/detail dual view with tabbed detail

import { useIntl } from 'react-intl';
import { Package, MessageSquare, Maximize2, Minimize2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import { TabsNavigation, type TabItem } from '@/components/ui/TabsNavigation';
import { useTeamStore } from '@/stores/teamStore';
import type { TeamDetailTab } from '@/stores/teamStore';
import { useTeamMessages, useTeamStatus } from '@/hooks/useTeamData';
import { TeamHeader } from '@/components/team/TeamHeader';
import { TeamPipeline } from '@/components/team/TeamPipeline';
import { TeamMembersPanel } from '@/components/team/TeamMembersPanel';
import { TeamMessageFeed } from '@/components/team/TeamMessageFeed';
import { TeamArtifacts } from '@/components/team/TeamArtifacts';
import { TeamListView } from '@/components/team/TeamListView';

export function TeamPage() {
  const { formatMessage } = useIntl();
  const {
    selectedTeam,
    viewMode,
    autoRefresh,
    toggleAutoRefresh,
    messageFilter,
    setMessageFilter,
    clearMessageFilter,
    timelineExpanded,
    setTimelineExpanded,
    detailTab,
    setDetailTab,
    backToList,
  } = useTeamStore();
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  // Data hooks (only active in detail mode)
  const { messages, total: messageTotal } = useTeamMessages(
    viewMode === 'detail' ? selectedTeam : null,
    messageFilter
  );
  const { members, totalMessages } = useTeamStatus(
    viewMode === 'detail' ? selectedTeam : null
  );

  // List view
  if (viewMode === 'list' || !selectedTeam) {
    return (
      <div className="space-y-6">
        <TeamListView />
      </div>
    );
  }

  const tabs: TabItem[] = [
    {
      value: 'artifacts',
      label: formatMessage({ id: 'team.tabs.artifacts' }),
      icon: <Package className="h-4 w-4" />,
    },
    {
      value: 'messages',
      label: formatMessage({ id: 'team.tabs.messages' }),
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

  // Detail view
  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Detail Header: back button + team name + stats + controls */}
      <div className="flex items-center justify-between">
        <TeamHeader
          selectedTeam={selectedTeam}
          onBack={backToList}
          members={members}
          totalMessages={totalMessages}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={toggleAutoRefresh}
        />
        <button
          onClick={toggleImmersiveMode}
          className={cn(
            'p-2 rounded-md transition-colors',
            isImmersiveMode
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isImmersiveMode ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isImmersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Overview: Pipeline + Members (always visible) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col">
          <CardContent className="p-4 flex-1">
            <TeamPipeline messages={messages} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <TeamMembersPanel members={members} />
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation: Artifacts / Messages */}
      <TabsNavigation
        value={detailTab}
        onValueChange={(v) => setDetailTab(v as TeamDetailTab)}
        tabs={tabs}
      />

      {/* Artifacts Tab */}
      {detailTab === 'artifacts' && (
        <TeamArtifacts teamName={selectedTeam} />
      )}

      {/* Messages Tab */}
      {detailTab === 'messages' && (
        <TeamMessageFeed
          messages={messages}
          total={messageTotal}
          filter={messageFilter}
          onFilterChange={setMessageFilter}
          onClearFilter={clearMessageFilter}
          expanded={timelineExpanded}
          onExpandedChange={setTimelineExpanded}
        />
      )}
    </div>
  );
}

export default TeamPage;
