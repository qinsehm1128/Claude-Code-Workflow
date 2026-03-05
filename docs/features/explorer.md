# Explorer & Graph Explorer

## One-Liner

**The Explorer pages provide codebase navigation with file tree browsing, code dependency visualization, and real-time search capabilities.**

---

## Pain Points Solved

| Pain Point | Current State | Explorer Solution |
|------------|---------------|-------------------|
| **No code overview** | Can't see codebase structure | File tree with hierarchical navigation |
| **Hard to find files** | Manual directory traversal | Search and filter with instant results |
| **Unknown dependencies** | Can't see relationships | Visual dependency graph with nodes/edges |
| **No context preview** | Open files blindly | File preview with syntax highlighting |
| **Lost in large codebases** | Can't navigate efficiently | Split view with resizable panes |

---

## File Explorer

### Page Overview

**Location**: `ccw/frontend/src/pages/ExplorerPage.tsx`

**Purpose**: File explorer with tree view and file preview panel.

**Access**: Navigation → Explorer

### Layout

```
+--------------------------------------------------------------------------+
|  Explorer Title                                                            |
+--------------------------------------------------------------------------+
|  Toolbar: [Search...] [Root v] [View v] [Sort v] [Hidden] [Expand][Collapse]|
+--------------------------------------------------------------------------+
|  +----------------+  /  +--------------------------------------------------+  |
|  | Tree View      |  |  File Preview                                     |  |
|  | (resizable)    |  |  - Syntax highlighting                             |  |
|  |                |  |  - Line numbers                                    |  |
|  | - Folder tree  |  |  - Language detection                             |  |
|  | - File icons   |  |                                                   |  |
|  | - Expandable   |  |                                                   |  |
|  +----------------+  +--------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### Core Features

| Feature | Description |
|---------|-------------|
| **Tree View** | Hierarchical file tree with expand/collapse |
| **File Preview** | Syntax-highlighted preview with line numbers |
| **Resizable Panes** | Drag divider to resize tree width (200-600px) |
| **Root Selection** | Change root directory from available options |
| **Search/Filter** | Filter files by name |
| **View Mode** | Toggle between tree and list view |
| **Sort Options** | Name, size, modified date |
| **Hidden Files** | Toggle show/hide hidden files |
| **Expand/Collapse All** | Bulk expand or collapse all folders |
| **Max File Size** | 1MB limit for preview |

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Open file** | Click file in tree to show preview |
| **Expand folder** | Click folder arrow to expand/collapse |
| **Resize pane** | Drag divider between tree and preview |
| **Change root** | Select root directory from dropdown |
| **Search files** | Type in search box to filter tree |
| **Sort files** | Select sort option from dropdown |

---

## Graph Explorer

### Page Overview

**Location**: `ccw/frontend/src/pages/GraphExplorerPage.tsx`

**Purpose**: Code dependency graph visualization using ReactFlow with filtering and node details.

**Access**: Navigation → Graph Explorer

### Layout

```
+--------------------------------------------------------------------------+
|  Graph Toolbar: [Filters] [Fit View] [Refresh] [Reset]                         |
+--------------------------------------------------------------------------+
|  +---------------------------------------------------+  +------------------+  |
|  | Graph Canvas (ReactFlow)                      |  | Sidebar          |  |
|  |                                               |  | (conditional)     |  |
|  |  [Module] --> [Class] --> [Function]         |  | - Node details    |  |
|  |                                               |  | - OR legend       |  |
|  |  Mini map, controls, background               |  |                  |  |
|  +---------------------------------------------------+  +------------------+  |
+--------------------------------------------------------------------------+
```

### Core Features

| Feature | Description |
|---------|-------------|
| **ReactFlow Canvas** | Interactive graph with zoom/pan |
| **Node Types** | Component, module, class, function, variable, interface, hook |
| **Edge Types** | Imports, exports, extends, implements, uses, calls, depends-on |
| **Filters** | Filter by node type, edge type, isolated nodes |
| **Sidebar** | Shows selected node details OR legend |
| **Mini Map** | Overview of entire graph |
| **Status Panel** | Node count, edge count, updating indicator |
| **Fit View** | Auto-fit graph in view |
| **Custom Node Styles** | Color-coded by node type |

### Node Types

| Type | Color | Description |
|------|-------|-------------|
| **Component** | Blue | React/component |
| **Module** | Blue | Code module |
| **Class** | Green | Class definition |
| **Function** | Orange | Function/method |
| **Variable** | Cyan | Variable declaration |
| **Interface** | Gray | Interface/type |
| **Hook** | Purple | React hook |

### Edge Types

| Type | Description |
|------|-------------|
| **Imports** | Module import |
| **Exports** | Module export |
| **Extends** | Class extension |
| **Implements** | Interface implementation |
| **Uses** | Usage reference |
| **Calls** | Function call |
| **Depends-on** | Dependency |

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Select node** | Click node to show details in sidebar |
| **Deselect** | Click canvas background |
| **Zoom in/out** | Use mouse wheel or zoom controls |
| **Pan canvas** | Drag canvas or use pan tool |
| **Fit view** | Click Fit View button |
| **Filter nodes** | Toggle node type filters in toolbar |
| **Filter edges** | Toggle edge type filters in toolbar |
| **Reset filters** | Click Reset button |

---

## Components Reference

### File Explorer Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ExplorerPage` | `@/pages/ExplorerPage.tsx` | Main file explorer page |
| `TreeView` | `@/components/shared/TreeView.tsx` | Hierarchical tree component |
| `FilePreview` | `@/components/shared/FilePreview.tsx` | File content preview |
| `ExplorerToolbar` | `@/components/shared/ExplorerToolbar.tsx` | Toolbar with controls |

### Graph Explorer Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `GraphExplorerPage` | `@/pages/GraphExplorerPage.tsx` | Main graph explorer page |
| `GraphToolbar` | `@/components/shared/GraphToolbar.tsx` | Toolbar with filters |
| `GraphSidebar` | `@/components/shared/GraphSidebar.tsx` | Node details or legend |
| `Custom Nodes` | `@/pages/graph-explorer/nodes/*` | Node type components |

### State Management

**File Explorer**:
- **Local state**: `rootPath`, `treeWidth`, `isResizing`
- **Custom hooks**: `useFileExplorer`, `useFileContent`

**Graph Explorer**:
- **Local state**: `selectedNode`, `isSidebarOpen`, `filters`
- **Custom hooks**: `useGraphData`

---

## Configuration

### File Explorer Settings

```typescript
const DEFAULT_TREE_WIDTH = 300;
const MIN_TREE_WIDTH = 200;
const MAX_TREE_WIDTH = 600;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
```

### Graph Explorer Settings

```typescript
const defaultFilters: GraphFilters = {
  nodeTypes: ['component', 'module', 'class', 'function', 'variable', 'interface', 'hook'],
  edgeTypes: ['imports', 'exports', 'extends', 'implements', 'uses', 'calls', 'depends-on'],
  showIsolatedNodes: false,
};
```

---

## Related Links

- [Memory](/features/memory) - Persistent codebase knowledge
- [Terminal Dashboard](/features/terminal) - Terminal workspace with file sidebar
- [Orchestrator](/features/orchestrator) - Visual workflow editor
