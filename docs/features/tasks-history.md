# Tasks & History

## One-Liner

**Tasks & History pages provide comprehensive views of lite tasks, analysis sessions, prompt history, and review sessions with filtering, search, and detail inspection capabilities.**

---

## Lite Tasks

### Page Overview

**Location**: `ccw/frontend/src/pages/LiteTasksPage.tsx`

**Purpose**: Lite-plan and multi-cli-plan task list page with TaskDrawer for details.

**Access**: Navigation → Lite Tasks

### Features

| Feature | Description |
|---------|-------------|
| **Type Tabs** | Switch between lite-plan, multi-cli-plan types |
| **Task Cards** | Display task title, description, status, tags, progress |
| **TaskDrawer** | Slide-over panel with full task context and synthesis |
| **Round Synthesis** | Multi-perspective analysis results |
| **Context Content** | Full context view with expandable sections |
| **Status Indicators** | Visual badges for task status (planning, in_progress, completed, failed) |
| **Progress Bars** | Visual progress for running tasks |
| **Tag System** | Category tags for organization |

### Task Types

| Type | Description |
|------|-------------|
| **lite-plan** | Quick planning tasks |
| **multi-cli-plan** | Multi-perspective planning with multiple tools |

### Task Status Flow

```
planning → in_progress → completed
    ↓
  failed
```

---

## Analysis Page

### Page Overview

**Location**: `ccw/frontend/src/pages/AnalysisPage.tsx`

**Purpose**: View analysis sessions from `/workflow:analyze-with-file` command.

**Access**: Navigation → Analysis

### Features

| Feature | Description |
|---------|-------------|
| **Session Cards** | Grid view with topic, session ID, status, date |
| **Status Filter** | Filter by all, in_progress, completed |
| **Date Filter** | Filter by all, today, week, month |
| **Date Quick Filter** | Quick select by specific dates with counts |
| **Search** | Filter by topic or session ID |
| **Pagination** | 16 items per page (4x4 grid) |
| **Detail Drawer** | Slide-over panel with tabs |
| **Detail Tabs** | Discussion, Conclusions, Explorations, Perspectives |
| **Fullscreen Mode** | Immersive view toggle |

### Analysis Session Structure

Each session contains:
- **Discussion** - Markdown formatted discussion log
- **Conclusions** - Structured conclusion data
- **Explorations** - Code exploration findings
- **Perspectives** - Multi-perspective analysis results

---

## Prompt History

### Page Overview

**Location**: `ccw/frontend/src/pages/PromptHistoryPage.tsx`

**Purpose**: View and manage prompt history with AI insights and timeline view.

**Access**: Navigation → Prompt History

### Features

| Feature | Description |
|---------|-------------|
| **Stats Dashboard** | Total prompts, unique intents, session groups |
| **Timeline View** | Grouped by session or date |
| **Intent Filter** | Filter by bug-fix, feature, refactor, document, analyze |
| **Project Filter** | Filter by project path |
| **Search** | Filter by prompt content |
| **AI Insights** | Pattern analysis and suggestions |
| **Insights History** | Historical insight list |
| **Batch Operations** | Select all, batch delete |
| **Insight Detail** | Click to view full insight |

### Prompt Card Details

Each prompt card shows:
- **Prompt Text** - Truncated preview
- **Intent Badge** - Category classification
- **Timestamp** - When prompt was created
- **Session Info** - Associated session
- **Delete Action** - Remove from history
- **Select Checkbox** - Batch selection mode

---

## Review Session

### Page Overview

**Location**: `ccw/frontend/src/pages/ReviewSessionPage.tsx`

**Purpose**: Review session detail page with findings display, multi-select, and fix progress tracking.

**Access**: Click review link from session detail OR direct route

### Features

| Feature | Description |
|---------|-------------|
| **Findings Grid** | Card-based findings display |
| **Dimension Tabs** | Filter by analysis dimension |
| **Severity Filter** | Critical, High, Medium, Low |
| **Sort Controls** | Sort by severity, dimension, file |
| **Multi-Select** | Select multiple findings |
| **Fix Progress** | Track fix stages with carousel |
| **Export Selected** | Export selected findings |
| **Findings Drawer** | Detail panel for selected finding |

### Finding Structure

Each finding contains:
- **Title** - Finding summary
- **Description** - Detailed explanation
- **Severity** - Critical, High, Medium, Low
- **Dimension** - Analysis dimension (e.g., security, performance)
- **Category** - Finding category
- **File/Line** - Source location
- **Code Context** - Relevant code snippet
- **Recommendations** - Fix suggestions
- **Root Cause** - Analysis of root cause
- **Impact** - Potential impact

### Fix Progress Tracking

| Stage | Description |
|-------|-------------|
| **Planning** | Fix planning stage |
| **Execution** | Fix execution stage |
| **Completion** | Fix completion stage |

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LiteTasksPage` | `@/pages/LiteTasksPage.tsx` | Lite tasks list with drawer |
| `AnalysisPage` | `@/pages/AnalysisPage.tsx` | Analysis sessions viewer |
| `PromptHistoryPage` | `@/pages/PromptHistoryPage.tsx` | Prompt history with insights |
| `ReviewSessionPage` | `@/pages/ReviewSessionPage.tsx` | Review session details |

### Shared Components

| Component | Purpose |
|-----------|---------|
| `TaskDrawer` | Task detail slide-over panel |
| `PromptCard` | Prompt display with actions |
| `InsightsPanel` | AI insights display |
| `InsightDetailPanel` | Insight detail overlay |
| `BatchOperationToolbar` | Batch operations controls |

### State Management

**Lite Tasks**:
- `useLiteTasks` - Task data and context
- Fetching: `fetchLiteSessionContext`

**Analysis**:
- `fetchAnalysisSessions` - Session list
- `fetchAnalysisDetail` - Session detail

**Prompt History**:
- `usePromptHistory` - Prompt data and stats
- `usePromptInsights` - AI insights
- `useInsightsHistory` - Historical insights
- Mutations: `analyzePrompts`, `deletePrompt`, `batchDeletePrompts`

**Review Session**:
- `useReviewSession` - Review data and fix progress

---

## Related Links

- [Sessions](/features/sessions) - Workflow session management
- [Dashboard](/features/dashboard) - Recent tasks widget
- [Memory](/features/memory) - Persistent knowledge storage
- [Extensions](/features/extensions) - Skills and commands management
