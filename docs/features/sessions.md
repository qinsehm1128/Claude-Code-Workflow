# Sessions

## One-Liner

**The Sessions page provides a centralized hub for viewing, filtering, and managing all workflow sessions with CRUD operations and status tracking.**

---

## Pain Points Solved

| Pain Point | Current State | Sessions Solution |
|------------|---------------|-------------------|
| **Lost sessions** | Can't find past work | Unified list of all sessions with search |
| **Unknown session status** | No progress visibility | Color-coded status badges with filters |
| **Cluttered view** | Active and archived mixed | Location tabs (active/archived/all) |
| **Hard to navigate** | No way to access details | Click to navigate to detail or review page |
| **No bulk actions** | Manual cleanup | Archive and delete with confirmation dialogs |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/SessionsPage.tsx`

**Purpose**: Sessions list page with filtering, search, and CRUD operations for managing workflow sessions.

**Access**: Navigation → Sessions

### Layout

```
+--------------------------------------------------------------------------+
|  Sessions Title                                     [Refresh] [Fullscreen]|
+--------------------------------------------------------------------------+
|  [Active] [Archived] [All]  [Search...]  [Filter v]                      |
+--------------------------------------------------------------------------+
|  Active filters display (when applied)                                      |
+--------------------------------------------------------------------------+
|  Session Grid (1/2/3 columns responsive)                                   |
|  +-------------+  +-------------+  +-------------+                         |
|  | SessionCard |  | SessionCard |  | SessionCard |                         |
|  | - Status    |  | - Status    |  | - Status    |                         |
|  | - Title     |  | - Title     |  | - Title     |                         |
|  | - Progress  |  | - Progress  |  | - Progress  |                         |
|  | - Actions   |  | - Actions   |  | - Actions   |                         |
|  +-------------+  +-------------+  +-------------+                         |
+--------------------------------------------------------------------------+
|  Empty State (when no sessions)                                            |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Location Tabs** | Filter sessions by location: Active, Archived, or All |
| **Search** | Full-text search across session titles and descriptions |
| **Status Filter** | Multi-select dropdown to filter by status (planning, in_progress, completed, paused) |
| **Active Filters Display** | Visual badges showing applied filters with remove buttons |
| **Session Cards** | Responsive grid (1/2/3 columns) with status badge, title, description, progress bar, and action buttons |
| **Immersive Mode** | Fullscreen toggle to hide app chrome for focused work |
| **Loading Skeletons** | Skeleton placeholders during data fetch |
| **Empty States** | Friendly message with call-to-action when no sessions match filters |

---

## Usage Guide

### Basic Workflow

1. **Browse Sessions**: Use location tabs to switch between Active, Archived, and All sessions
2. **Search**: Type in the search box to filter by title or description
3. **Filter by Status**: Click the filter button to select one or more statuses
4. **Clear Filters**: Click individual filter badges or "Clear All" button
5. **View Details**: Click a session card to navigate to session detail page
6. **Manage Sessions**: Use action buttons to archive or delete sessions

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Navigate to detail** | Click anywhere on the session card to open detail page |
| **Navigate to review** | Review-type sessions automatically route to the review page |
| **Archive session** | Click the archive button on the card (no confirmation required) |
| **Delete session** | Click the delete button, confirm in the dialog |
| **Toggle fullscreen** | Click the fullscreen button to enter/exit immersive mode |
| **Clear search** | Click the X button in the search input |
| **Clear status filter** | Click the X on individual filter badges or use "Clear All" |

### Status Types

| Status | Color | Description |
|--------|-------|-------------|
| **Planning** | Violet | Session is in planning phase |
| **In Progress** | Amber | Session is actively being worked on |
| **Completed** | Green | Session has been completed |
| **Paused** | Slate | Session is paused |
| **Archived** | Gray | Session is archived |

---

## Session Detail Page

**Location**: `ccw/frontend/src/pages/SessionDetailPage.tsx`

The session detail page provides a comprehensive view of a single session with tabbed content.

### Tabs

| Tab | Content | Always Shown |
|-----|---------|--------------|
| **Tasks** | List of all tasks with status | Yes (with badge count) |
| **Context** | Session context data | Conditional |
| **Summary** | Session summary | Conditional |
| **Impl Plan** | Implementation plan | Conditional |
| **Conflict** | Conflict resolution | Conditional |
| **Review** | Review content | Only if `has_review` or `review` exists |

### Info Bar

Displays created/updated dates and task progress (completed/total tasks).

### Task Drawer

Click any task to open a slide-over drawer with full task details.

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SessionsPage` | `@/pages/SessionsPage.tsx` | Main sessions list page |
| `SessionDetailPage` | `@/pages/SessionDetailPage.tsx` | Session detail with tabs |
| `SessionCard` | `@/components/shared/SessionCard.tsx` | Individual session display with actions |
| `SessionCardSkeleton` | `@/components/shared/SessionCard.tsx` | Loading placeholder |
| `TabsNavigation` | `@/components/ui/TabsNavigation.tsx` | Tab switcher component |
| `TaskListTab` | `@/pages/session-detail/TaskListTab.tsx` | Tasks list tab content |
| `TaskDrawer` | `@/components/shared/TaskDrawer.tsx` | Task detail slide-over |

### State Management

- **Local state** (SessionsPage):
  - `locationFilter`: 'all' | 'active' | 'archived'
  - `searchQuery`: string
  - `statusFilter`: SessionMetadata['status'][]
  - `deleteDialogOpen`: boolean
  - `isImmersiveMode`: boolean (from global store)

- **Local state** (SessionDetailPage):
  - `activeTab`: TabValue
  - `selectedTask`: TaskData | null

- **Custom hooks**:
  - `useSessions` - Sessions CRUD with filtering
  - `useArchiveSession` - Archive session mutation
  - `useDeleteSession` - Delete session mutation
  - `useSessionDetail` - Session detail data fetch

---

## Configuration

No configuration required. Sessions are automatically fetched from the backend.

### Filter Object Structure

```typescript
interface SessionsFilter {
  location?: 'all' | 'active' | 'archived';
  search?: string;
  status?: SessionMetadata['status'][];
}
```

---

## Related Links

- [Dashboard](/features/dashboard) - Overview of all sessions with statistics
- [Lite Tasks](/features/tasks-history) - Lite-plan and multi-cli-plan task management
- [Terminal Dashboard](/features/terminal) - Terminal-first session monitoring
- [Orchestrator](/features/orchestrator) - Workflow template editor
