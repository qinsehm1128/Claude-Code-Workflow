// ========================================
// SchemaFormRenderer Component
// ========================================
// Renders structured form groups from EnvVarGroupsSchema definition
// Supports select, number, checkbox, text, and model-select field types

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Box,
  ArrowUpDown,
  Cpu,
  GitBranch,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/Collapsible';
import { cn } from '@/lib/utils';
import { evaluateShowWhen } from './envVarSchema';
import { ModelSelectField } from './ModelSelectField';
import type { EnvVarGroupsSchema, EnvVarFieldSchema } from '@/types/codexlens';
import type { CodexLensModel } from '@/lib/api';

// Icon mapping for group icons
const iconMap: Record<string, LucideIcon> = {
  box: Box,
  'arrow-up-down': ArrowUpDown,
  cpu: Cpu,
  'git-branch': GitBranch,
  scissors: Scissors,
};

interface SchemaFormRendererProps {
  /** The schema defining all groups and fields */
  groups: EnvVarGroupsSchema;
  /** Current form values keyed by env var name */
  values: Record<string, string>;
  /** Called when a field value changes */
  onChange: (key: string, value: string) => void;
  /** Whether the form is disabled (loading state) */
  disabled?: boolean;
  /** Local embedding models (installed) for model-select */
  localEmbeddingModels?: CodexLensModel[];
  /** Local reranker models (installed) for model-select */
  localRerankerModels?: CodexLensModel[];
}

export function SchemaFormRenderer({
  groups,
  values,
  onChange,
  disabled = false,
  localEmbeddingModels = [],
  localRerankerModels = [],
}: SchemaFormRendererProps) {
  const { formatMessage } = useIntl();

  const groupEntries = useMemo(() => Object.entries(groups), [groups]);

  return (
    <div className="space-y-3">
      {groupEntries.map(([groupKey, group]) => {
        const IconComponent = iconMap[group.icon] || Box;

        return (
          <Collapsible key={groupKey} defaultOpen>
            <div className="border border-border rounded-lg">
              <CollapsibleTrigger className="flex w-full items-center gap-2 p-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <IconComponent className="w-3.5 h-3.5" />
                {formatMessage({ id: group.labelKey, defaultMessage: groupKey })}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2">
                  {Object.entries(group.vars).map(([varKey, field]) => {
                    const visible = evaluateShowWhen(field, values);
                    if (!visible) return null;

                    return (
                      <FieldRenderer
                        key={varKey}
                        field={field}
                        value={values[varKey] ?? field.default ?? ''}
                        onChange={(val) => onChange(varKey, val)}
                        allValues={values}
                        disabled={disabled}
                        localModels={
                          varKey.includes('EMBEDDING')
                            ? localEmbeddingModels
                            : localRerankerModels
                        }
                        formatMessage={formatMessage}
                      />
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ========================================
// Individual Field Renderer
// ========================================

interface FieldRendererProps {
  field: EnvVarFieldSchema;
  value: string;
  onChange: (value: string) => void;
  allValues: Record<string, string>;
  disabled: boolean;
  localModels: CodexLensModel[];
  formatMessage: (descriptor: { id: string; defaultMessage?: string }) => string;
}

function FieldRenderer({
  field,
  value,
  onChange,
  allValues,
  disabled,
  localModels,
  formatMessage,
}: FieldRendererProps) {
  const label = formatMessage({ id: field.labelKey, defaultMessage: field.key });

  switch (field.type) {
    case 'select':
      return (
        <div className="flex items-center gap-2">
          <Label
            className="text-xs text-muted-foreground w-28 flex-shrink-0"
            title={field.key}
          >
            {label}
          </Label>
          <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger className={cn('flex-1 h-8 text-xs')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'number':
      return (
        <div className="flex items-center gap-2">
          <Label
            className="text-xs text-muted-foreground w-28 flex-shrink-0"
            title={field.key}
          >
            {label}
          </Label>
          <Input
            type="number"
            className="flex-1 h-8 text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
          />
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Label
            className="text-xs text-muted-foreground w-28 flex-shrink-0"
            title={field.key}
          >
            {label}
          </Label>
          <div className="flex-1 flex items-center h-8">
            <Checkbox
              checked={value === 'true'}
              onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
              disabled={disabled}
            />
          </div>
        </div>
      );

    case 'model-select': {
      // Determine backend type from related backend env var
      const isEmbedding = field.key.includes('EMBEDDING');
      const backendKey = isEmbedding
        ? 'CODEXLENS_EMBEDDING_BACKEND'
        : 'CODEXLENS_RERANKER_BACKEND';
      const backendValue = allValues[backendKey];
      const backendType = (backendValue === 'api' || backendValue === 'litellm') ? 'api' : 'local';

      return (
        <div className="flex items-center gap-2">
          <Label
            className="text-xs text-muted-foreground w-28 flex-shrink-0"
            title={field.key}
          >
            {label}
          </Label>
          <ModelSelectField
            field={field}
            value={value}
            onChange={onChange}
            localModels={localModels}
            backendType={backendType}
            disabled={disabled}
          />
        </div>
      );
    }

    case 'text':
    default:
      return (
        <div className="flex items-center gap-2">
          <Label
            className="text-xs text-muted-foreground w-28 flex-shrink-0"
            title={field.key}
          >
            {label}
          </Label>
          <Input
            type="text"
            className="flex-1 h-8 text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
          />
        </div>
      );
  }
}

export default SchemaFormRenderer;
