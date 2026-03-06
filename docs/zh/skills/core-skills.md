---
适用CLI: claude
分类: specialized
---

# 核心技能

CCW 包含 **33 个内置技能**，组织为 3 大类别，提供 **15 种工作流组合** 用于常见开发场景。

## 类别概览

| 类别 | 数量 | 说明 |
|------|------|------|
| [独立技能](#standalone-skills) | 12 | 用于特定任务的单用途技能 |
| [团队技能](#team-skills) | 14 | 多代理协作技能 |
| [工作流技能](#workflow-skills) | 7 | 规划和执行流水线技能 |

---

## 独立技能

### brainstorm

**用途**：双模式统一头脑风暴

**触发器**：`brainstorm`, `头脑风暴`

**说明**：自动流水线和单角色分析用于想法生成。

**角色**：coordinator、product-manager、data-architect、security-engineer、performance-engineer、frontend-engineer、backend-engineer、devops-engineer、qa-engineer、technical-writer

**阶段**：
1. 阶段 1：初始化
2. 阶段 2：并行分析（自动模式）/ 单角色选择（单角色模式）
3. 阶段 3：整合

**模式**：`auto`、`single-role`

```bash
Skill(skill="brainstorm")
```

---

### ccw-help

**用途**：CCW 命令帮助系统

**触发器**：`ccw-help`、`ccw-issue`

**说明**：搜索、浏览和推荐命令。

**阶段**：
1. 命令发现
2. 意图理解
3. 命令推荐
4. 工作流编排

**模式**：`search`、`browse`、`recommend`

```bash
Skill(skill="ccw-help", args="search auth")
```

---

### memory-capture

**用途**：带路由的统一记忆捕获

**触发器**：`memory capture`、`compact session`、`save session`、`quick tip`、`memory tips`、`记录`、`压缩会话`

**说明**：会话压缩或快速提示捕获。

**阶段**：
1. 模式检测
2. 会话压缩（memory-capture 模式）/ 快速提示（quick-tips 模式）

**模式**：`memory-capture`、`quick-tips`

```bash
Skill(skill="memory-capture")
```

---

### memory-manage

**用途**：统一记忆管理

**触发器**：`memory manage`、`update claude`、`update memory`、`generate docs`、`更新记忆`、`生成文档`

**说明**：CLAUDE.md 更新和文档生成，带交互式路由。

**阶段**：
1. 模式选择
2. CLAUDE.md 更新 / 文档生成

**模式**：`claude-update`、`docs-generation`

```bash
Skill(skill="memory-manage")
```

---

### issue-manage

**用途**：交互式问题管理，带菜单驱动的 CRUD 操作

**触发器**：`manage issue`、`list issues`、`edit issue`、`delete issue`、`bulk update`、`issue dashboard`、`issue history`、`completed issues`

**阶段**：
1. 菜单选择
2. 操作执行

**模式**：`interactive-menu`

```bash
Skill(skill="issue-manage")
```

---

### review-code

**用途**：多维度代码审查，带结构化报告

**触发器**：`review code`、`code review`、`审查代码`、`代码审查`

**说明**：分析正确性、可读性、性能、安全性、测试和架构。

**阶段**：
1. 输入解析
2. 6 维度分析
3. 报告生成

**维度**：correctness、readability、performance、security、testing、architecture

```bash
Skill(skill="review-code")
```

---

### review-cycle

**用途**：统一多维度代码审查，带自动修复编排

**触发器**：`workflow:review-cycle`、`workflow:review-session-cycle`、`workflow:review-module-cycle`、`workflow:review-cycle-fix`

**说明**：路由到基于会话、基于模块或修复模式。

**阶段**：
1. 模式路由
2. 基于会话的审查 / 基于模块的审查 / 修复模式

**模式**：`session`、`module`、`fix`

```bash
Skill(skill="review-cycle")
```

---

### skill-generator

**用途**：创建新 Claude Code 技能的元技能

**触发器**：`create skill`、`new skill`、`skill generator`

**说明**：可配置的执行模式用于技能脚手架。

**阶段**：
1. 需求收集
2. 技能生成
3. 验证

**模式**：`sequential`、`autonomous`

```bash
Skill(skill="skill-generator")
```

---

### skill-tuning

**用途**：通用技能诊断和优化工具

**触发器**：`skill tuning`、`tune skill`、`skill diagnosis`、`optimize skill`、`skill debug`

**说明**：检测并修复技能执行问题。

**问题**：context-explosion、long-tail-forgetting、data-flow-disruption、agent-coordination-failure

**阶段**：
1. 技能加载
2. 诊断
3. 优化
4. 验证

```bash
Skill(skill="skill-tuning")
```

---

### spec-generator

**用途**：6 阶段文档链规范生成器

**触发器**：`generate spec`、`create specification`、`spec generator`、`workflow:spec`

**说明**：生成产品简介、PRD、架构和史诗。

**角色**：product-manager、business-analyst、architect、tech-lead、project-manager、qa-lead

**阶段**：
1. 阶段 1：产品简介
2. 阶段 2：PRD
3. 阶段 3：架构设计
4. 阶段 4：技术栈
5. 阶段 5：史诗
6. 阶段 6：质量关卡

**输出**：PRODUCT_BRIEF.md、PRD.md、ARCHITECTURE.md、TECH_STACK.md、EPICS.md、QUALITY_GATE.md

```bash
Skill(skill="spec-generator")
```

---

### software-manual

**用途**：生成交互式 TiddlyWiki 风格 HTML 软件手册

**触发器**：`software manual`、`user guide`、`generate manual`、`create docs`

**说明**：截图、API 文档和多级代码示例。

**角色**：Product Manager、UX Expert、API Architect、DevOps Engineer、Support Engineer、Developer Advocate

**阶段**：
1. 需求发现
2. 项目探索
3. API 提取
4. 并行分析（6 个代理）
5. 整合
6. 截图捕获
7. HTML 组装
8. 迭代优化

**功能**：搜索、折叠展开、标签导航、主题切换、单文件、离线、打印友好

```bash
Skill(skill="software-manual")
```

---

### command-generator

**用途**：命令文件生成元技能

**触发器**：`generate command`

**说明**：生成带标准化结构的 CCW 命令文件。

**阶段**：
1. 需求收集
2. 命令文件生成
3. 验证

**输出**：命令定义文件

```bash
Skill(skill="command-generator")
```

---

## 团队技能

### team-lifecycle-v4 [已废弃]

**用途**：全生命周期统一团队技能 - spec/impl/test

**触发器**：`team lifecycle`

**说明**：**[已废弃]** 请使用 `team-lifecycle` (v5)。v4 保留用于向后兼容。

**状态**：Legacy - 已被 team-lifecycle (v5) 取代

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| spec-lead | SPEC | lead |
| architect | ARCH | worker |
| impl-lead | IMPL | lead |
| frontend-dev | FE | worker |
| backend-dev | BE | worker |
| test-lead | TEST | lead |
| qa-analyst | QA | worker |

**阶段**：
1. 阶段 1：规范规划（coordinator + spec-lead）
2. 阶段 2：架构设计（architect）
3. 阶段 3：实现规划（impl-lead + 开发团队）
4. 阶段 4：测试规划（test-lead + qa-analyst）
5. 阶段 5：执行和验证

**集成**：inline-discuss、shared-explore、ui-ux-pro-max

```bash
Skill(skill="team-lifecycle-v4", args="Build user authentication system")
```

---

### team-brainstorm

**用途**：头脑风暴团队统一团队技能

**触发器**：`team brainstorm`

**说明**：多角度创意生成，带协作角色。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| ideator | IDEA | worker |
| challenger | CHAL | worker |
| synthesizer | SYNC | worker |
| evaluator | EVAL | worker |

**阶段**：
1. 设置
2. 创意生成
3. 挑战
4. 整合
5. 评估

**输出**：`brainstorm-results.md`

```bash
Skill(skill="team-brainstorm")
```

---

### team-frontend

**用途**：前端开发团队统一团队技能

**触发器**：`team frontend`

**说明**：内置 ui-ux-pro-max 设计智能。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| frontend-lead | FE-LEAD | lead |
| ui-developer | UI-DEV | worker |
| ux-engineer | UX | worker |
| component-dev | COMP | worker |
| qa-specialist | QA | worker |

**阶段**：规划、设计集成、组件开发、集成、测试

**集成**：ui-ux-pro-max

```bash
Skill(skill="team-frontend")
```

---

### team-issue

**用途**：问题解决统一团队技能

**触发器**：`team issue`

**说明**：从探索到集成的 5 阶段流水线。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| explorer | EXP | worker |
| planner | PLAN | worker |
| implementer | IMPL | worker |
| reviewer | REV | worker |
| integrator | INT | worker |

**阶段**：
1. 探索
2. 规划
3. 实现
4. 审查
5. 集成

```bash
Skill(skill="team-issue")
```

---

### team-iterdev

**用途**：迭代开发团队统一团队技能

**触发器**：`team iterdev`

**说明**：生成器-评论者循环模式。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| generator | GEN | worker |
| critic | CRIT | worker |
| integrator | INT | worker |
| validator | VAL | worker |

**阶段**：生成、评论、优化、集成、验证

**模式**：generator-critic-loop

```bash
Skill(skill="team-iterdev")
```

---

### team-planex

**用途**：规划-执行流水线统一团队技能

**触发器**：`team planex`

**说明**：2 人团队，带波浪流水线用于并发规划和执行。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| planner | PLAN | lead |
| executor | EXEC | lead |

**阶段**：
- 波浪 1：初始计划
- 波浪 2：执行 + 下一波浪规划
- 波浪 N：渐进式执行

**模式**：wave-pipeline

```bash
Skill(skill="team-planex")
```

---

### team-quality-assurance

**用途**：质量保证团队统一团队技能

**触发器**：`team quality-assurance`、`team qa`

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| scout | SCOUT | worker |
| strategist | STRAT | worker |
| generator | GEN | worker |
| executor | EXEC | worker |
| analyst | ANA | worker |

**阶段**：侦察、策略、生成、执行、分析

```bash
Skill(skill="team-quality-assurance")
```

---

### team-review

**用途**：代码扫描和审查统一团队技能

**触发器**：`team-review`

**说明**：漏洞审查、优化建议和自动修复。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| scanner | SCAN | worker |
| reviewer | REV | worker |
| fixer | FIX | worker |

**阶段**：扫描、审查、修复规划、修复执行

```bash
Skill(skill="team-review")
```

---

### team-roadmap-dev

**用途**：路线图驱动开发工作流统一团队技能

**触发器**：`team roadmap-dev`

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| planner | PLAN | lead |
| executor | EXEC | lead |
| verifier | VER | worker |

**阶段**：路线图讨论、分阶段执行（规划 → 执行 → 验证）

```bash
Skill(skill="team-roadmap-dev")
```

---

### team-tech-debt

**用途**：技术债务识别和清理统一团队技能

**触发器**：`team tech-debt`、`tech debt cleanup`、`技术债务`

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| scanner | SCAN | worker |
| assessor | ASSESS | worker |
| planner | PLAN | worker |
| executor | EXEC | worker |
| validator | VAL | worker |

**阶段**：扫描、评估、规划、执行、验证

```bash
Skill(skill="team-tech-debt")
```

---

### team-testing

**用途**：测试团队统一团队技能

**触发器**：`team testing`

**说明**：渐进式测试覆盖。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| strategist | STRAT | worker |
| generator | GEN | worker |
| executor | EXEC | worker |
| analyst | ANA | worker |

**阶段**：策略、生成、执行、分析

```bash
Skill(skill="team-testing")
```

---

### team-uidesign

**用途**：UI 设计团队统一团队技能

**触发器**：`team uidesign`

**说明**：Design Token 系统和 CP-9 双轨。

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| designer | DES | worker |
| developer | DEV | worker |
| reviewer | REV | worker |

**阶段**：设计、实现、审查

**集成**：ui-ux-pro-max、design-token-system

**模式**：CP-9-dual-track

```bash
Skill(skill="team-uidesign")
```

---

### team-ultra-analyze

**用途**：深度协作分析统一团队技能

**触发器**：`team ultra-analyze`、`team analyze`

**角色**：

| 角色 | 前缀 | 类型 |
|------|------|------|
| coordinator | COORD | orchestrator |
| explorer | EXP | worker |
| analyst | ANA | worker |
| discussant | DIS | worker |
| synthesizer | SYNC | worker |

**阶段**：探索、分析、讨论、整合

```bash
Skill(skill="team-ultra-analyze")
```

---

## 工作流技能

### workflow-plan

**用途**：4 阶段工作流统一规划技能

**触发器**：`workflow-plan`、`workflow-plan-verify`、`workflow:replan`

**说明**：计划验证和交互式重新规划。

**阶段**：
1. 会话发现
2. 上下文收集
3. 冲突解决（有条件）
4. 任务生成
5. 计划验证（verify 模式）
6. 交互式重新规划（replan 模式）

**模式**：`plan`、`verify`、`replan`

**产物**：IMPL_PLAN.md、任务 JSON、TODO_LIST.md、PLAN_VERIFICATION.md

**保护**：TodoWrite 跟踪 + 哨兵回退用于紧凑恢复

```bash
Skill(skill="workflow-plan")
```

---

### workflow-lite-plan

**用途**：轻量级规划和执行技能

**触发器**：`workflow-lite-plan`

**说明**：统一的规划和执行技能（Phase 1: 规划，Phase 2: 执行），带提示增强。

**阶段**：
1. 阶段 1：轻量级计划（规划管道）
2. 阶段 2：轻量级执行（执行引擎，内部）

**模式**：`plan`（Phase 1 → Phase 2 自动衔接）

**产物**：LITE_PLAN.md、执行结果

```bash
Skill(skill="workflow-lite-plan")
```

---

### workflow-multi-cli-plan

**用途**：多 CLI 协作规划和执行技能

**触发器**：`workflow-multi-cli-plan`、`workflow:multi-cli-plan`

**说明**：多 CLI 协作规划和执行技能（Phase 1: 规划，Phase 2: 执行），带提示增强。

**阶段**：
1. 阶段 1：多 CLI 计划（ACE 上下文 → 讨论 → 计划 → 执行）
2. 阶段 2：轻量级执行（执行引擎）

**模式**：`plan`、`execute`

**功能**：ACE 上下文引擎、多 CLI 讨论、移交给执行

```bash
Skill(skill="workflow-multi-cli-plan")
```

---

### workflow-execute

**用途**：协调工作流任务的代理执行

**触发器**：`workflow-execute`

**说明**：自动会话发现、并行任务处理和状态跟踪。

**阶段**：
1. 会话发现
2. 任务执行
3. 状态跟踪

**功能**：并行执行、会话发现、进度跟踪

```bash
Skill(skill="workflow-execute")
```

---

### workflow-tdd-plan

**用途**：统一 TDD 工作流技能

**触发器**：`workflow-tdd-plan`、`workflow-tdd-verify`

**说明**：6 阶段 TDD 规划，带红-绿-重构任务链生成。

**阶段**：
1. 功能分析
2. 测试设计
3. 任务生成
4. 规划文档
5. 质量关卡
6. 准备
7. 验证阶段 1-4

**模式**：`tdd-plan`、`tdd-verify`

**产物**：TDD_PLAN.md、任务链 JSON、TDD_VERIFICATION.md

**模式**：Red-Green-Refactor

```bash
Skill(skill="workflow-tdd-plan")
```

---

### workflow-test-fix

**用途**：统一测试-修复流水线

**触发器**：`workflow-test-fix`、`test fix workflow`

**说明**：结合测试生成与迭代 test-cycle 执行。

**阶段**：
- 生成阶段 1：会话发现
- 生成阶段 2：上下文收集
- 生成阶段 3：分析
- 生成阶段 4：任务生成
- 执行阶段 1-4：自适应策略、渐进式测试、CLI 回退

**模式**：`test-fix-gen`、`test-cycle-execute`

**功能**：自适应策略、渐进式测试、CLI 回退

```bash
Skill(skill="workflow-test-fix")
```

---

### workflow-skill-designer

**用途**：设计编排器+阶段结构化工作流技能的元技能

**触发器**：`design workflow skill`、`create workflow skill`、`workflow skill designer`

**说明**：创建 SKILL.md 编排器，带渐进式阶段加载。

**阶段**：
1. 需求
2. 结构设计
3. SKILL.md 生成
4. 阶段文件生成

**输出**：SKILL.md、phases/*.md

**模式**：progressive phase loading、TodoWrite 模式、数据流、紧凑恢复

```bash
Skill(skill="workflow-skill-designer")
```

---

## 工作流组合

常见开发场景的预定义技能序列：

### 1. 完整生命周期开发

**用途**：完整 spec → impl → test 工作流

**使用场景**：带完整规划和验证的新功能开发

```bash
Skill(skill="brainstorm")
Skill(skill="workflow-plan")
Skill(skill="workflow-plan", args="--mode verify")
Skill(skill="workflow-execute")
Skill(skill="review-cycle")
```

**团队替代方案**：`team-lifecycle`

---

### 2. 快速迭代

**用途**：快速规划和执行循环

**使用场景**：快速迭代和快速原型

```bash
Skill(skill="workflow-lite-plan")
Skill(skill="workflow-execute")
```

**团队替代方案**：`team-planex`

---

### 3. 多 CLI 协作规划

**用途**：多个 CLI 协作的深度分析

**使用场景**：需要深度语义分析的复杂任务

```bash
Skill(skill="workflow-multi-cli-plan")
Skill(skill="workflow-execute")
```

---

### 4. 测试驱动开发

**用途**：带测试生成和验证的 TDD 工作流

**使用场景**：红-绿-重构循环的测试驱动开发

```bash
Skill(skill="workflow-tdd-plan", args="--mode tdd-plan")
Skill(skill="workflow-execute")
Skill(skill="workflow-tdd-plan", args="--mode tdd-verify")
```

---

### 5. 测试-修复循环

**用途**：生成测试并迭代修复失败

**使用场景**：通过自动修复循环改进测试覆盖

```bash
Skill(skill="workflow-test-fix", args="--mode test-fix-gen")
Skill(skill="workflow-test-fix", args="--mode test-cycle-execute")
```

---

### 6. 规范生成工作流

**用途**：生成完整规范文档

**使用场景**：从初始想法创建产品文档

```bash
Skill(skill="brainstorm")
Skill(skill="spec-generator")
```

---

### 7. 问题解决工作流

**用途**：端到端问题管理和解决

**使用场景**：管理和报告已报告的问题

```bash
Skill(skill="issue-manage")
Skill(skill="team-issue")
Skill(skill="review-cycle", args="--mode fix")
```

---

### 8. 代码质量工作流

**用途**：审查和修复代码质量问题

**使用场景**：带自动修复的代码质量改进

```bash
Skill(skill="review-code")
Skill(skill="review-cycle", args="--mode fix")
```

**团队替代方案**：`team-review`

---

### 9. 技术债务清理

**用途**：识别和解决技术债务

**使用场景**：系统性管理技术债务

```bash
Skill(skill="team-tech-debt")
Skill(skill="workflow-execute")
Skill(skill="review-cycle")
```

---

### 10. UI 设计和实现

**用途**：设计 UI 并实现组件

**使用场景**：完整 UI/UX 设计到实现

```bash
Skill(skill="team-uidesign")
Skill(skill="team-frontend")
```

**集成**：ui-ux-pro-max

---

### 11. 质量保证流水线

**用途**：全面 QA 测试工作流

**使用场景**：完整质量保证覆盖

```bash
Skill(skill="team-quality-assurance")
Skill(skill="team-testing")
```

---

### 12. 文档生成

**用途**：生成软件文档

**使用场景**：创建交互式用户手册

```bash
Skill(skill="software-manual")
```

---

### 13. 深度分析工作流

**用途**：协作深度代码库分析

**使用场景**：复杂架构分析和理解

```bash
Skill(skill="team-ultra-analyze")
```

---

### 14. 重新规划工作流

**用途**：修改现有计划

**使用场景**：基于新需求调整计划

```bash
Skill(skill="workflow-plan", args="--mode replan")
```

---

### 15. 技能开发工作流

**用途**：创建新工作流技能

**使用场景**：扩展 CCW 功能的元技能

```bash
Skill(skill="workflow-skill-designer")
Skill(skill="skill-tuning")
```

---

## 技能关系

### 层次结构

| 层级 | 技能 |
|------|------|
| 元技能 | skill-generator、skill-tuning、workflow-skill-designer |
| 编排器 | workflow-plan、workflow-lite-plan、workflow-multi-cli-plan |
| 执行器 | workflow-execute |
| 团队负责人 | team-lifecycle (v5) |

### 集成

| 集成 | 技能 |
|------|------|
| ui-ux-pro-max | team-uidesign、team-frontend、team-lifecycle |
| ACE Context | workflow-multi-cli-plan |
| Chrome MCP | software-manual |

### 会话管理

| 类别 | 技能 |
|------|------|
| 会话命令 | workflow session start、resume、list、complete、solidify、sync |
| 依赖技能 | workflow-plan、workflow-tdd-plan、workflow-test-fix |

### 问题管理

| 类别 | 技能 |
|------|------|
| 问题 CLI | issue new、plan、execute、queue、discover、convert-to-plan |
| 依赖技能 | issue-manage、team-issue |

### 记忆管理

| 类别 | 技能 |
|------|------|
| 记忆技能 | memory-capture、memory-manage |
| 相关 CLI | memory prepare、memory style-skill-memory |

---

## 触发器映射

技能触发器快速参考：

| 触发器 | 技能 |
|--------|------|
| `brainstorm`、`头脑风暴` | brainstorm |
| `review code`、`code review`、`审查代码` | review-code |
| `manage issue` | issue-manage |
| `workflow-plan`、`workflow-plan-verify`、`workflow:replan` | workflow-plan |
| `workflow-execute` | workflow-execute |
| `workflow-lite-plan` | workflow-lite-plan |
| `workflow-multi-cli-plan`、`workflow:multi-cli-plan` | workflow-multi-cli-plan |
| `workflow-tdd-plan` | workflow-tdd-plan |
| `workflow-test-fix`、`test fix workflow` | workflow-test-fix |
| `design workflow skill`、`create workflow skill`、`workflow skill designer` | workflow-skill-designer |
| `generate command` | command-generator |
| `team lifecycle` | team-lifecycle (v5) |
| `team brainstorm` | team-brainstorm |
| `team frontend` | team-frontend |
| `team issue` | team-issue |
| `team qa`、`team quality-assurance` | team-quality-assurance |
| `tech debt cleanup`、`team tech-debt`、`技术债务` | team-tech-debt |
| `team ultra-analyze`、`team analyze` | team-ultra-analyze |
| `memory capture`、`compact session`、`记录`、`压缩会话` | memory-capture |
| `memory manage`、`update claude`、`update memory`、`generate docs`、`更新记忆`、`生成文档` | memory-manage |
| `generate spec`、`create specification`、`spec generator`、`workflow:spec` | spec-generator |
| `create skill`、`new skill` | skill-generator |
| `skill tuning`、`tune skill`、`skill diagnosis` | skill-tuning |
| `software manual`、`user guide`、`generate manual`、`create docs` | software-manual |

---

## 设计模式

技能使用这些设计模式：

| 模式 | 说明 |
|------|------|
| Orchestrator + Workers | 编排器将工作分派给专业代理 |
| Coordinator + Lead + Worker | 分层团队结构 |
| Pure Orchestrator with Phase Files | 基于阶段的执行和文件加载 |
| Generator-Critic Loop | 通过反馈迭代改进 |
| Wave Pipeline | 并发规划和执行 |
| TodoWrite Progress Tracking | 紧凑恢复和进度持久化 |

---

## 关键功能

| 功能 | 说明 |
|------|------|
| Progressive Phase Loading | 按需加载阶段以减少上下文 |
| Compact Recovery | TodoWrite + 哨兵回退用于会话连续性 |
| Multi-CLI Collaboration | Gemini、Codex、Claude 协同工作 |
| ACE Semantic Search Integration | 实时代码库上下文 |
| Interactive Mode Detection | 自动检测用户交互需求 |
| Auto Mode Support (-y/--yes) | 跳过确认用于自动化 |

::: info 参见
- [代理](../agents/builtin.md) - 专业代理
- [CLI 命令](../cli/commands.md) - 命令参考
- [自定义技能](./custom.md) - 创建自定义技能
:::
