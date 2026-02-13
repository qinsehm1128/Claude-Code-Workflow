// ========================================
// A2UI TextArea Component Renderer
// ========================================
// Maps A2UI TextArea component to shadcn/ui Textarea

import { useState, useCallback } from 'react';
import { Textarea } from '@/components/ui/Textarea';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveLiteralOrBinding } from '../A2UIRenderer';
import type { TextAreaComponent } from '../../core/A2UITypes';

/**
 * A2UI TextArea Component Renderer
 * Two-way binding via onChange updates to local state
 */
export const A2UITextArea: ComponentRenderer = ({ component, onAction, resolveBinding }) => {
  const areaComp = component as TextAreaComponent;
  const { TextArea: areaConfig } = areaComp;

  // Resolve initial value from binding or use empty string
  const initialValue = areaConfig.value
    ? String(resolveLiteralOrBinding(areaConfig.value, resolveBinding) ?? '')
    : '';

  // Local state for controlled input
  const [localValue, setLocalValue] = useState(initialValue);

  // Handle change with two-way binding
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Trigger action with new value
    onAction(areaConfig.onChange.actionId, {
      value: newValue,
      ...(areaConfig.onChange.parameters || {}),
    });
  }, [areaConfig.onChange, onAction]);

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      placeholder={areaConfig.placeholder}
      rows={areaConfig.rows}
    />
  );
};
