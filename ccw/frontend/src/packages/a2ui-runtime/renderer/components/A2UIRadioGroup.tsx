// ========================================
// A2UI RadioGroup Component Renderer
// ========================================
// Maps A2UI RadioGroup component to shadcn/ui RadioGroup
// Used for single-select questions with visible options

import { useState, useCallback } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Label } from '@/components/ui/Label';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveLiteralOrBinding, resolveTextContent } from '../A2UIRenderer';
import type { RadioGroupComponent } from '../../core/A2UITypes';

/**
 * A2UI RadioGroup Component Renderer
 * Single selection from visible options with onChange handler
 */
export const A2UIRadioGroup: ComponentRenderer = ({ component, onAction, resolveBinding }) => {
  const radioGroupComp = component as RadioGroupComponent;
  const { RadioGroup: radioConfig } = radioGroupComp;

  // Resolve initial selected value from binding
  const getInitialValue = (): string | undefined => {
    if (!radioConfig.selectedValue) return undefined;
    const resolved = resolveLiteralOrBinding(radioConfig.selectedValue, resolveBinding);
    return resolved ? String(resolved) : undefined;
  };

  // Local state for controlled radio group
  const [selectedValue, setSelectedValue] = useState<string | undefined>(getInitialValue());

  // Handle change with action dispatch
  const handleChange = useCallback((newValue: string) => {
    setSelectedValue(newValue);

    // Trigger action with new selected value
    onAction(radioConfig.onChange.actionId, {
      value: newValue,
      ...(radioConfig.onChange.parameters || {}),
    });
  }, [radioConfig.onChange, onAction]);

  return (
    <RadioGroup value={selectedValue} onValueChange={handleChange} className="space-y-2">
      {radioConfig.options.map((option, idx) => {
        const labelText = resolveTextContent(option.label, resolveBinding);
        const descriptionText = option.description
          ? resolveTextContent(option.description, resolveBinding)
          : undefined;

        return (
          <div key={option.value || idx} className="flex items-start space-x-3 py-1">
            <RadioGroupItem
              value={option.value}
              id={`radio-${option.value}`}
              className="mt-0.5"
            />
            <div className="flex flex-col">
              <Label
                htmlFor={`radio-${option.value}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {labelText}
              </Label>
              {descriptionText && (
                <span className="text-xs text-muted-foreground mt-1">
                  {descriptionText}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </RadioGroup>
  );
};
