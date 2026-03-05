# Memory System

## One-Liner

**The Memory System provides a unified interface for managing persistent knowledge across sessions, including core memory, workflow context, CLI history, vector search, and V2 pipeline operations.**

---

## Pain Points Solved

| Pain Point | Current State | Memory System Solution |
|------------|---------------|------------------------|
| **Cross-session amnesia** | New session requires re-explaining project | Persistent memory across sessions |
| **Lost decisions** | Architecture decisions forgotten | Decision log persists |
| **Repeated explanations** | Same context explained multiple times | Memory auto-injection |
| **Knowledge silos** | Each developer maintains own context | Shared team memory |
| **Scattered data sources** | Core/workflow/CLI history separate | Unified search across all categories |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/MemoryPage.tsx`

**Purpose**: View and manage core memory with CRUD operations and unified vector search.

**Access**: Navigation → Memory

### Layout

```
+--------------------------------------------------------------------------+
|  Memory Title                                              [Refresh] [Fullscreen]|
+--------------------------------------------------------------------------+
|  [Core] [Workflow] [CLI History] [Search] [V2 Pipeline]                      |
+--------------------------------------------------------------------------+
|  Tab Content (varies by active tab)                                        |
|  +--------------------------------------------------------------------+    |
|  |                                                                    |    |
|  |  - Memory list with CRUD operations                                 |    |
|  |  - Search interface with filters                                    |    |
|  |  - Source type badges and tags                                      |    |
|  |  - V2 pipeline job monitoring (V2 tab)                              |    |
|  |                                                                    |    |
|  +--------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Tabbed Interface** | Five tabs: Core, Workflow, CLI History, Search, V2 Pipeline |
| **CRUD Operations** | Create, edit, delete memories with confirmation dialogs |
| **Unified Search** | Vector search across all memory categories |
| **Source Type Filtering** | Filter by core_memory, workflow, cli_history |
| **Tag Filtering** | Filter memories by custom tags |
| **Batch Operations** | Select all, delete selected |
| **Recommendations** | View memory recommendations from AI |
| **Re-index** | Rebuild memory index |
| **Export** | Export search results to file |
| **V2 Pipeline** | Monitor extraction and consolidation jobs |
| **Immersive Mode** | Fullscreen toggle for focused work |

---

## Memory Categories

| Tab | Source Type | Description |
|-----|-------------|-------------|
| **Core** | `core_memory` | Persistent project knowledge stored in `~/.claude/memory/` |
| **Workflow** | `workflow` | Session context from `.workflow/.memory/` |
| **CLI History** | `cli_history` | Command execution history |
| **Search** | All | Unified vector search across all categories |
| **V2 Pipeline** | - | Extraction and consolidation job monitoring |

---

## Usage Guide

### Basic Workflow

1. **Browse Memories**: Switch between Core/Workflow/CLI History tabs
2. **Create Memory**: Click "New Memory" button, fill in the form
3. **Edit Memory**: Click edit button on memory card, modify content
4. **Delete Memory**: Click delete button, confirm in dialog
5. **Search**: Switch to Search tab, enter query to find memories
6. **Filter Results**: Use source type and tag filters to narrow results

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Create memory** | Click "New Memory" button, fill form, submit |
| **Edit memory** | Click edit (pencil) button on memory card |
| **Delete memory** | Click delete (trash) button, confirm |
| **Search memories** | Switch to Search tab, type query, filter results |
| **Export results** | Select memories, click "Export Selected" |
| **Re-index memory** | Click "Re-index" to rebuild search index |
| **Select all** | Click "Select All" checkbox to select all visible memories |
| **Delete selected** | Click "Delete Selected" to batch delete |

### Source Type Badges

| Source Type | Color | Description |
|-------------|-------|-------------|
| **core_memory** | Blue | Persistent project knowledge |
| **workflow** | Green | Workflow session context |
| **cli_history** | Amber | CLI command history |

### Memory Metadata

Each memory entry contains:
- **ID**: Unique identifier (format: `CMEM-YYYYMMDD-HHMMSS`)
- **Content**: Markdown-formatted text
- **Tags**: Array of tag strings for categorization
- **Created/Updated**: Timestamps
- **Source Type**: Category identifier

---

## V2 Pipeline

The V2 Pipeline tab monitors background jobs for:

| Job Type | Description |
|----------|-------------|
| **Extraction** | Extract knowledge from sessions |
| **Consolidation** | Consolidate and summarize memories |
| **Embedding** | Generate vector embeddings for search |

### Job Status

| Status | Description |
|--------|-------------|
| **Pending** | Job queued, not started |
| **Running** | Job in progress |
| **Done** | Job completed successfully |
| **Error** | Job failed with error message |

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MemoryPage` | `@/pages/MemoryPage.tsx` | Main memory management page |
| `V2PipelineTab` | `@/components/memory/V2PipelineTab.tsx` | V2 pipeline job monitoring |
| `MemoryCard` | (internal to MemoryPage) | Individual memory display |

### State Management

- **Local state**:
  - `activeTab`: TabValue
  - `searchQuery`: string
  - `selectedMemories`: Set&lt;string&gt;
  - `filters`: { sourceType?: string; tags?: string[] }
  - `dialogStates`: create, edit, delete

- **Custom hooks**:
  - `useMemory` - Core memory CRUD operations
  - `useMemoryMutations` - Memory mutations (create, update, delete)
  - `useUnifiedSearch` - Vector search across categories
  - `useUnifiedStats` - Memory statistics
  - `useRecommendations` - AI-generated recommendations
  - `useReindex` - Rebuild search index

---

## Configuration

No configuration required. The memory system automatically fetches data from the backend.

### Memory API Endpoints

| Operation | Endpoint |
|-----------|----------|
| List memories | `GET /api/memory` |
| Create memory | `POST /api/memory` |
| Update memory | `PUT /api/memory/:id` |
| Delete memory | `DELETE /api/memory/:id` |
| Search | `POST /api/memory/search` |
| Re-index | `POST /api/memory/reindex` |
| V2 Jobs | `GET /api/memory/v2/jobs` |

---

## Related Links

- [Spec System](/features/spec) - Constraint injection
- [CLI Call](/features/cli) - Command line invocation
- [Explorer](/features/explorer) - Codebase navigation
- [Dashboard](/features/dashboard) - Project overview
