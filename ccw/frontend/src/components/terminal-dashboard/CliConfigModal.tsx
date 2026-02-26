// ========================================
// CliConfigModal Component
// ========================================
// Config modal for creating a new CLI session in Terminal Dashboard.

import * as React from 'react';
import { useIntl } from 'react-intl';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { useConfigStore, selectCliTools } from '@/stores/configStore';
import { useCliSettings } from '@/hooks/useApiSettings';

export type CliTool = string;
export type LaunchMode = 'default' | 'yolo';
export type ShellKind = 'bash' | 'pwsh' | 'cmd';

export interface CliSessionConfig {
  tool: CliTool;
  model?: string;
  launchMode: LaunchMode;
  preferredShell: ShellKind;
  workingDir: string;
  /** Session tag for grouping (auto-generated if not provided) */
  tag: string;
  /** CLI Settings endpoint ID for custom API configuration */
  settingsEndpointId?: string;
}

export interface CliConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWorkingDir?: string | null;
  onCreateSession: (config: CliSessionConfig) => Promise<void>;
}

const AUTO_MODEL_VALUE = '__auto__';

/**
 * Generate a tag name: {tool}-{HHmmss}
 * Example: gemini-143052
 */
function generateTag(tool: string): string {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `${tool}-${time}`;
}

export function CliConfigModal({
  isOpen,
  onClose,
  defaultWorkingDir,
  onCreateSession,
}: CliConfigModalProps) {
  const { formatMessage } = useIntl();

  // Dynamic tool data from configStore
  const cliTools = useConfigStore(selectCliTools);
  const enabledTools = React.useMemo(
    () =>
      Object.entries(cliTools)
        .filter(([, config]) => config.enabled)
        .map(([key]) => key),
    [cliTools]
  );

  const [tool, setTool] = React.useState<CliTool>('gemini');
  const [model, setModel] = React.useState<string | undefined>(undefined);
  const [launchMode, setLaunchMode] = React.useState<LaunchMode>('yolo');
  // Default to 'cmd' on Windows for better compatibility with npm CLI tools (.cmd files)
  const [preferredShell, setPreferredShell] = React.useState<ShellKind>(
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('win') ? 'cmd' : 'bash'
  );
  const [workingDir, setWorkingDir] = React.useState<string>(defaultWorkingDir ?? '');
  const [tag, setTag] = React.useState<string>('');

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // CLI Settings integration (for all tools)
  const { cliSettings } = useCliSettings({ enabled: true });

  // Map tool names to provider types for filtering
  const toolProviderMap: Record<string, string> = {
    claude: 'claude',
    codex: 'codex',
    gemini: 'gemini',
  };
  const currentProvider = toolProviderMap[tool] || tool;

  const enabledCliSettings = React.useMemo(
    () => (cliSettings || []).filter((s) => s.enabled && (s.provider || 'claude') === currentProvider),
    [cliSettings, currentProvider]
  );
  const [settingsEndpointId, setSettingsEndpointId] = React.useState<string | undefined>(undefined);

  // Reset settingsEndpointId when tool changes
  React.useEffect(() => {
    setSettingsEndpointId(undefined);
  }, [tool]);

  // Derive model options from configStore + CLI Settings profile override
  const modelOptions = React.useMemo(() => {
    // If a CLI Settings profile is selected and has availableModels, use those
    if (settingsEndpointId) {
      const endpoint = enabledCliSettings.find((s) => s.id === settingsEndpointId);
      if (endpoint?.settings.availableModels?.length) {
        return endpoint.settings.availableModels;
      }
    }
    const toolConfig = cliTools[tool];
    if (!toolConfig) return [];
    if (toolConfig.availableModels?.length) return toolConfig.availableModels;
    // Build models from primaryModel/secondaryModel, filtering out undefined
    const models: string[] = [];
    if (toolConfig.primaryModel) models.push(toolConfig.primaryModel);
    if (toolConfig.secondaryModel && toolConfig.secondaryModel !== toolConfig.primaryModel) {
      models.push(toolConfig.secondaryModel);
    }
    return models;
  }, [cliTools, tool, settingsEndpointId, enabledCliSettings]);

  // Generate new tag when modal opens or tool changes
  const regenerateTag = React.useCallback(() => {
    setTag(generateTag(tool));
  }, [tool]);

  React.useEffect(() => {
    if (!isOpen) return;
    // Reset to a safe default each time the modal is opened.
    const nextWorkingDir = defaultWorkingDir ?? '';
    setWorkingDir(nextWorkingDir);
    setError(null);
    setSettingsEndpointId(undefined);
    regenerateTag();
  }, [isOpen, defaultWorkingDir, regenerateTag]);

  // Update tag prefix when tool changes
  React.useEffect(() => {
    if (tag) {
      const suffix = tag.split('-').pop() || '';
      setTag(`${tool}-${suffix}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when tool changes, reading tag intentionally stale
  }, [tool]);

  // Sync initial model when tool/modelOptions change
  React.useEffect(() => {
    if (modelOptions.length > 0 && (!model || !modelOptions.includes(model))) {
      setModel(modelOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when modelOptions changes
  }, [modelOptions]);

  const handleToolChange = (nextTool: string) => {
    setTool(nextTool as CliTool);
    const nextConfig = cliTools[nextTool];
    const nextModels = nextConfig?.availableModels?.length
      ? nextConfig.availableModels
      : [nextConfig?.primaryModel, nextConfig?.secondaryModel].filter(Boolean) as string[];
    if (!model || !nextModels.includes(model)) {
      setModel(nextModels[0]);
    }
  };

  const handleBrowse = () => {
    // Reserved for future file-picker integration
    console.log('[CliConfigModal] browse working directory - not implemented');
  };

  const handleCreate = async () => {
    const dir = workingDir.trim();
    if (!dir) {
      setError(formatMessage({ id: 'terminalDashboard.cliConfig.errors.workingDirRequired' }));
      return;
    }

    const finalTag = tag.trim() || generateTag(tool);

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateSession({
        tool,
        model,
        launchMode,
        preferredShell,
        workingDir: dir,
        tag: finalTag,
        settingsEndpointId,
      });
      onClose();
    } catch (err) {
      console.error('[CliConfigModal] create session failed:', err);
      setError(formatMessage({ id: 'terminalDashboard.cliConfig.errors.createFailed' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'terminalDashboard.cliConfig.title' })}</DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'terminalDashboard.cliConfig.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tag / Name */}
          <div className="space-y-2">
            <Label htmlFor="cli-config-tag">
              {formatMessage({ id: 'terminalDashboard.cliConfig.tag', defaultMessage: 'Session Name' })}
            </Label>
            <div className="flex gap-2">
              <Input
                id="cli-config-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={formatMessage({ id: 'terminalDashboard.cliConfig.tagPlaceholder', defaultMessage: 'e.g., gemini-143052' })}
                disabled={isSubmitting}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={regenerateTag}
                disabled={isSubmitting}
                title={formatMessage({ id: 'terminalDashboard.cliConfig.regenerateTag', defaultMessage: 'Regenerate name' })}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'terminalDashboard.cliConfig.tagHint', defaultMessage: 'Auto-generated as {tool}-{time}. Used for grouping sessions.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tool */}
            <div className="space-y-2">
              <Label htmlFor="cli-config-tool">
                {formatMessage({ id: 'terminalDashboard.cliConfig.tool' })}
              </Label>
              <Select value={tool} onValueChange={handleToolChange} disabled={isSubmitting}>
                <SelectTrigger id="cli-config-tool">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledTools.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="cli-config-model">
                {formatMessage({ id: 'terminalDashboard.cliConfig.model' })}
              </Label>
              <Select
                value={model ?? AUTO_MODEL_VALUE}
                onValueChange={(v) => setModel(v === AUTO_MODEL_VALUE ? undefined : v)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="cli-config-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_MODEL_VALUE}>
                    {formatMessage({ id: 'terminalDashboard.cliConfig.modelAuto' })}
                  </SelectItem>
                  {modelOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Config Profile (all tools with settings) */}
          {enabledCliSettings.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="cli-config-profile">
                {formatMessage({ id: 'terminalDashboard.cliConfig.configProfile', defaultMessage: 'Config Profile' })}
              </Label>
              <Select
                value={settingsEndpointId ?? '__default__'}
                onValueChange={(v) => {
                  const id = v === '__default__' ? undefined : v;
                  setSettingsEndpointId(id);
                  // If profile has availableModels, use those for model dropdown
                  if (id) {
                    const endpoint = enabledCliSettings.find((s) => s.id === id);
                    if (endpoint?.settings.availableModels?.length) {
                      setModel(endpoint.settings.availableModels[0]);
                    }
                  }
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="cli-config-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    {formatMessage({ id: 'terminalDashboard.cliConfig.defaultProfile', defaultMessage: 'Default' })}
                  </SelectItem>
                  {enabledCliSettings.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'terminalDashboard.cliConfig.configProfileHint', defaultMessage: 'Select a CLI Settings profile for custom API configuration.' })}
              </p>
            </div>
          )}

          {/* Mode */}
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'terminalDashboard.cliConfig.mode' })}</Label>
            <RadioGroup
              value={launchMode}
              onValueChange={(v) => setLaunchMode(v as LaunchMode)}
              className="flex items-center gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="default" />
                {formatMessage({ id: 'terminalDashboard.cliConfig.modeDefault' })}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="yolo" />
                {formatMessage({ id: 'terminalDashboard.cliConfig.modeYolo' })}
              </label>
            </RadioGroup>
          </div>

          {/* Shell */}
          <div className="space-y-2">
            <Label htmlFor="cli-config-shell">
              {formatMessage({ id: 'terminalDashboard.cliConfig.shell' })}
            </Label>
            <Select
              value={preferredShell}
              onValueChange={(v) => setPreferredShell(v as ShellKind)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="cli-config-shell">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cmd">cmd (推荐 Windows)</SelectItem>
                <SelectItem value="bash">bash (Git Bash/WSL)</SelectItem>
                <SelectItem value="pwsh">pwsh (PowerShell)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Working Directory */}
          <div className="space-y-2">
            <Label htmlFor="cli-config-workingDir">
              {formatMessage({ id: 'terminalDashboard.cliConfig.workingDir' })}
            </Label>
            <div className="flex gap-2">
              <Input
                id="cli-config-workingDir"
                value={workingDir}
                onChange={(e) => {
                  setWorkingDir(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={formatMessage({ id: 'terminalDashboard.cliConfig.workingDirPlaceholder' })}
                disabled={isSubmitting}
                className={cn(error && 'border-destructive')}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                disabled={isSubmitting}
                title={formatMessage({ id: 'terminalDashboard.cliConfig.browse' })}
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {formatMessage({ id: 'common.actions.create' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CliConfigModal;
