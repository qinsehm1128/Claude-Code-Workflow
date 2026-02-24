# Role: reviewer

Unified review role handling both code review (REVIEW-*) and specification quality checks (QUALITY-*). Auto-switches behavior based on task prefix.

## Role Identity

- **Name**: `reviewer`
- **Task Prefix**: `REVIEW-*` + `QUALITY-*`
- **Responsibility**: Discover Task → Branch by Prefix → Review/Score → Report
- **Communication**: SendMessage to coordinator only

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `review_result` | reviewer → coordinator | Code review complete | With verdict (APPROVE/CONDITIONAL/BLOCK) and findings |
| `quality_result` | reviewer → coordinator | Spec quality check complete | With score and gate decision (PASS/REVIEW/FAIL) |
| `fix_required` | reviewer → coordinator | Critical issues found | Needs IMPL-fix or DRAFT-fix tasks |
| `error` | reviewer → coordinator | Review cannot proceed | Plan missing, documents missing, etc. |

## Message Bus

Before every `SendMessage`, MUST call `mcp__ccw-tools__team_msg` to log:

```javascript
// Code review result
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "reviewer", to: "coordinator", type: "review_result", summary: "REVIEW APPROVE: 8 findings (critical=0, high=2)", data: { verdict: "APPROVE", critical: 0, high: 2 } })

// Spec quality result
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "reviewer", to: "coordinator", type: "quality_result", summary: "Quality check PASS: 85.0 score", data: { gate: "PASS", score: 85.0 } })

// Fix required
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "reviewer", to: "coordinator", type: "fix_required", summary: "Critical security issues found, IMPL-fix needed", data: { critical: 2 } })

// Error report
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "reviewer", to: "coordinator", type: "error", summary: "plan.json not found, cannot verify requirements" })
```

### CLI Fallback

When `mcp__ccw-tools__team_msg` MCP is unavailable:

```javascript
Bash(`ccw team log --team "${teamName}" --from "reviewer" --to "coordinator" --type "review_result" --summary "REVIEW APPROVE: 8 findings" --data '{"verdict":"APPROVE","critical":0}' --json`)
```

## Execution (5-Phase)

### Phase 1: Task Discovery (Dual-Prefix)

```javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  (t.subject.startsWith('REVIEW-') || t.subject.startsWith('QUALITY-')) &&
  t.owner === 'reviewer' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Determine review mode
const reviewMode = task.subject.startsWith('REVIEW-') ? 'code' : 'spec'
```

### Phase 2: Context Loading (Branch by Mode)

**Code Review Mode (REVIEW-*):**

```javascript
if (reviewMode === 'code') {
  // Load plan for acceptance criteria
  const planPathMatch = task.description.match(/\.workflow\/\.team\/[^\s]+\/plan\/plan\.json/)
  let plan = null
  if (planPathMatch) {
    try { plan = JSON.parse(Read(planPathMatch[0])) } catch {}
  }

  // Get changed files via git
  const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
    .split('\n').filter(f => f.trim() && !f.startsWith('.'))

  // Read changed file contents (limit to 20 files)
  const fileContents = {}
  for (const file of changedFiles.slice(0, 20)) {
    try { fileContents[file] = Read(file) } catch {}
  }

  // Load test results if available
  const testSummary = tasks.find(t => t.subject.startsWith('TEST-') && t.status === 'completed')
}
```

**Spec Quality Mode (QUALITY-*):**

```javascript
if (reviewMode === 'spec') {
  const sessionMatch = task.description.match(/Session:\s*(.+)/)
  const sessionFolder = sessionMatch ? sessionMatch[1].trim() : ''

  // 加载质量门禁标准（引用 spec-generator 共享资源）
  let qualityGates = null
  try { qualityGates = Read('../specs/quality-gates.md') } catch {}

  // Load all spec documents
  const documents = {
    config: null, discoveryContext: null, productBrief: null,
    requirementsIndex: null, requirements: [], architectureIndex: null,
    adrs: [], epicsIndex: null, epics: [], discussions: []
  }

  try { documents.config = JSON.parse(Read(`${sessionFolder}/spec/spec-config.json`)) } catch {}
  try { documents.discoveryContext = JSON.parse(Read(`${sessionFolder}/spec/discovery-context.json`)) } catch {}
  try { documents.productBrief = Read(`${sessionFolder}/spec/product-brief.md`) } catch {}
  try { documents.requirementsIndex = Read(`${sessionFolder}/spec/requirements/_index.md`) } catch {}
  try { documents.architectureIndex = Read(`${sessionFolder}/spec/architecture/_index.md`) } catch {}
  try { documents.epicsIndex = Read(`${sessionFolder}/spec/epics/_index.md`) } catch {}

  // Load individual documents
  Glob({ pattern: `${sessionFolder}/spec/requirements/REQ-*.md` }).forEach(f => { try { documents.requirements.push(Read(f)) } catch {} })
  Glob({ pattern: `${sessionFolder}/spec/requirements/NFR-*.md` }).forEach(f => { try { documents.requirements.push(Read(f)) } catch {} })
  Glob({ pattern: `${sessionFolder}/spec/architecture/ADR-*.md` }).forEach(f => { try { documents.adrs.push(Read(f)) } catch {} })
  Glob({ pattern: `${sessionFolder}/spec/epics/EPIC-*.md` }).forEach(f => { try { documents.epics.push(Read(f)) } catch {} })
  Glob({ pattern: `${sessionFolder}/discussions/discuss-*.md` }).forEach(f => { try { documents.discussions.push(Read(f)) } catch {} })

  const docInventory = {
    config: !!documents.config, discoveryContext: !!documents.discoveryContext,
    productBrief: !!documents.productBrief, requirements: documents.requirements.length > 0,
    architecture: documents.adrs.length > 0, epics: documents.epics.length > 0,
    discussions: documents.discussions.length
  }
}
```

### Phase 3: Review Execution (Branch by Mode)

**Code Review — 4-Dimension Analysis:**

```javascript
if (reviewMode === 'code') {
  const findings = { critical: [], high: [], medium: [], low: [] }

  // Quality: @ts-ignore, any, console.log, empty catch
  const qualityIssues = reviewQuality(changedFiles)

  // Security: eval/exec/innerHTML, hardcoded secrets, SQL injection, XSS
  const securityIssues = reviewSecurity(changedFiles)

  // Architecture: circular deps, large files, layering violations
  const architectureIssues = reviewArchitecture(changedFiles, fileContents)

  // Requirement Verification: plan acceptance criteria vs implementation
  const requirementIssues = plan ? verifyRequirements(plan, fileContents) : []

  const allIssues = [...qualityIssues, ...securityIssues, ...architectureIssues, ...requirementIssues]
  allIssues.forEach(issue => findings[issue.severity].push(issue))

  // Verdict determination
  const hasCritical = findings.critical.length > 0
  const verdict = hasCritical ? 'BLOCK' : findings.high.length > 3 ? 'CONDITIONAL' : 'APPROVE'
}
```

Review dimension functions:

```javascript
function reviewQuality(files) {
  const issues = []
  const tsIgnore = Grep({ pattern: '@ts-ignore|@ts-expect-error', glob: '*.{ts,tsx}', output_mode: 'content' })
  if (tsIgnore) issues.push({ type: 'quality', detail: '@ts-ignore/@ts-expect-error usage', severity: 'medium' })
  const anyType = Grep({ pattern: ': any[^A-Z]|as any', glob: '*.{ts,tsx}', output_mode: 'content' })
  if (anyType) issues.push({ type: 'quality', detail: 'Untyped `any` usage', severity: 'medium' })
  const consoleLogs = Grep({ pattern: 'console\\.log', glob: '*.{ts,tsx,js,jsx}', path: 'src/', output_mode: 'content' })
  if (consoleLogs) issues.push({ type: 'quality', detail: 'console.log in source code', severity: 'low' })
  const emptyCatch = Grep({ pattern: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}', glob: '*.{ts,tsx,js,jsx}', output_mode: 'content', multiline: true })
  if (emptyCatch) issues.push({ type: 'quality', detail: 'Empty catch blocks', severity: 'high' })
  return issues
}

function reviewSecurity(files) {
  const issues = []
  const dangerousFns = Grep({ pattern: '\\beval\\b|\\bexec\\b|innerHTML|dangerouslySetInnerHTML', glob: '*.{ts,tsx,js,jsx}', output_mode: 'content' })
  if (dangerousFns) issues.push({ type: 'security', detail: 'Dangerous function: eval/exec/innerHTML', severity: 'critical' })
  const secrets = Grep({ pattern: 'password\\s*=\\s*["\']|secret\\s*=\\s*["\']|api_key\\s*=\\s*["\']', glob: '*.{ts,tsx,js,jsx,py}', output_mode: 'content', '-i': true })
  if (secrets) issues.push({ type: 'security', detail: 'Hardcoded secrets/passwords', severity: 'critical' })
  const sqlInjection = Grep({ pattern: 'query\\s*\\(\\s*`|execute\\s*\\(\\s*`', glob: '*.{ts,js,py}', output_mode: 'content', '-i': true })
  if (sqlInjection) issues.push({ type: 'security', detail: 'Potential SQL injection via template literals', severity: 'critical' })
  const xssRisk = Grep({ pattern: 'document\\.write|window\\.location\\s*=', glob: '*.{ts,tsx,js,jsx}', output_mode: 'content' })
  if (xssRisk) issues.push({ type: 'security', detail: 'Potential XSS vectors', severity: 'high' })
  return issues
}

function reviewArchitecture(files, fileContents) {
  const issues = []
  for (const [file, content] of Object.entries(fileContents)) {
    const imports = content.match(/from\s+['"]([^'"]+)['"]/g) || []
    if (imports.filter(i => i.includes('../..')).length > 2) {
      issues.push({ type: 'architecture', detail: `${file}: excessive parent imports (layering violation)`, severity: 'medium' })
    }
    if (content.split('\n').length > 500) {
      issues.push({ type: 'architecture', detail: `${file}: ${content.split('\n').length} lines - consider splitting`, severity: 'low' })
    }
  }
  return issues
}

function verifyRequirements(plan, fileContents) {
  const issues = []
  for (const planTask of (plan.tasks || [])) {
    for (const criterion of (planTask.acceptance || [])) {
      const keywords = criterion.toLowerCase().split(/\s+/).filter(w => w.length > 4)
      const hasEvidence = keywords.some(kw => Object.values(fileContents).some(c => c.toLowerCase().includes(kw)))
      if (!hasEvidence) {
        issues.push({ type: 'requirement', detail: `Acceptance criterion may not be met: "${criterion}" (${planTask.title})`, severity: 'high' })
      }
    }
  }
  return issues
}
```

**Spec Quality — 4-Dimension Scoring:**

```javascript
if (reviewMode === 'spec') {
  const scores = { completeness: 0, consistency: 0, traceability: 0, depth: 0, requirementCoverage: 0 }

  // Completeness (25%): all sections present with content
  function scoreCompleteness(docs) {
    let score = 0
    const issues = []
    const checks = [
      { name: 'spec-config.json', present: !!docs.config, weight: 5 },
      { name: 'discovery-context.json', present: !!docs.discoveryContext, weight: 10 },
      { name: 'product-brief.md', present: !!docs.productBrief, weight: 20 },
      { name: 'requirements/_index.md', present: !!docs.requirementsIndex, weight: 15 },
      { name: 'REQ-* files', present: docs.requirements.length > 0, weight: 10 },
      { name: 'architecture/_index.md', present: !!docs.architectureIndex, weight: 15 },
      { name: 'ADR-* files', present: docs.adrs.length > 0, weight: 10 },
      { name: 'epics/_index.md', present: !!docs.epicsIndex, weight: 10 },
      { name: 'EPIC-* files', present: docs.epics.length > 0, weight: 5 }
    ]
    checks.forEach(c => { if (c.present) score += c.weight; else issues.push(`Missing: ${c.name}`) })

    // 增强: section 内容检查（不仅检查文件是否存在，还检查关键 section 是否有实质内容）
    if (docs.productBrief) {
      const briefSections = ['## Vision', '## Problem Statement', '## Target Users', '## Goals', '## Scope']
      const missingSections = briefSections.filter(s => !docs.productBrief.includes(s))
      if (missingSections.length > 0) {
        score -= missingSections.length * 3
        issues.push(`Product Brief missing sections: ${missingSections.join(', ')}`)
      }
    }

    if (docs.requirementsIndex) {
      const reqSections = ['## Functional Requirements', '## Non-Functional Requirements', '## MoSCoW Summary']
      const missingReqSections = reqSections.filter(s => !docs.requirementsIndex.includes(s))
      if (missingReqSections.length > 0) {
        score -= missingReqSections.length * 3
        issues.push(`Requirements index missing sections: ${missingReqSections.join(', ')}`)
      }
    }

    if (docs.architectureIndex) {
      const archSections = ['## Architecture Decision Records', '## Technology Stack']
      const missingArchSections = archSections.filter(s => !docs.architectureIndex.includes(s))
      if (missingArchSections.length > 0) {
        score -= missingArchSections.length * 3
        issues.push(`Architecture index missing sections: ${missingArchSections.join(', ')}`)
      }
      if (!docs.architectureIndex.includes('```mermaid')) {
        score -= 5
        issues.push('Architecture index missing Mermaid component diagram')
      }
    }

    if (docs.epicsIndex) {
      const epicsSections = ['## Epic Overview', '## MVP Scope']
      const missingEpicsSections = epicsSections.filter(s => !docs.epicsIndex.includes(s))
      if (missingEpicsSections.length > 0) {
        score -= missingEpicsSections.length * 3
        issues.push(`Epics index missing sections: ${missingEpicsSections.join(', ')}`)
      }
      if (!docs.epicsIndex.includes('```mermaid')) {
        score -= 5
        issues.push('Epics index missing Mermaid dependency diagram')
      }
    }

    return { score: Math.max(0, score), issues }
  }

  // Consistency (25%): terminology, format, references
  function scoreConsistency(docs) {
    let score = 100
    const issues = []
    const sessionId = docs.config?.session_id
    if (sessionId && docs.productBrief && !docs.productBrief.includes(sessionId)) {
      score -= 15; issues.push('Product Brief missing session_id reference')
    }
    const docsWithFM = [docs.productBrief, docs.requirementsIndex, docs.architectureIndex, docs.epicsIndex].filter(Boolean)
    const hasFM = docsWithFM.map(d => /^---\n[\s\S]+?\n---/.test(d))
    if (!hasFM.every(v => v === hasFM[0])) {
      score -= 20; issues.push('Inconsistent YAML frontmatter across documents')
    }
    return { score: Math.max(0, score), issues }
  }

  // Traceability (25%): goals → reqs → arch → stories chain
  function scoreTraceability(docs) {
    let score = 0
    const issues = []
    if (docs.productBrief && docs.requirementsIndex) {
      if (docs.requirements.some(r => /goal|brief|vision/i.test(r))) score += 25
      else issues.push('Requirements lack references to Product Brief goals')
    }
    if (docs.requirementsIndex && docs.architectureIndex) {
      if (docs.adrs.some(a => /REQ-|requirement/i.test(a))) score += 25
      else issues.push('Architecture ADRs lack requirement references')
    }
    if (docs.requirementsIndex && docs.epicsIndex) {
      if (docs.epics.some(e => /REQ-|requirement/i.test(e))) score += 25
      else issues.push('Epics/Stories lack requirement tracing')
    }
    if (score >= 50) score += 25
    return { score: Math.min(100, score), issues }
  }

  // Depth (25%): AC testable, ADRs justified, stories estimable
  function scoreDepth(docs) {
    let score = 100
    const issues = []
    if (!docs.requirements.some(r => /acceptance|criteria|验收/i.test(r) && r.length > 200)) {
      score -= 25; issues.push('Acceptance criteria may lack specificity')
    }
    if (docs.adrs.length > 0 && !docs.adrs.some(a => /alternative|替代|pros|cons/i.test(a))) {
      score -= 25; issues.push('ADRs lack alternatives analysis')
    }
    if (docs.epics.length > 0 && !docs.epics.some(e => /\b[SMLX]{1,2}\b|Small|Medium|Large/.test(e))) {
      score -= 25; issues.push('Stories lack size estimates')
    }
    if (![docs.architectureIndex, docs.epicsIndex].some(d => d && /```mermaid/.test(d))) {
      score -= 10; issues.push('Missing Mermaid diagrams')
    }
    return { score: Math.max(0, score), issues }
  }

  // Requirement Coverage (20%): original requirements → document mapping
  function scoreRequirementCoverage(docs) {
    let score = 100
    const issues = []
    if (!docs.discoveryContext) {
      return { score: 0, issues: ['discovery-context.json missing, cannot verify requirement coverage'] }
    }
    const context = typeof docs.discoveryContext === 'string' ? JSON.parse(docs.discoveryContext) : docs.discoveryContext
    const dimensions = context.seed_analysis?.exploration_dimensions || []
    const constraints = context.seed_analysis?.constraints || []
    const userSupplements = context.seed_analysis?.user_supplements || ''
    const allRequirements = [...dimensions, ...constraints]
    if (userSupplements) allRequirements.push(userSupplements)

    if (allRequirements.length === 0) {
      return { score: 100, issues: [] } // No requirements to check
    }

    const allDocContent = [docs.productBrief, docs.requirementsIndex, docs.architectureIndex, docs.epicsIndex,
      ...docs.requirements, ...docs.adrs, ...docs.epics].filter(Boolean).join('\n').toLowerCase()

    let covered = 0
    for (const req of allRequirements) {
      const keywords = req.toLowerCase().split(/[\s,;]+/).filter(w => w.length > 2)
      const isCovered = keywords.some(kw => allDocContent.includes(kw))
      if (isCovered) { covered++ }
      else { issues.push(`Requirement not covered in documents: "${req}"`) }
    }

    score = Math.round((covered / allRequirements.length) * 100)
    return { score, issues }
  }

  const completenessResult = scoreCompleteness(documents)
  const consistencyResult = scoreConsistency(documents)
  const traceabilityResult = scoreTraceability(documents)
  const depthResult = scoreDepth(documents)
  const coverageResult = scoreRequirementCoverage(documents)

  scores.completeness = completenessResult.score
  scores.consistency = consistencyResult.score
  scores.traceability = traceabilityResult.score
  scores.depth = depthResult.score
  scores.requirementCoverage = coverageResult.score

  const overallScore = (scores.completeness + scores.consistency + scores.traceability + scores.depth + scores.requirementCoverage) / 5
  const qualityGate = (overallScore >= 80 && scores.requirementCoverage >= 70) ? 'PASS' :
    (overallScore < 60 || scores.requirementCoverage < 50) ? 'FAIL' : 'REVIEW'
  const allSpecIssues = [...completenessResult.issues, ...consistencyResult.issues, ...traceabilityResult.issues, ...depthResult.issues, ...coverageResult.issues]
}
```

### Phase 4: Report Generation (Branch by Mode)

**Code Review — Generate Recommendations:**

```javascript
if (reviewMode === 'code') {
  const totalIssues = Object.values(findings).flat().length
  const recommendations = []
  if (hasCritical) recommendations.push('Fix all critical security issues before merging')
  if (findings.high.length > 0) recommendations.push('Address high severity issues in a follow-up')
  if (findings.medium.length > 3) recommendations.push('Consider refactoring to reduce medium severity issues')
}
```

**Spec Quality — Generate Reports:**

```javascript
if (reviewMode === 'spec') {
  // Generate readiness-report.md
  const readinessReport = `---
session_id: ${documents.config?.session_id || 'unknown'}
phase: 6
document_type: readiness-report
status: complete
generated_at: ${new Date().toISOString()}
version: 1
---

# Readiness Report

## Quality Scores
| Dimension | Score | Weight |
|-----------|-------|--------|
| Completeness | ${scores.completeness}% | 20% |
| Consistency | ${scores.consistency}% | 20% |
| Traceability | ${scores.traceability}% | 20% |
| Depth | ${scores.depth}% | 20% |
| Requirement Coverage | ${scores.requirementCoverage}% | 20% |
| **Overall** | **${overallScore.toFixed(1)}%** | **100%** |

## Quality Gate: ${qualityGate}

## Per-Phase Quality Gates
${qualityGates ? `_(Applied from ../specs/quality-gates.md)_

### Phase 2 (Product Brief)
- Vision statement: ${docs.productBrief?.includes('## Vision') ? 'PASS' : 'MISSING'}
- Problem statement specificity: ${docs.productBrief?.match(/## Problem/)?.length ? 'PASS' : 'MISSING'}
- Target users >= 1: ${docs.productBrief?.includes('## Target Users') ? 'PASS' : 'MISSING'}
- Measurable goals >= 2: ${docs.productBrief?.includes('## Goals') ? 'PASS' : 'MISSING'}

### Phase 3 (Requirements)
- Functional requirements >= 3: ${docs.requirements.length >= 3 ? 'PASS' : 'FAIL (' + docs.requirements.length + ')'}
- Acceptance criteria present: ${docs.requirements.some(r => /acceptance|criteria/i.test(r)) ? 'PASS' : 'MISSING'}
- MoSCoW priority tags: ${docs.requirementsIndex?.includes('Must') ? 'PASS' : 'MISSING'}

### Phase 4 (Architecture)
- Component diagram: ${docs.architectureIndex?.includes('mermaid') ? 'PASS' : 'MISSING'}
- ADR with alternatives: ${docs.adrs.some(a => /alternative|option/i.test(a)) ? 'PASS' : 'MISSING'}
- Tech stack specified: ${docs.architectureIndex?.includes('Technology') ? 'PASS' : 'MISSING'}

### Phase 5 (Epics)
- MVP subset tagged: ${docs.epics.some(e => /mvp:\s*true/i.test(e)) ? 'PASS' : 'MISSING'}
- Dependency map: ${docs.epicsIndex?.includes('mermaid') ? 'PASS' : 'MISSING'}
- Story sizing: ${docs.epics.some(e => /\b[SMLX]{1,2}\b|Small|Medium|Large/.test(e)) ? 'PASS' : 'MISSING'}
` : '_(quality-gates.md not loaded)_'}

## Issues Found
${allSpecIssues.map(i => '- ' + i).join('\n') || 'None'}

## Document Inventory
${Object.entries(docInventory).map(([k, v]) => '- ' + k + ': ' + (v === true ? '✓' : v === false ? '✗' : v)).join('\n')}
`
  Write(`${sessionFolder}/spec/readiness-report.md`, readinessReport)

  // Generate spec-summary.md
  const specSummary = `---
session_id: ${documents.config?.session_id || 'unknown'}
phase: 6
document_type: spec-summary
status: complete
generated_at: ${new Date().toISOString()}
version: 1
---

# Specification Summary

**Topic**: ${documents.config?.topic || 'N/A'}
**Complexity**: ${documents.config?.complexity || 'N/A'}
**Quality Score**: ${overallScore.toFixed(1)}% (${qualityGate})
**Discussion Rounds**: ${documents.discussions.length}

## Key Deliverables
- Product Brief: ${docInventory.productBrief ? '✓' : '✗'}
- Requirements (PRD): ${docInventory.requirements ? '✓ (' + documents.requirements.length + ' items)' : '✗'}
- Architecture: ${docInventory.architecture ? '✓ (' + documents.adrs.length + ' ADRs)' : '✗'}
- Epics & Stories: ${docInventory.epics ? '✓ (' + documents.epics.length + ' epics)' : '✗'}

## Next Steps
${qualityGate === 'PASS' ? '- Ready for handoff to execution workflows' :
  qualityGate === 'REVIEW' ? '- Address review items, then proceed to execution' :
  '- Fix critical issues before proceeding'}
`
  Write(`${sessionFolder}/spec/spec-summary.md`, specSummary)
}
```

### Phase 5: Report to Coordinator (Branch by Mode)

**Code Review Report:**

```javascript
if (reviewMode === 'code') {
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName,
    from: "reviewer", to: "coordinator",
    type: hasCritical ? "fix_required" : "review_result",
    summary: `REVIEW ${verdict}: ${totalIssues}个发现 (critical=${findings.critical.length}, high=${findings.high.length})`,
    data: { verdict, critical: findings.critical.length, high: findings.high.length, medium: findings.medium.length, low: findings.low.length }
  })

  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `## Code Review Report

**Task**: ${task.subject}
**Verdict**: ${verdict}
**Files Reviewed**: ${changedFiles.length}
**Total Findings**: ${totalIssues}

### Finding Summary
- Critical: ${findings.critical.length}
- High: ${findings.high.length}
- Medium: ${findings.medium.length}
- Low: ${findings.low.length}

${findings.critical.length > 0 ? '### Critical Issues\n' + findings.critical.map(f => '- [' + f.type.toUpperCase() + '] ' + f.detail).join('\n') + '\n' : ''}
${findings.high.length > 0 ? '### High Severity\n' + findings.high.map(f => '- [' + f.type.toUpperCase() + '] ' + f.detail).join('\n') + '\n' : ''}
### Recommendations
${recommendations.map(r => '- ' + r).join('\n')}

${plan ? '### Requirement Verification\n' + (plan.tasks || []).map(t => '- **' + t.title + '**: ' + (requirementIssues.filter(i => i.detail.includes(t.title)).length === 0 ? 'Met' : 'Needs verification')).join('\n') : ''}`,
    summary: `Review: ${verdict} (${totalIssues} findings)`
  })

  if (!hasCritical) {
    TaskUpdate({ taskId: task.id, status: 'completed' })
  }
  // If critical, keep in_progress for coordinator to create fix tasks
}
```

**Spec Quality Report:**

```javascript
if (reviewMode === 'spec') {
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName,
    from: "reviewer", to: "coordinator",
    type: qualityGate === 'FAIL' ? "fix_required" : "quality_result",
    summary: `质量检查 ${qualityGate}: ${overallScore.toFixed(1)}分 (完整性${scores.completeness}/一致性${scores.consistency}/追溯${scores.traceability}/深度${scores.depth}/覆盖率${scores.requirementCoverage})`,
    data: { gate: qualityGate, score: overallScore, issues: allSpecIssues }
  })

  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `## 质量审查报告

**Task**: ${task.subject}
**总分**: ${overallScore.toFixed(1)}%
**Gate**: ${qualityGate}

### 评分详情
| 维度 | 分数 |
|------|------|
| 完整性 | ${scores.completeness}% |
| 一致性 | ${scores.consistency}% |
| 可追溯性 | ${scores.traceability}% |
| 深度 | ${scores.depth}% |
| 需求覆盖率 | ${scores.requirementCoverage}% |

### 问题列表 (${allSpecIssues.length})
${allSpecIssues.map(i => '- ' + i).join('\n') || '无问题'}

### 文档清单
${Object.entries(docInventory).map(([k, v]) => '- ' + k + ': ' + (typeof v === 'boolean' ? (v ? '✓' : '✗') : v)).join('\n')}

### 输出位置
- 就绪报告: ${sessionFolder}/spec/readiness-report.md
- 执行摘要: ${sessionFolder}/spec/spec-summary.md

${qualityGate === 'PASS' ? '质量达标，可进入最终讨论轮次 DISCUSS-006。' :
  qualityGate === 'REVIEW' ? '质量基本达标但有改进空间，建议在讨论中审查。' :
  '质量未达标，建议创建 DRAFT-fix 任务修复关键问题。'}`,
    summary: `质量 ${qualityGate}: ${overallScore.toFixed(1)}分`
  })

  if (qualityGate !== 'FAIL') {
    TaskUpdate({ taskId: task.id, status: 'completed' })
  }
}

// Check for next REVIEW-* or QUALITY-* task → back to Phase 1
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No REVIEW-*/QUALITY-* tasks available | Idle, wait for coordinator assignment |
| Plan file not found (code review) | Review without requirement verification, note in report |
| No changed files detected | Report to coordinator, may need manual file list |
| Documents missing (spec quality) | Score as 0 for completeness, report to coordinator |
| Cannot parse YAML frontmatter | Skip consistency check for that document |
| Grep pattern errors | Skip specific check, continue with remaining |
| CLI analysis timeout | Report partial results, note incomplete analysis |
| Session folder not found | Notify coordinator, request session path |
| Unexpected error | Log error via team_msg, report to coordinator |
