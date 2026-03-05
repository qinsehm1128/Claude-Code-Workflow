---
title: Card
description: Container component for grouping related content
sidebar: auto
---

# Card

## Overview

The Card component is a versatile container used to group related content and actions. It consists of several sub-components that work together to create a cohesive card layout.

## Live Demo

:::demo card-variants
Shows different card layouts including header, content, footer, and gradient border variants
:::

## Components

The Card component includes the following sub-components:

| Component | Purpose |
|-----------|---------|
| `Card` | Main container with border and background |
| `CardHeader` | Header section with padding |
| `CardTitle` | Title heading element |
| `CardDescription` | Descriptive text with muted color |
| `CardContent` | Content area with top padding |
| `CardFooter` | Footer section for actions |
| `CardGradientBorder` | Card with gradient border |

## Props

All Card components accept standard HTML div attributes:

| Component | Props |
|-----------|-------|
| `Card` | `className?: string` |
| `CardHeader` | `className?: string` |
| `CardTitle` | `className?: string`, `children?: ReactNode` |
| `CardDescription` | `className?: string`, `children?: ReactNode` |
| `CardContent` | `className?: string` |
| `CardFooter` | `className?: string` |
| `CardGradientBorder` | `className?: string` |

## Usage Examples

### Basic Card

```vue
<Card>
  <CardContent>
    <p>This is a basic card with content.</p>
  </CardContent>
</Card>
```

### Card with Header

```vue
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here.</p>
  </CardContent>
</Card>
```

### Complete Card with Footer

```vue
<Card>
  <CardHeader>
    <CardTitle>Project Settings</CardTitle>
    <CardDescription>Manage your project configuration</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Configure your project settings and preferences.</p>
  </CardContent>
  <CardFooter>
    <Button>Save Changes</Button>
  </CardFooter>
</Card>
```

### Card with Gradient Border

```vue
<CardGradientBorder>
  <CardHeader>
    <CardTitle>Featured Card</CardTitle>
  </CardHeader>
  <CardContent>
    <p>This card has a gradient border effect.</p>
  </CardContent>
</CardGradientBorder>
```

## Related Components

- [Button](/components/ui/button)
- [Badge](/components/ui/badge)
- Separator
