// ========================================
// SpecDialog Component
// ========================================
// Dialog for editing spec frontmatter (title, readMode, priority, keywords)

import * as React from 'react';
import { useIntl } from 'react-intl';
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
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';
import { Tag, X } from 'lucide-react';
import type { Spec, SpecReadMode, SpecPriority } from './SpecCard';

// ========== Types ==========

/**
 * Spec form data for editing
 */
export interface SpecFormData {
  title: string;
  readMode: SpecReadMode;
  priority: SpecPriority;
  keywords: string[];
}

/**
 * SpecDialog component props
 */
export interface SpecDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Called when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Spec being edited */
  spec: Spec | null;
  /** Called when save is clicked */
  onSave: (specId: string, data: SpecFormData) => Promise<void> | void;
  /** Optional loading state */
  isLoading?: boolean;
}

// ========== Constants ==========

const READ_MODE_OPTIONS: { value: SpecReadMode; labelKey: string }[] = [
  { value: 'required', labelKey: 'specs.readMode.required' },
  { value: 'optional', labelKey: 'specs.readMode.optional' },
];

const PRIORITY_OPTIONS: { value: SpecPriority; labelKey: string }[] = [
  { value: 'critical', labelKey: 'specs.priority.critical' },
  { value: 'high', labelKey: 'specs.priority.high' },
  { value: 'medium', labelKey: 'specs.priority.medium' },
  { value: 'low', labelKey: 'specs.priority.low' },
];

// ========== Component ==========

/**
 * SpecDialog component for editing spec frontmatter
 */
export function SpecDialog({
  open,
  onOpenChange,
  spec,
  onSave,
  isLoading = false,
}: SpecDialogProps) {
  const { formatMessage } = useIntl();
  const [formData, setFormData] = React.useState<SpecFormData>({
    title: '',
    readMode: 'optional',
    priority: 'medium',
    keywords: [],
  });
  const [keywordInput, setKeywordInput] = React.useState('');
  const [errors, setErrors] = React.useState<Partial<Record<keyof SpecFormData, string>>>({});

  // Reset form when spec changes
  React.useEffect(() => {
    if (spec) {
      setFormData({
        title: spec.title,
        readMode: spec.readMode,
        priority: spec.priority,
        keywords: [...spec.keywords],
      });
      setErrors({});
      setKeywordInput('');
    }
  }, [spec]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SpecFormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = formatMessage({ id: 'specs.validation.titleRequired' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!spec || !validateForm()) return;

    await onSave(spec.id, formData);
  };

  // Handle keyword input
  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    }
  };

  // Add keyword
  const addKeyword = () => {
    const keyword = keywordInput.trim().toLowerCase();
    if (keyword && !formData.keywords.includes(keyword)) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, keyword],
      }));
    }
    setKeywordInput('');
  };

  // Remove keyword
  const removeKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }));
  };

  if (!spec) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {formatMessage({ id: 'specs.dialog.editTitle' }, { title: spec.title })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'specs.dialog.editDescription' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title field */}
          <div className="space-y-2">
            <Label htmlFor="title">
              {formatMessage({ id: 'specs.form.title' })}
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={formatMessage({ id: 'specs.form.titlePlaceholder' })}
              error={!!errors.title}
              disabled={isLoading}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Read mode and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{formatMessage({ id: 'specs.form.readMode' })}</Label>
              <Select
                value={formData.readMode}
                onValueChange={(value: SpecReadMode) =>
                  setFormData((prev) => ({ ...prev, readMode: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {READ_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {formatMessage({ id: option.labelKey })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{formatMessage({ id: 'specs.form.priority' })}</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: SpecPriority) =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {formatMessage({ id: option.labelKey })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">
              {formatMessage({ id: 'specs.form.keywords' })}
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="keywords"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  onBlur={addKeyword}
                  placeholder={formatMessage({ id: 'specs.form.keywordsPlaceholder' })}
                  disabled={isLoading}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addKeyword}
                disabled={isLoading || !keywordInput.trim()}
              >
                {formatMessage({ id: 'specs.form.addKeyword' })}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.form.keywordsHint' })}
            </p>

            {/* Keywords display */}
            {formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                {formData.keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="text-xs pl-2 pr-1 gap-1"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* File info */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'specs.form.fileInfo' }, { file: spec.file })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {formatMessage({ id: 'common.cancel' })}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading
              ? formatMessage({ id: 'specs.form.saving' })
              : formatMessage({ id: 'common.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SpecDialog;
