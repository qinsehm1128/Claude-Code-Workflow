// ========================================
// GlobalSettingsTab Component
// ========================================
// Global settings for personal spec defaults and spec statistics

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Settings, RefreshCw, History } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';

// ========== Types ==========

interface PersonalSpecDefaults {
  defaultReadMode: 'required' | 'optional';
  autoEnable: boolean;
}

interface DevProgressInjection {
  enabled: boolean;
  maxEntriesPerCategory: number;
  categories: ('feature' | 'enhancement' | 'bugfix' | 'refactor' | 'docs')[];
}

interface SystemSettings {
  injectionControl: {
    maxLength: number;
    warnThreshold: number;
    truncateOnExceed: boolean;
  };
  personalSpecDefaults: PersonalSpecDefaults;
  devProgressInjection: DevProgressInjection;
}

interface SpecDimensionStats {
  count: number;
  requiredCount: number;
}

interface SpecStats {
  dimensions: {
    specs: SpecDimensionStats;
    personal: SpecDimensionStats;
  };
  injectionLength?: {
    requiredOnly: number;
    withKeywords: number;
    maxLength: number;
    percentage: number;
  };
}

interface ProjectTechStats {
  total_features: number;
  total_sessions: number;
  last_updated: string | null;
  categories: {
    feature: number;
    enhancement: number;
    bugfix: number;
    refactor: number;
    docs: number;
  };
}

// ========== API Functions ==========

const API_BASE = '/api';

async function fetchSystemSettings(): Promise<SystemSettings> {
  const response = await fetch(`${API_BASE}/system/settings`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

async function updateSystemSettings(
  settings: Partial<SystemSettings>
): Promise<{ success: boolean; settings: SystemSettings }> {
  const response = await fetch(`${API_BASE}/system/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error(`Failed to update settings: ${response.statusText}`);
  }
  return response.json();
}

async function fetchSpecStats(): Promise<SpecStats> {
  const response = await fetch(`${API_BASE}/specs/stats`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch spec stats: ${response.statusText}`);
  }
  return response.json();
}

async function fetchProjectTechStats(): Promise<ProjectTechStats> {
  const response = await fetch(`${API_BASE}/project-tech/stats`, {
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch project-tech stats: ${response.statusText}`);
  }
  return response.json();
}

// ========== Query Keys ==========

const settingsKeys = {
  all: ['system-settings'] as const,
  settings: () => [...settingsKeys.all, 'settings'] as const,
  stats: () => [...settingsKeys.all, 'stats'] as const,
  projectTech: () => [...settingsKeys.all, 'project-tech'] as const,
};

// ========== Component ==========

export function GlobalSettingsTab() {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();

  // Local state for immediate UI feedback
  const [localDefaults, setLocalDefaults] = useState<PersonalSpecDefaults>({
    defaultReadMode: 'optional',
    autoEnable: true,
  });

  // Local state for dev progress injection
  const [localDevProgress, setLocalDevProgress] = useState<DevProgressInjection>({
    enabled: true,
    maxEntriesPerCategory: 10,
    categories: ['feature', 'enhancement', 'bugfix', 'refactor', 'docs'],
  });

  // Fetch system settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: settingsKeys.settings(),
    queryFn: fetchSystemSettings,
    staleTime: 60000, // 1 minute
  });

  // Fetch spec stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: settingsKeys.stats(),
    queryFn: fetchSpecStats,
    staleTime: 30000, // 30 seconds
  });

  // Fetch project-tech stats
  const { data: projectTechStats } = useQuery({
    queryKey: settingsKeys.projectTech(),
    queryFn: fetchProjectTechStats,
    staleTime: 60000, // 1 minute
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.settings(), data.settings);
      toast.success(formatMessage({ id: 'specs.injection.saveSuccess', defaultMessage: 'Settings saved successfully' }));
    },
    onError: (error) => {
      toast.error(formatMessage(
        { id: 'specs.injection.saveError', defaultMessage: 'Failed to save settings: {error}' },
        { error: error.message }
      ));
    },
  });

  // Sync local state with server state
  useEffect(() => {
    if (settings?.personalSpecDefaults) {
      setLocalDefaults(settings.personalSpecDefaults);
    }
    if (settings?.devProgressInjection) {
      setLocalDevProgress(settings.devProgressInjection);
    }
  }, [settings]);

  // Handlers
  const handleReadModeChange = (value: 'required' | 'optional') => {
    const newDefaults = { ...localDefaults, defaultReadMode: value };
    setLocalDefaults(newDefaults);
    updateMutation.mutate({ personalSpecDefaults: newDefaults });
  };

  const handleAutoEnableChange = (checked: boolean) => {
    const newDefaults = { ...localDefaults, autoEnable: checked };
    setLocalDefaults(newDefaults);
    updateMutation.mutate({ personalSpecDefaults: newDefaults });
  };

  // Dev progress injection handlers
  const handleDevProgressToggle = (checked: boolean) => {
    const newDevProgress = { ...localDevProgress, enabled: checked };
    setLocalDevProgress(newDevProgress);
    updateMutation.mutate({ devProgressInjection: newDevProgress });
  };

  const handleMaxEntriesChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 50) {
      const newDevProgress = { ...localDevProgress, maxEntriesPerCategory: numValue };
      setLocalDevProgress(newDevProgress);
      updateMutation.mutate({ devProgressInjection: newDevProgress });
    }
  };

  const handleCategoryToggle = (category: 'feature' | 'enhancement' | 'bugfix' | 'refactor' | 'docs') => {
    const newCategories = localDevProgress.categories.includes(category)
      ? localDevProgress.categories.filter(c => c !== category)
      : [...localDevProgress.categories, category];
    const newDevProgress = { ...localDevProgress, categories: newCategories as DevProgressInjection['categories'] };
    setLocalDevProgress(newDevProgress);
    updateMutation.mutate({ devProgressInjection: newDevProgress });
  };

  // Calculate totals - Only include specs and personal dimensions
  const dimensions = stats?.dimensions || {};
  const dimensionEntries = Object.entries(dimensions)
    .filter(([dim]) => dim === 'specs' || dim === 'personal') as [
    keyof typeof dimensions,
    SpecDimensionStats
  ][];
  const totalCount = dimensionEntries.reduce(
    (sum, [, data]) => sum + data.count,
    0
  );
  const totalRequired = dimensionEntries.reduce(
    (sum, [, data]) => sum + data.requiredCount,
    0
  );

  const isLoading = isLoadingSettings || isLoadingStats;
  const hasError = settingsError || statsError;

  return (
    <div className="space-y-6">
      {/* Personal Spec Defaults Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle>
              {formatMessage({ id: 'specs.settings.personalSpecDefaults', defaultMessage: 'Personal Spec Defaults' })}
            </CardTitle>
          </div>
          <CardDescription>
            {formatMessage({ id: 'specs.settings.personalSpecDefaultsDesc', defaultMessage: 'These settings will be applied when creating new personal specs' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Read Mode */}
          <div className="space-y-2">
            <Label htmlFor="default-read-mode">
              {formatMessage({ id: 'specs.settings.defaultReadMode', defaultMessage: 'Default Read Mode' })}
            </Label>
            <Select
              value={localDefaults.defaultReadMode}
              onValueChange={(value) =>
                handleReadModeChange(value as 'required' | 'optional')
              }
            >
              <SelectTrigger id="default-read-mode" className="w-full">
                <SelectValue placeholder={formatMessage({ id: 'specs.settings.selectReadMode', defaultMessage: 'Select read mode' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">
                  {formatMessage({ id: 'specs.readMode.required', defaultMessage: 'Required' })}
                </SelectItem>
                <SelectItem value="optional">
                  {formatMessage({ id: 'specs.readMode.optional', defaultMessage: 'Optional' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'specs.settings.defaultReadModeHelp', defaultMessage: 'The default read mode for newly created personal specs' })}
            </p>
          </div>

          {/* Auto Enable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-enable">
                {formatMessage({ id: 'specs.settings.autoEnable', defaultMessage: 'Auto Enable New Specs' })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'specs.settings.autoEnableDescription', defaultMessage: 'Automatically enable newly created personal specs' })}
              </p>
            </div>
            <Switch
              id="auto-enable"
              checked={localDefaults.autoEnable}
              onCheckedChange={handleAutoEnableChange}
              disabled={updateMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Spec Statistics Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {formatMessage({ id: 'specs.settings.specStatistics', defaultMessage: 'Spec Statistics' })}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchStats()}
              disabled={isLoadingStats}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  isLoadingStats && 'animate-spin'
                )}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="text-center p-4 rounded-lg bg-muted animate-pulse"
                >
                  <div className="h-8 w-12 mx-auto bg-muted-foreground/20 rounded mb-2" />
                  <div className="h-4 w-16 mx-auto bg-muted-foreground/20 rounded" />
                </div>
              ))}
            </div>
          ) : hasError ? (
            <div className="text-center py-8 text-muted-foreground">
              {formatMessage({ id: 'specs.injection.loadError', defaultMessage: 'Failed to load statistics' })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                {dimensionEntries
                  .filter(([entry]) => entry[0] === 'specs' || entry[1] === 'personal')
                  .map(([dim, data]) => (
                  <div
                    key={dim}
                    className="text-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="text-2xl font-bold text-foreground">
                      {data.count}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatMessage({ id: `specs.dimension.${dim}`, defaultMessage: dim })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {data.requiredCount} {formatMessage({ id: 'specs.required', defaultMessage: 'required' })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {formatMessage(
                      { id: 'specs.settings.totalSpecs', defaultMessage: 'Total: {count} spec files' },
                      { count: totalCount }
                    )}
                  </span>
                  <span>
                    {totalRequired} {formatMessage({ id: 'specs.readMode.required', defaultMessage: 'required' })} | {totalCount - totalRequired}{' '}
                    {formatMessage({ id: 'specs.readMode.optional', defaultMessage: 'optional' })}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Development Progress Injection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle>
              {formatMessage({ id: 'specs.settings.devProgressInjection', defaultMessage: 'Development Progress Injection' })}
            </CardTitle>
          </div>
          <CardDescription>
            {formatMessage({ id: 'specs.settings.devProgressInjectionDesc', defaultMessage: 'Control how development progress from project-tech.json is injected into AI context' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>
                {formatMessage({ id: 'specs.settings.enableDevProgress', defaultMessage: 'Enable Injection' })}
              </Label>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'specs.settings.enableDevProgressDesc', defaultMessage: 'Include development history in AI context' })}
              </p>
            </div>
            <Switch
              checked={localDevProgress.enabled}
              onCheckedChange={handleDevProgressToggle}
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Max Entries */}
          <div className="space-y-2">
            <Label>
              {formatMessage({ id: 'specs.settings.maxEntries', defaultMessage: 'Max Entries per Category' })}
            </Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={localDevProgress.maxEntriesPerCategory}
              onChange={(e) => handleMaxEntriesChange(e.target.value)}
              disabled={updateMutation.isPending || !localDevProgress.enabled}
              className="w-24"
            />
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'specs.settings.maxEntriesDesc', defaultMessage: 'Maximum number of entries to include per category (1-50)' })}
            </p>
          </div>

          {/* Category Toggles */}
          <div className="space-y-2">
            <Label>
              {formatMessage({ id: 'specs.settings.includeCategories', defaultMessage: 'Include Categories' })}
            </Label>
            <div className="flex flex-wrap gap-2">
              {(['feature', 'enhancement', 'bugfix', 'refactor', 'docs'] as const).map(cat => (
                <Badge
                  key={cat}
                  variant={localDevProgress.categories.includes(cat) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    !localDevProgress.enabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => localDevProgress.enabled && handleCategoryToggle(cat)}
                >
                  {formatMessage({ id: `specs.devCategory.${cat}`, defaultMessage: cat })} ({projectTechStats?.categories[cat] || 0})
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'specs.settings.categoriesDesc', defaultMessage: 'Click to toggle category inclusion' })}
            </p>
          </div>

          {/* Stats Summary */}
          {projectTechStats && (
            <div className="text-sm text-muted-foreground pt-4 border-t border-border">
              {projectTechStats.last_updated ? (
                formatMessage(
                  { id: 'specs.settings.devProgressStats', defaultMessage: '{total} entries from {sessions} sessions, last updated: {date}' },
                  {
                    total: projectTechStats.total_features,
                    sessions: projectTechStats.total_sessions,
                    date: new Date(projectTechStats.last_updated).toLocaleDateString()
                  }
                )
              ) : (
                formatMessage(
                  { id: 'specs.settings.devProgressStatsNoDate', defaultMessage: '{total} entries from {sessions} sessions' },
                  {
                    total: projectTechStats.total_features,
                    sessions: projectTechStats.total_sessions
                  }
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default GlobalSettingsTab;
