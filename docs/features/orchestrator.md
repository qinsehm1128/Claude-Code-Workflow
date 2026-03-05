# Orchestrator

## One-Liner

**The Orchestrator is a visual workflow template editor with React Flow, featuring drag-drop node palette, property panel, and template library for designing automation flows.**

---

## Pain Points Solved

| Pain Point | Current State | Orchestrator Solution |
|------------|---------------|-----------------------|
| **No visual workflow design** | Manual configuration file editing | Drag-and-drop canvas interface |
| **Hard to understand flows** | Text-based configuration | Visual node graphs with connections |
| **No template reuse** | Recreate flows from scratch | Template library for quick start |
| **Complex node configuration** | Remember all options | Contextual property panel |
| **Accidental edits during execution** | Can modify while running | Canvas lock during execution |

---

## Page Overview

**Location**: `ccw/frontend/src/pages/orchestrator/OrchestratorPage.tsx`

**Purpose**: Visual workflow template editor for creating, editing, and managing automation flows.

**Access**: Navigation → Orchestrator

### Layout

```
+--------------------------------------------------------------------------+
|  Flow Toolbar (save, load, template library, execution controls)             |
+--------------------------------------------------------------------------+
|  +-------+------------------------------------------------------+-------+  |
|  | Node  |  Flow Canvas (React Flow)                     | Prop  |  |
|  | Palet |  +----+    +----+    +----+                     | Panel |  |
|  | (coll)|  | N1 | -->| N2 | -->| N3 |                     | (cond)|  |
|  |       |  +----+    +----+    +----+                     |       |  |
|  |       |                                                |       |  |
|  +-------+------------------------------------------------------+-------+  |
+--------------------------------------------------------------------------+
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Node Palette (Left Sidebar)** | Collapsible panel with categorized nodes (templates, nodes tabs) |
| **Flow Canvas (Center)** | ReactFlow graph with zoom/pan, minimap, controls, grid background |
| **Property Panel (Right Overlay)** | Contextual property editor that appears when node is selected |
| **Template Library** | Dialog for browsing and loading saved templates |
| **Drag-and-Drop** | Drag nodes from palette to canvas to add them |
| **Connection Handles** | Connect nodes by dragging from output to input handles |
| **Interaction Modes** | Toggle between pan and selection modes (Ctrl to temporarily reverse) |
| **Execution Lock** | Canvas is read-only during flow execution |
| **Layout Persistence** | Sidebar width persists in local storage |
| **Snap to Grid** | Nodes align to 15px grid for neat layouts |

---

## Usage Guide

### Basic Workflow

1. **Open Orchestrator**: Navigate to Orchestrator page (flows auto-load)
2. **Add Nodes**: Drag nodes from palette OR double-click palette items
3. **Connect Nodes**: Drag from output handle to input handle
4. **Configure Nodes**: Click node to open property panel, edit properties
5. **Save Flow**: Click save button in toolbar
6. **Use Templates**: Open template library to browse/load templates

### Key Interactions

| Interaction | How to Use |
|-------------|------------|
| **Add node (drag)** | Drag node from palette to canvas |
| **Add node (double-click)** | Double-click palette item |
| **Connect nodes** | Drag from source output handle to target input handle |
| **Select node** | Click node (opens property panel) |
| **Deselect** | Click canvas background |
| **Move node** | Drag node (when not executing) |
| **Delete node/edge** | Select and press Backspace/Delete (when not executing) |
| **Zoom in/out** | Use zoom controls or mouse wheel |
| **Fit view** | Click fit view button |
| **Pan canvas** | Drag canvas (pan mode) or use middle mouse button |
| **Toggle interaction mode** | Click mode toggle button or hold Ctrl (temporarily reverse) |
| **Collapse palette** | Click collapse button (or click expand button when collapsed) |
| **Open template library** | Click template library button in toolbar |

### Node Categories

The node palette organizes nodes into categories:
- **Prompt Templates** - Pre-built prompt templates with variables
- **Commands** - Slash command invocations
- **Tools** - External tool integrations
- **Custom** - User-defined nodes

### Canvas Controls

| Control | Location | Function |
|---------|----------|----------|
| **Zoom In/Out** | Controls (bottom-right) | Zoom canvas in/out |
| **Fit View** | Controls (bottom-right) | Fit all nodes in view |
| **Interactive Mode** | Controls (bottom-right) | Toggle pan/selection mode |
| **Mini Map** | Bottom-right | Overview of entire flow |
| **Grid Background** | Canvas | Visual reference for alignment |

---

## Property Panel

The property panel appears as an overlay when a node is selected. It provides:

### Common Properties

| Property | Description |
|----------|-------------|
| **Node Name** | Display name for the node |
| **Node ID** | Unique identifier (auto-generated) |
| **Execution Mode** | How node executes (sync/async/etc.) |
| **Instructions** | Prompt instructions with template support |
| **Variables** | Input/output variable definitions |
| **Tags** | Custom tags for organization |
| **Commands** | Associated slash commands |

### Template Editor Features

- **Built-in Templates**: Pre-defined instruction templates
- **Custom Tags**: Tag-based instruction system (e.g., `{{$INPUT}}`)
- **Variable Inputs**: Template variables with custom values
- **Preview**: Live preview of rendered instructions

---

## Components Reference

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `OrchestratorPage` | `@/pages/orchestrator/OrchestratorPage.tsx` | Main orchestrator page |
| `FlowToolbar` | `@/pages/orchestrator/FlowToolbar.tsx` | Top toolbar with actions |
| `LeftSidebar` | `@/pages/orchestrator/LeftSidebar.tsx` | Collapsible node palette |
| `FlowCanvas` | `@/pages/orchestrator/FlowCanvas.tsx` | ReactFlow graph canvas |
| `PropertyPanel` | `@/pages/orchestrator/PropertyPanel.tsx` | Node property editor overlay |
| `TemplateLibrary` | `@/pages/orchestrator/TemplateLibrary.tsx` | Template browser dialog |
| `NodeLibrary` | `@/pages/orchestrator/NodeLibrary.tsx` | Node palette content |
| `InlineTemplatePanel` | `@/pages/orchestrator/InlineTemplatePanel.tsx` | Template palette content |
| `InteractionModeToggle` | `@/pages/orchestrator/InteractionModeToggle.tsx` | Pan/selection mode toggle |

### Node Types

| Node Type | Purpose |
|-----------|---------|
| `PromptTemplateNode` | Unified prompt template node with instructions |
| Custom nodes | Extended from base node types |

### State Management

- **Local state** (OrchestratorPage):
  - `isTemplateLibraryOpen`: boolean

- **Zustand stores** (`useFlowStore`):
  - `nodes` - Flow nodes array
  - `edges` - Flow edges array
  - `selectedNodeId` - Currently selected node
  - `isPaletteOpen` - Palette expanded state
  - `isPropertyPanelOpen` - Property panel visibility
  - `leftPanelTab` - Active palette tab ('templates' | 'nodes')
  - `interactionMode` - Pan or selection mode

- **Execution store** (`useExecutionStore`):
  - `isExecuting` - Whether flow is currently executing (locks canvas)

---

## Configuration

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Backspace/Delete** | Delete selected node/edge (when not executing) |
| **Ctrl/Cmd (hold)** | Temporarily reverse interaction mode |
| **Mouse wheel** | Zoom in/out |
| **Middle mouse drag** | Pan canvas |

### Canvas Settings

```typescript
{
  snapToGrid: true,
  snapGrid: [15, 15],  // 15px grid alignment
  nodesDraggable: !isExecuting,
  nodesConnectable: !isExecuting,
  elementsSelectable: !isExecuting
}
```

---

## Related Links

- [Terminal Dashboard](/features/terminal) - Terminal-first execution monitoring
- [Sessions](/features/sessions) - Workflow session management
- [Commands Management](/features/extensions) - Slash command configuration
