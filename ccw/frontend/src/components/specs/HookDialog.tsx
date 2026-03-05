// ========================================
// HookDialog Component
// ========================================
// Dialog for editing hook configuration

import * as React from 'react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Textarea } from '@/components/ui/Textarea';
import { Globe, Folder, HelpCircle } from 'lucide-react';
import {
  HookConfig,
  HookEvent,
  HookScope,
  HookFailMode,
} from './HookCard';

export interface HookDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Called when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Hook data to edit (undefined for new hook) */
  hook?: HookConfig;
  /** Called when save is triggered */
  onSave: (hook: Omit<HookConfig, 'id'> & { id?: string }) => void;
  /** Optional className */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Default hook configuration
 */
const defaultHookConfig: Omit<HookConfig, 'id'> = {
  name: '',
  event: 'SessionStart',
  command: '',
  description: '',
  scope: 'global',
  enabled: true,
  installed: true,
  timeout: 30000,
  failMode: 'continue',
};

/**
 * HookDialog component for editing hook configuration
 */
export function HookDialog({
  open,
  onOpenChange,
  hook,
  onSave,
  className,
  isLoading = false,
}: HookDialogProps) {
  const { formatMessage } = useIntl();
  const isEditing = !!hook;

  // Form state
  const [formData, setFormData] = React.useState<Omit<HookConfig, 'id'>>(defaultHookConfig);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Reset form when hook changes or dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData(hook ? { ...hook } : defaultHookConfig);
      setErrors({});
    }
  }, [open, hook]);

  // Update form field
  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = formatMessage({ id: 'specs.hooks.validation.nameRequired', defaultMessage: 'Name is required' });
    }

    if (!formData.command.trim()) {
      newErrors.command = formatMessage({ id: 'specs.hooks.validation.commandRequired', defaultMessage: 'Command is required' });
    }

    if (formData.timeout && formData.timeout < 1000) {
      newErrors.timeout = formatMessage({ id: 'specs.hooks.validation.timeoutMin', defaultMessage: 'Minimum timeout is 1000ms' });
    }

    if (formData.timeout && formData.timeout > 300000) {
      newErrors.timeout = formatMessage({ id: 'specs.hooks.validation.timeoutMax', defaultMessage: 'Maximum timeout is 300000ms' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    onSave({
      ...(hook ? { id: hook.id } : {}),
      ...formData,
    });
  };

  // Handle cancel
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[500px]', className)}>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'specs.hooks.dialog.editTitle', defaultMessage: 'Edit Hook' })
              : formatMessage({ id: 'specs.hooks.dialog.createTitle', defaultMessage: 'Create Hook' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'specs.hooks.dialog.description', defaultMessage: 'Configure the hook trigger event, command, and other settings.' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="required">
              {formatMessage({ id: 'specs.hooks.fields.name', defaultMessage: 'Hook Name' })}
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={formatMessage({ id: 'specs.hooks.placeholders.name', defaultMessage: 'Enter hook name' })}
              className={errors.name ? 'border-destructive' : ''}
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Event type field */}
          <div className="space-y-2">
            <Label htmlFor="event" className="required">
              {formatMessage({ id: 'specs.hooks.fields.event', defaultMessage: 'Trigger Event' })}
            </Label>
            <Select
              value={formData.event}
              onValueChange={(value) => updateField('event', value as HookEvent)}
              disabled={isLoading}
            >
              <SelectTrigger id="event">
                <SelectValue placeholder={formatMessage({ id: 'specs.hooks.placeholders.event', defaultMessage: 'Select event' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SessionStart">
                  {formatMessage({ id: 'specs.hooks.events.sessionStart', defaultMessage: 'Session Start' })}
                </SelectItem>
                <SelectItem value="UserPromptSubmit">
                  {formatMessage({ id: 'specs.hooks.events.userPromptSubmit', defaultMessage: 'User Prompt Submit' })}
                </SelectItem>
                <SelectItem value="SessionEnd">
                  {formatMessage({ id: 'specs.hooks.events.sessionEnd', defaultMessage: 'Session End' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.hints.hookEvents', defaultMessage: 'Select when this hook should be triggered' })}
            </p>
          </div>

          {/* Scope field */}
          <div className="space-y-2">
            <Label className="required">
              {formatMessage({ id: 'specs.hooks.fields.scope', defaultMessage: 'Scope' })}
            </Label>
            <RadioGroup
              value={formData.scope}
              onValueChange={(value) => updateField('scope', value as HookScope)}
              className="flex gap-4"
              disabled={isLoading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="scope-global" />
                <Label htmlFor="scope-global" className="flex items-center gap-1.5 cursor-pointer">
                  <Globe className="h-4 w-4" />
                  {formatMessage({ id: 'specs.hooks.scope.global', defaultMessage: 'Global' })}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="project" id="scope-project" />
                <Label htmlFor="scope-project" className="flex items-center gap-1.5 cursor-pointer">
                  <Folder className="h-4 w-4" />
                  {formatMessage({ id: 'specs.hooks.scope.project', defaultMessage: 'Project' })}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.hints.hookScope', defaultMessage: 'Global hooks apply to all projects, project hooks only to current project' })}
            </p>
          </div>

          {/* Command field */}
          <div className="space-y-2">
            <Label htmlFor="command" className="required">
              {formatMessage({ id: 'specs.hooks.fields.command', defaultMessage: 'Command' })}
            </Label>
            <Input
              id="command"
              value={formData.command}
              onChange={(e) => updateField('command', e.target.value)}
              placeholder={formatMessage({ id: 'specs.hooks.placeholders.command', defaultMessage: 'Enter command to execute' })}
              className={cn('font-mono', errors.command ? 'border-destructive' : '')}
              disabled={isLoading}
            />
            {errors.command && (
              <p className="text-xs text-destructive">{errors.command}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.hints.hookCommand', defaultMessage: 'Command to execute, can use environment variables' })}
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {formatMessage({ id: 'specs.hooks.fields.description', defaultMessage: 'Description' })}
            </Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder={formatMessage({ id: 'specs.hooks.placeholders.description', defaultMessage: 'Enter description (optional)' })}
              rows={2}
              disabled={isLoading}
            />
          </div>

          {/* Timeout field */}
          <div className="space-y-2">
            <Label htmlFor="timeout" className="flex items-center gap-1">
              {formatMessage({ id: 'specs.hooks.fields.timeout', defaultMessage: 'Timeout' })}
              <span className="text-xs text-muted-foreground">
                ({formatMessage({ id: 'specs.hooks.fields.timeoutUnit', defaultMessage: 'ms' })})
              </span>
            </Label>
            <Input
              id="timeout"
              type="number"
              value={formData.timeout || ''}
              onChange={(e) => updateField('timeout', parseInt(e.target.value, 10) || undefined)}
              placeholder="30000"
              className={errors.timeout ? 'border-destructive' : ''}
              disabled={isLoading}
              min={1000}
              max={300000}
            />
            {errors.timeout && (
              <p className="text-xs text-destructive">{errors.timeout}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.hints.hookTimeout', defaultMessage: 'Timeout for command execution' })}
            </p>
          </div>

          {/* Fail mode field */}
          <div className="space-y-2">
            <Label htmlFor="failMode" className="flex items-center gap-1">
              {formatMessage({ id: 'specs.hooks.fields.failMode', defaultMessage: 'Failure Mode' })}
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </Label>
            <Select
              value={formData.failMode || 'continue'}
              onValueChange={(value) => updateField('failMode', value as HookFailMode)}
              disabled={isLoading}
            >
              <SelectTrigger id="failMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continue">
                  {formatMessage({ id: 'specs.hooks.failModes.continue', defaultMessage: 'Continue' })}
                </SelectItem>
                <SelectItem value="warn">
                  {formatMessage({ id: 'specs.hooks.failModes.warn', defaultMessage: 'Warn' })}
                </SelectItem>
                <SelectItem value="block">
                  {formatMessage({ id: 'specs.hooks.failModes.block', defaultMessage: 'Block' })}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.hints.hookFailMode', defaultMessage: 'How to handle command execution failure' })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            {formatMessage({ id: 'specs.common.cancel', defaultMessage: 'Cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading
              ? formatMessage({ id: 'specs.common.saving', defaultMessage: 'Saving...' })
              : formatMessage({ id: 'specs.common.save', defaultMessage: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { type HookConfig, type HookEvent, type HookScope, type HookFailMode } from './HookCard';
