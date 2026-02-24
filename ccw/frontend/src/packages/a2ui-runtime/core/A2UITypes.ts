// ========================================
// A2UI Runtime Type Definitions
// ========================================
// Zod schemas and TypeScript interfaces for A2UI protocol
// Based on Google's A2UI specification

import { z } from 'zod';

// ========== Primitive Content Schemas ==========

/** Literal string content */
export const LiteralStringSchema = z.object({
  literalString: z.string(),
});

/** Binding content - references state by path */
export const BindingSchema = z.object({
  path: z.string(),
});

/** Text content can be literal or bound to state */
export const TextContentSchema = z.union([
  LiteralStringSchema,
  BindingSchema,
]);

/** Number content can be literal or bound to state */
export const NumberContentSchema = z.union([
  z.object({ literalNumber: z.number() }),
  BindingSchema,
]);

/** Boolean content can be literal or bound to state */
export const BooleanContentSchema = z.union([
  z.object({ literalBoolean: z.boolean() }),
  BindingSchema,
]);

// ========== Component Schemas ==========

/** Action trigger */
export const ActionSchema = z.object({
  actionId: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

/** Text component */
export const TextComponentSchema = z.object({
  Text: z.object({
    text: TextContentSchema,
    usageHint: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'code', 'small']).optional(),
  }),
});

/** Button component */
export const ButtonComponentSchema = z.object({
  Button: z.object({
    onClick: ActionSchema,
    content: z.lazy(() => ComponentSchema),
    variant: z.enum(['primary', 'secondary', 'destructive', 'ghost', 'outline']).optional(),
    disabled: BooleanContentSchema.optional(),
  }),
});

/** Dropdown option schema (enhanced with description, icon, disabled, group) */
export const DropdownOptionSchema = z.object({
  label: TextContentSchema,
  value: z.string(),
  description: TextContentSchema.optional(),
  icon: z.string().optional(),
  disabled: BooleanContentSchema.optional(),
  group: z.string().optional(),
});

/** Dropdown/Select component (enhanced with search, form integration, styling) */
export const DropdownComponentSchema = z.object({
  Dropdown: z.object({
    options: z.array(DropdownOptionSchema),
    selectedValue: TextContentSchema.optional(),
    onChange: ActionSchema,
    placeholder: z.string().optional(),
    // Enhanced features
    searchable: z.boolean().optional(),
    clearable: z.boolean().optional(),
    size: z.enum(['sm', 'default', 'lg']).optional(),
    // Form integration
    label: TextContentSchema.optional(),
    required: z.boolean().optional(),
    error: TextContentSchema.optional(),
  }),
});

/** Text input component */
export const TextFieldComponentSchema = z.object({
  TextField: z.object({
    value: TextContentSchema.optional(),
    onChange: ActionSchema,
    placeholder: z.string().optional(),
    type: z.enum(['text', 'email', 'password', 'number', 'url']).optional(),
  }),
});

/** Text area component */
export const TextAreaComponentSchema = z.object({
  TextArea: z.object({
    value: TextContentSchema.optional(),
    onChange: ActionSchema,
    placeholder: z.string().optional(),
    rows: z.number().optional(),
  }),
});

/** Checkbox component */
export const CheckboxComponentSchema = z.object({
  Checkbox: z.object({
    checked: BooleanContentSchema.optional(),
    onChange: ActionSchema,
    label: TextContentSchema.optional(),
    description: TextContentSchema.optional(),
  }),
});

/** RadioGroup component - single selection from multiple options */
export const RadioGroupComponentSchema = z.object({
  RadioGroup: z.object({
    options: z.array(z.object({
      label: TextContentSchema,
      value: z.string(),
      description: TextContentSchema.optional(),
      isDefault: z.boolean().optional(),
    })),
    selectedValue: TextContentSchema.optional(),
    onChange: ActionSchema,
  }),
});

/** Code block component */
export const CodeBlockComponentSchema = z.object({
  CodeBlock: z.object({
    code: TextContentSchema,
    language: z.string().optional(),
  }),
});

/** Progress component */
export const ProgressComponentSchema = z.object({
  Progress: z.object({
    value: NumberContentSchema.optional(),
    max: z.number().optional(),
  }),
});

/** Card container component */
export const CardComponentSchema = z.object({
  Card: z.object({
    content: z.array(z.lazy(() => ComponentSchema)),
    title: TextContentSchema.optional(),
    description: TextContentSchema.optional(),
  }),
});

/** CLIOutput component - for streaming CLI output with syntax highlighting */
export const CLIOutputComponentSchema = z.object({
  CLIOutput: z.object({
    output: TextContentSchema,
    language: z.string().optional(),
    streaming: z.boolean().optional(),
    maxLines: z.number().optional(),
  }),
});

/** DateTimeInput component - for date/time selection */
export const DateTimeInputComponentSchema = z.object({
  DateTimeInput: z.object({
    value: TextContentSchema.optional(),
    onChange: ActionSchema,
    placeholder: z.string().optional(),
    minDate: TextContentSchema.optional(),
    maxDate: TextContentSchema.optional(),
    includeTime: z.boolean().optional(),
  }),
});

// ========== Component Union ==========
/** All A2UI component types */
export const ComponentSchema: z.ZodType<any> = z.union([
  TextComponentSchema,
  ButtonComponentSchema,
  DropdownComponentSchema,
  TextFieldComponentSchema,
  TextAreaComponentSchema,
  CheckboxComponentSchema,
  RadioGroupComponentSchema,
  CodeBlockComponentSchema,
  ProgressComponentSchema,
  CardComponentSchema,
  CLIOutputComponentSchema,
  DateTimeInputComponentSchema,
]);

// ========== Surface Schemas ==========

/** Surface component with ID */
export const SurfaceComponentSchema = z.object({
  id: z.string(),
  component: ComponentSchema,
  /** Page index for multi-page surfaces (0-based) */
  page: z.number().int().min(0).optional(),
});

/** Display mode for A2UI surfaces */
export const DisplayModeSchema = z.enum(['popup', 'panel']);

/** Surface update message */
export const SurfaceUpdateSchema = z.object({
  surfaceId: z.string(),
  components: z.array(SurfaceComponentSchema),
  initialState: z.record(z.string(), z.unknown()).optional(),
  /** Display mode: 'popup' for centered dialog, 'panel' for notification panel */
  displayMode: DisplayModeSchema.optional(),
});

// ========== TypeScript Types ==========

export type LiteralString = z.infer<typeof LiteralStringSchema>;
export type Binding = z.infer<typeof BindingSchema>;
export type TextContent = z.infer<typeof TextContentSchema>;
export type NumberContent = z.infer<typeof NumberContentSchema>;
export type BooleanContent = z.infer<typeof BooleanContentSchema>;
export type Action = z.infer<typeof ActionSchema>;

export type TextComponent = z.infer<typeof TextComponentSchema>;
export type ButtonComponent = z.infer<typeof ButtonComponentSchema>;
export type DropdownComponent = z.infer<typeof DropdownComponentSchema>;
export type TextFieldComponent = z.infer<typeof TextFieldComponentSchema>;
export type TextAreaComponent = z.infer<typeof TextAreaComponentSchema>;
export type CheckboxComponent = z.infer<typeof CheckboxComponentSchema>;
export type RadioGroupComponent = z.infer<typeof RadioGroupComponentSchema>;
export type CodeBlockComponent = z.infer<typeof CodeBlockComponentSchema>;
export type ProgressComponent = z.infer<typeof ProgressComponentSchema>;
export type CardComponent = z.infer<typeof CardComponentSchema>;
export type CLIOutputComponent = z.infer<typeof CLIOutputComponentSchema>;
export type DateTimeInputComponent = z.infer<typeof DateTimeInputComponentSchema>;

export type A2UIComponent = z.infer<typeof ComponentSchema>;
export type SurfaceComponent = z.infer<typeof SurfaceComponentSchema>;
export type SurfaceUpdate = z.infer<typeof SurfaceUpdateSchema>;
export type DisplayMode = z.infer<typeof DisplayModeSchema>;

// ========== Helper Types ==========

/** Discriminated union for component type detection */
export type A2UIComponentType =
  | 'Text'
  | 'Button'
  | 'Dropdown'
  | 'TextField'
  | 'TextArea'
  | 'Checkbox'
  | 'RadioGroup'
  | 'CodeBlock'
  | 'Progress'
  | 'Card'
  | 'CLIOutput'
  | 'DateTimeInput';

/** Get component type from discriminated union */
export function getComponentType(component: A2UIComponent): A2UIComponentType {
  return Object.keys(component)[0] as A2UIComponentType;
}
