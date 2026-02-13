// ========================================
// CodexLens Settings Tab
// ========================================
// Structured form for CodexLens env configuration
// Renders 5 groups: embedding, reranker, concurrency, cascade, chunking
// Plus a general config section (index_dir)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Save, RefreshCw, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/Select';
import {
  useCodexLensConfig,
  useCodexLensEnv,
  useUpdateCodexLensEnv,
  useCodexLensModels,
  useCodexLensRerankerConfig,
  useUpdateRerankerConfig,
} from '@/hooks';
import { useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';
import { SchemaFormRenderer } from './SchemaFormRenderer';
import { envVarGroupsSchema, getSchemaDefaults } from './envVarSchema';

// ========== Reranker Configuration Card ==========

interface RerankerConfigCardProps {
  enabled?: boolean;
}

function RerankerConfigCard({ enabled = true }: RerankerConfigCardProps) {
  const { formatMessage } = useIntl();
  const { success: showSuccess, error: showError } = useNotifications();

  const {
    backend: serverBackend,
    modelName: serverModelName,
    apiProvider: serverApiProvider,
    apiKeySet,
    availableBackends,
    apiProviders,
    litellmModels,
    configSource,
    isLoading,
  } = useCodexLensRerankerConfig({ enabled });

  const { updateConfig, isUpdating } = useUpdateRerankerConfig();

  const [backend, setBackend] = useState('');
  const [modelName, setModelName] = useState('');
  const [apiProvider, setApiProvider] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form from server data
  useEffect(() => {
    setBackend(serverBackend);
    setModelName(serverModelName);
    setApiProvider(serverApiProvider);
    setHasChanges(false);
  }, [serverBackend, serverModelName, serverApiProvider]);

  // Detect changes
  useEffect(() => {
    const changed =
      backend !== serverBackend ||
      modelName !== serverModelName ||
      apiProvider !== serverApiProvider;
    setHasChanges(changed);
  }, [backend, modelName, apiProvider, serverBackend, serverModelName, serverApiProvider]);

  const handleSave = async () => {
    try {
      const request: Record<string, string> = {};
      if (backend !== serverBackend) request.backend = backend;
      if (modelName !== serverModelName) {
        // When backend is litellm, model_name is sent as litellm_endpoint
        if (backend === 'litellm') {
          request.litellm_endpoint = modelName;
        } else {
          request.model_name = modelName;
        }
      }
      if (apiProvider !== serverApiProvider) request.api_provider = apiProvider;

      const result = await updateConfig(request);
      if (result.success) {
        showSuccess(
          formatMessage({ id: 'codexlens.reranker.saveSuccess' }),
          result.message || ''
        );
      } else {
        showError(
          formatMessage({ id: 'codexlens.reranker.saveFailed' }),
          result.error || ''
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.reranker.saveFailed' }),
        err instanceof Error ? err.message : ''
      );
    }
  };

  // Determine whether to show litellm model dropdown or text input
  const showLitellmModelSelect = backend === 'litellm' && litellmModels && litellmModels.length > 0;
  // Show provider dropdown only for api backend
  const showProviderSelect = backend === 'api';

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{formatMessage({ id: 'common.loading' })}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {formatMessage({ id: 'codexlens.reranker.title' })}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {formatMessage({ id: 'codexlens.reranker.description' })}
      </p>

      <div className="space-y-4">
        {/* Backend Select */}
        <div className="space-y-2">
          <Label>{formatMessage({ id: 'codexlens.reranker.backend' })}</Label>
          <Select value={backend} onValueChange={setBackend}>
            <SelectTrigger>
              <SelectValue placeholder={formatMessage({ id: 'codexlens.reranker.selectBackend' })} />
            </SelectTrigger>
            <SelectContent>
              {availableBackends.length > 0 ? (
                availableBackends.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="_none" disabled>
                  {formatMessage({ id: 'codexlens.reranker.noBackends' })}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'codexlens.reranker.backendHint' })}
          </p>
        </div>

        {/* Model - Select for litellm, Input for others */}
        <div className="space-y-2">
          <Label>{formatMessage({ id: 'codexlens.reranker.model' })}</Label>
          {showLitellmModelSelect ? (
            <Select value={modelName} onValueChange={setModelName}>
              <SelectTrigger>
                <SelectValue placeholder={formatMessage({ id: 'codexlens.reranker.selectModel' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>
                    {formatMessage({ id: 'codexlens.reranker.litellmModels' })}
                  </SelectLabel>
                  {litellmModels!.map((m) => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      {m.modelName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={formatMessage({ id: 'codexlens.reranker.selectModel' })}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'codexlens.reranker.modelHint' })}
          </p>
        </div>

        {/* Provider Select (only for api backend) */}
        {showProviderSelect && (
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'codexlens.reranker.provider' })}</Label>
            <Select value={apiProvider} onValueChange={setApiProvider}>
              <SelectTrigger>
                <SelectValue placeholder={formatMessage({ id: 'codexlens.reranker.selectProvider' })} />
              </SelectTrigger>
              <SelectContent>
                {apiProviders.length > 0 ? (
                  apiProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="_none" disabled>
                    {formatMessage({ id: 'codexlens.reranker.noProviders' })}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.reranker.providerHint' })}
            </p>
          </div>
        )}

        {/* Status Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
          <span>
            {formatMessage({ id: 'codexlens.reranker.apiKeyStatus' })}:{' '}
            <span className={apiKeySet ? 'text-green-600' : 'text-yellow-600'}>
              {apiKeySet
                ? formatMessage({ id: 'codexlens.reranker.apiKeySet' })
                : formatMessage({ id: 'codexlens.reranker.apiKeyNotSet' })}
            </span>
          </span>
          <span>
            {formatMessage({ id: 'codexlens.reranker.configSource' })}: {configSource}
          </span>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={isUpdating || !hasChanges}
            size="sm"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {isUpdating
              ? formatMessage({ id: 'codexlens.reranker.saving' })
              : formatMessage({ id: 'codexlens.reranker.save' })}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ========== Settings Tab ==========

interface SettingsTabProps {
  enabled?: boolean;
}

export function SettingsTab({ enabled = true }: SettingsTabProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();

  // Fetch current config (index_dir, workers, batch_size)
  const {
    config,
    indexCount,
    apiMaxWorkers,
    apiBatchSize,
    isLoading: isLoadingConfig,
    refetch: refetchConfig,
  } = useCodexLensConfig({ enabled });

  // Fetch env vars and settings
  const {
    env: serverEnv,
    settings: serverSettings,
    isLoading: isLoadingEnv,
    refetch: refetchEnv,
  } = useCodexLensEnv({ enabled });

  // Fetch local models for model-select fields
  const {
    embeddingModels: localEmbeddingModels,
    rerankerModels: localRerankerModels,
  } = useCodexLensModels({ enabled });

  const { updateEnv, isUpdating } = useUpdateCodexLensEnv();

  // General form state (index_dir)
  const [indexDir, setIndexDir] = useState('');
  const [indexDirError, setIndexDirError] = useState('');

  // Schema-driven env var form state
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Store the initial values for change detection
  const [initialEnvValues, setInitialEnvValues] = useState<Record<string, string>>({});
  const [initialIndexDir, setInitialIndexDir] = useState('');

  // Initialize form from server data
  useEffect(() => {
    if (config) {
      setIndexDir(config.index_dir || '');
      setInitialIndexDir(config.index_dir || '');
    }
  }, [config]);

  useEffect(() => {
    if (serverEnv || serverSettings) {
      const defaults = getSchemaDefaults();
      const merged: Record<string, string> = { ...defaults };

      // Settings.json values override defaults
      if (serverSettings) {
        for (const [key, val] of Object.entries(serverSettings)) {
          if (val) merged[key] = val;
        }
      }

      // .env values override settings
      if (serverEnv) {
        for (const [key, val] of Object.entries(serverEnv)) {
          if (val) merged[key] = val;
        }
      }

      setEnvValues(merged);
      setInitialEnvValues(merged);
      setHasChanges(false);
    }
  }, [serverEnv, serverSettings]);

  // Check for changes
  const detectChanges = useCallback(
    (currentEnv: Record<string, string>, currentIndexDir: string) => {
      if (currentIndexDir !== initialIndexDir) return true;
      for (const key of Object.keys(currentEnv)) {
        if (currentEnv[key] !== initialEnvValues[key]) return true;
      }
      return false;
    },
    [initialEnvValues, initialIndexDir]
  );

  const handleEnvChange = useCallback(
    (key: string, value: string) => {
      setEnvValues((prev) => {
        const next = { ...prev, [key]: value };
        setHasChanges(detectChanges(next, indexDir));
        return next;
      });
    },
    [detectChanges, indexDir]
  );

  const handleIndexDirChange = useCallback(
    (value: string) => {
      setIndexDir(value);
      setIndexDirError('');
      setHasChanges(detectChanges(envValues, value));
    },
    [detectChanges, envValues]
  );

  // Installed local models filtered to installed-only
  const installedEmbeddingModels = useMemo(
    () => (localEmbeddingModels || []).filter((m) => m.installed),
    [localEmbeddingModels]
  );
  const installedRerankerModels = useMemo(
    () => (localRerankerModels || []).filter((m) => m.installed),
    [localRerankerModels]
  );

  const handleSave = async () => {
    // Validate index_dir
    if (!indexDir.trim()) {
      setIndexDirError(
        formatMessage({ id: 'codexlens.settings.validation.indexDirRequired' })
      );
      return;
    }

    try {
      const result = await updateEnv({ env: envValues });

      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.settings.saveSuccess' }),
          result.message ||
            formatMessage({ id: 'codexlens.settings.configUpdated' })
        );
        refetchEnv();
        refetchConfig();
        setHasChanges(false);
        setInitialEnvValues(envValues);
        setInitialIndexDir(indexDir);
      } else {
        showError(
          formatMessage({ id: 'codexlens.settings.saveFailed' }),
          result.message ||
            formatMessage({ id: 'codexlens.settings.saveError' })
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.settings.saveFailed' }),
        err instanceof Error
          ? err.message
          : formatMessage({ id: 'codexlens.settings.unknownError' })
      );
    }
  };

  const handleReset = () => {
    setEnvValues(initialEnvValues);
    setIndexDir(initialIndexDir);
    setIndexDirError('');
    setHasChanges(false);
  };

  const isLoading = isLoadingConfig || isLoadingEnv;

  return (
    <div className="space-y-6">
      {/* Current Info Card */}
      <Card className="p-4 bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">
              {formatMessage({ id: 'codexlens.settings.currentCount' })}
            </span>
            <p className="text-foreground font-medium">{indexCount}</p>
          </div>
          <div>
            <span className="text-muted-foreground">
              {formatMessage({ id: 'codexlens.settings.currentWorkers' })}
            </span>
            <p className="text-foreground font-medium">{apiMaxWorkers}</p>
          </div>
          <div>
            <span className="text-muted-foreground">
              {formatMessage({ id: 'codexlens.settings.currentBatchSize' })}
            </span>
            <p className="text-foreground font-medium">{apiBatchSize}</p>
          </div>
        </div>
      </Card>

      {/* Reranker Configuration */}
      <RerankerConfigCard enabled={enabled} />

      {/* General Configuration */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {formatMessage({ id: 'codexlens.settings.configTitle' })}
        </h3>

        {/* Index Directory */}
        <div className="space-y-2 mb-4">
          <Label htmlFor="index_dir">
            {formatMessage({ id: 'codexlens.settings.indexDir.label' })}
          </Label>
          <Input
            id="index_dir"
            value={indexDir}
            onChange={(e) => handleIndexDirChange(e.target.value)}
            placeholder={formatMessage({
              id: 'codexlens.settings.indexDir.placeholder',
            })}
            error={!!indexDirError}
            disabled={isLoading}
          />
          {indexDirError && (
            <p className="text-sm text-destructive">{indexDirError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'codexlens.settings.indexDir.hint' })}
          </p>
        </div>

        {/* Schema-driven Env Var Groups */}
        <SchemaFormRenderer
          groups={envVarGroupsSchema}
          values={envValues}
          onChange={handleEnvChange}
          disabled={isLoading}
          localEmbeddingModels={installedEmbeddingModels}
          localRerankerModels={installedRerankerModels}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-6">
          <Button
            onClick={handleSave}
            disabled={isLoading || isUpdating || !hasChanges}
          >
            <Save
              className={cn('w-4 h-4 mr-2', isUpdating && 'animate-spin')}
            />
            {isUpdating
              ? formatMessage({ id: 'codexlens.settings.saving' })
              : formatMessage({ id: 'codexlens.settings.save' })}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isLoading || !hasChanges}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'codexlens.settings.reset' })}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default SettingsTab;
