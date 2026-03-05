# Dashboard

## One-Liner
**The Dashboard provides an at-a-glance overview of your project's workflow status, statistics, and recent activity through an intuitive widget-based interface.**

---

## Pain Points Solved

| Pain Point | Current State | Dashboard Solution |
|------------|---------------|-------------------|
| **No project visibility** | Can't see overall project health | Project info banner with tech stack and development index |
| **Scattered metrics** | Stats across multiple locations | Centralized statistics with sparklines |
| **Unknown workflow status** | Hard to track session progress | Pie chart with status breakdown |
| **Lost in recent work** | No quick access to active sessions | Session carousel with task details |
| **Indexing status unclear** | Don't know if code is indexed | Real-time index status indicator |

---

## Overview

**Location**: `ccw/frontend/src/pages/HomePage.tsx`

**Purpose**: Dashboard home page providing project overview, statistics, workflow status, and recent activity monitoring.

**Access**: Navigation → Dashboard (default home page at `/`)

**Layout**:
```
+--------------------------------------------------------------------------+
|  Dashboard Header (title + refresh)                                      |
+--------------------------------------------------------------------------+
|  WorkflowTaskWidget (Combined Card)                                      |
|  +--------------------------------------------------------------------+  |
|  | Project Info Banner (expandable)                                   |  |
|  | - Project name, description, tech stack badges                      |  |
|  | - Quick stats (features, bugfixes, enhancements)                    |  |
|  | - Index status indicator                                           |  |
|  +----------------------------------+---------------------------------+  |
|  | Stats Section | Workflow Status |  Task Details (Carousel)     |  |
|  | - 6 mini cards | - Pie chart     | - Session nav                 |  |
|  | - Sparklines   | - Legend       | - Task list (2 columns)       |  |
|  +----------------+-----------------+-------------------------------+  |
+--------------------------------------------------------------------------+
|  RecentSessionsWidget                                                     |
|  +--------------------------------------------------------------------+  |
|  | Tabs: All Tasks | Workflow | Lite Tasks                           |  |
|  | +---------------+---------------+-------------------------------+ |  |
|  | | Task cards with status, progress, tags, time                     | |  |
|  | +---------------------------------------------------------------+ |  |
+--------------------------------------------------------------------------+
```

---

## Live Demo

:::demo DashboardOverview #DashboardOverview.tsx :::

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Project Info Banner** | Expandable banner showing project name, description, tech stack (languages, frameworks, architecture), development index (features/bugfixes/enhancements), and real-time index status |
| **Statistics Section** | 6 mini stat cards (Active Sessions, Total Tasks, Completed Tasks, Pending Tasks, Failed Tasks, Today Activity) with 7-day sparkline trends |
| **Workflow Status Pie Chart** | Donut chart showing session status breakdown (completed, in progress, planning, paused, archived) with percentages |
| **Session Carousel** | Auto-rotating (5s) session cards with task list, progress bar, and manual navigation arrows |
| **Recent Sessions Widget** | Tabbed view of recent tasks across all task types with filtering, status badges, and progress indicators |
| **Real-time Updates** | Auto-refresh every 60 seconds for stats and 30 seconds for index status |

---

## Component Hierarchy

```
HomePage
├── DashboardHeader
│   ├── Title
│   └── Refresh Action Button
├── WorkflowTaskWidget
│   ├── ProjectInfoBanner (expandable)
│   │   ├── Project Name & Description
│   │   ├── Tech Stack Badges
│   │   ├── Quick Stats Cards
│   │   ├── Index Status Indicator
│   │   ├── Architecture Section
│   │   ├── Key Components
│   │   └── Design Patterns
│   ├── Stats Section
│   │   └── MiniStatCard (6 cards with Sparkline)
│   ├── WorkflowStatusChart
│   │   └── Pie Chart with Legend
│   └── SessionCarousel
│       ├── Navigation Arrows
│       └── Session Cards (Task List)
└── RecentSessionsWidget
    ├── Tab Navigation (All | Workflow | Lite)
    ├── Task Grid
    │   └── TaskItemCard
    └── Loading/Empty States
```

---

## Props API

### HomePage Component

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| - | - | - | This page component accepts no props (data fetched via hooks) |

### WorkflowTaskWidget

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `undefined` | Additional CSS classes for styling |

### RecentSessionsWidget

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `undefined` | Additional CSS classes |
| `maxItems` | `number` | `6` | Maximum number of items to display |

---

## Usage Examples

### Basic Dashboard

```tsx
import { HomePage } from '@/pages/HomePage'

// The dashboard is automatically rendered at the root route (/)
// No props needed - data is fetched via hooks
```

### Embedding WorkflowTaskWidget

```tsx
import { WorkflowTaskWidget } from '@/components/dashboard/widgets/WorkflowTaskWidget'

function CustomDashboard() {
  return (
    <div className="p-6">
      <WorkflowTaskWidget />
    </div>
  )
}
```

### Custom Recent Sessions Widget

```tsx
import { RecentSessionsWidget } from '@/components/dashboard/widgets/RecentSessionsWidget'

function ActivityFeed() {
  return (
    <div className="p-6">
      <RecentSessionsWidget maxItems={10} />
    </div>
  )
}
```

---

## State Management

### Local State

| State | Type | Description |
|-------|------|-------------|
| `hasError` | `boolean` | Error tracking for critical failures |
| `projectExpanded` | `boolean` | Project info banner expansion state |
| `currentSessionIndex` | `number` | Active session index in carousel |
| `activeTab` | `'all' \| 'workflow' \| 'lite'` | Recent sessions widget filter tab |

### Store Selectors (Zustand)

| Store | Selector | Purpose |
|-------|----------|---------|
| `appStore` | `selectIsImmersiveMode` | Check if immersive mode is active |

### Custom Hooks (Data Fetching)

| Hook | Description | Refetch Interval |
|------|-------------|------------------|
| `useWorkflowStatusCounts` | Session status distribution data | - |
| `useDashboardStats` | Statistics with sparkline data | 60 seconds |
| `useProjectOverview` | Project information and tech stack | - |
| `useIndexStatus` | Real-time index status | 30 seconds |
| `useSessions` | Active sessions data | - |
| `useLiteTasks` | Lite tasks data for recent widget | - |

---

## Interactive Demos

### Statistics Cards Demo

:::demo MiniStatCards #MiniStatCards.tsx :::

### Project Info Banner Demo

:::demo ProjectInfoBanner #ProjectInfoBanner.tsx :::

### Session Carousel Demo

:::demo SessionCarousel #SessionCarousel.tsx :::

---

## Accessibility

- **Keyboard Navigation**:
  - <kbd>Tab</kbd> - Navigate through interactive elements
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - Activate buttons and cards
  - <kbd>Arrow</kbd> keys - Navigate carousel sessions

- **ARIA Attributes**:
  - `aria-label` on navigation buttons
  - `aria-expanded` on expandable sections
  - `aria-live` regions for real-time updates

- **Screen Reader Support**:
  - All charts have text descriptions
  - Status indicators include text labels
  - Navigation is announced properly

---

## Related Links

- [Sessions](/features/sessions) - View and manage all sessions
- [Terminal Dashboard](/features/terminal) - Terminal-first monitoring interface
- [Queue](/features/queue) - Issue execution queue management
- [Memory](/features/memory) - Persistent memory management
- [Settings](/features/settings) - Global application settings
