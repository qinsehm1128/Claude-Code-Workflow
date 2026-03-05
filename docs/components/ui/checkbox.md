---
title: Checkbox
description: Checkbox component for binary choice selection
sidebar: auto
---

# Checkbox

## Overview

The Checkbox component allows users to select one or more options from a set. Built on Radix UI Checkbox Primitive, it provides full accessibility support including keyboard navigation.

## Live Demo

:::demo checkbox-variants
Shows different checkbox states including checked, unchecked, indeterminate, and disabled
:::

## Props

<PropsTable :props="[
  { name: 'checked', type: 'boolean | \'indeterminate\'', required: false, default: 'false', description: 'Whether the checkbox is checked' },
  { name: 'defaultChecked', type: 'boolean', required: false, default: 'false', description: 'Initial checked state (uncontrolled)' },
  { name: 'onCheckedChange', type: '(checked: boolean) => void', required: false, default: '-', description: 'Callback when checked state changes' },
  { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Whether the checkbox is disabled' },
  { name: 'required', type: 'boolean', required: false, default: 'false', description: 'Whether the checkbox is required' },
  { name: 'name', type: 'string', required: false, default: '-', description: 'Form input name' },
  { name: 'value', type: 'string', required: false, default: '-', description: 'Form input value' },
  { name: 'className', type: 'string', required: false, default: '-', description: 'Custom CSS class name' }
]" />

## States

### Unchecked

The default state when the checkbox is not selected.

### Checked

The checkbox shows a checkmark icon when selected.

### Indeterminate

A mixed state (partial selection) typically used for parent checkboxes when some but not all children are selected.

### Disabled

Disabled checkboxes are non-interactive and displayed with reduced opacity.

## Usage Examples

### Basic Checkbox

```vue
<Checkbox />
```

### With Label

```vue
<div class="flex items-center space-x-2">
  <Checkbox id="terms" />
  <label for="terms">I agree to the terms and conditions</label>
</div>
```

### Controlled Checkbox

```vue
<script setup>
import { ref } from 'vue'

const checked = ref(false)
</script>

<template>
  <div class="flex items-center space-x-2">
    <Checkbox v-model:checked="checked" />
    <span>{{ checked ? 'Checked' : 'Unchecked' }}</span>
  </div>
</template>
```

### Indeterminate State

```vue
<script setup>
import { ref } from 'vue'

const state = ref('indeterminate')
</script>

<template>
  <Checkbox :checked="state" />
</template>
```

### Form Integration

```vue
<form @submit="handleSubmit">
  <div class="space-y-2">
    <div class="flex items-center space-x-2">
      <Checkbox id="newsletter" name="newsletter" value="yes" />
      <label for="newsletter">Subscribe to newsletter</label>
    </div>
    <div class="flex items-center space-x-2">
      <Checkbox id="updates" name="updates" value="yes" />
      <label for="updates">Receive product updates</label>
    </div>
  </div>
  <Button type="submit" class="mt-4">Submit</Button>
</form>
```

## Related Components

- [Input](/components/ui/input)
- [Select](/components/ui/select)
- Radio Group
