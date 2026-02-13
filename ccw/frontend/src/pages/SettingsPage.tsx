// ========================================
// Settings Page
// ========================================
// Application settings and configuration with CLI tools management

import { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Settings,
  Moon,
  Bell,
  Cpu,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Languages,
  Plus,
  MessageSquareText,
  Monitor,
  Terminal,
  AlertTriangle,
  Package,
  Home,
  Folder,
  FolderOpen,
  Calendar,
  File,
  ArrowUpCircle,
  Save,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ThemeSelector } from '@/components/shared/ThemeSelector';
import { useTheme } from '@/hooks';
import { toast } from 'sonner';
import { useConfigStore, selectCliTools, selectDefaultCliTool, selectUserPreferences } from '@/stores/configStore';
import type { CliToolConfig, UserPreferences } from '@/types/store';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import {
  useChineseResponseStatus,
  useToggleChineseResponse,
  useWindowsPlatformStatus,
  useToggleWindowsPlatform,
  useCodexCliEnhancementStatus,
  useToggleCodexCliEnhancement,
  useRefreshCodexCliEnhancement,
  useCcwInstallStatus,
  useCliToolStatus,
  useCcwInstallations,
  useUpgradeCcwInstallation,
} from '@/hooks/useSystemSettings';

// ========== File Path Input with Native File Picker ==========

interface FilePathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function FilePathInput({ value, onChange, placeholder }: FilePathInputProps) {
  const handleBrowse = async () => {
    const { selectFile } = await import('@/lib/nativeDialog');
    const initialDir = value ? value.replace(/[/\\][^/\\]*$/, '') : undefined;
    const selected = await selectFile(initialDir);
    if (selected) {
      onChange(selected);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 h-9"
        onClick={handleBrowse}
        title="Browse"
      >
        <FolderOpen className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ========== Tool Config File Helpers ==========

/** Tools that use .env file for environment variables */
const ENV_FILE_TOOLS = new Set(['gemini', 'qwen', 'opencode']);
/** Tools that use --settings for Claude CLI settings file */
const SETTINGS_FILE_TOOLS = new Set(['claude']);
function getConfigFileType(toolId: string): 'envFile' | 'settingsFile' | 'none' {
  if (ENV_FILE_TOOLS.has(toolId)) return 'envFile';
  if (SETTINGS_FILE_TOOLS.has(toolId)) return 'settingsFile';
  return 'none';
}

// ========== CLI Tool Card Component ==========

interface CliToolCardProps {
  toolId: string;
  config: CliToolConfig;
  isDefault: boolean;
  isExpanded: boolean;
  toolAvailable?: boolean;
  isSaving?: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onSetDefault: () => void;
  onUpdateModel: (field: 'primaryModel' | 'secondaryModel', value: string) => void;
  onUpdateTags: (tags: string[]) => void;
  onUpdateAvailableModels: (models: string[]) => void;
  onUpdateEnvFile: (envFile: string | undefined) => void;
  onUpdateSettingsFile: (settingsFile: string | undefined) => void;
  onSaveToBackend: () => void;
}

function CliToolCard({
  toolId,
  config,
  isDefault,
  isExpanded,
  toolAvailable,
  isSaving,
  onToggleExpand,
  onToggleEnabled,
  onSetDefault,
  onUpdateModel,
  onUpdateTags,
  onUpdateAvailableModels,
  onUpdateEnvFile,
  onUpdateSettingsFile,
  onSaveToBackend,
}: CliToolCardProps) {
  const { formatMessage } = useIntl();

  // Local state for tag and model input
  const [tagInput, setTagInput] = useState('');
  const [modelInput, setModelInput] = useState('');

  // Handler for adding tags
  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !config.tags.includes(newTag)) {
      onUpdateTags([...config.tags, newTag]);
      setTagInput('');
    }
  };

  // Handler for removing tags
  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(config.tags.filter((t) => t !== tagToRemove));
  };

  // Handler for adding available models
  const handleAddModel = () => {
    const newModel = modelInput.trim();
    const currentModels = config.availableModels || [];
    if (newModel && !currentModels.includes(newModel)) {
      onUpdateAvailableModels([...currentModels, newModel]);
      setModelInput('');
    }
  };

  // Handler for removing available models
  const handleRemoveModel = (modelToRemove: string) => {
    const currentModels = config.availableModels || [];
    onUpdateAvailableModels(currentModels.filter((m) => m !== modelToRemove));
  };

  // Predefined tags
  const predefinedTags = ['分析', 'Debug', 'implementation', 'refactoring', 'testing'];

  const configFileType = getConfigFileType(toolId);

  return (
    <Card className={cn('overflow-hidden', !config.enabled && 'opacity-60')}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              config.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Cpu className={cn(
                'w-5 h-5',
                config.enabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground capitalize">
                  {toolId}
                </span>
                {isDefault && (
                  <Badge variant="default" className="text-xs">{formatMessage({ id: 'settings.cliTools.default' })}</Badge>
                )}
                <Badge variant="outline" className="text-xs">{config.type}</Badge>
                {toolAvailable !== undefined && (
                  <span className={cn(
                    'inline-block w-2 h-2 rounded-full',
                    toolAvailable ? 'bg-green-500' : 'bg-red-400'
                  )} title={toolAvailable ? 'Available' : 'Unavailable'} />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {config.primaryModel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={config.enabled ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation();
                onToggleEnabled();
              }}
            >
              {config.enabled ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  {formatMessage({ id: 'settings.cliTools.enabled' })}
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-1" />
                  {formatMessage({ id: 'settings.cliTools.disabled' })}
                </>
              )}
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Tags */}
        {config.tags && config.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {config.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'settings.cliTools.primaryModel' })}</label>
              <Input
                value={config.primaryModel}
                onChange={(e) => onUpdateModel('primaryModel', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'settings.cliTools.secondaryModel' })}</label>
              <Input
                value={config.secondaryModel}
                onChange={(e) => onUpdateModel('secondaryModel', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.tags' })}
            </label>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.tagsDescription' })}
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-wrap gap-1.5 p-2 border border-input bg-background rounded-md min-h-[38px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {config.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs h-6"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive transition-colors"
                      aria-label={formatMessage({ id: 'apiSettings.cliSettings.removeTag' })}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={config.tags.length === 0 ? formatMessage({ id: 'apiSettings.cliSettings.tagInputPlaceholder' }) : ''}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddTag}
                variant="outline"
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {/* Predefined Tags */}
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.predefinedTags' })}:
              </span>
              {predefinedTags.map((predefinedTag) => (
                <button
                  key={predefinedTag}
                  type="button"
                  onClick={() => {
                    if (!config.tags.includes(predefinedTag)) {
                      onUpdateTags([...config.tags, predefinedTag]);
                    }
                  }}
                  disabled={config.tags.includes(predefinedTag)}
                  className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {predefinedTag}
                </button>
              ))}
            </div>
          </div>

          {/* Available Models Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.availableModels' })}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex flex-wrap gap-1.5 p-2 border border-input bg-background rounded-md min-h-[38px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                {(config.availableModels || []).map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs h-6"
                  >
                    {model}
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(model)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModel();
                    }
                  }}
                  placeholder={(config.availableModels || []).length === 0 ? formatMessage({ id: 'apiSettings.cliSettings.availableModelsPlaceholder' }) : ''}
                  className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddModel}
                variant="outline"
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'apiSettings.cliSettings.availableModelsHint' })}
            </p>
          </div>

          {/* Env File - for gemini/qwen/opencode */}
          {configFileType === 'envFile' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'settings.cliTools.envFile' })}
              </label>
              <FilePathInput
                value={config.envFile || ''}
                onChange={(v) => onUpdateEnvFile(v || undefined)}
                placeholder={formatMessage({ id: 'settings.cliTools.envFilePlaceholder' })}
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'settings.cliTools.envFileHint' })}
              </p>
            </div>
          )}

          {/* Settings File - for claude only */}
          {configFileType === 'settingsFile' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.settingsFile' })}
              </label>
              <FilePathInput
                value={config.settingsFile || ''}
                onChange={(v) => onUpdateSettingsFile(v || undefined)}
                placeholder={formatMessage({ id: 'apiSettings.cliSettings.settingsFilePlaceholder' })}
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.settingsFileHint' })}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isDefault && config.enabled && (
              <Button variant="outline" size="sm" onClick={onSetDefault}>
                {formatMessage({ id: 'settings.cliTools.setDefault' })}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={onSaveToBackend}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-1" />
              {isSaving
                ? formatMessage({ id: 'settings.cliTools.saving' })
                : formatMessage({ id: 'settings.cliTools.saveToConfig' })}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ========== Response Language Section ==========

function ResponseLanguageSection() {
  const { formatMessage } = useIntl();
  const { data: chineseStatus, isLoading: chineseLoading } = useChineseResponseStatus();
  const { toggle: toggleChinese, isPending: chineseToggling } = useToggleChineseResponse();
  const { data: windowsStatus, isLoading: windowsLoading } = useWindowsPlatformStatus();
  const { toggle: toggleWindows, isPending: windowsToggling } = useToggleWindowsPlatform();
  const { data: cliEnhStatus, isLoading: cliEnhLoading } = useCodexCliEnhancementStatus();
  const { toggle: toggleCliEnh, isPending: cliEnhToggling } = useToggleCodexCliEnhancement();
  const { refresh: refreshCliEnh, isPending: refreshing } = useRefreshCodexCliEnhancement();

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <MessageSquareText className="w-5 h-5" />
        {formatMessage({ id: 'settings.sections.responseLanguage' })}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Chinese Response - Claude */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatMessage({ id: 'settings.responseLanguage.chineseClaude' })}</span>
              <Badge variant="default" className="text-xs">Claude</Badge>
            </div>
            <Button
              variant={chineseStatus?.claudeEnabled ? 'default' : 'outline'}
              size="sm"
              className="h-7"
              disabled={chineseLoading || chineseToggling}
              onClick={() => toggleChinese(!chineseStatus?.claudeEnabled, 'claude')}
            >
              {chineseStatus?.claudeEnabled
                ? formatMessage({ id: 'settings.responseLanguage.enabled' })
                : formatMessage({ id: 'settings.responseLanguage.disabled' })}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'settings.responseLanguage.chineseClaudeDesc' })}
          </p>
        </div>

        {/* Chinese Response - Codex */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatMessage({ id: 'settings.responseLanguage.chineseCodex' })}</span>
              <Badge variant="secondary" className="text-xs">Codex</Badge>
            </div>
            <Button
              variant={chineseStatus?.codexEnabled ? 'default' : 'outline'}
              size="sm"
              className="h-7"
              disabled={chineseLoading || chineseToggling}
              onClick={() => toggleChinese(!chineseStatus?.codexEnabled, 'codex')}
            >
              {chineseStatus?.codexEnabled
                ? formatMessage({ id: 'settings.responseLanguage.enabled' })
                : formatMessage({ id: 'settings.responseLanguage.disabled' })}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'settings.responseLanguage.chineseCodexDesc' })}
          </p>
          {chineseStatus?.codexNeedsMigration && (
            <p className="text-xs text-yellow-500">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              {formatMessage({ id: 'settings.responseLanguage.migrationWarning' })}
            </p>
          )}
        </div>

        {/* Windows Platform */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{formatMessage({ id: 'settings.responseLanguage.windowsPlatform' })}</span>
            </div>
            <Button
              variant={windowsStatus?.enabled ? 'default' : 'outline'}
              size="sm"
              className="h-7"
              disabled={windowsLoading || windowsToggling}
              onClick={() => toggleWindows(!windowsStatus?.enabled)}
            >
              {windowsStatus?.enabled
                ? formatMessage({ id: 'settings.responseLanguage.enabled' })
                : formatMessage({ id: 'settings.responseLanguage.disabled' })}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'settings.responseLanguage.windowsPlatformDesc' })}
          </p>
        </div>

        {/* CLI Enhancement - Codex */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{formatMessage({ id: 'settings.responseLanguage.cliEnhancement' })}</span>
              <Badge variant="secondary" className="text-xs">Codex</Badge>
            </div>
            <div className="flex items-center gap-1">
              {cliEnhStatus?.enabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={cliEnhLoading || refreshing}
                  onClick={() => refreshCliEnh()}
                  title={formatMessage({ id: 'settings.responseLanguage.refreshConfig' })}
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                </Button>
              )}
              <Button
                variant={cliEnhStatus?.enabled ? 'default' : 'outline'}
                size="sm"
                className="h-7"
                disabled={cliEnhLoading || cliEnhToggling}
                onClick={() => toggleCliEnh(!cliEnhStatus?.enabled)}
              >
                {cliEnhStatus?.enabled
                  ? formatMessage({ id: 'settings.responseLanguage.enabled' })
                  : formatMessage({ id: 'settings.responseLanguage.disabled' })}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'settings.responseLanguage.cliEnhancementDesc' })}
          </p>
          {cliEnhStatus?.enabled && (
            <p className="text-xs text-muted-foreground/70">
              {formatMessage({ id: 'settings.responseLanguage.cliEnhancementHint' })}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ========== Version Check Section ==========

interface VersionData {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  packageName: string;
  updateCommand: string;
  checkedAt: string;
}

function VersionCheckSection() {
  const { formatMessage } = useIntl();
  const [versionData, setVersionData] = useState<VersionData | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoCheck, setAutoCheck] = useState(() => {
    try {
      const saved = localStorage.getItem('ccw.autoUpdate');
      return saved === null ? true : JSON.parse(saved);
    } catch {
      return true;
    }
  });

  const checkVersion = async (silent = false) => {
    if (!silent) setChecking(true);
    setError(null);
    try {
      const response = await fetch('/api/version-check');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: VersionData = await response.json();
      if (!data.currentVersion) throw new Error('Invalid response');

      setVersionData(data);
      setLastChecked(new Date());
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkVersion(true);

    if (!autoCheck) return;
    const interval = setInterval(() => checkVersion(true), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoCheck]);

  const toggleAutoCheck = (enabled: boolean) => {
    setAutoCheck(enabled);
    localStorage.setItem('ccw.autoUpdate', JSON.stringify(enabled));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ArrowUpCircle className="w-5 h-5" />
          {formatMessage({ id: 'settings.versionCheck.title' })}
        </h2>
        <Button
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={() => checkVersion()}
        >
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', checking && 'animate-spin')} />
          {checking
            ? formatMessage({ id: 'settings.versionCheck.checking' })
            : formatMessage({ id: 'settings.versionCheck.checkNow' })}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Version info */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'settings.versionCheck.currentVersion' })}
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              {versionData?.currentVersion ?? '...'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'settings.versionCheck.latestVersion' })}
            </span>
            <Badge
              variant={versionData?.hasUpdate ? 'default' : 'secondary'}
              className="font-mono text-xs"
            >
              {versionData?.latestVersion ?? '...'}
            </Badge>
          </div>

          {/* Status */}
          {versionData && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm font-medium">
                {versionData.hasUpdate
                  ? formatMessage({ id: 'settings.versionCheck.updateAvailable' })
                  : formatMessage({ id: 'settings.versionCheck.upToDate' })}
              </span>
              <span className={cn(
                'inline-block w-2.5 h-2.5 rounded-full',
                versionData.hasUpdate ? 'bg-orange-500' : 'bg-green-500'
              )} />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive">
                {formatMessage({ id: 'settings.versionCheck.checkFailed' })}: {error}
              </span>
            </div>
          )}
        </div>

        {/* Update action */}
        {versionData?.hasUpdate && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                {formatMessage({ id: 'settings.versionCheck.updateCommand' })}
              </p>
              <code className="text-xs font-mono bg-muted px-3 py-1.5 rounded block">
                {versionData.updateCommand}
              </code>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://github.com/dyw0830/ccw/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                {formatMessage({ id: 'settings.versionCheck.viewRelease' })}
              </a>
            </Button>
          </div>
        )}

        {/* Auto check toggle + last checked */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => toggleAutoCheck(e.target.checked)}
              className="rounded border-input"
            />
            <div>
              <span className="text-sm font-medium">{formatMessage({ id: 'settings.versionCheck.autoCheck' })}</span>
              <p className="text-xs text-muted-foreground">{formatMessage({ id: 'settings.versionCheck.autoCheckDesc' })}</p>
            </div>
          </label>
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'settings.versionCheck.lastChecked' })}:{' '}
            {lastChecked ? lastChecked.toLocaleTimeString() : formatMessage({ id: 'settings.versionCheck.never' })}
          </span>
        </div>
      </div>
    </Card>
  );
}

// ========== System Status Section ==========

function SystemStatusSection() {
  const { formatMessage } = useIntl();
  const { installations, isLoading, refetch } = useCcwInstallations();
  const { upgrade, isPending: upgrading } = useUpgradeCcwInstallation();
  const { data: ccwInstall } = useCcwInstallStatus();

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Package className="w-5 h-5" />
          {formatMessage({ id: 'settings.systemStatus.title' })}
          {!isLoading && (
            <span className="text-sm font-normal text-muted-foreground">
              {installations.length} {formatMessage({ id: 'settings.systemStatus.installations' })}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => refetch()}
            title={formatMessage({ id: 'settings.systemStatus.refresh' })}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Installation cards */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          {formatMessage({ id: 'settings.systemStatus.checking' })}
        </div>
      ) : installations.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'settings.systemStatus.noInstallations' })}
          </p>
          <div className="bg-muted/50 rounded-md p-3 inline-block">
            <code className="text-xs font-mono">ccw install</code>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {installations.map((inst) => {
            const isGlobal = inst.installation_mode === 'Global';
            const installDate = new Date(inst.installation_date).toLocaleDateString();
            const version = inst.application_version !== 'unknown' ? inst.application_version : inst.installer_version;

            return (
              <div
                key={inst.manifest_id}
                className="rounded-lg border border-border p-4 space-y-2"
              >
                {/* Mode + Version + Upgrade */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center justify-center w-8 h-8 rounded-lg',
                      isGlobal ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-500'
                    )}>
                      {isGlobal ? <Home className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                    </span>
                    <span className="text-sm font-medium">
                      {isGlobal
                        ? formatMessage({ id: 'settings.systemStatus.global' })
                        : formatMessage({ id: 'settings.systemStatus.path' })}
                    </span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      v{version}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={upgrading}
                    onClick={() => upgrade(inst.installation_path)}
                  >
                    <ArrowUpCircle className={cn('w-3.5 h-3.5 mr-1', upgrading && 'animate-spin')} />
                    {upgrading
                      ? formatMessage({ id: 'settings.systemStatus.upgrading' })
                      : formatMessage({ id: 'settings.systemStatus.upgrade' })}
                  </Button>
                </div>

                {/* Path */}
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono truncate" title={inst.installation_path}>
                  {inst.installation_path}
                </div>

                {/* Date + Files */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {installDate}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <File className="w-3 h-3" />
                    {inst.files_count} {formatMessage({ id: 'settings.systemStatus.files' })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Missing files warning */}
          {ccwInstall && !ccwInstall.installed && ccwInstall.missingFiles.length > 0 && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-500">
                <AlertTriangle className="w-4 h-4" />
                {formatMessage({ id: 'settings.systemStatus.incomplete' })} &mdash; {ccwInstall.missingFiles.length} {formatMessage({ id: 'settings.systemStatus.missingFiles' }).toLowerCase()}
              </div>
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {ccwInstall.missingFiles.slice(0, 4).map((f) => (
                  <li key={f}>{f}</li>
                ))}
                {ccwInstall.missingFiles.length > 4 && (
                  <li>+{ccwInstall.missingFiles.length - 4} more...</li>
                )}
              </ul>
              <div className="bg-muted/50 rounded-md p-2">
                <p className="text-xs font-medium mb-1">{formatMessage({ id: 'settings.systemStatus.runToFix' })}:</p>
                <code className="text-xs font-mono bg-background px-2 py-1 rounded block">ccw install</code>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ========== CLI Tools with Status Enhancement ==========

interface CliToolsWithStatusProps {
  cliTools: Record<string, CliToolConfig>;
  defaultCliTool: string;
  expandedTools: Set<string>;
  savingTools: Set<string>;
  onToggleExpand: (toolId: string) => void;
  onToggleEnabled: (toolId: string) => void;
  onSetDefault: (toolId: string) => void;
  onUpdateModel: (toolId: string, field: 'primaryModel' | 'secondaryModel', value: string) => void;
  onUpdateTags: (toolId: string, tags: string[]) => void;
  onUpdateAvailableModels: (toolId: string, models: string[]) => void;
  onUpdateEnvFile: (toolId: string, envFile: string | undefined) => void;
  onUpdateSettingsFile: (toolId: string, settingsFile: string | undefined) => void;
  onSaveToBackend: (toolId: string) => void;
  formatMessage: ReturnType<typeof useIntl>['formatMessage'];
}

function CliToolsWithStatus({
  cliTools,
  defaultCliTool,
  expandedTools,
  savingTools,
  onToggleExpand,
  onToggleEnabled,
  onSetDefault,
  onUpdateModel,
  onUpdateTags,
  onUpdateAvailableModels,
  onUpdateEnvFile,
  onUpdateSettingsFile,
  onSaveToBackend,
  formatMessage,
}: CliToolsWithStatusProps) {
  const { data: toolStatus } = useCliToolStatus();

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        {formatMessage({ id: 'settings.cliTools.description' })} <strong className="text-foreground">{defaultCliTool}</strong>
      </p>
      <div className="space-y-3">
        {Object.entries(cliTools).map(([toolId, config]) => {
          const status = toolStatus?.[toolId];
          return (
            <CliToolCard
              key={toolId}
              toolId={toolId}
              config={config}
              isDefault={toolId === defaultCliTool}
              isExpanded={expandedTools.has(toolId)}
              toolAvailable={status?.available}
              isSaving={savingTools.has(toolId)}
              onToggleExpand={() => onToggleExpand(toolId)}
              onToggleEnabled={() => onToggleEnabled(toolId)}
              onSetDefault={() => onSetDefault(toolId)}
              onUpdateModel={(field, value) => onUpdateModel(toolId, field, value)}
              onUpdateTags={(tags) => onUpdateTags(toolId, tags)}
              onUpdateAvailableModels={(models) => onUpdateAvailableModels(toolId, models)}
              onUpdateEnvFile={(envFile) => onUpdateEnvFile(toolId, envFile)}
              onUpdateSettingsFile={(settingsFile) => onUpdateSettingsFile(toolId, settingsFile)}
              onSaveToBackend={() => onSaveToBackend(toolId)}
            />
          );
        })}
      </div>
    </>
  );
}

// ========== Main Page Component ==========

export function SettingsPage() {
  const { formatMessage } = useIntl();
  const { theme, setTheme } = useTheme();
  const cliTools = useConfigStore(selectCliTools);
  const defaultCliTool = useConfigStore(selectDefaultCliTool);
  const userPreferences = useConfigStore(selectUserPreferences);
  const { updateCliTool, setDefaultCliTool, setUserPreferences, resetUserPreferences } = useConfigStore();

  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [savingTools, setSavingTools] = useState<Set<string>>(new Set());

  const toggleToolExpand = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleToggleToolEnabled = (toolId: string) => {
    updateCliTool(toolId, { enabled: !cliTools[toolId].enabled });
  };

  const handleSetDefaultTool = (toolId: string) => {
    setDefaultCliTool(toolId);
  };

  const handleUpdateModel = (toolId: string, field: 'primaryModel' | 'secondaryModel', value: string) => {
    updateCliTool(toolId, { [field]: value });
  };

  const handleUpdateTags = (toolId: string, tags: string[]) => {
    updateCliTool(toolId, { tags });
  };

  const handleUpdateAvailableModels = (toolId: string, availableModels: string[]) => {
    updateCliTool(toolId, { availableModels });
  };

  const handleUpdateEnvFile = (toolId: string, envFile: string | undefined) => {
    updateCliTool(toolId, { envFile });
  };

  const handleUpdateSettingsFile = (toolId: string, settingsFile: string | undefined) => {
    updateCliTool(toolId, { settingsFile });
  };

  // Save tool config to backend (~/.claude/cli-tools.json)
  const handleSaveToBackend = useCallback(async (toolId: string) => {
    const config = cliTools[toolId];
    if (!config) return;

    setSavingTools((prev) => new Set(prev).add(toolId));
    try {
      const body: Record<string, unknown> = {
        enabled: config.enabled,
        primaryModel: config.primaryModel,
        secondaryModel: config.secondaryModel,
        tags: config.tags,
        availableModels: config.availableModels,
      };

      // Only include the relevant config file field
      const configFileType = getConfigFileType(toolId);
      if (configFileType === 'envFile') {
        body.envFile = config.envFile || null;
      } else if (configFileType === 'settingsFile') {
        body.settingsFile = config.settingsFile || null;
      }

      const res = await fetch(`/api/cli/config/${toolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      toast.success(formatMessage({ id: 'settings.cliTools.configSaved' }), {
        description: toolId,
      });
    } catch {
      toast.error(formatMessage({ id: 'settings.cliTools.configSaveError' }), {
        description: toolId,
      });
    } finally {
      setSavingTools((prev) => {
        const next = new Set(prev);
        next.delete(toolId);
        return next;
      });
    }
  }, [cliTools, formatMessage]);

  const handlePreferenceChange = (key: keyof UserPreferences, value: unknown) => {
    setUserPreferences({ [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          {formatMessage({ id: 'settings.title' })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatMessage({ id: 'settings.description' })}
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Moon className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.appearance' })}
        </h2>
        <div className="space-y-6">
          {/* Multi-Theme Selector */}
          <div>
            <p className="font-medium text-foreground mb-1">
              {formatMessage({ id: 'settings.appearance.theme' })}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {formatMessage({ id: 'settings.appearance.description' })}
            </p>
            <ThemeSelector />
          </div>

          {/* System Theme Toggle (Backward Compatibility) */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.appearance.systemFollow' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.appearance.systemFollowDesc' })}
              </p>
            </div>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('system')}
            >
              {formatMessage({ id: 'settings.appearance.themeOptions.system' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Language Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Languages className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.language' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.language.displayLanguage' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.language.chooseLanguage' })}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </Card>

      {/* Response Language Settings */}
      <ResponseLanguageSection />

      {/* System Status */}
      <SystemStatusSection />

      {/* Version Check */}
      <VersionCheckSection />

      {/* CLI Tools Configuration */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5" />
          {formatMessage({ id: 'settings.sections.cliTools' })}
        </h2>
        <CliToolsWithStatus
          cliTools={cliTools}
          defaultCliTool={defaultCliTool}
          expandedTools={expandedTools}
          savingTools={savingTools}
          onToggleExpand={toggleToolExpand}
          onToggleEnabled={handleToggleToolEnabled}
          onSetDefault={handleSetDefaultTool}
          onUpdateModel={handleUpdateModel}
          onUpdateTags={handleUpdateTags}
          onUpdateAvailableModels={handleUpdateAvailableModels}
          onUpdateEnvFile={handleUpdateEnvFile}
          onUpdateSettingsFile={handleUpdateSettingsFile}
          onSaveToBackend={handleSaveToBackend}
          formatMessage={formatMessage}
        />
      </Card>

      {/* Data Refresh Settings */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5" />
          {formatMessage({ id: 'settings.dataRefresh.title' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.dataRefresh.autoRefresh' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.dataRefresh.autoRefreshDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('autoRefresh', !userPreferences.autoRefresh)}
            >
              {userPreferences.autoRefresh ? formatMessage({ id: 'settings.dataRefresh.enabled' }) : formatMessage({ id: 'settings.dataRefresh.disabled' })}
            </Button>
          </div>

          {userPreferences.autoRefresh && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{formatMessage({ id: 'settings.dataRefresh.refreshInterval' })}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMessage({ id: 'settings.dataRefresh.refreshIntervalDesc' })}
                </p>
              </div>
              <div className="flex gap-2">
                {[15000, 30000, 60000, 120000].map((interval) => (
                  <Button
                    key={interval}
                    variant={userPreferences.refreshInterval === interval ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePreferenceChange('refreshInterval', interval)}
                  >
                    {interval / 1000}s
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5" />
          {formatMessage({ id: 'settings.notifications.title' })}
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.notifications.enableNotifications' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.notifications.enableNotificationsDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.notificationsEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('notificationsEnabled', !userPreferences.notificationsEnabled)}
            >
              {userPreferences.notificationsEnabled ? formatMessage({ id: 'settings.dataRefresh.enabled' }) : formatMessage({ id: 'settings.dataRefresh.disabled' })}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{formatMessage({ id: 'settings.notifications.soundEffects' })}</p>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'settings.notifications.soundEffectsDesc' })}
              </p>
            </div>
            <Button
              variant={userPreferences.soundEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePreferenceChange('soundEnabled', !userPreferences.soundEnabled)}
            >
              {userPreferences.soundEnabled ? formatMessage({ id: 'settings.notifications.on' }) : formatMessage({ id: 'settings.notifications.off' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Reset Settings */}
      <Card className="p-6 border-destructive/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <RotateCcw className="w-5 h-5" />
          {formatMessage({ id: 'common.actions.reset' })}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'settings.reset.description' })}
        </p>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm(formatMessage({ id: 'settings.reset.confirm' }))) {
              resetUserPreferences();
            }
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'common.actions.resetToDefaults' })}
        </Button>
      </Card>
    </div>
  );
}

export default SettingsPage;
