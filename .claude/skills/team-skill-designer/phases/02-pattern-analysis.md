# Phase 2: Pattern Analysis

Analyze applicable patterns for each role in the team.

## Objective

- Per-role: find most similar existing command
- Per-role: select infrastructure + collaboration patterns
- Per-role: map 5-phase structure to role responsibilities
- Generate pattern-analysis.json

## Input

- Dependency: `team-config.json` (Phase 1)
- Specification: `specs/team-design-patterns.md` (read in Phase 0)

## Execution Steps

### Step 1: Load Configuration

```javascript
const config = JSON.parse(Read(`${workDir}/team-config.json`))
```

### Step 2: Per-Role Similarity Mapping

```javascript
const similarityMap = {
  "Read-only analysis": {
    primary: "review", secondary: "plan",
    reason: "Both analyze code and report findings with severity classification"
  },
  "Code generation": {
    primary: "execute", secondary: "test",
    reason: "Both write/modify code and self-validate"
  },
  "Orchestration": {
    primary: "plan", secondary: "coordinate",
    reason: "Both coordinate sub-tasks and produce structured output"
  },
  "Validation": {
    primary: "test", secondary: "review",
    reason: "Both validate quality with structured criteria"
  }
}

const roleAnalysis = config.worker_roles.map(role => {
  const similarity = similarityMap[role.responsibility_type]
  return {
    role_name: role.name,
    similar_to: similarity,
    reference_command: `.claude/commands/team/${similarity.primary}.md`
  }
})
```

### Step 3: Per-Role Phase Mapping

```javascript
const phaseMapping = {
  "Read-only analysis": {
    phase2: "Context Loading",
    phase3: "Analysis Execution",
    phase4: "Finding Summary"
  },
  "Code generation": {
    phase2: "Task & Plan Loading",
    phase3: "Code Implementation",
    phase4: "Self-Validation"
  },
  "Orchestration": {
    phase2: "Context & Complexity Assessment",
    phase3: "Orchestrated Execution",
    phase4: "Result Aggregation"
  },
  "Validation": {
    phase2: "Environment Detection",
    phase3: "Execution & Fix Cycle",
    phase4: "Result Analysis"
  }
}

roleAnalysis.forEach(ra => {
  const role = config.worker_roles.find(r => r.name === ra.role_name)
  ra.phase_structure = {
    phase1: "Task Discovery",
    ...phaseMapping[role.responsibility_type],
    phase5: "Report to Coordinator"
  }
})
```

### Step 4: Per-Role Infrastructure Patterns

```javascript
roleAnalysis.forEach(ra => {
  const role = config.worker_roles.find(r => r.name === ra.role_name)

  // Core patterns (mandatory for all)
  ra.core_patterns = [
    "pattern-1-message-bus",
    "pattern-2-yaml-front-matter",  // Adapted: no YAML in skill role files
    "pattern-3-task-lifecycle",
    "pattern-4-five-phase",
    "pattern-6-coordinator-spawn",
    "pattern-7-error-handling"
  ]

  // Conditional patterns
  ra.conditional_patterns = []
  if (role.adaptive_routing) {
    ra.conditional_patterns.push("pattern-5-complexity-adaptive")
  }
  if (role.responsibility_type === "Code generation" || role.responsibility_type === "Orchestration") {
    ra.conditional_patterns.push("pattern-8-session-files")
  }
})
```

### Step 5: Collaboration Pattern Selection

```javascript
// Team-level collaboration patterns
function selectTeamPatterns(config) {
  const patterns = ['CP-1']  // Linear Pipeline is always base

  const hasValidation = config.worker_roles.some(r =>
    r.responsibility_type === 'Validation' || r.responsibility_type === 'Read-only analysis'
  )
  if (hasValidation) patterns.push('CP-2')  // Review-Fix Cycle

  const hasOrchestration = config.worker_roles.some(r =>
    r.responsibility_type === 'Orchestration'
  )
  if (hasOrchestration) patterns.push('CP-3')  // Fan-out/Fan-in

  if (config.worker_roles.length >= 4) patterns.push('CP-6')  // Incremental Delivery

  patterns.push('CP-5')  // Escalation Chain (always available)
  patterns.push('CP-10') // Post-Mortem (always at team level)

  return [...new Set(patterns)]
}

const collaborationPatterns = selectTeamPatterns(config)

// Convergence defaults
const convergenceConfig = collaborationPatterns.map(cp => {
  const defaults = {
    'CP-1': { max_iterations: 1, success_gate: 'all_stages_completed' },
    'CP-2': { max_iterations: 5, success_gate: 'verdict_approve_or_conditional' },
    'CP-3': { max_iterations: 1, success_gate: 'quorum_100_percent' },
    'CP-5': { max_iterations: null, success_gate: 'issue_resolved_at_any_level' },
    'CP-6': { max_iterations: 3, success_gate: 'all_increments_validated' },
    'CP-10': { max_iterations: 1, success_gate: 'report_generated' }
  }
  return { pattern: cp, convergence: defaults[cp] || {} }
})
```

### Step 6: Read Reference Commands

```javascript
// Read the most referenced commands for extraction
const referencedCommands = [...new Set(roleAnalysis.map(ra => ra.similar_to.primary))]
const referenceContent = {}

for (const cmdName of referencedCommands) {
  try {
    referenceContent[cmdName] = Read(`.claude/commands/team/${cmdName}.md`)
  } catch {
    referenceContent[cmdName] = null
  }
}
```

### Step 7: Generate Analysis Document

```javascript
const analysis = {
  team_name: config.team_name,
  role_count: config.roles.length,
  worker_count: config.worker_roles.length,
  role_analysis: roleAnalysis,
  collaboration_patterns: collaborationPatterns,
  convergence_config: convergenceConfig,
  referenced_commands: referencedCommands,
  pipeline: config.pipeline,
  // Skill-specific patterns
  skill_patterns: {
    role_router: "Parse --role from $ARGUMENTS → dispatch to roles/{role}.md",
    shared_infrastructure: "Message bus + task lifecycle defined once in SKILL.md",
    progressive_loading: "Only read roles/{role}.md when that role executes"
  }
}

Write(`${workDir}/pattern-analysis.json`, JSON.stringify(analysis, null, 2))
```

## Output

- **File**: `pattern-analysis.json`
- **Format**: JSON
- **Location**: `{workDir}/pattern-analysis.json`

## Quality Checklist

- [ ] Every worker role has similarity mapping
- [ ] Every worker role has 5-phase structure
- [ ] Infrastructure patterns include all mandatory patterns
- [ ] Collaboration patterns selected at team level
- [ ] Referenced commands are readable
- [ ] Skill-specific patterns documented

## Next Phase

-> [Phase 3: Skill Package Generation](03-skill-generation.md)
