---
name: issue-devpipeline
description: |
  Plan-and-Execute pipeline with per-issue beat pattern.
  Orchestrator coordinates planner (Deep Interaction) and executors (Parallel Fan-out).
  Planner outputs per-issue solutions, executors implement solutions concurrently.
agents: 3
phases: 4
---

# Issue DevPipeline

边规划边执行流水线。编排器通过逐 Issue 节拍流水线协调 planner 和 executor(s)：planner 每完成一个 issue 的规划后立即输出，编排器即时为该 issue 派发 executor agent，同时 planner 继续规划下一 issue。

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator (this file)                                   │
│  → Parse input → Manage planner → Dispatch executors        │
└───────────┬──────────────────────────────────────┬──────────┘
            │                                      │
     ┌──────┴──────┐                    ┌──────────┴──────────┐
     │  Planner    │                    │  Executors (N)      │
     │  (Deep      │                    │  (Parallel Fan-out) │
     │  Interaction│                    │                     │
     │  per-issue) │                    │  exec-1  exec-2 ... │
     └──────┬──────┘                    └──────────┬──────────┘
            │                                      │
     ┌──────┴──────┐                    ┌──────────┴──────────┐
     │ issue-plan  │                    │  code-developer     │
     │ (existing)  │                    │  (role reference)   │
     └─────────────┘                    └─────────────────────┘
```

**Per-Issue Beat Pipeline Flow**:
```
Planner → Issue 1 solution → ISSUE_READY
  ↓ (spawn executor for issue 1)
  ↓ send_input → Planner → Issue 2 solution → ISSUE_READY
  ↓ (spawn executor for issue 2)
  ...
  ↓ Planner outputs "all_planned"
  ↓ wait for all executor agents
  ↓ Aggregate results → Done
```

## Agent Registry

| Agent | Role File | Responsibility | New/Existing |
|-------|-----------|----------------|--------------|
| `planex-planner` | `~/.codex/agents/planex-planner.md` | 需求拆解 → issue 创建 → 方案设计 → 冲突检查 → 逐 issue 输出 | New |
| `planex-executor` | `~/.codex/agents/planex-executor.md` | 加载 solution → 代码实现 → 测试 → 提交 | New |
| `issue-plan-agent` | `~/.codex/agents/issue-plan-agent.md` | Closed-loop: ACE 探索 + solution 生成 | Existing |

## Input Types

支持 3 种输入方式（通过 orchestrator 参数传入）：

| 输入类型 | 格式 | 示例 |
|----------|------|------|
| Issue IDs | 直接传入 ID | `ISS-20260215-001 ISS-20260215-002` |
| 需求文本 | `--text '...'` | `--text '实现用户认证模块'` |
| Plan 文件 | `--plan path` | `--plan plan/2026-02-15-auth.md` |

## Phase Execution

### Phase 1: Input Parsing (Orchestrator Inline)

```javascript
// Parse input arguments
const args = orchestratorInput
const issueIds = args.match(/ISS-\d{8}-\d{6}/g) || []
const textMatch = args.match(/--text\s+['"]([^'"]+)['"]/)
const planMatch = args.match(/--plan\s+(\S+)/)

let inputType = 'unknown'
if (issueIds.length > 0) inputType = 'issue_ids'
else if (textMatch) inputType = 'text'
else if (planMatch) inputType = 'plan_file'
else inputType = 'text_from_description'

const inputPayload = {
  type: inputType,
  issueIds: issueIds,
  text: textMatch ? textMatch[1] : args,
  planFile: planMatch ? planMatch[1] : null
}

// Initialize session directory for artifacts
const slug = (issueIds[0] || 'batch').replace(/[^a-zA-Z0-9-]/g, '')
const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'')
const sessionId = `PEX-${slug}-${dateStr}`
const sessionDir = `.workflow/.team/${sessionId}`
shell(`mkdir -p "${sessionDir}/artifacts/solutions"`)
```

### Phase 2: Planning (Deep Interaction with Planner — Per-Issue Beat)

```javascript
// Track all agents for cleanup
const allAgentIds = []

// Spawn planner agent
const plannerId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/planex-planner.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: 分析需求并逐 issue 输出规划结果。每完成一个 issue 立即输出。

Input:
${JSON.stringify(inputPayload, null, 2)}

Session Dir: ${sessionDir}

Scope:
- Include: 需求分析、issue 创建、方案设计、inline 冲突检查、写中间产物
- Exclude: 代码实现、测试执行、git 操作

Deliverables:
每个 issue 输出严格遵循以下 JSON 格式：
\`\`\`json
{
  "status": "issue_ready" | "all_planned",
  "issue_id": "ISS-xxx",
  "solution_id": "SOL-xxx",
  "title": "描述",
  "priority": "normal",
  "depends_on": [],
  "solution_file": "${sessionDir}/artifacts/solutions/ISS-xxx.json",
  "remaining_issues": ["ISS-yyy", ...],
  "summary": "本 issue 规划摘要"
}
\`\`\`

Quality bar:
- 每个 issue 必须有绑定的 solution
- Solution 写入中间产物文件
- Inline 冲突检查标记 depends_on
`
})
allAgentIds.push(plannerId)

// Wait for planner first issue output
let plannerResult = wait({ ids: [plannerId], timeout_ms: 900000 })

if (plannerResult.timed_out) {
  send_input({ id: plannerId, message: "请尽快输出当前已完成的规划结果。" })
  plannerResult = wait({ ids: [plannerId], timeout_ms: 120000 })
}

// Parse planner output
let issueData = parseIssueOutput(plannerResult.status[plannerId].completed)
```

### Phase 3: Per-Issue Execution Loop

```javascript
const executorResults = []
let issueCount = 0

while (true) {
  issueCount++

  // ─── Dispatch executor for current issue (if valid) ───
  if (issueData && issueData.issue_id) {
    const executorId = spawn_agent({
      message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/planex-executor.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: 实现 ${issueData.issue_id} 的 solution

Issue: ${issueData.issue_id}
Solution: ${issueData.solution_id}
Title: ${issueData.title}
Priority: ${issueData.priority}
Dependencies: ${issueData.depends_on?.join(', ') || 'none'}
Solution File: ${issueData.solution_file}
Session Dir: ${sessionDir}

Scope:
- Include: 加载 solution plan、代码实现、测试运行、git commit
- Exclude: issue 创建、方案修改

Deliverables:
输出严格遵循以下格式：
\`\`\`json
{
  "issue_id": "${issueData.issue_id}",
  "status": "success" | "failed",
  "files_changed": ["path/to/file", ...],
  "tests_passed": true | false,
  "committed": true | false,
  "commit_hash": "abc123" | null,
  "error": null | "错误描述",
  "summary": "实现摘要"
}
\`\`\`

Quality bar:
- solution plan 中的所有任务必须实现
- 现有测试不能 break
- 遵循项目编码规范
- 每个变更必须 commit
`
    })
    allAgentIds.push(executorId)
    executorResults.push({
      id: executorId,
      issueId: issueData.issue_id,
      index: issueCount
    })
  }

  // ─── Check if all planned ───
  if (issueData?.status === 'all_planned') {
    break
  }

  // ─── Request next issue from planner ───
  send_input({
    id: plannerId,
    message: `Issue ${issueData?.issue_id || 'unknown'} dispatched. Continue to next issue.`
  })

  // ─── Wait for planner next issue ───
  const nextResult = wait({ ids: [plannerId], timeout_ms: 900000 })

  if (nextResult.timed_out) {
    send_input({ id: plannerId, message: "请尽快输出当前已完成的规划结果。" })
    const retryResult = wait({ ids: [plannerId], timeout_ms: 120000 })
    if (retryResult.timed_out) break
    issueData = parseIssueOutput(retryResult.status[plannerId].completed)
  } else {
    issueData = parseIssueOutput(nextResult.status[plannerId].completed)
  }
}

// ─── Wait for all executor agents ───
const executorIds = executorResults.map(e => e.id)
if (executorIds.length > 0) {
  const execResults = wait({ ids: executorIds, timeout_ms: 1200000 })

  // Handle timeouts
  if (execResults.timed_out) {
    const pending = executorIds.filter(id => !execResults.status[id]?.completed)
    pending.forEach(id => {
      send_input({ id, message: "Please finalize current task and output results." })
    })
    wait({ ids: pending, timeout_ms: 120000 })
  }

  // Collect results
  executorResults.forEach(entry => {
    entry.result = execResults.status[entry.id]?.completed || 'timeout'
  })
}
```

### Phase 4: Aggregation & Cleanup

```javascript
// ─── Aggregate results ───
const succeeded = executorResults.filter(r => {
  try {
    const parsed = JSON.parse(r.result)
    return parsed.status === 'success'
  } catch { return false }
})

const failed = executorResults.filter(r => {
  try {
    const parsed = JSON.parse(r.result)
    return parsed.status === 'failed'
  } catch { return true }
})

// ─── Output final report ───
const report = `
## PlanEx Pipeline Complete

**Total Issues**: ${executorResults.length}
**Succeeded**: ${succeeded.length}
**Failed**: ${failed.length}

### Results
${executorResults.map(r => `- ${r.issueId} | ${(() => {
  try { return JSON.parse(r.result).status } catch { return 'error' }
})()}`).join('\n')}

${failed.length > 0 ? `### Failed Issues
${failed.map(r => `- ${r.issueId}: ${(() => {
  try { return JSON.parse(r.result).error } catch { return r.result?.slice(0, 200) || 'unknown' }
})()}`).join('\n')}` : ''}
`

console.log(report)

// ─── Lifecycle cleanup ───
allAgentIds.forEach(id => {
  try { close_agent({ id }) } catch { /* already closed */ }
})
```

## Helper Functions

```javascript
function parseIssueOutput(output) {
  // Extract JSON block from agent output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]) } catch {}
  }
  // Fallback: try parsing entire output as JSON
  try { return JSON.parse(output) } catch {}
  // Last resort: return empty with all_planned
  return { status: 'all_planned', issue_id: null, remaining_issues: [], summary: 'Parse failed' }
}
```

## Configuration

```javascript
const CONFIG = {
  sessionDir: ".workflow/.team/PEX-{slug}-{date}/",
  artifactsDir: ".workflow/.team/PEX-{slug}-{date}/artifacts/",
  issueDataDir: ".workflow/issues/",
  plannerTimeout: 900000,   // 15 min
  executorTimeout: 1200000, // 20 min
  maxIssues: 50
}
```

## Lifecycle Management

### Timeout Handling

| Scenario | Action |
|----------|--------|
| Planner issue timeout | send_input 催促收敛，retry wait 120s |
| Executor timeout | 标记为 failed，继续其他 executor |
| Batch wait partial timeout | 收集已完成结果，继续 pipeline |
| Pipeline stall (> 3 issues timeout) | 中止 pipeline，输出部分结果 |

### Cleanup Protocol

```javascript
// All agents tracked in allAgentIds
// Final cleanup at end or on error
allAgentIds.forEach(id => {
  try { close_agent({ id }) } catch { /* already closed */ }
})
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Planner output parse failure | Retry with send_input asking for strict JSON |
| No issues created | Report error, abort pipeline |
| Solution planning failure | Skip issue, report in final results |
| Executor implementation failure | Mark as failed, continue with other executors |
| Inline conflict check failure | Use empty depends_on, continue |
| Planner exits early | Treat as all_planned, finish current executors |
