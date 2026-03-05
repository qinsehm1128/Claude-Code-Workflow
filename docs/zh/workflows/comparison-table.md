# 工作流对比表

> **CCW 工作流完整参考** - 按调用方式、流水线、用例、复杂度和自动链式行为对比所有工作流。

## 快速参考

| 工作流 | 最佳用途 | 级别 | 自包含 |
|----------|----------|-------|----------------|
| workflow-lite-planex | 快速任务、Bug 修复 | 2 (轻量级) | 是 |
| workflow-plan → workflow-execute | 复杂功能 | 3-4 (标准) | 否 (需要 execute) |
| workflow-tdd-plan → workflow-execute | TDD 开发 | 3 (标准) | 否 (需要 execute) |
| workflow-test-fix | 测试生成/修复 | 3 (标准) | 是 |
| workflow-multi-cli-plan | 多视角规划 | 3 (标准) | 是 |
| brainstorm-with-file | 创意构思、探索 | 4 (完整) | 否 (链式到 plan) |
| analyze-with-file | 深度分析 | 3 (标准) | 否 (链式到 lite-plan) |
| debug-with-file | 假设驱动调试 | 3 (标准) | 是 |
| collaborative-plan-with-file | 多代理规划 | 3 (标准) | 否 (链式到 execute) |
| roadmap-with-file | 战略路线图 | 4 (战略) | 否 (链式到 team-planex) |
| integration-test-cycle | 集成测试 | 3 (标准) | 是 |
| refactor-cycle | 技术债务重构 | 3 (标准) | 是 |
| review-cycle | 代码审查 | 3 (标准) | 是 |
| spec-generator | 规格文档包 | 4 (完整) | 否 (链式到 plan) |
| team-planex | Issue 批量执行 | Team | 是 |
| team-lifecycle | 完整生命周期 | Team | 是 |
| issue pipeline | Issue 管理 | 2.5 (桥接) | 是 |

---

## 完整对比表

| 工作流 | 调用方式 | 流水线 | 用例 | 级别 | 自包含 | 自动链式到 |
|----------|------------|----------|----------|-------|----------------|----------------|
| **Plan+Execute 工作流** |
| workflow-lite-planex | `/ccw "任务"` (低/中复杂度自动选择) | explore → plan → confirm → execute | 快速功能、Bug 修复、简单任务 | 2 (轻量级) | 是 | workflow-test-fix |
| workflow-plan | `/ccw "复杂功能"` (高复杂度) | session → context → convention → gen → verify/replan | 复杂功能规划、正式验证 | 3-4 (标准) | 否 | workflow-execute |
| workflow-execute | `/workflow-execute` (plan 之后) | session discovery → task processing → commit | 执行预生成的计划 | 3 (标准) | 是 | review-cycle (可选) |
| workflow-multi-cli-plan | `/ccw "multi-cli plan: ..."` | ACE context → CLI discussion → plan → execute | 多视角规划 | 3 (标准) | 是 | (内部交接) |
| **TDD 工作流** |
| workflow-tdd-plan | `/ccw "Implement with TDD"` | 6阶段 TDD plan → verify | 测试驱动开发规划 | 3 (标准) | 否 | workflow-execute |
| workflow-test-fix | `/ccw "generate tests"` 或自动链式 | session → context → analysis → gen → cycle | 测试生成、覆盖率提升 | 3 (标准) | 是 | (独立) |
| **头脑风暴工作流** |
| brainstorm | `/brainstorm "主题"` | mode detect → framework → parallel analysis → synthesis | 多视角创意构思 | 4 (完整) | 是 (仅构思) | workflow-plan |
| brainstorm-with-file | `/ccw "brainstorm: ..."` | brainstorm + documented artifacts | 带会话文档的创意构思 | 4 (完整) | 否 | workflow-plan → execute |
| collaborative-plan-with-file | `/ccw "collaborative plan: ..."` | understanding → parallel agents → plan-note.md | 多代理协作规划 | 3 (标准) | 否 | unified-execute-with-file |
| **分析工作流** |
| analyze-with-file | `/ccw "analyze: ..."` | multi-CLI analysis → discussion.md | 深度理解、架构探索 | 3 (标准) | 否 | workflow-lite-planex |
| debug-with-file | `/ccw "debug: ..."` | hypothesis-driven iteration → debug.log | 系统化调试 | 3 (标准) | 是 | (独立) |
| **审查工作流** |
| review-cycle | `/ccw "review code"` | discovery → analysis → aggregation → deep-dive → completion | 代码审查、质量门禁 | 3 (标准) | 是 | fix mode (如有发现) |
| **规格工作流** |
| spec-generator | `/ccw "specification: ..."` | study → discovery → brief → PRD → architecture → epics | 完整规格文档包 | 4 (完整) | 是 (仅文档) | workflow-plan / team-planex |
| **团队工作流** |
| team-planex | `/ccw "team planex: ..."` | coordinator → planner wave → executor wave | 基于 Issue 的并行执行 | Team | 是 | (完整流水线) |
| team-lifecycle | `/ccw "team lifecycle: ..."` | spec pipeline → impl pipeline | 从规格到验证的完整生命周期 | Team | 是 | (完整生命周期) |
| team-arch-opt | (架构优化) | architecture analysis → optimization | 架构优化 | Team | 是 | (完整) |
| **循环工作流** |
| integration-test-cycle | `/ccw "integration test: ..."` | explore → test dev → test-fix cycle → reflection | 带迭代的集成测试 | 3 (标准) | 是 | (自迭代) |
| refactor-cycle | `/ccw "refactor: ..."` | discover → prioritize → execute → validate | 技术债务发现与重构 | 3 (标准) | 是 | (自迭代) |
| **Issue 工作流** |
| issue pipeline | `/ccw "use issue workflow"` | discover → plan → queue → execute | 结构化 Issue 管理 | 2.5 (桥接) | 是 | (完整流水线) |
| **路线图工作流** |
| roadmap-with-file | `/ccw "roadmap: ..."` | strategic roadmap → issue creation → execution-plan | 战略需求拆解 | 4 (战略) | 否 | team-planex |

---

## 工作流级别分类

| 级别 | 工作流 | 特点 |
|-------|-----------|-----------------|
| **2 (轻量级)** | workflow-lite-planex, docs | 快速执行、最少阶段 |
| **2.5 (桥接)** | issue pipeline, rapid-to-issue | 桥接到 Issue 工作流 |
| **3 (标准)** | workflow-plan, workflow-execute, workflow-tdd-plan, workflow-test-fix, review-cycle, debug-with-file, analyze-with-file, workflow-multi-cli-plan | 完整规划/执行、多阶段 |
| **4 (完整)** | brainstorm, spec-generator, brainstorm-with-file, roadmap-with-file | 完整探索、规格化 |
| **Team** | team-planex, team-lifecycle, team-arch-opt | 多代理并行执行 |
| **Cycle** | integration-test-cycle, refactor-cycle | 带反思的自迭代 |

---

## 自动链式参考

| 源工作流 | 自动链式到 | 条件 |
|-----------------|---------------|-----------|
| workflow-lite-planex | workflow-test-fix | 默认 (除非 skip-tests) |
| workflow-plan | workflow-execute | 计划确认后 |
| workflow-execute | review-cycle | 用户通过 Phase 6 选择 |
| workflow-tdd-plan | workflow-execute | TDD 计划验证后 |
| brainstorm | workflow-plan | 自动链式到正式规划 |
| brainstorm-with-file | workflow-plan → workflow-execute | 自动 |
| analyze-with-file | workflow-lite-planex | 自动 |
| debug-with-file | (无) | 独立 |
| collaborative-plan-with-file | unified-execute-with-file | 自动 |
| roadmap-with-file | team-planex | 自动 |
| spec-generator | workflow-plan / team-planex | 用户选择 |
| review-cycle | fix mode | 如有发现 |

---

## 自包含 vs 多技能

| 工作流 | 自包含 | 说明 |
|----------|---------------|-------|
| workflow-lite-planex | 是 | 完整 plan + execute |
| workflow-plan | 否 | 需要 workflow-execute |
| workflow-execute | 是 | 完整执行 |
| workflow-tdd-plan | 否 | 需要 workflow-execute |
| workflow-test-fix | 是 | 完整生成 + 执行 |
| brainstorm | 是 (构思) | 否 (实现) |
| review-cycle | 是 | 完整审查 + 可选修复 |
| spec-generator | 是 (文档) | 否 (实现) |
| team-planex | 是 | 完整团队流水线 |
| team-lifecycle | 是 | 完整生命周期 |
| debug-with-file | 是 | 完整调试 |
| integration-test-cycle | 是 | 自迭代 |
| refactor-cycle | 是 | 自迭代 |

---

## 关键词检测参考

| 关键词模式 | 检测到的工作流 |
|-----------------|-------------------|
| `urgent`, `critical`, `hotfix`, `紧急`, `严重` | bugfix-hotfix |
| `from scratch`, `greenfield`, `new project`, `从零开始`, `全新` | greenfield |
| `brainstorm`, `ideation`, `multi-perspective`, `头脑风暴`, `创意` | brainstorm |
| `debug`, `hypothesis`, `systematic`, `调试`, `假设` | debug-with-file |
| `analyze`, `understand`, `collaborative analysis`, `分析`, `理解` | analyze-with-file |
| `roadmap`, `路线图`, `规划` | roadmap-with-file |
| `specification`, `PRD`, `产品需求`, `规格` | spec-generator |
| `integration test`, `集成测试`, `端到端` | integration-test-cycle |
| `refactor`, `技术债务`, `重构` | refactor-cycle |
| `team planex`, `wave pipeline`, `团队执行` | team-planex |
| `multi-cli`, `多模型协作`, `多CLI` | workflow-multi-cli-plan |
| `TDD`, `test-driven`, `测试驱动` | workflow-tdd-plan |
| `review`, `code review`, `代码审查` | review-cycle |
| `issue workflow`, `use issue workflow`, `Issue工作流` | issue pipeline |

---

## 工作流选择指南

| 任务类型 | 推荐工作流 | 命令链 |
|-----------|---------------------|---------------|
| 快速功能 | `/ccw "..."` | lite-planex → test-fix |
| Bug 修复 | `/ccw "fix ..."` | lite-planex --bugfix → test-fix |
| 复杂功能 | `/ccw "..."` (自动检测) | plan → execute → review → test-fix |
| 探索分析 | `/workflow:analyze-with-file "..."` | analysis → (可选) lite-planex |
| 创意构思 | `/workflow:brainstorm-with-file "..."` | brainstorm → plan → execute |
| 调试 | `/workflow:debug-with-file "..."` | hypothesis-driven debugging |
| Issue 管理 | `/issue:new` → `/issue:plan` → `/issue:queue` → `/issue:execute` | issue workflow |
| 多 Issue 批量 | `/issue:discover` → `/issue:plan --all-pending` | issue batch workflow |
| 代码审查 | `/cli:codex-review --uncommitted` | codex review |
| 团队协调 | `team-lifecycle` 或 `team-planex` | team workflow |
| TDD 开发 | `/ccw "Implement with TDD"` | tdd-plan → execute |
| 集成测试 | `/ccw "integration test: ..."` | integration-test-cycle |
| 技术债务 | `/ccw "refactor: ..."` | refactor-cycle |
| 规格文档 | `/ccw "specification: ..."` | spec-generator → plan |

---

## 从零开始开发路径

| 规模 | 流水线 | 复杂度 |
|------|----------|------------|
| 小型 | brainstorm-with-file → workflow-plan → workflow-execute | 3 |
| 中型 | brainstorm-with-file → workflow-plan → workflow-execute → workflow-test-fix | 3 |
| 大型 | brainstorm-with-file → workflow-plan → workflow-execute → review-cycle → workflow-test-fix | 4 |

---

## 相关文档

- [4级系统](./4-level.md) - 详细工作流说明
- [最佳实践](./best-practices.md) - 工作流优化技巧
- [示例](/workflows/examples) - 工作流使用示例
- [团队](./teams.md) - 团队工作流协调
