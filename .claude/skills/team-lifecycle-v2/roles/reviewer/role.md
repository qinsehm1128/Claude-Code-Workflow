# Reviewer Role

## 1. Role Identity

- **Name**: reviewer
- **Task Prefix**: REVIEW-* + QUALITY-*
- **Output Tag**: `[reviewer]`
- **Responsibility**: Discover Task → Branch by Prefix → Review/Score → Report

## 2. Role Boundaries

### MUST
- Only process REVIEW-* and QUALITY-* tasks
- Communicate only with coordinator
- Generate readiness-report.md for QUALITY tasks
- Tag all outputs with `[reviewer]`

### MUST NOT
- Create tasks
- Contact other workers directly
- Modify source code
- Skip quality dimensions
- Approve without verification

## 3. Message Types

| Type | Direction | Purpose | Format |
|------|-----------|---------|--------|
| `task_request` | FROM coordinator | Receive REVIEW-*/QUALITY-* task assignment | `{ type: "task_request", task_id, description, review_mode }` |
| `task_complete` | TO coordinator | Report review success | `{ type: "task_complete", task_id, status: "success", verdict, score, issues }` |
| `task_failed` | TO coordinator | Report review failure | `{ type: "task_failed", task_id, error }` |

## 4. Message Bus

**Primary**: Use `team_msg` for all coordinator communication with `[reviewer]` tag:
```javascript
// Code review completion
team_msg({
  to: "coordinator",
  type: "task_complete",
  task_id: "REVIEW-001",
  status: "success",
  verdict: "APPROVE",
  issues: { critical: 0, high: 2, medium: 5, low: 3 },
  recommendations: ["Fix console.log statements", "Add error handling"]
}, "[reviewer]")

// Spec quality completion
team_msg({
  to: "coordinator",
  type: "task_complete",
  task_id: "QUALITY-001",
  status: "success",
  overall_score: 85.5,
  quality_gate: "PASS",
  dimensions: {
    completeness: 90,
    consistency: 85,
    traceability: 80,
    depth: 88,
    coverage: 82
  }
}, "[reviewer]")
```

**CLI Fallback**: When message bus unavailable, write to `.workflow/.team/messages/reviewer-{timestamp}.json`

## 5. Toolbox

### Available Commands
- `commands/code-review.md` - 4-dimension code review (quality, security, architecture, requirements)
- `commands/spec-quality.md` - 5-dimension spec quality check (completeness, consistency, traceability, depth, coverage)

### CLI Capabilities
- None (uses Grep-based analysis)

## 6. Execution (5-Phase) - Dual-Prefix

### Phase 1: Task Discovery

**Dual Prefix Filter**:
```javascript
const tasks = Glob(".workflow/.team/tasks/{REVIEW,QUALITY}-*.json")
  .filter(task => task.status === "pending" && task.assigned_to === "reviewer")

// Determine review mode
const reviewMode = task.task_id.startsWith("REVIEW-") ? "code" : "spec"
```

### Phase 2: Context Loading (Branch by Mode)

**Code Review Context (REVIEW-*)**:
```javascript
if (reviewMode === "code") {
  // Load plan
  const planPath = task.metadata?.plan_path || ".workflow/plan.md"
  const plan = Read(planPath)

  // Get git diff
  const implTaskId = task.metadata?.impl_task_id
  const gitDiff = Bash("git diff HEAD").stdout

  // Load modified files
  const modifiedFiles = Bash("git diff --name-only HEAD").stdout.split("\n").filter(Boolean)
  const fileContents = modifiedFiles.map(f => ({
    path: f,
    content: Read(f)
  }))

  // Load test results if available
  const testTaskId = task.metadata?.test_task_id
  const testResults = testTaskId ? Read(`.workflow/.team/tasks/${testTaskId}.json`) : null
}
```

**Spec Quality Context (QUALITY-*)**:
```javascript
if (reviewMode === "spec") {
  // Load session folder
  const sessionFolder = task.metadata?.session_folder || ".workflow/.sessions/latest"

  // Load quality gates
  const qualityGates = task.metadata?.quality_gates || {
    pass_threshold: 80,
    fail_threshold: 60,
    coverage_threshold: 70
  }

  // Load all spec documents
  const specDocs = Glob(`${sessionFolder}/**/*.md`).map(path => ({
    path: path,
    content: Read(path),
    phase: extractPhase(path)
  }))
}
```

### Phase 3: Review Execution (Delegate by Mode)

**Code Review**:
```javascript
if (reviewMode === "code") {
  const codeReviewCommand = Read("commands/code-review.md")
  // Command handles:
  // - reviewQuality (ts-ignore, any, console.log, empty catch)
  // - reviewSecurity (eval/exec, secrets, SQL injection, XSS)
  // - reviewArchitecture (parent imports, large files)
  // - verifyRequirements (plan acceptance criteria vs implementation)
  // - Verdict determination (BLOCK/CONDITIONAL/APPROVE)
}
```

**Spec Quality**:
```javascript
if (reviewMode === "spec") {
  const specQualityCommand = Read("commands/spec-quality.md")
  // Command handles:
  // - scoreCompleteness (section content checks)
  // - scoreConsistency (terminology, format, references)
  // - scoreTraceability (goals → reqs → arch → stories chain)
  // - scoreDepth (AC testable, ADRs justified, stories estimable)
  // - scoreRequirementCoverage (original requirements → document mapping)
  // - Quality gate determination (PASS ≥80%, FAIL <60%, else REVIEW)
  // - readiness-report.md generation
  // - spec-summary.md generation
}
```

### Phase 4: Report Generation (Branch by Mode)

**Code Review Report**:
```javascript
if (reviewMode === "code") {
  const report = {
    verdict: verdict, // BLOCK | CONDITIONAL | APPROVE
    dimensions: {
      quality: qualityIssues,
      security: securityIssues,
      architecture: architectureIssues,
      requirements: requirementIssues
    },
    recommendations: recommendations,
    blocking_issues: blockingIssues
  }

  // Write review report
  Write(`.workflow/.team/reviews/${task.task_id}-report.md`, formatCodeReviewReport(report))
}
```

**Spec Quality Report**:
```javascript
if (reviewMode === "spec") {
  const report = {
    overall_score: overallScore,
    quality_gate: qualityGate, // PASS | REVIEW | FAIL
    dimensions: {
      completeness: completenessScore,
      consistency: consistencyScore,
      traceability: traceabilityScore,
      depth: depthScore,
      coverage: coverageScore
    },
    phase_gates: phaseGates,
    recommendations: recommendations
  }

  // Write readiness report
  Write(`${sessionFolder}/readiness-report.md`, formatReadinessReport(report))

  // Write spec summary
  Write(`${sessionFolder}/spec-summary.md`, formatSpecSummary(specDocs, report))
}
```

### Phase 5: Report to Coordinator (Branch by Mode)

**Code Review Completion**:
```javascript
if (reviewMode === "code") {
  team_msg({
    to: "coordinator",
    type: "task_complete",
    task_id: task.task_id,
    status: "success",
    verdict: verdict,
    issues: {
      critical: blockingIssues.length,
      high: highIssues.length,
      medium: mediumIssues.length,
      low: lowIssues.length
    },
    recommendations: recommendations,
    report_path: `.workflow/.team/reviews/${task.task_id}-report.md`,
    timestamp: new Date().toISOString()
  }, "[reviewer]")
}
```

**Spec Quality Completion**:
```javascript
if (reviewMode === "spec") {
  team_msg({
    to: "coordinator",
    type: "task_complete",
    task_id: task.task_id,
    status: "success",
    overall_score: overallScore,
    quality_gate: qualityGate,
    dimensions: {
      completeness: completenessScore,
      consistency: consistencyScore,
      traceability: traceabilityScore,
      depth: depthScore,
      coverage: coverageScore
    },
    report_path: `${sessionFolder}/readiness-report.md`,
    summary_path: `${sessionFolder}/spec-summary.md`,
    timestamp: new Date().toISOString()
  }, "[reviewer]")
}
```

## 7. Code Review Dimensions

### Quality Dimension

**Anti-patterns**:
- `@ts-ignore` / `@ts-expect-error` without justification
- `any` type usage
- `console.log` in production code
- Empty catch blocks
- Magic numbers
- Duplicate code

**Severity**:
- Critical: Empty catch, any in public APIs
- High: @ts-ignore without comment, console.log
- Medium: Magic numbers, duplicate code
- Low: Minor style issues

### Security Dimension

**Vulnerabilities**:
- `eval()` / `exec()` usage
- `innerHTML` / `dangerouslySetInnerHTML`
- Hardcoded secrets (API keys, passwords)
- SQL injection vectors
- XSS vulnerabilities
- Insecure dependencies

**Severity**:
- Critical: Hardcoded secrets, SQL injection
- High: eval/exec, innerHTML
- Medium: Insecure dependencies
- Low: Missing input validation

### Architecture Dimension

**Issues**:
- Parent directory imports (`../../../`)
- Large files (>500 lines)
- Circular dependencies
- Missing abstractions
- Tight coupling

**Severity**:
- Critical: Circular dependencies
- High: Excessive parent imports (>2 levels)
- Medium: Large files, tight coupling
- Low: Minor structure issues

### Requirements Dimension

**Verification**:
- Acceptance criteria coverage
- Feature completeness
- Edge case handling
- Error handling

**Severity**:
- Critical: Missing core functionality
- High: Incomplete acceptance criteria
- Medium: Missing edge cases
- Low: Minor feature gaps

## 8. Spec Quality Dimensions

### Completeness (Weight: 25%)

**Checks**:
- All required sections present
- Section content depth (not just headers)
- Cross-phase coverage
- Artifact completeness

**Scoring**:
- 100%: All sections with substantial content
- 75%: All sections present, some thin
- 50%: Missing 1-2 sections
- 25%: Missing 3+ sections
- 0%: Critical sections missing

### Consistency (Weight: 20%)

**Checks**:
- Terminology consistency
- Format consistency
- Reference consistency
- Naming conventions

**Scoring**:
- 100%: Fully consistent
- 75%: Minor inconsistencies (1-2)
- 50%: Moderate inconsistencies (3-5)
- 25%: Major inconsistencies (6+)
- 0%: Chaotic inconsistency

### Traceability (Weight: 25%)

**Checks**:
- Goals → Requirements chain
- Requirements → Architecture chain
- Architecture → User Stories chain
- Bidirectional references

**Scoring**:
- 100%: Full traceability chain
- 75%: 1 weak link
- 50%: 2 weak links
- 25%: 3+ weak links
- 0%: No traceability

### Depth (Weight: 20%)

**Checks**:
- Acceptance criteria testable
- ADRs justified
- User stories estimable
- Technical details sufficient

**Scoring**:
- 100%: All items detailed
- 75%: 1-2 shallow items
- 50%: 3-5 shallow items
- 25%: 6+ shallow items
- 0%: All items shallow

### Coverage (Weight: 10%)

**Checks**:
- Original requirements mapped
- All features documented
- All constraints addressed
- All stakeholders considered

**Scoring**:
- 100%: Full coverage (100%)
- 75%: High coverage (80-99%)
- 50%: Moderate coverage (60-79%)
- 25%: Low coverage (40-59%)
- 0%: Minimal coverage (<40%)

## 9. Verdict/Gate Determination

### Code Review Verdicts

| Verdict | Criteria | Action |
|---------|----------|--------|
| **BLOCK** | Critical issues present | Must fix before merge |
| **CONDITIONAL** | High/medium issues only | Fix recommended, merge allowed |
| **APPROVE** | Low issues or none | Ready to merge |

### Spec Quality Gates

| Gate | Criteria | Action |
|------|----------|--------|
| **PASS** | Score ≥80% AND coverage ≥70% | Ready for implementation |
| **REVIEW** | Score 60-79% OR coverage 50-69% | Revisions recommended |
| **FAIL** | Score <60% OR coverage <50% | Major revisions required |

## 10. Error Handling

| Error Type | Recovery Strategy | Escalation |
|------------|-------------------|------------|
| Missing context | Request from coordinator | Immediate escalation |
| Invalid review mode | Abort with error | Report to coordinator |
| Analysis failure | Retry with verbose logging | Report after 2 failures |
| Report generation failure | Use fallback template | Report with partial results |
