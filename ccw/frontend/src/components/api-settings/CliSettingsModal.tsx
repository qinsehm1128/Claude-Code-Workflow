// ========================================
// CLI Settings Modal Component
// ========================================
// Add/Edit CLI settings modal with multi-provider support (Claude/Codex/Gemini)

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Check, Eye, EyeOff, X, Plus, Loader2, Download } from 'lucide-react';
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
import { fetchCodexConfigPreview, fetchGeminiConfigPreview } from '@/lib/api';
import type { CliSettingsEndpoint, CliProvider } from '@/lib/api';

// ========== Types ==========

export interface CliSettingsModalProps {
  open: boolean;
  onClose: () => void;
  cliSettings?: CliSettingsEndpoint | null;
  /** Pre-selected provider when creating new */
  defaultProvider?: CliProvider;
}

type ModeType = 'provider-based' | 'direct';

// ========== Helper Functions ==========

function parseConfigText(
  text: string,
  format: 'json' | 'toml' = 'json'
): { ok: true; value: string } | { ok: false; errorKey: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }

  if (format === 'json') {
    try {
      JSON.parse(trimmed);
      return { ok: true, value: trimmed };
    } catch {
      return { ok: false, errorKey: 'invalidJson' };
    }
  }

  // TOML: basic format check (no full parser needed)
  return { ok: true, value: trimmed };
}

// ========== Main Component ==========

export function CliSettingsModal({ open, onClose, cliSettings, defaultProvider }: CliSettingsModalProps) {
  const { formatMessage } = useIntl();
  const { error } = useNotifications();
  const isEditing = !!cliSettings;

  // Mutations
  const { createCliSettings, isCreating } = useCreateCliSettings();
  const { updateCliSettings, isUpdating } = useUpdateCliSettings();

  // Get providers for provider-based mode (Claude)
  const { providers } = useProviders();

  // Common form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [cliProvider, setCliProvider] = useState<CliProvider>('claude');

  // Claude: mode tabs
  const [mode, setMode] = useState<ModeType>('direct');
  const [providerId, setProviderId] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [settingsFile, setSettingsFile] = useState('');

  // Codex specific
  const [codexApiKey, setCodexApiKey] = useState('');
  const [codexBaseUrl, setCodexBaseUrl] = useState('');
  const [codexProfile, setCodexProfile] = useState('');
  const [showCodexKey, setShowCodexKey] = useState(false);
  const [authJson, setAuthJson] = useState('');
  const [configToml, setConfigToml] = useState('');
  const [writeCommonConfig, setWriteCommonConfig] = useState(false);

  // Gemini specific
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiSettingsJson, setGeminiSettingsJson] = useState('');
  const [isLoadingGeminiConfig, setIsLoadingGeminiConfig] = useState(false);

  // Shared
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelInput, setModelInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [configJson, setConfigJson] = useState('{}');
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Codex config preview loading state
  const [isLoadingCodexConfig, setIsLoadingCodexConfig] = useState(false);

  // Initialize form
  useEffect(() => {
    if (cliSettings) {
      setName(cliSettings.name);
      setDescription(cliSettings.description || '');
      setEnabled(cliSettings.enabled);
      setCliProvider(cliSettings.provider || 'claude');
      setModel(cliSettings.settings.model || '');
      setAvailableModels(cliSettings.settings.availableModels || []);
      setTags(cliSettings.settings.tags || []);

      const provider = cliSettings.provider || 'claude';
      if (provider === 'claude') {
        setSettingsFile((cliSettings.settings as any).settingsFile || '');
        const env = cliSettings.settings.env;
        const hasCustomBaseUrl = Boolean(
          env.ANTHROPIC_BASE_URL && !env.ANTHROPIC_BASE_URL.includes('api.anthropic.com')
        );
        if (hasCustomBaseUrl) {
          setMode('direct');
          setBaseUrl(env.ANTHROPIC_BASE_URL || '');
          setAuthToken(env.ANTHROPIC_AUTH_TOKEN || '');
        } else {
          setMode('provider-based');
          const matchingProvider = providers.find((p) => p.apiBase === env.ANTHROPIC_BASE_URL);
          if (matchingProvider) setProviderId(matchingProvider.id);
        }
      } else if (provider === 'codex') {
        const s = cliSettings.settings as any;
        setCodexApiKey(s.env.OPENAI_API_KEY || '');
        setCodexBaseUrl(s.env.OPENAI_BASE_URL || '');
        setCodexProfile(s.profile || '');
        setAuthJson(s.authJson || '');
        setConfigToml(s.configToml || '');
      } else if (provider === 'gemini') {
        setGeminiApiKey(cliSettings.settings.env.GEMINI_API_KEY || cliSettings.settings.env.GOOGLE_API_KEY || '');
      }
    } else {
      // Reset for new
      const p = defaultProvider || 'claude';
      setName('');
      setDescription('');
      setEnabled(true);
      setCliProvider(p);
      setMode('direct');
      setProviderId('');
      setModel('');
      setSettingsFile('');
      setAuthToken('');
      setBaseUrl('');
      setCodexApiKey('');
      setCodexBaseUrl('');
      setCodexProfile('');
      setShowCodexKey(false);
      setAuthJson('');
      setConfigToml('');
      setWriteCommonConfig(false);
      setGeminiApiKey('');
      setShowGeminiKey(false);
      setGeminiSettingsJson('');
      setAvailableModels([]);
      setModelInput('');
      setTags([]);
      setTagInput('');
      setConfigJson('{}');
      setShowJsonInput(false);
      setErrors({});
    }
  }, [cliSettings, open, providers, defaultProvider]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = formatMessage({ id: 'apiSettings.validation.nameRequired' });
    } else {
      const namePattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
      if (!namePattern.test(name.trim())) {
        newErrors.name = formatMessage({ id: 'apiSettings.cliSettings.nameFormatHint' });
      }
      if (name.trim().length > 32) {
        newErrors.name = formatMessage({ id: 'apiSettings.cliSettings.nameTooLong' }, { max: 32 });
      }
    }

    if (cliProvider === 'claude') {
      if (mode === 'provider-based' && !providerId) {
        newErrors.providerId = formatMessage({ id: 'apiSettings.cliSettings.validation.providerRequired' });
      }
      if (mode === 'direct' && !authToken.trim() && !baseUrl.trim()) {
        newErrors.direct = formatMessage({ id: 'apiSettings.cliSettings.validation.authOrBaseUrlRequired' });
      }
    }

    if (authJson.trim()) {
      const parsed = parseConfigText(authJson, 'json');
      if (!parsed.ok) {
        newErrors.authJson = formatMessage({ id: `apiSettings.cliSettings.${parsed.errorKey}` });
      }
    }

    if (showJsonInput) {
      const parsed = parseConfigText(configJson, 'json');
      if (!parsed.ok) {
        newErrors.configJson = formatMessage({ id: `apiSettings.cliSettings.${parsed.errorKey}` });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle load Codex config preview
  const handleLoadCodexConfig = async () => {
    setIsLoadingCodexConfig(true);
    try {
      const result = await fetchCodexConfigPreview();
      if (result.success) {
        if (result.configToml) {
          setConfigToml(result.configToml);
        }
        if (result.authJson) {
          setAuthJson(result.authJson);
        }
      } else {
        error(formatMessage({ id: 'apiSettings.cliSettings.loadConfigError' }) || 'Failed to load config');
      }
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.cliSettings.loadConfigError' }) || 'Failed to load config');
    } finally {
      setIsLoadingCodexConfig(false);
    }
  };

  // Handle load Gemini config preview
  const handleLoadGeminiConfig = async () => {
    setIsLoadingGeminiConfig(true);
    try {
      const result = await fetchGeminiConfigPreview();
      if (result.success) {
        if (result.settingsJson) {
          setGeminiSettingsJson(result.settingsJson);
        }
      } else {
        error(formatMessage({ id: 'apiSettings.cliSettings.loadConfigError' }) || 'Failed to load config');
      }
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.cliSettings.loadConfigError' }) || 'Failed to load config');
    } finally {
      setIsLoadingGeminiConfig(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      let settings: any;

      if (cliProvider === 'claude') {
        const env: Record<string, string> = { DISABLE_AUTOUPDATER: '1' };
        if (mode === 'provider-based') {
          const provider = providers.find((p) => p.id === providerId);
          if (provider?.apiBase) env.ANTHROPIC_BASE_URL = provider.apiBase;
          if (provider?.apiKey) env.ANTHROPIC_AUTH_TOKEN = provider.apiKey;
        } else {
          if (authToken.trim()) env.ANTHROPIC_AUTH_TOKEN = authToken.trim();
          if (baseUrl.trim()) env.ANTHROPIC_BASE_URL = baseUrl.trim();
        }
        settings = {
          env,
          model: model || undefined,
          settingsFile: settingsFile.trim() || undefined,
          availableModels,
          tags,
        };
      } else if (cliProvider === 'codex') {
        const env: Record<string, string> = {};
        if (codexApiKey.trim()) env.OPENAI_API_KEY = codexApiKey.trim();
        if (codexBaseUrl.trim()) env.OPENAI_BASE_URL = codexBaseUrl.trim();
        settings = {
          env,
          model: model || undefined,
          profile: codexProfile.trim() || undefined,
          authJson: authJson.trim() || undefined,
          configToml: configToml.trim() || undefined,
          availableModels,
          tags,
        };
      } else {
        // gemini
        const env: Record<string, string> = {};
        if (geminiApiKey.trim()) env.GEMINI_API_KEY = geminiApiKey.trim();
        settings = {
          env,
          model: model || undefined,
          availableModels,
          tags,
        };
      }

      // Merge JSON config if shown
      if (showJsonInput && configJson.trim()) {
        try {
          const extra = JSON.parse(configJson);
          if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
            Object.assign(settings, extra);
          }
        } catch {
          // skip invalid json
        }
      }

      const request = {
        id: cliSettings?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        provider: cliProvider,
        enabled,
        settings,
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

  // Tag/Model helpers
  const handleAddModel = () => {
    const v = modelInput.trim();
    if (v && !availableModels.includes(v)) {
      setAvailableModels([...availableModels, v]);
      setModelInput('');
    }
  };
  const handleRemoveModel = (m: string) => setAvailableModels(availableModels.filter((x) => x !== m));
  const handleAddTag = () => {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) {
      setTags([...tags, v]);
      setTagInput('');
    }
  };
  const handleRemoveTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const predefinedTags = ['分析', 'Debug', 'implementation', 'refactoring', 'testing'];
  const selectedProvider = providers.find((p) => p.id === providerId);

  // Title by provider
  const providerLabel: Record<CliProvider, string> = {
    claude: 'Claude',
    codex: 'Codex',
    gemini: 'Gemini',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'apiSettings.cliSettings.actions.edit' })
              : formatMessage({ id: 'apiSettings.cliSettings.actions.add' })}
            {' - '}{providerLabel[cliProvider]}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.cliSettings.modalDescription' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Common Fields */}
          <div className="space-y-4">
            {/* Provider Selector (only when creating new) */}
            {!isEditing && (
              <div className="space-y-2">
                <Label>CLI Provider</Label>
                <Select value={cliProvider} onValueChange={(v) => setCliProvider(v as CliProvider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="codex">Codex</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="enabled" className="cursor-pointer">
                {formatMessage({ id: 'apiSettings.common.enableThis' })}
              </Label>
            </div>
          </div>

          {/* ========== Claude Settings ========== */}
          {cliProvider === 'claude' && (
            <>
              <Tabs value={mode} onValueChange={(v) => setMode(v as ModeType)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="provider-based">
                    {formatMessage({ id: 'apiSettings.cliSettings.providerBased' })}
                  </TabsTrigger>
                  <TabsTrigger value="direct">
                    {formatMessage({ id: 'apiSettings.cliSettings.direct' })}
                  </TabsTrigger>
                </TabsList>

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
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
                    <Label htmlFor="model-pb">{formatMessage({ id: 'apiSettings.cliSettings.model' })}</Label>
                    <Input id="model-pb" value={model} onChange={(e) => setModel(e.target.value)} placeholder="" />
                  </div>
                </TabsContent>

                <TabsContent value="direct" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="authToken">{formatMessage({ id: 'apiSettings.cliSettings.authToken' })}</Label>
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
                        type="button" variant="ghost" size="icon"
                        className="absolute right-0 top-0 h-full px-2"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">{formatMessage({ id: 'apiSettings.cliSettings.baseUrl' })}</Label>
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
                    <Label htmlFor="model-direct">{formatMessage({ id: 'apiSettings.cliSettings.model' })}</Label>
                    <Input id="model-direct" value={model} onChange={(e) => setModel(e.target.value)} placeholder="" />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Claude: Settings File */}
              <div className="space-y-2">
                <Label htmlFor="settingsFile">{formatMessage({ id: 'apiSettings.cliSettings.settingsFile' })}</Label>
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
            </>
          )}

          {/* ========== Codex Settings ========== */}
          {cliProvider === 'codex' && (
            <div className="space-y-4">
              {/* Load Global Config Button */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Load Global Config</p>
                  <p className="text-xs text-muted-foreground">
                    Load config.toml and auth.json from global Codex config directory
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadCodexConfig}
                  disabled={isLoadingCodexConfig}
                >
                  {isLoadingCodexConfig ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Load Config
                    </>
                  )}
                </Button>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="codex-apikey">API Key</Label>
                <p className="text-xs text-muted-foreground">
                  只需要填这里，下方 auth.json 会自动填充
                </p>
                <div className="relative">
                  <Input
                    id="codex-apikey"
                    type={showCodexKey ? 'text' : 'password'}
                    value={codexApiKey}
                    onChange={(e) => setCodexApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="pr-10"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setShowCodexKey(!showCodexKey)}
                  >
                    {showCodexKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* API Endpoint URL */}
              <div className="space-y-2">
                <Label htmlFor="codex-baseurl">API 请求地址</Label>
                <Input
                  id="codex-baseurl"
                  value={codexBaseUrl}
                  onChange={(e) => setCodexBaseUrl(e.target.value)}
                  placeholder="https://your-api-endpoint.com/v1"
                />
                <p className="text-xs text-muted-foreground">
                  填写兼容 OpenAI Response 格式的服务端点地址
                </p>
              </div>

              {/* Model Name */}
              <div className="space-y-2">
                <Label htmlFor="codex-model">{formatMessage({ id: 'apiSettings.cliSettings.model' })}</Label>
                <Input
                  id="codex-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder=""
                />
                <p className="text-xs text-muted-foreground">
                  指定使用的模型，将自动更新到 config.toml 中
                </p>
              </div>

              {/* Profile */}
              <div className="space-y-2">
                <Label htmlFor="codex-profile">Profile</Label>
                <Input
                  id="codex-profile"
                  value={codexProfile}
                  onChange={(e) => setCodexProfile(e.target.value)}
                  placeholder="default"
                />
                <p className="text-xs text-muted-foreground">
                  Codex profile 名称，通过 --profile 参数传递
                </p>
              </div>

              {/* auth.json Editor */}
              <div className="space-y-2">
                <Label htmlFor="codex-authjson">auth.json (JSON) *</Label>
                <Textarea
                  id="codex-authjson"
                  value={authJson}
                  onChange={(e) => {
                    setAuthJson(e.target.value);
                    if (errors.authJson) {
                      setErrors((prev) => { const n = { ...prev }; delete n.authJson; return n; });
                    }
                  }}
                  placeholder='{"OPENAI_API_KEY": "..."}'
                  className={`font-mono text-sm ${errors.authJson ? 'border-destructive' : ''}`}
                  rows={8}
                />
                {errors.authJson && <p className="text-xs text-destructive">{errors.authJson}</p>}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Codex auth.json 配置内容</p>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => {
                      try {
                        const formatted = JSON.stringify(JSON.parse(authJson), null, 2);
                        setAuthJson(formatted);
                      } catch { /* skip */ }
                    }}
                  >
                    格式化
                  </Button>
                </div>
              </div>

              {/* config.toml Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="codex-configtoml">config.toml (TOML)</Label>
                  <div className="flex items-center gap-2">
                    <Switch id="writeCommon" checked={writeCommonConfig} onCheckedChange={setWriteCommonConfig} />
                    <Label htmlFor="writeCommon" className="text-xs cursor-pointer">写入通用配置</Label>
                  </div>
                </div>
                <Textarea
                  id="codex-configtoml"
                  value={configToml}
                  onChange={(e) => setConfigToml(e.target.value)}
                  placeholder=""
                  className="font-mono text-sm"
                  rows={6}
                />
              </div>
            </div>
          )}

          {/* ========== Gemini Settings ========== */}
          {cliProvider === 'gemini' && (
            <div className="space-y-4">
              {/* Load Global Config Button */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Load Global Config</p>
                  <p className="text-xs text-muted-foreground">
                    Load settings.json from global Gemini config directory
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadGeminiConfig}
                  disabled={isLoadingGeminiConfig}
                >
                  {isLoadingGeminiConfig ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Load Config
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gemini-apikey">API Key</Label>
                <div className="relative">
                  <Input
                    id="gemini-apikey"
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="pr-10"
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0 h-full px-2"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gemini-model">{formatMessage({ id: 'apiSettings.cliSettings.model' })}</Label>
                <Input
                  id="gemini-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder=""
                />
              </div>

              {/* settings.json Editor */}
              {geminiSettingsJson && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gemini-settingsjson">settings.json (Preview)</Label>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={() => {
                        try {
                          const formatted = JSON.stringify(JSON.parse(geminiSettingsJson), null, 2);
                          setGeminiSettingsJson(formatted);
                        } catch { /* skip */ }
                      }}
                    >
                      Format
                    </Button>
                  </div>
                  <Textarea
                    id="gemini-settingsjson"
                    value={geminiSettingsJson}
                    onChange={(e) => setGeminiSettingsJson(e.target.value)}
                    placeholder="{}"
                    className="font-mono text-sm"
                    rows={8}
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    Gemini settings.json content (read-only preview)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========== Shared Settings (all providers) ========== */}
          <div className="space-y-4">
            {/* Available Models */}
            <div className="space-y-2">
              <Label htmlFor="availableModels">{formatMessage({ id: 'apiSettings.cliSettings.availableModels' })}</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg min-h-[60px]">
                {availableModels.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                    {m}
                    <button type="button" onClick={() => handleRemoveModel(m)} className="hover:text-destructive transition-colors">×</button>
                  </span>
                ))}
                <div className="flex gap-2 flex-1">
                  <Input
                    id="availableModels"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddModel(); } }}
                    placeholder={formatMessage({ id: 'apiSettings.cliSettings.availableModelsPlaceholder' })}
                    className="flex-1 min-w-[120px]"
                  />
                  <Button type="button" size="sm" onClick={handleAddModel} variant="outline">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.availableModelsHint' })}
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">{formatMessage({ id: 'apiSettings.cliSettings.tags' })}</Label>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.cliSettings.tagsDescription' })}
              </p>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg min-h-[60px]">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
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
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    placeholder={formatMessage({ id: 'apiSettings.cliSettings.tagInputPlaceholder' })}
                    className="flex-1 min-w-[120px]"
                  />
                  <Button type="button" size="sm" onClick={handleAddTag} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'apiSettings.cliSettings.predefinedTags' })}:
                </span>
                {predefinedTags.map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => { if (!tags.includes(pt)) setTags([...tags, pt]); }}
                    disabled={tags.includes(pt)}
                    className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {pt}
                  </button>
                ))}
              </div>
            </div>

            {/* JSON Config (all providers) */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label htmlFor="configJson" className="cursor-pointer">
                  {formatMessage({ id: 'apiSettings.cliSettings.configJson' })}
                </Label>
                <Button
                  type="button" variant="ghost" size="sm"
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
                        setErrors((prev) => { const n = { ...prev }; delete n.configJson; return n; });
                      }
                    }}
                    placeholder={formatMessage({ id: 'apiSettings.cliSettings.configJsonPlaceholder' })}
                    className={errors.configJson ? 'font-mono border-destructive' : 'font-mono'}
                    rows={8}
                  />
                  {errors.configJson && <p className="text-xs text-destructive">{errors.configJson}</p>}
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
