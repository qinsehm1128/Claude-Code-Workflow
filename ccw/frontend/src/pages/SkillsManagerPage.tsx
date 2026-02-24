// ========================================
// Skills Manager Page
// ========================================
// Browse and manage skills library with search/filter

import { useState, useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  Power,
  PowerOff,
  Tag,
  ChevronDown,
  ChevronRight,
  EyeOff,
  List,
  Grid3x3,
  Folder,
  User,
  AlertCircle,
  Maximize2,
  Minimize2,
  Globe,
  Download,
} from 'lucide-react';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui';
import { SkillCard, SkillDetailPanel, SkillCreateDialog } from '@/components/shared';
import { SkillHubCard } from '@/components/shared/SkillHubCard';
import { CliModeToggle, type CliMode } from '@/components/mcp/CliModeToggle';
import { useSkills, useSkillMutations } from '@/hooks';
import {
  useSkillHub,
  useInstallSkill,
  useUninstallSkill,
  type RemoteSkill,
  type LocalSkill,
  type InstalledSkill,
  type CliType,
  type SkillSource,
} from '@/hooks/useSkillHub';
import { fetchSkillDetail } from '@/lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import type { Skill } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Skill Grid Component ==========

interface SkillGridProps {
  skills: Skill[];
  isLoading: boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  onClick: (skill: Skill) => void;
  isToggling: boolean;
  compact?: boolean;
}

function SkillGrid({ skills, isLoading, onToggle, onClick, isToggling, compact }: SkillGridProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className={cn(
        'grid gap-4',
        compact ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'
      )}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'skills.emptyState.title' })}</h3>
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'skills.emptyState.message' })}
        </p>
      </Card>
    );
  }

  return (
    <div className={cn(
      'grid gap-4',
      compact ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'
    )}>
      {skills.map((skill) => (
        <SkillCard
          key={skill.name}
          skill={skill}
          onToggle={onToggle}
          onClick={onClick}
          isToggling={isToggling}
          compact={compact}
        />
      ))}
    </div>
  );
}

// ========== Main Page Component ==========

export function SkillsManagerPage() {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  const [cliMode, setCliMode] = useState<CliMode>('claude');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [showDisabledSection, setShowDisabledSection] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<{ skill: Skill; enable: boolean } | null>(null);
  const [locationFilter, setLocationFilter] = useState<'project' | 'user' | 'hub'>('project');

  // Skill Hub state
  const [hubTab, setHubTab] = useState<'remote' | 'local' | 'installed'>('remote');
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [hubCategoryFilter, setHubCategoryFilter] = useState<string | null>(null);

  // Skill create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Skill detail panel state
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  // Immersive mode state
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  const {
    skills,
    categories,
    projectSkills,
    userSkills,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useSkills({
    filter: {
      search: searchQuery || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter as Skill['source'] : undefined,
      enabledOnly: enabledFilter === 'enabled',
      location: locationFilter === 'hub' ? undefined : locationFilter,
    },
    cliType: cliMode,
  });

  const { toggleSkill, isToggling } = useSkillMutations();

  // Skill Hub hooks
  const {
    remote: remoteSkills,
    local: localSkills,
    installed: installedSkills,
    stats: hubStats,
    isLoading: isHubLoading,
    isError: isHubError,
    isFetching: isHubFetching,
    refetchAll: refetchHub,
  } = useSkillHub(locationFilter === 'hub');

  const installSkillMutation = useInstallSkill();
  const uninstallSkillMutation = useUninstallSkill();

  // Build installed map for quick lookup
  const installedMap = useMemo(() => {
    const map = new Map<string, InstalledSkill>();
    installedSkills.data?.skills?.forEach((skill: InstalledSkill) => {
      map.set(skill.originalId, skill);
    });
    return map;
  }, [installedSkills.data]);

  // Extract unique categories from skill hub
  const hubCategories = useMemo(() => {
    const cats = new Set<string>();
    remoteSkills.data?.skills?.forEach((skill: RemoteSkill) => {
      if (skill.category) cats.add(skill.category);
    });
    localSkills.data?.skills?.forEach((skill: LocalSkill) => {
      if (skill.category) cats.add(skill.category);
    });
    return Array.from(cats).sort();
  }, [remoteSkills.data, localSkills.data]);

  // Filter hub skills based on search and category
  const filterHubSkills = <T extends RemoteSkill | LocalSkill | InstalledSkill>(skills: T[]): T[] => {
    return skills.filter((skill) => {
      const matchesSearch = !hubSearchQuery ||
        skill.name.toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
        ('description' in skill && skill.description?.toLowerCase().includes(hubSearchQuery.toLowerCase())) ||
        ('tags' in skill && skill.tags?.some((tag: string) => tag.toLowerCase().includes(hubSearchQuery.toLowerCase())));

      const matchesCategory = !hubCategoryFilter || ('category' in skill && skill.category === hubCategoryFilter);

      return matchesSearch && matchesCategory;
    });
  };

  // Get filtered skills for current hub tab
  const filteredHubSkills = useMemo(() => {
    if (hubTab === 'remote') {
      return filterHubSkills(remoteSkills.data?.skills || []);
    }
    if (hubTab === 'local') {
      return filterHubSkills(localSkills.data?.skills || []);
    }
    return installedSkills.data?.skills || [];
  }, [hubTab, remoteSkills.data, localSkills.data, installedSkills.data, hubSearchQuery, hubCategoryFilter]);

  // Hub skill handlers
  const handleHubInstall = async (skill: RemoteSkill | LocalSkill, cliType: CliType) => {
    const source: SkillSource = 'downloadUrl' in skill ? 'remote' : 'local';
    await installSkillMutation.mutateAsync({
      skillId: skill.id,
      cliType,
      source,
      downloadUrl: 'downloadUrl' in skill ? skill.downloadUrl : undefined,
    });
  };

  const handleHubUninstall = async (skill: RemoteSkill | LocalSkill, cliType: CliType) => {
    const installedInfo = installedMap.get(skill.id);
    if (installedInfo) {
      await uninstallSkillMutation.mutateAsync({
        skillId: installedInfo.id,
        cliType,
      });
    }
  };

  // Filter skills based on enabled filter
  const filteredSkills = useMemo(() => {
    if (enabledFilter === 'disabled') {
      return skills.filter((s) => !s.enabled);
    }
    return skills;
  }, [skills, enabledFilter]);

  // Calculate counts based on current location filter (from skills, not allSkills)
  const currentLocationEnabledCount = useMemo(() => skills.filter(s => s.enabled).length, [skills]);
  const currentLocationTotalCount = skills.length;
  const currentLocationDisabledCount = currentLocationTotalCount - currentLocationEnabledCount;

  const handleToggle = async (skill: Skill, enabled: boolean) => {
    // Use the skill's location property
    const location = skill.location || 'project';
    // Use folderName for API calls (actual folder name), fallback to name if not available
    const skillIdentifier = skill.folderName || skill.name;

    // Debug logging
    console.log('[SkillToggle] Toggling skill:', {
      name: skill.name,
      folderName: skill.folderName,
      location,
      enabled,
      skillIdentifier,
      cliMode
    });

    try {
      await toggleSkill(skillIdentifier, enabled, location, cliMode);
    } catch (error) {
      console.error('[SkillToggle] Toggle failed:', error);
      throw error;
    }
  };

  const handleToggleWithConfirm = (skill: Skill, enabled: boolean) => {
    if (!enabled) {
      // Show confirmation dialog when disabling
      setConfirmDisable({ skill, enable: false });
    } else {
      // Enable directly without confirmation
      handleToggle(skill, true);
    }
  };

  const handleConfirmDisable = async () => {
    if (confirmDisable) {
      await handleToggle(confirmDisable.skill, false);
      setConfirmDisable(null);
    }
  };

  // Skill detail panel handlers
  const handleSkillClick = useCallback(async (skill: Skill) => {
    setIsDetailLoading(true);
    setIsDetailPanelOpen(true);
    setSelectedSkill(skill);

    try {
      // Fetch full skill details from API
      const data = await fetchSkillDetail(
        skill.name,
        skill.location || 'project',
        projectPath,
        cliMode
      );
      setSelectedSkill(data.skill);
    } catch (error) {
      console.error('Failed to fetch skill details:', error);
      // Keep the basic skill info if fetch fails
    } finally {
      setIsDetailLoading(false);
    }
  }, [projectPath, cliMode]);

  const handleCloseDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(false);
    setSelectedSkill(null);
  }, []);

  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                {formatMessage({ id: 'skills.title' })}
              </h1>
              <p className="text-muted-foreground mt-1">
                {formatMessage({ id: 'skills.description' })}
              </p>
            </div>
            {/* CLI Mode Badge Switcher */}
            <div className="ml-3 flex-shrink-0">
              <CliModeToggle
                currentMode={cliMode}
                onModeChange={setCliMode}
              />
            </div>
          </div>
          <div className="flex gap-2">
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
            <Button variant="outline" onClick={() => locationFilter === 'hub' ? refetchHub() : refetch()} disabled={isFetching || isHubFetching}>
              <RefreshCw className={cn('w-4 h-4 mr-2', (isFetching || isHubFetching) && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'skills.actions.install' })}
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
          onValueChange={(v) => setLocationFilter(v as 'project' | 'user' | 'hub')}
          tabs={[
            {
              value: 'project',
              label: formatMessage({ id: 'skills.location.project' }),
              icon: <Folder className="h-4 w-4" />,
              badge: <Badge variant="secondary" className="ml-2">{projectSkills.length}</Badge>,
              disabled: isToggling,
            },
            {
              value: 'user',
              label: formatMessage({ id: 'skills.location.user' }),
              icon: <User className="h-4 w-4" />,
              badge: <Badge variant="secondary" className="ml-2">{userSkills.length}</Badge>,
              disabled: isToggling,
            },
            {
              value: 'hub',
              label: formatMessage({ id: 'skills.location.hub' }),
              icon: <Globe className="h-4 w-4" />,
              badge: <Badge variant="secondary" className="ml-2">{hubStats.data?.installedTotal || 0}</Badge>,
              disabled: isToggling,
            },
          ]}
        />
      </div>

      {/* Stats Cards */}
      {locationFilter === 'hub' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{hubStats.data?.remoteTotal || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skillHub.stats.remote' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-info" />
              <span className="text-2xl font-bold">{hubStats.data?.localTotal || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skillHub.stats.local' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-success" />
              <span className="text-2xl font-bold">{hubStats.data?.installedTotal || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skillHub.stats.installed' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className={cn('w-5 h-5', (hubStats.data?.updatesAvailable || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
              <span className="text-2xl font-bold">{hubStats.data?.updatesAvailable || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skillHub.stats.updates' })}</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{currentLocationTotalCount}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'common.stats.totalSkills' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Power className="w-5 h-5 text-success" />
              <span className="text-2xl font-bold">{currentLocationEnabledCount}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skills.state.enabled' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <PowerOff className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{currentLocationDisabledCount}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skills.state.disabled' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-info" />
              <span className="text-2xl font-bold">{categories.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skills.card.category' })}</p>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      {locationFilter === 'hub' ? (
        <>
          {/* Hub Sub-tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsNavigation
              value={hubTab}
              onValueChange={(v) => setHubTab(v as 'remote' | 'local' | 'installed')}
              tabs={[
                {
                  value: 'remote',
                  label: formatMessage({ id: 'skillHub.tabs.remote' }),
                  icon: <Globe className="h-4 w-4" />,
                  badge: remoteSkills.data?.total ? <Badge variant="secondary" className="ml-2">{remoteSkills.data.total}</Badge> : undefined,
                },
                {
                  value: 'local',
                  label: formatMessage({ id: 'skillHub.tabs.local' }),
                  icon: <Folder className="h-4 w-4" />,
                  badge: localSkills.data?.total ? <Badge variant="secondary" className="ml-2">{localSkills.data.total}</Badge> : undefined,
                },
                {
                  value: 'installed',
                  label: formatMessage({ id: 'skillHub.tabs.installed' }),
                  icon: <Download className="h-4 w-4" />,
                  badge: installedSkills.data?.total ? <Badge variant="secondary" className="ml-2">{installedSkills.data.total}</Badge> : undefined,
                },
              ]}
            />
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={formatMessage({ id: 'skillHub.search.placeholder' })}
                  value={hubSearchQuery}
                  onChange={(e) => setHubSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              {hubCategories.length > 0 && hubTab !== 'installed' && (
                <Select value={hubCategoryFilter || 'all'} onValueChange={(v) => setHubCategoryFilter(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={formatMessage({ id: 'skillHub.filter.allCategories' })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{formatMessage({ id: 'skillHub.filter.allCategories' })}</SelectItem>
                    {hubCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Hub Error State */}
          {isHubError && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{formatMessage({ id: 'skillHub.error.loadFailed' })}</span>
            </div>
          )}

          {/* Hub Skills Grid */}
          {isHubLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredHubSkills.length === 0 ? (
            <Card className="p-8 text-center">
              {hubTab === 'remote' ? (
                <>
                  <Globe className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'skillHub.empty.remote.title' })}</h3>
                  <p className="mt-2 text-muted-foreground">{formatMessage({ id: 'skillHub.empty.remote.description' })}</p>
                </>
              ) : hubTab === 'local' ? (
                <>
                  <Folder className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'skillHub.empty.local.title' })}</h3>
                  <p className="mt-2 text-muted-foreground">{formatMessage({ id: 'skillHub.empty.local.description' })}</p>
                </>
              ) : (
                <>
                  <Download className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'skillHub.empty.installed.title' })}</h3>
                  <p className="mt-2 text-muted-foreground">{formatMessage({ id: 'skillHub.empty.installed.description' })}</p>
                </>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHubSkills.map((skill) => {
                const source: SkillSource = hubTab === 'remote' ? 'remote' : 'local';
                const installedInfo = installedMap.get(skill.id);
                const skillSource: SkillSource = hubTab === 'installed'
                  ? ('source' in skill ? (skill as InstalledSkill).source : source)
                  : source;

                return (
                  <SkillHubCard
                    key={skill.id}
                    skill={skill as RemoteSkill | LocalSkill}
                    installedInfo={installedInfo}
                    source={skillSource}
                    onInstall={handleHubInstall}
                    onUninstall={handleHubUninstall}
                    isInstalling={installSkillMutation.isPending}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Regular Skills Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={formatMessage({ id: 'skills.filters.searchPlaceholder' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={formatMessage({ id: 'skills.card.category' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage({ id: 'skills.filters.all' })}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={formatMessage({ id: 'skills.card.source' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage({ id: 'skills.filters.allSources' })}</SelectItem>
                  <SelectItem value="builtin">{formatMessage({ id: 'skills.source.builtin' })}</SelectItem>
                  <SelectItem value="custom">{formatMessage({ id: 'skills.source.custom' })}</SelectItem>
                  <SelectItem value="community">{formatMessage({ id: 'skills.source.community' })}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={enabledFilter} onValueChange={(v) => setEnabledFilter(v as 'all' | 'enabled' | 'disabled')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={formatMessage({ id: 'skills.state.enabled' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{formatMessage({ id: 'skills.filters.all' })}</SelectItem>
                  <SelectItem value="enabled">{formatMessage({ id: 'skills.filters.enabled' })}</SelectItem>
                  <SelectItem value="disabled">{formatMessage({ id: 'skills.filters.disabled' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnabledFilter('all')}
              className={enabledFilter === 'all' ? 'bg-primary text-primary-foreground' : ''}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'skills.filters.all' })} ({currentLocationTotalCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnabledFilter('enabled')}
              className={enabledFilter === 'enabled' ? 'bg-primary text-primary-foreground' : ''}
            >
              <Power className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'skills.state.enabled' })} ({currentLocationEnabledCount})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEnabledFilter('disabled')}
              className={enabledFilter === 'disabled' ? 'bg-primary text-primary-foreground' : ''}
            >
              <PowerOff className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'skills.state.disabled' })} ({currentLocationDisabledCount})
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'compact' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4 mr-1" /> : <Grid3x3 className="w-4 h-4 mr-1" />}
              {formatMessage({ id: viewMode === 'grid' ? 'skills.view.compact' : 'skills.view.grid' })}
            </Button>
          </div>

          {/* Skills Grid */}
          <SkillGrid
            skills={filteredSkills}
            isLoading={isLoading}
            onToggle={handleToggleWithConfirm}
            onClick={handleSkillClick}
            isToggling={isToggling || !!confirmDisable}
            compact={viewMode === 'compact'}
          />

          {/* Disabled Skills Section */}
          {enabledFilter === 'all' && currentLocationDisabledCount > 0 && (
            <div className="mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowDisabledSection(!showDisabledSection)}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                {showDisabledSection ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                <EyeOff className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'skills.disabledSkills.title' })} ({currentLocationDisabledCount})
              </Button>

              {showDisabledSection && (
                <SkillGrid
                  skills={skills.filter((s) => !s.enabled)}
                  isLoading={false}
                  onToggle={handleToggleWithConfirm}
                  onClick={handleSkillClick}
                  isToggling={isToggling || !!confirmDisable}
                  compact={true}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={!!confirmDisable} onOpenChange={(open) => !open && setConfirmDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{formatMessage({ id: 'skills.disableConfirm.title' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(
                { id: 'skills.disableConfirm.message' },
                { name: confirmDisable?.skill.name || '' }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{formatMessage({ id: 'skills.actions.cancel' })}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {formatMessage({ id: 'skills.actions.confirmDisable' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skill Detail Panel */}
      <SkillDetailPanel
        skill={selectedSkill}
        isOpen={isDetailPanelOpen}
        onClose={handleCloseDetailPanel}
        isLoading={isDetailLoading}
      />

      {/* Skill Create Dialog */}
      <SkillCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={() => refetch()}
        cliType={cliMode}
      />
    </div>
  );
}

export default SkillsManagerPage;
