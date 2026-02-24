# Command: Multi-Angle Exploration

Phase 2 of planner execution - assess complexity, select exploration angles, and execute parallel exploration.

## Overview

This command performs multi-angle codebase exploration based on task complexity. Low complexity uses direct semantic search, while Medium/High complexity launches parallel cli-explore-agent subagents for comprehensive analysis.

## Complexity Assessment

### assessComplexity Function

```javascript
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|模块|系统/.test(desc)) score += 2
  if (/multiple|多个|across|跨/.test(desc)) score += 2
  if (/integrate|集成|api|database/.test(desc)) score += 1
  if (/security|安全|performance|性能/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}

const complexity = assessComplexity(task.description)
```

### Complexity Levels

| Level | Score | Characteristics | Angle Count |
|-------|-------|----------------|-------------|
| **Low** | 0-1 | Simple feature, single module, clear scope | 1 |
| **Medium** | 2-3 | Multiple modules, integration points, moderate scope | 3 |
| **High** | 4+ | Architecture changes, cross-cutting concerns, complex scope | 4 |

## Angle Selection

### ANGLE_PRESETS

```javascript
const ANGLE_PRESETS = {
  architecture: ['architecture', 'dependencies', 'modularity', 'integration-points'],
  security: ['security', 'auth-patterns', 'dataflow', 'validation'],
  performance: ['performance', 'bottlenecks', 'caching', 'data-access'],
  bugfix: ['error-handling', 'dataflow', 'state-management', 'edge-cases'],
  feature: ['patterns', 'integration-points', 'testing', 'dependencies']
}
```

### selectAngles Function

```javascript
function selectAngles(desc, count) {
  const text = desc.toLowerCase()
  let preset = 'feature'
  if (/refactor|architect|restructure|modular/.test(text)) preset = 'architecture'
  else if (/security|auth|permission|access/.test(text)) preset = 'security'
  else if (/performance|slow|optimi|cache/.test(text)) preset = 'performance'
  else if (/fix|bug|error|issue|broken/.test(text)) preset = 'bugfix'
  return ANGLE_PRESETS[preset].slice(0, count)
}

const angleCount = complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1)
const selectedAngles = selectAngles(task.description, angleCount)
```

### Angle Definitions

| Angle | Focus | Use Case |
|-------|-------|----------|
| **architecture** | System structure, layer boundaries, design patterns | Refactoring, restructuring |
| **dependencies** | Module dependencies, coupling, external libraries | Integration, modularity |
| **modularity** | Component boundaries, separation of concerns | Architecture changes |
| **integration-points** | API boundaries, data flow between modules | Feature development |
| **security** | Auth/authz, input validation, data protection | Security features |
| **auth-patterns** | Authentication flows, session management | Auth implementation |
| **dataflow** | Data transformation, state propagation | Bug fixes, features |
| **validation** | Input validation, error handling | Security, quality |
| **performance** | Bottlenecks, optimization opportunities | Performance tuning |
| **bottlenecks** | Slow operations, resource contention | Performance issues |
| **caching** | Cache strategies, invalidation patterns | Performance optimization |
| **data-access** | Database queries, data fetching patterns | Performance, features |
| **error-handling** | Error propagation, recovery strategies | Bug fixes |
| **state-management** | State updates, consistency | Bug fixes, features |
| **edge-cases** | Boundary conditions, error scenarios | Bug fixes, testing |
| **patterns** | Code patterns, conventions, best practices | Feature development |
| **testing** | Test coverage, test strategies | Feature development |

## Exploration Execution

### Low Complexity: Direct Semantic Search

```javascript
if (complexity === 'Low') {
  // Direct exploration via semantic search
  const results = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: task.description
  })

  // Transform ACE results to exploration JSON
  const exploration = {
    project_structure: "Analyzed via ACE semantic search",
    relevant_files: results.files.map(f => ({
      path: f.path,
      rationale: f.relevance_reason || "Semantic match to task description",
      role: "modify_target",
      discovery_source: "ace-search",
      key_symbols: f.symbols || []
    })),
    patterns: results.patterns || [],
    dependencies: results.dependencies || [],
    integration_points: results.integration_points || [],
    constraints: [],
    clarification_needs: [],
    _metadata: {
      exploration_angle: selectedAngles[0],
      complexity: 'Low',
      discovery_method: 'ace-semantic-search'
    }
  }

  Write(`${planDir}/exploration-${selectedAngles[0]}.json`, JSON.stringify(exploration, null, 2))
}
```

### Medium/High Complexity: Parallel cli-explore-agent

```javascript
else {
  // Launch parallel cli-explore-agent for each angle
  selectedAngles.forEach((angle, index) => {
    Task({
      subagent_type: "cli-explore-agent",
      run_in_background: false,
      description: `Explore: ${angle}`,
      prompt: `
## Task Objective
Execute **${angle}** exploration for task planning context.

## Output Location
**Session Folder**: ${sessionFolder}
**Output File**: ${planDir}/exploration-${angle}.json

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task.description}
- **Spec Context**: ${specContext ? 'Available — use spec/requirements, spec/architecture, spec/epics for informed exploration' : 'Not available (impl-only mode)'}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}

## MANDATORY FIRST STEPS
1. Run: rg -l "{relevant_keyword}" --type ts (locate relevant files)
2. Execute: cat ~/.ccw/workflows/cli-templates/schemas/explore-json-schema.json (get output schema)
3. Read: .workflow/project-tech.json (if exists - technology stack)

## Expected Output
Write JSON to: ${planDir}/exploration-${angle}.json
Follow explore-json-schema.json structure with ${angle}-focused findings.

**MANDATORY**: Every file in relevant_files MUST have:
- **rationale** (required): Specific selection basis tied to ${angle} topic (>10 chars, not generic)
- **role** (required): modify_target|dependency|pattern_reference|test_target|type_definition|integration_point|config|context_only
- **discovery_source** (recommended): bash-scan|cli-analysis|ace-search|dependency-trace|manual
- **key_symbols** (recommended): Key functions/classes/types relevant to task

## Exploration Focus by Angle

${getAngleFocusGuide(angle)}

## Output Schema Structure

\`\`\`json
{
  "project_structure": "string - high-level architecture overview",
  "relevant_files": [
    {
      "path": "string - relative file path",
      "rationale": "string - WHY this file matters for ${angle} (>10 chars, specific)",
      "role": "modify_target|dependency|pattern_reference|test_target|type_definition|integration_point|config|context_only",
      "discovery_source": "bash-scan|cli-analysis|ace-search|dependency-trace|manual",
      "key_symbols": ["function/class/type names"]
    }
  ],
  "patterns": ["string - code patterns relevant to ${angle}"],
  "dependencies": ["string - module/library dependencies"],
  "integration_points": ["string - API/interface boundaries"],
  "constraints": ["string - technical constraints"],
  "clarification_needs": ["string - questions needing user input"],
  "_metadata": {
    "exploration_angle": "${angle}",
    "complexity": "${complexity}",
    "discovery_method": "cli-explore-agent"
  }
}
\`\`\`
`
    })
  })
}
```

### Angle Focus Guide

```javascript
function getAngleFocusGuide(angle) {
  const guides = {
    architecture: `
**Architecture Focus**:
- Identify layer boundaries (presentation, business, data)
- Map module dependencies and coupling
- Locate design patterns (factory, strategy, observer, etc.)
- Find architectural decision records (ADRs)
- Analyze component responsibilities`,

    dependencies: `
**Dependencies Focus**:
- Map internal module dependencies (import/require statements)
- Identify external library usage (package.json, requirements.txt)
- Trace dependency chains and circular dependencies
- Locate shared utilities and common modules
- Analyze coupling strength between modules`,

    modularity: `
**Modularity Focus**:
- Identify module boundaries and interfaces
- Analyze separation of concerns
- Locate tightly coupled code
- Find opportunities for extraction/refactoring
- Map public vs private APIs`,

    'integration-points': `
**Integration Points Focus**:
- Locate API endpoints and routes
- Identify data flow between modules
- Find event emitters/listeners
- Map external service integrations
- Analyze interface contracts`,

    security: `
**Security Focus**:
- Locate authentication/authorization logic
- Identify input validation points
- Find sensitive data handling
- Analyze access control mechanisms
- Locate security-related middleware`,

    'auth-patterns': `
**Auth Patterns Focus**:
- Identify authentication flows (login, logout, refresh)
- Locate session management code
- Find token generation/validation
- Map user permission checks
- Analyze auth middleware`,

    dataflow: `
**Dataflow Focus**:
- Trace data transformations
- Identify state propagation paths
- Locate data validation points
- Map data sources and sinks
- Analyze data mutation points`,

    validation: `
**Validation Focus**:
- Locate input validation logic
- Identify schema definitions
- Find error handling for invalid data
- Map validation middleware
- Analyze sanitization functions`,

    performance: `
**Performance Focus**:
- Identify computational bottlenecks
- Locate database queries (N+1 problems)
- Find synchronous blocking operations
- Map resource-intensive operations
- Analyze algorithm complexity`,

    bottlenecks: `
**Bottlenecks Focus**:
- Locate slow operations (profiling data)
- Identify resource contention points
- Find inefficient algorithms
- Map hot paths in code
- Analyze concurrency issues`,

    caching: `
**Caching Focus**:
- Locate existing cache implementations
- Identify cacheable operations
- Find cache invalidation logic
- Map cache key strategies
- Analyze cache hit/miss patterns`,

    'data-access': `
**Data Access Focus**:
- Locate database query patterns
- Identify ORM/query builder usage
- Find data fetching strategies
- Map data access layers
- Analyze query optimization opportunities`,

    'error-handling': `
**Error Handling Focus**:
- Locate try-catch blocks
- Identify error propagation paths
- Find error recovery strategies
- Map error logging points
- Analyze error types and handling`,

    'state-management': `
**State Management Focus**:
- Locate state containers (Redux, Vuex, etc.)
- Identify state update patterns
- Find state synchronization logic
- Map state dependencies
- Analyze state consistency mechanisms`,

    'edge-cases': `
**Edge Cases Focus**:
- Identify boundary conditions
- Locate null/undefined handling
- Find empty array/object handling
- Map error scenarios
- Analyze exceptional flows`,

    patterns: `
**Patterns Focus**:
- Identify code patterns and conventions
- Locate design pattern implementations
- Find naming conventions
- Map code organization patterns
- Analyze best practices usage`,

    testing: `
**Testing Focus**:
- Locate test files and test utilities
- Identify test coverage gaps
- Find test patterns (unit, integration, e2e)
- Map mocking/stubbing strategies
- Analyze test organization`
  }

  return guides[angle] || `**${angle} Focus**: Analyze codebase from ${angle} perspective`
}
```

## Explorations Manifest

```javascript
// Build explorations manifest
const explorationManifest = {
  session_id: `${taskSlug}-${dateStr}`,
  task_description: task.description,
  complexity: complexity,
  exploration_count: selectedAngles.length,
  explorations: selectedAngles.map(angle => ({
    angle: angle,
    file: `exploration-${angle}.json`,
    path: `${planDir}/exploration-${angle}.json`
  }))
}
Write(`${planDir}/explorations-manifest.json`, JSON.stringify(explorationManifest, null, 2))
```

## Output Schema

### explore-json-schema.json Structure

```json
{
  "project_structure": "string - high-level architecture overview",
  "relevant_files": [
    {
      "path": "string - relative file path",
      "rationale": "string - specific selection basis (>10 chars)",
      "role": "modify_target|dependency|pattern_reference|test_target|type_definition|integration_point|config|context_only",
      "discovery_source": "bash-scan|cli-analysis|ace-search|dependency-trace|manual",
      "key_symbols": ["string - function/class/type names"]
    }
  ],
  "patterns": ["string - code patterns relevant to angle"],
  "dependencies": ["string - module/library dependencies"],
  "integration_points": ["string - API/interface boundaries"],
  "constraints": ["string - technical constraints"],
  "clarification_needs": ["string - questions needing user input"],
  "_metadata": {
    "exploration_angle": "string - angle name",
    "complexity": "Low|Medium|High",
    "discovery_method": "ace-semantic-search|cli-explore-agent"
  }
}
```

## Integration with Phase 3

Phase 3 (Plan Generation) consumes:
1. `explorations-manifest.json` - list of exploration files
2. `exploration-{angle}.json` - per-angle exploration results
3. `specContext` (if available) - requirements, architecture, epics

These inputs are passed to cli-lite-planning-agent for plan generation.

## Error Handling

### Exploration Agent Failure

```javascript
try {
  Task({
    subagent_type: "cli-explore-agent",
    run_in_background: false,
    description: `Explore: ${angle}`,
    prompt: `...`
  })
} catch (error) {
  // Skip exploration, continue with available explorations
  console.error(`[planner] Exploration failed for angle: ${angle}`, error)
  // Remove failed angle from manifest
  explorationManifest.explorations = explorationManifest.explorations.filter(e => e.angle !== angle)
  explorationManifest.exploration_count = explorationManifest.explorations.length
}
```

### All Explorations Fail

```javascript
if (explorationManifest.exploration_count === 0) {
  // Fallback: Plan from task description only
  console.warn(`[planner] All explorations failed, planning from task description only`)
  // Proceed to Phase 3 with empty explorations
}
```

### ACE Search Failure (Low Complexity)

```javascript
try {
  const results = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: task.description
  })
} catch (error) {
  // Fallback: Use ripgrep for basic file discovery
  const rgResults = Bash(`rg -l "${task.description}" --type ts`)
  const exploration = {
    project_structure: "Basic file discovery via ripgrep",
    relevant_files: rgResults.split('\n').map(path => ({
      path: path.trim(),
      rationale: "Matched task description keywords",
      role: "modify_target",
      discovery_source: "bash-scan",
      key_symbols: []
    })),
    patterns: [],
    dependencies: [],
    integration_points: [],
    constraints: [],
    clarification_needs: [],
    _metadata: {
      exploration_angle: selectedAngles[0],
      complexity: 'Low',
      discovery_method: 'ripgrep-fallback'
    }
  }
  Write(`${planDir}/exploration-${selectedAngles[0]}.json`, JSON.stringify(exploration, null, 2))
}
```
