// ========================================
// RulesManagerPage Component
// ========================================
// Rules list page with CRUD operations

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  FileCode,
  X,
  Folder,
  User,
  Globe,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import {
  useRules,
  useCreateRule,
  useDeleteRule,
  useToggleRule,
} from '@/hooks';
import { RuleCard, RuleCardSkeleton } from '@/components/shared/RuleCard';
import { RuleDialog } from '@/components/shared/RuleDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { Rule } from '@/types/store';

type StatusFilter = 'all' | 'enabled' | 'disabled';
type LocationFilter = 'all' | 'project' | 'user';

/**
 * RulesManagerPage component - Rules list with CRUD operations
 */
export function RulesManagerPage() {
  const { formatMessage } = useIntl();

  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [locationFilter, setLocationFilter] = React.useState<LocationFilter>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string[]>([]);

  // Immersive mode state
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedRule, setSelectedRule] = React.useState<Rule | null>(null);
  const [ruleToDelete, setRuleToDelete] = React.useState<string | null>(null);

  // Fetch rules
  const {
    rules,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useRules();

  // Mutations
  const { isCreating } = useCreateRule();
  const { deleteRule, isDeleting } = useDeleteRule();
  const { toggleRule, isToggling } = useToggleRule();

  const isMutating = isCreating || isDeleting || isToggling;

  // Filter rules
  const filteredRules = React.useMemo(() => {
    let filtered = rules;

    // Status filter
    if (statusFilter === 'enabled') {
      filtered = filtered.filter((r) => r.enabled);
    } else if (statusFilter === 'disabled') {
      filtered = filtered.filter((r) => !r.enabled);
    }

    // Location filter
    if (locationFilter === 'project') {
      filtered = filtered.filter((r) => r.location === 'project');
    } else if (locationFilter === 'user') {
      filtered = filtered.filter((r) => r.location === 'user');
    }

    // Category filter
    if (categoryFilter.length > 0) {
      filtered = filtered.filter((r) =>
        r.category ? categoryFilter.includes(r.category) : false
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.category?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [rules, statusFilter, locationFilter, categoryFilter, searchQuery]);

  // Get all unique categories
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    rules.forEach((r) => {
      if (r.category) cats.add(r.category);
    });
    return Array.from(cats).sort();
  }, [rules]);

  // Count rules by location
  const projectRulesCount = React.useMemo(() =>
    rules.filter((r) => r.location === 'project').length, [rules]);
  const userRulesCount = React.useMemo(() =>
    rules.filter((r) => r.location === 'user').length, [rules]);

  // Handlers
  const handleEditClick = (rule: Rule) => {
    setSelectedRule(rule);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (ruleId: string) => {
    setRuleToDelete(ruleId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return;

    try {
      const rule = rules.find((r) => r.id === ruleToDelete);
      await deleteRule(ruleToDelete, rule?.location);
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await toggleRule(ruleId, enabled);
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const toggleCategoryFilter = (category: string) => {
    setCategoryFilter((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setLocationFilter('all');
    setCategoryFilter([]);
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter !== 'all' || locationFilter !== 'all' ||
    categoryFilter.length > 0 || searchQuery.length > 0;

  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{formatMessage({ id: 'rules.title' })}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'rules.description' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.new' })}
          </Button>
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

      {/* Location Tabs - styled like LiteTasksPage */}
      <TabsNavigation
        value={locationFilter}
        onValueChange={(v) => setLocationFilter(v as LocationFilter)}
        tabs={[
          {
            value: 'all',
            label: formatMessage({ id: 'rules.filters.all' }),
            icon: <Globe className="h-4 w-4" />,
            badge: <Badge variant="secondary" className="ml-2">{rules.length}</Badge>,
            disabled: isMutating,
          },
          {
            value: 'project',
            label: formatMessage({ id: 'rules.location.project' }),
            icon: <Folder className="h-4 w-4" />,
            badge: <Badge variant="secondary" className="ml-2">{projectRulesCount}</Badge>,
            disabled: isMutating,
          },
          {
            value: 'user',
            label: formatMessage({ id: 'rules.location.user' }),
            icon: <User className="h-4 w-4" />,
            badge: <Badge variant="secondary" className="ml-2">{userRulesCount}</Badge>,
            disabled: isMutating,
          },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Status tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">{formatMessage({ id: 'rules.filters.all' })}</TabsTrigger>
            <TabsTrigger value="enabled">{formatMessage({ id: 'rules.filters.enabled' })}</TabsTrigger>
            <TabsTrigger value="disabled">{formatMessage({ id: 'rules.filters.disabled' })}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search input */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'rules.searchPlaceholder' })}
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

        {/* Category filter dropdown */}
        {categories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {formatMessage({ id: 'rules.filters.category' })}
                {categoryFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                    {categoryFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{formatMessage({ id: 'rules.dialog.form.category' })}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((cat) => (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => toggleCategoryFilter(cat)}
                  className="justify-between"
                >
                  <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                  {categoryFilter.includes(cat) && (
                    <span className="text-primary">&#10003;</span>
                  )}
                </DropdownMenuItem>
              ))}
              {categoryFilter.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCategoryFilter([])} className="text-destructive">
                    {formatMessage({ id: 'common.actions.clearFilters' })}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{formatMessage({ id: 'common.actions.filters' })}:</span>
          {statusFilter !== 'all' && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setStatusFilter('all')}
            >
              {formatMessage({ id: `rules.filters.${statusFilter}` })}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
          {locationFilter !== 'all' && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setLocationFilter('all')}
            >
              {formatMessage({ id: `rules.location.${locationFilter}` })}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
          {categoryFilter.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleCategoryFilter(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
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

      {/* Rules grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <RuleCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-lg">
          <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {hasActiveFilters ? formatMessage({ id: 'rules.emptyState.title' }) : formatMessage({ id: 'rules.emptyState.title' })}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {hasActiveFilters
              ? formatMessage({ id: 'rules.emptyState.message' })
              : formatMessage({ id: 'rules.emptyState.createFirst' })}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              {formatMessage({ id: 'common.actions.clearFilters' })}
            </Button>
          ) : (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {formatMessage({ id: 'common.actions.new' })}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onToggle={handleToggle}
              actionsDisabled={isMutating}
            />
          ))}
        </div>
      )}

      {/* Create Rule Dialog */}
      <RuleDialog
        mode="add"
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSave={() => setCreateDialogOpen(false)}
      />

      {/* Edit Rule Dialog */}
      <RuleDialog
        mode="edit"
        rule={selectedRule || undefined}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedRule(null);
        }}
        onSave={() => {
          setEditDialogOpen(false);
          setSelectedRule(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatMessage({ id: 'rules.dialog.deleteTitle' })}</DialogTitle>
            <DialogDescription>
              {formatMessage({ id: 'rules.dialog.deleteConfirm' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setRuleToDelete(null);
              }}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? formatMessage({ id: 'rules.status.deleting' }) : formatMessage({ id: 'common.actions.delete' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RulesManagerPage;
