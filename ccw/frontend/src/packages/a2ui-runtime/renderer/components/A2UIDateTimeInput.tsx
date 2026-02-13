// ========================================
// A2UI DateTimeInput Component Renderer
// ========================================
// Date/time picker with ISO string format support

import { useState, useCallback, useEffect } from 'react';
import type { ComponentRenderer } from '../../core/A2UIComponentRegistry';
import { resolveTextContent } from '../A2UIRenderer';
import type { DateTimeInputComponent } from '../../core/A2UITypes';

/**
 * Convert ISO string to datetime-local input format (YYYY-MM-DDTHH:mm)
 */
function isoToDateTimeLocal(isoString: string): string {
  if (!isoString) return '';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  // Format: YYYY-MM-DDTHH:mm
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local input format to ISO string
 */
function dateTimeLocalToIso(dateTimeLocal: string, _includeTime: boolean): string {
  if (!dateTimeLocal) return '';

  const date = new Date(dateTimeLocal);
  if (isNaN(date.getTime())) return '';

  return date.toISOString();
}

/**
 * A2UI DateTimeInput Component Renderer
 * Uses native input[type="datetime-local"] or input[type="date"] based on includeTime
 */
export const A2UIDateTimeInput: ComponentRenderer = ({ component, onAction, resolveBinding }) => {
  const dateTimeComp = component as DateTimeInputComponent;
  const { DateTimeInput: config } = dateTimeComp;
  const includeTime = config.includeTime ?? true;

  // Resolve initial value
  const getInitialValue = (): string => {
    if (!config.value) return '';
    const resolved = resolveTextContent(config.value, resolveBinding);
    return resolved || '';
  };

  const [internalValue, setInternalValue] = useState(getInitialValue);

  // Update internal value when binding changes
  useEffect(() => {
    setInternalValue(getInitialValue());
  }, [config.value]);

  // Resolve min/max date constraints
  const minDate = config.minDate ? resolveTextContent(config.minDate, resolveBinding) : undefined;
  const maxDate = config.maxDate ? resolveTextContent(config.maxDate, resolveBinding) : undefined;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    // Convert to ISO string and trigger action
    const isoValue = dateTimeLocalToIso(newValue, includeTime);
    onAction(config.onChange.actionId, {
      ...config.onChange.parameters,
      value: isoValue,
    });
  }, [onAction, config.onChange, includeTime]);

  const inputType = includeTime ? 'datetime-local' : 'date';
  const inputMin = minDate ? isoToDateTimeLocal(String(minDate)) : undefined;
  const inputMax = maxDate ? isoToDateTimeLocal(String(maxDate)) : undefined;
  const inputValue = internalValue ? isoToDateTimeLocal(String(internalValue)) : '';

  return (
    <div className="a2ui-datetime-input">
      <input
        type={inputType}
        value={inputValue}
        onChange={handleChange}
        placeholder={config.placeholder || (includeTime ? 'Select date and time' : 'Select date')}
        min={inputMin}
        max={inputMax}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />
    </div>
  );
};

// Utility function for className merging
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
