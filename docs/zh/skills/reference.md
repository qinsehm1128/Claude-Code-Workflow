---
适用CLI: claude
分类: specialized
---

# Skills 参考

**33 个 CCW 内置技能**快速参考指南。

## 核心技能

| 技能 | 触发器 | 用途 |
|------|--------|------|
| **brainstorm** | `brainstorm`、`头脑风暴` | 统一头脑风暴，双模式操作（自动流水线 / 单角色） |
| **review-code** | `review code`、`code review`、`审查代码` | 多维度代码审查（6 维度） |
| **review-cycle** | `workflow:review-cycle` | 代码审查 + 自动修复编排 |
| **memory-capture** | `memory capture`、`compact session` | 会话压缩或快速提示捕获 |
| **memory-manage** | `memory manage`、`update claude`、`update memory`、`generate docs`、`更新记忆`、`生成文档` | CLAUDE.md 更新和文档生成 |
| **spec-generator** | `generate spec`、`create specification`、`spec generator`、`workflow:spec` | 6 阶段规范生成器（简介 → PRD → 架构 → 史诗） |
| **skill-generator** | `create skill`、`new skill` | 创建新 Claude Code 技能的元技能 |
| **skill-tuning** | `skill tuning`、`tune skill` | 通用技能诊断和优化工具 |
| **issue-manage** | `manage issue`、`list issues` | 交互式问题管理（CRUD 操作） |
| **ccw-help** | `ccw-help`、`ccw-issue` | CCW 命令帮助系统 |
| **software-manual** | `software manual`、`user guide` | 生成交互式 TiddlyWiki 风格 HTML 手册 |

## 工作流技能

| 技能 | 触发器 | 用途 |
|------|--------|------|
| **workflow-plan** | `workflow-plan`、`workflow-plan-verify`、`workflow:replan` | 4 阶段规划工作流，带验证和交互式重新规划 |
| **workflow-lite-plan** | `workflow-lite-plan` | 轻量级规划和执行技能 |
| **workflow-multi-cli-plan** | `workflow-multi-cli-plan`、`workflow:multi-cli-plan` | 多 CLI 协作规划，带 ACE 上下文引擎 |
| **workflow-execute** | `workflow-execute` | 协调工作流任务的代理执行 |
| **workflow-tdd-plan** | `workflow-tdd-plan`、`workflow-tdd-verify` | TDD 工作流，带红-绿-重构任务链 |
| **workflow-test-fix** | `workflow-test-fix`、`test fix workflow` | 统一测试-修复流水线，带自适应策略 |
| **workflow-skill-designer** | `design workflow skill`、`create workflow skill`、`workflow skill designer` | 设计编排器+阶段结构化工作流技能的元技能 |

## 团队技能

| 技能 | 触发器 | 角色 | 用途 |
|------|--------|------|------|
| **team-lifecycle** | `team lifecycle` | 可变 | 完整 spec/impl/test 生命周期团队（v5，team-worker 架构） |
| **team-coordinate** | `team coordinate` | 可变 | 通用团队协调（legacy） |
| **team-coordinate** | - | 可变 | team-worker 架构协调 |
| **team-executor** | `team executor` | 可变 | 轻量级会话执行 |
| **team-executor** | - | 可变 | team-worker 架构执行 |
| **team-planex** | `team planex` | 3 | 规划-执行波浪流水线 |
| **team-iterdev** | `team iterdev` | 5 | 生成器-评论者循环迭代开发 |
| **team-issue** | `team issue` | 6 | 问题解决流水线 |
| **team-testing** | `team testing` | 5 | 渐进式测试覆盖团队 |
| **team-quality-assurance** | `team qa`、`team quality-assurance` | 6 | QA 闭环工作流 |
| **team-brainstorm** | `team brainstorm` | 5 | 多角色协作头脑风暴 |
| **team-uidesign** | `team ui design` | 4 | 带 Design Token 系统的 UI 设计团队 |
| **team-frontend** | `team frontend` | 6 | 带 UI/UX 集成的前端开发 |
| **team-review** | `team-review` | 4 | 代码扫描和自动修复 |
| **team-roadmap-dev** | `team roadmap-dev` | 4 | 路线图驱动开发 |
| **team-tech-debt** | `tech debt cleanup`、`team tech-debt`、`技术债务` | 6 | 技术债务识别和清理 |
| **team-ultra-analyze** | `team ultra-analyze`、`team analyze` | 5 | 深度协作分析 |

## 命令生成技能

| 技能 | 触发器 | 用途 |
|------|--------|------|
| **command-generator** | `generate command` | 命令文件生成元技能 |

## 技能类别摘要

| 类别 | 数量 | 说明 |
|------|------|------|
| 核心技能 | 12 | 用于特定任务的单用途技能 |
| 工作流技能 | 7 | 规划和执行流水线技能 |
| 团队技能 | 17+ | 多代理协作技能 |
| 命令生成技能 | 1 | 命令文件生成 |
| **总计** | **37+** | |

## 使用

### 基本调用

```javascript
Skill(skill="brainstorm")
Skill(skill="team-lifecycle", args="Build user authentication system")
Skill(skill="workflow-plan", args="--mode verify")
```

### CLI 调用

```bash
# 通过 /ccw 编排器
/ccw "brainstorm: user authentication flow"
/ccw "team planex: OAuth2 implementation"

# 直接触发器（某些上下文）
workflow-plan
team lifecycle
```

## 触发关键词

| 关键词 | 技能 |
|--------|------|
| `brainstorm`、`头脑风暴` | brainstorm |
| `review code`、`code review`、`审查代码` | review-code |
| `workflow:review-cycle` | review-cycle |
| `workflow-plan` | workflow-plan |
| `workflow-lite-plan` | workflow-lite-plan |
| `workflow-multi-cli-plan`、`workflow:multi-cli-plan` | workflow-multi-cli-plan |
| `workflow-execute` | workflow-execute |
| `workflow-tdd-plan` | workflow-tdd-plan |
| `workflow-test-fix`、`test fix workflow` | workflow-test-fix |
| `design workflow skill`、`create workflow skill`、`workflow skill designer` | workflow-skill-designer |
| `team lifecycle` | team-lifecycle (v5) |
| `team planex` | team-planex |
| `team iterdev` | team-iterdev |
| `team issue` | team-issue |
| `team testing` | team-testing |
| `team qa`、`team quality-assurance` | team-quality-assurance |
| `team brainstorm` | team-brainstorm |
| `team ui design`、`team uidesign` | team-uidesign |
| `team frontend` | team-frontend |
| `team-review` | team-review |
| `team roadmap-dev` | team-roadmap-dev |
| `tech debt cleanup`、`team tech-debt`、`技术债务` | team-tech-debt |
| `team ultra-analyze`、`team analyze` | team-ultra-analyze |
| `memory capture`、`compact session`、`记录`、`压缩会话` | memory-capture |
| `memory manage`、`update claude`、`update memory`、`generate docs`、`更新记忆`、`生成文档` | memory-manage |
| `generate spec`、`create specification`、`spec generator`、`workflow:spec` | spec-generator |
| `create skill`、`new skill` | skill-generator |
| `skill tuning`、`tune skill`、`skill diagnosis` | skill-tuning |
| `manage issue`、`list issues`、`edit issue` | issue-manage |
| `software manual`、`user guide`、`generate manual`、`create docs` | software-manual |
| `generate command` | command-generator |

## 团队技能架构

### 版本历史

| 版本 | 架构 | 状态 |
|------|------|------|
| v2 | Legacy | 已废弃 |
| v3 | 3 阶段生命周期 | Legacy |
| v4 | 5 阶段生命周期，带 inline discuss | 稳定 |
| **v5** | **team-worker 架构** | **最新** |

### v5 Team Worker 角色

最新的 team-lifecycle (v5) 使用 team-worker 代理，带动态角色分配：

| 角色 | 前缀 | 阶段 |
|------|------|------|
| doc-analyst | ANALYSIS | 需求分析 |
| doc-writer | DRAFT | 文档创建 |
| planner | PLAN | 实现规划 |
| executor | IMPL | 代码实现 |
| tester | TEST | 测试和 QA |
| reviewer | REVIEW | 代码审查 |

## 设计模式

| 模式 | 使用它的技能 |
|------|--------------|
| Orchestrator + Workers | team-lifecycle、team-testing、team-quality-assurance |
| Generator-Critic Loop | team-iterdev |
| Wave Pipeline | team-planex |
| Red-Green-Refactor | workflow-tdd-plan |
| Pure Orchestrator | workflow-plan、workflow-lite-plan |
| Progressive Phase Loading | workflow-plan、workflow-tdd-plan、team-lifecycle |

::: info 参见
- [核心技能详情](./core-skills.md) - 详细技能文档
- [自定义技能](./custom.md) - 创建你自己的技能
- [CLI 命令](../cli/commands.md) - 命令参考
- [团队工作流](../workflows/teams.md) - 团队工作流模式
:::
