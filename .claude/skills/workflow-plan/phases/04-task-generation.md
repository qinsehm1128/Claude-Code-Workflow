# Phase 4: Task Generation

Generate implementation plan and task JSONs via action-planning-agent.

## Objective

- Generate IMPL_PLAN.md, task JSONs, and TODO_LIST.md
- Present user with plan confirmation choices (verify / execute / review)
- Route to Phase 5 (verify) if user selects verification

## Relationship with Brainstorm Phase

- If brainstorm role analyses exist ([role]/analysis.md files), they are incorporated as input
- **User's original intent is ALWAYS primary**: New or refined user goals override brainstorm recommendations
- **Role analysis.md files define "WHAT"**: Requirements, design specs, role-specific insights
- **IMPL_PLAN.md defines "HOW"**: Executable task breakdown, dependencies, implementation sequence
- Task generation translates high-level role analyses into concrete, actionable work items
- **Intent priority**: Current user prompt > role analysis.md files > guidance-specification.md

## Execution

### Step 4.1: Execute Task Generation

```javascript
Skill(skill="workflow:tools:task-generate-agent", args="--session [sessionId]")
```

**CLI Execution Note**: CLI tool usage is now determined semantically by action-planning-agent based on user's task description. If user specifies "use Codex/Gemini/Qwen for X", CLI tool usage is controlled by `meta.execution_config.method` per task, not by `command` fields in implementation steps.

**Input**:
- `sessionId` from Phase 1
- **planning-notes.md**: Consolidated constraints from all phases (Phase 1-3)
  - Path: `.workflow/active/[sessionId]/planning-notes.md`
  - Contains: User intent, context findings, conflict decisions, consolidated constraints
  - **Purpose**: Provides structured, minimal context summary to action-planning-agent

**Validation**:
- `.workflow/active/[sessionId]/plan.json` exists (structured plan overview)
- `.workflow/active/[sessionId]/IMPL_PLAN.md` exists
- `.workflow/active/[sessionId]/.task/IMPL-*.json` exists (at least one)
- `.workflow/active/[sessionId]/TODO_LIST.md` exists

### TodoWrite Update (Phase 4 Skill executed - agent task attached)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 4: Task Generation", "status": "in_progress", "activeForm": "Executing task generation"}
]
```

**Note**: Single agent task attached. Agent autonomously completes discovery, planning, and output generation internally.

### TodoWrite Update (Phase 4 completed)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 4: Task Generation", "status": "completed", "activeForm": "Executing task generation"}
]
```

**Note**: Agent task completed. No collapse needed (single task).

### Step 4.2: Plan Confirmation (User Decision Gate)

After Phase 4 completes, present user with action choices:

```javascript
console.log(`
Planning complete for session: ${sessionId}
Tasks generated: ${taskCount}
Plan: .workflow/active/${sessionId}/IMPL_PLAN.md
`);

// Ask user for next action
const userChoice = AskUserQuestion({
  questions: [{
    question: "Planning complete. What would you like to do next?",
    header: "Next Action",
    multiSelect: false,
    options: [
      {
        label: "Verify Plan Quality (Recommended)",
        description: "Run quality verification to catch issues before execution. Checks plan structure, task dependencies, and completeness."
      },
      {
        label: "Start Execution",
        description: "Begin implementing tasks immediately. Use this if you've already reviewed the plan or want to start quickly."
      },
      {
        label: "Review Status Only",
        description: "View task breakdown and session status without taking further action. You can decide what to do next manually."
      }
    ]
  }]
});

// Execute based on user choice
if (userChoice.answers["Next Action"] === "Verify Plan Quality (Recommended)") {
  console.log("\nStarting plan verification...\n");
  // Route to Phase 5 (plan-verify) within this skill
  // Orchestrator reads phases/05-plan-verify.md and executes
} else if (userChoice.answers["Next Action"] === "Start Execution") {
  console.log("\nStarting task execution...\n");
  Skill(skill="workflow-execute", args="--session " + sessionId);
} else if (userChoice.answers["Next Action"] === "Review Status Only") {
  console.log("\nDisplaying session status...\n");
  Skill(skill="workflow:status", args="--session " + sessionId);
}
```

**Auto Mode (--yes)**: Auto-select "Verify Plan Quality", then auto-continue to execute if quality gate is PROCEED.

**Return to Orchestrator**: Based on user's choice:
- **Verify** → Orchestrator reads phases/05-plan-verify.md and executes Phase 5 in-process
- **Execute** → Skill(skill="workflow-execute")
- **Review** → Route to /workflow:status

## Output

- **File**: `IMPL_PLAN.md` (implementation plan)
- **File**: `IMPL-*.json` (task JSON files)
- **File**: `TODO_LIST.md` (task list)
- **File**: `plan.json` (structured plan overview)
- **TodoWrite**: Mark Phase 4 completed

## Next Phase (Conditional)

Based on user's plan confirmation choice:
- If "Verify" → [Phase 5: Plan Verification](05-plan-verify.md)
- If "Execute" → Skill(skill="workflow-execute")
- If "Review" → External: /workflow:status
