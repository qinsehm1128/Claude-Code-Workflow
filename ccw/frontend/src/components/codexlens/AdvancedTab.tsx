// ========================================
// CodexLens Advanced Tab
// ========================================
// Advanced settings including .env editor and ignore patterns

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Save, RefreshCw, AlertTriangle, FileCode, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { useCodexLensEnv, useUpdateCodexLensEnv } from '@/hooks';
import { useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';
import { CcwToolsCard } from './CcwToolsCard';

interface AdvancedTabProps {
  enabled?: boolean;
}

interface FormErrors {
  env?: string;
}

export function AdvancedTab({ enabled = true }: AdvancedTabProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();

  const {
    raw,
    env,
    settings,
    isLoading: isLoadingEnv,
    error: envError,
    refetch,
  } = useCodexLensEnv({ enabled });

  const { updateEnv, isUpdating } = useUpdateCodexLensEnv();

  // Form state
  const [envInput, setEnvInput] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Initialize form from env - handles both undefined (loading) and empty string (empty file)
  // The hook returns raw directly, so we check if it's been set (not undefined means data loaded)
  useEffect(() => {
    // Initialize when data is loaded (raw may be empty string but not undefined during loading)
    // Note: During initial load, raw is undefined. After load completes, raw is set (even if empty string)
    if (!isLoadingEnv) {
      setEnvInput(raw ?? ''); // Use empty string if raw is undefined/null
      setErrors({});
      setHasChanges(false);
      setShowWarning(false);
    }
  }, [raw, isLoadingEnv]);

  const handleEnvChange = (value: string) => {
    setEnvInput(value);
    // Check if there are changes - compare with raw value (handle undefined as empty)
    const currentRaw = raw ?? '';
    setHasChanges(value !== currentRaw);
    setShowWarning(value !== currentRaw);
    if (errors.env) {
      setErrors((prev) => ({ ...prev, env: undefined }));
    }
  };

  const parseEnvVariables = (text: string): Record<string, string> => {
    const envObj: Record<string, string> = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=');
        if (key) {
          envObj[key.trim()] = val.trim();
        }
      }
    }
    return envObj;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const parsed = parseEnvVariables(envInput);

    // Check for invalid variable names
    const invalidKeys = Object.keys(parsed).filter(
      (key) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
    );

    if (invalidKeys.length > 0) {
      newErrors.env = formatMessage(
        { id: 'codexlens.advanced.validation.invalidKeys' },
        { keys: invalidKeys.join(', ') }
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const parsed = parseEnvVariables(envInput);
      const result = await updateEnv({ env: parsed });

      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.advanced.saveSuccess' }),
          result.message || formatMessage({ id: 'codexlens.advanced.envUpdated' })
        );
        refetch();
        setShowWarning(false);
      } else {
        showError(
          formatMessage({ id: 'codexlens.advanced.saveFailed' }),
          result.message || formatMessage({ id: 'codexlens.advanced.saveError' })
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.advanced.saveFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.advanced.unknownError' })
      );
    }
  };

  const handleReset = () => {
    // Reset to current raw value (handle undefined as empty)
    setEnvInput(raw ?? '');
    setErrors({});
    setHasChanges(false);
    setShowWarning(false);
  };

  const isLoading = isLoadingEnv;

  // Get current env variables as array for display
  const currentEnvVars = env
    ? Object.entries(env).map(([key, value]) => ({ key, value }))
    : [];

  // Get settings variables
  const settingsVars = settings
    ? Object.entries(settings).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <div className="space-y-6">
      {/* Error Card */}
      {envError && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-destructive-foreground">
                {formatMessage({ id: 'codexlens.advanced.loadError' })}
              </h4>
              <p className="text-xs text-destructive-foreground/80 mt-1">
                {envError.message || formatMessage({ id: 'codexlens.advanced.loadErrorDesc' })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'common.actions.retry' })}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Sensitivity Warning Card */}
      {showWarning && (
        <Card className="p-4 bg-warning/10 border-warning/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-warning-foreground">
                {formatMessage({ id: 'codexlens.advanced.warningTitle' })}
              </h4>
              <p className="text-xs text-warning-foreground/80 mt-1">
                {formatMessage({ id: 'codexlens.advanced.warningMessage' })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Current Variables Summary */}
      {(currentEnvVars.length > 0 || settingsVars.length > 0) && (
        <Card className="p-4 bg-muted/30">
          <h4 className="text-sm font-medium text-foreground mb-3">
            {formatMessage({ id: 'codexlens.advanced.currentVars' })}
          </h4>
          <div className="space-y-3">
            {settingsVars.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatMessage({ id: 'codexlens.advanced.settingsVars' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {settingsVars.map(({ key }) => (
                    <Badge key={key} variant="outline" className="font-mono text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {currentEnvVars.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatMessage({ id: 'codexlens.advanced.customVars' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentEnvVars.map(({ key }) => (
                    <Badge key={key} variant="secondary" className="font-mono text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CCW Tools Card */}
      <CcwToolsCard />

      {/* Environment Variables Editor */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              {formatMessage({ id: 'codexlens.advanced.envEditor' })}
            </h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatMessage({ id: 'codexlens.advanced.envFile' })}: .env
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Env Textarea */}
          <div className="space-y-2">
            <Label htmlFor="env-input">
              {formatMessage({ id: 'codexlens.advanced.envContent' })}
            </Label>
            <Textarea
              id="env-input"
              value={envInput}
              onChange={(e) => handleEnvChange(e.target.value)}
              placeholder={formatMessage({ id: 'codexlens.advanced.envPlaceholder' })}
              className={cn(
                'min-h-[300px] font-mono text-sm',
                errors.env && 'border-destructive focus-visible:ring-destructive'
              )}
              disabled={isLoading}
            />
            {errors.env && (
              <p className="text-sm text-destructive">{errors.env}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.advanced.envHint' })}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || isUpdating || !hasChanges}
            >
              <Save className={cn('w-4 h-4 mr-2', isUpdating && 'animate-spin')} />
              {isUpdating
                ? formatMessage({ id: 'codexlens.advanced.saving' })
                : formatMessage({ id: 'codexlens.advanced.save' })
              }
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isLoading || !hasChanges}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'codexlens.advanced.reset' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Help Card */}
      <Card className="p-4 bg-info/10 border-info/20">
        <h4 className="text-sm font-medium text-info-foreground mb-2">
          {formatMessage({ id: 'codexlens.advanced.helpTitle' })}
        </h4>
        <ul className="text-xs text-info-foreground/80 space-y-1">
          <li>• {formatMessage({ id: 'codexlens.advanced.helpComment' })}</li>
          <li>• {formatMessage({ id: 'codexlens.advanced.helpFormat' })}</li>
          <li>• {formatMessage({ id: 'codexlens.advanced.helpQuotes' })}</li>
          <li>• {formatMessage({ id: 'codexlens.advanced.helpRestart' })}</li>
        </ul>
      </Card>
    </div>
  );
}

export default AdvancedTab;
