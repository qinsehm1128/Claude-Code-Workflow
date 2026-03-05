---
title: Select
description: Dropdown select component for choosing from a list of options
sidebar: auto
---

# Select

## Overview

The Select component allows users to choose a single value from a list of options. Built on Radix UI Select Primitive, it provides accessibility and keyboard navigation out of the box.

## Live Demo

:::demo select-variants
Shows different select configurations including basic usage, with labels, and with separators
:::

## Components

The Select component includes the following sub-components:

| Component | Purpose |
|-----------|---------|
| `Select` | Root component that manages state |
| `SelectTrigger` | Button that opens the dropdown |
| `SelectValue` | Displays the selected value |
| `SelectContent` | Dropdown content container |
| `SelectItem` | Individual selectable option |
| `SelectLabel` | Non-interactive label for grouping |
| `SelectGroup` | Groups items together |
| `SelectSeparator` | Visual separator between items |
| `SelectScrollUpButton` | Scroll button for long lists |
| `SelectScrollDownButton` | Scroll button for long lists |

## Props

### Select Root

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Currently selected value (controlled) |
| `defaultValue` | `string` | - | Default selected value |
| `onValueChange` | `(value: string) => void` | - | Callback when value changes |
| `disabled` | `boolean` | `false` | Whether the select is disabled |
| `required` | `boolean` | `false` | Whether a value is required |
| `name` | `string` | - | Form input name |

### SelectTrigger

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Custom CSS class name |

### SelectItem

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Item value |
| `disabled` | `boolean` | `false` | Whether the item is disabled |
| `className` | `string` | - | Custom CSS class name |

## Usage Examples

### Basic Select

```vue
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### With Labels and Groups

```vue
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choose a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectLabel>Fruits</SelectLabel>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
    <SelectItem value="orange">Orange</SelectItem>
    <SelectSeparator />
    <SelectLabel>Vegetables</SelectLabel>
    <SelectItem value="carrot">Carrot</SelectItem>
    <SelectItem value="broccoli">Broccoli</SelectItem>
  </SelectContent>
</Select>
```

### Controlled Select

```vue
<script setup>
import { ref } from 'vue'

const selectedValue = ref('')
</script>

<template>
  <Select v-model="selectedValue">
    <SelectTrigger>
      <SelectValue placeholder="Select..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="a">Option A</SelectItem>
      <SelectItem value="b">Option B</SelectItem>
      <SelectItem value="c">Option C</SelectItem>
    </SelectContent>
  </Select>
</template>
```

## Related Components

- [Input](/components/ui/input)
- [Checkbox](/components/ui/checkbox)
- [Button](/components/ui/button)
