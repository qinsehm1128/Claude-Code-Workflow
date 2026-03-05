# Skills 库

完整的 **33 个 CCW 内置技能**参考手册，涵盖 3 大类别，以及自定义技能开发指南。

## 什么是 Skills？

Skills 是 CCW 可执行的、可复用的、领域特定的能力。每个技能都针对特定的开发任务或工作流而设计，可以组合成强大的工作流链。

## 类别概览

| 类别 | 数量 | 说明 |
|------|------|------|
| [独立技能](./core-skills.md#standalone-skills) | 12 | 用于特定任务的单用途技能 |
| [团队技能](./core-skills.md#team-skills) | 14 | 多代理协作技能 |
| [工作流技能](./core-skills.md#workflow-skills) | 7 | 规划和执行流水线技能 |

## 快速参考

### 独立技能

| 技能 | 触发器 | 说明 |
|------|--------|------|
| [brainstorm](./core-skills.md#brainstorm) | `brainstorm`, `头脑风暴` | 双模式统一头脑风暴 |
| [ccw-help](./core-skills.md#ccw-help) | `ccw-help`, `ccw-issue` | 命令帮助系统 |
| [memory-capture](./core-skills.md#memory-capture) | `memory capture`, `compact session` | 会话压缩或快速提示 |
| [memory-manage](./core-skills.md#memory-manage) | `memory manage`, `update claude`, `更新记忆` | CLAUDE.md 更新和文档生成 |
| [issue-manage](./core-skills.md#issue-manage) | `manage issue`, `list issues` | 交互式问题管理 |
| [review-code](./core-skills.md#review-code) | `review code`, `code review` | 6 维度代码审查 |
| [review-cycle](./core-skills.md#review-cycle) | `workflow:review-cycle` | 带自动修复的审查 |
| [skill-generator](./core-skills.md#skill-generator) | `create skill`, `new skill` | 创建技能的元技能 |
| [skill-tuning](./core-skills.md#skill-tuning) | `skill tuning`, `tune skill` | 技能诊断和优化 |
| [spec-generator](./core-skills.md#spec-generator) | `generate spec`, `create specification`, `spec generator` | 6 阶段规范生成 |
| [software-manual](./core-skills.md#software-manual) | `software manual`, `user guide` | 交互式 HTML 文档 |
| [command-generator](./core-skills.md#command-generator) | `generate command` | 命令文件生成 |

### 团队技能

| 技能 | 触发器 | 角色 | 说明 |
|------|--------|------|------|
| [team-lifecycle-v4](./core-skills.md#team-lifecycle-v4) | `team lifecycle` | 8 | 完整规范/实现/测试生命周期 |
| [team-brainstorm](./core-skills.md#team-brainstorm) | `team brainstorm` | 5 | 多角度创意生成 |
| [team-frontend](./core-skills.md#team-frontend) | `team frontend` | 6 | 带 UI/UX 的前端开发 |
| [team-issue](./core-skills.md#team-issue) | `team issue` | 6 | 问题解决流水线 |
| [team-iterdev](./core-skills.md#team-iterdev) | `team iterdev` | 5 | 生成器-评论者循环 |
| [team-planex](./core-skills.md#team-planex) | `team planex` | 3 | 规划-执行流水线 |
| [team-quality-assurance](./core-skills.md#team-quality-assurance) | `team qa`, `team quality-assurance` | 6 | QA 测试工作流 |
| [team-review](./core-skills.md#team-review) | `team-review` | 4 | 代码扫描和修复 |
| [team-roadmap-dev](./core-skills.md#team-roadmap-dev) | `team roadmap-dev` | 4 | 路线图驱动开发 |
| [team-tech-debt](./core-skills.md#team-tech-debt) | `tech debt cleanup`, `技术债务` | 6 | 技术债务识别 |
| [team-testing](./core-skills.md#team-testing) | `team testing` | 5 | 渐进式测试覆盖 |
| [team-uidesign](./core-skills.md#team-uidesign) | `team uidesign` | 4 | 带 Design Token 的 UI 设计 |
| [team-ultra-analyze](./core-skills.md#team-ultra-analyze) | `team ultra-analyze`, `team analyze` | 5 | 深度协作分析 |

### 工作流技能

| 技能 | 触发器 | 说明 |
|------|--------|------|
| [workflow-plan](./core-skills.md#workflow-plan) | `workflow-plan`, `workflow-plan-verify`, `workflow:replan` | 4 阶段规划带验证 |
| [workflow-lite-planex](./core-skills.md#workflow-lite-planex) | `workflow-lite-planex` | 轻量级规划 |
| [workflow-multi-cli-plan](./core-skills.md#workflow-multi-cli-plan) | `workflow-multi-cli-plan`, `workflow:multi-cli-plan` | 多 CLI 协作规划 |
| [workflow-execute](./core-skills.md#workflow-execute) | `workflow-execute` | 任务执行协调 |
| [workflow-tdd-plan](./core-skills.md#workflow-tdd-plan) | `workflow-tdd-plan` | TDD 红-绿-重构 |
| [workflow-test-fix](./core-skills.md#workflow-test-fix) | `workflow-test-fix`, `test fix workflow` | 测试-修复流水线 |
| [workflow-skill-designer](./core-skills.md#workflow-skill-designer) | `design workflow skill`, `create workflow skill` | 工作流创建元技能 |

## 工作流组合

技能可以组合实现强大的工作流。参见 [工作流组合](./core-skills.md#workflow-combinations) 了解 15 种预定义组合。

### 常用组合

#### 完整生命周期开发
```bash
Skill(skill="brainstorm")
Skill(skill="workflow-plan")
Skill(skill="workflow-execute")
Skill(skill="review-cycle")
```

#### 快速迭代
```bash
Skill(skill="workflow-lite-planex")
Skill(skill="workflow-execute")
```

#### 测试驱动开发
```bash
Skill(skill="workflow-tdd-plan", args="--mode tdd-plan")
Skill(skill="workflow-execute")
Skill(skill="workflow-tdd-plan", args="--mode tdd-verify")
```

## 使用技能

### 推荐方式：CCW 编排器

使用 `/ccw` 命令配合自然语言描述 - CCW 自动分析意图并选择合适的 skill：

```bash
# CCW 自动路由到 brainstorm skill
/ccw "头脑风暴: 用户通知系统设计"

# CCW 自动路由到 team lifecycle 工作流
/ccw "从零开始: 用户认证系统"

# CCW 自动路由到代码审查
/ccw "review: 代码质量检查"
```

### 直接调用 Skill

使用 `Skill()` 工具直接调用：

```javascript
// 基本使用
Skill(skill="brainstorm")

// 带参数
Skill(skill="team-lifecycle-v4", args="Build user authentication")

// 带模式选择
Skill(skill="workflow-plan", args="--mode verify")
```

### CCW Team CLI（仅消息总线）

`ccw team` **仅用于**团队消息总线操作，不能用于调用 team skill：

```bash
# 消息总线操作
ccw team log --session-id TLS-xxx --from executor --type state_update
ccw team list --session-id TLS-xxx --last 5
ccw team status --session-id TLS-xxx
```

## 自定义技能

为团队特定工作流创建自己的技能：

### 技能结构

```
~/.claude/skills/my-skill/
├── SKILL.md          # 技能定义
├── phases/           # 阶段文件（可选）
│   ├── phase-1.md
│   └── phase-2.md
└── templates/        # 输出模板（可选）
    └── output.md
```

### 技能模板

```markdown
---
name: my-custom-skill
description: My custom skill for X
version: 1.0.0
triggers: [trigger1, trigger2]
---

# My Custom Skill

## Description
Detailed description of what this skill does.

## Phases
1. Phase 1: Description
2. Phase 2: Description

## Usage

\`\`\`javascript
Skill(skill="my-custom-skill", args="input")
\`\`\`
```

### 最佳实践

1. **单一职责**：每个技能应做好一件事
2. **清晰触发器**：定义可识别的触发短语
3. **渐进式阶段**：将复杂技能分解为阶段
4. **紧凑恢复**：使用 TodoWrite 进行进度跟踪
5. **文档**：包含使用示例和预期输出

## 实践示例

### 示例 1：功能开发

**场景**：实现新的用户仪表板功能

```bash
# 步骤 1：头脑风暴功能（通过 CCW 编排器）
/ccw "头脑风暴: 用户仪表板功能设计"
# 或直接调用 Skill:
# Skill(skill="brainstorm")

# 步骤 2：规划实现（通过 CCW 编排器）
/ccw "Plan: Build user dashboard with configurable widgets"
# 或直接调用 Skill:
# Skill(skill="workflow-plan", args="Build user dashboard")

# 步骤 3：团队执行
Skill(skill="team-lifecycle-v4", args="Build user dashboard")
# 或使用快速迭代:
# Skill(skill="workflow-lite-planex")

# 步骤 4：审查和优化
Skill(skill="review-code")
# 修复发现的问题
```

### 示例 2：Bug 调查

**场景**：调试 API 端点性能问题

```bash
# 步骤 1：快速分析
ccw cli -p "Analyze /api/users endpoint for N+1 query issues" --tool gemini --mode analysis

# 步骤 2：深度调查（如需要）
Skill(skill="workflow:debug-with-file")
# 创建假设、植入代码、分析日志

# 步骤 3：应用修复
Skill(skill="workflow-execute", args="--task \"Fix N+1 query in user endpoint\"")
```

### 示例 3：代码迁移

**场景**：从 JavaScript 迁移到 TypeScript

```bash
# 步骤 1：分析代码库（通过 CCW 编排器）
/ccw "refactor: JavaScript to TypeScript 迁移"
# 或直接调用 Skill:
# Skill(skill="workflow:refactor-cycle")

# 步骤 2：分阶段执行迁移
Skill(skill="team-roadmap-dev", args="--epic ts-migration")
# 渐进式迁移模块并测试
```

### 示例 4：文档生成

**场景**：生成 API 文档

```bash
# 步骤 1：捕获现有模式
Skill(skill="memory-capture", args="\"API patterns: REST, versioning, error handling\"")

# 步骤 2：生成文档
Skill(skill="software-manual", args="--output ./docs/api/")
```

### 示例 5：代码审查流水线

**场景**：审查 PR 变更

```bash
# 全面审查
Skill(skill="review-code", args="--focus security,performance")

# 或使用循环自动修复
Skill(skill="review-cycle", args="--max-iterations 3")
```

### 最佳效果提示

1. **从小开始**：简单任务使用 `workflow-lite-planex`
2. **使用记忆**：用 `memory:capture` 捕获见解供将来参考
3. **验证计划**：执行前始终审查生成的计划
4. **迭代**：使用 `review-cycle` 持续改进
5. **检查会话**：使用 `workflow:session:list` 跟踪进度

## 设计模式

技能使用这些经证明的模式：

| 模式 | 示例 |
|------|------|
| 编排器 + 工作者 | team-lifecycle-v4 |
| 生成器-评论者循环 | team-iterdev |
| 波浪流水线 | team-planex |
| 红-绿-重构 | workflow-tdd-plan |

::: info 参见
- [核心技能参考](./core-skills.md) - 详细技能文档
- [自定义技能](./custom.md) - 技能开发指南
- [CLI 命令](../cli/commands.md) - 命令参考
- [代理](../agents/builtin.md) - 专业代理
:::
