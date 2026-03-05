# Dashboard 面板

## 一句话定位

**Dashboard 是 VS Code 内置的可视化管理中心** — 一个 Webview 界面统一管理 Specs、Skills、Memory、会话历史和 CLI 终端，无需离开编辑器。

## 解决的痛点

| 痛点 | 现状 | Dashboard 方案 |
| --- | --- | --- |
| **分散管理** | Specs、Skills、Memory 各自独立管理 | 统一界面集中管理 |
| **命令行操作** | 需要记住命令和参数 | 点击式 GUI 操作 |
| **状态不可见** | 后台任务执行状态不透明 | 实时状态展示 |
| **上下文切换** | 在终端和编辑器间频繁切换 | 集成在 VS Code 侧边栏 |

## 核心概念速览

| 概念 | 说明 | 入口 |
| --- | --- | --- |
| **首页** | 项目概览、快速入口 | Dashboard 主页 |
| **CLAUDE.md Manager** | 项目指令管理 | Specs 页面 |
| **Skills Manager** | 技能市场和管理 | Skills 页面 |
| **Core Memory 视图** | 记忆浏览和搜索 | Memory 页面 |
| **CLI 终端** | 统一命令执行 | Terminal 面板 |
| **会话历史** | 历史会话浏览 | Session 侧边栏 |
| **Graph Explorer** | 项目依赖可视化 | Graph 面板 |

## 使用场景

| 场景 | 使用页面 |
| --- | --- |
| **管理项目规范** | CLAUDE.md Manager |
| **安装/管理技能** | Skills Manager (Skill Hub) |
| **查看项目记忆** | Core Memory 视图 |
| **执行 CLI 命令** | CLI 终端 |
| **浏览会话历史** | Session 侧边栏 |
| **查看项目结构** | Graph Explorer |

## 操作步骤

### 启动 Dashboard

```bash
# 启动 Dashboard（默认端口 3456）
ccw view

# 指定端口
ccw view --port 8080

# 指定主机
ccw view --host 0.0.0.0

# 不自动打开浏览器
ccw view --no-browser
```

### Dashboard 布局

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dashboard 主界面                             │
├───────────────────┬─────────────────────────────────────────────┤
│                   │                                             │
│  侧边栏导航        │            主内容区                          │
│  ┌─────────────┐  │  ┌─────────────────────────────────────┐   │
│  │ 首页        │  │  │                                      │   │
│  │ Specs      │  │  │         动态内容区域                   │   │
│  │ Skills     │  │  │     (根据导航变化)                    │   │
│  │ Memory     │  │  │                                      │   │
│  │ Terminal   │  │  │                                      │   │
│  │ Settings   │  │  │                                      │   │
│  └─────────────┘  │  └─────────────────────────────────────┘   │
│                   │                                             │
├───────────────────┴─────────────────────────────────────────────┤
│                     浮动面板 (可切换)                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐  │
│  │ Queue 面板      │ │ Inspector 面板  │ │ File 侧边栏      │  │
│  │ (任务队列)      │ │ (对象检查)      │ │                  │  │
│  └─────────────────┘ └─────────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### CLAUDE.md Manager (Specs 页面)

管理项目规范文档 (`.cw/specs/` 和 `~/.cw/personal/`)

**功能**:
- 浏览所有规范文件
- 按维度/类别/关键词筛选
- 编辑规范内容
- 创建新规范
- 重建索引缓存

**操作**:
```
1. 导航到 Specs 页面
2. 选择维度筛选器: all / specs / personal
3. (可选) 按类别筛选: general / exploration / planning / execution
4. (可选) 搜索框输入关键词
5. 点击规范卡片查看详情
6. 编辑内容并保存
7. 点击 "重建索引" 更新缓存
```

### Skills Manager (Skills 页面)

统一管理 Claude Skills 和 Codex Skills

**功能**:
- 浏览已安装技能
- 技能市场 (Skill Hub)
- 安装/卸载技能
- 启用/禁用技能
- 技能详情查看

**Skill Hub**:
- 远程技能库
- 本地技能发现
- 一键安装
- 版本管理

**操作**:
```
1. 导航到 Skills 页面
2. 切换 CLI 模式: Claude / Codex
3. 筛选: 类别 / 来源 / 状态
4. 点击 "Skill Hub" 浏览市场
5. 选择技能点击 "安装"
6. 使用开关启用/禁用技能
7. 点击技能卡片查看详情
```

### Core Memory 视图 (Memory 页面)

浏览和搜索项目记忆

**功能**:
- 记忆列表分页浏览
- 标签筛选
- 语义搜索
- 查看记忆详情
- 生成 AI 摘要
- 管理标签

**操作**:
```
1. 导航到 Memory 页面
2. (可选) 输入标签筛选
3. (可选) 输入搜索查询
4. 点击记忆卡片查看详情
5. 点击 "生成摘要" 调用 AI
6. 添加/删除标签
7. 查看提取任务状态
```

### CLI 终端 (Terminal 页面)

统一的 CLI 执行界面

**功能**:
- 工具选择下拉
- 模式选择 (analysis/write/review)
- 模型选择
- 工作目录配置
- Prompt 输入 (支持多行)
- 流式输出显示
- 规则模板快速加载
- 会话恢复管理

**操作**:
```
1. 导航到 Terminal 页面
2. 选择工具: gemini / qwen / codex / claude
3. 选择模式: analysis / write
4. (可选) 选择具体模型
5. (可选) 设置工作目录
6. 输入 Prompt (支持多行)
7. 点击 "执行" 或按 Ctrl+Enter
8. 查看流式输出
9. (可选) 使用规则模板
10. (可选) 恢复历史会话
```

### 浮动面板

#### Queue 面板
显示任务队列状态:
- 当前执行任务
- 等待中任务
- 已完成任务
- 失败任务

#### Inspector 面板
检查对象详情:
- 文件元数据
- 符号信息
- 依赖关系

#### File 侧边栏
项目文件浏览:
- 文件树
- 快速打开
- 文件搜索

### 会话侧边栏

浏览历史会话：

```
┌─────────────────────────────┐
│  Sessions  [清空历史]       │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 今天                   │  │
│  │  • 会话 1             │  │
│  │  • 会话 2             │  │
│  │                       │  │
│  │ 昨天                   │  │
│  │  • 会话 3             │  │
│  │  • 会话 4             │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Graph Explorer

可视化项目依赖：

```
┌─────────────────────────────────────────┐
│           Graph Explorer                │
├─────────────────────────────────────────┤
│                                         │
│     ┌─────┐      ┌─────┐              │
│     │ API │ ───> │ Auth│              │
│     └─────┘      └─────┘              │
│        │            │                  │
│        ▼            ▼                  │
│     ┌─────┐      ┌─────┐              │
│     │ DB  │ <────│User │              │
│     └─────┘      └─────┘              │
│                                         │
└─────────────────────────────────────────┘
```

**功能**:
- 模块依赖图
- 调用关系图
- 缩放/平移
- 节点搜索

## 配置说明

### Dashboard 配置 (settings.json)

```json
{
  "dashboard": {
    "port": 3456,
    "host": "127.0.0.1",
    "openBrowser": true,
    "immersiveMode": false
  },
  "panels": {
    "queue": {
      "enabled": true,
      "width": 400
    },
    "inspector": {
      "enabled": true,
      "width": 360
    }
  }
}
```

### 功能开关

```typescript
const featureFlags = {
  dashboardQueuePanelEnabled: boolean,    // Queue 面板
  dashboardInspectorEnabled: boolean,     // Inspector 面板
  dashboardGraphEnabled: boolean,         // Graph Explorer
};
```

## 常见问题

### Q1: Dashboard 无法启动？

A: 检查端口是否被占用：

```bash
# 检查端口占用
lsof -i :3456  # macOS/Linux
netstat -ano | findstr :3456  # Windows

# 使用其他端口
ccw view --port 8080
```

### Q2: Dashboard 内容不刷新？

A: Dashboard 使用缓存，手动刷新：
- 点击页面刷新按钮
- 或使用 `ccw view --restart`

### Q3: 如何在全屏模式下使用？

A: 使用沉浸式模式：
- 点击工具栏的全屏按钮
- 或按 `F11` 键

### Q4: Skills Hub 无法连接？

A: 检查网络连接和 Hub 地址：

```json
{
  "skillHub": {
    "url": "https://skill-hub.example.com",
    "timeout": 10000
  }
}
```

## 相关功能

- [Spec 规范系统](./spec.md) — CLAUDE.md Manager 管理的内容
- [Memory 记忆系统](./memory.md) — Core Memory 视图的数据
- [CLI 调用系统](./cli.md) — Terminal 面板的功能

## 进阶阅读

- Dashboard 主页: `ccw/frontend/src/pages/TerminalDashboardPage.tsx`
- Specs 页面: `ccw/frontend/src/pages/SpecsSettingsPage.tsx`
- Skills 页面: `ccw/frontend/src/pages/SkillsManagerPage.tsx`
- 路由配置: `ccw/src/core/routes/`
