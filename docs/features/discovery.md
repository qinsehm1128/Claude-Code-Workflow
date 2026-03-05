# Discovery

## One-Liner

**The Discovery page tracks multi-perspective discovery sessions, displaying findings from various analysis angles with real-time updates and export capabilities.**

---

## Pain Points Solved

| Pain Point | Current State | Discovery Solution |
|------------|---------------|-------------------|
| **No insight visibility** | Can't see analysis results | Dedicated page for discovery sessions |
| **Stale data** | Manual refresh required | Auto-refresh every 3 seconds |
| **Unstructured findings** | Hard to navigate results | Split pane with session list and findings detail |
| **No export** | Can't save findings | Export all or selected findings |
| **Missing context** | Don't know related issues | Link findings to related issues |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/DiscoveryPage.tsx`

**Purpose**: Track discovery sessions and view findings from multiple perspectives (Product, Technical, Quality, Risk, Coverage, etc.).

**Access**: Navigation → Issues → Discovery tab OR directly via `/discovery` route

### Layout

```
+--------------------------------------------------------------------------+
|  Discovery Title                                                           |
+--------------------------------------------------------------------------+
|  Stats Cards                                                                  |
|  +-------------+  +-------------+  +-------------+  +-------------+         |
|  | Total        |  | Completed    |  | Running      |  | Total        |         |
|  | Sessions     |  | Sessions     |  | Sessions     |  | Findings    |         |
|  +-------------+  +-------------+  +-------------+  +-------------+         |
+--------------------------------------------------------------------------+
|  Split Pane (3:1 ratio)                                                    |
|  +-----------------------+  +------------------------------------------+   |
|  | Session List (1/3)    |  | Findings Detail (2/3)                   |   |
|  |                       |  |                                          |   |
|  | - DiscoveryCard       |  | - Filters                                |   |
|  |   (status, findings)  |  | - Findings list                          |   |
|  |                       |  | - Export buttons                         |   |
|  | - Multiple sessions   |  | - Related issues links                   |   |
|  +-----------------------+  +------------------------------------------+   |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Stats Cards** | Four metric cards showing total sessions, completed sessions, running sessions, and total findings count |
| **Session List** | Left panel with discovery session cards showing status, findings count, and creation time |
| **Findings Detail** | Right panel displaying detailed findings for the selected session |
| **Auto-Refresh** | Data refreshes every 3 seconds to show real-time progress |
| **Findings Filters** | Filter findings by perspective, category, or other attributes |
| **Export Findings** | Export all findings or only selected findings to file |
| **Related Issues** | Click on findings to navigate to related issues in the Issues panel |
| **Status Badges** | Visual indicators for session status (completed, running, pending) |
| **Loading Skeletons** | Skeleton placeholders during data fetch |
| **Empty States** | Friendly message when no discovery sessions exist |

---

## Usage Guide

### Basic Workflow

1. **View All Sessions**: Browse all discovery sessions in the left panel
2. **Select Session**: Click a session card to view its findings in the right panel
3. **Filter Findings**: Use filter controls to narrow down findings by category
4. **Export Findings**: Click "Export All" or "Export Selected" to save findings
5. **Navigate to Issues**: Click on a finding to view related issues
6. **Monitor Progress**: Watch running sessions update in real-time (3s auto-refresh)

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Select session** | Click a discovery card in the left panel to load its findings |
| **Filter findings** | Use filter controls in the findings detail panel to narrow results |
| **Export all findings** | Click "Export All" to download all findings for current session |
| **Export selected findings** | Select specific findings, click "Export Selected" |
| **Navigate to issue** | Click on a finding to open related issue in Issues panel |
| **Auto-refresh** | Data updates automatically every 3 seconds (no manual action needed) |

### Session Status

| Status | Icon | Description |
|--------|------|-------------|
| **Completed** | Green checkmark | Discovery session finished successfully |
| **Running** | Amber spinner | Discovery session is actively running |
| **Pending** | Gray clock | Discovery session is queued or not started |
| **Failed** | Red X | Discovery session encountered an error |

### Finding Types

Findings can include various perspectives:
- **Product** - Market fit, user value, business viability
- **Technical** - Feasibility, tech debt, performance, security
- **Quality** - Completeness, testability, consistency
- **Risk** - Risk identification, dependencies, failure modes
- **Coverage** - Requirement completeness vs discovery context

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DiscoveryPage` | `@/pages/DiscoveryPage.tsx` | Main discovery tracking page |
| `DiscoveryCard` | `@/components/issue/discovery/DiscoveryCard.tsx` | Session card in list |
| `DiscoveryDetail` | `@/components/issue/discovery/DiscoveryDetail.tsx` | Findings detail view with filters and export |

### State Management

- **Local state**:
  - None (all data from hooks)

- **Custom hooks**:
  - `useIssueDiscovery` - Discovery sessions and findings data
    - Returns: `sessions`, `activeSession`, `findings`, `filters`, `isLoadingSessions`, `isLoadingFindings`, `error`
    - Methods: `setFilters`, `selectSession`, `exportFindings`, `exportSelectedFindings`
  - `useIssues` - Related issues data for finding navigation

---

## Configuration

### Auto-Refresh Interval

The discovery page automatically refreshes every 3 seconds:

```typescript
const { sessions, findings, /* ... */ } = useIssueDiscovery({
  refetchInterval: 3000  // 3 seconds
});
```

### Export Options

| Export Type | Description |
|-------------|-------------|
| **Export All** | Export all findings from the selected session |
| **Export Selected** | Export only the findings that are currently selected/checked |

---

## Related Links

- [Issue Hub](/features/issue-hub) - Unified issues, queue, and discovery management
- [Queue](/features/queue) - Issue execution queue management
- [Issues Panel](/features/issue-hub) - Issue list and GitHub sync
- [Terminal Dashboard](/features/terminal) - Real-time session monitoring
