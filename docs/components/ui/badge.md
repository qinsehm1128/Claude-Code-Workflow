---
title: Badge
description: Small status or label component for visual categorization
sidebar: auto
---

# Badge

## Overview

The Badge component is used to display status, categories, or labels in a compact form. It's commonly used for tags, status indicators, and counts.

## Live Demo

:::demo badge-variants
Shows all available badge variants including default, secondary, destructive, outline, success, warning, info, review, and gradient
:::

## Props

<PropsTable :props="[
  { name: 'variant', type: '\'default\' | \'secondary\' | \'destructive\' | \'outline\' | \'success\' | \'warning\' | \'info\' | \'review\' | \'gradient\'', required: false, default: '\'default\'', description: 'Visual style variant' },
  { name: 'className', type: 'string', required: false, default: '-', description: 'Custom CSS class name' },
  { name: 'children', type: 'ReactNode', required: true, default: '-', description: 'Badge content' }
]" />

## Variants

### Default

Primary badge with theme color background. Used for primary labels and categories.

### Secondary

Muted badge for secondary information.

### Destructive

Red badge for errors, danger states, or negative status.

### Outline

Badge with only text and border, no background. Used for subtle labels.

### Success

Green badge for success states, completed actions, or positive status.

### Warning

Yellow/amber badge for warnings, pending states, or caution indicators.

### Info

Blue badge for informational content or neutral status.

### Review

Purple badge for review status, pending review, or feedback indicators.

### Gradient

Badge with brand gradient background for featured or highlighted items.

## Usage Examples

### Basic Badge

```vue
<Badge>Default</Badge>
```

### Status Indicators

```vue
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Failed</Badge>
<Badge variant="info">Draft</Badge>
```

### Count Badge

```vue
<div class="relative">
  <Bell />
  <Badge variant="destructive" class="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
    3
  </Badge>
</div>
```

### Category Tags

```vue
<div class="flex gap-2">
  <Badge variant="outline">React</Badge>
  <Badge variant="outline">TypeScript</Badge>
  <Badge variant="outline">Tailwind</Badge>
</div>
```

### Review Status

```vue
<Badge variant="review">In Review</Badge>
```

### Gradient Badge

```vue
<Badge variant="gradient">Featured</Badge>
```

## Related Components

- [Card](/components/ui/card)
- [Button](/components/ui/button)
- Avatar
