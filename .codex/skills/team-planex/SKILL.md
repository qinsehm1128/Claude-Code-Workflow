---
name: team-planex
description: 2-member plan-and-execute pipeline with per-issue beat pipeline for concurrent planning and execution. Planner decomposes requirements into issues, generates solutions, writes artifacts. Executor implements solutions via configurable backends (agent/codex/gemini). Triggers on "team planex".
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep
argument-hint: "<issue-ids|--text 'description'|--plan path> [--exec=agent|codex|gemini|auto] [-y]"
---

# Team PlanEx

2 成员边规划边执行团队。通过逐 Issue 节拍流水线实现 planner 和 executor 并行工作：planner 每完成一个 issue 的 solution 后输出 ISSUE_READY 信号，orchestrator 立即 spawn executor agent 处理该 issue，同时 send_input 让 planner 继续下一 issue。

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Orchestrator (this file)                     │
│  → Parse input → Spawn planner → Spawn exec  │
└────────────────┬─────────────────────────────┘
                 │ Per-Issue Beat Pipeline
         ┌───────┴───────┐
         ↓               ↓
    ┌─────────┐    ┌──────────┐
    │ planner │    │ executor │
    │ (plan)  │    │ (impl)   │
    └─────────┘    └──────────┘
         │               │
    issue-plan-agent  code-developer
                       (or codex/gemini CLI)
```

## Agent Registry

| Agent | Role File | Responsibility | New/Existing |
|-------|-----------|----------------|--------------|
| `planex-planner` | `.codex/skills/team-planex/agents/planex-planner.md` | 需求拆解 → issue 创建 → 方案设计 → 冲突检查 → 逐 issue 派发 | New (skill-specific) |
| `planex-executor` | `.codex/skills/team-planex/agents/planex-executor.md` | 加载 solution → 代码实现 → 测试 → 提交 | New (skill-specific) |
| `issue-plan-agent` | `~/.codex/agents/issue-plan-agent.md` | ACE exploration + solution generation + binding | Existing |
| `code-developer` | `~/.codex/agents/code-developer.md` | Code implementation (agent backend) | Existing |

## Input Types

支持 3 种输入方式（通过 orchestrator message 传入）：

| 输入类型 | 格式 | 示例 |
|----------|------|------|
| Issue IDs | 直接传入 ID | `ISS-20260215-001 ISS-20260215-002` |
| 需求文本 | `--text '...'` | `--text '实现用户认证模块'` |
| Plan 文件 | `--plan path` | `--plan plan/2026-02-15-auth.md` |

## Execution Method Selection

支持 3 种执行后端：

| Executor | 后端 | 适用场景 |
|----------|------|----------|
| `agent` | code-developer subagent | 简单任务、同步执行 |
| `codex` | `ccw cli --tool codex --mode write` | 复杂任务、后台执行 |
| `gemini` | `ccw cli --tool gemini --mode write` | 分析类任务、后台执行 |

## Phase Execution

### Phase 1: Input Parsing & Preference Collection

Parse user arguments and determine execution configuration.

```javascript
// Parse input from orchestrator message
const args = orchestratorMessage
const issueIds = args.match(/ISS-\d{8}-\d{6}/g) || []
const textMatch = args.match(/--text\s+['"]([^'"]+)['"]/)
const planMatch = args.match(/--plan\s+(\S+)/)
const autoYes = /\b(-y|--yes)\b/.test(args)
const explicitExec = args.match(/--exec[=\s]+(agent|codex|gemini|auto)/i)?.[1]

let executionConfig

if (explicitExec) {
  executionConfig = {
    executionMethod: explicitExec.charAt(0).toUpperCase() + explicitExec.slice(1),
    codeReviewTool: "Skip"
  }
} else if (autoYes) {
  executionConfig = { executionMethod: "Auto", codeReviewTool: "Skip" }
} else {
  // Interactive: ask user for preferences
  // (orchestrator handles user interaction directly)
}

// Initialize session directory for artifacts
const slug = (issueIds[0] || 'batch').replace(/[^a-zA-Z0-9-]/g, '')
const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'')
const sessionId = `PEX-${slug}-${dateStr}`
const sessionDir = `.workflow/.team/${sessionId}`
shell(`mkdir -p "${sessionDir}/artifacts/solutions"`)
```

### Phase 2: Planning (Planner Agent — Per-Issue Beat)

Spawn planner agent for per-issue planning. Uses send_input for issue-by-issue progression.

```javascript
// Build planner input context
let plannerInput = ""
if (issueIds.length > 0) plannerInput = `issue_ids: ${JSON.stringify(issueIds)}`
else if (textMatch) plannerInput = `text: ${textMatch[1]}`
else if (planMatch) plannerInput = `plan_file: ${planMatch[1]}`

const planner = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: .codex/skills/team-planex/agents/planex-planner.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: Decompose requirements into executable solutions (per-issue beat)

## Input
${plannerInput}

## Execution Config
execution_method: ${executionConfig.executionMethod}
code_review: ${executionConfig.codeReviewTool}

## Session Dir
session_dir: ${sessionDir}

## Deliverables
For EACH issue, output structured data:

\`\`\`
ISSUE_READY:
{
  "issue_id": "ISS-xxx",
  "solution_id": "SOL-xxx",
  "title": "...",
  "priority": "normal",
  "depends_on": [],
  "solution_file": "${sessionDir}/artifacts/solutions/ISS-xxx.json"
}
\`\`\`

After ALL issues planned, output:
\`\`\`
ALL_PLANNED:
{ "total_issues": N }
\`\`\`

## Quality bar
- Every issue has a bound solution
- Solution artifact written to file before output
- Inline conflict check determines depends_on
`
})

// Wait for first ISSUE_READY
const firstIssue = wait({ ids: [planner], timeout_ms: 600000 })

if (firstIssue.timed_out) {
  send_input({ id: planner, message: "Please finalize current issue and output ISSUE_READY." })
  const retry = wait({ ids: [planner], timeout_ms: 120000 })
}

// Parse first issue data
const firstIssueData = parseIssueReady(firstIssue.status[planner].completed)
```

### Phase 3: Per-Issue Beat Pipeline (Planning + Execution Interleaved)

Pipeline: spawn executor for current issue while planner continues next issue.

```javascript
const allAgentIds = [planner]
const executorAgents = []
let allPlanned = false
let currentIssueOutput = firstIssue.status[planner].completed

while (!allPlanned) {
  // --- Spawn executor for current issue ---
  const issueData = parseIssueReady(currentIssueOutput)

  if (issueData) {
    const executor = spawn_agent({
      message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: .codex/skills/team-planex/agents/planex-executor.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: Implement solution for ${issueData.issue_id}

## Task
${JSON.stringify([issueData], null, 2)}

## Execution Config
execution_method: ${executionConfig.executionMethod}
code_review: ${executionConfig.codeReviewTool}

## Solution File
solution_file: ${issueData.solution_file}

## Session Dir
session_dir: ${sessionDir}

## Deliverables
\`\`\`
IMPL_COMPLETE:
issue_id: ${issueData.issue_id}
status: success|failed
test_result: pass|fail
commit: <hash or N/A>
\`\`\`

## Quality bar
- All existing tests pass after implementation
- Code follows project conventions
- One commit per solution
`
    })
    allAgentIds.push(executor)
    executorAgents.push({ id: executor, issueId: issueData.issue_id })
  }

  // --- Check if ALL_PLANNED was in this output ---
  if (currentIssueOutput.includes("ALL_PLANNED")) {
    allPlanned = true
    break
  }

  // --- Tell planner to continue next issue ---
  send_input({ id: planner, message: `Issue ${issueData?.issue_id || 'unknown'} dispatched. Continue to next issue.` })

  // Wait for planner (next issue)
  const plannerResult = wait({ ids: [planner], timeout_ms: 600000 })

  if (plannerResult.timed_out) {
    send_input({ id: planner, message: "Please finalize current issue and output results." })
    const retry = wait({ ids: [planner], timeout_ms: 120000 })
    currentIssueOutput = retry.status?.[planner]?.completed || ""
  } else {
    currentIssueOutput = plannerResult.status[planner]?.completed || ""
  }

  // Check for ALL_PLANNED
  if (currentIssueOutput.includes("ALL_PLANNED")) {
    // May contain a final ISSUE_READY before ALL_PLANNED
    const finalIssue = parseIssueReady(currentIssueOutput)
    if (finalIssue) {
      // Spawn one more executor for the last issue
      const lastExec = spawn_agent({
        message: `... same executor spawn as above for ${finalIssue.issue_id} ...`
      })
      allAgentIds.push(lastExec)
      executorAgents.push({ id: lastExec, issueId: finalIssue.issue_id })
    }
    allPlanned = true
  }
}

// Wait for all remaining executor agents
const pendingExecutors = executorAgents.map(e => e.id)

if (pendingExecutors.length > 0) {
  const finalResults = wait({ ids: pendingExecutors, timeout_ms: 900000 })

  if (finalResults.timed_out) {
    const pending = pendingExecutors.filter(id => !finalResults.status[id]?.completed)
    pending.forEach(id => {
      send_input({ id, message: "Please finalize current task and output results." })
    })
    wait({ ids: pending, timeout_ms: 120000 })
  }
}
```

### Phase 4: Result Aggregation & Cleanup

```javascript
// Collect results from all executors
const pipelineResults = {
  issues: [],
  totalCompleted: 0,
  totalFailed: 0
}

executorAgents.forEach(({ id, issueId }) => {
  const output = results.status[id]?.completed || ""
  const implResult = parseImplComplete(output)
  pipelineResults.issues.push({
    issueId,
    status: implResult?.status || 'unknown',
    commit: implResult?.commit || 'N/A'
  })
  if (implResult?.status === 'success') pipelineResults.totalCompleted++
  else pipelineResults.totalFailed++
})

// Output final summary
console.log(`
## PlanEx Pipeline Complete

### Summary
- Total Issues: ${executorAgents.length}
- Completed: ${pipelineResults.totalCompleted}
- Failed: ${pipelineResults.totalFailed}

### Issue Details
${pipelineResults.issues.map(i =>
  `- ${i.issueId}: ${i.status} (commit: ${i.commit})`
).join('\n')}
`)

// Cleanup ALL agents
allAgentIds.forEach(id => {
  try { close_agent({ id }) } catch { /* already closed */ }
})
```

## Coordination Protocol

### File-Based Communication

Since Codex agents have isolated contexts, use file-based coordination:

| File | Purpose | Writer | Reader |
|------|---------|--------|--------|
| `{sessionDir}/artifacts/solutions/{issueId}.json` | Solution artifact | planner | executor |
| `{sessionDir}/exec-{issueId}.json` | Execution result | executor | orchestrator |
| `{sessionDir}/pipeline-log.ndjson` | Event log | both | orchestrator |

### Solution Artifact Format

```json
{
  "issue_id": "ISS-20260215-001",
  "bound": {
    "id": "SOL-001",
    "title": "Implement auth module",
    "tasks": [...],
    "files_touched": ["src/auth/login.ts"]
  },
  "execution_config": {
    "execution_method": "Agent",
    "code_review": "Skip"
  },
  "timestamp": "2026-02-15T10:00:00Z"
}
```

### Execution Result Format

```json
{
  "issue_id": "ISS-20260215-001",
  "status": "success",
  "executor": "agent",
  "test_result": "pass",
  "commit": "abc123",
  "files_changed": ["src/auth/login.ts", "src/auth/login.test.ts"]
}
```

## Lifecycle Management

### Timeout Handling

| Timeout Scenario | Action |
|-----------------|--------|
| Planner issue timeout | send_input to urge convergence, retry wait |
| Executor impl timeout | send_input to finalize, record partial result |
| All agents timeout | Log error, abort with partial state |

### Cleanup Protocol

```javascript
// Track all agents created during execution
const allAgentIds = []

// ... (agents added during phase execution) ...

// Final cleanup (end of orchestrator or on error)
allAgentIds.forEach(id => {
  try { close_agent({ id }) } catch { /* already closed */ }
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Planner issue failure | Retry once via send_input, then skip issue |
| Executor impl failure | Record failure, continue with next issue |
| No issues created from text | Report to user, abort |
| Solution generation failure | Skip issue, continue with remaining |
| Inline conflict check failure | Use empty depends_on, continue |
| Pipeline stall (no progress) | Timeout handling → urge convergence → abort |
| Missing role file | Log error, use inline fallback instructions |

## Helper Functions

```javascript
function parseIssueReady(output) {
  const match = output.match(/ISSUE_READY:\s*\n([\s\S]*?)(?=\n```|$)/)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
}

function parseImplComplete(output) {
  const match = output.match(/IMPL_COMPLETE:\s*\n([\s\S]*?)(?=\n```|$)/)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
}

function resolveExecutor(method, taskCount) {
  if (method.toLowerCase() === 'auto') {
    return taskCount <= 3 ? 'agent' : 'codex'
  }
  return method.toLowerCase()
}
```
