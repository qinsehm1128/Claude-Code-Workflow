# 队列管理

## 一句话概述
**队列管理页面提供对问题执行队列的集中控制，配备调度器控件、状态监控和会话池管理。**

---

## 解决的痛点

| 痛点 | 当前状态 | 队列解决方案 |
|------|----------|--------------|
| **执行无序** | 没有统一的任务队列 | 带分组项目的集中化队列 |
| **调度器状态未知** | 不知道调度器是否在运行 | 实时状态指示器（空闲/运行/暂停） |
| **无执行控制** | 无法启动/停止队列处理 | 带确认的开始/暂停/停止控件 |
| **并发限制** | 同时运行太多会话 | 可配置的最大并发会话数 |
| **无可见性** | 不知道队列中有什么 | 统计卡片 + 带状态跟踪的项目列表 |
| **资源浪费** | 空闲会话消耗资源 | 带超时配置的会话池概览 |

---

## 概述

**位置**: `ccw/frontend/src/pages/QueuePage.tsx`（旧版），`ccw/frontend/src/components/terminal-dashboard/QueuePanel.tsx`（当前）

**用途**: 查看和管理问题执行队列，配备调度器控件、进度跟踪和会话池管理。

**访问方式**: 导航 → 问题 → 队列标签页 或 终端仪表板 → 队列浮动面板

**布局**:
```
+--------------------------------------------------------------------------+
|  队列面板标题栏                                                             |
+--------------------------------------------------------------------------+
|  调度器状态栏                                                               |
|  +----------------+  +-------------+  +-------------------------------+         |
|  | 状态徽章       |  | 进度         |  | 并发数 (2/2)                  |         |
|  +----------------+  +-------------+  +-------------------------------+         |
+--------------------------------------------------------------------------+
|  调度器控件                                                                |
|  +--------+  +--------+  +--------+  +-----------+                          |
|  | 开始  |  | 暂停  |  | 停止   |  | 配置      |                          |
|  +--------+  +--------+  +--------+  +-----------+                          |
+--------------------------------------------------------------------------+
|  队列项目列表                                                              |
|  +---------------------------------------------------------------------+    |
|  | QueueItemRow（状态、issue_id、session_key、操作）                  |    |
|  | - 状态图标（待处理/执行中/已完成/被阻塞/失败）                    |    |
|  | - Issue ID / 项目 ID 显示                                           |    |
|  | - 会话绑定信息                                                       |    |
|  | - 进度指示器（对于执行中的项目）                                     |    |
|  +---------------------------------------------------------------------+    |
|  | [更多队列项目...]                                                    |    |
|  +---------------------------------------------------------------------+    |
+--------------------------------------------------------------------------+
|  会话池概览（可选）                                                         |
|  +--------------------------------------------------------------------------+
|  | 活动会话 | 空闲会话 | 总会话数                                        |
|  +--------------------------------------------------------------------------+
```

---

## 核心功能

| 功能 | 描述 |
|------|------|
| **调度器状态** | 实时状态指示器（空闲/运行/暂停），带视觉徽章 |
| **进度跟踪** | 显示队列总体完成百分比的进度条 |
| **开始/暂停/停止控件** | 控制队列执行，停止操作时带确认对话框 |
| **并发显示** | 显示当前活动会话数与最大并发会话数 |
| **队列项目列表** | 所有队列项目的可滚动列表，附带状态、Issue ID 和会话绑定 |
| **状态图标** | 项目状态的视觉指示器（待处理/执行中/已完成/被阻塞/失败） |
| **会话池** | 活动会话、空闲会话和总会话数的概览 |
| **配置面板** | 调整最大并发会话数和超时设置 |
| **空状态** | 队列为空时的友好消息，附带添加项目的说明 |

---

## 组件层次结构

```
QueuePage（旧版）/ QueuePanel（当前）
├── QueuePanelHeader
│   ├── 标题
│   └── 标签切换器（队列 | 编排器）
├── SchedulerBar（内联在 QueueListColumn 中）
│   ├── 状态徽章
│   ├── 进度 + 并发数
│   └── 控制按钮（播放/暂停/停止）
├── QueueItemsList
│   └── QueueItemRow（重复）
│       ├── 状态图标
│       ├── Issue ID / 项目 ID
│       ├── 会话绑定
│       └── 进度（对于执行中的项目）
└── SchedulerPanel（独立）
    ├── 状态部分
    ├── 进度条
    ├── 控制按钮
    ├── 配置部分
    │   ├── 最大并发会话数
    │   ├── 会话空闲超时
    │   └── 恢复键绑定超时
    └── 会话池概览
```

---

## Props API

### QueuePanel

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `embedded` | `boolean` | `false` | 面板是否嵌入在另一个组件中 |

### SchedulerPanel

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| - | - | - | 此组件不接受任何 props（所有数据来自 Zustand store） |

### QueueListColumn

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| - | - | - | 此组件不接受任何 props（所有数据来自 Zustand store） |

---

## 状态管理

### Zustand Stores

| Store | 选择器 | 用途 |
|-------|--------|------|
| `queueSchedulerStore` | `selectQueueSchedulerStatus` | 当前调度器状态（空闲/运行/暂停） |
| `queueSchedulerStore` | `selectSchedulerProgress` | 队列总体完成百分比 |
| `queueSchedulerStore` | `selectQueueItems` | 所有队列项目的列表 |
| `queueSchedulerStore` | `selectCurrentConcurrency` | 活动会话计数 |
| `queueSchedulerStore` | `selectSchedulerConfig` | 调度器配置 |
| `queueSchedulerStore` | `selectSessionPool` | 会话池概览 |
| `queueSchedulerStore` | `selectSchedulerError` | 错误消息（如果有） |
| `issueQueueIntegrationStore` | `selectAssociationChain` | 用于高亮显示的当前关联链 |
| `queueExecutionStore` | `selectByQueueItem` | 队列项目的执行数据 |

### 队列项目状态

```typescript
type QueueItemStatus =
  | 'pending'      // 等待执行
  | 'executing'    // 正在处理中
  | 'completed'    // 成功完成
  | 'blocked'      // 被依赖项阻塞
  | 'failed';      // 失败并报错
```

### 调度器状态

```typescript
type QueueSchedulerStatus =
  | 'idle'     // 无项目或已停止
  | 'running'  // 活动处理项目
  | 'paused';  // 临时暂停
```

---

## 使用示例

### 基本队列面板

```tsx
import { QueuePanel } from '@/components/terminal-dashboard/QueuePanel'

function QueueSection() {
  return <QueuePanel />
}
```

### 独立调度器面板

```tsx
import { SchedulerPanel } from '@/components/terminal-dashboard/SchedulerPanel'

function SchedulerControls() {
  return <SchedulerPanel />
}
```

### 嵌入式队列列表列

```tsx
import { QueueListColumn } from '@/components/terminal-dashboard/QueueListColumn'

function EmbeddedQueue() {
  return <QueueListColumn />
}
```

### 队列 Store 操作

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
      <button onClick={handleStart}>开始</button>
      <button onClick={handlePause}>暂停</button>
      <button onClick={handleStop}>停止</button>
      <button onClick={() => handleConfig({ maxConcurrentSessions: 4 })}>
        设置最大值为 4
      </button>
    </div>
  )
}
```

---

## 配置

### 调度器配置

| 设置 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxConcurrentSessions` | `number` | `2` | 同时运行的最大会话数 |
| `sessionIdleTimeoutMs` | `number` | `60000` | 空闲会话超时时间（毫秒） |
| `resumeKeySessionBindingTimeoutMs` | `number` | `300000` | 恢复键绑定超时时间（毫秒） |

### 队列项目结构

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

## 可访问性

- **键盘导航**:
  - <kbd>Tab</kbd> - 在队列项目和控件之间导航
  - <kbd>Enter</kbd>/<kbd>Space</kbd> - 激活按钮
  - <kbd>Escape</kbd> - 关闭对话框

- **ARIA 属性**:
  - 控制按钮上的 `aria-label`
  - 状态更新的 `aria-live` 区域
  - 当前队列项目的 `aria-current`
  - 队列项目列表上的 `role="list"`

- **屏幕阅读器支持**:
  - 状态变化被宣布
  - 进度更新被朗读
  - 错误消息被宣布

---

## 相关链接

- [问题中心](/features/issue-hub) - 统一的问题、队列和发现管理
- [终端仪表板](/features/terminal) - 带集成队列面板的终端优先工作空间
- [发现](/features/discovery) - 发现会话跟踪
- [会话](/features/sessions) - 会话管理和详情
