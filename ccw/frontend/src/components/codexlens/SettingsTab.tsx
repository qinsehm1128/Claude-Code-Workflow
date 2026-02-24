// ========================================
// CodexLens Settings Tab
// ========================================
// Structured form for CodexLens env configuration
// Renders 5 groups: embedding, reranker, concurrency, cascade, chunking
// Plus a general config section (index_dir)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Save, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import {
  useCodexLensConfig,
  useCodexLensEnv,
  useUpdateCodexLensEnv,
  useCodexLensModels,
} from '@/hooks';
import { useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';
import { SchemaFormRenderer } from './SchemaFormRenderer';
import { envVarGroupsSchema, getSchemaDefaults } from './envVarSchema';

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
