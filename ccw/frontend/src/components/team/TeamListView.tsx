// ========================================
// TeamListView Component
// ========================================
// Team card grid with tabs, search, and actions

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { TeamCard, TeamCardSkeleton } from './TeamCard';
import { useTeamStore } from '@/stores/teamStore';
import { useTeams, useArchiveTeam, useUnarchiveTeam, useDeleteTeam } from '@/hooks/useTeamData';

export function TeamListView() {
  const { formatMessage } = useIntl();
  const {
    locationFilter,
    setLocationFilter,
    searchQuery,
    setSearchQuery,
    selectTeamAndShowDetail,
  } = useTeamStore();

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [teamToDelete, setTeamToDelete] = React.useState<string | null>(null);

  // Data
  const { teams, isLoading, isFetching, refetch } = useTeams(locationFilter);
  const { archiveTeam, isArchiving } = useArchiveTeam();
  const { unarchiveTeam, isUnarchiving } = useUnarchiveTeam();
  const { deleteTeam, isDeleting } = useDeleteTeam();

  const isMutating = isArchiving || isUnarchiving || isDeleting;

  // Client-side search filter
  const filteredTeams = React.useMemo(() => {
    if (!searchQuery) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, searchQuery]);

  // Handlers
  const handleArchive = async (name: string) => {
    try {
      await archiveTeam(name);
    } catch (err) {
      console.error('Failed to archive team:', err);
    }
  };

  const handleUnarchive = async (name: string) => {
    try {
      await unarchiveTeam(name);
    } catch (err) {
      console.error('Failed to unarchive team:', err);
    }
  };

  const handleDeleteClick = (name: string) => {
    setTeamToDelete(name);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teamToDelete) return;
    try {
      await deleteTeam(teamToDelete);
      setDeleteDialogOpen(false);
      setTeamToDelete(null);
    } catch (err) {
      console.error('Failed to delete team:', err);
    }
  };

  const handleClearSearch = () => setSearchQuery('');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h1 className="text-2xl font-semibold text-foreground">
              {formatMessage({ id: 'team.title' })}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'team.description' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Location tabs */}
        <TabsNavigation
          value={locationFilter}
          onValueChange={(v) => setLocationFilter(v as 'active' | 'archived' | 'all')}
          tabs={[
            { value: 'active', label: formatMessage({ id: 'team.filters.active' }) },
            { value: 'archived', label: formatMessage({ id: 'team.filters.archived' }) },
            { value: 'all', label: formatMessage({ id: 'team.filters.all' }) },
          ]}
        />

        {/* Search input */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'team.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Team grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-lg">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {searchQuery
              ? formatMessage({ id: 'team.emptyState.noMatching' })
              : formatMessage({ id: 'team.emptyState.noTeams' })}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {searchQuery
              ? formatMessage({ id: 'team.emptyState.noMatchingDescription' })
              : formatMessage({ id: 'team.emptyState.noTeamsDescription' })}
          </p>
          {searchQuery && (
            <Button variant="outline" onClick={handleClearSearch}>
              {formatMessage({ id: 'common.actions.clearFilters' })}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.name}
              team={team}
              onClick={selectTeamAndShowDetail}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDeleteClick}
              actionsDisabled={isMutating}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage({ id: 'team.dialog.deleteTeam' })}</DialogTitle>
            <DialogDescription>
              {formatMessage({ id: 'team.dialog.deleteConfirm' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTeamToDelete(null);
              }}
            >
              {formatMessage({ id: 'team.dialog.cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting
                ? formatMessage({ id: 'team.dialog.deleting' })
                : formatMessage({ id: 'team.actions.delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
