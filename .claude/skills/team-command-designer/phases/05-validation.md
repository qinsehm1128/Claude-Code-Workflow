# Phase 5: Validation

Verify completeness and quality of the generated team command.

## Objective

- Check all required sections exist
- Verify pattern compliance
- Score against quality standards
- Generate validation report
- Deliver final command file

## Input

- Dependency: `{role-name}.md` (Phase 3), `integration-report.json` (Phase 4)
- Specification: `specs/quality-standards.md`

## Execution Steps

### Step 1: Load Files

```javascript
const config = JSON.parse(Read(`${workDir}/role-config.json`))
const command = Read(`${workDir}/${config.role_name}.md`)
const integration = JSON.parse(Read(`${workDir}/integration-report.json`))
```

### Step 2: Structural Completeness Check

```javascript
const requiredSections = [
  { name: "YAML Front Matter", pattern: /^---\n[\s\S]+?\n---/ },
  { name: "group: team", pattern: /group:\s*team/ },
  { name: "Overview Section", pattern: /## Overview/ },
  { name: "Role Definition", pattern: /## Role Definition/ },
  { name: "Message Bus Section", pattern: /## .*[Mm]essage.*[Bb]us/ },
  { name: "team_msg Examples", pattern: /mcp__ccw-tools__team_msg/ },
  { name: "Message Types Table", pattern: /\| Type \| Direction/ },
  { name: "Execution Process", pattern: /## Execution Process/ },
  { name: "Phase 1: Task Discovery", pattern: /Phase 1.*Task Discovery/i },
  { name: "TaskList Usage", pattern: /TaskList/ },
  { name: "TaskGet Usage", pattern: /TaskGet/ },
  { name: "TaskUpdate Usage", pattern: /TaskUpdate/ },
  { name: "SendMessage to Coordinator", pattern: /SendMessage.*coordinator/i },
  { name: "CLI Fallback Section", pattern: /CLI 回退|CLI Fallback/ },
  { name: "ccw team CLI Example", pattern: /ccw team log/ },
  { name: "Error Handling Table", pattern: /## Error Handling/ },
  { name: "Implementation Section", pattern: /## Implementation/ }
]

const structureResults = requiredSections.map(section => ({
  section: section.name,
  present: section.pattern.test(command),
  status: section.pattern.test(command) ? 'PASS' : 'FAIL'
}))

const structureScore = structureResults.filter(r => r.status === 'PASS').length /
  structureResults.length * 100
```

### Step 3: Pattern Compliance Check

```javascript
const patternChecks = [
  {
    name: "Message Bus Before SendMessage",
    check: () => {
      // Every SendMessage should be preceded by team_msg
      const sendMessages = command.match(/SendMessage\(/g)?.length || 0
      const teamMsgs = command.match(/team_msg\(/g)?.length || 0
      return teamMsgs >= sendMessages
    },
    severity: "critical"
  },
  {
    name: "Task Lifecycle Pattern",
    check: () => {
      return command.includes('TaskList') &&
             command.includes('TaskGet') &&
             command.includes("status: 'in_progress'") &&
             command.includes("status: 'completed'")
    },
    severity: "critical"
  },
  {
    name: "Task Prefix Usage",
    check: () => {
      return command.includes(`'${config.task_prefix}-'`)
    },
    severity: "high"
  },
  {
    name: "Coordinator-Only Communication",
    check: () => {
      return command.includes('recipient: "coordinator"') &&
             !command.includes('recipient: "executor"') &&
             !command.includes('recipient: "planner"')
    },
    severity: "high"
  },
  {
    name: "Next Task Loop",
    check: () => {
      return command.includes('Check for next') ||
             command.includes('back to Phase 1')
    },
    severity: "medium"
  },
  {
    name: "Idle on No Tasks",
    check: () => {
      return command.includes('idle') || command.includes('return')
    },
    severity: "medium"
  },
  {
    name: "CLI Fallback Present",
    check: () => {
      return (command.includes('CLI 回退') || command.includes('CLI Fallback')) &&
             command.includes('ccw team log')
    },
    severity: "high"
  }
]

const patternResults = patternChecks.map(pc => ({
  pattern: pc.name,
  compliant: pc.check(),
  severity: pc.severity,
  status: pc.check() ? 'PASS' : 'FAIL'
}))

const criticalFails = patternResults.filter(r =>
  r.status === 'FAIL' && r.severity === 'critical'
)
```

### Step 4: Quality Scoring

```javascript
const qualityDimensions = {
  completeness: structureScore,
  pattern_compliance: patternResults.filter(r => r.status === 'PASS').length /
    patternResults.length * 100,
  integration: integration.overall === 'PASS' ? 100 : 50,
  consistency: checkConsistency(command, config)
}

function checkConsistency(command, config) {
  let score = 100
  // Check role name consistency
  if (!command.includes(config.role_name)) score -= 20
  // Check task prefix consistency
  if (!command.includes(config.task_prefix)) score -= 20
  // Check front matter matches config
  if (!command.includes(`name: ${config.role_name}`)) score -= 20
  // Check group: team
  if (!command.includes('group: team')) score -= 20
  return Math.max(0, score)
}

const overallScore = Object.values(qualityDimensions)
  .reduce((a, b) => a + b, 0) / Object.keys(qualityDimensions).length

const qualityGate = overallScore >= 80 ? 'PASS' :
                    overallScore >= 60 ? 'REVIEW' : 'FAIL'
```

### Step 5: Generate Validation Report

```javascript
const report = {
  role_name: config.role_name,
  timestamp: new Date().toISOString(),
  scores: {
    completeness: qualityDimensions.completeness,
    pattern_compliance: qualityDimensions.pattern_compliance,
    integration: qualityDimensions.integration,
    consistency: qualityDimensions.consistency,
    overall: overallScore
  },
  quality_gate: qualityGate,
  structure_checks: structureResults,
  pattern_checks: patternResults,
  critical_failures: criticalFails,
  recommendations: generateRecommendations(structureResults, patternResults, integration),
  delivery: {
    source: `${workDir}/${config.role_name}.md`,
    destination: `${config.output_folder}/${config.output_file}`,
    ready: qualityGate !== 'FAIL' && criticalFails.length === 0
  }
}

function generateRecommendations(structure, patterns, integration) {
  const recs = []
  structure.filter(s => s.status === 'FAIL').forEach(s => {
    recs.push(`Add missing section: ${s.section}`)
  })
  patterns.filter(p => p.status === 'FAIL').forEach(p => {
    recs.push(`Fix pattern violation: ${p.pattern} [${p.severity}]`)
  })
  if (integration.overall === 'NEEDS_ATTENTION') {
    recs.push('Review integration report for coordinate.md updates')
  }
  return recs
}

Write(`${workDir}/validation-report.json`, JSON.stringify(report, null, 2))
```

### Step 6: Deliver Final File

```javascript
if (report.delivery.ready) {
  // Copy to final location
  const finalContent = Read(`${workDir}/${config.role_name}.md`)
  // Ensure team folder exists
  Bash(`mkdir -p "${config.output_folder}"`)
  Write(`${config.output_folder}/${config.output_file}`, finalContent)

  // Report success
  console.log(`Team command delivered to: ${config.output_folder}/${config.output_file}`)
  console.log(`Skill path: /${config.skill_path}`)
  console.log(`Quality score: ${overallScore.toFixed(1)}% (${qualityGate})`)
  console.log(`Integration: ${integration.overall}`)

  if (report.recommendations.length > 0) {
    console.log('\nRecommendations:')
    report.recommendations.forEach(r => console.log(`  - ${r}`))
  }

  // Remind about coordinate.md updates
  console.log('\nNext steps:')
  console.log('1. Update coordinate.md to add spawn snippet (see integration-report.json)')
  console.log('2. Add new message type handlers to coordinator')
  console.log(`3. Test with: /${config.skill_path}`)
} else {
  console.log(`Validation FAILED (score: ${overallScore.toFixed(1)}%)`)
  console.log('Critical failures:')
  criticalFails.forEach(f => console.log(`  - ${f.pattern}`))
  console.log('Fix issues and re-run Phase 3-5')
}
```

## Output

- **File**: `validation-report.json`
- **Format**: JSON
- **Location**: `{workDir}/validation-report.json`
- **Delivery**: `.claude/commands/team/{team-name}/{role-name}.md` (if validation passes)

## Quality Checklist

- [ ] All 15+ structural checks executed
- [ ] All 6+ pattern compliance checks executed
- [ ] No critical failures remaining
- [ ] Overall score >= 80% (PASS gate)
- [ ] Integration report reviewed
- [ ] Final file delivered to `.claude/commands/team/{team-name}/`
- [ ] Coordinator update instructions provided

## Completion

This is the final phase. The generated team command is ready for use.
