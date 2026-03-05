# Demo Components

This directory contains React components that are embedded in the documentation as interactive demos.

## Creating a New Demo

1. Create a new `.tsx` file in this directory (e.g., `my-demo.tsx`)
2. Export a default React component
3. Use it in markdown with `:::demo my-demo :::`

## Demo Template

```tsx
import React from 'react'

/**
 * Brief description of what this demo shows
 */
export default function MyDemo() {
  return (
    <div style={{ padding: '16px' }}>
      {/* Your demo content */}
    </div>
  )
}
```

## Demo Guidelines

- **Keep it simple**: Demos should be focused and easy to understand
- **Use inline styles**: Avoid external dependencies for portability
- **Add comments**: Explain what the demo is showing
- **Test interactions**: Ensure buttons, inputs, etc. work correctly
- **Handle state**: Use React hooks (`useState`, `useEffect`) for interactive demos

## Demo File Naming

- Use kebab-case: `button-variants.tsx`, `card-basic.tsx`
- Group by category:
  - `ui/` - UI component demos
  - `shared/` - Shared component demos
  - `pages/` - Page-level demos

## Using Props

If you need to pass custom props to a demo, use the extended markdown syntax:

```markdown
:::demo my-demo
title: Custom Title
height: 300px
expandable: false
:::
```

## Available Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| name | string | - | Demo component name (required) |
| title | string | name | Custom demo title |
| height | string | 'auto' | Container height |
| expandable | boolean | true | Allow expand/collapse |
| showCode | boolean | true | Show code tab |
