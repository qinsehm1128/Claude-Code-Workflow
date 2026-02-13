# Phase 5: Validation

Verify quality and deliver the final skill package.

## Objective

- Per-role structural completeness check
- Per-role pattern compliance check
- Quality scoring
- Deliver final skill package to `.claude/skills/team-{name}/`

## Input

- Dependency: `{workDir}/preview/` (Phase 3), `integration-report.json` (Phase 4)
- Specification: `specs/quality-standards.md`

## Execution Steps

### Step 1: Load Files

```javascript
const config = JSON.parse(Read(`${workDir}/team-config.json`))
const integration = JSON.parse(Read(`${workDir}/integration-report.json`))
const previewDir = `${workDir}/preview`
const skillMd = Read(`${previewDir}/SKILL.md`)

const roleContents = {}
for (const role of config.roles) {
  try {
    roleContents[role.name] = Read(`${previewDir}/roles/${role.name}.md`)
  } catch {
    roleContents[role.name] = null
  }
}
```

### Step 2: SKILL.md Structural Check

```javascript
const skillChecks = [
  { name: "Frontmatter", pattern: /^---\n[\s\S]+?\n---/ },
  { name: "Architecture Overview", pattern: /## Architecture Overview/ },
  { name: "Role Router", pattern: /## Role Router/ },
  { name: "Role Dispatch Code", pattern: /VALID_ROLES/ },
  { name: "Available Roles Table", pattern: /\| Role \| Task Prefix/ },
  { name: "Shared Infrastructure", pattern: /## Shared Infrastructure/ },
  { name: "Message Bus Section", pattern: /Message Bus/ },
  { name: "team_msg Example", pattern: /team_msg/ },
  { name: "CLI Fallback", pattern: /ccw team log/ },
  { name: "Task Lifecycle", pattern: /Task Lifecycle/ },
  { name: "Pipeline Diagram", pattern: /## Pipeline/ },
  { name: "Coordinator Spawn Template", pattern: /Coordinator Spawn/ },
  { name: "Error Handling", pattern: /## Error Handling/ }
]

const skillResults = skillChecks.map(c => ({
  check: c.name,
  status: c.pattern.test(skillMd) ? 'PASS' : 'FAIL'
}))

const skillScore = skillResults.filter(r => r.status === 'PASS').length / skillResults.length * 100
```

### Step 3: Per-Role Structural Check

```javascript
const roleChecks = [
  { name: "Role Identity", pattern: /## Role Identity/ },
  { name: "Message Types Table", pattern: /## Message Types/ },
  { name: "5-Phase Execution", pattern: /## Execution/ },
  { name: "Phase 1 Task Discovery", pattern: /Phase 1.*Task Discovery/i },
  { name: "TaskList Usage", pattern: /TaskList/ },
  { name: "TaskGet Usage", pattern: /TaskGet/ },
  { name: "TaskUpdate Usage", pattern: /TaskUpdate/ },
  { name: "team_msg Before SendMessage", pattern: /team_msg/ },
  { name: "SendMessage to Coordinator", pattern: /SendMessage/ },
  { name: "Error Handling", pattern: /## Error Handling/ }
]

const roleResults = {}
for (const [name, content] of Object.entries(roleContents)) {
  if (!content) {
    roleResults[name] = { status: 'MISSING', checks: [], score: 0 }
    continue
  }

  const checks = roleChecks.map(c => ({
    check: c.name,
    status: c.pattern.test(content) ? 'PASS' : 'FAIL'
  }))

  const score = checks.filter(c => c.status === 'PASS').length / checks.length * 100
  roleResults[name] = { status: score >= 80 ? 'PASS' : 'PARTIAL', checks, score }
}
```

### Step 4: Quality Scoring

```javascript
const scores = {
  skill_md: skillScore,
  roles_avg: Object.values(roleResults).reduce((sum, r) => sum + r.score, 0) / Object.keys(roleResults).length,
  integration: integration.overall === 'PASS' ? 100 : 50,
  consistency: checkConsistency()
}

function checkConsistency() {
  let score = 100
  // Check skill name in SKILL.md matches config
  if (!skillMd.includes(config.skill_name)) score -= 20
  // Check team name consistency
  if (!skillMd.includes(config.team_name)) score -= 20
  // Check all roles referenced in SKILL.md
  for (const role of config.roles) {
    if (!skillMd.includes(role.name)) score -= 10
  }
  return Math.max(0, score)
}

const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
const qualityGate = overallScore >= 80 ? 'PASS' : overallScore >= 60 ? 'REVIEW' : 'FAIL'
```

### Step 5: Generate Validation Report

```javascript
const report = {
  team_name: config.team_name,
  skill_name: config.skill_name,
  timestamp: new Date().toISOString(),
  scores: scores,
  overall_score: overallScore,
  quality_gate: qualityGate,
  skill_md_checks: skillResults,
  role_results: roleResults,
  integration_status: integration.overall,
  delivery: {
    source: previewDir,
    destination: `.claude/skills/${config.skill_name}/`,
    ready: qualityGate !== 'FAIL'
  }
}

Write(`${workDir}/validation-report.json`, JSON.stringify(report, null, 2))
```

### Step 6: Deliver Final Package

```javascript
if (report.delivery.ready) {
  const destDir = `.claude/skills/${config.skill_name}`

  // Create directory structure
  Bash(`mkdir -p "${destDir}/roles" "${destDir}/specs"`)

  // Copy all files
  Write(`${destDir}/SKILL.md`, skillMd)

  for (const [name, content] of Object.entries(roleContents)) {
    if (content) {
      Write(`${destDir}/roles/${name}.md`, content)
    }
  }

  // Copy team config
  const teamConfig = Read(`${previewDir}/specs/team-config.json`)
  Write(`${destDir}/specs/team-config.json`, teamConfig)

  // Report
  console.log(`\nTeam skill delivered to: ${destDir}/`)
  console.log(`Skill name: ${config.skill_name}`)
  console.log(`Quality score: ${overallScore.toFixed(1)}% (${qualityGate})`)
  console.log(`Roles: ${config.role_list}`)
  console.log(`\nUsage:`)
  console.log(`  Skill(skill="${config.skill_name}", args="--role=planner")`)
  console.log(`  Skill(skill="${config.skill_name}", args="--role=executor")`)
  console.log(`\nFile structure:`)
  Bash(`find "${destDir}" -type f | sort`)
} else {
  console.log(`Validation FAILED (score: ${overallScore.toFixed(1)}%)`)
  console.log('Fix issues and re-run Phase 3-5')
}
```

## Output

- **File**: `validation-report.json`
- **Format**: JSON
- **Location**: `{workDir}/validation-report.json`
- **Delivery**: `.claude/skills/team-{name}/` (if validation passes)

## Quality Checklist

- [ ] SKILL.md passes all 13 structural checks
- [ ] All role files pass structural checks (>= 80%)
- [ ] Integration report is PASS
- [ ] Overall score >= 80%
- [ ] Final package delivered to `.claude/skills/team-{name}/`
- [ ] Usage instructions provided

## Completion

This is the final phase. The unified team skill is ready for use.
