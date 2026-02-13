# Phase 3: Conflict Resolution

Detect and resolve conflicts with CLI analysis. This phase is **conditional** - only executes when `conflict_risk >= medium`.

## Objective

- Detect conflicts between planned changes and existing codebase
- Present conflicts to user with resolution strategies
- Apply selected resolution strategies
- Update planning-notes.md with conflict decisions

## Trigger Condition

Only execute when context-package.json indicates `conflict_risk` is "medium" or "high".
If `conflict_risk` is "none" or "low", skip directly to Phase 4.

## Execution

### Step 3.1: Execute Conflict Resolution

```javascript
Skill(skill="workflow:tools:conflict-resolution", args="--session [sessionId] --context [contextPath]")
```

**Input**:
- sessionId from Phase 1
- contextPath from Phase 2
- conflict_risk from context-package.json

**Parse Output**:
- Extract: Execution status (success/skipped/failed)
- Verify: conflict-resolution.json file path (if executed)

**Validation**:
- File `.workflow/active/[sessionId]/.process/conflict-resolution.json` exists (if executed)

**Skip Behavior**:
- If conflict_risk is "none" or "low", skip directly to Phase 4
- Display: "No significant conflicts detected, proceeding to task generation"

### TodoWrite Update (Phase 3 Skill executed - tasks attached, if conflict_risk >= medium)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Conflict Resolution", "status": "in_progress", "activeForm": "Resolving conflicts"},
  {"content": "  → Detect conflicts with CLI analysis", "status": "in_progress", "activeForm": "Detecting conflicts"},
  {"content": "  → Present conflicts to user", "status": "pending", "activeForm": "Presenting conflicts"},
  {"content": "  → Apply resolution strategies", "status": "pending", "activeForm": "Applying resolution strategies"},
  {"content": "Phase 4: Task Generation", "status": "pending", "activeForm": "Executing task generation"}
]
```

**Note**: Skill execute **attaches** conflict-resolution's 3 tasks. Orchestrator **executes** these tasks sequentially.

### TodoWrite Update (Phase 3 completed - tasks collapsed)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Conflict Resolution", "status": "completed", "activeForm": "Resolving conflicts"},
  {"content": "Phase 4: Task Generation", "status": "pending", "activeForm": "Executing task generation"}
]
```

**Note**: Phase 3 tasks completed and collapsed to summary.

### Step 3.2: Update Planning Notes

After conflict resolution completes (if executed), update planning-notes.md:

```javascript
// If Phase 3 was executed, update planning-notes.md
if (conflictRisk === 'medium' || conflictRisk === 'high') {
  const conflictResPath = `.workflow/active/${sessionId}/.process/conflict-resolution.json`

  if (fs.existsSync(conflictResPath)) {
    const conflictRes = JSON.parse(Read(conflictResPath))
    const resolved = conflictRes.resolved_conflicts || []
    const modifiedArtifacts = conflictRes.modified_artifacts || []
    const planningConstraints = conflictRes.planning_constraints || []

    // Update Phase 3 section
    Edit(planningNotesPath, {
      old: '## Conflict Decisions (Phase 3)\n(To be filled if conflicts detected)',
      new: `## Conflict Decisions (Phase 3)

- **RESOLVED**: ${resolved.map(r => `${r.type} → ${r.strategy}`).join('; ') || 'None'}
- **MODIFIED_ARTIFACTS**: ${modifiedArtifacts.join(', ') || 'None'}
- **CONSTRAINTS**: ${planningConstraints.join('; ') || 'None'}`
    })

    // Append Phase 3 constraints to consolidated list
    if (planningConstraints.length > 0) {
      const currentNotes = Read(planningNotesPath)
      const constraintCount = (currentNotes.match(/^\d+\./gm) || []).length

      Edit(planningNotesPath, {
        old: '## Consolidated Constraints (Phase 4 Input)',
        new: `## Consolidated Constraints (Phase 4 Input)
${planningConstraints.map((c, i) => `${constraintCount + i + 1}. [Conflict] ${c}`).join('\n')}`
      })
    }
  }
}
```

**Auto-Continue**: Return to user showing conflict resolution results and selected strategies, then auto-continue.

**Auto Mode (--yes)**: When `--yes` flag is active, conflict-resolution sub-command automatically applies recommended resolution strategies without user confirmation. The orchestrator passes the `--yes` flag through to `workflow:tools:conflict-resolution`.

### Step 3.3: Memory State Check

Evaluate current context window usage and memory state:

- If memory usage is high (>120K tokens or approaching context limits):

```javascript
Skill(skill="compact")
```

- Memory compaction is particularly important after analysis phase which may generate extensive documentation
- Ensures optimal performance and prevents context overflow

## Output

- **File**: `conflict-resolution.json` (if conflicts resolved)
- **TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 4: Task Generation](04-task-generation.md).
