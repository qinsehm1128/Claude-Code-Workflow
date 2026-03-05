# Issue Hub

## One-Liner

**The Issue Hub is a unified management interface for issues, execution queues, and discovery sessions with tabbed navigation and shared actions.**

---

## Pain Points Solved

| Pain Point | Current State | Issue Hub Solution |
|------------|---------------|-------------------|
| **Scattered views** | Separate pages for issues/queue/discovery | Single unified page with tab navigation |
| **Context switching** | Hard to move between related features | Tab-based navigation persists in URL |
| **Duplicate actions** | Different actions per view | Context-aware action buttons per tab |
| **No issue creation** | Can't create new issues from UI | New issue dialog with attachments |
| **Missing sync** | No GitHub integration | GitHub sync button on Issues tab |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/IssueHubPage.tsx`

**Purpose**: Unified page for managing issues, queue, and discovery with tab navigation and context-aware actions.

**Access**: Navigation → Issues OR direct routes `/issues?tab=issues|queue|discovery`

### Layout

```
+--------------------------------------------------------------------------+
|  Issue Hub Header (dynamic based on active tab)                             |
|  [Refresh] [GitHub Sync] [Create Issue] [Fullscreen]                       |
+--------------------------------------------------------------------------+
|  [Issues] [Queue] [Discovery]                                              |
+--------------------------------------------------------------------------+
|  Tab Content (switches based on active tab)                                |
|  +--------------------------------------------------------------------+    |
|  |                                                                    |    |
|  |  Issues Panel OR Queue Panel OR Discovery Panel                    |    |
|  |                                                                    |    |
|  |  Each panel has its own layout and controls                        |    |
|  |                                                                    |    |
|  +--------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Tab Navigation** | Three tabs: Issues, Queue, Discovery. Tab state persists in URL (`?tab=issues`) |
| **Dynamic Header** | Header title changes based on active tab |
| **Context-Aware Actions** | Action buttons change based on current tab |
| **GitHub Sync** | Pull issues from GitHub (Issues tab only) |
| **Create Issue** | Modal dialog for creating new issues with attachments |
| **Immersive Mode** | Fullscreen toggle to hide app chrome |
| **Auto-Refresh** | Per-tab refresh buttons with loading states |

### Tab-Specific Features

| Tab | Features |
|-----|----------|
| **Issues** | Refresh, GitHub Sync, Create Issue buttons |
| **Queue** | Refresh button only |
| **Discovery** | Internal controls (no header actions) |

---

## Usage Guide

### Basic Workflow

1. **Navigate to Issue Hub**: Click "Issues" in the navigation
2. **Switch Tabs**: Click tab buttons or modify URL (`?tab=queue`)
3. **Issues Tab**: View issues, sync from GitHub, create new issues
4. **Queue Tab**: View and manage execution queue
5. **Discovery Tab**: Track discovery sessions

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Switch tabs** | Click tab buttons OR use URL parameter `?tab=issues|queue|discovery` |
| **Refresh current tab** | Click the refresh button (actions update per tab) |
| **Sync from GitHub** | Click the GitHub sync button on Issues tab |
| **Create new issue** | Click "Create Issue" button, fill in the form |
| **Toggle fullscreen** | Click the fullscreen button to enter/exit immersive mode |

### New Issue Dialog

| Field | Description | Required |
|-------|-------------|----------|
| **Title** | Issue title (max 200 chars) | Yes |
| **Description** | Detailed context (max 10000 chars) | No |
| **Type** | Bug, Feature, Improvement, Other | No (default: Other) |
| **Priority** | Low, Medium, High, Critical | No (default: Medium) |
| **Attachments** | Images, Markdown, text, PDF files | No |

**Attachment Support**:
- Drag and drop files onto the upload area
- Click to open file picker
- Supported types: Images, Markdown (.md), text (.txt), JSON (.json), PDF (.pdf)
- Remove attachments before creating issue

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `IssueHubPage` | `@/pages/IssueHubPage.tsx` | Main issue hub with tabs |
| `IssueHubHeader` | `@/components/issue/hub/IssueHubHeader.tsx` | Dynamic header based on tab |
| `IssueHubTabs` | `@/components/issue/hub/IssueHubTabs.tsx` | Tab switcher |
| `IssuesPanel` | `@/components/issue/hub/IssuesPanel.tsx` | Issues list and management |
| `QueuePanel` | `@/components/issue/hub/QueuePanel.tsx` | Queue management |
| `DiscoveryPanel` | `@/components/issue/hub/DiscoveryPanel.tsx` | Discovery tracking |
| `NewIssueDialog` | (internal to IssueHubPage) | Create issue modal |

### State Management

- **Local state**:
  - `currentTab`: IssueTab ('issues' | 'queue' | 'discovery')
  - `isNewIssueOpen`: boolean
  - `isGithubSyncing`: boolean

- **URL state**:
  - Tab persists in URL search param: `?tab=issues`

- **Custom hooks**:
  - `useIssues` - Issues data and refresh
  - `useIssueQueue` - Queue data and refresh
  - `useIssueMutations` - Create issue mutation
  - `pullIssuesFromGitHub` - GitHub sync API call
  - `uploadAttachments` - Attachment upload for new issues

---

## Configuration

### Tab Navigation

Tabs are validated against allowed values:

```typescript
const VALID_TABS: IssueTab[] = ['issues', 'queue', 'discovery'];
```

Invalid tab values automatically redirect to 'issues'.

### Issue Types

| Type | Color | Description |
|------|-------|-------------|
| **Bug** | Red | Functional errors or problems |
| **Feature** | Green | New feature requests |
| **Improvement** | Blue | Enhancements to existing features |
| **Other** | Gray | Other types |

---

## Related Links

- [Issues Panel](/features/issue-hub) - Detailed issue management
- [Queue](/features/queue) - Queue management details
- [Discovery](/features/discovery) - Discovery session details
- [Sessions](/features/sessions) - Workflow session management
