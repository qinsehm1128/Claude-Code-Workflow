---
name: ccw-coordinator
description: Command orchestration tool - analyze requirements, recommend chain, execute sequentially with state persistence
argument-hint: "[task description]"
allowed-tools: Task(*), AskUserQuestion(*), Read(*), Write(*), Bash(*), Glob(*), Grep(*)
---

# CCW Coordinator Command

Interactive orchestration tool: analyze task → discover commands → recommend chain → execute sequentially → track state.

**Execution Model**: Pseudocode guidance. Claude intelligently executes each phase based on context.

## Skill 映射

命令端口定义中的 workflow 操作通过 `Skill()` 调用。

| Skill | 包含操作 |
|-------|---------|
| `workflow-lite-plan` | lite-plan, lite-execute |
| `workflow-plan` | plan, plan-verify, replan |
| `workflow-execute` | execute |
| `workflow-multi-cli-plan` | multi-cli-plan |
| `workflow-test-fix` | test-fix-gen, test-cycle-execute |
| `workflow-tdd` | tdd-plan, tdd-verify |
| `review-cycle` | review-session-cycle, review-module-cycle, review-cycle-fix |
| `brainstorm` | auto-parallel, artifacts, role-analysis, synthesis |
| `workflow:collaborative-plan-with-file` | understanding agent → parallel agents → plan-note.md |
| `workflow:req-plan-with-file` | requirement decomposition → issue creation → execution-plan.json |
| `workflow:integration-test-cycle` | explore → test dev → test-fix cycle → reflection |
| `workflow:refactor-cycle` | tech debt discovery → prioritize → execute → validate |
| `team-planex` | planner + executor wave pipeline（边规划边执行）|
| `team-iterdev` | 迭代开发团队（planner → developer → reviewer 循环）|
| `team-lifecycle` | 全生命周期团队（spec → impl → test）|
| `team-issue` | issue 解决团队（discover → plan → execute）|
| `team-testing` | 测试团队（strategy → generate → execute → analyze）|
| `team-quality-assurance` | QA 团队（scout → strategist → generator → executor → analyst）|
| `team-brainstorm` | 团队头脑风暴（facilitator → participants → synthesizer）|
| `team-uidesign` | UI 设计团队（designer → implementer dual-track）|

独立命令（仍使用 colon 格式）：workflow:brainstorm-with-file, workflow:debug-with-file, workflow:analyze-with-file, workflow:collaborative-plan-with-file, workflow:req-plan-with-file, workflow:integration-test-cycle, workflow:refactor-cycle, workflow:unified-execute-with-file, workflow:clean, workflow:init, workflow:init-guidelines, workflow:ui-design:*, issue:*, workflow:session:*

## Core Concept: Minimum Execution Units (最小执行单元)

### What is a Minimum Execution Unit?

**Definition**: A set of commands that must execute together as an atomic group to achieve a meaningful workflow milestone. Splitting these commands breaks the logical flow and creates incomplete states.

**Why This Matters**:
- **Prevents Incomplete States**: Avoid stopping after task generation without execution
- **User Experience**: User gets complete results, not intermediate artifacts requiring manual follow-up
- **Workflow Integrity**: Maintains logical coherence of multi-step operations

### Minimum Execution Units

**Planning + Execution Units** (规划+执行单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Quick Implementation** | lite-plan → lite-execute | Lightweight plan and immediate execution | Working code |
| **Multi-CLI Planning** | multi-cli-plan → lite-execute | Multi-perspective analysis and execution | Working code |
| **Bug Fix** | lite-plan (--bugfix) → lite-execute | Quick bug diagnosis and fix execution | Fixed code |
| **Full Planning + Execution** | plan → execute | Detailed planning and execution | Working code |
| **Verified Planning + Execution** | plan → plan-verify → execute | Planning with verification and execution | Working code |
| **Replanning + Execution** | replan → execute | Update plan and execute changes | Working code |
| **TDD Planning + Execution** | tdd-plan → execute | Test-driven development planning and execution | Working code |
| **Test Generation + Execution** | test-gen → execute | Generate test suite and execute | Generated tests |

**Testing Units** (测试单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Test Validation** | test-fix-gen → test-cycle-execute | Generate test tasks and execute test-fix cycle | Tests passed |

**Review Units** (审查单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Code Review (Session)** | review-session-cycle → review-cycle-fix | Complete review cycle and apply fixes | Fixed code |
| **Code Review (Module)** | review-module-cycle → review-cycle-fix | Module review cycle and apply fixes | Fixed code |

**Issue Units** (Issue单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Issue Workflow** | discover → plan → queue → execute | Complete issue lifecycle | Completed issues |
| **Rapid-to-Issue** | lite-plan → convert-to-plan → queue → execute | Bridge lite workflow to issue workflow | Completed issues |
| **Brainstorm-to-Issue** | from-brainstorm → queue → execute | Bridge brainstorm session to issue workflow | Completed issues |

**With-File Units** (文档化单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Brainstorm With File** | brainstorm-with-file | Multi-perspective ideation with documentation | brainstorm.md |
| **Debug With File** | debug-with-file | Hypothesis-driven debugging with documentation | understanding.md |
| **Analyze With File** | analyze-with-file | Collaborative analysis with documentation | discussion.md |
| **Collaborative Plan** | collaborative-plan-with-file → unified-execute-with-file | Multi-agent collaborative planning and execution | plan-note.md + code |
| **Requirement Plan** | req-plan-with-file → team-planex | Requirement decomposition and wave execution | execution-plan.json + code |

**Cycle Units** (循环单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Integration Test Cycle** | integration-test-cycle | Self-iterating integration test with reflection | Tests passed |
| **Refactor Cycle** | refactor-cycle | Tech debt discovery and refactoring | Refactored code |

**Team Units** (团队单元):

| Unit Name | Commands | Purpose | Output |
|-----------|----------|---------|--------|
| **Team Plan+Execute** | team-planex | Wave pipeline (planner + executor) | Working code |
| **Team Iterative Dev** | team-iterdev | Iterative development (planner → developer → reviewer) | Working code |
| **Team Lifecycle** | team-lifecycle | Full lifecycle (spec → impl → test) | Working code |
| **Team Issue** | team-issue | Multi-role issue resolution | Resolved issues |
| **Team Testing** | team-testing | Comprehensive test pipeline | Tests passed |
| **Team QA** | team-quality-assurance | Quality assurance pipeline | QA report |
| **Team Brainstorm** | team-brainstorm | Multi-role brainstorming | Analysis |
| **Team UI Design** | team-uidesign | Dual-track design + implementation | UI code |

### Command-to-Unit Mapping (命令与最小单元的映射)

| Command | Can Precede | Atomic Units |
|---------|-----------|--------------|
| lite-plan | lite-execute, convert-to-plan | Quick Implementation, Rapid-to-Issue, Bug Fix |
| multi-cli-plan | lite-execute | Multi-CLI Planning |
| plan | plan-verify, execute | Full Planning + Execution, Verified Planning + Execution |
| plan-verify | execute | Verified Planning + Execution |
| replan | execute | Replanning + Execution |
| test-gen | execute | Test Generation + Execution |
| tdd-plan | execute | TDD Planning + Execution |
| review-session-cycle | review-cycle-fix | Code Review (Session) |
| review-module-cycle | review-cycle-fix | Code Review (Module) |
| test-fix-gen | test-cycle-execute | Test Validation |
| issue:discover | issue:plan | Issue Workflow |
| issue:plan | issue:queue | Issue Workflow |
| convert-to-plan | issue:queue | Rapid-to-Issue |
| issue:queue | issue:execute | Issue Workflow, Rapid-to-Issue, Brainstorm-to-Issue |
| issue:from-brainstorm | issue:queue | Brainstorm-to-Issue |
| brainstorm-with-file | issue:from-brainstorm (optional) | Brainstorm With File, Brainstorm-to-Issue |
| collaborative-plan-with-file | unified-execute-with-file | Collaborative Plan |
| req-plan-with-file | team-planex | Requirement Plan |
| unified-execute-with-file | (terminal) | Collaborative Plan |
| integration-test-cycle | (standalone) | Integration Test Cycle |
| refactor-cycle | (standalone) | Refactor Cycle |
| team-planex | (standalone) | Team Plan+Execute |
| team-iterdev | (standalone) | Team Iterative Dev |
| team-lifecycle | (standalone) | Team Lifecycle |
| team-issue | (standalone) | Team Issue |
| team-testing | (standalone) | Team Testing |
| team-quality-assurance | (standalone) | Team QA |
| team-brainstorm | (standalone) | Team Brainstorm |
| team-uidesign | (standalone) | Team UI Design |
| debug-with-file | (standalone) | Debug With File |
| analyze-with-file | (standalone) | Analyze With File |

### Atomic Group Rules

1. **Never Split Units**: Coordinator must recommend complete units, not partial chains
2. **Multi-Unit Participation**: Some commands can participate in multiple units (e.g., plan → execute or plan → plan-verify → execute)
3. **User Override**: User can explicitly request partial execution (advanced mode)
4. **Visualization**: Pipeline view shows unit boundaries with `【 】` markers
5. **Validation**: Before execution, verify all unit commands are included

**Example Pipeline with Units**:
```
需求 → 【lite-plan → lite-execute】→ 代码 → 【test-fix-gen → test-cycle-execute】→ 测试通过
       └──── Quick Implementation ────┘         └────── Test Validation ──────┘
```

## 3-Phase Workflow

### Phase 1: Analyze Requirements

Parse task to extract: goal, scope, constraints, complexity, and task type.

```javascript
function analyzeRequirements(taskDescription) {
  return {
    goal: extractMainGoal(taskDescription),           // e.g., "Implement user registration"
    scope: extractScope(taskDescription),             // e.g., ["auth", "user_management"]
    constraints: extractConstraints(taskDescription), // e.g., ["no breaking changes"]
    complexity: determineComplexity(taskDescription), // 'simple' | 'medium' | 'complex'
    task_type: detectTaskType(taskDescription)        // See task type patterns below
  };
}

// Task Type Detection Patterns
function detectTaskType(text) {
  // Priority order (first match wins)
  if (/fix|bug|error|crash|fail|debug|diagnose/.test(text)) return 'bugfix';
  if (/tdd|test-driven|先写测试|test first/.test(text)) return 'tdd';
  if (/测试失败|test fail|fix test|failing test/.test(text)) return 'test-fix';
  if (/generate test|写测试|add test|补充测试/.test(text)) return 'test-gen';
  if (/review|审查|code review/.test(text)) return 'review';
  // Issue workflow patterns
  if (/issues?.*batch|batch.*issues?|批量.*issue|issue.*批量/.test(text)) return 'issue-batch';
  if (/issue workflow|structured workflow|queue|multi-stage|转.*issue|issue.*流程/.test(text)) return 'issue-transition';
  // With-File workflow patterns
  if (/brainstorm|ideation|头脑风暴|创意|发散思维|creative thinking/.test(text)) return 'brainstorm-file';
  if (/brainstorm.*issue|头脑风暴.*issue|idea.*issue|想法.*issue|从.*头脑风暴|convert.*brainstorm/.test(text)) return 'brainstorm-to-issue';
  if (/debug.*document|hypothesis.*debug|深度调试|假设.*验证|systematic debug/.test(text)) return 'debug-file';
  if (/analyze.*document|collaborative analysis|协作分析|深度.*理解/.test(text)) return 'analyze-file';
  if (/collaborative.*plan|协作.*规划|多人.*规划|multi.*agent.*plan|Plan Note|分工.*规划/.test(text)) return 'collaborative-plan';
  if (/roadmap|需求.*规划|需求.*拆解|requirement.*plan|req.*plan|progressive.*plan|路线.*图/.test(text)) return 'req-plan';
  // Cycle workflow patterns
  if (/integration.*test|集成测试|端到端.*测试|e2e.*test|integration.*cycle/.test(text)) return 'integration-test';
  if (/refactor|重构|tech.*debt|技术债务/.test(text)) return 'refactor';
  // Team workflow patterns (explicit "team" keyword required)
  if (/team.*plan.*exec|team.*planex|团队.*规划.*执行|并行.*规划.*执行|wave.*pipeline/.test(text)) return 'team-planex';
  if (/team.*iter|team.*iterdev|迭代.*开发.*团队|iterative.*dev.*team/.test(text)) return 'team-iterdev';
  if (/team.*lifecycle|全生命周期|full.*lifecycle|spec.*impl.*test.*team/.test(text)) return 'team-lifecycle';
  if (/team.*issue.*resolv|团队.*issue|team.*resolve.*issue/.test(text)) return 'team-issue';
  if (/team.*test|测试团队|comprehensive.*test.*team|全面.*测试.*团队/.test(text)) return 'team-testing';
  if (/team.*qa|quality.*assurance.*team|QA.*团队|质量.*保障.*团队|团队.*质量/.test(text)) return 'team-qa';
  if (/team.*brainstorm|团队.*头脑风暴|team.*ideation|多人.*头脑风暴/.test(text)) return 'team-brainstorm';
  if (/team.*ui.*design|UI.*设计.*团队|dual.*track.*design|团队.*UI/.test(text)) return 'team-uidesign';
  // Standard workflows
  if (/multi.*cli|多.*CLI|多模型.*协作|multi.*model.*collab/.test(text)) return 'multi-cli';
  if (/不确定|explore|研究|what if|brainstorm|权衡/.test(text)) return 'brainstorm';
  return 'feature';  // Default
}

// Complexity Assessment
function determineComplexity(text) {
  let score = 0;
  if (/refactor|重构|migrate|迁移|architect|架构|system|系统/.test(text)) score += 2;
  if (/multiple|多个|across|跨|all|所有|entire|整个/.test(text)) score += 2;
  if (/integrate|集成|api|database|数据库/.test(text)) score += 1;
  if (/security|安全|performance|性能|scale|扩展/.test(text)) score += 1;
  return score >= 4 ? 'complex' : score >= 2 ? 'medium' : 'simple';
}
```

**Display to user**:
```
Analysis Complete:
  Goal: [extracted goal]
  Scope: [identified areas]
  Constraints: [identified constraints]
  Complexity: [level]
  Task Type: [detected type]
```

### Phase 2: Discover Commands & Recommend Chain

Dynamic command chain assembly using port-based matching.

#### Command Port Definition

Each command has input/output ports (tags) for pipeline composition:

```javascript
// Port labels represent data types flowing through the pipeline
// Type classification:
//   skill:   workflow-lite-plan (lite-plan, lite-execute),
//            workflow-plan (plan, plan-verify, replan),
//            workflow-execute (execute),
//            workflow-multi-cli-plan (multi-cli-plan),
//            workflow-test-fix (test-fix-gen, test-cycle-execute),
//            workflow-tdd (tdd-plan, tdd-verify),
//            review-cycle (review-session-cycle, review-module-cycle, review-cycle-fix)
//   command: debug, test-gen, review, workflow:brainstorm-with-file,
//            workflow:debug-with-file, workflow:analyze-with-file, issue:*
const commandPorts = {
  'lite-plan': {
    name: 'lite-plan',
    input: ['requirement'],                    // 输入端口：需求
    output: ['plan'],                           // 输出端口：计划
    tags: ['planning'],
    atomic_group: 'quick-implementation'       // 最小单元：与 lite-execute 绑定
  },
  'lite-execute': {
    name: 'lite-execute',
    input: ['plan', 'multi-cli-plan'],             // 输入端口：可接受多种规划输出
    output: ['code'],                           // 输出端口：代码
    tags: ['execution'],
    atomic_groups: [                           // 可参与多个最小单元
      'quick-implementation',                  // lite-plan → lite-execute
      'multi-cli-planning',                    // multi-cli-plan → lite-execute
      'bug-fix'                                // lite-plan (--bugfix) → lite-execute
    ]
  },
  'plan': {
    name: 'plan',
    input: ['requirement'],
    output: ['detailed-plan'],
    tags: ['planning'],
    atomic_groups: [                           // 可参与多个最小单元
      'full-planning-execution',               // plan → execute
      'verified-planning-execution'            // plan → plan-verify → execute
    ]
  },
  'plan-verify': {
    name: 'plan-verify',
    input: ['detailed-plan'],
    output: ['verified-plan'],
    tags: ['planning'],
    atomic_group: 'verified-planning-execution' // 最小单元：plan → plan-verify → execute
  },
  'replan': {
    name: 'replan',
    input: ['session', 'feedback'],             // 输入端口：会话或反馈
    output: ['replan'],                         // 输出端口：更新后的计划（供 execute 执行）
    tags: ['planning'],
    atomic_group: 'replanning-execution'       // 最小单元：与 execute 绑定
  },
  'execute': {
    name: 'execute',
    input: ['detailed-plan', 'verified-plan', 'replan', 'test-tasks', 'tdd-tasks'], // 可接受多种规划输出
    output: ['code'],
    tags: ['execution'],
    atomic_groups: [                           // 可参与多个最小单元
      'full-planning-execution',               // plan → execute
      'verified-planning-execution',           // plan → plan-verify → execute
      'replanning-execution',                  // replan → execute
      'test-generation-execution',             // test-gen → execute
      'tdd-planning-execution'                 // tdd-plan → execute
    ]
  },
  'test-cycle-execute': {
    name: 'test-cycle-execute',
    input: ['test-tasks'],                      // 输入端口：测试任务(需先test-fix-gen生成)
    output: ['test-passed'],                    // 输出端口：测试通过
    tags: ['testing'],
    atomic_group: 'test-validation',           // 最小单元：与 test-fix-gen 绑定
    note: '需要先执行test-fix-gen生成测试任务，再由此命令执行测试周期'
  },
  'tdd-plan': {
    name: 'tdd-plan',
    input: ['requirement'],
    output: ['tdd-tasks'],                      // TDD 任务（供 execute 执行）
    tags: ['planning', 'tdd'],
    atomic_group: 'tdd-planning-execution'     // 最小单元：与 execute 绑定
  },
  'tdd-verify': {
    name: 'tdd-verify',
    input: ['code'],
    output: ['tdd-verified'],
    tags: ['testing']
  },
  // Bug Fix (使用 lite-plan 的 bugfix 变体，lite-fix 已移除)
  'lite-plan-bugfix': {
    name: 'lite-plan',
    input: ['bug-report'],                      // 输入端口：bug 报告
    output: ['plan'],                            // 输出端口：修复计划（供 lite-execute 执行）
    tags: ['bugfix', 'planning'],
    atomic_group: 'bug-fix',                    // 最小单元：与 lite-execute 绑定
    type: 'skill',                              // Skill 触发器: workflow-lite-plan
    note: '通过 --bugfix 参数传递 bugfix 语义'
  },
  'debug': {
    name: 'debug',
    input: ['bug-report'],
    output: ['debug-log'],
    tags: ['bugfix']
  },
  'test-gen': {
    name: 'test-gen',
    input: ['code', 'session'],                 // 可接受代码或会话
    output: ['test-tasks'],                     // 输出测试任务(IMPL-001,IMPL-002)，供 execute 执行
    tags: ['testing'],
    atomic_group: 'test-generation-execution'  // 最小单元：与 execute 绑定
  },
  'test-fix-gen': {
    name: 'test-fix-gen',
    input: ['failing-tests', 'session'],
    output: ['test-tasks'],                     // 输出测试任务，针对特定问题生成测试并在测试中修正
    tags: ['testing'],
    atomic_group: 'test-validation',           // 最小单元：与 test-cycle-execute 绑定
    note: '生成测试任务供test-cycle-execute执行'
  },
  'review': {
    name: 'review',
    input: ['code', 'session'],
    output: ['review-findings'],
    tags: ['review']
  },
  'review-cycle-fix': {
    name: 'review-cycle-fix',
    input: ['review-findings', 'review-verified'],  // Accept output from review-session-cycle or review-module-cycle
    output: ['fixed-code'],
    tags: ['review'],
    atomic_group: 'code-review'                // 最小单元：与 review-session-cycle/review-module-cycle 绑定
  },
  'brainstorm': {
    name: 'brainstorm',
    input: ['exploration-topic'],               // 输入端口：探索主题
    output: ['brainstorm-analysis'],
    tags: ['brainstorm'],
    type: 'skill'                               // 统一 Skill：brainstorm (auto-parallel, artifacts, role-analysis, synthesis)
  },
  'multi-cli-plan': {
    name: 'multi-cli-plan',
    input: ['requirement'],
    output: ['multi-cli-plan'],                 // 对比分析计划（供 lite-execute 执行）
    tags: ['planning', 'multi-cli'],
    atomic_group: 'multi-cli-planning'         // 最小单元：与 lite-execute 绑定
  },
  'review-session-cycle': {
    name: 'review-session-cycle',
    input: ['code', 'session'],                 // 可接受代码或会话
    output: ['review-verified'],                // 输出端口:审查通过
    tags: ['review'],
    atomic_group: 'code-review'                // 最小单元：与 review-cycle-fix 绑定
  },
  'review-module-cycle': {
    name: 'review-module-cycle',
    input: ['module-pattern'],                  // 输入端口:模块模式
    output: ['review-verified'],                // 输出端口:审查通过
    tags: ['review'],
    atomic_group: 'code-review'                // 最小单元：与 review-cycle-fix 绑定
  },

  // Issue workflow commands
  'issue:discover': {
    name: 'issue:discover',
    input: ['codebase'],                        // 输入端口：代码库
    output: ['pending-issues'],                 // 输出端口：待处理 issues
    tags: ['issue'],
    atomic_group: 'issue-workflow'             // 最小单元：discover → plan → queue → execute
  },
  'issue:plan': {
    name: 'issue:plan',
    input: ['pending-issues'],                  // 输入端口：待处理 issues
    output: ['issue-plans'],                    // 输出端口：issue 计划
    tags: ['issue'],
    atomic_group: 'issue-workflow'
  },
  'issue:queue': {
    name: 'issue:queue',
    input: ['issue-plans', 'converted-plan'],   // 可接受 issue:plan 或 convert-to-plan 输出
    output: ['execution-queue'],                // 输出端口：执行队列
    tags: ['issue'],
    atomic_groups: ['issue-workflow', 'rapid-to-issue']
  },
  'issue:execute': {
    name: 'issue:execute',
    input: ['execution-queue'],                 // 输入端口：执行队列
    output: ['completed-issues'],               // 输出端口：已完成 issues
    tags: ['issue'],
    atomic_groups: ['issue-workflow', 'rapid-to-issue']
  },
  'issue:convert-to-plan': {
    name: 'issue:convert-to-plan',
    input: ['plan'],                            // 输入端口：lite-plan 输出
    output: ['converted-plan'],                 // 输出端口：转换后的 issue 计划
    tags: ['issue', 'planning'],
    atomic_group: 'rapid-to-issue'             // 最小单元：lite-plan → convert-to-plan → queue → execute
  },

  // With-File workflows (documented exploration with multi-CLI collaboration)
  'brainstorm-with-file': {
    name: 'brainstorm-with-file',
    input: ['exploration-topic'],               // 输入端口：探索主题
    output: ['brainstorm-document'],            // 输出端口：brainstorm.md + 综合结论
    tags: ['brainstorm', 'with-file'],
    note: 'Self-contained workflow with multi-round diverge-converge cycles'
  },
  'issue:from-brainstorm': {
    name: 'issue:from-brainstorm',
    input: ['brainstorm-document'],             // 输入端口：brainstorm 产物（synthesis.json）
    output: ['converted-plan'],                 // 输出端口：issue + solution
    tags: ['issue', 'brainstorm'],
    atomic_group: 'brainstorm-to-issue'        // 最小单元：from-brainstorm → queue → execute
  },
  'debug-with-file': {
    name: 'debug-with-file',
    input: ['bug-report'],                      // 输入端口：bug 报告
    output: ['understanding-document'],         // 输出端口：understanding.md + 修复
    tags: ['bugfix', 'with-file'],
    note: 'Self-contained workflow with hypothesis-driven iteration'
  },
  'analyze-with-file': {
    name: 'analyze-with-file',
    input: ['analysis-topic'],                  // 输入端口：分析主题
    output: ['discussion-document'],            // 输出端口：discussion.md + 结论
    tags: ['analysis', 'with-file'],
    note: 'Self-contained workflow with multi-round discussion'
  },

  // Collaborative planning workflows
  'collaborative-plan-with-file': {
    name: 'collaborative-plan-with-file',
    input: ['requirement'],                     // 输入端口：需求
    output: ['plan-note'],                      // 输出端口：plan-note.md
    tags: ['planning', 'with-file'],
    atomic_group: 'collaborative-plan',        // 最小单元：collaborative-plan → unified-execute
    note: 'Multi-agent collaborative planning with Plan Note shared doc'
  },
  'unified-execute-with-file': {
    name: 'unified-execute-with-file',
    input: ['plan-note', 'brainstorm-document', 'discussion-document'],  // 可接受多种规划输出
    output: ['code'],                           // 输出端口：代码
    tags: ['execution', 'with-file'],
    atomic_group: 'collaborative-plan'         // 最小单元：与 collaborative-plan-with-file 绑定
  },
  'req-plan-with-file': {
    name: 'req-plan-with-file',
    input: ['requirement'],                     // 输入端口：需求
    output: ['execution-plan'],                 // 输出端口：execution-plan.json + issues
    tags: ['planning', 'with-file'],
    atomic_group: 'requirement-plan',          // 最小单元：req-plan → team-planex
    note: 'Requirement decomposition with issue creation'
  },

  // Cycle workflows (self-iterating with reflection)
  'integration-test-cycle': {
    name: 'integration-test-cycle',
    input: ['requirement'],                     // 输入端口：需求/模块
    output: ['test-passed'],                    // 输出端口：测试通过
    tags: ['testing', 'cycle'],
    note: 'Self-contained: explore → test dev → test-fix cycle → reflection'
  },
  'refactor-cycle': {
    name: 'refactor-cycle',
    input: ['codebase'],                        // 输入端口：代码库
    output: ['refactored-code'],                // 输出端口：重构后代码
    tags: ['refactoring', 'cycle'],
    note: 'Self-contained: tech debt discovery → prioritize → execute → validate'
  },

  // Team workflows (multi-role collaboration, all self-contained)
  'team-planex': {
    name: 'team-planex',
    input: ['requirement'],
    output: ['code'],
    tags: ['team'],
    note: 'Self-contained: planner + executor wave pipeline'
  },
  'team-iterdev': {
    name: 'team-iterdev',
    input: ['requirement'],
    output: ['code'],
    tags: ['team'],
    note: 'Self-contained: planner → developer → reviewer iterative loop'
  },
  'team-lifecycle': {
    name: 'team-lifecycle',
    input: ['requirement'],
    output: ['code'],
    tags: ['team'],
    note: 'Self-contained: spec → impl → test full lifecycle'
  },
  'team-issue': {
    name: 'team-issue',
    input: ['pending-issues'],
    output: ['completed-issues'],
    tags: ['team', 'issue'],
    note: 'Self-contained: discover → plan → execute multi-role'
  },
  'team-testing': {
    name: 'team-testing',
    input: ['code'],
    output: ['test-passed'],
    tags: ['team', 'testing'],
    note: 'Self-contained: strategy → generate → execute → analyze'
  },
  'team-quality-assurance': {
    name: 'team-quality-assurance',
    input: ['code'],
    output: ['quality-report'],
    tags: ['team', 'testing'],
    note: 'Self-contained: scout → strategist → generator → executor → analyst'
  },
  'team-brainstorm': {
    name: 'team-brainstorm',
    input: ['exploration-topic'],
    output: ['brainstorm-analysis'],
    tags: ['team', 'brainstorm'],
    note: 'Self-contained: facilitator → participants → synthesizer'
  },
  'team-uidesign': {
    name: 'team-uidesign',
    input: ['requirement'],
    output: ['ui-code'],
    tags: ['team', 'ui'],
    note: 'Self-contained: designer → implementer dual-track'
  }
};
```

#### Recommendation Algorithm

```javascript
async function recommendCommandChain(analysis) {
  // Step 1: 根据任务类型确定起始端口和目标端口
  const { inputPort, outputPort } = determinePortFlow(analysis.task_type, analysis.constraints);

  // Step 2: Claude 根据命令端口定义和任务特征，智能选择命令序列
  // 优先级：简单任务 → lite-* 命令，复杂任务 → 完整命令，特殊约束 → 调整流程
  const chain = selectChainByPorts(inputPort, outputPort, analysis);

  return chain;
}

// 任务类型对应的端口流
function determinePortFlow(taskType, constraints) {
  const flows = {
    'bugfix':         { inputPort: 'bug-report', outputPort: constraints?.includes('skip-tests') ? 'fixed-code' : 'test-passed' },
    'tdd':            { inputPort: 'requirement', outputPort: 'tdd-verified' },
    'test-fix':       { inputPort: 'failing-tests', outputPort: 'test-passed' },
    'test-gen':       { inputPort: 'code', outputPort: 'test-passed' },
    'review':         { inputPort: 'code', outputPort: 'review-verified' },
    'brainstorm':     { inputPort: 'exploration-topic', outputPort: 'test-passed' },
    'multi-cli':      { inputPort: 'requirement', outputPort: 'test-passed' },
    // Issue workflow types
    'issue-batch':      { inputPort: 'codebase', outputPort: 'completed-issues' },
    'issue-transition': { inputPort: 'requirement', outputPort: 'completed-issues' },
    // With-File workflow types
    'brainstorm-file':    { inputPort: 'exploration-topic', outputPort: 'brainstorm-document' },
    'brainstorm-to-issue': { inputPort: 'brainstorm-document', outputPort: 'completed-issues' },
    'debug-file':         { inputPort: 'bug-report', outputPort: 'understanding-document' },
    'analyze-file':       { inputPort: 'analysis-topic', outputPort: 'discussion-document' },
    'collaborative-plan': { inputPort: 'requirement', outputPort: 'code' },
    'req-plan':           { inputPort: 'requirement', outputPort: 'code' },
    // Cycle workflow types
    'integration-test':   { inputPort: 'requirement', outputPort: 'test-passed' },
    'refactor':           { inputPort: 'codebase', outputPort: 'refactored-code' },
    // Team workflow types (all self-contained)
    'team-planex':        { inputPort: 'requirement', outputPort: 'code' },
    'team-iterdev':       { inputPort: 'requirement', outputPort: 'code' },
    'team-lifecycle':     { inputPort: 'requirement', outputPort: 'code' },
    'team-issue':         { inputPort: 'pending-issues', outputPort: 'completed-issues' },
    'team-testing':       { inputPort: 'code', outputPort: 'test-passed' },
    'team-qa':            { inputPort: 'code', outputPort: 'quality-report' },
    'team-brainstorm':    { inputPort: 'exploration-topic', outputPort: 'brainstorm-analysis' },
    'team-uidesign':      { inputPort: 'requirement', outputPort: 'ui-code' },
    'feature':            { inputPort: 'requirement', outputPort: constraints?.includes('skip-tests') ? 'code' : 'test-passed' }
  };
  return flows[taskType] || flows['feature'];
}

// Claude 根据端口流选择命令链
function selectChainByPorts(inputPort, outputPort, analysis) {
  // 参考下面的命令端口定义表和执行示例，Claude 智能选择合适的命令序列
  // 返回值示例: [lite-plan, lite-execute, test-cycle-execute]
}
```

#### Display to User

```
Recommended Command Chain:

Pipeline (管道视图):
需求 → lite-plan → 计划 → lite-execute → 代码 → test-cycle-execute → 测试通过

Commands (命令列表):
1. /workflow:lite-plan
2. /workflow:lite-execute
3. /workflow:test-cycle-execute

Proceed? [Confirm / Show Details / Adjust / Cancel]
```

### Phase 2b: Get User Confirmation

```javascript
async function getUserConfirmation(chain) {
  const response = await AskUserQuestion({
    questions: [{
      question: 'Proceed with this command chain?',
      header: 'Confirm',
      options: [
        { label: 'Confirm and execute', description: 'Proceed with commands' },
        { label: 'Show details', description: 'View each command' },
        { label: 'Adjust chain', description: 'Remove or reorder' },
        { label: 'Cancel', description: 'Abort' }
      ]
    }]
  });

  if (response.confirm === 'Cancel') throw new Error('Cancelled');
  if (response.confirm === 'Show details') {
    displayCommandDetails(chain);
    return getUserConfirmation(chain);
  }
  if (response.confirm === 'Adjust chain') {
    return await adjustChain(chain);
  }
  return chain;
}
```

### Phase 3: Execute Sequential Command Chain

```javascript
async function executeCommandChain(chain, analysis) {
  const sessionId = `ccw-coord-${Date.now()}`;
  const stateDir = `.workflow/.ccw-coordinator/${sessionId}`;
  Bash(`mkdir -p "${stateDir}"`);

  const state = {
    session_id: sessionId,
    status: 'running',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    analysis: analysis,
    command_chain: chain.map((cmd, idx) => ({ ...cmd, index: idx, status: 'pending' })),
    execution_results: [],
    prompts_used: []
  };

  // Save initial state immediately after confirmation
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  for (let i = 0; i < chain.length; i++) {
    const cmd = chain[i];
    console.log(`[${i+1}/${chain.length}] ${cmd.command}`);

    // Update command_chain status to running
    state.command_chain[i].status = 'running';
    state.updated_at = new Date().toISOString();
    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

    // Assemble prompt: Command first, then context
    let promptContent = formatCommand(cmd, state.execution_results, analysis);

    // Build full prompt: Command → Task → Previous Results
    let prompt = `${promptContent}\n\nTask: ${analysis.goal}`;
    if (state.execution_results.length > 0) {
      prompt += '\n\nPrevious results:\n';
      state.execution_results.forEach(r => {
        if (r.session_id) {
          prompt += `- ${r.command}: ${r.session_id} (${r.artifacts?.join(', ') || 'completed'})\n`;
        }
      });
    }

    // Record prompt used
    state.prompts_used.push({
      index: i,
      command: cmd.command,
      prompt: prompt
    });

    // Execute CLI command in background and stop
    // Format: ccw cli -p "PROMPT" --tool <tool> --mode <mode>
    // Note: -y is a command parameter INSIDE the prompt, not a ccw cli parameter
    // Example prompt: "/workflow:plan -y \"task description here\""
    try {
      const taskId = Bash(
        `ccw cli -p "${escapePrompt(prompt)}" --tool claude --mode write`,
        { run_in_background: true }
      ).task_id;

      // Save checkpoint
      state.execution_results.push({
        index: i,
        command: cmd.command,
        status: 'in-progress',
        task_id: taskId,
        session_id: null,
        artifacts: [],
        timestamp: new Date().toISOString()
      });
      state.command_chain[i].status = 'running';
      state.updated_at = new Date().toISOString();
      Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

      console.log(`[${i+1}/${chain.length}] ${cmd.command}\n`);
      break; // Stop, wait for hook callback

    } catch (error) {
      state.command_chain[i].status = 'failed';
      state.updated_at = new Date().toISOString();
      Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

      const action = await AskUserQuestion({
        questions: [{
          question: `${cmd.command} failed to start: ${error.message}. What to do?`,
          header: 'Error',
          options: [
            { label: 'Retry', description: 'Try again' },
            { label: 'Skip', description: 'Continue next command' },
            { label: 'Abort', description: 'Stop execution' }
          ]
        }]
      });

      if (action.error === 'Retry') {
        state.command_chain[i].status = 'pending';
        state.execution_results.pop();
        i--;
      } else if (action.error === 'Skip') {
        state.execution_results[state.execution_results.length - 1].status = 'skipped';
      } else if (action.error === 'Abort') {
        state.status = 'failed';
        break;
      }
    }

    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
  }

  // Hook callbacks handle completion
  if (state.status !== 'failed') state.status = 'waiting';
  state.updated_at = new Date().toISOString();
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  console.log(`\n📋 Orchestrator paused: ${state.session_id}\n`);
  return state;
}

// Smart parameter assembly
// Returns prompt content to be used with: ccw cli -p "RETURNED_VALUE" --tool claude --mode write
function formatCommand(cmd, previousResults, analysis) {
  // Format: /workflow:<command> -y <parameters>
  let prompt = `/workflow:${cmd.name} -y`;
  const name = cmd.name;

  // Planning commands - take task description
  if (['lite-plan', 'plan', 'tdd-plan', 'multi-cli-plan'].includes(name)) {
    prompt += ` "${analysis.goal}"`;

  // Lite execution - use --in-memory if plan exists
  } else if (name === 'lite-execute') {
    const hasPlan = previousResults.some(r => r.command.includes('plan'));
    prompt += hasPlan ? ' --in-memory' : ` "${analysis.goal}"`;

  // Standard execution - resume from planning session
  } else if (name === 'execute') {
    const plan = previousResults.find(r => r.command.includes('plan'));
    if (plan?.session_id) prompt += ` --resume-session="${plan.session_id}"`;

  // Bug fix commands - use lite-plan with bugfix flag (lite-fix removed)
  } else if (name === 'lite-plan' && analysis.task_type === 'bugfix') {
    prompt += ` --bugfix "${analysis.goal}"`;

  // Debug commands - take bug description
  } else if (name === 'debug') {
    prompt += ` "${analysis.goal}"`;

  // Brainstorm - take topic description (unified brainstorm skill)
  } else if (name === 'brainstorm') {
    prompt += ` "${analysis.goal}"`;
    prompt = `/brainstorm -y ${prompt.trim()}`;
  // Test generation from session - needs source session
  } else if (name === 'test-gen') {
    const impl = previousResults.find(r =>
      r.command.includes('execute') || r.command.includes('lite-execute')
    );
    if (impl?.session_id) prompt += ` "${impl.session_id}"`;
    else prompt += ` "${analysis.goal}"`;

  // Test fix generation - session or description
  } else if (name === 'test-fix-gen') {
    const latest = previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) prompt += ` "${latest.session_id}"`;
    else prompt += ` "${analysis.goal}"`;

  // Review commands - take session or use latest
  } else if (name === 'review') {
    const latest = previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) prompt += ` --session="${latest.session_id}"`;

  // Review fix - takes session from review
  } else if (name === 'review-cycle-fix') {
    const review = previousResults.find(r => r.command.includes('review'));
    const latest = review || previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) prompt += ` --session="${latest.session_id}"`;

  // TDD verify - takes execution session
  } else if (name === 'tdd-verify') {
    const exec = previousResults.find(r => r.command.includes('execute'));
    if (exec?.session_id) prompt += ` --session="${exec.session_id}"`;

  // Session-based commands (test-cycle, review-session, plan-verify)
  } else if (name.includes('test') || name.includes('review') || name.includes('verify')) {
    const latest = previousResults.filter(r => r.session_id).pop();
    if (latest?.session_id) prompt += ` --session="${latest.session_id}"`;

  // Issue workflow commands
  } else if (name === 'issue:discover') {
    // No parameters needed - discovers from codebase
    prompt = `/issue:discover -y`;

  } else if (name === 'issue:plan') {
    prompt = `/issue:plan -y --all-pending`;

  } else if (name === 'issue:queue') {
    prompt = `/issue:queue -y`;

  } else if (name === 'issue:execute') {
    prompt = `/issue:execute -y --queue auto`;

  } else if (name === 'issue:convert-to-plan' || name === 'convert-to-plan') {
    // Convert latest lite-plan to issue plan
    prompt = `/issue:convert-to-plan -y --latest-lite-plan`;

  // With-File workflows (self-contained)
  } else if (name === 'brainstorm-with-file') {
    prompt = `/workflow:brainstorm-with-file -y "${analysis.goal}"`;

  } else if (name === 'debug-with-file') {
    prompt = `/workflow:debug-with-file -y "${analysis.goal}"`;

  } else if (name === 'analyze-with-file') {
    prompt = `/workflow:analyze-with-file -y "${analysis.goal}"`;

  // Brainstorm-to-issue bridge
  } else if (name === 'issue:from-brainstorm' || name === 'from-brainstorm') {
    // Extract session ID from analysis.goal or latest brainstorm
    const sessionMatch = analysis.goal.match(/BS-[\w-]+/);
    if (sessionMatch) {
      prompt = `/issue:from-brainstorm -y SESSION="${sessionMatch[0]}" --auto`;
    } else {
      // Find latest brainstorm session
      prompt = `/issue:from-brainstorm -y --auto`;
    }

  // Collaborative planning workflows
  } else if (name === 'collaborative-plan-with-file') {
    prompt = `/workflow:collaborative-plan-with-file -y "${analysis.goal}"`;

  } else if (name === 'unified-execute-with-file') {
    prompt = `/workflow:unified-execute-with-file -y`;

  } else if (name === 'req-plan-with-file') {
    prompt = `/workflow:req-plan-with-file -y "${analysis.goal}"`;

  // Cycle workflows (self-contained)
  } else if (name === 'integration-test-cycle') {
    prompt = `/workflow:integration-test-cycle -y "${analysis.goal}"`;

  } else if (name === 'refactor-cycle') {
    prompt = `/workflow:refactor-cycle -y "${analysis.goal}"`;

  // Team workflows (all self-contained, use Skill name directly)
  } else if (['team-planex', 'team-iterdev', 'team-lifecycle', 'team-issue',
              'team-testing', 'team-quality-assurance', 'team-brainstorm', 'team-uidesign'].includes(name)) {
    prompt = `/${name} -y "${analysis.goal}"`;
  }

  return prompt;
}

// Hook callback: Called when background CLI completes
async function handleCliCompletion(sessionId, taskId, output) {
  const stateDir = `.workflow/.ccw-coordinator/${sessionId}`;
  const state = JSON.parse(Read(`${stateDir}/state.json`));

  const pendingIdx = state.execution_results.findIndex(r => r.task_id === taskId);
  if (pendingIdx === -1) {
    console.error(`Unknown task_id: ${taskId}`);
    return;
  }

  const parsed = parseOutput(output);
  const cmdIdx = state.execution_results[pendingIdx].index;

  // Update result
  state.execution_results[pendingIdx] = {
    ...state.execution_results[pendingIdx],
    status: parsed.sessionId ? 'completed' : 'failed',
    session_id: parsed.sessionId,
    artifacts: parsed.artifacts,
    completed_at: new Date().toISOString()
  };
  state.command_chain[cmdIdx].status = parsed.sessionId ? 'completed' : 'failed';
  state.updated_at = new Date().toISOString();
  Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));

  // Trigger next command or complete
  const nextIdx = cmdIdx + 1;
  if (nextIdx < state.command_chain.length) {
    await resumeChainExecution(sessionId, nextIdx);
  } else {
    state.status = 'completed';
    Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
    console.log(`✅ Completed: ${sessionId}\n`);
  }
}

// Parse command output
function parseOutput(output) {
  const sessionMatch = output.match(/WFS-[\w-]+/);
  const artifacts = [];
  output.matchAll(/\.workflow\/[^\s]+/g).forEach(m => artifacts.push(m[0]));
  return { sessionId: sessionMatch?.[0] || null, artifacts };
}
```

## State File Structure

**Location**: `.workflow/.ccw-coordinator/{session_id}/state.json`

```json
{
  "session_id": "ccw-coord-20250124-143025",
  "status": "running|waiting|completed|failed",
  "created_at": "2025-01-24T14:30:25Z",
  "updated_at": "2025-01-24T14:35:45Z",
  "analysis": {
    "goal": "Implement user registration",
    "scope": ["authentication", "user_management"],
    "constraints": ["no breaking changes"],
    "complexity": "medium"
  },
  "command_chain": [
    {
      "index": 0,
      "command": "/workflow:plan",
      "name": "plan",
      "description": "Detailed planning",
      "argumentHint": "[--explore] \"task\"",
      "status": "completed"
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "name": "execute",
      "description": "Execute with state resume",
      "argumentHint": "[--resume-session=\"WFS-xxx\"]",
      "status": "completed"
    },
    {
      "index": 2,
      "command": "/workflow:test-cycle-execute",
      "name": "test-cycle-execute",
      "status": "pending"
    }
  ],
  "execution_results": [
    {
      "index": 0,
      "command": "/workflow:plan",
      "status": "completed",
      "task_id": "task-001",
      "session_id": "WFS-plan-20250124",
      "artifacts": ["IMPL_PLAN.md", "exploration-architecture.json"],
      "timestamp": "2025-01-24T14:30:25Z",
      "completed_at": "2025-01-24T14:30:45Z"
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "status": "in-progress",
      "task_id": "task-002",
      "session_id": null,
      "artifacts": [],
      "timestamp": "2025-01-24T14:32:00Z",
      "completed_at": null
    }
  ],
  "prompts_used": [
    {
      "index": 0,
      "command": "/workflow:plan",
      "prompt": "/workflow:plan -y \"Implement user registration...\"\n\nTask: Implement user registration..."
    },
    {
      "index": 1,
      "command": "/workflow:execute",
      "prompt": "/workflow:execute -y --resume-session=\"WFS-plan-20250124\"\n\nTask: Implement user registration\n\nPrevious results:\n- /workflow:plan: WFS-plan-20250124 (IMPL_PLAN.md)"
    }
  ]
}
```

### Status Flow

```
running → waiting → [hook callback] → waiting → [hook callback] → completed
   ↓                                                                    ↑
failed ←────────────────────────────────────────────────────────────┘
```

**Status Values**:
- `running`: Orchestrator actively executing (launching CLI commands)
- `waiting`: Paused, waiting for hook callbacks to trigger continuation
- `completed`: All commands finished successfully
- `failed`: User aborted or unrecoverable error

### Field Descriptions

**execution_results[] fields**:
- `index`: Command position in chain (0-indexed)
- `command`: Full command string (e.g., `workflow-plan` skill)
- `status`: `in-progress` | `completed` | `skipped` | `failed`
- `task_id`: Background task identifier (from Bash tool)
- `session_id`: Workflow session ID (e.g., `WFS-*`) or null if failed
- `artifacts`: Generated files/directories
- `timestamp`: Command start time (ISO 8601)
- `completed_at`: Command completion time or null if pending

**command_chain[] status values**:
- `pending`: Not started yet
- `running`: Currently executing
- `completed`: Successfully finished
- `failed`: Failed to execute

## Skill & Command Discovery

workflow 操作通过 `Skill()` 调用对应的 Skill。

```javascript
// Skill 调用方式
Skill({ skill: 'workflow-lite-plan', args: '"task description"' });
Skill({ skill: 'workflow-execute', args: '--resume-session="WFS-xxx"' });
Skill({ skill: 'brainstorm', args: '"exploration topic"' });

// 独立命令调用方式
Skill({ skill: 'workflow:brainstorm-with-file', args: '"topic"' });
Skill({ skill: 'issue:discover', args: '' });
```

## Universal Prompt Template

### Standard Format

```bash
ccw cli -p "PROMPT_CONTENT" --tool <tool> --mode <mode>
```

### Prompt Content Template

```
/workflow:<command> -y <command_parameters>

Task: <task_description>

<optional_previous_results>
```

### Template Variables

| Variable | Description | Examples |
|----------|-------------|----------|
| `<command>` | Workflow command name | `plan`, `lite-execute`, `test-cycle-execute` |
| `-y` | Auto-confirm flag (inside prompt) | Always include for automation |
| `<command_parameters>` | Command-specific parameters | Task description, session ID, flags |
| `<task_description>` | Brief task description | "Implement user authentication", "Fix memory leak" |
| `<optional_previous_results>` | Context from previous commands | "Previous results:\n- /workflow:plan: WFS-xxx" |

### Command Parameter Patterns

| Command Type | Parameter Pattern | Example |
|--------------|------------------|---------|
| **Planning** | `"task description"` | `/workflow:plan -y "Implement OAuth2"` |
| **Execution (with plan)** | `--resume-session="WFS-xxx"` | `/workflow:execute -y --resume-session="WFS-plan-001"` |
| **Execution (standalone)** | `--in-memory` or `"task"` | `/workflow:lite-execute -y --in-memory` |
| **Session-based** | `--session="WFS-xxx"` | `/workflow:test-fix-gen -y --session="WFS-impl-001"` |
| **Fix/Debug** | `--bugfix "problem description"` | `/workflow:lite-plan -y --bugfix "Fix timeout bug"` |

### Complete Examples

**Planning Command**:
```bash
ccw cli -p '/workflow:plan -y "Implement user registration with email validation"

Task: Implement user registration' --tool claude --mode write
```

**Execution with Context**:
```bash
ccw cli -p '/workflow:execute -y --resume-session="WFS-plan-20250124"

Task: Implement user registration

Previous results:
- /workflow:plan: WFS-plan-20250124 (IMPL_PLAN.md)' --tool claude --mode write
```

**Standalone Lite Execution**:
```bash
ccw cli -p '/workflow:lite-plan -y --bugfix "Fix login timeout in auth module"

Task: Fix login timeout' --tool claude --mode write
```

## Execution Flow

```javascript
// Main entry point
async function ccwCoordinator(taskDescription) {
  // Phase 1
  const analysis = await analyzeRequirements(taskDescription);

  // Phase 2
  const chain = await recommendCommandChain(analysis);
  const confirmedChain = await getUserConfirmation(chain);

  // Phase 3
  const state = await executeCommandChain(confirmedChain, analysis);

  console.log(`✅ Complete! Session: ${state.session_id}`);
  console.log(`State: .workflow/.ccw-coordinator/${state.session_id}/state.json`);
}
```

## Key Design Principles

1. **No Fixed Logic** - Claude intelligently decides based on analysis
2. **Dynamic Discovery** - CommandRegistry retrieves available commands
3. **Smart Parameters** - Command args assembled based on previous results
4. **Full State Tracking** - All execution recorded to state.json
5. **User Control** - Confirmation + error handling with user choice
6. **Context Passing** - Each prompt includes previous results
7. **Resumable** - Can load state.json to continue
8. **Serial Blocking** - Commands execute one-by-one with hook-based continuation

## CLI Execution Model

### CLI Invocation Format

**IMPORTANT**: The `ccw cli` command executes prompts through external tools. The format is:

```bash
ccw cli -p "PROMPT_CONTENT" --tool <tool> --mode <mode>
```

**Parameters**:
- `-p "PROMPT_CONTENT"`: The prompt content to execute (required)
- `--tool <tool>`: CLI tool to use (e.g., `claude`, `gemini`, `qwen`)
- `--mode <mode>`: Execution mode (`analysis` or `write`)

**Note**: `-y` is a **command parameter inside the prompt**, NOT a `ccw cli` parameter.

### Prompt Assembly

The prompt content MUST start with the workflow command, followed by task context:

```
/workflow:<command> -y <parameters>

Task: <description>

<optional_context>
```

**Examples**:
```bash
# Planning command
ccw cli -p '/workflow:plan -y "Implement user registration feature"

Task: Implement user registration' --tool claude --mode write

# Execution command (with session reference)
ccw cli -p '/workflow:execute -y --resume-session="WFS-plan-20250124"

Task: Implement user registration

Previous results:
- /workflow:plan: WFS-plan-20250124' --tool claude --mode write

# Lite execution (in-memory from previous plan)
ccw cli -p '/workflow:lite-execute -y --in-memory

Task: Implement user registration' --tool claude --mode write
```

### Serial Blocking

**CRITICAL**: Commands execute one-by-one. After launching CLI in background:
1. Orchestrator stops immediately (`break`)
2. Wait for hook callback - **DO NOT use TaskOutput polling**
3. Hook callback triggers next command

**Prompt Structure**: Command must be first in prompt content

```javascript
// Example: Execute command and stop
const prompt = '/workflow:plan -y "Implement user authentication"\n\nTask: Implement user auth system';
const taskId = Bash(`ccw cli -p "${prompt}" --tool claude --mode write`, { run_in_background: true }).task_id;
state.execution_results.push({ status: 'in-progress', task_id: taskId, ... });
Write(`${stateDir}/state.json`, JSON.stringify(state, null, 2));
break; // ⚠️ STOP HERE - DO NOT use TaskOutput polling

// Hook callback will call handleCliCompletion(sessionId, taskId, output) when done
// → Updates state → Triggers next command via resumeChainExecution()
```


## Available Skills & Commands

### Skills

| Skill | 包含操作 |
|-------|---------|
| `workflow-lite-plan` | lite-plan, lite-execute |
| `workflow-plan` | plan, plan-verify, replan |
| `workflow-execute` | execute |
| `workflow-multi-cli-plan` | multi-cli-plan |
| `workflow-test-fix` | test-fix-gen, test-cycle-execute |
| `workflow-tdd` | tdd-plan, tdd-verify |
| `review-cycle` | review-session-cycle, review-module-cycle, review-cycle-fix |
| `brainstorm` | auto-parallel, artifacts, role-analysis, synthesis |
| `team-planex` | planner + executor wave pipeline |
| `team-iterdev` | planner → developer → reviewer 循环 |
| `team-lifecycle` | spec → impl → test 全流程 |
| `team-issue` | discover → plan → execute 多角色 |
| `team-testing` | strategy → generate → execute → analyze |
| `team-quality-assurance` | scout → strategist → generator → executor → analyst |
| `team-brainstorm` | facilitator → participants → synthesizer |
| `team-uidesign` | designer → implementer dual-track |

### Commands（命名空间 Skill）

**With-File Workflows**: workflow:brainstorm-with-file, workflow:debug-with-file, workflow:analyze-with-file, workflow:collaborative-plan-with-file, workflow:req-plan-with-file
**Cycle Workflows**: workflow:integration-test-cycle, workflow:refactor-cycle
**Execution**: workflow:unified-execute-with-file
**Design**: workflow:ui-design:*
**Session Management**: workflow:session:start, workflow:session:resume, workflow:session:complete, workflow:session:solidify, workflow:session:list
**Tools**: workflow:tools:context-gather, workflow:tools:test-context-gather, workflow:tools:task-generate-agent, workflow:tools:conflict-resolution
**Utility**: workflow:clean, workflow:init, workflow:init-guidelines
**Issue Workflow**: issue:discover, issue:plan, issue:queue, issue:execute, issue:convert-to-plan, issue:from-brainstorm, issue:new

### Testing Commands Distinction

| Command | Purpose | Output | Follow-up |
|---------|---------|--------|-----------|
| **test-gen** | 广泛测试示例生成并进行测试 | test-tasks (IMPL-001, IMPL-002) | Skill(workflow-execute) |
| **test-fix-gen** | 针对特定问题生成测试并在测试中修正 | test-tasks | Skill(workflow-test-fix) → test-cycle-execute |
| **test-cycle-execute** | 执行测试周期（迭代测试和修复） | test-passed | N/A (终点) |

**流程说明**:
- **test-gen → Skill(workflow-execute)**: 生成全面的测试套件，execute 执行生成和测试
- **test-fix-gen → test-cycle-execute**: 同属 Skill(workflow-test-fix)，针对特定问题生成修复任务并迭代测试和修复直到通过

### Task Type Routing (Pipeline Summary)

**Note**: `【 】` marks Minimum Execution Units (最小执行单元) - these commands must execute together.

| Task Type | Pipeline | Minimum Units |
|-----------|----------|---|
| **feature** (simple) | 需求 →【lite-plan → lite-execute】→ 代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 | Quick Implementation + Test Validation |
| **feature** (complex) | 需求 →【plan → plan-verify】→ validate → execute → 代码 → review → fix | Full Planning + Code Review + Testing |
| **bugfix** | Bug报告 → lite-plan (--bugfix) → 修复代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 | Bug Fix + Test Validation |
| **tdd** | 需求 → tdd-plan → TDD任务 → execute → 代码 → tdd-verify | TDD Planning + Execution |
| **test-fix** | 失败测试 →【test-fix-gen → test-cycle-execute】→ 测试通过 | Test Validation |
| **test-gen** | 代码/会话 →【test-gen → execute】→ 测试通过 | Test Generation + Execution |
| **review** | 代码 →【review-* → review-cycle-fix】→ 修复代码 →【test-fix-gen → test-cycle-execute】→ 测试通过 | Code Review + Testing |
| **brainstorm** | 探索主题 → brainstorm → 分析 →【plan → plan-verify】→ execute → test | Exploration + Planning + Execution |
| **multi-cli** | 需求 → multi-cli-plan → 对比分析 → lite-execute → test | Multi-Perspective + Testing |
| **issue-batch** | 代码库 →【discover → plan → queue → execute】→ 完成 issues | Issue Workflow |
| **issue-transition** | 需求 →【lite-plan → convert-to-plan → queue → execute】→ 完成 issues | Rapid-to-Issue |
| **brainstorm-file** | 主题 → brainstorm-with-file → brainstorm.md (自包含) | Brainstorm With File |
| **brainstorm-to-issue** | brainstorm.md →【from-brainstorm → queue → execute】→ 完成 issues | Brainstorm to Issue |
| **debug-file** | Bug报告 → debug-with-file → understanding.md (自包含) | Debug With File |
| **analyze-file** | 分析主题 → analyze-with-file → discussion.md (自包含) | Analyze With File |
| **collaborative-plan** | 需求 →【collaborative-plan-with-file → unified-execute-with-file】→ 代码 | Collaborative Plan |
| **req-plan** | 需求 →【req-plan-with-file → team-planex】→ 代码 | Requirement Plan |
| **multi-cli** | 需求 → multi-cli-plan → 对比分析 → lite-execute → test | Multi-CLI Planning |
| **integration-test** | 需求/模块 → integration-test-cycle → 测试通过 (自包含) | Integration Test Cycle |
| **refactor** | 代码库 → refactor-cycle → 重构后代码 (自包含) | Refactor Cycle |
| **team-planex** | 需求 → team-planex → 代码 (自包含) | Team Plan+Execute |
| **team-iterdev** | 需求 → team-iterdev → 代码 (自包含) | Team Iterative Dev |
| **team-lifecycle** | 需求 → team-lifecycle → 代码 (自包含) | Team Lifecycle |
| **team-issue** | issues → team-issue → 完成 issues (自包含) | Team Issue |
| **team-testing** | 代码 → team-testing → 测试通过 (自包含) | Team Testing |
| **team-qa** | 代码 → team-quality-assurance → 质量报告 (自包含) | Team QA |
| **team-brainstorm** | 主题 → team-brainstorm → 分析 (自包含) | Team Brainstorm |
| **team-uidesign** | 需求 → team-uidesign → UI代码 (自包含) | Team UI Design |

Refer to the Skill 映射 section above for available Skills and Commands.
