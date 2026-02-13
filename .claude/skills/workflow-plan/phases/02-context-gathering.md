# Phase 2: Context Gathering

Gather project context and analyze codebase via context-gather tool.

## Objective

- Gather project context using context-search-agent
- Identify critical files, architecture patterns, and constraints
- Detect conflict risk level for Phase 3 decision
- Update planning-notes.md with findings

## Execution

### Step 2.1: Execute Context Gathering

```javascript
Skill(skill="workflow:tools:context-gather", args="--session [sessionId] \"[structured-task-description]\"")
```

**Use Same Structured Description**: Pass the same structured format from Phase 1

**Input**: `sessionId` from Phase 1

**Parse Output**:
- Extract: context-package.json path (store as `contextPath`)
- Typical pattern: `.workflow/active/[sessionId]/.process/context-package.json`

**Validation**:
- Context package path extracted
- File exists and is valid JSON
- `prioritized_context` field exists

### TodoWrite Update (Phase 2 Skill executed - tasks attached)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "in_progress", "activeForm": "Executing context gathering"},
  {"content": "  → Analyze codebase structure", "status": "in_progress", "activeForm": "Analyzing codebase structure"},
  {"content": "  → Identify integration points", "status": "pending", "activeForm": "Identifying integration points"},
  {"content": "  → Generate context package", "status": "pending", "activeForm": "Generating context package"},
  {"content": "Phase 4: Task Generation", "status": "pending", "activeForm": "Executing task generation"}
]
```

**Note**: Skill execute **attaches** context-gather's 3 tasks. Orchestrator **executes** these tasks sequentially.

### TodoWrite Update (Phase 2 completed - tasks collapsed)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 4: Task Generation", "status": "pending", "activeForm": "Executing task generation"}
]
```

**Note**: Phase 2 tasks completed and collapsed to summary.

### Step 2.2: Update Planning Notes

After context gathering completes, update planning-notes.md with findings:

```javascript
// Read context-package to extract key findings
const contextPackage = JSON.parse(Read(contextPath))
const conflictRisk = contextPackage.conflict_detection?.risk_level || 'low'
const criticalFiles = (contextPackage.exploration_results?.aggregated_insights?.critical_files || [])
  .slice(0, 5).map(f => f.path)
const archPatterns = contextPackage.project_context?.architecture_patterns || []
const constraints = contextPackage.exploration_results?.aggregated_insights?.constraints || []

// Append Phase 2 findings to planning-notes.md
Edit(planningNotesPath, {
  old: '## Context Findings (Phase 2)\n(To be filled by context-gather)',
  new: `## Context Findings (Phase 2)

- **CRITICAL_FILES**: ${criticalFiles.join(', ') || 'None identified'}
- **ARCHITECTURE**: ${archPatterns.join(', ') || 'Not detected'}
- **CONFLICT_RISK**: ${conflictRisk}
- **CONSTRAINTS**: ${constraints.length > 0 ? constraints.join('; ') : 'None'}`
})

// Append Phase 2 constraints to consolidated list
Edit(planningNotesPath, {
  old: '## Consolidated Constraints (Phase 4 Input)',
  new: `## Consolidated Constraints (Phase 4 Input)
${constraints.map((c, i) => `${i + 2}. [Context] ${c}`).join('\n')}`
})
```

**Auto-Continue**: Return to user showing Phase 2 results, then auto-continue to Phase 3/4 (depending on `conflictRisk`).

## Output

- **Variable**: `contextPath` (path to context-package.json)
- **Variable**: `conflictRisk` (none/low/medium/high)
- **File**: `context-package.json`
- **TodoWrite**: Mark Phase 2 completed, determine Phase 3 or Phase 4

## Next Phase

Return to orchestrator. Orchestrator checks `conflictRisk`:
- If `conflictRisk >= medium` → [Phase 3: Conflict Resolution](03-conflict-resolution.md)
- If `conflictRisk < medium` → [Phase 4: Task Generation](04-task-generation.md)
