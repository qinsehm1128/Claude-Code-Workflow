# Component Library

## One-Liner
**A comprehensive collection of reusable UI components built with Radix UI primitives and Tailwind CSS, following shadcn/ui patterns for consistent, accessible, and customizable interfaces.**

---

## Overview

**Location**: `ccw/frontend/src/components/ui/`

**Purpose**: Provides a consistent set of UI components for building the CCW frontend application.

**Technology Stack**:
- **Radix UI**: Unstyled, accessible component primitives
- **Tailwind CSS**: Utility-first styling with custom theme
- **class-variance-authority (CVA)**: Type-safe variant prop management
- **Lucide React**: Consistent iconography

---

## Live Demo: Component Gallery

:::demo ComponentGallery #ComponentGallery.tsx :::

---

## Available Components

### Form Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Button](/components/ui/button) | Clickable action buttons with variants and sizes | `variant`, `size`, `asChild` |
| [Input](/components/ui/input) | Text input field | `error` |
| Textarea | Multi-line text input | `error` |
| [Select](/components/ui/select) | Dropdown selection (Radix) | Select components |
| [Checkbox](/components/ui/checkbox) | Boolean checkbox (Radix) | `checked`, `onCheckedChange` |
| Switch | Toggle switch | `checked`, `onCheckedChange` |

### Layout Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Card](/components/ui/card) | Content container with header/footer | Nested components |
| Separator | Visual divider | `orientation` |
| ScrollArea | Custom scrollbar container | - |

### Feedback Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Badge](/components/ui/badge) | Status indicator label | `variant` |
| Progress | Progress bar | `value` |
| Alert | Notification message | `variant` |
| Toast | Temporary notification (Radix) | Toast components |

### Navigation Components

| Component | Description | Props |
|-----------|-------------|-------|
| Tabs | Tab navigation (Radix) | Tabs components |
| TabsNavigation | Custom tab bar | `tabs`, `value`, `onValueChange` |
| Breadcrumb | Navigation breadcrumb | Breadcrumb components |

### Overlay Components

| Component | Description | Props |
|-----------|-------------|-------|
| Dialog | Modal dialog (Radix) | `open`, `onOpenChange` |
| Drawer | Side panel (Radix) | `open`, `onOpenChange` |
| Dropdown Menu | Context menu (Radix) | Dropdown components |
| Popover | Floating content (Radix) | `open`, `onOpenChange` |
| Tooltip | Hover tooltip (Radix) | `content` |
| AlertDialog | Confirmation dialog (Radix) | Dialog components |

### Disclosure Components

| Component | Description | Props |
|-----------|-------------|-------|
| Collapsible | Expand/collapse content (Radix) | `open`, `onOpenChange` |
| Accordion | Collapsible sections (Radix) | Accordion components |

---

## Button Variants

The Button component supports 8 variants via CVA (class-variance-authority):

| Variant | Use Case | Preview |
|---------|----------|--------|
| `default` | Primary action | <span className="inline-block px-3 py-1 rounded bg-primary text-primary-foreground text-xs">Default</span> |
| `destructive` | Dangerous actions | <span className="inline-block px-3 py-1 rounded bg-destructive text-destructive-foreground text-xs">Destructive</span> |
| `outline` | Secondary action | <span className="inline-block px-3 py-1 rounded border text-xs">Outline</span> |
| `secondary` | Less emphasis | <span className="inline-block px-3 py-1 rounded bg-secondary text-secondary-foreground text-xs">Secondary</span> |
| `ghost` | Subtle action | <span className="inline-block px-3 py-1 rounded text-xs">Ghost</span> |
| `link` | Text link | <span className="inline-block px-3 py-1 underline text-primary text-xs">Link</span> |
| `gradient` | Featured action | <span className="inline-block px-3 py-1 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">Gradient</span> |
| `gradientPrimary` | Primary gradient | <span className="inline-block px-3 py-1 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">Primary</span> |

### Button Sizes

| Size | Height | Padding |
|------|--------|---------|
| `sm` | 36px | 12px horizontal |
| `default` | 40px | 16px horizontal |
| `lg` | 44px | 32px horizontal |
| `icon` | 40px | Square (icon only) |

---

## Badge Variants

The Badge component supports 9 variants for different status types:

| Variant | Use Case | Color |
|---------|----------|-------|
| `default` | General info | Primary theme |
| `secondary` | Less emphasis | Secondary theme |
| `destructive` | Error/Danger | Destructive theme |
| `outline` | Subtle | Text color only |
| `success` | Success state | Green |
| `warning` | Warning state | Amber |
| `info` | Information | Blue |
| `review` | Review status | Purple |
| `gradient` | Featured | Brand gradient |

---

## Usage Examples

### Button

```tsx
import { Button } from '@/components/ui/Button'

<Button variant="default" onClick={handleClick}>
  Click me
</Button>

<Button variant="destructive" size="sm">
  Delete
</Button>

<Button variant="ghost" size="icon">
  <SettingsIcon />
</Button>
```

### Input with Error State

```tsx
import { Input } from '@/components/ui/Input'

<Input
  type="text"
  error={hasError}
  placeholder="Enter your name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### Checkbox

```tsx
import { Checkbox } from '@/components/ui/Checkbox'

<Checkbox
  checked={accepted}
  onCheckedChange={setAccepted}
/>
<label>Accept terms</label>
```

### Switch

```tsx
import { Switch } from '@/components/ui/Switch'

<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
/>
<span>Enable feature</span>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Brief description here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content goes here.</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Badge

```tsx
import { Badge, badgeVariants } from '@/components/ui/Badge'

<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Failed</Badge>
```

---

## Accessibility

All components follow Radix UI's accessibility standards:

- **Keyboard Navigation**: All interactive components are fully keyboard accessible
- **ARIA Attributes**: Proper roles, states, and properties
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Focus Management**: Visible focus indicators and logical tab order
- **Color Contrast**: WCAG AA compliant color combinations

### Keyboard Shortcuts

| Component | Keys |
|-----------|-------|
| Button | <kbd>Enter</kbd>, <kbd>Space</kbd> |
| Checkbox/Switch | <kbd>Space</kbd> to toggle |
| Select | <kbd>Arrow</kbd> keys, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close |
| Dialog | <kbd>Esc</kbd> to close |
| Tabs | <kbd>Arrow</kbd> keys to navigate |
| Dropdown | <kbd>Arrow</kbd> keys, <kbd>Enter</kbd> to select |

---

## Related Links

- [Radix UI Primitives](https://www.radix-ui.com/) - Headless UI component library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Component patterns reference
- [CVA Documentation](https://cva.style/) - Class Variance Authority
