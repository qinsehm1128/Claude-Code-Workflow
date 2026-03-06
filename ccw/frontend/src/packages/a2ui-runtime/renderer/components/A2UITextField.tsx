// ========================================
// A2UI TextField Component Renderer
// ========================================
// Maps A2UI TextField component to shadcn/ui Input

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveLiteralOrBinding } from '../A2UIRenderer';
import type { TextFieldComponent } from '../../core/A2UITypes';

export const A2UITextField: ComponentRenderer = ({ component, onAction, resolveBinding }) => {
  const fieldComp = component as TextFieldComponent;
  const { TextField: fieldConfig } = fieldComp;

  const initialValue = fieldConfig.value
    ? String(resolveLiteralOrBinding(fieldConfig.value, resolveBinding) ?? '')
    : '';

  const [localValue, setLocalValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const validate = useCallback((value: string) => {
    if (fieldConfig.required && !value) {
      return 'This field is required.';
    }
    if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
      return `Must be at least ${fieldConfig.minLength} characters.`;
    }
    if (fieldConfig.maxLength && value.length > fieldConfig.maxLength) {
      return `Must be at most ${fieldConfig.maxLength} characters.`;
    }
    if (fieldConfig.pattern && !new RegExp(fieldConfig.pattern).test(value)) {
      return 'Invalid format.';
    }
    // `validator` is a placeholder for a more complex validation logic if needed
    if (fieldConfig.validator) {
      // Assuming validator is a regex string for simplicity
      try {
        if (!new RegExp(fieldConfig.validator).test(value)) {
            return 'Custom validation failed.';
        }
      } catch (e) {
        console.error('Invalid validator regex:', fieldConfig.validator);
      }
    }
    return null;
  }, [fieldConfig.required, fieldConfig.minLength, fieldConfig.maxLength, fieldConfig.pattern, fieldConfig.validator]);

  useEffect(() => {
    setLocalValue(initialValue);
    // Re-validate when initial value changes
    if (touched) {
      setError(validate(initialValue));
    }
  }, [initialValue, touched, validate]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setError(validate(newValue));
    
    onAction(fieldConfig.onChange.actionId, {
      value: newValue,
      ...(fieldConfig.onChange.parameters || {}),
    });
  }, [fieldConfig.onChange, onAction, validate]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    setError(validate(localValue));
  }, [localValue, validate]);

  return (
    <div>
      <Input
        type={fieldConfig.type || 'text'}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={fieldConfig.placeholder}
        className={cn(touched && error && 'border-destructive')}
        maxLength={fieldConfig.maxLength}
        minLength={fieldConfig.minLength}
        required={fieldConfig.required}
        pattern={fieldConfig.pattern}
      />
      {touched && error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};
