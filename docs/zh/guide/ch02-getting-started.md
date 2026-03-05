# 快速开始

## 一句话定位

**快速开始是 5 分钟上手指南** — 安装配置、第一个命令、第一个工作流，快速体验 Claude Code Workflow 核心功能。

---

## 2.1 安装

### 2.1.1 前置要求

| 要求 | 版本 | 说明 |
| --- | --- | --- |
| **Node.js** | 18+ | CCW 模块需要 |
| **Python** | 3.10+ | CodexLens 模块需要 |
| **VS Code** | 最新版 | 扩展运行环境 |
| **Git** | 最新版 | 版本控制 |

### 2.1.2 克隆项目

```bash
# 克隆仓库
git clone https://github.com/your-repo/claude-dms3.git
cd claude-dms3

# 安装依赖
npm install
```

### 2.1.3 配置 API Keys

在 `~/.claude/settings.json` 中配置 API Keys：

```json
{
  "openai": {
    "apiKey": "sk-xxx"
  },
  "anthropic": {
    "apiKey": "sk-ant-xxx"
  },
  "google": {
    "apiKey": "AIza-xxx"
  }
}
```

::: tip 提示
API Keys 也可以在项目级别配置 `.claude/settings.json`，项目级配置优先级高于全局配置。
:::

---

## 2.2 初始化项目

### 2.2.1 启动工作流会话

在 VS Code 中打开项目，然后运行：

```
/workflow:session:start
```

这会创建一个新的工作流会话，所有后续操作都会在这个会话上下文中进行。

### 2.2.2 初始化项目规范

```
/workflow:init
```

这会创建 `project-tech.json` 文件，记录项目的技术栈信息。

### 2.2.3 填充项目规范

```
/workflow:init-guidelines
```

交互式填充项目规范，包括编码风格、架构决策等信息。

---

## 2.3 第一个命令

### 2.3.1 代码分析

使用 CCW CLI 工具分析代码：

```bash
ccw cli -p "分析这个文件的代码结构和设计模式" --tool gemini --mode analysis
```

**参数说明**:
- `-p`: Prompt（任务描述）
- `--tool gemini`: 使用 Gemini 模型
- `--mode analysis`: 分析模式（只读，不修改文件）

### 2.3.2 代码生成

使用 CCW CLI 工具生成代码：

```bash
ccw cli -p "创建一个 React 组件，实现用户登录表单" --tool qwen --mode write
```

**参数说明**:
- `--mode write`: 写入模式（可以创建/修改文件）

::: danger 注意
`--mode write` 会修改文件，请确保代码已提交或有备份。
:::

---

## 2.4 第一个工作流

### 2.4.1 启动规划工作流

```
/workflow-plan
```

这会启动 PlanEx 工作流，包含以下步骤：

1. **分析需求** - 理解用户意图
2. **探索代码** - 搜索相关代码和模式
3. **生成计划** - 创建结构化任务列表
4. **执行任务** - 按计划执行开发

### 2.4.2 头脑风暴

```
/brainstorm
```

多视角头脑风暴，获取不同观点：

| 视角 | 角色 | 聚焦 |
| --- | --- | --- |
| Product | 产品经理 | 市场契合度、用户价值 |
| Technical | 技术负责人 | 可行性、技术债 |
| Quality | QA 负责人 | 完整性、可测试性 |
| Risk | 风险分析师 | 风险识别、依赖关系 |

---

## 2.5 使用 Memory

### 2.5.1 查看项目记忆

```bash
ccw memory list
```

显示所有项目记忆，包括 learnings、decisions、conventions、issues。

### 2.5.2 搜索相关记忆

```bash
ccw memory search "认证"
```

基于语义搜索与"认证"相关的记忆。

### 2.5.3 添加记忆

```
/memory-capture
```

交互式捕获当前会话中的重要知识点。

---

## 2.6 代码搜索

### 2.6.1 语义搜索

在 VS Code 中使用 CodexLens 搜索：

```bash
# 通过 CodexLens MCP 端点搜索
ccw search "用户登录逻辑"
```

### 2.6.2 调用链追踪

搜索函数的定义和所有调用位置：

```bash
ccw search --trace "authenticateUser"
```

---

## 2.7 Dashboard 面板

### 2.7.1 打开 Dashboard

在 VS Code 中运行：

```
ccw-dashboard.open
```

或使用命令面板（Ctrl+Shift+P）搜索 "CCW Dashboard"。

### 2.7.2 面板功能

| 功能 | 说明 |
| --- | --- |
| **技术栈** | 显示项目使用的框架和库 |
| **规范文档** | 快速查看项目规范 |
| **Memory** | 浏览和搜索项目记忆 |
| **代码搜索** | 集成 CodexLens 语义搜索 |

---

## 2.8 常见问题

### 2.8.1 API Key 配置

**Q: 在哪里配置 API Keys？**

A: 可以在两个位置配置：
- 全局配置: `~/.claude/settings.json`
- 项目配置: `.claude/settings.json`

项目配置优先级高于全局配置。

### 2.8.2 模型选择

**Q: 如何选择合适的模型？**

A: 根据任务类型选择：
- 代码分析、架构设计 → Gemini
- 通用代码开发 → Qwen
- 代码审查 → Codex (GPT)
- 长文本理解 → Claude

### 2.8.3 工作流选择

**Q: 什么时候使用哪个工作流？**

A: 根据任务目标选择：
- 新功能开发 → `/workflow-plan`
- 问题诊断 → `/debug-with-file`
- 代码审查 → `/review-code`
- 重构规划 → `/refactor-cycle`
- UI 开发 → `/workflow:ui-design`

---

## 2.9 快速参考

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/claude-dms3.git
cd claude-dms3

# 2. 安装依赖
npm install

# 3. 配置 API Keys
# 编辑 ~/.claude/settings.json

# 4. 启动工作流会话
/workflow:session:start

# 5. 初始化项目
/workflow:init
```

### 常用命令

| 命令 | 功能 |
| --- | --- |
| `/workflow:session:start` | 启动会话 |
| `/workflow-plan` | 规划工作流 |
| `/brainstorm` | 头脑风暴 |
| `/review-code` | 代码审查 |
| `ccw memory list` | 查看 Memory |
| `ccw cli -p "..."` | CLI 调用 |

---

## 下一步

- [核心概念](ch03-core-concepts.md) — 深入理解 Commands、Skills、Prompts
- [工作流基础](ch04-workflow-basics.md) — 学习使用各种工作流命令
- [高级技巧](ch05-advanced-tips.md) — CLI 工具链、多模型协作、记忆管理优化
