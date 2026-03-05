# 内置智能体

CCW 包含 **21 个专业化智能体**，分为 5 个类别，每个智能体都针对特定的开发任务而设计。智能体可以独立工作，也可以编排组合以处理复杂的工作流。

## 类别概览

| 类别 | 数量 | 主要用途 |
|------|------|----------|
| [CLI 智能体](#cli-智能体) | 6 | 基于 CLI 的交互、探索和规划 |
| [开发智能体](#开发智能体) | 5 | 代码实现和调试 |
| [规划智能体](#规划智能体) | 4 | 战略规划和问题管理 |
| [测试智能体](#测试智能体) | 3 | 测试生成、执行和质量保证 |
| [文档智能体](#文档智能体) | 3 | 文档和设计系统 |

---

## CLI 智能体

### cli-explore-agent

**用途**: 专业化 CLI 探索，支持 3 种分析模式

**能力**:
- 快速扫描（仅 Bash）
- 深度扫描（Bash + Gemini）
- 依赖映射（图构建）
- 4 阶段工作流：任务理解 → 分析执行 → 模式验证 → 输出生成

**工具**: `Bash`, `Read`, `Grep`, `Glob`, `ccw cli (gemini/qwen/codex)`, `ACE search_context`

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: "Analyze authentication module dependencies"
})
```

### cli-discuss-agent

**用途**: 多 CLI 协作讨论，支持交叉验证

**能力**:
- 5 阶段工作流：上下文准备 → CLI 执行 → 交叉验证 → 综合 → 输出
- 加载讨论历史
- 跨会话维护上下文

**工具**: `Read`, `Grep`, `Glob`, `ccw cli`

**调用**: `cli-explore-agent` 用于讨论前的代码库发现

```javascript
Task({
  subagent_type: "cli-discuss-agent",
  prompt: "Discuss architecture patterns for microservices"
})
```

### cli-execution-agent

**用途**: 智能 CLI 执行，支持自动上下文发现

**能力**:
- 5 阶段工作流：任务理解 → 上下文发现 → 提示增强 → 工具执行 → 输出路由
- 后台执行支持
- 结果轮询

**工具**: `Bash`, `Read`, `Grep`, `Glob`, `ccw cli`, `TaskOutput`

**调用**: `cli-explore-agent` 用于执行前的发现

```javascript
Task({
  subagent_type: "cli-execution-agent",
  prompt: "Execute security scan on authentication module"
})
```

### cli-lite-planning-agent

**用途**: 轻量级规划，用于快速任务分解

**能力**:
- 创建简化的任务 JSON，无需复杂的模式验证
- 适用于简单的实现任务

**工具**: `Read`, `Write`, `Bash`, `Grep`

```javascript
Task({
  subagent_type: "cli-lite-planning-agent",
  prompt: "Plan user registration feature"
})
```

### cli-planning-agent

**用途**: 全功能规划，用于复杂实现

**能力**:
- 6 字段模式，支持上下文加载
- 流程控制和工件集成
- 全面的任务 JSON 生成

**工具**: `Read`, `Write`, `Bash`, `Grep`, `Glob`, `mcp__ace-tool__search_context`

```javascript
Task({
  subagent_type: "cli-planning-agent",
  prompt: "Plan microservices architecture migration"
})
```

### cli-roadmap-plan-agent

**用途**: 战略规划，用于路线图和里程碑生成

**能力**:
- 创建长期项目计划
- 生成史诗、里程碑和交付时间线
- 通过 ccw 创建问题

**工具**: `Read`, `Write`, `Bash`, `Grep`

```javascript
Task({
  subagent_type: "cli-roadmap-plan-agent",
  prompt: "Create Q1 roadmap for payment system"
})
```

---

## 开发智能体

### code-developer

**用途**: 核心代码执行，适用于任何实现任务

**能力**:
- 适应任何领域，同时保持质量标准
- 支持分析、实现、文档、研究
- 复杂的多步骤工作流

**工具**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`, `Task`, `mcp__ccw-tools__edit_file`, `mcp__ccw-tools__write_file`

```javascript
Task({
  subagent_type: "code-developer",
  prompt: "Implement user authentication with JWT"
})
```

### tdd-developer

**用途**: TDD 感知的代码执行，支持 Red-Green-Refactor 工作流

**能力**:
- 扩展 code-developer，增加 TDD 周期感知
- 自动测试-修复迭代
- CLI 会话恢复

**工具**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`, `ccw cli`

**扩展**: `code-developer`

```javascript
Task({
  subagent_type: "tdd-developer",
  prompt: "Implement payment processing with TDD"
})
```

### context-search-agent

**用途**: 专业化上下文收集器，用于头脑风暴工作流

**能力**:
- 分析现有代码库
- 识别模式
- 生成标准化上下文包

**工具**: `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`, `Read`, `Grep`, `Glob`, `Bash`

```javascript
Task({
  subagent_type: "context-search-agent",
  prompt: "Gather context for API refactoring"
})
```

### debug-explore-agent

**用途**: 调试专家，用于代码分析和问题诊断

**能力**:
- 基于假设的调试，支持 NDJSON 日志记录
- CLI 辅助分析
- 迭代验证
- 跟踪执行流程，识别故障点，分析故障时的状态

**工具**: `Read`, `Grep`, `Bash`, `ccw cli`

**工作流**: 问题分析 → 假设生成 → 插桩 → 日志分析 → 修复验证

```javascript
Task({
  subagent_type: "debug-explore-agent",
  prompt: "Debug memory leak in connection handler"
})
```

### universal-executor

**用途**: 通用执行器，高效实现任何任务

**能力**:
- 适应任何领域，同时保持质量标准
- 处理分析、实现、文档、研究
- 复杂的多步骤工作流

**工具**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`, `Task`, `mcp__ace-tool__search_context`, `mcp__exa__web_search_exa`

```javascript
Task({
  subagent_type: "universal-executor",
  prompt: "Implement GraphQL API with authentication"
})
```

---

## 规划智能体

### action-planning-agent

**用途**: 纯执行智能体，用于创建实现计划

**能力**:
- 将需求和头脑风暴工件转换为结构化计划
- 量化的可交付成果和可衡量的验收标准
- 执行模式的控制标志

**工具**: `Read`, `Write`, `Bash`, `Grep`, `Glob`, `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`

```javascript
Task({
  subagent_type: "action-planning-agent",
  prompt: "Create implementation plan for user dashboard"
})
```

### conceptual-planning-agent

**用途**: 高层规划，用于架构和概念设计

**能力**:
- 创建系统设计
- 架构模式
- 技术策略

**工具**: `Read`, `Write`, `Bash`, `Grep`, `ccw cli`

```javascript
Task({
  subagent_type: "conceptual-planning-agent",
  prompt: "Design event-driven architecture for order system"
})
```

### issue-plan-agent

**用途**: 问题解决规划，支持闭环探索

**能力**:
- 分析问题并生成解决方案计划
- 创建包含依赖和验收标准的任务 JSON
- 从探索到解决方案的 5 阶段任务

**工具**: `Read`, `Write`, `Bash`, `Grep`, `mcp__ace-tool__search_context`

```javascript
Task({
  subagent_type: "issue-plan-agent",
  prompt: "Plan resolution for issue #123"
})
```

### issue-queue-agent

**用途**: 解决方案排序智能体，用于队列形成

**能力**:
- 接收来自绑定问题的解决方案
- 使用 Gemini 进行智能冲突检测
- 生成有序的执行队列

**工具**: `Read`, `Write`, `Bash`, `ccw cli (gemini)`, `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`

**调用**: `issue-plan-agent`

```javascript
Task({
  subagent_type: "issue-queue-agent",
  prompt: "Form execution queue for issues #101, #102, #103"
})
```

---

## 测试智能体

### test-action-planning-agent

**用途**: 专业化智能体，用于测试规划文档

**能力**:
- 扩展 action-planning-agent 用于测试规划
- 渐进式 L0-L3 测试层（静态、单元、集成、端到端）
- AI 代码问题检测（L0.5），支持 CRITICAL/ERROR/WARNING 严重级别
- 项目特定模板
- 测试反模式检测和质量门禁

**工具**: `Read`, `Write`, `Bash`, `Grep`, `Glob`

**扩展**: `action-planning-agent`

```javascript
Task({
  subagent_type: "test-action-planning-agent",
  prompt: "Create test plan for payment module"
})
```

### test-context-search-agent

**用途**: 专业化上下文收集器，用于测试生成工作流

**能力**:
- 分析测试覆盖率
- 识别缺失的测试
- 从源会话加载实现上下文
- 生成标准化测试上下文包

**工具**: `mcp__ccw-tools__codex_lens`, `Read`, `Glob`, `Bash`, `Grep`

```javascript
Task({
  subagent_type: "test-context-search-agent",
  prompt: "Gather test context for authentication module"
})
```

### test-fix-agent

**用途**: 执行测试，诊断失败，并修复代码直到所有测试通过

**能力**:
- 多层测试执行（L0-L3）
- 分析失败并修改源代码
- 通过测试的质量门禁

**工具**: `Bash`, `Read`, `Edit`, `Write`, `Grep`, `ccw cli`

```javascript
Task({
  subagent_type: "test-fix-agent",
  prompt: "Run tests for user service and fix failures"
})
```

---

## 文档智能体

### doc-generator

**用途**: 文档生成，用于技术文档、API 参考和代码注释

**能力**:
- 从多个来源综合上下文
- 生成全面的文档
- 基于 flow_control 的任务执行

**工具**: `Read`, `Write`, `Bash`, `Grep`, `Glob`

```javascript
Task({
  subagent_type: "doc-generator",
  prompt: "Generate API documentation for REST endpoints"
})
```

### memory-bridge

**用途**: 文档更新协调器，用于复杂项目

**能力**:
- 编排并行的 CLAUDE.md 更新
- 使用 ccw tool exec update_module_claude
- 处理每个模块路径

**工具**: `Bash`, `ccw tool exec`, `TodoWrite`

```javascript
Task({
  subagent_type: "memory-bridge",
  prompt: "Update CLAUDE.md for all modules"
})
```

### ui-design-agent

**用途**: UI 设计令牌管理和原型生成

**能力**:
- 符合 W3C 设计令牌格式
- 基于状态的组件定义（默认、悬停、焦点、激活、禁用）
- 完整的组件库覆盖（12+ 交互组件）
- 动画-组件状态集成
- WCAG AA 合规性验证
- 令牌驱动的原型生成

**工具**: `Read`, `Write`, `Edit`, `Bash`, `mcp__exa__web_search_exa`, `mcp__exa__get_code_context_exa`

```javascript
Task({
  subagent_type: "ui-design-agent",
  prompt: "Generate design tokens for dashboard components"
})
```

---

## 编排模式

智能体可以通过以下编排模式组合使用：

### 继承链

智能体扩展另一个智能体的能力：

| 父智能体 | 子智能体 | 扩展内容 |
|----------|----------|----------|
| code-developer | tdd-developer | 添加 TDD Red-Green-Refactor 工作流、测试-修复周期 |
| action-planning-agent | test-action-planning-agent | 添加 L0-L3 测试层、AI 问题检测 |

### 顺序委托

智能体调用另一个智能体进行预处理：

| 调用者 | 被调用者 | 目的 |
|--------|----------|------|
| cli-discuss-agent | cli-explore-agent | 讨论前的代码库发现 |
| cli-execution-agent | cli-explore-agent | CLI 命令执行前的发现 |

### 队列形成

智能体收集多个智能体的输出并排序：

| 收集者 | 来源 | 目的 |
|--------|------|------|
| issue-queue-agent | issue-plan-agent | 收集解决方案、检测冲突、生成有序队列 |

### 上下文加载链

智能体生成执行智能体使用的上下文包：

| 上下文提供者 | 消费者 | 目的 |
|--------------|--------|------|
| context-search-agent | code-developer | 提供头脑风暴上下文包 |
| test-context-search-agent | test-fix-agent | 提供测试上下文包 |

### 质量门禁链

通过验证门禁的顺序执行：

```
code-developer (IMPL-001)
  → test-fix-agent (IMPL-001.3 validation)
  → test-fix-agent (IMPL-001.5 review)
  → test-fix-agent (IMPL-002 fix)
```

---

## 智能体选择指南

| 任务 | 推荐智能体 | 备选 |
|------|------------|------|
| 探索代码库 | cli-explore-agent | context-search-agent |
| 实现代码 | code-developer | tdd-developer |
| 调试问题 | debug-explore-agent | cli-execution-agent |
| 规划实现 | cli-planning-agent | action-planning-agent |
| 生成测试 | test-action-planning-agent | test-fix-agent |
| 审查代码 | test-fix-agent | doc-generator |
| 创建文档 | doc-generator | ui-design-agent |
| UI 设计 | ui-design-agent | - |
| 管理问题 | issue-plan-agent | issue-queue-agent |

---

## 工具依赖

### 核心工具

所有智能体都可以访问：`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`

### MCP 工具

专业化智能体使用：`mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`, `mcp__ccw-tools__edit_file`, `mcp__ccw-tools__write_file`, `mcp__ccw-tools__codex_lens`, `mcp__exa__web_search_exa`

### CLI 工具

支持 CLI 的智能体使用：`ccw cli`, `ccw tool exec`

### 工作流工具

协调智能体使用：`Task`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskOutput`, `TodoWrite`, `SendMessage`

::: info 另请参阅
- [智能体概述](./index.md) - 智能体系统介绍
- [自定义智能体](./custom.md) - 创建自定义智能体
- [团队技能](../skills/core-skills.md#team-skills) - 多智能体团队技能
:::
