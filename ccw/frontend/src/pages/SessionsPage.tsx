// ========================================
// SessionsPage Component
// ========================================
// Sessions list page with CRUD operations

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  FolderKanban,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  useSessions,
  useArchiveSession,
  useDeleteSession,
  type SessionsFilter,
} from '@/hooks/useSessions';
import { SessionCard, SessionCardSkeleton } from '@/components/shared/SessionCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/Dropdown';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { cn } from '@/lib/utils';
import type { SessionMetadata } from '@/types/store';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';

type LocationFilter = 'all' | 'active' | 'archived';

// Status label keys for i18n (maps snake_case status to camelCase translation keys)
const statusLabelKeys: Record<SessionMetadata['status'], string> = {
  planning: 'sessions.status.planning',
  in_progress: 'sessions.status.inProgress',
  completed: 'sessions.status.completed',
  archived: 'sessions.status.archived',
  paused: 'sessions.status.paused',
};

/**
 * SessionsPage component - Sessions list with CRUD operations
 */
export function SessionsPage() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  // Filter state
  const [locationFilter, setLocationFilter] = React.useState<LocationFilter>('active');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<SessionMetadata['status'][]>([]);

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);

  // Immersive mode (fullscreen)
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  // Build filter object
  const filter: SessionsFilter = React.useMemo(
    () => ({
      location: locationFilter,
      search: searchQuery,
      status: statusFilter.length > 0 ? statusFilter : undefined,
    }),
    [locationFilter, searchQuery, statusFilter]
  );

  // Fetch sessions with filter
  const {
    filteredSessions,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useSessions({ filter });

  // Mutations
  const { archiveSession, isArchiving } = useArchiveSession();
  const { deleteSession, isDeleting } = useDeleteSession();

  const isMutating = isArchiving || isDeleting;

  // Handlers
  const handleSessionClick = (sessionId: string, sessionType?: SessionMetadata['type']) => {
    // Route review sessions to the dedicated review page
    if (sessionType === 'review') {
      navigate(`/sessions/${sessionId}/review`);
    } else {
      navigate(`/sessions/${sessionId}`);
    }
  };

  const handleArchive = async (sessionId: string) => {
    try {
      await archiveSession(sessionId);
    } catch (err) {
      console.error('Failed to archive session:', err);
    }
  };

  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await deleteSession(sessionToDelete);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const toggleStatusFilter = (status: SessionMetadata['status']) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter.length > 0 || searchQuery.length > 0;

  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{formatMessage({ id: 'sessions.title' })}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'sessions.description' })}
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
          <button
            onClick={toggleImmersiveMode}
            className={cn(
              'p-2 rounded-md transition-colors',
              isImmersiveMode
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={isImmersiveMode ? formatMessage({ id: 'common.exitFullscreen', defaultMessage: 'Exit Fullscreen' }) : formatMessage({ id: 'common.fullscreen', defaultMessage: 'Fullscreen' })}
          >
            {isImmersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
            <p className="text-xs mt-0.5">{error.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {formatMessage({ id: 'home.errors.retry' })}
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Location tabs */}
        <TabsNavigation
          value={locationFilter}
          onValueChange={(v) => setLocationFilter(v as LocationFilter)}
          tabs={[
            { value: 'active', label: formatMessage({ id: 'sessions.filters.active' }) },
            { value: 'archived', label: formatMessage({ id: 'sessions.filters.archived' }) },
            { value: 'all', label: formatMessage({ id: 'sessions.filters.all' }) },
          ]}
        />

        {/* Search input */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'sessions.searchPlaceholder' })}
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

        {/* Status filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {formatMessage({ id: 'common.actions.filter' })}
              {statusFilter.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                  {statusFilter.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{formatMessage({ id: 'common.status.label' })}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['planning', 'in_progress', 'completed', 'paused'] as const).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className="justify-between"
              >
                <span>{formatMessage({ id: statusLabelKeys[status] })}</span>
                {statusFilter.includes(status) && (
                  <span className="text-primary">&#10003;</span>
                )}
              </DropdownMenuItem>
            ))}
            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                  {formatMessage({ id: 'common.actions.clearFilters' })}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{formatMessage({ id: 'common.actions.filters' })}:</span>
          {statusFilter.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleStatusFilter(status)}
            >
              {formatMessage({ id: statusLabelKeys[status] })}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
          {searchQuery && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={handleClearSearch}
            >
              {formatMessage({ id: 'common.actions.search' })}: {searchQuery}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            {formatMessage({ id: 'common.actions.clearAll' })}
          </Button>
        </div>
      )}

      {/* Sessions grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-lg">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {hasActiveFilters ? formatMessage({ id: 'sessions.emptyState.title' }) : formatMessage({ id: 'sessions.emptyState.title' })}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {hasActiveFilters
              ? formatMessage({ id: 'sessions.emptyState.message' })
              : formatMessage({ id: 'sessions.emptyState.createFirst' })}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              {formatMessage({ id: 'common.actions.clearFilters' })}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.session_id}
              session={session}
              onClick={(sessionId) => handleSessionClick(sessionId, session.type)}
              onView={(sessionId) => handleSessionClick(sessionId, session.type)}
              onArchive={handleArchive}
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
            <DialogTitle>{formatMessage({ id: 'common.dialog.deleteSession' })}</DialogTitle>
            <DialogDescription>
              {formatMessage({ id: 'common.dialog.deleteConfirm' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSessionToDelete(null);
              }}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? formatMessage({ id: 'common.status.deleting' }) : formatMessage({ id: 'common.actions.delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SessionsPage;
