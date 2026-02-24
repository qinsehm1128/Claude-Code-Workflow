# Assess Command

## Purpose
Multi-mode architecture assessment with mode-specific analysis strategies. Delegated from architect role.md Phase 3.

## Input Context

```javascript
// Provided by role.md Phase 2
const { consultMode, sessionFolder, wisdom, explorations, projectTech, task } = context
```

## Mode Strategies

### spec-review (ARCH-SPEC-*)

审查架构文档的技术合理性。

```javascript
const dimensions = [
  { name: 'consistency', weight: 0.25 },
  { name: 'scalability', weight: 0.25 },
  { name: 'security', weight: 0.25 },
  { name: 'tech-fitness', weight: 0.25 }
]

// Load architecture documents
const archIndex = Read(`${sessionFolder}/spec/architecture/_index.md`)
const adrFiles = Glob({ pattern: `${sessionFolder}/spec/architecture/ADR-*.md` })
const adrs = adrFiles.map(f => ({ path: f, content: Read(f) }))

// Check ADR consistency
const adrDecisions = adrs.map(adr => {
  const status = adr.content.match(/status:\s*(\w+)/i)?.[1]
  const context = adr.content.match(/## Context\n([\s\S]*?)##/)?.[1]?.trim()
  const decision = adr.content.match(/## Decision\n([\s\S]*?)##/)?.[1]?.trim()
  return { path: adr.path, status, context, decision }
})

// Cross-reference: ADR decisions vs architecture index
// Flag contradictions between ADRs
// Check if tech choices align with project-tech.json

for (const dim of dimensions) {
  const score = evaluateDimension(dim.name, archIndex, adrs, projectTech)
  assessment.dimensions.push({ name: dim.name, score, weight: dim.weight })
}
```

### plan-review (ARCH-PLAN-*)

审查实现计划的架构合理性。

```javascript
const plan = JSON.parse(Read(`${sessionFolder}/plan/plan.json`))
const taskFiles = Glob({ pattern: `${sessionFolder}/plan/.task/TASK-*.json` })
const tasks = taskFiles.map(f => JSON.parse(Read(f)))

// 1. Dependency cycle detection
function detectCycles(tasks) {
  const graph = {}
  tasks.forEach(t => { graph[t.id] = t.depends_on || [] })
  const visited = new Set(), inStack = new Set()
  function dfs(node) {
    if (inStack.has(node)) return true // cycle
    if (visited.has(node)) return false
    visited.add(node); inStack.add(node)
    for (const dep of (graph[node] || [])) {
      if (dfs(dep)) return true
    }
    inStack.delete(node)
    return false
  }
  return Object.keys(graph).filter(n => dfs(n))
}
const cycles = detectCycles(tasks)
if (cycles.length > 0) {
  assessment.concerns.push({
    severity: 'high',
    concern: `Circular dependency detected: ${cycles.join(' → ')}`,
    suggestion: 'Break cycle by extracting shared interface or reordering tasks'
  })
}

// 2. Task granularity check
tasks.forEach(t => {
  const fileCount = (t.files || []).length
  if (fileCount > 8) {
    assessment.concerns.push({
      severity: 'medium',
      task: t.id,
      concern: `Task touches ${fileCount} files — may be too coarse`,
      suggestion: 'Split into smaller tasks with clearer boundaries'
    })
  }
})

// 3. Convention compliance (from wisdom)
if (wisdom.conventions) {
  // Check if plan follows discovered conventions
}

// 4. Architecture alignment (from wisdom.decisions)
if (wisdom.decisions) {
  // Verify plan doesn't contradict previous architectural decisions
}
```

### code-review (ARCH-CODE-*)

评估代码变更的架构影响。

```javascript
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
  .split('\n').filter(Boolean)

// 1. Layer violation detection
function detectLayerViolation(file, content) {
  // Check import depth — deeper layers should not import from shallower
  const imports = (content.match(/from\s+['"]([^'"]+)['"]/g) || [])
    .map(i => i.match(/['"]([^'"]+)['"]/)?.[1]).filter(Boolean)
  return imports.filter(imp => isUpwardImport(file, imp))
}

// 2. New dependency analysis
const pkgChanges = changedFiles.filter(f => f.includes('package.json'))
if (pkgChanges.length > 0) {
  for (const pkg of pkgChanges) {
    const diff = Bash(`git diff HEAD~1 -- ${pkg} 2>/dev/null || git diff --cached -- ${pkg}`)
    const newDeps = (diff.match(/\+\s+"([^"]+)":\s+"[^"]+"/g) || [])
      .map(d => d.match(/"([^"]+)"/)?.[1]).filter(Boolean)
    if (newDeps.length > 0) {
      assessment.recommendations.push({
        area: 'dependencies',
        suggestion: `New dependencies added: ${newDeps.join(', ')}. Verify license compatibility and bundle size impact.`
      })
    }
  }
}

// 3. Module boundary changes
const indexChanges = changedFiles.filter(f => f.endsWith('index.ts') || f.endsWith('index.js'))
if (indexChanges.length > 0) {
  assessment.concerns.push({
    severity: 'medium',
    concern: `Module boundary files modified: ${indexChanges.join(', ')}`,
    suggestion: 'Verify public API changes are intentional and backward compatible'
  })
}

// 4. Architectural impact scoring
assessment.architectural_impact = changedFiles.length > 10 ? 'high'
  : indexChanges.length > 0 || pkgChanges.length > 0 ? 'medium' : 'low'
```

### consult (ARCH-CONSULT-*)

回答架构决策咨询。

```javascript
const question = task.description
  .replace(/Session:.*\n?/g, '')
  .replace(/Requester:.*\n?/g, '')
  .trim()

const isComplex = question.length > 200 ||
  /architect|design|pattern|refactor|migrate|scalab/i.test(question)

if (isComplex) {
  // Use cli-explore-agent for deep exploration
  Task({
    subagent_type: "cli-explore-agent",
    run_in_background: false,
    description: `Architecture consultation: ${question.substring(0, 80)}`,
    prompt: `## Architecture Consultation

Question: ${question}

## Steps
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Search for relevant architectural patterns in codebase
3. Read .workflow/project-tech.json (if exists)
4. Analyze architectural implications

## Output
Write to: ${sessionFolder}/architecture/consult-exploration.json
Schema: { relevant_files[], patterns[], architectural_implications[], options[] }`
  })

  // Parse exploration results into assessment
  try {
    const exploration = JSON.parse(Read(`${sessionFolder}/architecture/consult-exploration.json`))
    assessment.recommendations = (exploration.options || []).map(opt => ({
      area: 'architecture',
      suggestion: `${opt.name}: ${opt.description}`,
      trade_offs: opt.trade_offs || []
    }))
  } catch {}
} else {
  // Simple consultation — direct analysis
  assessment.recommendations.push({
    area: 'architecture',
    suggestion: `Direct answer based on codebase context and wisdom`
  })
}
```

### feasibility (ARCH-FEASIBILITY-*)

技术可行性评估。

```javascript
const proposal = task.description
  .replace(/Session:.*\n?/g, '')
  .replace(/Requester:.*\n?/g, '')
  .trim()

// 1. Tech stack compatibility
const techStack = projectTech?.tech_stack || {}
// Check if proposal requires technologies not in current stack

// 2. Codebase readiness
// Use ACE search to find relevant integration points
const searchResults = mcp__ace-tool__search_context({
  project_root_path: '.',
  query: proposal
})

// 3. Effort estimation
const touchPoints = (searchResults?.relevant_files || []).length
const effort = touchPoints > 20 ? 'high' : touchPoints > 5 ? 'medium' : 'low'

// 4. Risk assessment
assessment.verdict = 'FEASIBLE' // FEASIBLE | RISKY | INFEASIBLE
assessment.effort_estimate = effort
assessment.prerequisites = []
assessment.risks = []

if (touchPoints > 20) {
  assessment.verdict = 'RISKY'
  assessment.risks.push({
    risk: 'High touch-point count suggests significant refactoring',
    mitigation: 'Phase the implementation, start with core module'
  })
}
```

## Verdict Logic

```javascript
function determineVerdict(assessment) {
  const highConcerns = (assessment.concerns || []).filter(c => c.severity === 'high')
  const mediumConcerns = (assessment.concerns || []).filter(c => c.severity === 'medium')

  if (highConcerns.length >= 2) return 'BLOCK'
  if (highConcerns.length >= 1 || mediumConcerns.length >= 3) return 'CONCERN'
  return 'APPROVE'
}

assessment.overall_verdict = determineVerdict(assessment)
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Architecture docs not found | Assess from available context, note limitation in report |
| Plan file missing | Report to coordinator via arch_concern |
| Git diff fails (no commits) | Use staged changes or skip code-review mode |
| CLI exploration timeout | Provide partial assessment, flag as incomplete |
| Exploration results unparseable | Fall back to direct analysis without exploration |
