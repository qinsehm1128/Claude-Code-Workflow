// ========================================
// CLI Endpoint Form Dialog
// ========================================
// Dialog for creating and editing CLI endpoints

import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useNotifications } from '@/hooks/useNotifications';
import type { CliEndpoint } from '@/lib/api';

export type CliEndpointFormMode = 'create' | 'edit';

export interface CliEndpointSavePayload {
  name: string;
  type: CliEndpoint['type'];
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface CliEndpointFormDialogProps {
  mode: CliEndpointFormMode;
  endpoint?: CliEndpoint;
  open: boolean;
  onClose: () => void;
  onSave: (payload: CliEndpointSavePayload) => Promise<void>;
}

interface FormErrors {
  name?: string;
  type?: string;
  configJson?: string;
}

function safeStringifyConfig(config: unknown): string {
  try {
    return JSON.stringify(config ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

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
      return { ok: false, errorKey: 'validation.configMustBeObject' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, errorKey: 'validation.invalidJson' };
  }
}

export function CliEndpointFormDialog({
  mode,
  endpoint,
  open,
  onClose,
  onSave,
}: CliEndpointFormDialogProps) {
  const { formatMessage } = useIntl();
  const { error: showError } = useNotifications();
  const isEditing = mode === 'edit';

  const [name, setName] = useState('');
  const [type, setType] = useState<CliEndpoint['type']>('custom');
  const [enabled, setEnabled] = useState(true);
  const [configJson, setConfigJson] = useState('{}');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogTitle = useMemo(() => {
    return isEditing
      ? formatMessage({ id: 'cliEndpoints.dialog.editTitle' }, { id: endpoint?.id ?? '' })
      : formatMessage({ id: 'cliEndpoints.dialog.createTitle' });
  }, [formatMessage, isEditing, endpoint?.id]);

  useEffect(() => {
    if (!open) return;

    if (isEditing && endpoint) {
      setName(endpoint.name);
      setType(endpoint.type);
      setEnabled(endpoint.enabled);
      setConfigJson(safeStringifyConfig(endpoint.config));
    } else {
      setName('');
      setType('custom');
      setEnabled(true);
      setConfigJson('{}');
    }
    setErrors({});
    setIsSubmitting(false);
  }, [open, isEditing, endpoint]);

  const handleSubmit = async () => {
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = 'validation.nameRequired';
    }
    if (!type) {
      nextErrors.type = 'validation.typeRequired';
    }

    const parsedConfig = parseConfigJson(configJson);
    if (!parsedConfig.ok) {
      nextErrors.configJson = parsedConfig.errorKey;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        enabled,
        config: (parsedConfig as { ok: true; value: Record<string, unknown> }).value,
      });
      onClose();
    } catch (err) {
      showError(formatMessage({ id: 'cliEndpoints.messages.saveFailed' }));
      console.error('Failed to save CLI endpoint:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isEditing && endpoint && (
            <div className="space-y-2">
              <Label htmlFor="cli-endpoint-id">{formatMessage({ id: 'cliEndpoints.id' })}</Label>
              <Input
                id="cli-endpoint-id"
                value={endpoint.id}
                disabled
                className="font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cli-endpoint-name">
                {formatMessage({ id: 'cliEndpoints.form.name' })} *
              </Label>
              <Input
                id="cli-endpoint-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder={formatMessage({ id: 'cliEndpoints.form.namePlaceholder' })}
                error={!!errors.name}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {formatMessage({ id: `cliEndpoints.${errors.name}` })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cli-endpoint-type">
                {formatMessage({ id: 'cliEndpoints.form.type' })} *
              </Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v as CliEndpoint['type']);
                  if (errors.type) setErrors((prev) => ({ ...prev, type: undefined }));
                }}
              >
                <SelectTrigger id="cli-endpoint-type" className={errors.type ? 'border-destructive' : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="litellm">{formatMessage({ id: 'cliEndpoints.type.litellm' })}</SelectItem>
                  <SelectItem value="custom">{formatMessage({ id: 'cliEndpoints.type.custom' })}</SelectItem>
                  <SelectItem value="wrapper">{formatMessage({ id: 'cliEndpoints.type.wrapper' })}</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-xs text-destructive">
                  {formatMessage({ id: `cliEndpoints.${errors.type}` })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{formatMessage({ id: 'cliEndpoints.form.enabled' })}</p>
              <p className="text-xs text-muted-foreground">{formatMessage({ id: 'cliEndpoints.form.enabledHint' })}</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cli-endpoint-config">{formatMessage({ id: 'cliEndpoints.form.configJson' })}</Label>
            <Textarea
              id="cli-endpoint-config"
              value={configJson}
              onChange={(e) => {
                setConfigJson(e.target.value);
                if (errors.configJson) setErrors((prev) => ({ ...prev, configJson: undefined }));
              }}
              placeholder={formatMessage({ id: 'cliEndpoints.form.configJsonPlaceholder' })}
              className={errors.configJson ? 'font-mono border-destructive' : 'font-mono'}
              rows={10}
            />
            {errors.configJson && (
              <p className="text-xs text-destructive">
                {formatMessage({ id: `cliEndpoints.${errors.configJson}` })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? formatMessage({ id: 'common.actions.saving' })
              : formatMessage({ id: 'common.actions.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CliEndpointFormDialog;
