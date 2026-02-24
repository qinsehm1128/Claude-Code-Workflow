// ========================================
// Hook Form Dialog Component
// ========================================
// Dialog for creating and editing hooks

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { HookCardData, HookTriggerType } from './HookCard';

// ========== Types ==========

export type HookFormMode = 'create' | 'edit';

export interface HookFormData {
  name: string;
  description: string;
  trigger: HookTriggerType;
  matcher: string;
  command: string;
}

export interface HookFormDialogProps {
  mode: HookFormMode;
  hook?: HookCardData;
  open: boolean;
  onClose: () => void;
  onSave: (data: HookFormData) => Promise<void>;
}

// ========== Helper: Form Validation ==========

interface FormErrors {
  name?: string;
  trigger?: string;
  command?: string;
}

function validateForm(data: HookFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.name.trim()) {
    errors.name = 'validation.nameRequired';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(data.name)) {
    errors.name = 'validation.nameInvalid';
  }

  if (!data.trigger) {
    errors.trigger = 'validation.triggerRequired';
  }

  if (!data.command.trim()) {
    errors.command = 'validation.commandRequired';
  }

  return errors;
}

// ========== Component ==========

export function HookFormDialog({
  mode,
  hook,
  open,
  onClose,
  onSave,
}: HookFormDialogProps) {
  const { formatMessage } = useIntl();
  const [formData, setFormData] = useState<HookFormData>({
    name: '',
    description: '',
    trigger: 'PostToolUse',
    matcher: '',
    command: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens or hook changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && hook) {
        setFormData({
          name: hook.name,
          description: hook.description || '',
          trigger: hook.trigger,
          matcher: hook.matcher || '',
          command: hook.command || hook.script || '',
        });
      } else {
        setFormData({
          name: '',
          description: '',
          trigger: 'PostToolUse',
          matcher: '',
          command: '',
        });
      }
      setErrors({});
    }
  }, [open, mode, hook]);

  const handleFieldChange = (
    field: keyof HookFormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    // Validate form
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save hook:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const TRIGGER_OPTIONS: { value: HookTriggerType; label: string }[] = [
    { value: 'SessionStart', label: 'cliHooks.trigger.SessionStart' },
    { value: 'UserPromptSubmit', label: 'cliHooks.trigger.UserPromptSubmit' },
    { value: 'PreToolUse', label: 'cliHooks.trigger.PreToolUse' },
    { value: 'PostToolUse', label: 'cliHooks.trigger.PostToolUse' },
    { value: 'Stop', label: 'cliHooks.trigger.Stop' },
    { value: 'Notification', label: 'cliHooks.trigger.Notification' },
    { value: 'SubagentStart', label: 'cliHooks.trigger.SubagentStart' },
    { value: 'SubagentStop', label: 'cliHooks.trigger.SubagentStop' },
    { value: 'PreCompact', label: 'cliHooks.trigger.PreCompact' },
    { value: 'SessionEnd', label: 'cliHooks.trigger.SessionEnd' },
    { value: 'PostToolUseFailure', label: 'cliHooks.trigger.PostToolUseFailure' },
    { value: 'PermissionRequest', label: 'cliHooks.trigger.PermissionRequest' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? formatMessage({ id: 'cliHooks.dialog.createTitle' })
              : formatMessage({ id: 'cliHooks.dialog.editTitle' }, { hookName: hook?.name })
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div>
            <label htmlFor="hook-name" className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'cliHooks.form.name' })} *
            </label>
            <Input
              id="hook-name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder={formatMessage({ id: 'cliHooks.form.namePlaceholder' })}
              className="mt-1"
              error={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">
                {formatMessage({ id: `cliHooks.${errors.name}` })}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="hook-description" className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'cliHooks.form.description' })}
            </label>
            <Textarea
              id="hook-description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder={formatMessage({ id: 'cliHooks.form.descriptionPlaceholder' })}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Trigger */}
          <div>
            <label htmlFor="hook-trigger" className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'cliHooks.form.trigger' })} *
            </label>
            <Select
              value={formData.trigger}
              onValueChange={(value) => handleFieldChange('trigger', value as HookTriggerType)}
            >
              <SelectTrigger className="mt-1" id="hook-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {formatMessage({ id: option.label })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.trigger && (
              <p className="text-xs text-destructive mt-1">
                {formatMessage({ id: `cliHooks.${errors.trigger}` })}
              </p>
            )}
          </div>

          {/* Matcher */}
          <div>
            <label htmlFor="hook-matcher" className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'cliHooks.form.matcher' })}
            </label>
            <Input
              id="hook-matcher"
              value={formData.matcher}
              onChange={(e) => handleFieldChange('matcher', e.target.value)}
              placeholder={formatMessage({ id: 'cliHooks.form.matcherPlaceholder' })}
              className="mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formatMessage({ id: 'cliHooks.form.matcherHelp' })}
            </p>
          </div>

          {/* Command */}
          <div>
            <label htmlFor="hook-command" className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'cliHooks.form.command' })} *
            </label>
            <Textarea
              id="hook-command"
              value={formData.command}
              onChange={(e) => handleFieldChange('command', e.target.value)}
              placeholder={formatMessage({ id: 'cliHooks.form.commandPlaceholder' })}
              className="mt-1 font-mono text-sm"
              rows={4}
              error={!!errors.command}
            />
            {errors.command && (
              <p className="text-xs text-destructive mt-1">
                {formatMessage({ id: `cliHooks.${errors.command}` })}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formatMessage({ id: 'cliHooks.form.commandHelp' })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? formatMessage({ id: 'common.actions.saving' })
              : formatMessage({ id: 'common.actions.save' })
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HookFormDialog;
