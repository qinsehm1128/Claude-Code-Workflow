/**
 * Specs Settings Page
 *
 * Main page for managing spec settings, injection control, and global settings.
 * Uses 4 tabs: Project Specs | Personal Specs | Injection | Settings
 * Supports category filtering (workflow stage) and scope filtering (personal only)
 */
import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollText, User, Gauge, Settings, RefreshCw, Search, Globe, Folder, Filter, Layers } from 'lucide-react';
import { SpecCard, SpecDialog, SpecContentDialog, type Spec, type SpecFormData, type SpecCategory } from '@/components/specs';
import { InjectionControlTab } from '@/components/specs/InjectionControlTab';
import { GlobalSettingsTab } from '@/components/specs/GlobalSettingsTab';
import { useSpecStats, useSpecsList, useRebuildSpecIndex } from '@/hooks/useSystemSettings';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import type { SpecEntry } from '@/lib/api';

type SettingsTab = 'project-specs' | 'personal-specs' | 'injection' | 'settings';
type PersonalScopeFilter = 'all' | 'global' | 'project';
type CategoryFilter = 'all' | SpecCategory;

// All available categories
const SPEC_CATEGORIES: SpecCategory[] = ['general', 'exploration', 'planning', 'execution'];

// Convert SpecEntry to Spec for display
function specEntryToSpec(entry: SpecEntry, dimension: string): Spec {
  return {
    id: entry.file,
    title: entry.title,
    dimension: dimension as Spec['dimension'],
    scope: entry.scope || 'project', // Default to project if not specified
    category: entry.category || 'general', // Default to general if not specified
    keywords: entry.keywords,
    readMode: entry.readMode as Spec['readMode'],
    priority: entry.priority as Spec['priority'],
    file: entry.file,
    enabled: true,
  };
}

export function SpecsSettingsPage() {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);
  const [activeTab, setActiveTab] = useState<SettingsTab>('project-specs');
  const [searchQuery, setSearchQuery] = useState('');
  const [personalScopeFilter, setPersonalScopeFilter] = useState<PersonalScopeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Spec | null>(null);
  const [viewingSpec, setViewingSpec] = useState<Spec | null>(null);

  // Fetch real data
  const { data: specsListData, isLoading: specsLoading, refetch: refetchSpecs } = useSpecsList({ projectPath });
  const { data: statsData } = useSpecStats({ projectPath });
  const rebuildMutation = useRebuildSpecIndex();

  // Convert specs data to display format
  const { projectSpecs, personalSpecs, globalPersonalSpecs, projectPersonalSpecs, categoryCounts } = useMemo(() => {
    if (!specsListData?.specs) {
      return {
        projectSpecs: [],
        personalSpecs: [],
        globalPersonalSpecs: [],
        projectPersonalSpecs: [],
        categoryCounts: { general: 0, exploration: 0, planning: 0, execution: 0 }
      };
    }

    const specs: Spec[] = [];
    const personal: Spec[] = [];
    const globalPersonal: Spec[] = [];
    const projectPersonal: Spec[] = [];
    const counts: Record<SpecCategory, number> = { general: 0, exploration: 0, planning: 0, execution: 0 };

    for (const [dimension, entries] of Object.entries(specsListData.specs)) {
      for (const entry of entries) {
        const spec = specEntryToSpec(entry, dimension);
        // Count by category
        if (spec.category) {
          counts[spec.category]++;
        }
        if (dimension === 'personal') {
          personal.push(spec);
          if (spec.scope === 'global') {
            globalPersonal.push(spec);
          } else {
            projectPersonal.push(spec);
          }
        } else {
          specs.push(spec);
        }
      }
    }

    return {
      projectSpecs: specs,
      personalSpecs: personal,
      globalPersonalSpecs: globalPersonal,
      projectPersonalSpecs: projectPersonal,
      categoryCounts: counts
    };
  }, [specsListData]);

  const isLoading = specsLoading;

  const handleSpecView = (spec: Spec) => {
    setViewingSpec(spec);
    setContentDialogOpen(true);
  };

  const handleSpecEdit = (spec: Spec) => {
    setEditingSpec(spec);
    setEditDialogOpen(true);
  };

  const handleSpecSave = async (specId: string, data: SpecFormData) => {
    console.log('Saving spec:', specId, data);
    // TODO: Implement save logic
    setEditDialogOpen(false);
  };

  const handleContentSave = async (specId: string, content: string) => {
    console.log('Saving spec content:', specId, content.length);
    // TODO: Implement content save logic
  };

  const handleSpecToggle = async (specId: string, enabled: boolean) => {
    console.log('Toggling spec:', specId, enabled);
    // TODO: Implement toggle logic
  };

  const handleSpecDelete = async (specId: string) => {
    console.log('Deleting spec:', specId);
    // TODO: Implement delete logic
  };

  const handleRebuildIndex = async () => {
    console.log('Rebuilding index...');
    rebuildMutation.mutate(undefined, {
      onSuccess: () => {
        refetchSpecs();
      }
    });
  };

  const filterSpecs = (specs: Spec[]) => {
    let result = specs;
    // Filter by category
    if (categoryFilter !== 'all') {
      result = result.filter(spec => spec.category === categoryFilter);
    }
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(spec =>
        spec.title.toLowerCase().includes(query) ||
        spec.keywords.some(k => k.toLowerCase().includes(query))
      );
    }
    return result;
  };

  const renderSpecsTab = (dimension: 'project' | 'personal') => {
    let specs = dimension === 'project' ? projectSpecs : personalSpecs;

    // Apply scope filter for personal specs
    if (dimension === 'personal') {
      if (personalScopeFilter === 'global') {
        specs = globalPersonalSpecs;
      } else if (personalScopeFilter === 'project') {
        specs = projectPersonalSpecs;
      }
    }

    const filteredSpecs = filterSpecs(specs);

    return (
      <div className="space-y-4">
        {/* Search and Actions */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={formatMessage({ id: 'specs.searchPlaceholder', defaultMessage: 'Search specs...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleRebuildIndex} disabled={rebuildMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${rebuildMutation.isPending ? 'animate-spin' : ''}`} />
            {formatMessage({ id: 'specs.rebuildIndex', defaultMessage: 'Rebuild Index' })}
          </Button>
        </div>

        {/* Scope filter for personal specs */}
        {dimension === 'personal' && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'specs.filterByScope', defaultMessage: 'Filter by scope:' })}
            </span>
            <div className="flex gap-2">
              <Button
                variant={personalScopeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPersonalScopeFilter('all')}
              >
                {formatMessage({ id: 'specs.scope.all', defaultMessage: 'All' })} ({personalSpecs.length})
              </Button>
              <Button
                variant={personalScopeFilter === 'global' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPersonalScopeFilter('global')}
              >
                <Globe className="h-3 w-3 mr-1" />
                {formatMessage({ id: 'specs.scope.global', defaultMessage: 'Global' })} ({globalPersonalSpecs.length})
              </Button>
              <Button
                variant={personalScopeFilter === 'project' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPersonalScopeFilter('project')}
              >
                <Folder className="h-3 w-3 mr-1" />
                {formatMessage({ id: 'specs.scope.project', defaultMessage: 'Project' })} ({projectPersonalSpecs.length})
              </Button>
            </div>
          </div>
        )}

        {/* Category filter for workflow stage */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {formatMessage({ id: 'specs.filterByCategory', defaultMessage: 'Workflow stage:' })}
          </span>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('all')}
            >
              {formatMessage({ id: 'specs.category.all', defaultMessage: 'All' })}
            </Button>
            {SPEC_CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
              >
                {formatMessage({ id: `specs.category.${cat}`, defaultMessage: cat })} ({categoryCounts[cat]})
              </Button>
            ))}
          </div>
        </div>

        {/* Stats Summary - Only show specs and personal dimensions */}
        {statsData?.dimensions && (
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(statsData.dimensions)
              .filter(([dim]) => dim === 'specs' || dim === 'personal')
              .map(([dim, data]) => (
              <Card key={dim}>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">
                    {formatMessage({ id: `specs.dimension.${dim}`, defaultMessage: dim })}
                  </div>
                  <div className="text-2xl font-bold">{(data as { count: number }).count}</div>
                  <div className="text-xs text-muted-foreground">
                    {(data as { requiredCount: number }).requiredCount} {formatMessage({ id: 'specs.required', defaultMessage: 'required' })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Specs Grid */}
        {filteredSpecs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {isLoading
                ? formatMessage({ id: 'specs.loading', defaultMessage: 'Loading specs...' })
                : formatMessage({ id: 'specs.noSpecs', defaultMessage: 'No specs found. Create specs in .ccw/ directory.' })
              }
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSpecs.map(spec => (
              <SpecCard
                key={spec.id}
                spec={spec}
                onView={handleSpecView}
                onEdit={handleSpecEdit}
                onToggle={handleSpecToggle}
                onDelete={handleSpecDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          {formatMessage({ id: 'specs.pageTitle', defaultMessage: 'Spec Settings' })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatMessage({ id: 'specs.pageDescription', defaultMessage: 'Manage specification injection and system settings' })}
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="project-specs" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabProjectSpecs', defaultMessage: 'Project Specs' })}</span>
          </TabsTrigger>
          <TabsTrigger value="personal-specs" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabPersonalSpecs', defaultMessage: 'Personal' })}</span>
          </TabsTrigger>
          <TabsTrigger value="injection" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabInjection', defaultMessage: 'Injection' })}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabSettings', defaultMessage: 'Settings' })}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="project-specs">
          {renderSpecsTab('project')}
        </TabsContent>

        <TabsContent value="personal-specs">
          {renderSpecsTab('personal')}
        </TabsContent>

        <TabsContent value="injection">
          <InjectionControlTab />
        </TabsContent>

        <TabsContent value="settings">
          <GlobalSettingsTab />
        </TabsContent>
      </Tabs>

      {/* Edit Spec Dialog */}
      <SpecDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        spec={editingSpec}
        onSave={handleSpecSave}
      />

      {/* View/Edit Spec Content Dialog */}
      <SpecContentDialog
        open={contentDialogOpen}
        onOpenChange={setContentDialogOpen}
        spec={viewingSpec}
        onSave={handleContentSave}
      />
    </div>
  );
}

export default SpecsSettingsPage;
