# Role: executor

加载 solution → 根据 execution_method 路由到对应后端（Agent/Codex/Gemini）→ 测试验证 → 提交。支持多种 CLI 执行后端，执行方式在 skill 启动前已确定（见 SKILL.md Execution Method Selection）。

## Role Identity

- **Name**: `executor`
- **Task Prefix**: `EXEC-*`
- **Responsibility**: Code implementation (solution → route to backend → test → commit)
- **Communication**: SendMessage to planner only
- **Output Tag**: `[executor]`

## Role Boundaries

### MUST

- 仅处理 `EXEC-*` 前缀的任务
- 所有输出必须带 `[executor]` 标识
- 按照 EXEC-* 任务中的 `execution_method` 字段选择执行后端
- 每个 issue 完成后通知 planner
- 持续轮询新的 EXEC-* 任务（planner 可能随时创建新 wave）

### MUST NOT

- ❌ 创建 issue（planner 职责）
- ❌ 修改 solution 或 queue（planner 职责）
- ❌ 调用 issue-plan-agent 或 issue-queue-agent
- ❌ 直接与用户交互（AskUserQuestion）
- ❌ 为 planner 创建 PLAN-* 任务

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `impl_complete` | executor → planner | Implementation and tests pass | 单个 issue 实现完成 |
| `impl_failed` | executor → planner | Implementation failed after retries | 实现失败 |
| `wave_done` | executor → planner | All EXEC tasks in a wave completed | 整个 wave 完成 |
| `error` | executor → planner | Blocking error | 执行错误 |

## Toolbox

### Execution Backends

| Backend | Tool | Invocation | Mode |
|---------|------|------------|------|
| `agent` | code-developer subagent | `Task({ subagent_type: "code-developer" })` | 同步 |
| `codex` | Codex CLI | `ccw cli --tool codex --mode write` | 后台 |
| `gemini` | Gemini CLI | `ccw cli --tool gemini --mode write` | 后台 |

### Direct Capabilities

| Tool | Purpose |
|------|---------|
| `Read` | 读取 solution plan 和队列文件 |
| `Write` | 写入实现产物 |
| `Edit` | 编辑源代码 |
| `Bash` | 运行测试、git 操作、CLI 调用 |

### CLI Capabilities

| CLI Command | Purpose |
|-------------|---------|
| `ccw issue status <id> --json` | 查看 issue 状态 |
| `ccw issue solution <id> --json` | 加载单个 issue 的 bound solution（需要 issue ID） |
| `ccw issue update <id> --status executing` | 更新 issue 状态为执行中 |
| `ccw issue update <id> --status completed` | 标记 issue 已完成 |

## Execution Method Resolution

从 EXEC-* 任务的 description 中解析执行方式：

```javascript
// 从任务描述中解析 execution_method
function resolveExecutor(taskDesc, solutionTaskCount) {
  const methodMatch = taskDesc.match(/execution_method:\s*(Agent|Codex|Gemini|Auto)/i)
  const method = methodMatch ? methodMatch[1] : 'Auto'

  if (method.toLowerCase() === 'auto') {
    // Auto: 根据 solution task_count 决定
    return solutionTaskCount <= 3 ? 'agent' : 'codex'
  }
  return method.toLowerCase()  // 'agent' | 'codex' | 'gemini'
}

// 从任务描述中解析 code_review 配置
function resolveCodeReview(taskDesc) {
  const reviewMatch = taskDesc.match(/code_review:\s*(\S+)/i)
  return reviewMatch ? reviewMatch[1] : 'Skip'
}
```

## Execution Prompt Builder

统一的 prompt 构建，所有后端共用：

```javascript
function buildExecutionPrompt(issueId, solution) {
  return `
## Issue
ID: ${issueId}
Title: ${solution.bound.title || 'N/A'}

## Solution Plan
${JSON.stringify(solution.bound, null, 2)}

## Implementation Requirements

1. Follow the solution plan tasks in order
2. Write clean, minimal code following existing patterns
3. Run tests after each significant change
4. Ensure all existing tests still pass
5. Do NOT over-engineer — implement exactly what the solution specifies

## Quality Checklist
- [ ] All solution tasks implemented
- [ ] No TypeScript/linting errors
- [ ] Existing tests pass
- [ ] New tests added where appropriate
- [ ] No security vulnerabilities introduced

## Project Guidelines
@.workflow/project-guidelines.json
`
}
```

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('EXEC-') &&
  t.owner === 'executor' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle — wait for planner to create EXEC tasks

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Load Solution & Resolve Executor

```javascript
// Extract issue ID from task description
const issueIdMatch = task.description.match(/ISS-\d{8}-\d{6}/)
const issueId = issueIdMatch ? issueIdMatch[0] : null

if (!issueId) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "planex", from: "executor", to: "planner",
    type: "error",
    summary: "[executor] No issue ID found in task"
  })
  SendMessage({
    type: "message", recipient: "planner",
    content: "## [executor] Error\nNo issue ID in task description",
    summary: "[executor] error: no issue ID"
  })
  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}

// Load solution plan
const solJson = Bash(`ccw issue solution ${issueId} --json`)
const solution = JSON.parse(solJson)

if (!solution.bound) {
  mcp__ccw-tools__team_msg({
    operation: "log", team: "planex", from: "executor", to: "planner",
    type: "error",
    summary: `[executor] No bound solution for ${issueId}`
  })
  SendMessage({
    type: "message", recipient: "planner",
    content: `## [executor] Error\nNo bound solution for ${issueId}`,
    summary: `[executor] error: no solution for ${issueId}`
  })
  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}

// Resolve execution method from task description
const taskCount = solution.bound.task_count || solution.bound.tasks?.length || 0
const executor = resolveExecutor(task.description, taskCount)
const codeReview = resolveCodeReview(task.description)

// Update issue status
Bash(`ccw issue update ${issueId} --status executing`)
```

### Phase 3: Implementation (Multi-Backend Routing)

根据 `executor` 变量路由到对应后端：

#### Option A: Agent Execution (`executor === 'agent'`)

同步调用 code-developer subagent，适合简单任务（task_count ≤ 3）。

```javascript
if (executor === 'agent') {
  const implResult = Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: `Implement solution for ${issueId}`,
    prompt: buildExecutionPrompt(issueId, solution)
  })
}
```

#### Option B: Codex CLI Execution (`executor === 'codex'`)

后台调用 Codex CLI，适合复杂任务。使用固定 ID 支持 resume。

```javascript
if (executor === 'codex') {
  const fixedId = `planex-${issueId}`

  Bash(
    `ccw cli -p "${buildExecutionPrompt(issueId, solution)}" --tool codex --mode write --id ${fixedId}`,
    { run_in_background: true }
  )
  // STOP — CLI 后台执行，等待 task hook callback 通知完成

  // 失败时 resume:
  // ccw cli -p "Continue implementation" --resume ${fixedId} --tool codex --mode write --id ${fixedId}-retry
}
```

#### Option C: Gemini CLI Execution (`executor === 'gemini'`)

后台调用 Gemini CLI，适合需要分析的复合任务。

```javascript
if (executor === 'gemini') {
  const fixedId = `planex-${issueId}`

  Bash(
    `ccw cli -p "${buildExecutionPrompt(issueId, solution)}" --tool gemini --mode write --id ${fixedId}`,
    { run_in_background: true }
  )
  // STOP — CLI 后台执行，等待 task hook callback 通知完成
}
```

### Phase 4: Verify & Commit

```javascript
// Detect test command from package.json or project config
let testCmd = 'npm test'
try {
  const pkgJson = JSON.parse(Read('package.json'))
  if (pkgJson.scripts?.test) testCmd = 'npm test'
  else if (pkgJson.scripts?.['test:unit']) testCmd = 'npm run test:unit'
} catch {
  // Fallback: try common test runners
}

// Verify implementation
const testResult = Bash(`${testCmd} 2>&1 || echo "TEST_FAILED"`)
const testPassed = !testResult.includes('TEST_FAILED') && !testResult.includes('FAIL')

if (!testPassed) {
  // Implementation failed — report to planner
  mcp__ccw-tools__team_msg({
    operation: "log", team: "planex", from: "executor", to: "planner",
    type: "impl_failed",
    summary: `[executor] Tests failing for ${issueId} after implementation (via ${executor})`
  })

  SendMessage({
    type: "message", recipient: "planner",
    content: `## [executor] Implementation Failed

**Issue**: ${issueId}
**Executor**: ${executor}
**Status**: Tests failing after implementation
**Test Output** (truncated):
${testResult.slice(0, 500)}

**Action**: May need solution revision or manual intervention.
${executor !== 'agent' ? `**Resume**: \`ccw cli -p "Fix failing tests" --resume planex-${issueId} --tool ${executor} --mode write --id planex-${issueId}-fix\`` : ''}`,
    summary: `[executor] impl_failed: ${issueId} (${executor})`
  })

  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}

// Optional: Code review (if configured)
if (codeReview !== 'Skip') {
  executeCodeReview(codeReview, issueId)
}

// Update issue status to resolved
Bash(`ccw issue update ${issueId} --status completed`)
```

### Code Review (Optional)

```javascript
function executeCodeReview(reviewTool, issueId) {
  const reviewPrompt = `PURPOSE: Code review for ${issueId} implementation against solution plan
TASK: • Verify solution convergence criteria • Check test coverage • Analyze code quality • Identify issues
MODE: analysis
CONTEXT: @**/* | Memory: Review planex execution for ${issueId}
EXPECTED: Quality assessment with issue identification and recommendations
CONSTRAINTS: Focus on solution adherence and code quality | analysis=READ-ONLY`

  if (reviewTool === 'Gemini Review') {
    Bash(`ccw cli -p "${reviewPrompt}" --tool gemini --mode analysis --id planex-review-${issueId}`,
      { run_in_background: true })
  } else if (reviewTool === 'Codex Review') {
    // Codex review: --uncommitted flag only (no prompt with target flags)
    Bash(`ccw cli --tool codex --mode review --uncommitted`,
      { run_in_background: true })
  } else if (reviewTool === 'Agent Review') {
    // Current agent performs review inline
    // Read solution convergence criteria and verify against implementation
  }
}
```

### Phase 5: Report + Loop

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "planex",
  from: "executor",
  to: "planner",
  type: "impl_complete",
  summary: `[executor] Implementation complete for ${issueId} via ${executor}, tests passing`
})

SendMessage({
  type: "message",
  recipient: "planner",
  content: `## [executor] Implementation Complete

**Issue**: ${issueId}
**Executor**: ${executor}
**Solution**: ${solution.bound.id}
**Code Review**: ${codeReview}
**Status**: All tests passing
**Issue Status**: Updated to resolved`,
  summary: `[executor] EXEC complete: ${issueId} (${executor})`
})

TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next EXEC-* task (may include new wave tasks from planner)
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('EXEC-') &&
  t.owner === 'executor' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
} else {
  // Check if planner has sent all_planned signal
  // If yes and no more tasks → send wave_done and exit
  mcp__ccw-tools__team_msg({
    operation: "log",
    team: "planex",
    from: "executor",
    to: "planner",
    type: "wave_done",
    summary: "[executor] All EXEC tasks completed"
  })

  SendMessage({
    type: "message",
    recipient: "planner",
    content: `## [executor] All Tasks Done

All EXEC-* tasks have been completed. Pipeline finished.`,
    summary: "[executor] wave_done: all complete"
  })
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No EXEC-* tasks available | Idle, wait for planner to create tasks |
| Solution plan not found | Report error to planner |
| Unknown execution_method | Fallback to `agent` with warning |
| Agent (code-developer) failure | Retry once, then report impl_failed |
| CLI (Codex/Gemini) failure | Provide resume command with fixed ID, report impl_failed |
| CLI timeout | Use fixed ID `planex-{issueId}` for resume |
| Tests failing after implementation | Report impl_failed with test output + resume info |
| Issue status update failure | Log warning, continue with report |
| Dependency not yet complete | Wait — task is blocked by blockedBy |
| All tasks done but planner still planning | Send wave_done, then idle for more |
