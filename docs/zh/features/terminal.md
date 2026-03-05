# 终端仪表板

## 一句话概述
**终端仪表板提供以终端为首的工作空间，具有可调整大小的窗格、浮动面板和用于会话监控与编排的集成工具。**

---

## 解决的痛点

| 痛点 | 当前状态 | 终端仪表板解决方案 |
|------|----------|---------------------|
| **终端分散** | 多个终端窗口 | 统一的 tmux 风格网格布局 |
| **无上下文关联** | 无法将终端输出与问题关联 | 关联高亮提供程序 |
| **面板过多** | 固定布局浪费空间 | 浮动面板（互斥） |
| **缺少工具** | 在应用间切换 | 集成问题、队列、检查器、调度器 |
| **工作空间有限** | 无法同时查看代码和终端 | 可调整大小的三列布局 |

---

## 概述

**位置**: `ccw/frontend/src/pages/TerminalDashboardPage.tsx`

**用途**: 用于多终端会话管理的终端优先布局，配备集成工具和可调整大小的面板。

**访问方式**: 导航 → 终端仪表板 (`/terminal-dashboard`)

**布局**:
```
+--------------------------------------------------------------------------+
|  仪表板工具栏（面板切换、布局预设、全屏）                                    |
+--------------------------------------------------------------------------+
|  +----------------+-------------------------------------------+------------+ |
|  | 会话           |  终端网格（tmux 风格）               | 文件       | |
|  | 分组树         |  +----------+  +----------+              | 侧边栏     | |
|  | （可调整大小） |  | 终端 1   |  | 终端 2   |              |（可调整大小）| |
|  |                |  +----------+  +----------+              |            | |
|  |                |  +----------+  +----------+              |            | |
|  |                |  | 终端 3   |  | 终端 4   |              |            | |
|  |                |  +----------+  +----------+              |            | |
|  +----------------+-------------------------------------------+------------+ |
+--------------------------------------------------------------------------+
|  [浮动面板: 问题+队列 或 检查器 或 执行 或 调度器]                         |
+--------------------------------------------------------------------------+
```

---

## 实时演示

:::demo TerminalDashboardOverview #TerminalDashboardOverview.tsx :::

---

## 核心功能

| 功能 | 描述 |
|------|------|
| **三列布局** | 使用 Allotment 的可调整大小窗格：会话树（左）、终端网格（中）、文件侧边栏（右） |
| **终端网格** | Tmux 风格的分割窗格，带布局预设（单格、水平分割、垂直分割、2x2 网格） |
| **会话分组树** | CLI 会话的分层视图，按标签分组 |
| **浮动面板** | 互斥的叠加面板（问题+队列、检查器、执行监控器、调度器） |
| **关联高亮** | 终端、问题和队列项之间的跨面板链接 |
| **布局预设** | 快速布局按钮：单格窗格、水平分割、垂直分割、2x2 网格 |
| **启动 CLI** | 用于创建新 CLI 会话的配置模态框，可选择工具、模型和设置 |
| **全屏模式** | 沉浸模式隐藏应用框架（标题栏 + 侧边栏） |
| **功能标志** | 面板可见性由功能标志控制（队列、检查器、执行监控器） |

---

## 组件层次结构

```
TerminalDashboardPage
├── AssociationHighlightProvider（上下文）
├── DashboardToolbar
│   ├── 布局预设按钮（单格 | 水平分割 | 垂直分割 | 2x2 网格）
│   ├── 面板切换（会话 | 文件 | 问题 | 队列 | 检查器 | 执行 | 调度器）
│   ├── 全屏切换
│   └── 启动 CLI 按钮
├── Allotment（三列布局）
│   ├── SessionGroupTree
│   │   └── 会话分组项（可折叠）
│   ├── TerminalGrid
│   │   ├── GridGroupRenderer（递归）
│   │   └── TerminalPane
│   └── FileSidebarPanel
│       └── 文件树视图
└── FloatingPanel（多个，互斥）
    ├── 问题+队列（分割面板）
    │   ├── IssuePanel
    │   └── QueueListColumn
    ├── QueuePanel（功能标志）
    ├── InspectorContent（功能标志）
    ├── ExecutionMonitorPanel（功能标志）
    └── SchedulerPanel
```

---

## Props API

### TerminalDashboardPage

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| - | - | - | 此页面组件不接受任何 props（状态通过 hooks 和 Zustand stores 管理） |

### DashboardToolbar

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `activePanel` | `PanelId \| null` | `null` | 当前活动的浮动面板 |
| `onTogglePanel` | `(panelId: PanelId) => void` | - | 切换面板可见性的回调 |
| `isFileSidebarOpen` | `boolean` | `true` | 文件侧边栏可见性状态 |
| `onToggleFileSidebar` | `() => void` | - | 切换文件侧边栏回调 |
| `isSessionSidebarOpen` | `boolean` | `true` | 会话侧边栏可见性状态 |
| `onToggleSessionSidebar` | `() => void` | - | 切换会话侧边栏回调 |
| `isFullscreen` | `boolean` | `false` | 全屏模式状态 |
| `onToggleFullscreen` | `() => void` | - | 切换全屏回调 |

### FloatingPanel

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `isOpen` | `boolean` | `false` | 面板打开状态 |
| `onClose` | `() => void` | - | 关闭回调 |
| `title` | `string` | - | 面板标题 |
| `side` | `'left' \| 'right'` | `'left'` | 面板侧边 |
| `width` | `number` | `400` | 面板宽度（像素） |
| `children` | `ReactNode` | - | 面板内容 |

---

## 状态管理

### 本地状态

| 状态 | 类型 | 描述 |
|------|------|------|
| `activePanel` | `PanelId \| null` | 当前活动的浮动面板（互斥） |
| `isFileSidebarOpen` | `boolean` | 文件侧边栏可见性 |
| `isSessionSidebarOpen` | `boolean` | 会话侧边栏可见性 |

### Zustand Stores

| Store | 选择器 | 用途 |
|-------|--------|------|
| `workflowStore` | `selectProjectPath` | 文件侧边栏的当前项目路径 |
| `appStore` | `selectIsImmersiveMode` | 全屏模式状态 |
| `configStore` | `featureFlags` | 功能标志配置 |
| `terminalGridStore` | 网格布局和焦点窗格状态 |
| `executionMonitorStore` | 活动执行计数 |
| `queueSchedulerStore` | 调度器状态和设置 |

### 面板 ID 类型

```typescript
type PanelId = 'issues' | 'queue' | 'inspector' | 'execution' | 'scheduler';
```

---

## 使用示例

### 基本终端仪表板

```tsx
import { TerminalDashboardPage } from '@/pages/TerminalDashboardPage'

// 终端仪表板自动在 /terminal-dashboard 渲染
// 不需要 props - 布局状态内部管理
```

### 使用 FloatingPanel 组件

```tsx
import { FloatingPanel } from '@/components/terminal-dashboard/FloatingPanel'
import { IssuePanel } from '@/components/terminal-dashboard/IssuePanel'

function CustomLayout() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <FloatingPanel
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="问题"
      side="left"
      width={700}
    >
      <IssuePanel />
    </FloatingPanel>
  )
}
```

---

## 交互演示

### 布局预设演示

:::demo TerminalLayoutPresets #TerminalLayoutPresets.tsx :::

### 浮动面板演示

:::demo FloatingPanelsDemo #FloatingPanelsDemo.tsx :::

### 可调整大小窗格演示

:::demo ResizablePanesDemo #ResizablePanesDemo.tsx :::

---

## 配置

### 功能标志

| 标志 | 控制 |
|------|------|
| `dashboardQueuePanelEnabled` | 队列面板可见性 |
| `dashboardInspectorEnabled` | 检查器面板可见性 |
| `dashboardExecutionMonitorEnabled` | 执行监控器面板可见性 |

### 布局预设

| 预设 | 布局 |
|------|------|
| **单格** | 一个终端窗格 |
| **水平分割** | 两个窗格并排 |
| **垂直分割** | 两个窗格垂直堆叠 |
| **2x2 网格** | 2x2 网格中的四个窗格 |

### 面板类型

| 面板 | 内容 | 位置 | 功能标志 |
|------|------|------|----------|
| **问题+队列** | 组合的问题面板 + 队列列表列 | 左侧（叠加） | - |
| **队列** | 完整的队列管理面板 | 右侧（叠加） | `dashboardQueuePanelEnabled` |
| **检查器** | 关联链检查器 | 右侧（叠加） | `dashboardInspectorEnabled` |
| **执行监控器** | 实时执行跟踪 | 右侧（叠加） | `dashboardExecutionMonitorEnabled` |
| **调度器** | 队列调度器控制 | 右侧（叠加） | - |

---

## 可访问性

- **键盘导航**:
  - <kbd>Tab</kbd> - 在工具栏按钮之间导航
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - 激活工具栏按钮
  - <kbd>Escape</kbd> - 关闭浮动面板
  - <kbd>F11</kbd> - 切换全屏模式

- **ARIA 属性**:
  - 工具栏按钮上的 `aria-label`
  - 侧边栏切换上的 `aria-expanded`
  - 非活动浮动面板上的 `aria-hidden`
  - 浮动面板上的 `role="dialog"`

- **屏幕阅读器支持**:
  - 切换面板时宣布面板状态
  - 布局更改被宣布
  - 面板打开/关闭时的焦点管理

---

## 相关链接

- [编排器](/features/orchestrator) - 可视化工作流编辑器
- [会话](/features/sessions) - 会话管理
- [问题中心](/features/issue-hub) - 问题、队列、发现
- [资源管理器](/features/explorer) - 文件资源管理器
- [队列](/features/queue) - 队列管理独立页面
