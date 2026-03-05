# Queue Management

## One-Liner
**The Queue Management page provides centralized control over issue execution queues with scheduler controls, status monitoring, and session pool management.**

---

## Pain Points Solved

| Pain Point | Current State | Queue Solution |
|------------|---------------|----------------|
| **Disorganized execution** | No unified task queue | Centralized queue with grouped items |
| **Unknown scheduler status** | Can't tell if scheduler is running | Real-time status indicator (idle/running/paused) |
| **No execution control** | Can't start/stop queue processing | Start/Pause/Stop controls with confirmation |
| **Concurrency limits** | Too many simultaneous sessions | Configurable max concurrent sessions |
| **No visibility** | Don't know what's queued | Stats cards + item list with status tracking |
| **Resource waste** | Idle sessions consuming resources | Session pool overview with timeout config |

---

## Overview

**Location**: `ccw/frontend/src/pages/QueuePage.tsx` (legacy), `ccw/frontend/src/components/terminal-dashboard/QueuePanel.tsx` (current)

**Purpose**: View and manage issue execution queues with scheduler controls, progress tracking, and session pool management.

**Access**: Navigation → Issues → Queue tab OR Terminal Dashboard → Queue floating panel

**Layout**:
```
+--------------------------------------------------------------------------+
|  Queue Panel Header                                                        |
+--------------------------------------------------------------------------+
|  Scheduler Status Bar                                                       |
|  +----------------+  +-------------+  +-------------------------------+         |
|  | Status Badge   |  | Progress    |  | Concurrency (2/2)            |         |
|  +----------------+  +-------------+  +-------------------------------+         |
+--------------------------------------------------------------------------+
|  Scheduler Controls                                                          |
|  +--------+  +--------+  +--------+  +-----------+                      |
|  | Start  |  | Pause  |  | Stop   |  | Config    |                      |
|  +--------+  +--------+  +--------+  +-----------+                      |
+--------------------------------------------------------------------------+
|  Queue Items List                                                           |
|  +---------------------------------------------------------------------+    |
|  | QueueItemRow (status, issue_id, session_key, actions)              |    |
|  | - Status icon (pending/executing/completed/blocked/failed)         |    |
|  | - Issue ID / Item ID display                                        |    |
|  | - Session binding info                                              |    |
|  | - Progress indicator (for executing items)                          |    |
|  +---------------------------------------------------------------------+    |
|  | [More queue items...]                                               |    |
|  +---------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
|  Session Pool Overview (optional)                                           |
|  +--------------------------------------------------------------------------+
|  | Active Sessions | Idle Sessions | Total Sessions                      |
|  +--------------------------------------------------------------------------+
```

---

## Live Demo

:::demo QueueManagementDemo #QueueManagementDemo.tsx :::

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Scheduler Status** | Real-time status indicator (idle/running/paused) with visual badge |
| **Progress Tracking** | Progress bar showing overall queue completion percentage |
| **Start/Pause/Stop Controls** | Control queue execution with confirmation dialog for stop action |
| **Concurrency Display** | Shows current active sessions vs max concurrent sessions |
| **Queue Items List** | Scrollable list of all queue items with status, issue ID, and session binding |
| **Status Icons** | Visual indicators for item status (pending/executing/completed/blocked/failed) |
| **Session Pool** | Overview of active, idle, and total sessions in the pool |
| **Config Panel** | Adjust max concurrent sessions and timeout settings |
| **Empty State** | Friendly message when queue is empty with instructions to add items |

---

## Component Hierarchy

```
QueuePage (legacy) / QueuePanel (current)
├── QueuePanelHeader
│   ├── Title
│   └── Tab Switcher (Queue | Orchestrator)
├── SchedulerBar (inline in QueueListColumn)
│   ├── Status Badge
│   ├── Progress + Concurrency
│   └── Control Buttons (Play/Pause/Stop)
├── QueueItemsList
│   └── QueueItemRow (repeating)
│       ├── Status Icon
│       ├── Issue ID / Item ID
│       ├── Session Binding
│       └── Progress (for executing items)
└── SchedulerPanel (standalone)
    ├── Status Section
    ├── Progress Bar
    ├── Control Buttons
    ├── Config Section
    │   ├── Max Concurrent Sessions
    │   ├── Session Idle Timeout
    │   └── Resume Key Binding Timeout
    └── Session Pool Overview
```

---

## Props API

### QueuePanel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `embedded` | `boolean` | `false` | Whether panel is embedded in another component |

### SchedulerPanel

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| - | - | - | This component accepts no props (all data from Zustand store) |

### QueueListColumn

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| - | - | - | This component accepts no props (all data from Zustand store) |

---

## State Management

### Zustand Stores

| Store | Selector | Purpose |
|-------|----------|---------|
| `queueSchedulerStore` | `selectQueueSchedulerStatus` | Current scheduler status (idle/running/paused) |
| `queueSchedulerStore` | `selectSchedulerProgress` | Overall queue completion percentage |
| `queueSchedulerStore` | `selectQueueItems` | List of all queue items |
| `queueSchedulerStore` | `selectCurrentConcurrency` | Active sessions count |
| `queueSchedulerStore` | `selectSchedulerConfig` | Scheduler configuration |
| `queueSchedulerStore` | `selectSessionPool` | Session pool overview |
| `queueSchedulerStore` | `selectSchedulerError` | Error message if any |
| `issueQueueIntegrationStore` | `selectAssociationChain` | Current association chain for highlighting |
| `queueExecutionStore` | `selectByQueueItem` | Execution data for queue item |

### Queue Item Status

```typescript
type QueueItemStatus =
  | 'pending'      // Waiting to be executed
  | 'executing'    // Currently being processed
  | 'completed'    // Finished successfully
  | 'blocked'      // Blocked by dependency
  | 'failed';      // Failed with error
```

### Scheduler Status

```typescript
type QueueSchedulerStatus =
  | 'idle'     // No items or stopped
  | 'running'  // Actively processing items
  | 'paused';  // Temporarily paused
```

---

## Usage Examples

### Basic Queue Panel

```tsx
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel'

function QueueSection() {
  return <QueuePanel />
}
```

### Standalone Scheduler Panel

```tsx
import { SchedulerPanel } from '@/components/terminal-dashboard/SchedulerPanel'

function SchedulerControls() {
  return <SchedulerPanel />
}
```

### Queue List Column (Embedded)

```tsx
import { QueueListColumn } from '@/components/terminal-dashboard/QueueListColumn'

function EmbeddedQueue() {
  return <QueueListColumn />
}
```

### Queue Store Actions

```tsx
import { useQueueSchedulerStore } from '@/stores/queueSchedulerStore'

function QueueActions() {
  const startQueue = useQueueSchedulerStore((s) => s.startQueue)
  const pauseQueue = useQueueSchedulerStore((s) => s.pauseQueue)
  const stopQueue = useQueueSchedulerStore((s) => s.stopQueue)
  const updateConfig = useQueueSchedulerStore((s) => s.updateConfig)

  const handleStart = () => startQueue()
  const handlePause = () => pauseQueue()
  const handleStop = () => stopQueue()
  const handleConfig = (config) => updateConfig(config)

  return (
    <div>
      <button onClick={handleStart}>Start</button>
      <button onClick={handlePause}>Pause</button>
      <button onClick={handleStop}>Stop</button>
      <button onClick={() => handleConfig({ maxConcurrentSessions: 4 })}>
        Set Max 4
      </button>
    </div>
  )
}
```

---

## Interactive Demos

### Queue Item Status Demo

:::demo QueueItemStatusDemo #QueueItemStatusDemo.tsx :::

### Scheduler Config Demo

:::demo SchedulerConfigDemo #SchedulerConfigDemo.tsx :::

---

## Configuration

### Scheduler Config

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `maxConcurrentSessions` | `number` | `2` | Maximum sessions running simultaneously |
| `sessionIdleTimeoutMs` | `number` | `60000` | Idle session timeout in milliseconds |
| `resumeKeySessionBindingTimeoutMs` | `number` | `300000` | Resume key binding timeout in milliseconds |

### Queue Item Structure

```typescript
interface QueueItem {
  item_id: string;
  issue_id?: string;
  sessionKey?: string;
  status: QueueItemStatus;
  execution_order: number;
  created_at?: number;
  updated_at?: number;
}
```

---

## Accessibility

- **Keyboard Navigation**:
  - <kbd>Tab</kbd> - Navigate through queue items and controls
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - Activate buttons
  - <kbd>Escape</kbd> - Close dialogs

- **ARIA Attributes**:
  - `aria-label` on control buttons
  - `aria-live` regions for status updates
  - `aria-current` for active queue item
  - `role="list"` on queue items list

- **Screen Reader Support**:
  - Status changes announced
  - Progress updates spoken
  - Error messages announced

---

## Related Links

- [Issue Hub](/features/issue-hub) - Unified issues, queue, and discovery management
- [Terminal Dashboard](/features/terminal) - Terminal-first workspace with integrated queue panel
- [Discovery](/features/discovery) - Discovery session tracking
- [Sessions](/features/sessions) - Session management and details
