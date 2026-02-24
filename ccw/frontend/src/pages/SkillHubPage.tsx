// ========================================
// SkillHubPage Component
// ========================================
// Shared skill repository management page

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Globe,
  Folder,
  Search,
  Filter,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { StatCard } from '@/components/shared';
import { SkillHubCard } from '@/components/shared/SkillHubCard';
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

// ========== Types ==========

type TabValue = 'remote' | 'local' | 'installed';

// ========== Stats Cards ==========

function StatsCards({
  remoteTotal,
  localTotal,
  installedTotal,
  updatesAvailable,
  isLoading,
}: {
  remoteTotal: number;
  localTotal: number;
  installedTotal: number;
  updatesAvailable: number;
  isLoading: boolean;
}) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        title={formatMessage({ id: 'skillHub.stats.remote' })}
        value={remoteTotal}
        icon={Globe}
        description={formatMessage({ id: 'skillHub.stats.remoteDesc' })}
      />
      <StatCard
        title={formatMessage({ id: 'skillHub.stats.local' })}
        value={localTotal}
        icon={Folder}
        description={formatMessage({ id: 'skillHub.stats.localDesc' })}
      />
      <StatCard
        title={formatMessage({ id: 'skillHub.stats.installed' })}
        value={installedTotal}
        icon={Download}
        description={formatMessage({ id: 'skillHub.stats.installedDesc' })}
      />
      <StatCard
        title={formatMessage({ id: 'skillHub.stats.updates' })}
        value={updatesAvailable}
        icon={RefreshCw}
        description={formatMessage({ id: 'skillHub.stats.updatesDesc' })}
        variant={updatesAvailable > 0 ? 'warning' : 'default'}
      />
    </div>
  );
}

// ========== Empty State ==========

function EmptyState({ type }: { type: TabValue }) {
  const { formatMessage } = useIntl();

  const messages: Record<TabValue, { icon: React.ReactNode; title: string; description: string }> = {
    remote: {
      icon: <Globe className="w-12 h-12 text-muted-foreground" />,
      title: formatMessage({ id: 'skillHub.empty.remote.title' }),
      description: formatMessage({ id: 'skillHub.empty.remote.description' }),
    },
    local: {
      icon: <Folder className="w-12 h-12 text-muted-foreground" />,
      title: formatMessage({ id: 'skillHub.empty.local.title' }),
      description: formatMessage({ id: 'skillHub.empty.local.description' }),
    },
    installed: {
      icon: <Download className="w-12 h-12 text-muted-foreground" />,
      title: formatMessage({ id: 'skillHub.empty.installed.title' }),
      description: formatMessage({ id: 'skillHub.empty.installed.description' }),
    },
  };

  const { icon, title, description } = messages[type];

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

// ========== Main Component ==========

export function SkillHubPage() {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState<TabValue>('remote');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Fetch data
  const {
    remote,
    local,
    installed,
    stats,
    isLoading,
    isError,
    isFetching,
    refetchAll,
  } = useSkillHub();

  // Mutations
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();

  // Build installed map for quick lookup
  const installedMap = useMemo(() => {
    const map = new Map<string, InstalledSkill>();
    installed.data?.skills?.forEach((skill: InstalledSkill) => {
      map.set(skill.originalId, skill);
    });
    return map;
  }, [installed.data]);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    remote.data?.skills?.forEach((skill: RemoteSkill) => {
      if (skill.category) cats.add(skill.category);
    });
    local.data?.skills?.forEach((skill: LocalSkill) => {
      if (skill.category) cats.add(skill.category);
    });
    return Array.from(cats).sort();
  }, [remote.data, local.data]);

  // Filter skills based on search and category
  const filterSkills = <T extends RemoteSkill | LocalSkill | InstalledSkill>(skills: T[]): T[] => {
    return skills.filter((skill) => {
      const matchesSearch = !searchQuery ||
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ('description' in skill && skill.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ('tags' in skill && skill.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory = !categoryFilter || ('category' in skill && skill.category === categoryFilter);

      return matchesSearch && matchesCategory;
    });
  };

  // Get filtered skills for current tab
  const filteredSkills = useMemo(() => {
    if (activeTab === 'remote') {
      return filterSkills(remote.data?.skills || []);
    }
    if (activeTab === 'local') {
      return filterSkills(local.data?.skills || []);
    }
    // For installed tab, show the installed skills
    return installed.data?.skills || [];
  }, [activeTab, remote.data, local.data, installed.data, searchQuery, categoryFilter]);

  // Handlers
  const handleInstall = async (skill: RemoteSkill | LocalSkill, cliType: CliType) => {
    const source: SkillSource = 'downloadUrl' in skill ? 'remote' : 'local';
    await installMutation.mutateAsync({
      skillId: skill.id,
      cliType,
      source,
      downloadUrl: 'downloadUrl' in skill ? skill.downloadUrl : undefined,
    });
  };

  const handleUninstall = async (skill: RemoteSkill | LocalSkill, cliType: CliType) => {
    const installedInfo = installedMap.get(skill.id);
    if (installedInfo) {
      await uninstallMutation.mutateAsync({
        skillId: installedInfo.id,
        cliType,
      });
    }
  };

  const handleViewDetails = () => {
    toast.info(formatMessage({ id: 'skillHub.details.comingSoon' }));
  };

  const handleRefresh = () => {
    refetchAll();
    toast.success(formatMessage({ id: 'skillHub.refresh.success' }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {formatMessage({ id: 'skillHub.title' })}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatMessage({ id: 'skillHub.description' })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'skillHub.actions.refresh' })}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4">
        <StatsCards
          remoteTotal={stats.data?.remoteTotal || 0}
          localTotal={stats.data?.localTotal || 0}
          installedTotal={stats.data?.installedTotal || 0}
          updatesAvailable={stats.data?.updatesAvailable || 0}
          isLoading={isLoading}
        />
      </div>

      {/* Error state */}
      {isError && (
        <div className="px-6 pb-4">
          <Card className="flex items-center gap-2 p-4 text-destructive bg-destructive/10">
            <RefreshCw className="w-5 h-5" />
            <span>{formatMessage({ id: 'skillHub.error.loadFailed' })}</span>
          </Card>
        </div>
      )}

      {/* Tabs and filters */}
      <div className="px-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList>
              <TabsTrigger value="remote" className="gap-1.5">
                <Globe className="w-4 h-4" />
                {formatMessage({ id: 'skillHub.tabs.remote' })}
                {remote.data?.total ? (
                  <Badge variant="secondary" className="ml-1">
                    {remote.data.total}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="local" className="gap-1.5">
                <Folder className="w-4 h-4" />
                {formatMessage({ id: 'skillHub.tabs.local' })}
                {local.data?.total ? (
                  <Badge variant="secondary" className="ml-1">
                    {local.data.total}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="installed" className="gap-1.5">
                <Download className="w-4 h-4" />
                {formatMessage({ id: 'skillHub.tabs.installed' })}
                {installed.data?.total ? (
                  <Badge variant="secondary" className="ml-1">
                    {installed.data.total}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={formatMessage({ id: 'skillHub.search.placeholder' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>

            {/* Category filter */}
            {categories.length > 0 && activeTab !== 'installed' && (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={categoryFilter || ''}
                  onChange={(e) => setCategoryFilter(e.target.value || null)}
                  className="pl-9 pr-4 py-2 text-sm bg-background border rounded-md appearance-none cursor-pointer"
                >
                  <option value="">{formatMessage({ id: 'skillHub.filter.allCategories' })}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <EmptyState type={activeTab} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => {
              const source: SkillSource = activeTab === 'remote' ? 'remote' : 'local';
              const installedInfo = installedMap.get(skill.id);
              // For installed tab, get source from the installed skill info
              const skillSource: SkillSource = activeTab === 'installed'
                ? ('source' in skill ? (skill as InstalledSkill).source : source)
                : source;

              return (
                <SkillHubCard
                  key={skill.id}
                  skill={skill as RemoteSkill | LocalSkill}
                  installedInfo={installedInfo}
                  source={skillSource}
                  onInstall={handleInstall}
                  onUninstall={handleUninstall}
                  onViewDetails={handleViewDetails}
                  isInstalling={installMutation.isPending}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SkillHubPage;
