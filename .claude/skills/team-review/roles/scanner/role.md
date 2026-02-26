# Role: scanner

Toolchain + LLM semantic scan producing structured findings. Static analysis tools in parallel, then LLM for issues tools miss.

## Role Identity

| Field | Value |
|-------|-------|
| Name | `scanner` |
| Task Prefix | `SCAN-*` |
| Type | read-only-analysis |
| Output Tag | `[scanner]` |
| Communication | coordinator only |

## Role Boundaries

**MUST**: Only `SCAN-*` tasks. All output `[scanner]`-prefixed. Write only to session scan dir. IDs: SEC-001, COR-001, PRF-001, MNT-001.

**MUST NOT**: Modify source files. Fix issues. Create tasks for other roles. Contact reviewer/fixer directly.

## Messages: `scan_progress` (milestone), `scan_complete` (Phase 5), `error`

## Message Bus

```javascript
mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"scanner", to:"coordinator", type:"scan_complete", summary:"[scanner] ..." })
// Fallback: Bash(echo JSON >> "${sessionFolder}/message-log.jsonl")
```

## Toolbox

| Command | File | Phase |
|---------|------|-------|
| `toolchain-scan` | [commands/toolchain-scan.md](commands/toolchain-scan.md) | 3A: Parallel static analysis |
| `semantic-scan` | [commands/semantic-scan.md](commands/semantic-scan.md) | 3B: LLM analysis via CLI (gemini/qwen/codex fallback) |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('SCAN-') &&
  t.status !== 'completed' &&
  (t.blockedBy || []).length === 0
)
if (myTasks.length === 0) return

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Extract from task description
const target = task.description.match(/target:\s*(.+)/)?.[1]?.trim() || '.'
const dimStr = task.description.match(/dimensions:\s*(.+)/)?.[1]?.trim() || 'sec,cor,perf,maint'
const dimensions = dimStr.split(',').map(d => d.trim())
const quickMode = /quick:\s*true/.test(task.description)
const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim()
```

### Phase 2: Context Resolution

```javascript
const targetFiles = Glob(target.includes('*') ? target : `${target}/**/*`)
  .filter(f => /\.(ts|tsx|js|jsx|py|go|java|rs)$/.test(f))
if (targetFiles.length === 0) { /* report error, complete task */ return }

// Detect toolchain: check config files + tool availability
const projectRoot = Bash('git rev-parse --show-toplevel 2>/dev/null || pwd').trim()
const chk = (c) => Bash(c).trim() === 'y'
const toolchain = {
  tsc:      chk(`test -f "${projectRoot}/tsconfig.json" && echo y || echo n`),
  eslint:   chk(`(ls "${projectRoot}"/.eslintrc* "${projectRoot}"/eslint.config.* 2>/dev/null | head -1 >/dev/null && echo y) || (grep -q eslint "${projectRoot}/package.json" 2>/dev/null && echo y) || echo n`),
  semgrep:  chk(`test -f "${projectRoot}/.semgrep.yml" && echo y || echo n`),
  ruff:     chk(`test -f "${projectRoot}/pyproject.toml" && command -v ruff >/dev/null 2>&1 && echo y || echo n`),
  mypy:     chk(`command -v mypy >/dev/null 2>&1 && test -f "${projectRoot}/pyproject.toml" && echo y || echo n`),
  npmAudit: chk(`test -f "${projectRoot}/package-lock.json" && echo y || echo n`)
}
```

### Phase 3: Scan Execution

```javascript
let toolchainFindings = [], semanticFindings = []

if (quickMode) {
  // Quick Mode: Single inline CLI, max 20 findings
  const qr = Bash(`ccw cli -p "Quick scan ${target}. Dims: ${dimensions.join(',')}. Return JSON array max 20 critical/high findings. Schema: {dimension,category,severity,title,description,location:{file,line},source:'llm',suggested_fix,effort,confidence}" --tool gemini --mode analysis --rule analysis-review-code-quality`, { timeout: 300000 })
  try { const m = qr.match(/\[[\s\S]*\]/); if (m) semanticFindings = JSON.parse(m[0]) } catch {}
} else {
  // Standard Mode: Sequential A -> B
  Read("commands/toolchain-scan.md")  // writes toolchain-findings.json
  try { toolchainFindings = JSON.parse(Read(`${sessionFolder}/scan/toolchain-findings.json`)) } catch {}
  Read("commands/semantic-scan.md")   // writes semantic-findings.json (uses toolchain output for dedup)
  try { semanticFindings = JSON.parse(Read(`${sessionFolder}/scan/semantic-findings.json`)) } catch {}
}
```

### Phase 4: Aggregate & Deduplicate

```javascript
// Dedup: same file + line + dimension = duplicate
const seen = new Set()
const unique = [...toolchainFindings, ...semanticFindings].filter(f => {
  const key = `${f.location?.file}:${f.location?.line}:${f.dimension}`
  return !seen.has(key) && seen.add(key)
})

// Assign dimension-prefixed IDs (SEC-001, COR-001, PRF-001, MNT-001)
const DIM_PREFIX = { security:'SEC', correctness:'COR', performance:'PRF', maintainability:'MNT' }
const dimCounters = { SEC:0, COR:0, PRF:0, MNT:0 }
const findings = unique.map(f => {
  const pfx = DIM_PREFIX[f.dimension] || 'MNT'; dimCounters[pfx]++
  return { ...f, id: `${pfx}-${String(dimCounters[pfx]).padStart(3,'0')}`,
    severity: f.severity||'medium', confidence: f.confidence||'medium', effort: f.effort||'medium', source: f.source||'llm',
    root_cause:null, impact:null, optimization:null, fix_strategy:null, fix_complexity:null, fix_dependencies:[] }
})

// Write scan-results.json (schema: scan_date, target, total_findings, by_severity, by_dimension, findings[])
const scanResult = { scan_date: new Date().toISOString(), target, dimensions, quick_mode: quickMode,
  total_findings: findings.length,
  by_severity: findings.reduce((a,f) => ({...a,[f.severity]:(a[f.severity]||0)+1}), {}),
  by_dimension: Object.fromEntries(Object.entries(DIM_PREFIX).map(([k,v]) => [k, dimCounters[v]])),
  findings }
Write(`${sessionFolder}/scan/scan-results.json`, JSON.stringify(scanResult, null, 2))
```

### Phase 5: Update Shared Memory & Report

```javascript
let sharedMemory = {}
try { sharedMemory = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}
sharedMemory.scan_results = { file: `${sessionFolder}/scan/scan-results.json`, total: findings.length, by_severity: scanResult.by_severity, by_dimension: scanResult.by_dimension }
sharedMemory.findings_count = findings.length
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(sharedMemory, null, 2))

const dimSum = Object.entries(dimCounters).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(' ')
const top = findings.filter(f => f.severity==='critical'||f.severity==='high').slice(0,10)
  .map(f => `- **[${f.id}]** [${f.severity}] ${f.location.file}:${f.location.line} - ${f.title}`).join('\n')

mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"scanner", to:"coordinator", type:"scan_complete",
  summary:`[scanner] Scan complete: ${findings.length} findings (${dimSum})`, ref:`${sessionFolder}/scan/scan-results.json` })

SendMessage({ type:"message", recipient:"coordinator",
  content:`## [scanner] Scan Results\n**Target**: ${target} | **Mode**: ${quickMode?'quick':'standard'}\n### ${findings.length} findings (${dimSum})\n${top||'(clean)'}\nOutput: ${sessionFolder}/scan/scan-results.json`,
  summary:`[scanner] SCAN complete: ${findings.length} findings` })

TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No source files match target | Report empty, complete task cleanly |
| All toolchain tools unavailable | Skip toolchain, run semantic-only |
| CLI semantic scan fails | Log warning, use toolchain results only |
| Quick mode CLI timeout | Return partial or empty findings |
| Toolchain tool crashes | Skip that tool, continue with others |
| Session folder missing | Re-create scan subdirectory |
