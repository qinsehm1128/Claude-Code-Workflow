---
name: team-planex
description: |
  2-member plan-and-execute pipeline with Wave Pipeline for concurrent planning and execution.
  Planner decomposes requirements into issues, generates solutions, forms execution queues.
  Executor implements solutions via configurable backends (agent/codex/gemini).
agents: 2
phases: 4
---

# Team PlanEx

2 成员边规划边执行团队。通过 Wave Pipeline（波次流水线）实现 planner 和 executor 并行工作：planner 完成一个 wave 的 queue 后，orchestrator 立即 spawn executor agent 处理该 wave，同时 send_input 让 planner 继续下一 wave。

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Orchestrator (this file)                     │
│  → Parse input → Spawn planner → Spawn exec  │
└────────────────┬─────────────────────────────┘
                 │ Wave Pipeline
         ┌───────┴───────┐
         ↓               ↓
    ┌─────────┐    ┌──────────┐
    │ planner │    │ executor │
    │ (plan)  │    │ (impl)   │
    └─────────┘    └──────────┘
         │               │
    issue-plan-agent  code-developer
    issue-queue-agent (or codex/gemini CLI)
```

## Agent Registry

| Agent | Role File | Responsibility | New/Existing |
|-------|-----------|----------------|--------------|
| `planex-planner` | `.codex/skills/team-planex/agents/planex-planner.md` | 需求拆解 → issue 创建 → 方案设计 → 队列编排 | New (skill-specific) |
| `planex-executor` | `.codex/skills/team-planex/agents/planex-executor.md` | 加载 solution → 代码实现 → 测试 → 提交 | New (skill-specific) |
| `issue-plan-agent` | `~/.codex/agents/issue-plan-agent.md` | ACE exploration + solution generation + binding | Existing |
| `issue-queue-agent` | `~/.codex/agents/issue-queue-agent.md` | Solution ordering + conflict detection | Existing |
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
```

### Phase 2: Planning (Planner Agent — Deep Interaction)

Spawn planner agent for wave-based planning. Uses send_input for multi-wave progression.

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

Goal: Decompose requirements into waves of executable solutions

## Input
${plannerInput}

## Execution Config
execution_method: ${executionConfig.executionMethod}
code_review: ${executionConfig.codeReviewTool}

## Deliverables
For EACH wave, output structured wave data:

\`\`\`
WAVE_READY:
wave_number: N
issue_ids: [ISS-xxx, ...]
queue_path: .workflow/issues/queue/execution-queue.json
exec_tasks: [
  { issue_id: "ISS-xxx", solution_id: "SOL-xxx", title: "...", priority: "normal", depends_on: [] },
  ...
]
\`\`\`

After ALL waves planned, output:
\`\`\`
ALL_PLANNED:
total_waves: N
total_issues: N
\`\`\`

## Quality bar
- Every issue has a bound solution
- Queue respects dependency DAG
- Wave boundaries are logical groupings
`
})

// Wait for Wave 1
const wave1 = wait({ ids: [planner], timeout_ms: 600000 })

if (wave1.timed_out) {
  send_input({ id: planner, message: "Please finalize current wave and output WAVE_READY." })
  const retry = wait({ ids: [planner], timeout_ms: 120000 })
}

// Parse wave data from planner output
const wave1Data = parseWaveReady(wave1.status[planner].completed)
```

### Phase 3: Wave Pipeline (Planning + Execution Interleaved)

Pipeline: spawn executor for current wave while planner continues next wave.

```javascript
const allAgentIds = [planner]
const executorAgents = []
let waveNum = 1
let allPlanned = false

while (!allPlanned) {
  // --- Spawn executor for current wave ---
  const waveData = parseWaveReady(currentWaveOutput)

  if (waveData && waveData.exec_tasks.length > 0) {
    const executor = spawn_agent({
      message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: .codex/skills/team-planex/agents/planex-executor.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: Implement all solutions in Wave ${waveNum}

## Wave ${waveNum} Tasks
${JSON.stringify(waveData.exec_tasks, null, 2)}

## Execution Config
execution_method: ${executionConfig.executionMethod}
code_review: ${executionConfig.codeReviewTool}

## Deliverables
For each task, output:
\`\`\`
IMPL_COMPLETE:
issue_id: ISS-xxx
status: success|failed
test_result: pass|fail
commit: <hash or N/A>
\`\`\`

After all wave tasks done:
\`\`\`
WAVE_DONE:
wave_number: ${waveNum}
completed: N
failed: N
\`\`\`

## Quality bar
- All existing tests pass after each implementation
- Code follows project conventions
- One commit per solution
`
    })
    allAgentIds.push(executor)
    executorAgents.push({ id: executor, wave: waveNum })
  }

  // --- Tell planner to continue next wave ---
  if (!allPlanned) {
    send_input({ id: planner, message: `Wave ${waveNum} dispatched to executor. Continue to Wave ${waveNum + 1}.` })

    // Wait for both: planner (next wave) + current executor
    const activeIds = [planner]
    if (executorAgents.length > 0) {
      activeIds.push(executorAgents[executorAgents.length - 1].id)
    }

    const results = wait({ ids: activeIds, timeout_ms: 600000 })

    // Check planner output
    const plannerOutput = results.status[planner]?.completed || ""
    if (plannerOutput.includes("ALL_PLANNED")) {
      allPlanned = true
    } else if (plannerOutput.includes("WAVE_READY")) {
      waveNum++
      currentWaveOutput = plannerOutput
    }
  }
}

// Wait for remaining executor agents
const pendingExecutors = executorAgents
  .map(e => e.id)
  .filter(id => !completedIds.includes(id))

if (pendingExecutors.length > 0) {
  const finalResults = wait({ ids: pendingExecutors, timeout_ms: 900000 })

  // Handle timeout
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
  waves: [],
  totalCompleted: 0,
  totalFailed: 0
}

executorAgents.forEach(({ id, wave }) => {
  const output = results.status[id]?.completed || ""
  const waveDone = parseWaveDone(output)
  pipelineResults.waves.push({
    wave,
    completed: waveDone?.completed || 0,
    failed: waveDone?.failed || 0
  })
  pipelineResults.totalCompleted += waveDone?.completed || 0
  pipelineResults.totalFailed += waveDone?.failed || 0
})

// Output final summary
console.log(`
## PlanEx Pipeline Complete

### Summary
- Total Waves: ${waveNum}
- Total Completed: ${pipelineResults.totalCompleted}
- Total Failed: ${pipelineResults.totalFailed}

### Wave Details
${pipelineResults.waves.map(w =>
  `- Wave ${w.wave}: ${w.completed} completed, ${w.failed} failed`
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
| `.workflow/.team/PEX-{slug}-{date}/wave-{N}.json` | Wave plan data | planner | orchestrator |
| `.workflow/.team/PEX-{slug}-{date}/exec-{issueId}.json` | Execution result | executor | orchestrator |
| `.workflow/.team/PEX-{slug}-{date}/pipeline-log.ndjson` | Event log | both | orchestrator |
| `.workflow/issues/queue/execution-queue.json` | Execution queue | planner (via issue-queue-agent) | executor |

### Wave Data Format

```json
{
  "wave_number": 1,
  "issue_ids": ["ISS-20260215-001", "ISS-20260215-002"],
  "queue_path": ".workflow/issues/queue/execution-queue.json",
  "exec_tasks": [
    {
      "issue_id": "ISS-20260215-001",
      "solution_id": "SOL-001",
      "title": "Implement auth module",
      "priority": "high",
      "depends_on": []
    }
  ]
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
| Planner wave timeout | send_input to urge convergence, retry wait |
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
| Planner wave failure | Retry once via send_input, then abort pipeline |
| Executor impl failure | Record failure, continue with next wave tasks |
| No issues created from text | Report to user, abort |
| Solution generation failure | Skip issue, continue with remaining |
| Queue formation failure | Create exec tasks without DAG ordering |
| Pipeline stall (no progress) | Timeout handling → urge convergence → abort |
| Missing role file | Log error, use inline fallback instructions |

## Helper Functions

```javascript
function parseWaveReady(output) {
  const match = output.match(/WAVE_READY:\s*\n([\s\S]*?)(?=\n```|$)/)
  if (!match) return null
  // Parse structured wave data
  return JSON.parse(match[1])
}

function parseWaveDone(output) {
  const match = output.match(/WAVE_DONE:\s*\n([\s\S]*?)(?=\n```|$)/)
  if (!match) return null
  return JSON.parse(match[1])
}

function resolveExecutor(method, taskCount) {
  if (method.toLowerCase() === 'auto') {
    return taskCount <= 3 ? 'agent' : 'codex'
  }
  return method.toLowerCase()
}
```
