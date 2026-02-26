# Role: fixer

Fix code based on reviewed findings. Load manifest, group, apply with rollback-on-failure, verify.

## Role Identity

| Field | Value |
|-------|-------|
| Name | `fixer` |
| Task Prefix | `FIX-*` |
| Type | code-generation |
| Output Tag | `[fixer]` |
| Communication | coordinator only |

## Role Boundaries

**MUST**: Only `FIX-*` tasks. `[fixer]`-prefixed output. Session fix dir. Rollback on test failure -- never self-retry.

**MUST NOT**: Create tasks for others. Contact scanner/reviewer. Retry failed fixes. Modify outside scope.

## Messages: `fix_progress`, `fix_complete`, `fix_failed`, `error`

## Message Bus

```javascript
mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"fixer", to:"coordinator", type:"fix_complete", summary:"[fixer] ..." })
```

## Toolbox

| Command | File | Phase |
|---------|------|-------|
| `plan-fixes` | [commands/plan-fixes.md](commands/plan-fixes.md) | 3A: Group + sort findings |
| `execute-fixes` | [commands/execute-fixes.md](commands/execute-fixes.md) | 3B: Apply fixes per plan |

## Execution (5-Phase)

### Phase 1: Task Discovery

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('FIX-') && t.status !== 'completed' && (t.blockedBy||[]).length === 0
)
if (myTasks.length === 0) return

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

const sessionFolder = task.description.match(/session:\s*(.+)/)?.[1]?.trim()
const inputPath = task.description.match(/input:\s*(.+)/)?.[1]?.trim() || `${sessionFolder}/fix/fix-manifest.json`

let manifest, reviewReport
try { manifest = JSON.parse(Read(inputPath)) } catch {
  mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"fixer", to:"coordinator", type:"error", summary:`[fixer] No manifest: ${inputPath}` })
  TaskUpdate({ taskId: task.id, status: 'completed' }); return
}
try { reviewReport = JSON.parse(Read(manifest.source)) } catch {
  mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"fixer", to:"coordinator", type:"error", summary:`[fixer] No report: ${manifest.source}` })
  TaskUpdate({ taskId: task.id, status: 'completed' }); return
}
```

### Phase 2: Context Resolution

```javascript
const allFindings = reviewReport.findings || []
const scopeSevs = manifest.scope === 'all' ? ['critical','high','medium','low'] : manifest.scope.split(',').map(s=>s.trim())
const fixableFindings = allFindings.filter(f => scopeSevs.includes(f.severity) && f.fix_strategy !== 'skip')

if (fixableFindings.length === 0) {
  mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"fixer", to:"coordinator", type:"fix_complete", summary:`[fixer] 0 fixable findings.` })
  TaskUpdate({ taskId: task.id, status: 'completed' }); return
}

const hasCrossDeps = fixableFindings.some(f => (f.fix_dependencies||[]).some(d => {
  const dep = fixableFindings.find(x=>x.id===d); return dep && dep.location?.file !== f.location?.file }))
const quickPath = fixableFindings.length <= 5 && !hasCrossDeps

const projectRoot = Bash('git rev-parse --show-toplevel 2>/dev/null || pwd').trim()
const has = (c) => Bash(c).trim()==='y'
const VT = {tsc:has(`test -f "${projectRoot}/tsconfig.json" && echo y || echo n`),
  eslint:has(`grep -q eslint "${projectRoot}/package.json" 2>/dev/null && echo y || echo n`),
  jest:has(`grep -q jest "${projectRoot}/package.json" 2>/dev/null && echo y || echo n`),
  pytest:has(`command -v pytest >/dev/null 2>&1 && test -f "${projectRoot}/pyproject.toml" && echo y || echo n`),
  semgrep:has(`command -v semgrep >/dev/null 2>&1 && echo y || echo n`)}
```

### Phase 3: Plan + Execute (Delegate)

```javascript
Read("commands/plan-fixes.md")   // -> fix-plan.json
Read("commands/execute-fixes.md") // -> execution-results.json
```

### Phase 4: Post-Fix Verification

```javascript
let execResults
try { execResults = JSON.parse(Read(`${sessionFolder}/fix/execution-results.json`)) }
catch { execResults = { fixed:[], failed:[], skipped:[] } }

const fixedFiles = [...new Set(execResults.fixed.map(f=>f.location?.file).filter(Boolean))]
const V = {tsc:null,eslint:null,tests:null,semgrep:null}
const run = (cmd,t=120000) => Bash(`cd "${projectRoot}" && ${cmd} 2>&1 || true`,{timeout:t})

if (VT.tsc) { const o=run('npx tsc --noEmit'); const e=(o.match(/error TS/g)||[]).length; V.tsc={pass:e===0,errors:e} }
if (VT.eslint && fixedFiles.length) { const o=run(`npx eslint ${fixedFiles.join(' ')}`); const e=Number((o.match(/(\d+) error/)?.[1])||0); V.eslint={pass:e===0,errors:e} }
if (VT.jest) { const o=run('npx jest --passWithNoTests',300000); V.tests={pass:/Tests:.*passed/.test(o)&&!/failed/.test(o)} }
else if (VT.pytest) { const o=run('pytest --tb=short',300000); V.tests={pass:/passed/.test(o)&&!/failed|error/.test(o)} }
if (VT.semgrep && execResults.fixed.some(f=>f.dimension==='security')) {
  const sf=[...new Set(execResults.fixed.filter(f=>f.dimension==='security').map(f=>f.location?.file).filter(Boolean))]
  try { const j=JSON.parse(run(`semgrep --config auto ${sf.join(' ')} --json 2>/dev/null`)); V.semgrep={pass:!j.results?.length} } catch { V.semgrep={pass:true} }
}

const fixRate = fixableFindings.length ? Math.round((execResults.fixed.length/fixableFindings.length)*100) : 0
Write(`${sessionFolder}/fix/verify-results.json`, JSON.stringify({fix_rate:fixRate, verification:V}, null, 2))
```

### Phase 5: Report & Complete

```javascript
const R = execResults, n = fixableFindings.length
const S = { fix_id:`fix-${Date.now()}`, fix_date:new Date().toISOString(), scope:manifest.scope, quick_path:quickPath,
  total:n, fixed:R.fixed.length, failed:R.failed.length, skipped:R.skipped.length, fix_rate:fixRate, verification:V,
  fixed_ids:R.fixed.map(f=>f.id), failed_ids:R.failed.map(f=>({id:f.id,error:f.error})), skipped_ids:R.skipped.map(f=>f.id) }
Write(`${sessionFolder}/fix/fix-summary.json`, JSON.stringify(S, null, 2))

const fL = R.fixed.map(f=>`- [${f.id}] ${f.severity} ${f.location?.file}:${f.location?.line} - ${f.title}`).join('\n')||'(none)'
const xL = R.failed.map(f=>`- [${f.id}] ${f.location?.file} - ${f.error}`).join('\n')||'(none)'
const vR = Object.entries(V).filter(([,v])=>v!==null).map(([k,v])=>`- **${k}**: ${v.pass?'PASS':'FAIL'}${v.errors?` (${v.errors})`:''}`).join('\n')
Write(`${sessionFolder}/fix/fix-summary.md`, `# Fix Summary\n**${S.fix_id}** | ${S.scope} | ${fixRate}%\n## ${S.fixed}/${n} fixed, ${S.failed} failed, ${S.skipped} skipped\n### Fixed\n${fL}\n### Failed\n${xL}\n### Verify\n${vR||'(none)'}`)

let mem = {}; try { mem = JSON.parse(Read(`${sessionFolder}/shared-memory.json`)) } catch {}
mem.fix_results = { file:`${sessionFolder}/fix/fix-summary.json`, total:n, fixed:S.fixed, failed:S.failed, fix_rate:fixRate }
mem.fixed_count = S.fixed
Write(`${sessionFolder}/shared-memory.json`, JSON.stringify(mem, null, 2))

const sv = Object.entries(R.fixed.reduce((a,f)=>({...a,[f.severity]:(a[f.severity]||0)+1}),{})).map(([k,v])=>`${k}:${v}`).join(' ')
mcp__ccw-tools__team_msg({ operation:"log", team:"team-review", from:"fixer", to:"coordinator", type:"fix_complete",
  summary:`[fixer] ${S.fixed}/${n} (${fixRate}%)`, ref:`${sessionFolder}/fix/fix-summary.json` })
SendMessage({ type:"message", recipient:"coordinator",
  content:`## [fixer] Fix: ${S.fixed}/${n} (${fixRate}%)\nScope: ${S.scope} | ${sv||'-'} | Failed: ${S.failed} | Skipped: ${S.skipped}`,
  summary:`[fixer] FIX: ${S.fixed}/${n} (${fixRate}%)` })
TaskUpdate({ taskId: task.id, status: 'completed' })
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Manifest/report missing | Error, complete task |
| 0 fixable findings | Complete immediately |
| Test failure after fix | Rollback, mark failed, continue |
| Tool unavailable | Skip that check |
| All findings fail | Report 0%, complete |
