# 命令与技能参考

> **快速参考**: Claude 命令、技能和 Codex 能力的完整目录

---

## 快速参考表

### 命令快速参考

| 类别 | 命令 | 描述 | 参数 |
|----------|---------|-------------|-----------|
| **编排器** | `/ccw` | 主工作流编排器 | `"任务描述"` |
| **编排器** | `/ccw-coordinator` | 命令编排工具 | `[任务描述]` |
| **会话** | `/workflow:session:start` | 启动工作流会话 | `[--type] [--auto|--new] [任务]` |
| **会话** | `/workflow:session:resume` | 恢复暂停的会话 | - |
| **会话** | `/workflow:session:complete` | 完成活动会话 | `[-y] [--detailed]` |
| **会话** | `/workflow:session:list` | 列出所有会话 | - |
| **会话** | `/workflow:session:sync` | 同步会话到规格 | `[-y] ["完成内容"]` |
| **会话** | `/workflow:session:solidify` | 固化学习成果 | `[--type] [--category] "规则"` |
| **Issue** | `/issue:new` | 创建结构化 Issue | `<url|文本> [--priority 1-5]` |
| **Issue** | `/issue:discover` | 发现潜在问题 | `<路径> [--perspectives=...]` |
| **Issue** | `/issue:plan` | 规划 Issue 解决 | `--all-pending <ids>` |
| **Issue** | `/issue:queue` | 形成执行队列 | `[--queues <n>] [--issue <id>]` |
| **Issue** | `/issue:execute` | 执行队列 | `--queue <id> [--worktree]` |
| **IDAW** | `/idaw:run` | IDAW 编排器 | `[--task <ids>] [--dry-run]` |
| **IDAW** | `/idaw:add` | 添加任务到队列 | - |
| **IDAW** | `/idaw:resume` | 恢复 IDAW 会话 | - |
| **IDAW** | `/idaw:status` | 显示队列状态 | - |
| **With-File** | `/workflow:brainstorm-with-file` | 交互式头脑风暴 | `[-c] [-m creative|structured] "主题"` |
| **With-File** | `/workflow:analyze-with-file` | 协作分析 | `[-c] "主题"` |
| **With-File** | `/workflow:debug-with-file` | 假设驱动调试 | `"Bug描述"` |
| **With-File** | `/workflow:collaborative-plan-with-file` | 多代理规划 | - |
| **With-File** | `/workflow:roadmap-with-file` | 战略路线图 | - |
| **Cycle** | `/workflow:integration-test-cycle` | 集成测试循环 | - |
| **Cycle** | `/workflow:refactor-cycle` | 重构循环 | - |
| **CLI** | `/cli:codex-review` | Codex 代码审查 | `[--uncommitted|--base|--commit]` |
| **CLI** | `/cli:cli-init` | 初始化 CLI 配置 | - |
| **Memory** | `/memory:prepare` | 准备记忆上下文 | - |
| **Memory** | `/memory:style-skill-memory` | 样式/技能记忆 | - |

### 技能快速参考

| 类别 | 技能 | 内部流水线 | 用例 |
|----------|-------|-------------------|----------|
| **Workflow** | workflow-lite-plan | explore → plan → confirm → execute | 快速功能、Bug 修复 |
| **Workflow** | workflow-plan | session → context → convention → gen → verify/replan | 复杂功能规划 |
| **Workflow** | workflow-execute | session discovery → task processing → commit | 执行预生成的计划 |
| **Workflow** | workflow-tdd-plan | 6阶段 TDD plan → verify | TDD 开发 |
| **Workflow** | workflow-test-fix | session → context → analysis → gen → cycle | 测试生成与修复 |
| **Workflow** | workflow-multi-cli-plan | ACE context → CLI discussion → plan → execute | 多视角规划 |
| **Workflow** | workflow-skill-designer | - | 创建新技能 |
| **Team** | team-lifecycle | spec pipeline → impl pipeline | 完整生命周期 |
| **Team** | team-planex | planner wave → executor wave | Issue 批量执行 |
| **Team** | team-arch-opt | architecture analysis → optimization | 架构优化 |
| **Utility** | brainstorm | framework → parallel analysis → synthesis | 多视角创意 |
| **Utility** | review-cycle | discovery → analysis → aggregation → deep-dive | 代码审查 |
| **Utility** | spec-generator | study → brief → PRD → architecture → epics | 规格文档包 |

---

## 1. 主编排器命令

### /ccw

**描述**: 主工作流编排器 - 分析意图、选择工作流、在主进程中执行命令链

**参数**: `"任务描述"`

**类别**: orchestrator

**5阶段工作流**:
1. Phase 1: 分析意图 (检测任务类型、复杂度、清晰度)
2. Phase 1.5: 需求澄清 (如果清晰度 < 2)
3. Phase 2: 选择工作流并构建命令链
4. Phase 3: 用户确认
5. Phase 4: 设置 TODO 跟踪和状态文件
6. Phase 5: 执行命令链

**技能映射**:

| 技能 | 内部流水线 |
|-------|-------------------|
| workflow-lite-plan | explore → plan → confirm → execute |
| workflow-plan | session → context → convention → gen → verify/replan |
| workflow-execute | session discovery → task processing → commit |
| workflow-tdd-plan | 6阶段 TDD plan → verify |
| workflow-test-fix | session → context → analysis → gen → cycle |
| workflow-multi-cli-plan | ACE context → CLI discussion → plan → execute |
| review-cycle | session/module review → fix orchestration |
| brainstorm | auto/single-role → artifacts → analysis → synthesis |
| spec-generator | product-brief → PRD → architecture → epics |

**自动模式**: `-y` 或 `--yes` 标志跳过确认，传播到所有技能

---

### /ccw-coordinator

**描述**: 命令编排工具 - 分析需求、推荐链、带状态持久化顺序执行

**参数**: `[任务描述]`

**类别**: orchestrator

**3阶段工作流**:
1. Phase 1: 分析需求
2. Phase 2: 发现命令并推荐链
3. Phase 3: 顺序执行命令链

**最小执行单元**:

| 单元 | 命令 | 用途 |
|------|----------|---------|
| 快速实现 | lite-plan (plan → execute) | 轻量级规划和执行 |
| 多CLI规划 | multi-cli-plan | 多视角规划 |
| Bug修复 | lite-plan --bugfix | Bug诊断和修复 |
| 完整规划+执行 | plan → execute | 详细规划 |
| 验证规划+执行 | plan → plan-verify → execute | 带验证的规划 |
| TDD规划+执行 | tdd-plan → execute | TDD工作流 |
| Issue工作流 | discover → plan → queue → execute | 完整Issue生命周期 |

---

### /flow-create

**描述**: 元技能/flow-coordinator 的流程模板生成器

**参数**: `[模板名称] [--output <路径>]`

**类别**: utility

**执行流程**:
1. Phase 1: 模板设计 (名称 + 描述 + 级别)
2. Phase 2: 步骤定义 (命令类别 → 具体命令 → 执行单元 → 模式)
3. Phase 3: 生成 JSON

---

## 2. 工作流会话命令

### /workflow:session:start

**描述**: 发现现有会话或启动新工作流会话，具有智能会话管理和冲突检测

**参数**: `[--type <workflow|review|tdd|test|docs>] [--auto|--new] [任务描述]`

**类别**: session-management

**会话类型**:

| 类型 | 描述 | 默认对应技能 |
|------|-------------|-------------|
| workflow | 标准实现 | workflow-plan skill |
| review | 代码审查会话 | review-cycle skill |
| tdd | TDD开发 | workflow-tdd-plan skill |
| test | 测试生成/修复 | workflow-test-fix skill |
| docs | 文档会话 | memory-manage skill |

**模式**:
- **发现模式** (默认): 列出活动会话，提示用户
- **自动模式** (`--auto`): 智能会话选择
- **强制新建模式** (`--new`): 创建新会话

---

### /workflow:session:resume

**描述**: 恢复最近暂停的工作流会话，自动发现会话并更新状态

**类别**: session-management

---

### /workflow:session:complete

**描述**: 标记活动工作流会话为完成，归档并记录经验教训，更新清单，移除活动标志

**参数**: `[-y|--yes] [--detailed]`

**类别**: session-management

**执行阶段**:
1. 查找会话
2. 生成清单条目
3. 原子提交 (移至归档)
4. 自动同步项目状态

---

### /workflow:session:list

**描述**: 列出所有工作流会话，支持状态过滤，显示会话元数据和进度信息

**类别**: session-management

---

### /workflow:session:sync

**描述**: 快速同步会话工作到 specs/*.md 和 project-tech

**参数**: `[-y|--yes] ["完成内容"]`

**类别**: session-management

**流程**:
1. 收集上下文 (git diff, session, summary)
2. 提取更新 (guidelines, tech)
3. 预览并确认
4. 写入两个文件

---

### /workflow:session:solidify

**描述**: 将会话学习成果和用户定义约束固化为永久项目指南，或压缩近期记忆

**参数**: `[-y|--yes] [--type <convention|constraint|learning|compress>] [--category <类别>] [--limit <N>] "规则或见解"`

**类别**: session-management

**类型类别**:

| 类型 | 子类别 |
|------|---------------|
| convention | coding_style, naming_patterns, file_structure, documentation |
| constraint | architecture, tech_stack, performance, security |
| learning | architecture, performance, security, testing, process, other |
| compress | (操作核心记忆) |

---

## 3. Issue 工作流命令

### /issue:new

**描述**: 从 GitHub URL 或文本描述创建结构化 Issue

**参数**: `[-y|--yes] <github-url | 文本描述> [--priority 1-5]`

**类别**: issue

**执行流程**:
1. 输入分析与清晰度检测
2. 数据提取 (GitHub 或文本)
3. 轻量级上下文提示 (ACE 用于中等清晰度)
4. 条件性澄清
5. GitHub 发布决策
6. 创建 Issue

---

### /issue:discover

**描述**: 使用 CLI explore 从多视角发现潜在问题。支持 Exa 外部研究用于安全和最佳实践视角。

**参数**: `[-y|--yes] <路径模式> [--perspectives=bug,ux,...] [--external]`

**类别**: issue

**可用视角**:

| 视角 | 关注点 | 类别 |
|-------------|-------|------------|
| bug | 潜在Bug | edge-case, null-check, resource-leak, race-condition |
| ux | 用户体验 | error-message, loading-state, feedback, accessibility |
| test | 测试覆盖 | missing-test, edge-case-test, integration-gap |
| quality | 代码质量 | complexity, duplication, naming, documentation |
| security | 安全问题 | injection, auth, encryption, input-validation |
| performance | 性能 | n-plus-one, memory-usage, caching, algorithm |
| maintainability | 可维护性 | coupling, cohesion, tech-debt, extensibility |
| best-practices | 最佳实践 | convention, pattern, framework-usage, anti-pattern |

---

### /issue:plan

**描述**: 使用 issue-plan-agent 批量规划 Issue 解决方案 (探索 + 计划闭环)

**参数**: `[-y|--yes] --all-pending <issue-id>[,<issue-id>,...] [--batch-size 3]`

**类别**: issue

**执行过程**:
1. Issue 加载与智能分组
2. 统一探索 + 规划 (issue-plan-agent)
3. 解决方案注册与绑定
4. 汇总

---

### /issue:queue

**描述**: 使用 issue-queue-agent 从绑定解决方案形成执行队列 (解决方案级别)

**参数**: `[-y|--yes] [--queues <n>] [--issue <id>]`

**类别**: issue

**核心能力**:
- 代理驱动的排序逻辑
- 解决方案级别粒度
- 冲突澄清
- 并行/顺序组分配

---

### /issue:execute

**描述**: 使用基于 DAG 的并行编排执行队列 (每个解决方案一次提交)

**参数**: `[-y|--yes] --queue <queue-id> [--worktree [<现有路径>]]`

**类别**: issue

**执行流程**:
1. 验证队列 ID (必需)
2. 获取 DAG 和用户选择
3. 分发并行批次 (DAG 驱动)
4. 下一批次 (重复)
5. Worktree 完成

**推荐执行器**: Codex (2小时超时, 完整写入权限)

---

### /issue:from-brainstorm

**描述**: 将头脑风暴会话想法转换为带可执行解决方案的 Issue

**参数**: `SESSION="<session-id>" [--idea=<index>] [--auto] [-y|--yes]`

**类别**: issue

**执行流程**:
1. 会话加载
2. 想法选择
3. 丰富 Issue 上下文
4. 创建 Issue
5. 生成解决方案任务
6. 绑定解决方案

---

## 4. IDAW 命令

### /idaw:run

**描述**: IDAW 编排器 - 带 Git 检查点顺序执行任务技能链

**参数**: `[-y|--yes] [--task <id>[,<id>,...]] [--dry-run]`

**类别**: idaw

**技能链映射**:

| 任务类型 | 技能链 |
|-----------|-------------|
| bugfix | workflow-lite-plan → workflow-test-fix |
| bugfix-hotfix | workflow-lite-plan |
| feature | workflow-lite-plan → workflow-test-fix |
| feature-complex | workflow-plan → workflow-execute → workflow-test-fix |
| refactor | workflow:refactor-cycle |
| tdd | workflow-tdd-plan → workflow-execute |
| test | workflow-test-fix |
| test-fix | workflow-test-fix |
| review | review-cycle |
| docs | workflow-lite-plan |

**6阶段执行**:
1. 加载任务
2. 会话设置
3. 启动协议
4. 主循环 (顺序，一次一个任务)
5. 检查点 (每个任务)
6. 报告

---

### /idaw:add

**描述**: 添加任务到 IDAW 队列，自动推断任务类型和技能链

**类别**: idaw

---

### /idaw:resume

**描述**: 带崩溃恢复的 IDAW 会话恢复

**类别**: idaw

---

### /idaw:status

**描述**: 显示 IDAW 队列状态

**类别**: idaw

---

### /idaw:run-coordinate

**描述**: 带并行任务协调的多代理 IDAW 执行

**类别**: idaw

---

## 5. With-File 工作流

### /workflow:brainstorm-with-file

**描述**: 交互式头脑风暴，具有多 CLI 协作、想法扩展和文档化思维演进

**参数**: `[-y|--yes] [-c|--continue] [-m|--mode creative|structured] "想法或主题"`

**类别**: with-file

**输出目录**: `.workflow/.brainstorm/{session-id}/`

**4阶段工作流**:
1. Phase 1: 种子理解 (解析主题, 选择角色, 扩展向量)
2. Phase 2: 发散探索 (cli-explore-agent + 多 CLI 视角)
3. Phase 3: 交互式精炼 (多轮)
4. Phase 4: 收敛与结晶

**输出产物**:
- `brainstorm.md` - 完整思维演进时间线
- `exploration-codebase.json` - 代码库上下文
- `perspectives.json` - 多 CLI 发现
- `synthesis.json` - 最终综合

---

### /workflow:analyze-with-file

**描述**: 交互式协作分析，具有文档化讨论、CLI 辅助探索和演进理解

**参数**: `[-y|--yes] [-c|--continue] "主题或问题"`

**类别**: with-file

**输出目录**: `.workflow/.analysis/{session-id}/`

**4阶段工作流**:
1. Phase 1: 主题理解
2. Phase 2: CLI 探索 (cli-explore-agent + 视角)
3. Phase 3: 交互式讨论 (多轮)
4. Phase 4: 综合与结论

**决策记录协议**: 必须记录方向选择、关键发现、假设变更、用户反馈

---

### /workflow:debug-with-file

**描述**: 交互式假设驱动调试，具有文档化探索、理解演进和 Gemini 辅助纠正

**参数**: `[-y|--yes] "Bug 描述或错误信息"`

**类别**: with-file

**输出目录**: `.workflow/.debug/{session-id}/`

**核心工作流**: 探索 → 文档 → 日志 → 分析 → 纠正理解 → 修复 → 验证

**输出产物**:
- `debug.log` - NDJSON 执行证据
- `understanding.md` - 探索时间线 + 整合理解
- `hypotheses.json` - 带结论的假设历史

---

### /workflow:collaborative-plan-with-file

**描述**: 带 Plan Note 共享文档的多代理协作规划

**类别**: with-file

---

### /workflow:roadmap-with-file

**描述**: 战略需求路线图 → Issue 创建 → execution-plan.json

**类别**: with-file

---

### /workflow:unified-execute-with-file

**描述**: 通用执行引擎 - 消费来自 collaborative-plan、roadmap、brainstorm 的计划输出

**类别**: with-file

---

## 6. 循环工作流

### /workflow:integration-test-cycle

**描述**: 带反思的自迭代集成测试 - 探索 → 测试开发 → 测试修复循环 → 反思

**类别**: cycle

**输出目录**: `.workflow/.test-cycle/`

---

### /workflow:refactor-cycle

**描述**: 技术债务发现 → 优先级排序 → 执行 → 验证

**类别**: cycle

**输出目录**: `.workflow/.refactor-cycle/`

---

## 7. CLI 命令

### /cli:codex-review

**描述**: 使用 Codex CLI 通过 ccw 端点进行交互式代码审查，支持可配置审查目标、模型和自定义指令

**参数**: `[--uncommitted|--base <分支>|--commit <sha>] [--model <模型>] [--title <标题>] [提示]`

**类别**: cli

**审查目标**:

| 目标 | 标志 | 描述 |
|--------|------|-------------|
| 未提交更改 | `--uncommitted` | 审查已暂存、未暂存和未跟踪的更改 |
| 与分支比较 | `--base <BRANCH>` | 审查与基础分支的差异 |
| 特定提交 | `--commit <SHA>` | 审查提交引入的更改 |

**关注领域**: 一般审查、安全重点、性能重点、代码质量

**重要**: 目标标志和提示互斥

---

### /cli:cli-init

**描述**: 初始化 ccw 端点的 CLI 配置

**类别**: cli

---

## 8. 记忆命令

### /memory:prepare

**描述**: 为会话准备记忆上下文

**类别**: memory

---

### /memory:style-skill-memory

**描述**: 样式和技能记忆管理

**类别**: memory

---

## 9. 团队技能

### 团队生命周期技能

| 技能 | 描述 |
|-------|-------------|
| team-lifecycle | 带角色规格驱动工作代理的完整团队生命周期 |
| team-planex | 规划器 + 执行器波流水线 (用于大批量 Issue 或路线图输出) |
| team-coordinate | 团队协调和编排 |
| team-executor | 带工作代理的任务执行 |
| team-arch-opt | 架构优化技能 |

### 团队领域技能

| 技能 | 描述 |
|-------|-------------|
| team-brainstorm | 多视角头脑风暴 |
| team-review | 代码审查工作流 |
| team-testing | 测试工作流 |
| team-frontend | 前端开发工作流 |
| team-issue | Issue 管理工作流 |
| team-iterdev | 迭代开发工作流 |
| team-perf-opt | 性能优化工作流 |
| team-quality-assurance | QA 工作流 |
| team-roadmap-dev | 路线图开发工作流 |
| team-tech-debt | 技术债务管理 |
| team-uidesign | UI 设计工作流 |
| team-ultra-analyze | 深度分析工作流 |

---

## 10. 工作流技能

| 技能 | 内部流水线 | 描述 |
|-------|-------------------|-------------|
| workflow-lite-plan | explore → plan → confirm → execute | 轻量级合并模式规划 |
| workflow-plan | session → context → convention → gen → verify/replan | 带架构设计的完整规划 |
| workflow-execute | session discovery → task processing → commit | 从规划会话执行 |
| workflow-tdd-plan | 6阶段 TDD plan → verify | TDD 工作流规划 |
| workflow-test-fix | session → context → analysis → gen → cycle | 测试生成与修复循环 |
| workflow-multi-cli-plan | ACE context → CLI discussion → plan → execute | 多 CLI 协作规划 |
| workflow-skill-designer | - | 工作流技能设计和生成 |

---

## 11. 实用技能

| 技能 | 描述 |
|-------|-------------|
| brainstorm | 统一头脑风暴技能 (自动并行 + 角色分析) |
| review-code | 代码审查技能 |
| review-cycle | 会话/模块审查 → 修复编排 |
| spec-generator | 产品简介 → PRD → 架构 → Epics |
| skill-generator | 生成新技能 |
| skill-tuning | 调优现有技能 |
| command-generator | 生成新命令 |
| memory-capture | 捕获会话记忆 |
| memory-manage | 管理存储的记忆 |
| issue-manage | Issue 管理工具 |
| ccw-help | CCW 帮助和文档 |

---

## 12. Codex 能力

### Codex 审查模式

**命令**: `ccw cli --tool codex --mode review [选项]`

| 选项 | 描述 |
|--------|-------------|
| `[提示]` | 自定义审查指令 (位置参数, 无目标标志) |
| `-c model=<模型>` | 通过配置覆盖模型 |
| `--uncommitted` | 审查已暂存、未暂存和未跟踪的更改 |
| `--base <BRANCH>` | 审查与基础分支的差异 |
| `--commit <SHA>` | 审查提交引入的更改 |
| `--title <TITLE>` | 可选的提交标题用于审查摘要 |

**可用模型**:
- 默认: gpt-5.2
- o3: OpenAI o3 推理模型
- gpt-4.1: GPT-4.1 模型
- o4-mini: OpenAI o4-mini (更快)

**约束**:
- 目标标志 (`--uncommitted`, `--base`, `--commit`) **不能**与位置参数 `[提示]` 一起使用
- 自定义提示仅支持不带目标标志的情况 (默认审查未提交更改)

### Codex 集成点

| 集成点 | 描述 |
|-------------------|-------------|
| CLI 端点 | `ccw cli --tool codex --mode <analysis\|write\|review>` |
| 多 CLI 规划 | workflow-multi-cli-plan 中的务实视角 |
| 代码审查 | `/cli:codex-review` 命令 |
| Issue 执行 | `/issue:execute` 的推荐执行器 |
| 魔鬼代言人 | 头脑风暴精炼中的挑战模式 |

### Codex 模式汇总

| 模式 | 权限 | 用例 |
|------|------------|----------|
| analysis | 只读 | 代码分析、架构审查 |
| write | 完整访问 | 实现、文件修改 |
| review | 只读输出 | Git 感知的代码审查 |

---

## 统计汇总

| 类别 | 数量 |
|----------|-------|
| 主编排器命令 | 3 |
| 工作流会话命令 | 6 |
| Issue 工作流命令 | 6 |
| IDAW 命令 | 5 |
| With-File 工作流 | 6 |
| 循环工作流 | 2 |
| CLI 命令 | 2 |
| 记忆命令 | 2 |
| 团队技能 | 17 |
| 工作流技能 | 7 |
| 实用技能 | 11 |
| **命令总数** | 32 |
| **技能总数** | 35 |

---

## 调用模式

### 斜杠命令调用

```
/<命名空间>:<命令> [参数] [标志]
```

示例:
- `/ccw "添加用户认证"`
- `/workflow:session:start --auto "实现功能"`
- `/issue:new https://github.com/org/repo/issues/123`
- `/cli:codex-review --base main`

### 技能调用 (从代码)

```javascript
Skill({ skill: "workflow-lite-plan", args: '"任务描述"' })
Skill({ skill: "brainstorm", args: '"主题或问题"' })
Skill({ skill: "review-cycle", args: '--session="WFS-xxx"' })
```

### CLI 工具调用

```bash
ccw cli -p "PURPOSE: ... TASK: ... MODE: analysis|write" --tool <工具> --mode <模式>
```

---

## 相关文档

- [工作流对比表](../workflows/comparison-table.md) - 工作流选择指南
- [工作流概览](../workflows/index.md) - 4级工作流系统
- [Claude 工作流技能](../skills/claude-workflow.md) - 详细技能文档
