# Terminal Dashboard

## One-Liner
**The Terminal Dashboard provides a terminal-first workspace with resizable panes, floating panels, and integrated tools for session monitoring and orchestration.**

---

## Pain Points Solved

| Pain Point | Current State | Terminal Dashboard Solution |
|------------|---------------|-----------------------------|
| **Scattered terminals** | Multiple terminal windows | Unified tmux-style grid layout |
| **No context linkage** | Can't associate terminal output with issues | Association highlight provider |
| **Panel overload** | Fixed layout wastes space | Floating panels (mutually exclusive) |
| **Missing tools** | Switch between apps | Integrated issues, queue, inspector, scheduler |
| **Limited workspace** | Can't see code and terminals together | Resizable three-column layout |

---

## Overview

**Location**: `ccw/frontend/src/pages/TerminalDashboardPage.tsx`

**Purpose**: Terminal-first layout for multi-terminal session management with integrated tools and resizable panels.

**Access**: Navigation → Terminal Dashboard (`/terminal-dashboard`)

**Layout**:
```
+--------------------------------------------------------------------------+
|  Dashboard Toolbar (panel toggles, layout presets, fullscreen)              |
+--------------------------------------------------------------------------+
|  +----------------+-------------------------------------------+------------+ |
|  | Session        |  Terminal Grid (tmux-style)             | File       | |
|  | Group Tree     |  +----------+  +----------+              | Sidebar    | |
|  | (resizable)    |  | Term 1   |  | Term 2   |              | (resizable)| |
|  |                |  +----------+  +----------+              |            | |
|  |                |  +----------+  +----------+              |            | |
|  |                |  | Term 3   |  | Term 4   |              |            | |
|  |                |  +----------+  +----------+              |            | |
|  +----------------+-------------------------------------------+------------+ |
+--------------------------------------------------------------------------+
|  [Floating Panel: Issues+Queue OR Inspector OR Execution OR Scheduler]   |
+--------------------------------------------------------------------------+
```

---

## Live Demo

:::demo TerminalDashboardOverview #TerminalDashboardOverview.tsx :::

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Three-Column Layout** | Resizable panes using Allotment: Session tree (left), Terminal grid (center), File sidebar (right) |
| **Terminal Grid** | Tmux-style split panes with layout presets (single, split-h, split-v, grid-2x2) |
| **Session Group Tree** | Hierarchical view of CLI sessions with grouping by tags |
| **Floating Panels** | Mutually exclusive overlay panels (Issues+Queue, Inspector, Execution Monitor, Scheduler) |
| **Association Highlight** | Cross-panel linking between terminals, issues, and queue items |
| **Layout Presets** | Quick layout buttons: single pane, horizontal split, vertical split, 2x2 grid |
| **Launch CLI** | Config modal for creating new CLI sessions with tool, model, and settings |
| **Fullscreen Mode** | Immersive mode hides app chrome (header + sidebar) |
| **Feature Flags** | Panel visibility controlled by feature flags (queue, inspector, execution monitor) |

---

## Component Hierarchy

```
TerminalDashboardPage
├── AssociationHighlightProvider (context)
├── DashboardToolbar
│   ├── Layout Preset Buttons (Single | Split-H | Split-V | Grid-2x2)
│   ├── Panel Toggles (Sessions | Files | Issues | Queue | Inspector | Execution | Scheduler)
│   ├── Fullscreen Toggle
│   └── Launch CLI Button
├── Allotment (Three-Column Layout)
│   ├── SessionGroupTree
│   │   └── Session Group Items (collapsible)
│   ├── TerminalGrid
│   │   ├── GridGroupRenderer (recursive)
│   │   └── TerminalPane
│   └── FileSidebarPanel
│       └── File Tree View
└── FloatingPanel (multiple, mutually exclusive)
    ├── Issues+Queue (split panel)
    │   ├── IssuePanel
    │   └── QueueListColumn
    ├── QueuePanel (feature flag)
    ├── InspectorContent (feature flag)
    ├── ExecutionMonitorPanel (feature flag)
    └── SchedulerPanel
```

---

## Props API

### TerminalDashboardPage

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| - | - | - | This page component accepts no props (state managed via hooks and Zustand stores) |

### DashboardToolbar

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `activePanel` | `PanelId \| null` | `null` | Currently active floating panel |
| `onTogglePanel` | `(panelId: PanelId) => void` | - | Callback to toggle panel visibility |
| `isFileSidebarOpen` | `boolean` | `true` | File sidebar visibility state |
| `onToggleFileSidebar` | `() => void` | - | Toggle file sidebar callback |
| `isSessionSidebarOpen` | `boolean` | `true` | Session sidebar visibility state |
| `onToggleSessionSidebar` | `() => void` | - | Toggle session sidebar callback |
| `isFullscreen` | `boolean` | `false` | Fullscreen mode state |
| `onToggleFullscreen` | `() => void` | - | Toggle fullscreen callback |

### FloatingPanel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Panel open state |
| `onClose` | `() => void` | - | Close callback |
| `title` | `string` | - | Panel title |
| `side` | `'left' \| 'right'` | `'left'` | Panel side |
| `width` | `number` | `400` | Panel width in pixels |
| `children` | `ReactNode` | - | Panel content |

---

## State Management

### Local State

| State | Type | Description |
|-------|------|-------------|
| `activePanel` | `PanelId \| null` | Currently active floating panel (mutually exclusive) |
| `isFileSidebarOpen` | `boolean` | File sidebar visibility |
| `isSessionSidebarOpen` | `boolean` | Session sidebar visibility |

### Zustand Stores

| Store | Selector | Purpose |
|-------|----------|---------|
| `workflowStore` | `selectProjectPath` | Current project path for file sidebar |
| `appStore` | `selectIsImmersiveMode` | Fullscreen mode state |
| `configStore` | `featureFlags` | Feature flag configuration |
| `terminalGridStore` | Grid layout and focused pane state |
| `executionMonitorStore` | Active execution count |
| `queueSchedulerStore` | Scheduler status and settings |

### Panel ID Type

```typescript
type PanelId = 'issues' | 'queue' | 'inspector' | 'execution' | 'scheduler';
```

---

## Usage Examples

### Basic Terminal Dashboard

```tsx
import { TerminalDashboardPage } from '@/pages/TerminalDashboardPage'

// The terminal dashboard is automatically rendered at /terminal-dashboard
// No props needed - layout state managed internally
```

### Using FloatingPanel Component

```tsx
import { FloatingPanel } from '@/components/terminal-dashboard/FloatingPanel'
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel'

function CustomLayout() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <FloatingPanel
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Issues"
      side="left"
      width={700}
    >
      <IssuePanel />
    </FloatingPanel>
  )
}
```

### Panel Toggle Pattern

```tsx
import { useState, useCallback } from 'react'

function usePanelToggle() {
  const [activePanel, setActivePanel] = useState<string | null>(null)

  const togglePanel = useCallback((panelId: string) => {
    setActivePanel((prev) => (prev === panelId ? null : panelId))
  }, [])

  const closePanel = useCallback(() => {
    setActivePanel(null)
  }, [])

  return { activePanel, togglePanel, closePanel }
}
```

---

## Interactive Demos

### Layout Presets Demo

:::demo TerminalLayoutPresets #TerminalLayoutPresets.tsx :::

### Floating Panels Demo

:::demo FloatingPanelsDemo #FloatingPanelsDemo.tsx :::

### Resizable Panes Demo

:::demo ResizablePanesDemo #ResizablePanesDemo.tsx :::

---

## Configuration

### Feature Flags

| Flag | Controls |
|------|----------|
| `dashboardQueuePanelEnabled` | Queue panel visibility |
| `dashboardInspectorEnabled` | Inspector panel visibility |
| `dashboardExecutionMonitorEnabled` | Execution Monitor panel visibility |

### Layout Presets

| Preset | Layout |
|--------|--------|
| **Single** | One terminal pane |
| **Split-H** | Two panes side by side |
| **Split-V** | Two panes stacked vertically |
| **Grid-2x2** | Four panes in 2x2 grid |

### Panel Types

| Panel | Content | Position | Feature Flag |
|-------|---------|----------|--------------|
| **Issues+Queue** | Combined Issues panel + Queue list column | Left (overlay) | - |
| **Queue** | Full queue management panel | Right (overlay) | `dashboardQueuePanelEnabled` |
| **Inspector** | Association chain inspector | Right (overlay) | `dashboardInspectorEnabled` |
| **Execution Monitor** | Real-time execution tracking | Right (overlay) | `dashboardExecutionMonitorEnabled` |
| **Scheduler** | Queue scheduler controls | Right (overlay) | - |

---

## Accessibility

- **Keyboard Navigation**:
  - <kbd>Tab</kbd> - Navigate through toolbar buttons
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - Activate toolbar buttons
  - <kbd>Escape</kbd> - Close floating panels
  - <kbd>F11</kbd> - Toggle fullscreen mode

- **ARIA Attributes**:
  - `aria-label` on toolbar buttons
  - `aria-expanded` on sidebar toggles
  - `aria-hidden` on inactive floating panels
  - `role="dialog"` on floating panels

- **Screen Reader Support**:
  - Panel state announced when toggled
  - Layout changes announced
  - Focus management when panels open/close

---

## Related Links

- [Orchestrator](/features/orchestrator) - Visual workflow editor
- [Sessions](/features/sessions) - Session management
- [Issue Hub](/features/issue-hub) - Issues, queue, discovery
- [Explorer](/features/explorer) - File explorer
- [Queue](/features/queue) - Queue management standalone page
