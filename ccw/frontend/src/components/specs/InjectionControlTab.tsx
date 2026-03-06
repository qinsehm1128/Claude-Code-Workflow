// ========================================
// InjectionControlTab Component
// ========================================
// Tab for managing spec injection control settings

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import {
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Plug,
  Download,
  CheckCircle2,
  Settings,
  FileText,
  Eye,
  Globe,
  Folder,
  ChevronDown,
  ChevronRight,
  Layers,
  Filter,
} from 'lucide-react';
import { useInstallRecommendedHooks, useSystemSettings } from '@/hooks/useSystemSettings';
import type { InjectionPreviewFile, InjectionPreviewResponse } from '@/lib/api';
import { getInjectionPreview, COMMAND_PREVIEWS, type CommandPreviewConfig } from '@/lib/api';

// ========== Types ==========

export interface InjectionStats {
  requiredOnly: number;
  withKeywords: number;
  maxLength: number;
  percentage: number;
}

export interface SpecStatsResponse {
  dimensions: {
    specs: { count: number; requiredCount: number };
    personal: { count: number; requiredCount: number };
  };
  injectionLength: InjectionStats;
}

export interface InjectionSettings {
  maxLength: number;
  warnThreshold: number;
  truncateOnExceed: boolean;
}

export interface SystemSettingsResponse {
  injectionControl: InjectionSettings;
  personalSpecDefaults: {
    defaultReadMode: 'required' | 'optional';
    autoEnable: boolean;
  };
}

export interface InjectionControlTabProps {
  className?: string;
}

// ========== Category Configuration ==========

type SpecCategory = 'general' | 'exploration' | 'planning' | 'execution';

const SPEC_CATEGORIES: SpecCategory[] = ['general', 'exploration', 'planning', 'execution'];

const CATEGORY_CONFIG: Record<SpecCategory, { color: string; bgColor: string }> = {
  general: { color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  exploration: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  planning: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  execution: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
};

// ========== Recommended Hooks Configuration ==========

const RECOMMENDED_HOOKS = [
  {
    id: 'spec-injection-session',
    name: 'Spec Context Injection (Session)',
    event: 'SessionStart',
    command: 'ccw spec load --stdin',
    scope: 'global' as const,
    description: 'Automatically inject spec context when Claude session starts',
  },
  {
    id: 'spec-injection-prompt',
    name: 'Spec Context Injection (Prompt)',
    event: 'UserPromptSubmit',
    command: 'ccw spec load --stdin',
    scope: 'project' as const,
    description: 'Inject spec context when user submits a prompt, matching keywords',
  },
];

// ========== API Functions ==========

async function fetchSpecStats(): Promise<SpecStatsResponse> {
  const response = await fetch('/api/specs/stats');
  if (!response.ok) {
    throw new Error('Failed to fetch spec stats');
  }
  return response.json();
}

async function fetchSystemSettings(): Promise<SystemSettingsResponse> {
  const response = await fetch('/api/system/settings');
  if (!response.ok) {
    throw new Error('Failed to fetch system settings');
  }
  return response.json();
}

async function updateInjectionSettings(
  settings: Partial<InjectionSettings>
): Promise<SystemSettingsResponse> {
  const currentSettings = await fetchSystemSettings();
  const response = await fetch('/api/system/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      injectionControl: {
        ...currentSettings.injectionControl,
        ...settings,
      },
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to update settings');
  }
  return response.json();
}

// ========== Helper Functions ==========

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function calculatePercentage(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, (current / max) * 100);
}

// ========== Component ==========

export function InjectionControlTab({ className }: InjectionControlTabProps) {
  const { formatMessage } = useIntl();
  const installHooksMutation = useInstallRecommendedHooks();

  // State for stats
  const [stats, setStats] = useState<SpecStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<Error | null>(null);

  // State for settings
  const [settings, setSettings] = useState<InjectionSettings>({
    maxLength: 8000,
    warnThreshold: 6000,
    truncateOnExceed: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Form state (for local editing before save)
  const [formData, setFormData] = useState<InjectionSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State for hooks installation
  const [installingHookIds, setInstallingHookIds] = useState<string[]>([]);

  // Fetch system settings (for hooks installation status)
  const systemSettingsQuery = useSystemSettings();

  // State for injection preview
  const [previewMode, setPreviewMode] = useState<'required' | 'all'>('required');
  const [categoryFilter, setCategoryFilter] = useState<SpecCategory | 'all'>('all');
  const [previewData, setPreviewData] = useState<InjectionPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedDimensions, setExpandedDimensions] = useState<Record<string, boolean>>({
    specs: true,
    personal: true,
  });
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<InjectionPreviewFile | null>(null);

  // State for command preview
  const [selectedCommand, setSelectedCommand] = useState<CommandPreviewConfig>(COMMAND_PREVIEWS[0]);
  const [commandPreviewData, setCommandPreviewData] = useState<InjectionPreviewResponse | null>(null);
  const [commandPreviewLoading, setCommandPreviewLoading] = useState(false);
  const [commandPreviewDialogOpen, setCommandPreviewDialogOpen] = useState(false);

  // Fetch stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await fetchSpecStats();
      setStats(data);
    } catch (err) {
      setStatsError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch settings
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await fetchSystemSettings();
      setSettings(data.injectionControl);
      setFormData(data.injectionControl);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Load injection preview
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const data = await getInjectionPreview(previewMode, false);
      setPreviewData(data);
    } catch (err) {
      console.error('Failed to load injection preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [previewMode]);

  // Load file content for preview
  const loadFilePreview = useCallback(async (file: InjectionPreviewFile) => {
    try {
      const data = await getInjectionPreview(previewMode, true);
      const fileWithData = data.files.find(f => f.file === file.file);
      if (fileWithData) {
        setPreviewFile(fileWithData);
        setPreviewDialogOpen(true);
      }
    } catch (err) {
      console.error('Failed to load file preview:', err);
    }
  }, [previewMode]);

  // Load command preview content
  const loadCommandPreview = useCallback(async (command: CommandPreviewConfig) => {
    setCommandPreviewLoading(true);
    try {
      const data = await getInjectionPreview(command.mode, true, undefined, command.category);
      setCommandPreviewData(data);
      setSelectedCommand(command);
      setCommandPreviewDialogOpen(true);
    } catch (err) {
      console.error('Failed to load command preview:', err);
    } finally {
      setCommandPreviewLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadStats();
    loadSettings();
  }, [loadStats, loadSettings]);

  // Load preview when mode changes
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Check for changes
  useEffect(() => {
    const changed =
      formData.maxLength !== settings.maxLength ||
      formData.warnThreshold !== settings.warnThreshold ||
      formData.truncateOnExceed !== settings.truncateOnExceed;
    setHasChanges(changed);
  }, [formData, settings]);

  // Handle form field changes
  const handleFieldChange = <K extends keyof InjectionSettings>(
    field: K,
    value: InjectionSettings[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateInjectionSettings(formData);
      setSettings(result.injectionControl);
      setFormData(result.injectionControl);
      setHasChanges(false);
      toast.success(
        formatMessage({ id: 'specs.injection.saveSuccess' }, { default: 'Settings saved successfully' })
      );
    } catch (err) {
      toast.error(
        formatMessage({ id: 'specs.injection.saveError' }, { default: 'Failed to save settings' })
      );
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFormData(settings);
    setHasChanges(false);
  };

  // Toggle dimension expansion
  const toggleDimension = (dim: string) => {
    setExpandedDimensions(prev => ({ ...prev, [dim]: !prev[dim] }));
  };

  // ========== Hooks Installation ==========

  const installedHookIds = useMemo(() => {
    const installed = new Set<string>();
    const hooks = systemSettingsQuery.data?.recommendedHooks;
    if (hooks) {
      hooks.forEach(hook => {
        if (hook.installed) {
          installed.add(hook.id);
        }
      });
    }
    return installed;
  }, [systemSettingsQuery.data?.recommendedHooks]);

  const installedCount = installedHookIds.size;
  const allHooksInstalled = installedCount === RECOMMENDED_HOOKS.length;

  const handleInstallHook = useCallback(async (hookId: string) => {
    setInstallingHookIds(prev => [...prev, hookId]);
    try {
      await installHooksMutation.installHooks([hookId], 'global');
      toast.success(
        formatMessage({ id: 'specs.hooks.installSuccess', defaultMessage: 'Hook installed successfully' })
      );
    } catch (err) {
      toast.error(
        formatMessage({ id: 'specs.hooks.installError', defaultMessage: 'Failed to install hook' })
      );
      console.error('Failed to install hook:', err);
    } finally {
      setInstallingHookIds(prev => prev.filter(id => id !== hookId));
    }
  }, [installHooksMutation, formatMessage]);

  const handleInstallAllHooks = useCallback(async () => {
    const uninstalledHooks = RECOMMENDED_HOOKS.filter(h => !installedHookIds.has(h.id));
    if (uninstalledHooks.length === 0) return;

    setInstallingHookIds(uninstalledHooks.map(h => h.id));
    try {
      await installHooksMutation.installHooks(
        uninstalledHooks.map(h => h.id),
        'global'
      );
      toast.success(
        formatMessage({ id: 'specs.hooks.installAllSuccess', defaultMessage: 'All hooks installed successfully' })
      );
    } catch (err) {
      toast.error(
        formatMessage({ id: 'specs.hooks.installError', defaultMessage: 'Failed to install hooks' })
      );
      console.error('Failed to install hooks:', err);
    } finally {
      setInstallingHookIds([]);
    }
  }, [installedHookIds, installHooksMutation, formatMessage]);

  // Group files by dimension and filter by category
  const filesByDimension = useMemo(() => {
    if (!previewData) return {};
    const grouped: Record<string, InjectionPreviewFile[]> = {};
    for (const file of previewData.files) {
      // Apply category filter
      if (categoryFilter !== 'all' && file.category !== categoryFilter) {
        continue;
      }
      if (!grouped[file.dimension]) {
        grouped[file.dimension] = [];
      }
      grouped[file.dimension].push(file);
    }
    return grouped;
  }, [previewData, categoryFilter]);

  // Calculate category statistics
  const categoryStats = useMemo(() => {
    if (!previewData) {
      return { general: 0, exploration: 0, planning: 0, execution: 0 };
    }
    const stats: Record<SpecCategory, number> = { general: 0, exploration: 0, planning: 0, execution: 0 };
    for (const file of previewData.files) {
      const cat = (file.category as SpecCategory) || 'general';
      if (stats[cat] !== undefined) {
        stats[cat]++;
      }
    }
    return stats;
  }, [previewData]);

  // Calculate progress and status - use API's maxLength for consistency
  const currentLength = stats?.injectionLength?.withKeywords || 0;
  const apiMaxLength = stats?.injectionLength?.maxLength || settings.maxLength;
  const maxLength = apiMaxLength;  // Use API's maxLength for consistency
  const warnThreshold = settings.warnThreshold;
  const percentage = calculatePercentage(currentLength, maxLength);
  const isOverLimit = currentLength > maxLength;
  const isOverWarning = currentLength > warnThreshold;
  const remainingSpace = Math.max(0, maxLength - currentLength);

  // Calculate approximate line count (assuming ~80 chars per line)
  const estimatedLineCount = Math.ceil(currentLength / 80);
  const maxLineCount = Math.ceil(maxLength / 80);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Recommended Hooks Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            {formatMessage({ id: 'specs.recommendedHooks', defaultMessage: 'Recommended Hooks' })}
          </CardTitle>
          <CardDescription>
            {formatMessage({
              id: 'specs.recommendedHooksDesc',
              defaultMessage: 'One-click install spec injection hooks for automatic context loading',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleInstallAllHooks}
                disabled={allHooksInstalled || installingHookIds.length > 0}
              >
                {allHooksInstalled ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {formatMessage({ id: 'specs.allHooksInstalled', defaultMessage: 'All Hooks Installed' })}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {formatMessage({ id: 'specs.installAllHooks', defaultMessage: 'Install All Hooks' })}
                  </>
                )}
              </Button>
              <div className="text-sm text-muted-foreground">
                {installedCount} / {RECOMMENDED_HOOKS.length}{' '}
                {formatMessage({ id: 'specs.hooksInstalled', defaultMessage: 'installed' })}
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/hooks">
                <Settings className="h-4 w-4 mr-1" />
                {formatMessage({ id: 'specs.manageHooks', defaultMessage: 'Manage Hooks' })}
              </Link>
            </Button>
          </div>

          <div className="grid gap-3">
            {RECOMMENDED_HOOKS.map(hook => {
              const isInstalled = installedHookIds.has(hook.id);
              const isInstalling = installingHookIds.includes(hook.id);

              return (
                <div
                  key={hook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{hook.name}</span>
                      {isInstalled && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {hook.description}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {formatMessage({ id: 'specs.hookEvent', defaultMessage: 'Event' })}:{' '}
                        <code className="bg-muted px-1 rounded">{hook.event}</code>
                      </span>
                      <span>
                        {formatMessage({ id: 'specs.hookScope', defaultMessage: 'Scope' })}:{' '}
                        <code className="bg-muted px-1 rounded">{hook.scope}</code>
                      </span>
                    </div>
                  </div>
                  <Button
                    variant={isInstalled ? 'outline' : 'default'}
                    size="sm"
                    disabled={isInstalled || isInstalling}
                    onClick={() => handleInstallHook(hook.id)}
                  >
                    {isInstalling
                      ? formatMessage({ id: 'specs.installing', defaultMessage: 'Installing...' })
                      : isInstalled
                        ? formatMessage({ id: 'specs.installed', defaultMessage: 'Installed' })
                        : formatMessage({ id: 'specs.install', defaultMessage: 'Install' })}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Injection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {formatMessage(
              { id: 'specs.injection.statusTitle', defaultMessage: 'Current Injection Status' }
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { loadStats(); loadPreview(); }}
              disabled={statsLoading}
            >
              <RefreshCw className={cn('h-4 w-4', statsLoading && 'animate-spin')} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : statsError ? (
            <div className="text-sm text-destructive">
              {formatMessage(
                { id: 'specs.injection.loadError', defaultMessage: 'Failed to load stats' }
              )}
            </div>
          ) : (
            <>
              {/* Current Length Display */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'specs.injection.currentLength', defaultMessage: 'Current Length' })}
                </span>
                <span
                  className={cn(
                    'font-medium',
                    isOverLimit && 'text-destructive',
                    !isOverLimit && isOverWarning && 'text-yellow-600 dark:text-yellow-400'
                  )}
                >
                  {formatNumber(currentLength)} / {formatNumber(maxLength)}{' '}
                  {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                  <span className="text-muted-foreground ml-2">
                    (~{formatNumber(estimatedLineCount)} / {formatNumber(maxLineCount)} {formatMessage({ id: 'specs.injection.lines', defaultMessage: 'lines' })})
                  </span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{percentage}%</span>
                  <span>{formatMessage({ id: 'specs.injection.maxLimit', defaultMessage: 'Max' })}: {formatNumber(maxLength)}</span>
                </div>
                <div className="relative">
                  <Progress
                    value={percentage}
                    className={cn(
                      'h-3',
                      isOverLimit && 'bg-destructive/20',
                      !isOverLimit && isOverWarning && 'bg-yellow-100 dark:bg-yellow-900/30'
                    )}
                    indicatorClassName={cn(
                      // Default: use a distinct blue color
                      !isOverLimit && !isOverWarning && 'bg-sky-500 dark:bg-sky-400',
                      isOverLimit && 'bg-destructive',
                      !isOverLimit && isOverWarning && 'bg-yellow-500'
                    )}
                  />
                  {/* Warning threshold marker */}
                  <div
                    className="absolute top-0 h-3 flex flex-col items-center"
                    style={{
                      left: `${Math.min(100, (warnThreshold / maxLength) * 100)}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <AlertTriangle className="h-3 w-3 text-yellow-500 -mt-4" />
                  </div>
                </div>
              </div>

              {/* Warning Alert when over limit */}
              {isOverLimit && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-destructive">
                      {formatMessage({ id: 'specs.injection.overLimit', defaultMessage: 'Over Limit' })}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatMessage(
                        {
                          id: 'specs.injection.overLimitDescription',
                          defaultMessage: 'Current injection content exceeds maximum length of {max} characters. Excess content will be truncated.',
                        },
                        { max: formatNumber(maxLength) }
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics Info */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {formatMessage({ id: 'specs.injection.statsInfo', defaultMessage: 'Statistics' })}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.requiredLength', defaultMessage: 'Required specs length:' })}
                  </div>
                  <div className="text-right">
                    {formatNumber(stats?.injectionLength?.requiredOnly || 0)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                  </div>
                  <div className="text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.matchedLength', defaultMessage: 'Keyword-matched length:' })}
                  </div>
                  <div className="text-right">
                    {formatNumber(stats?.injectionLength?.withKeywords || 0)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                  </div>
                  <div className="text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.remaining', defaultMessage: 'Remaining space:' })}
                  </div>
                  <div className={cn('text-right', remainingSpace === 0 && 'text-destructive')}>
                    {formatNumber(remainingSpace)} ({Math.round(100 - percentage)}%)
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Injection Files List Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {formatMessage({ id: 'specs.injection.filesList', defaultMessage: 'Injection Files' })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={previewMode === 'required' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('required')}
              >
                {formatMessage({ id: 'specs.readMode.required', defaultMessage: 'Required' })}
              </Button>
              <Button
                variant={previewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('all')}
              >
                {formatMessage({ id: 'specs.scope.all', defaultMessage: 'All' })}
              </Button>
            </div>
          </div>
          <CardDescription>
            {previewData && (
              <span>
                {previewData.stats.count} {formatMessage({ id: 'specs.injection.files', defaultMessage: 'files' })} • {formatNumber(previewData.stats.totalLength)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'specs.filterByCategory', defaultMessage: 'Category:' })}
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
                  className="gap-1"
                >
                  <Layers className="h-3 w-3" />
                  {formatMessage({ id: `specs.category.${cat}`, defaultMessage: cat })} ({categoryStats[cat]})
                </Button>
              ))}
            </div>
          </div>

          {/* Files List */}
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-[300px] overflow-auto">
              <div className="space-y-2">
                {Object.entries(filesByDimension).map(([dim, files]) => (
                  <div key={dim} className="border rounded-lg">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      onClick={() => toggleDimension(dim)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedDimensions[dim] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium capitalize">
                          {formatMessage({ id: `specs.dimension.${dim}`, defaultMessage: dim })}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {files.length}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(files.reduce((sum, f) => sum + f.contentLength, 0))} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                      </span>
                    </button>
                    {expandedDimensions[dim] && (
                      <div className="border-t">
                        {files.map((file) => {
                          const fileCategory = (file.category as SpecCategory) || 'general';
                          const categoryStyle = CATEGORY_CONFIG[fileCategory] || CATEGORY_CONFIG.general;
                          return (
                            <div
                              key={file.file}
                              className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {file.scope === 'global' ? (
                                  <Globe className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                ) : (
                                  <Folder className="h-4 w-4 text-green-500 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{file.title}</div>
                                  <div className="text-xs text-muted-foreground truncate">{file.file}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn('text-xs gap-1', categoryStyle.bgColor, categoryStyle.color)}>
                                  <Layers className="h-3 w-3" />
                                  {formatMessage({ id: `specs.category.${fileCategory}`, defaultMessage: fileCategory })}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {formatMessage({ id: `specs.priority.${file.priority}`, defaultMessage: file.priority })}
                                </Badge>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatNumber(file.contentLength)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => loadFilePreview(file)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Command Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {formatMessage({ id: 'specs.injection.commandPreview', defaultMessage: 'Command Injection Preview' })}
          </CardTitle>
          <CardDescription>
            {formatMessage({
              id: 'specs.injection.commandPreviewDesc',
              defaultMessage: 'Preview the content that would be injected by different CLI commands',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {COMMAND_PREVIEWS.map((cmd) => (
              <Button
                key={cmd.command}
                variant="outline"
                className="h-auto flex-col items-start py-3 px-4"
                onClick={() => loadCommandPreview(cmd)}
                disabled={commandPreviewLoading}
              >
                <div className="font-medium text-sm">
                  {formatMessage({
                    id: `specs.commandPreview.${cmd.labelKey}.label`,
                    defaultMessage: cmd.labelKey
                  })}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {formatMessage({
                    id: `specs.commandPreview.${cmd.descriptionKey}.description`,
                    defaultMessage: cmd.descriptionKey
                  })}
                </div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded mt-2 w-full text-center">
                  {cmd.command.replace('ccw spec load', '').trim() || 'default'}
                </code>
              </Button>
            ))}
          </div>
          {commandPreviewLoading && (
            <div className="flex items-center justify-center py-4 mt-4 border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">
                {formatMessage({ id: 'specs.injection.loadingPreview', defaultMessage: 'Loading preview...' })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {formatMessage({ id: 'specs.injection.settingsTitle', defaultMessage: 'Injection Control Settings' })}
          </CardTitle>
          <CardDescription>
            {formatMessage({
              id: 'specs.injection.settingsDescription',
              defaultMessage: 'Configure how spec content is injected into AI context.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Max Injection Length */}
              <div className="space-y-2">
                <Label htmlFor="maxLength">
                  {formatMessage({ id: 'specs.injection.maxLength', defaultMessage: 'Max Injection Length' })}
                </Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="maxLength"
                      type="number"
                      min={1000}
                      max={50000}
                      step={500}
                      value={formData.maxLength}
                      onChange={(e) => handleFieldChange('maxLength', Number(e.target.value))}
                      className={cn(maxLengthError && 'border-destructive')}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    (~{Math.ceil(formData.maxLength / 80)} {formatMessage({ id: 'specs.injection.lines', defaultMessage: 'lines' })})
                  </span>
                </div>
                {maxLengthError && <p className="text-xs text-destructive mt-1">{maxLengthError}</p>}
                <p className="text-sm text-muted-foreground">
                  {formatMessage({
                    id: 'specs.injection.maxLengthHelp',
                    defaultMessage: 'Recommended: 4000-10000 characters (50-125 lines). Too large may consume too much context.',
                  })}
                </p>
                {/* Quick presets */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'specs.injection.quickPresets', defaultMessage: 'Quick presets:' })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleFieldChange('maxLength', 4000)}
                  >
                    4000 (50 lines)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleFieldChange('maxLength', 8000)}
                  >
                    8000 (100 lines)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleFieldChange('maxLength', 12000)}
                  >
                    12000 (150 lines)
                  </Button>
                </div>
              </div>

              {/* Warning Threshold */}
              <div className="space-y-2">
                <Label htmlFor="warnThreshold">
                  {formatMessage({ id: 'specs.injection.warnThresholdLabel', defaultMessage: 'Warning Threshold' })}
                </Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="warnThreshold"
                      type="number"
                      min={500}
                      max={formData.maxLength - 1}
                      step={500}
                      value={formData.warnThreshold}
                      onChange={(e) => handleFieldChange('warnThreshold', Number(e.target.value))}
                      className={cn(warnThresholdError && 'border-destructive')}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    (~{Math.ceil(formData.warnThreshold / 80)} {formatMessage({ id: 'specs.injection.lines', defaultMessage: 'lines' })})
                  </span>
                </div>
                {warnThresholdError && <p className="text-xs text-destructive mt-1">{warnThresholdError}</p>}
                <p className="text-sm text-muted-foreground">
                  {formatMessage({
                    id: 'specs.injection.warnThresholdHelp',
                    defaultMessage: 'A warning will be displayed when injection length exceeds this value.',
                  })}
                </p>
              </div>

              {/* Truncate on Exceed */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="truncate">
                    {formatMessage({ id: 'specs.injection.truncateOnExceed', defaultMessage: 'Truncate on Exceed' })}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({
                      id: 'specs.injection.truncateHelp',
                      defaultMessage: 'Automatically truncate content when it exceeds the maximum length.',
                    })}
                  </p>
                </div>
                <Switch
                  id="truncate"
                  checked={formData.truncateOnExceed}
                  onCheckedChange={(checked) => handleFieldChange('truncateOnExceed', checked)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasChanges || isSaving}
                >
                  {formatMessage({ id: 'common.actions.reset', defaultMessage: 'Reset' })}
                </Button>
                <Button onClick={handleSave} disabled={!hasChanges || isSaving || !!maxLengthError || !!warnThresholdError}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {formatMessage({ id: 'common.actions.saving', defaultMessage: 'Saving...' })}
                    </>
                  ) : (
                    formatMessage({ id: 'common.actions.save', defaultMessage: 'Save' })
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* File Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewFile?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="text-sm whitespace-pre-wrap p-4 bg-muted rounded-lg">
              {previewFile?.content || formatMessage({ id: 'specs.content.noContent', defaultMessage: 'No content available' })}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Command Preview Dialog */}
      <Dialog open={commandPreviewDialogOpen} onOpenChange={setCommandPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {formatMessage({ id: 'specs.injection.previewTitle', defaultMessage: 'Injection Preview' })}
            </DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <code className="bg-muted px-2 py-1 rounded text-xs">{selectedCommand.command}</code>
              <span>•</span>
              <span>
                {formatMessage({
                  id: `specs.commandPreview.${selectedCommand.descriptionKey}.description`,
                  defaultMessage: selectedCommand.descriptionKey
                })}
              </span>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {/* Stats */}
            {commandPreviewData && (
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary">
                  {commandPreviewData.stats.count} {formatMessage({ id: 'specs.injection.files', defaultMessage: 'files' })}
                </Badge>
                <Badge variant="secondary">
                  {formatNumber(commandPreviewData.stats.totalLength)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                </Badge>
                <Badge variant="secondary">
                  ~{Math.ceil(commandPreviewData.stats.totalLength / 80)} {formatMessage({ id: 'specs.injection.lines', defaultMessage: 'lines' })}
                </Badge>
              </div>
            )}
            {/* Preview Content */}
            <div className="flex-1 overflow-auto max-h-[60vh] border rounded-lg">
              {commandPreviewData?.files.length ? (
                <div className="space-y-4 p-4">
                  {commandPreviewData.files.map((file, idx) => (
                    <div key={file.file} className="space-y-2">
                      {/* File Header */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {idx + 1}
                          </Badge>
                          <span className="font-medium">{file.title}</span>
                          {file.category && (
                            <Badge variant="outline" className={cn(
                              'text-xs',
                              CATEGORY_CONFIG[file.category as SpecCategory]?.bgColor,
                              CATEGORY_CONFIG[file.category as SpecCategory]?.color
                            )}>
                              {file.category}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(file.contentLength)} {formatMessage({ id: 'specs.injection.characters', defaultMessage: 'characters' })}
                        </span>
                      </div>
                      {/* File Content */}
                      <pre className="text-xs whitespace-pre-wrap p-3 bg-muted rounded border-l-2 border-primary/30">
                        {file.content || formatMessage({ id: 'specs.content.noContent', defaultMessage: 'No content available' })}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  {formatMessage({ id: 'specs.injection.noFiles', defaultMessage: 'No files match this command' })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InjectionControlTab;
