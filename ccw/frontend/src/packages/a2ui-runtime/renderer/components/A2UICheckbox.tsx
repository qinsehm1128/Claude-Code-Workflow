// ========================================
// A2UI Checkbox Component Renderer
// ========================================
// Maps A2UI Checkbox component to shadcn/ui Checkbox

import { useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveLiteralOrBinding, resolveTextContent } from '../A2UIRenderer';
import type { CheckboxComponent } from '../../core/A2UITypes';

/**
 * A2UI Checkbox Component Renderer
 * Boolean state binding with onChange handler
 */
export const A2UICheckbox: ComponentRenderer = ({ component, onAction, resolveBinding }) => {
  const checkboxComp = component as CheckboxComponent;
  const { Checkbox: checkboxConfig } = checkboxComp;

  // Resolve initial checked state from binding
  const getInitialChecked = (): boolean => {
    if (!checkboxConfig.checked) return false;
    const resolved = resolveLiteralOrBinding(checkboxConfig.checked, resolveBinding);
    return Boolean(resolved);
  };

  // Local state for controlled checkbox
  const [checked, setChecked] = useState(getInitialChecked());

  // Handle change with two-way binding
  const handleChange = useCallback((newChecked: boolean) => {
    setChecked(newChecked);

    // Trigger action with new checked state
    onAction(checkboxConfig.onChange.actionId, {
      checked: newChecked,
      ...(checkboxConfig.onChange.parameters || {}),
    });
  }, [checkboxConfig.onChange, onAction]);

  // Resolve label text
  const labelText = checkboxConfig.label
    ? resolveTextContent(checkboxConfig.label, resolveBinding)
    : '';

  // Resolve description text
  const descriptionText = checkboxConfig.description
    ? resolveTextContent(checkboxConfig.description, resolveBinding)
    : '';

  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={handleChange}
      />
      <div className="grid gap-0.5">
        {labelText && (
          <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {labelText}
          </Label>
        )}
        {descriptionText && (
          <p className="text-xs text-muted-foreground">{descriptionText}</p>
        )}
      </div>
    </div>
  );
};
