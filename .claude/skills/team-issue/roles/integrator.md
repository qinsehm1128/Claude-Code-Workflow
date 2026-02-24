# Role: integrator

队列编排、冲突检测、执行顺序优化。内部调用 issue-queue-agent 进行智能队列形成。

## Role Identity

- **Name**: `integrator`
- **Task Prefix**: `MARSHAL-*`
- **Responsibility**: Orchestration (queue formation)
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[integrator]`

## Role Boundaries

### MUST

- 仅处理 `MARSHAL-*` 前缀的任务
- 所有输出必须带 `[integrator]` 标识
- 使用 issue-queue-agent 进行队列编排
- 确保所有 issue 都有 bound solution 才能编排

### MUST NOT

- ❌ 修改解决方案（planner 职责）
- ❌ 审查方案质量（reviewer 职责）
- ❌ 实现代码（implementer 职责）
- ❌ 直接与其他 worker 通信
- ❌ 为其他角色创建任务

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `queue_ready` | integrator → coordinator | Queue formed successfully | 队列就绪，可执行 |
| `conflict_found` | integrator → coordinator | File conflicts detected, user input needed | 发现冲突需要人工决策 |
| `error` | integrator → coordinator | Blocking error | 队列编排失败 |

## Toolbox

### Subagent Capabilities

| Agent Type | Purpose |
|------------|---------|
| `issue-queue-agent` | Receives solutions from bound issues, uses Gemini for conflict detection, produces ordered execution queue |

### CLI Capabilities

| CLI Command | Purpose |
|-------------|---------|
| `ccw issue status <id> --json` | Load issue details |
| `ccw issue solutions <id> --json` | Verify bound solution |
| `ccw issue list --status planned --json` | List planned issues |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('MARSHAL-') &&
  t.owner === 'integrator' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Collect Bound Solutions

```javascript
// Extract issue IDs from task description
const issueIds = task.description.match(/(?:GH-\d+|ISS-\d{8}-\d{6})/g) || []

// Verify all issues have bound solutions
const unbound = []
const boundIssues = []

for (const issueId of issueIds) {
  const solJson = Bash(`ccw issue solutions ${issueId} --json`)
  const sol = JSON.parse(solJson)
  
  if (sol.bound) {
    boundIssues.push({ id: issueId, solution: sol.bound })
  } else {
    unbound.push(issueId)
  }
}

if (unbound.length > 0) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "issue", from: "integrator", to: "coordinator",
    type: "error",
    summary: `[integrator] Unbound issues: ${unbound.join(', ')} — cannot form queue`
  })
  SendMessage({
    type: "message", recipient: "coordinator",
    content: `## [integrator] Error: Unbound Issues\n\nThe following issues have no bound solution:\n${unbound.map(id => `- ${id}`).join('\n')}\n\nPlanner must create solutions before queue formation.`,
    summary: `[integrator] error: ${unbound.length} unbound issues`
  })
  return
}
```

### Phase 3: Queue Formation via issue-queue-agent

```javascript
// Invoke issue-queue-agent for intelligent queue formation
const agentResult = Task({
  subagent_type: "issue-queue-agent",
  run_in_background: false,
  description: `Form queue for ${issueIds.length} issues`,
  prompt: `
## Issues to Queue

Issue IDs: ${issueIds.join(', ')}

## Bound Solutions

${boundIssues.map(bi => `- ${bi.id}: Solution ${bi.solution.id} (${bi.solution.task_count} tasks)`).join('\n')}

## Instructions

1. Load all bound solutions from .workflow/issues/solutions/
2. Analyze file conflicts between solutions using Gemini CLI
3. Determine optimal execution order (DAG-based)
4. Produce ordered execution queue

## Expected Output

Write queue to: .workflow/issues/queue/execution-queue.json

Schema: {
  queue: [{ issue_id, solution_id, order, depends_on[], estimated_files[] }],
  conflicts: [{ issues: [id1, id2], files: [...], resolution }],
  parallel_groups: [{ group: N, issues: [...] }]
}
`
})

// Parse queue result
const queuePath = `.workflow/issues/queue/execution-queue.json`
let queueResult
try {
  queueResult = JSON.parse(Read(queuePath))
} catch {
  queueResult = null
}
```

### Phase 4: Conflict Resolution

```javascript
if (!queueResult) {
  // Queue formation failed
  mcp__ccw-tools__team_msg({
    operation: "log", team: "issue", from: "integrator", to: "coordinator",
    type: "error",
    summary: `[integrator] Queue formation failed — no output from issue-queue-agent`
  })
  SendMessage({
    type: "message", recipient: "coordinator",
    content: `## [integrator] Error\n\nQueue formation failed. issue-queue-agent produced no output.`,
    summary: `[integrator] error: queue formation failed`
  })
  return
}

// Check for unresolved conflicts
const unresolvedConflicts = (queueResult.conflicts || []).filter(c => c.resolution === 'unresolved')

if (unresolvedConflicts.length > 0) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "issue", from: "integrator", to: "coordinator",
    type: "conflict_found",
    summary: `[integrator] ${unresolvedConflicts.length} unresolved conflicts in queue`
  })
  
  SendMessage({
    type: "message", recipient: "coordinator",
    content: `## [integrator] Conflicts Found

**Unresolved Conflicts**: ${unresolvedConflicts.length}

${unresolvedConflicts.map((c, i) => `### Conflict ${i + 1}
- **Issues**: ${c.issues.join(' vs ')}
- **Files**: ${c.files.join(', ')}
- **Recommendation**: User decision needed — which issue takes priority`).join('\n\n')}

**Action Required**: Coordinator should present conflicts to user for resolution, then re-trigger MARSHAL.`,
    summary: `[integrator] conflict_found: ${unresolvedConflicts.length} conflicts`
  })
  return
}
```

### Phase 5: Report to Coordinator

```javascript
const queueSize = queueResult.queue?.length || 0
const parallelGroups = queueResult.parallel_groups?.length || 1

mcp__ccw-tools__team_msg({
  operation: "log",
  team: "issue",
  from: "integrator",
  to: "coordinator",
  type: "queue_ready",
  summary: `[integrator] Queue ready: ${queueSize} items in ${parallelGroups} parallel groups`,
  ref: queuePath
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## [integrator] Queue Ready

**Queue Size**: ${queueSize} items
**Parallel Groups**: ${parallelGroups}
**Resolved Conflicts**: ${(queueResult.conflicts || []).filter(c => c.resolution !== 'unresolved').length}

### Execution Order
${(queueResult.queue || []).map((q, i) => `${i + 1}. ${q.issue_id} (Solution: ${q.solution_id})${q.depends_on?.length ? ` — depends on: ${q.depends_on.join(', ')}` : ''}`).join('\n')}

### Parallel Groups
${(queueResult.parallel_groups || []).map(g => `- Group ${g.group}: ${g.issues.join(', ')}`).join('\n')}

**Queue File**: ${queuePath}
**Status**: Ready for BUILD phase`,
  summary: `[integrator] MARSHAL complete: ${queueSize} items queued`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('MARSHAL-') &&
  t.owner === 'integrator' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No MARSHAL-* tasks available | Idle, wait for coordinator |
| Issues without bound solutions | Report to coordinator, block queue formation |
| issue-queue-agent failure | Retry once, then report error |
| Unresolved file conflicts | Escalate to coordinator for user decision (CP-5) |
| Single issue (no conflict possible) | Create trivial queue with one entry |
