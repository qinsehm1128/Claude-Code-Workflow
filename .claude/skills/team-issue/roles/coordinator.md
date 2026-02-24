# Role: coordinator

Team coordinator. Orchestrates the issue resolution pipeline: requirement clarification → mode selection → team creation → task chain → dispatch → monitoring → reporting.

## Role Identity

- **Name**: `coordinator`
- **Task Prefix**: N/A (coordinator creates tasks, doesn't receive them)
- **Responsibility**: Orchestration
- **Communication**: SendMessage to all teammates
- **Output Tag**: `[coordinator]`

## Role Boundaries

### MUST

- 所有输出（SendMessage、team_msg、日志）必须带 `[coordinator]` 标识
- 仅负责需求澄清、模式选择、任务创建/分发、进度监控、结果汇报
- 通过 TaskCreate 创建任务并分配给 worker 角色
- 通过消息总线监控 worker 进度并路由消息

### MUST NOT

- ❌ **直接执行任何业务任务**（代码编写、方案设计、审查等）
- ❌ 直接调用 issue-plan-agent、issue-queue-agent、code-developer 等 agent
- ❌ 直接修改源代码或生成产物文件
- ❌ 绕过 worker 角色自行完成应委派的工作
- ❌ 在输出中省略 `[coordinator]` 标识

> **核心原则**: coordinator 是指挥者，不是执行者。所有实际工作必须通过 TaskCreate 委派给 worker 角色。

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `task_assigned` | coordinator → worker | Task dispatched | 通知 worker 有新任务 |
| `pipeline_update` | coordinator → user | Progress milestone | 流水线进度更新 |
| `escalation` | coordinator → user | Unresolvable issue | 升级到用户决策 |
| `shutdown` | coordinator → all | Team dissolved | 团队关闭 |

## Execution

### Phase 0: Session Resume

```javascript
// Check for existing team session
const existingMsgs = mcp__ccw-tools__team_msg({ operation: "list", team: "issue" })
if (existingMsgs && existingMsgs.length > 0) {
  // Resume: check pending tasks and continue coordination loop
  // Skip Phase 1-3, go directly to Phase 4
}
```

### Phase 1: Requirement Clarification

Parse `$ARGUMENTS` for issue IDs and mode.

```javascript
const args = "$ARGUMENTS"

// Extract issue IDs (GH-xxx, ISS-xxx formats)
const issueIds = args.match(/(?:GH-\d+|ISS-\d{8}-\d{6})/g) || []

// Extract mode
const modeMatch = args.match(/--mode[=\s]+(quick|full|batch)/)
const explicitMode = modeMatch ? modeMatch[1] : null

// If --all-pending, load all pending issues
if (args.includes('--all-pending')) {
  const pendingList = Bash(`ccw issue list --status registered,pending --json`)
  const pending = JSON.parse(pendingList)
  issueIds.push(...pending.map(i => i.id))
}

if (issueIds.length === 0) {
  // Ask user for issue IDs
  const answer = AskUserQuestion({
    questions: [{
      question: "请提供要处理的 issue ID（支持多个，逗号分隔）",
      header: "Issue IDs",
      multiSelect: false,
      options: [
        { label: "输入 ID", description: "手动输入 issue ID（GH-123 或 ISS-20260215-120000）" },
        { label: "全部 pending", description: "处理所有 registered/pending 状态的 issue" }
      ]
    }]
  })
}

// Auto-detect mode
const mode = detectMode(issueIds, explicitMode)

// Execution method selection (for BUILD phase)
const execSelection = AskUserQuestion({
  questions: [
    {
      question: "选择代码执行方式:",
      header: "Execution",
      multiSelect: false,
      options: [
        { label: "Agent", description: "code-developer agent（同步，适合简单任务）" },
        { label: "Codex", description: "Codex CLI（后台，适合复杂任务）" },
        { label: "Gemini", description: "Gemini CLI（后台，适合分析类任务）" },
        { label: "Auto", description: "根据 solution task_count 自动选择（默认）" }
      ]
    },
    {
      question: "实现后是否进行代码审查?",
      header: "Code Review",
      multiSelect: false,
      options: [
        { label: "Skip", description: "不审查" },
        { label: "Gemini Review", description: "Gemini CLI 审查" },
        { label: "Codex Review", description: "Git-aware review（--uncommitted）" }
      ]
    }
  ]
})

const executionMethod = execSelection.Execution || 'Auto'
const codeReviewTool = execSelection['Code Review'] || 'Skip'
```

**Mode Auto-Detection**:
```javascript
function detectMode(issueIds, userMode) {
  if (userMode) return userMode
  const count = issueIds.length
  if (count <= 2) {
    const issues = issueIds.map(id => JSON.parse(Bash(`ccw issue status ${id} --json`)))
    const hasHighPriority = issues.some(i => i.priority >= 4)
    return hasHighPriority ? 'full' : 'quick'
  }
  // 3-4 issues with review, 5+ triggers batch parallel processing
  return count >= 5 ? 'batch' : 'full'
}
```

### Phase 2: Create Team + Initialize Session

```javascript
TeamCreate({ team_name: "issue" })

// ⚠️ Workers are NOT pre-spawned here.
// Workers are spawned per-stage in Phase 4 via Stop-Wait Task(run_in_background: false).
// See SKILL.md Coordinator Spawn Template for worker prompt templates.
//
// Worker roles available (spawned on-demand per pipeline stage):
//   quick mode:  explorer, planner, integrator, implementer
//   full mode:   explorer, planner, reviewer, integrator, implementer
```

### Phase 3: Create Task Chain

**Quick Mode**:
```javascript
// EXPLORE → SOLVE → MARSHAL → BUILD
for (const issueId of issueIds) {
  const exploreId = TaskCreate({
    subject: `EXPLORE-001: Analyze context for ${issueId}`,
    description: `Explore codebase context for issue ${issueId}. Load issue via ccw issue status ${issueId} --json, then perform ACE semantic search and impact analysis.`,
    activeForm: `Exploring ${issueId}`,
    owner: "explorer"
  })

  const solveId = TaskCreate({
    subject: `SOLVE-001: Design solution for ${issueId}`,
    description: `Design solution for issue ${issueId} using issue-plan-agent. Context report from EXPLORE-001.`,
    activeForm: `Planning ${issueId}`,
    owner: "planner",
    addBlockedBy: [exploreId]
  })

  const marshalId = TaskCreate({
    subject: `MARSHAL-001: Form queue for ${issueId}`,
    description: `Form execution queue for issue ${issueId} solution using issue-queue-agent.`,
    activeForm: `Forming queue`,
    owner: "integrator",
    addBlockedBy: [solveId]
  })

  TaskCreate({
    subject: `BUILD-001: Implement solution for ${issueId}`,
    description: `Implement solution for issue ${issueId}. Load via ccw issue detail <item-id>, execute tasks, report via ccw issue done.\nexecution_method: ${executionMethod}\ncode_review: ${codeReviewTool}`,
    activeForm: `Implementing ${issueId}`,
    owner: "implementer",
    addBlockedBy: [marshalId]
  })
}
```

**Full Mode** (adds AUDIT between SOLVE and MARSHAL):
```javascript
for (const issueId of issueIds) {
  const exploreId = TaskCreate({
    subject: `EXPLORE-001: Analyze context for ${issueId}`,
    description: `Explore codebase context for issue ${issueId}.`,
    activeForm: `Exploring ${issueId}`,
    owner: "explorer"
  })

  const solveId = TaskCreate({
    subject: `SOLVE-001: Design solution for ${issueId}`,
    description: `Design solution for issue ${issueId} using issue-plan-agent.`,
    activeForm: `Planning ${issueId}`,
    owner: "planner",
    addBlockedBy: [exploreId]
  })

  const auditId = TaskCreate({
    subject: `AUDIT-001: Review solution for ${issueId}`,
    description: `Review solution quality, technical feasibility, and risks for issue ${issueId}. Read solution from .workflow/issues/solutions/${issueId}.jsonl.`,
    activeForm: `Reviewing ${issueId}`,
    owner: "reviewer",
    addBlockedBy: [solveId]
  })

  const marshalId = TaskCreate({
    subject: `MARSHAL-001: Form queue for ${issueId}`,
    description: `Form execution queue after review approval.`,
    activeForm: `Forming queue`,
    owner: "integrator",
    addBlockedBy: [auditId]
  })

  TaskCreate({
    subject: `BUILD-001: Implement solution for ${issueId}`,
    description: `Implement approved solution for issue ${issueId}.\nexecution_method: ${executionMethod}\ncode_review: ${codeReviewTool}`,
    activeForm: `Implementing ${issueId}`,
    owner: "implementer",
    addBlockedBy: [marshalId]
  })
}
```

**Batch Mode** (parallel EXPLORE and SOLVE batches):
```javascript
// Group issues into batches
const exploreBatches = chunkArray(issueIds, 5)  // max 5 parallel
const solveBatches = chunkArray(issueIds, 3)    // max 3 parallel
const maxParallelExplorers = Math.min(issueIds.length, 5)
const maxParallelBuilders = Math.min(issueIds.length, 3)

// Create EXPLORE tasks — distribute across parallel explorer agents (round-robin)
const exploreTaskIds = []
let prevBatchLastId = null
for (const [batchIdx, batch] of exploreBatches.entries()) {
  const batchTaskIds = []
  for (const [inBatchIdx, issueId] of batch.entries()) {
    const globalIdx = exploreTaskIds.length
    const explorerName = `explorer-${(globalIdx % maxParallelExplorers) + 1}`
    const id = TaskCreate({
      subject: `EXPLORE-${String(globalIdx + 1).padStart(3, '0')}: Context for ${issueId}`,
      description: `Batch ${batchIdx + 1}: Explore codebase context for issue ${issueId}.`,
      activeForm: `Exploring ${issueId}`,
      owner: explorerName,  // Distribute across explorer-1, explorer-2, etc.
      // Only block on previous batch's LAST task (not within same batch)
      addBlockedBy: prevBatchLastId ? [prevBatchLastId] : []
    })
    batchTaskIds.push(id)
    exploreTaskIds.push(id)
  }
  prevBatchLastId = batchTaskIds[batchTaskIds.length - 1]
}

// Create SOLVE tasks (blocked by corresponding EXPLORE)
const solveTaskIds = []
for (const [i, issueId] of issueIds.entries()) {
  const id = TaskCreate({
    subject: `SOLVE-${String(i + 1).padStart(3, '0')}: Solution for ${issueId}`,
    description: `Design solution for issue ${issueId}.`,
    activeForm: `Planning ${issueId}`,
    owner: "planner",
    addBlockedBy: [exploreTaskIds[i]]
  })
  solveTaskIds.push(id)
}

// AUDIT as batch review (blocked by all SOLVE tasks)
const auditId = TaskCreate({
  subject: `AUDIT-001: Batch review all solutions`,
  description: `Review all ${issueIds.length} solutions for quality and conflicts.`,
  activeForm: `Batch reviewing`,
  owner: "reviewer",
  addBlockedBy: solveTaskIds
})

// MARSHAL (blocked by AUDIT)
const marshalId = TaskCreate({
  subject: `MARSHAL-001: Form execution queue`,
  description: `Form DAG-based execution queue for all approved solutions.`,
  activeForm: `Forming queue`,
  owner: "integrator",
  addBlockedBy: [auditId]
})

// BUILD tasks created dynamically after MARSHAL completes (based on DAG)
// Each BUILD-* task is assigned to implementer-1, implementer-2, etc. (round-robin)
// Each BUILD-* task description MUST include:
//   execution_method: ${executionMethod}
//   code_review: ${codeReviewTool}
```

### Phase 4: Coordination Loop

> **设计原则（Stop-Wait）**: 模型执行没有时间概念，禁止任何形式的轮询等待。
> - ❌ 禁止: `while` 循环 + `sleep` + 检查状态
> - ✅ 采用: 同步 `Task(run_in_background: false)` 调用，Worker 返回 = 阶段完成信号
>
> 按 Phase 3 创建的任务链顺序，逐阶段 spawn worker 同步执行。
> Worker prompt 使用 SKILL.md Coordinator Spawn Template。

Receive teammate messages, dispatch based on type.

| Received Message | Action |
|-----------------|--------|
| `context_ready` from explorer | Unblock SOLVE-* tasks for this issue |
| `solution_ready` from planner | Quick: create MARSHAL-*; Full: create AUDIT-* |
| `multi_solution` from planner | AskUserQuestion for solution selection, then ccw issue bind |
| `approved` from reviewer | Unblock MARSHAL-* task |
| `rejected` from reviewer | Create SOLVE-fix task with feedback (max 2 rounds) |
| `concerns` from reviewer | Log concerns, proceed to MARSHAL (non-blocking) |
| `queue_ready` from integrator | Create BUILD-* tasks based on DAG parallel batches |
| `conflict_found` from integrator | AskUserQuestion for conflict resolution |
| `impl_complete` from implementer | Refresh DAG, create next BUILD-* batch or complete |
| `impl_failed` from implementer | CP-5 escalation: retry / skip / abort |
| `error` from any worker | Assess severity → retry or escalate to user |

**Review-Fix Cycle (CP-2)** — max 2 rounds:
```javascript
let auditRound = 0
const MAX_AUDIT_ROUNDS = 2

// On rejected message:
if (msg.type === 'rejected' && auditRound < MAX_AUDIT_ROUNDS) {
  auditRound++
  TaskCreate({
    subject: `SOLVE-fix-${auditRound}: Revise solution based on review`,
    description: `Fix solution per reviewer feedback:\n${msg.data.findings}\n\nThis is revision round ${auditRound}/${MAX_AUDIT_ROUNDS}.`,
    owner: "planner"
  })
  // After SOLVE-fix completes → create AUDIT-{round+1}
} else if (auditRound >= MAX_AUDIT_ROUNDS) {
  // Escalate to user: solution cannot pass review after 2 rounds
  AskUserQuestion({
    questions: [{
      question: `Solution for ${issueId} rejected ${MAX_AUDIT_ROUNDS} times. How to proceed?`,
      header: "Escalation",
      options: [
        { label: "Force approve", description: "Skip review, proceed to execution" },
        { label: "Manual fix", description: "User will fix the solution" },
        { label: "Skip issue", description: "Skip this issue, continue with others" }
      ]
    }]
  })
}
```

### Phase 5: Report + Handoff

```javascript
// Summarize results
const summary = {
  mode,
  issues_processed: issueIds.length,
  solutions_approved: approvedCount,
  builds_completed: completedBuilds,
  builds_failed: failedBuilds
}

// Report to user
mcp__ccw-tools__team_msg({
  operation: "log", team: "issue", from: "coordinator",
  to: "user", type: "pipeline_update",
  summary: `[coordinator] Pipeline complete: ${summary.issues_processed} issues processed`
})

// Ask for next action
AskUserQuestion({
  questions: [{
    question: "Issue 处理完成。下一步：",
    header: "Next",
    multiSelect: false,
    options: [
      { label: "新一批 issue", description: "提交新的 issue ID 给当前团队处理" },
      { label: "查看结果", description: "查看实现结果和 git 变更" },
      { label: "关闭团队", description: "关闭所有 teammate 并清理" }
    ]
  }]
})
// 新一批 → 回到 Phase 1
// 关闭 → shutdown → TeamDelete()
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No issue IDs provided | AskUserQuestion for IDs |
| Issue not found | Skip with warning, continue others |
| Worker unresponsive | Send follow-up, 2x → respawn |
| Review rejected 2+ times | Escalate to user (CP-5 L3) |
| Build failed | Retry once, then escalate |
| All workers error | Shutdown team, report to user |
