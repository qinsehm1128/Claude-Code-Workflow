# Phase 2: Pattern Analysis

Identify applicable design patterns from existing team commands for the new role.

## Objective

- Find the most similar existing team command
- Select applicable infrastructure patterns (Section A)
- Select applicable collaboration patterns (Section B: CP-1 through CP-10)
- Map role responsibilities to phase structure
- Generate applicable-patterns.json

## Input

- Dependency: `role-config.json` (from Phase 1)
- Specification: `specs/team-design-patterns.md` (read in Phase 0)

## Execution Steps

### Step 1: Load Configuration

```javascript
const config = JSON.parse(Read(`${workDir}/role-config.json`))
```

### Step 2: Find Most Similar Existing Command

```javascript
// Similarity mapping based on responsibility type
const similarityMap = {
  "Read-only analysis": {
    primary: "review",     // Multi-dimensional analysis -> report
    secondary: "plan",     // Also does exploration
    reason: "Both analyze code and report findings with severity classification"
  },
  "Code generation": {
    primary: "execute",    // Code implementation
    secondary: "test",     // Also modifies code (fixes)
    reason: "Both write/modify code files and self-validate"
  },
  "Orchestration": {
    primary: "plan",       // Manages exploration and plan generation
    secondary: "coordinate", // High-level orchestration
    reason: "Both coordinate multiple sub-tasks and produce structured output"
  },
  "Validation": {
    primary: "test",       // Test execution and fix cycles
    secondary: "review",   // Verification
    reason: "Both validate output quality with structured criteria"
  }
}

const similarity = similarityMap[config.responsibility_type]

// Read the most similar command for pattern extraction
const primaryRef = Read(`.claude/commands/team/${similarity.primary}.md`)
const secondaryRef = Read(`.claude/commands/team/${similarity.secondary}.md`)
```

### Step 3: Select Applicable Patterns

```javascript
// All commands use these core patterns (mandatory)
const corePatterns = [
  "pattern-1-message-bus",       // Always required
  "pattern-2-yaml-front-matter", // Always required
  "pattern-3-task-lifecycle",    // Always required
  "pattern-4-five-phase",        // Always required
  "pattern-6-coordinator-spawn", // Always required
  "pattern-7-error-handling"     // Always required
]

// Conditional patterns based on config
const conditionalPatterns = []

if (config.adaptive_routing) {
  conditionalPatterns.push("pattern-5-complexity-adaptive")
}

if (config.responsibility_type === "Code generation" ||
    config.responsibility_type === "Orchestration") {
  conditionalPatterns.push("pattern-8-session-files")
}
```

### Step 4: Map Phase Structure

```javascript
// Map 5-phase structure to role-specific content
const phaseMapping = {
  "Read-only analysis": {
    phase1: "Task Discovery",
    phase2: "Context Loading (read changed files, load plan)",
    phase3: `${config.role_name}-specific analysis`,
    phase4: "Finding Summary (classify severity)",
    phase5: "Report to Coordinator"
  },
  "Code generation": {
    phase1: "Task & Plan Loading",
    phase2: "Task Grouping (dependency analysis)",
    phase3: "Code Implementation (direct or sub-agent)",
    phase4: "Self-Validation (syntax, criteria)",
    phase5: "Completion Report"
  },
  "Orchestration": {
    phase1: "Task Discovery",
    phase2: "Context & Complexity Assessment",
    phase3: "Orchestrated Execution (parallel sub-agents)",
    phase4: "Result Aggregation",
    phase5: "Submit for Approval + Loop"
  },
  "Validation": {
    phase1: "Task Discovery",
    phase2: "Framework/Environment Detection",
    phase3: "Execution & Fix Cycle",
    phase4: "Result Analysis",
    phase5: "Report to Coordinator"
  }
}

const phases = phaseMapping[config.responsibility_type]
```

### Step 5: Extract Implementation Patterns from Reference

```javascript
// Extract specific code patterns from the most similar command
function extractPatterns(commandContent) {
  const patterns = {}

  // Extract task discovery pattern
  const taskDiscovery = commandContent.match(
    /\/\/ Find my assigned.*?if \(my\w+Tasks\.length === 0\).*?return/s
  )
  if (taskDiscovery) patterns.taskDiscovery = taskDiscovery[0]

  // Extract message bus examples
  const msgExamples = commandContent.match(
    /mcp__ccw-tools__team_msg\(\{[^}]+\}\)/g
  )
  if (msgExamples) patterns.messageExamples = msgExamples

  // Extract error handling table
  const errorTable = commandContent.match(
    /## Error Handling[\s\S]*?\n\n/
  )
  if (errorTable) patterns.errorHandling = errorTable[0]

  return patterns
}

const referencePatterns = extractPatterns(primaryRef)
```

### Step 6: Select Collaboration Patterns

```javascript
// Collaboration pattern selection based on role characteristics
function selectCollaborationPatterns(config) {
  const patterns = ['CP-1']  // CP-1 Linear Pipeline is always the base

  const responsibilityType = config.responsibility_type

  // Rule-based selection
  if (responsibilityType === 'Validation' || responsibilityType === 'Read-only analysis') {
    patterns.push('CP-2')  // Review-Fix Cycle - natural for validation roles
  }

  if (responsibilityType === 'Orchestration') {
    patterns.push('CP-3')  // Fan-out/Fan-in for orchestration
    patterns.push('CP-4')  // Consensus Gate for decisions
  }

  if (config.adaptive_routing) {
    patterns.push('CP-5')  // Escalation Chain for when self-repair fails
  }

  if (responsibilityType === 'Code generation') {
    patterns.push('CP-6')  // Incremental Delivery for large implementations
    patterns.push('CP-2')  // Review-Fix Cycle for code quality
  }

  // CP-5 Escalation is always available as a fallback
  if (!patterns.includes('CP-5')) {
    patterns.push('CP-5')
  }

  // CP-10 Post-Mortem is always included at team level
  patterns.push('CP-10')

  return [...new Set(patterns)]  // Deduplicate
}

const collaborationPatterns = selectCollaborationPatterns(config)

// Map collaboration patterns to convergence configurations
const convergenceConfig = collaborationPatterns.map(cp => {
  const defaults = {
    'CP-1': { max_iterations: 1, timeout: null, success_gate: 'all_stages_completed' },
    'CP-2': { max_iterations: 5, timeout: null, success_gate: 'verdict_approve_or_conditional' },
    'CP-3': { max_iterations: 1, timeout: 300000, success_gate: 'quorum_100_percent' },
    'CP-4': { max_iterations: 2, timeout: 300000, success_gate: 'quorum_67_percent' },
    'CP-5': { max_iterations: null, timeout: null, success_gate: 'issue_resolved_at_any_level' },
    'CP-6': { max_iterations: 3, timeout: null, success_gate: 'all_increments_validated' },
    'CP-7': { max_iterations: 2, timeout: 600000, success_gate: 'blocker_resolved' },
    'CP-8': { max_iterations: 2, timeout: 120000, success_gate: 'advice_applied' },
    'CP-9': { max_iterations: 2, timeout: 300000, success_gate: 'all_sync_points_aligned' },
    'CP-10': { max_iterations: 1, timeout: 180000, success_gate: 'report_generated' }
  }
  return { pattern: cp, convergence: defaults[cp] }
})
```

### Step 7: Generate Patterns Document

```javascript
const applicablePatterns = {
  role_name: config.role_name,
  similar_to: {
    primary: similarity.primary,
    secondary: similarity.secondary,
    reason: similarity.reason
  },
  // Infrastructure patterns
  core_patterns: corePatterns,
  conditional_patterns: conditionalPatterns,
  // Collaboration patterns
  collaboration_patterns: collaborationPatterns,
  convergence_config: convergenceConfig,
  // Phase and reference mapping
  phase_structure: phases,
  reference_patterns: {
    task_discovery: "Adapt from " + similarity.primary + ".md Phase 1",
    core_work: "Adapt from " + similarity.primary + ".md Phase 3",
    reporting: "Adapt from " + similarity.primary + ".md Phase 5"
  },
  message_types: config.message_types,
  implementation_hints: {
    phase1: `Standard task lifecycle with ${config.task_prefix}-* prefix`,
    phase2: phases.phase2,
    phase3: phases.phase3,
    phase4: phases.phase4,
    phase5: `SendMessage to coordinator with ${config.role_name} results`
  }
}

Write(`${workDir}/applicable-patterns.json`, JSON.stringify(applicablePatterns, null, 2))
```

## Output

- **File**: `applicable-patterns.json`
- **Format**: JSON
- **Location**: `{workDir}/applicable-patterns.json`

## Quality Checklist

- [ ] Most similar existing command identified
- [ ] All mandatory patterns included (6 core patterns)
- [ ] Phase structure mapped to role responsibilities
- [ ] Implementation hints are specific and actionable
- [ ] Reference patterns point to concrete sections

## Next Phase

-> [Phase 3: Command Generation](03-command-generation.md)
