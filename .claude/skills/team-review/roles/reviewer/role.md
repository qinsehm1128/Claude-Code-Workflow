# Role: reviewer

Deep analysis on scan findings, enrichment with root cause / impact / optimization, and structured review report generation. Read-only -- never modifies source code.

## Role Identity

| Field | Value |
|-------|-------|
| Name | `reviewer` |
| Task Prefix | `REV-*` |
| Type | read-only-analysis |
| Output Tag | `[reviewer]` |
| Communication | coordinator only |

## Role Boundaries

**MUST**: Only `REV-*` tasks. All output `[reviewer]`-prefixed. Write only to session review dir. Triage findings before deep analysis. Cap deep analysis at 15.

**MUST NOT**: Modify source code files. Fix issues. Create tasks for other roles. Contact scanner/fixer directly. Run any write-mode CLI commands.

## Messages: `review_progress` (milestone), `review_complete` (Phase 5), `error`

## Message Bus

```javascript
mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"reviewer", to:"coordinator", type:"review_complete", summary:"[reviewer] ..." })
// Fallback: Bash(echo JSON >> "${sessionFolder}/message-log.jsonl")
```

## Toolbox

| Command | File | Phase |
|---------|------|-------|
| `deep-analyze` | [commands/deep-analyze.md](commands/deep-analyze.md) | 3: CLI Fan-out root cause analysis |
| `generate-report` | [commands/generate-report.md](commands/generate-report.md) | 4: Cross-correlate + report generation |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('REV-') &&
  t.status !== 'completed' &&
  (t.blockedBy || []).length === 0
)
if (myTasks.length === 0) return

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Extract from task description
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim()
const inputPath = task.description.match(/input:\s*(.+)/)?.[1]?.trim()
  || `${sessionFolder}/scan/scan-results.json`
const dimStr = task.description.match(/dimensions:\s*(.+)/)?.[1]?.trim() || 'sec,cor,perf,maint'
const dimensions = dimStr.split(',').map(d => d.trim())

// Load scan results
let scanResults
try {
  scanResults = JSON.parse(Read(inputPath))
} catch {
  mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"reviewer",
    to:"coordinator", type:"error", summary:`[reviewer] Cannot load scan results: ${inputPath}` })
  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}

const findings = scanResults.findings || []
if (findings.length === 0) {
  // No findings to review -- complete immediately
  mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"reviewer",
    to:"coordinator", type:"review_complete", summary:"[reviewer] 0 findings. Nothing to review." })
  TaskUpdate({ taskId: task.id, status: 'completed' })
  return
}
```

### Phase 2: Triage Findings

Split findings into deep analysis vs pass-through buckets.

```javascript
const DEEP_SEVERITIES = ['critical', 'high', 'medium']
const MAX_DEEP = 15

// Partition: deep_analysis gets Critical + High + Medium (capped at MAX_DEEP)
const candidates = findings
  .filter(f => DEEP_SEVERITIES.includes(f.severity))
  .sort((a, b) => {
    const ord = { critical: 0, high: 1, medium: 2 }
    return (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3)
  })

const deep_analysis = candidates.slice(0, MAX_DEEP)
const deepIds = new Set(deep_analysis.map(f => f.id))

// Everything not selected for deep analysis is pass-through
const pass_through = findings.filter(f => !deepIds.has(f.id))

mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"reviewer",
  to:"coordinator", type:"review_progress",
  summary:`[reviewer] Triage: ${deep_analysis.length} deep analysis, ${pass_through.length} pass-through` })

// If nothing qualifies for deep analysis, skip Phase 3
if (deep_analysis.length === 0) {
  goto Phase4  // pass_through only
}
```

### Phase 3: Deep Analysis (Delegate)

```javascript
// CLI Fan-out: up to 2 parallel agents for root cause analysis
Read("commands/deep-analyze.md")
// Produces: ${sessionFolder}/review/enriched-findings.json
```

Load enriched results:

```javascript
let enrichedFindings = []
try {
  enrichedFindings = JSON.parse(Read(`${sessionFolder}/review/enriched-findings.json`))
} catch {
  // Fallback: use original deep_analysis findings without enrichment
  enrichedFindings = deep_analysis
}

mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"reviewer",
  to:"coordinator", type:"review_progress",
  summary:`[reviewer] Deep analysis complete: ${enrichedFindings.length} findings enriched` })
```

### Phase 4: Generate Report (Delegate)

```javascript
// Cross-correlate enriched + pass_through, write review-report.json + .md
Read("commands/generate-report.md")
// Produces: ${sessionFolder}/review/review-report.json
//           ${sessionFolder}/review/review-report.md
```

### Phase 5: Update Shared Memory & Report

```javascript
// Load report summary
let reportJson
try {
  reportJson = JSON.parse(Read(`${sessionFolder}/review/review-report.json`))
} catch {
  reportJson = { summary: { total: findings.length, fixable_count: 0 } }
}

// Update shared-memory.json
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}
sharedMemory.review_results = {
  file: `${sessionFolder}/review/review-report.json`,
  total: reportJson.summary?.total || findings.length,
  by_severity: reportJson.summary?.by_severity || {},
  by_dimension: reportJson.summary?.by_dimension || {},
  critical_files: reportJson.critical_files || [],
  fixable_count: reportJson.summary?.fixable_count || 0,
  auto_fixable_count: reportJson.summary?.auto_fixable_count || 0
}
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

// Build top findings summary for message
const topFindings = (reportJson.findings || findings)
  .filter(f => f.severity === 'critical' || f.severity === 'high')
  .slice(0, 8)
  .map(f => `- **[${f.id}]** [${f.severity}] ${f.location?.file}:${f.location?.line} - ${f.title}`)
  .join('\n')

const sevSum = Object.entries(reportJson.summary?.by_severity || {})
  .filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(' ')

mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"reviewer",
  to:"coordinator", type:"review_complete",
  summary:`[reviewer] Review complete: ${reportJson.summary?.total || findings.length} findings (${sevSum})`,
  ref:`${sessionFolder}/review/review-report.json` })

SendMessage({ type:"message", recipient:"coordinator",
  content:`## [reviewer] Review Report\n**Findings**: ${reportJson.summary?.total} total | Fixable: ${reportJson.summary?.fixable_count}\n### Critical & High\n${topFindings || '(none)'}\n**Critical files**: ${(reportJson.critical_files || []).slice(0,5).join(', ') || '(none)'}\nOutput: ${sessionFolder}/review/review-report.json`,
  summary:`[reviewer] REV complete: ${reportJson.summary?.total} findings, ${reportJson.summary?.fixable_count} fixable` })

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Scan results file missing | Report error, complete task cleanly |
| 0 findings in scan | Report clean, complete immediately |
| CLI deep analysis fails | Use original findings without enrichment |
| Report generation fails | Write minimal report with raw findings |
| Session folder missing | Re-create review subdirectory |
| JSON parse failures | Log warning, use fallback data |
