---
title: Input
description: Text input component for forms and user input
sidebar: auto
---

# Input

## Overview

The Input component provides a styled text input field that extends the native HTML input element with consistent styling and error state support.

## Live Demo

:::demo input-variants
Shows all input states including default, error, and disabled
:::

## Props

<PropsTable :props="[
  { name: 'type', type: 'string', required: false, default: '\'text\'', description: 'HTML input type (text, password, email, number, etc.)' },
  { name: 'error', type: 'boolean', required: false, default: 'false', description: 'Whether the input has an error (shows destructive border)' },
  { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Whether the input is disabled' },
  { name: 'placeholder', type: 'string', required: false, default: '-', description: 'Placeholder text shown when input is empty' },
  { name: 'value', type: 'string | number', required: false, default: '-', description: 'Controlled input value' },
  { name: 'defaultValue', type: 'string | number', required: false, default: '-', description: 'Uncontrolled input default value' },
  { name: 'onChange', type: '(event: ChangeEvent) => void', required: false, default: '-', description: 'Change event callback' },
  { name: 'className', type: 'string', required: false, default: '-', description: 'Custom CSS class name' }
]" />

## States

### Default

Standard input field with border and focus ring.

### Error

Error state with destructive border color. Set the `error` prop to `true`.

### Disabled

Disabled state with reduced opacity. Set the `disabled` prop to `true`.

### Focus

Focused state with ring outline.

## Usage Examples

### Basic Input

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  return <input type="text" placeholder="Enter text..." />
}
```

### Controlled Input

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  const [value, setValue] = useState('')

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Enter text..."
    />
  )
}
```

### Input with Error State

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  return (
    <Input
      type="text"
      error
      placeholder="Invalid input..."
    />
  )
}
```

### Password Input

```tsx
import { Input } from '@/components/ui/Input'

function Example() {
  return <Input type="password" placeholder="Enter password..." />
}
```

## Accessibility

- **Keyboard Navigation**: Full native keyboard support
- **ARIA Attributes**: Supports all standard input ARIA attributes
- **Focus Visible**: Clear focus indicator for keyboard navigation
- **Error State**: Visual indication for error state (use with `aria-invalid` and `aria-describedby`)

## Related Components

- [Button](/components/ui/button)
- [Select](/components/ui/select)
- [Checkbox](/components/ui/checkbox)
