---
title: Button
description: Button component for triggering actions or submitting forms
sidebar: auto
---

# Button

## Overview

The Button component is one of the most commonly used interactive elements, used to trigger actions, submit forms, or navigate to other pages.

## Live Demo

:::demo button-variants
Shows all visual variants of the button component
:::

## Props

<PropsTable :props="[
  { name: 'variant', type: '\'default\' | \'destructive\' | \'outline\' | \'secondary\' | \'ghost\' | \'link\' | \'gradient\' | \'gradientPrimary\'', required: false, default: '\'default\'', description: 'Visual style variant' },
  { name: 'size', type: '\'default\' | \'sm\' | \'lg\' | \'icon\'', required: false, default: '\'default\'', description: 'Button size' },
  { name: 'asChild', type: 'boolean', required: false, default: 'false', description: 'Whether to merge props with child element (for Radix UI composition)' },
  { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Whether the button is disabled' },
  { name: 'onClick', type: '() => void', required: false, default: '-', description: 'Click event callback' },
  { name: 'className', type: 'string', required: false, default: '-', description: 'Custom CSS class name' },
  { name: 'children', type: 'ReactNode', required: true, default: '-', description: 'Button content' }
]" />

## Variants

### Default

Default buttons are used for primary actions.

### Destructive

Destructive buttons are used for irreversible actions like delete or remove.

### Outline

Outline buttons are used for secondary actions with a lighter visual weight.

### Secondary

Secondary buttons are used for auxiliary actions.

### Ghost

Ghost buttons have no border and the lightest visual weight.

### Link

Link buttons look like links but have button interaction behavior.

### Gradient

Gradient buttons use the brand gradient with a glow effect on hover.

### Gradient Primary

Gradient Primary buttons use the primary theme gradient with an enhanced glow effect on hover.

## Usage Scenarios

| Scenario | Recommended Variant |
|----------|---------------------|
| Primary actions (submit, save) | default, gradientPrimary |
| Dangerous actions (delete, remove) | destructive |
| Secondary actions | outline, secondary |
| Cancel actions | ghost, outline |
| Navigation links | link |
| Promotional/Featured CTAs | gradient |

## Related Components

- [Input](/components/ui/input)
- [Select](/components/ui/select)
- Dialog
