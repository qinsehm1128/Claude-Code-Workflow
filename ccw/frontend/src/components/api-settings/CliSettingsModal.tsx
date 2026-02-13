// ========================================
// CLI Settings Modal Component
// ========================================
// Add/Edit CLI settings modal with provider-based and direct modes

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Check, Eye, EyeOff, X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useCreateCliSettings, useUpdateCliSettings, useProviders } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { CliSettingsEndpoint } from '@/lib/api';

// ========== Types ==========

export interface CliSettingsModalProps {
  open: boolean;
  onClose: () => void;
  cliSettings?: CliSettingsEndpoint | null;
}

type ModeType = 'provider-based' | 'direct';

// ========== Helper Functions ==========

function parseConfigJson(
  configJson: string
): { ok: true; value: Record<string, unknown> } | { ok: false; errorKey: string } {
  const trimmed = configJson.trim();
  if (!trimmed) {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, errorKey: 'configMustBeObject' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, errorKey: 'invalidJson' };
  }
}

// ========== Main Component ==========

export function CliSettingsModal({ open, onClose, cliSettings }: CliSettingsModalProps) {
  const { formatMessage } = useIntl();
  const { error } = useNotifications();
  const isEditing = !!cliSettings;

  // Mutations
  const { createCliSettings, isCreating } = useCreateCliSettings();
  const { updateCliSettings, isUpdating } = useUpdateCliSettings();

  // Get providers for provider-based mode
  const { providers } = useProviders();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<ModeType>('direct');

  // Provider-based mode state
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('sonnet');
  const [includeCoAuthoredBy, setIncludeCoAuthoredBy] = useState(false);
  const [settingsFile, setSettingsFile] = useState('');

  // Direct mode state
  const [authToken, setAuthToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Available models state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelInput, setModelInput] = useState('');

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // JSON config state
  const [configJson, setConfigJson] = useState('{}');
  const [showJsonInput, setShowJsonInput] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form from cliSettings
  useEffect(() => {
    if (cliSettings) {
      setName(cliSettings.name);
      setDescription(cliSettings.description || '');
      setEnabled(cliSettings.enabled);
      setModel(cliSettings.settings.model || 'sonnet');
      setIncludeCoAuthoredBy(cliSettings.settings.includeCoAuthoredBy || false);
      setSettingsFile(cliSettings.settings.settingsFile || '');
      setAvailableModels(cliSettings.settings.availableModels || []);
      setTags(cliSettings.settings.tags || []);

      // Determine mode based on settings
      const hasCustomBaseUrl = Boolean(
        cliSettings.settings.env.ANTHROPIC_BASE_URL &&
        !cliSettings.settings.env.ANTHROPIC_BASE_URL.includes('api.anthropic.com')
      );

      if (hasCustomBaseUrl) {
        setMode('direct');
        setBaseUrl(cliSettings.settings.env.ANTHROPIC_BASE_URL || '');
        setAuthToken(cliSettings.settings.env.ANTHROPIC_AUTH_TOKEN || '');
      } else {
        setMode('provider-based');
        // Try to find matching provider
        const matchingProvider = providers.find((p) => p.apiBase === cliSettings.settings.env.ANTHROPIC_BASE_URL);
        if (matchingProvider) {
          setProviderId(matchingProvider.id);
        }
      }
    } else {
      // Reset form for new CLI settings
      setName('');
      setDescription('');
      setEnabled(true);
      setMode('direct');
      setProviderId('');
      setModel('sonnet');
      setIncludeCoAuthoredBy(false);
      setSettingsFile('');
      setAuthToken('');
      setBaseUrl('');
      setAvailableModels([]);
      setModelInput('');
      setTags([]);
      setTagInput('');
      setConfigJson('{}');
      setShowJsonInput(false);
      setErrors({});
    }
  }, [cliSettings, open, providers]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = formatMessage({ id: 'apiSettings.validation.nameRequired' });
    } else {
      // Validate name format: must start with letter, followed by letters/numbers/hyphens/underscores
      const namePattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
      if (!namePattern.test(name.trim())) {
        newErrors.name = formatMessage({ id: 'apiSettings.cliSettings.nameFormatHint' });
      }
      // Validate name length
      if (name.trim().length > 32) {
        newErrors.name = formatMessage({ id: 'apiSettings.cliSettings.nameTooLong' }, { max: 32 });
      }
    }

    if (mode === 'provider-based') {
      if (!providerId) {
        newErrors.providerId = formatMessage({ id: 'apiSettings.cliSettings.validation.providerRequired' });
      }
    } else {
      // Direct mode
      if (!authToken.trim() && !baseUrl.trim()) {
        newErrors.direct = formatMessage({ id: 'apiSettings.cliSettings.validation.authOrBaseUrlRequired' });
      }
    }

    // Validate JSON config if shown
    if (showJsonInput) {
      const parsedConfig = parseConfigJson(configJson);
      if (!parsedConfig.ok) {
        newErrors.configJson = formatMessage({ id: `apiSettings.cliSettings.${parsedConfig.errorKey}` });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      // Build settings object based on mode
      const env: Record<string, string> = {
        DISABLE_AUTOUPDATER: '1',
      };

      if (mode === 'provider-based') {
        // Provider-based mode: get settings from selected provider
        const provider = providers.find((p) => p.id === providerId);
        if (provider) {
          if (provider.apiBase) {
            env.ANTHROPIC_BASE_URL = provider.apiBase;
          }
          if (provider.apiKey) {
            env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
          }
        }
      } else {
        // Direct mode: use manual input
        if (authToken.trim()) {
          env.ANTHROPIC_AUTH_TOKEN = authToken.trim();
        }
        if (baseUrl.trim()) {
          env.ANTHROPIC_BASE_URL = baseUrl.trim();
        }
      }

      // Parse and merge JSON config if shown
      let extraSettings: Record<string, unknown> = {};
      if (showJsonInput) {
        const parsedConfig = parseConfigJson(configJson);
        if (parsedConfig.ok) {
          extraSettings = parsedConfig.value;
        }
      }

      const request = {
        id: cliSettings?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        enabled,
        settings: {
          env,
          model,
          includeCoAuthoredBy,
          settingsFile: settingsFile.trim() || undefined,
          availableModels,
          tags,
          ...extraSettings,
        },
      };

      if (isEditing && cliSettings) {
        await updateCliSettings(cliSettings.id, request);
      } else {
        await createCliSettings(request);
      }

      onClose();
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.cliSettings.saveError' }));
    }
  };

  // Handle add model
  const handleAddModel = () => {
    const newModel = modelInput.trim();
    if (newModel && !availableModels.includes(newModel)) {
      setAvailableModels([...availableModels, newModel]);
      setModelInput('');
    }
  };

  // Handle remove model
  const handleRemoveModel = (modelToRemove: string) => {
    setAvailableModels(availableModels.filter((m) => m !== modelToRemove));
  };

  // Handle add tag
  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput('');
    }
  };

  // Handle remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Predefined tags
  const predefinedTags = ['分析', 'Debug', 'implementation', 'refactoring', 'testing'];

  // Get selected provider info
  const selectedProvider = providers.find((p) => p.id === providerId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'apiSettings.cliSettings.actions.edit' })
              : formatMessage({ id: 'apiSettings.cliSettings.actions.add' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.cliSettings.modalDescription' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Common Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                {formatMessage({ id: 'apiSettings.common.name' })}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={formatMessage({ id: 'apiSettings.cliSettings.namePlaceholder' })}
                className={errors.name ? 'border-destructive' : ''}
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.nameFormatHint' })}
              </p>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {formatMessage({ id: 'apiSettings.common.description' })}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={formatMessage({ id: 'apiSettings.cliSettings.descriptionPlaceholder' })}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                {formatMessage({ id: 'apiSettings.common.enableThis' })}
              </Label>
            </div>
          </div>

          {/* Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as ModeType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="provider-based">
                {formatMessage({ id: 'apiSettings.cliSettings.providerBased' })}
              </TabsTrigger>
              <TabsTrigger value="direct">
                {formatMessage({ id: 'apiSettings.cliSettings.direct' })}
              </TabsTrigger>
            </TabsList>

            {/* Provider-based Mode */}
            <TabsContent value="provider-based" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="providerId">
                  {formatMessage({ id: 'apiSettings.common.provider' })}
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger className={errors.providerId ? 'border-destructive' : ''}>
                    <SelectValue placeholder={formatMessage({ id: 'apiSettings.cliSettings.selectProvider' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.providerId && <p className="text-sm text-destructive">{errors.providerId}</p>}
              </div>

              {selectedProvider && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">{selectedProvider.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'apiSettings.common.type' })}: {selectedProvider.type}
                  </p>
                  {selectedProvider.apiBase && (
                    <p className="text-xs text-muted-foreground truncate">
                      {formatMessage({ id: 'apiSettings.providers.apiBaseUrl' })}: {selectedProvider.apiBase}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="model-pb">
                  {formatMessage({ id: 'apiSettings.cliSettings.model' })}
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model-pb">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opus">Opus</SelectItem>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="haiku">Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Direct Mode */}
            <TabsContent value="direct" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="authToken">
                  {formatMessage({ id: 'apiSettings.cliSettings.authToken' })}
                </Label>
                <div className="relative">
                  <Input
                    id="authToken"
                    type={showToken ? 'text' : 'password'}
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="sk-ant-..."
                    className={errors.direct ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">
                  {formatMessage({ id: 'apiSettings.cliSettings.baseUrl' })}
                </Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.anthropic.com"
                  className={errors.direct ? 'border-destructive' : ''}
                />
              </div>

              {errors.direct && <p className="text-sm text-destructive">{errors.direct}</p>}

              <div className="space-y-2">
                <Label htmlFor="model-direct">
                  {formatMessage({ id: 'apiSettings.cliSettings.model' })}
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model-direct">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opus">Opus</SelectItem>
                    <SelectItem value="sonnet">Sonnet</SelectItem>
                    <SelectItem value="haiku">Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          {/* Additional Settings (both modes) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                id="coAuthored"
                checked={includeCoAuthoredBy}
                onCheckedChange={setIncludeCoAuthoredBy}
              />
              <Label htmlFor="coAuthored" className="cursor-pointer">
                {formatMessage({ id: 'apiSettings.cliSettings.includeCoAuthoredBy' })}
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settingsFile">
                {formatMessage({ id: 'apiSettings.cliSettings.settingsFile' })}
              </Label>
              <Input
                id="settingsFile"
                value={settingsFile}
                onChange={(e) => setSettingsFile(e.target.value)}
                placeholder={formatMessage({ id: 'apiSettings.cliSettings.settingsFilePlaceholder' })}
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.settingsFileHint' })}
              </p>
            </div>

            {/* Available Models Section */}
            <div className="space-y-2">
              <Label htmlFor="availableModels">
                {formatMessage({ id: 'apiSettings.cliSettings.availableModels' })}
              </Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg min-h-[60px]">
                {availableModels.map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                  >
                    {model}
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(model)}
                      className="hover:text-destructive transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <div className="flex gap-2 flex-1">
                  <Input
                    id="availableModels"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddModel();
                      }
                    }}
                    placeholder={formatMessage({ id: 'apiSettings.cliSettings.availableModelsPlaceholder' })}
                    className="flex-1 min-w-[120px]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddModel}
                    variant="outline"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.availableModelsHint' })}
              </p>
            </div>

            {/* Tags Section */}
            <div className="space-y-2">
              <Label htmlFor="tags">
                {formatMessage({ id: 'apiSettings.cliSettings.tags' })}
              </Label>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.tagsDescription' })}
              </p>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg min-h-[60px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
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
                <div className="flex gap-2 flex-1">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder={formatMessage({ id: 'apiSettings.cliSettings.tagInputPlaceholder' })}
                    className="flex-1 min-w-[120px]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddTag}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
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
                      if (!tags.includes(predefinedTag)) {
                        setTags([...tags, predefinedTag]);
                      }
                    }}
                    disabled={tags.includes(predefinedTag)}
                    className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {predefinedTag}
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Config Section */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label htmlFor="configJson" className="cursor-pointer">
                  {formatMessage({ id: 'apiSettings.cliSettings.configJson' })}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowJsonInput(!showJsonInput)}
                >
                  {showJsonInput
                    ? formatMessage({ id: 'common.actions.close' })
                    : formatMessage({ id: 'common.actions.expand' }, { value: 'JSON' })}
                </Button>
              </div>
              {showJsonInput && (
                <div className="space-y-2">
                  <Textarea
                    id="configJson"
                    value={configJson}
                    onChange={(e) => {
                      setConfigJson(e.target.value);
                      if (errors.configJson) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.configJson;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder={formatMessage({ id: 'apiSettings.cliSettings.configJsonPlaceholder' })}
                    className={errors.configJson ? 'font-mono border-destructive' : 'font-mono'}
                    rows={8}
                  />
                  {errors.configJson && (
                    <p className="text-xs text-destructive">{errors.configJson}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'apiSettings.cliSettings.configJsonHint' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isCreating || isUpdating}>
            {(isCreating || isUpdating) ? (
              formatMessage({ id: 'common.actions.saving' })
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'common.actions.save' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CliSettingsModal;
