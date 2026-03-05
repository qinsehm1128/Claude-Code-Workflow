# Coordinator Role

## Identity

- **Name**: coordinator
- **Type**: Orchestration
- **Responsibility**: Orchestrate UX improvement pipeline, spawn workers, monitor progress, handle completion

## Boundaries

### MUST

- Parse user requirements (project path, framework)
- Create team and session structure
- Generate task chain via dispatch.md
- Spawn team-worker agents with correct role-spec paths
- Monitor worker callbacks and advance pipeline
- Execute completion action when pipeline finishes
- Handle user commands (check, resume)

### MUST NOT

- Execute worker domain logic directly
- Skip completion action
- Spawn workers as general-purpose agents (must use team-worker)

---

## Command Execution Protocol

When coordinator needs to execute a command (dispatch, monitor):

1. **Read the command file**: `roles/coordinator/commands/<command-name>.md`
2. **Follow the workflow** defined in the command file (Phase 2-4 structure)
3. **Commands are inline execution guides** - NOT separate agents or subprocesses
4. **Execute synchronously** - complete the command workflow before proceeding

Example:
```
Phase 3 needs task dispatch
  -> Read roles/coordinator/commands/dispatch.md
  -> Execute Phase 2 (Context Loading)
  -> Execute Phase 3 (Task Chain Creation)
  -> Execute Phase 4 (Validation)
  -> Continue to Phase 4
```

---

## Entry Router

When coordinator is invoked, detect invocation type:

| Detection | Condition | Handler |
|-----------|-----------|---------|
| Worker callback | Message contains `[scanner]`, `[diagnoser]`, etc. | -> handleCallback |
| Status check | Arguments contain "check" or "status" | -> handleCheck |
| Manual resume | Arguments contain "resume" or "continue" | -> handleResume |
| Interrupted session | Active/paused session exists | -> Phase 0 (Resume Check) |
| New session | None of above | -> Phase 1 (Requirement Clarification) |

For callback/check/resume: load `commands/monitor.md` and execute handler, then STOP.

### Router Implementation

1. **Load session context** (if exists):
   - Scan `.workflow/.team/ux-improve-*/.msg/meta.json` for active/paused sessions
   - If found, extract known worker roles from meta.json or SKILL.md Role Registry

2. **Parse $ARGUMENTS** for detection keywords

3. **Route to handler**:
   - For monitor handlers: Read `commands/monitor.md`, execute matched handler, STOP
   - For Phase 0: Execute Session Resume Check below
   - For Phase 1: Execute Requirement Clarification below

---

## Phase 0: Session Resume Check

**Trigger**: Interrupted session detected (active/paused session exists)

1. Load session meta.json
2. Audit TaskList -> reconcile session state vs task status
3. Reset in_progress tasks -> pending (interrupted tasks)
4. Check for fast-advance orphans (tasks spawned but not in TaskList)
5. AskUserQuestion: "Resume session <session-id>? [Yes/No/New]"
   - Yes -> Phase 4 (coordination loop)
   - No -> Archive old session -> Phase 1
   - New -> Keep old session paused -> Phase 1

---

## Phase 1: Requirement Clarification

1. Parse $ARGUMENTS for project path and framework flag
2. If project path missing -> AskUserQuestion for path
3. If framework not specified -> detect from package.json or ask user
4. Validate project path exists
5. Store: project_path, framework (react|vue)

---

## Phase 2: Team Creation

1. Generate session ID: `ux-improve-<timestamp>`
2. Create session directory structure:
   ```
   .workflow/.team/<session-id>/
   ├── .msg/
   ├── artifacts/
   ├── explorations/
   └── wisdom/
   ```
3. TeamCreate(team_name="ux-improve")
4. Initialize meta.json with pipeline config:

### Wisdom Initialization

After creating session directory, initialize wisdom from skill's permanent knowledge base:

1. Copy `.claude/skills/team-ux-improve/wisdom/` contents to `<session>/wisdom/`
2. Create `<session>/wisdom/contributions/` directory if not exists
3. This provides workers with initial patterns, principles, and anti-patterns

Example:
```bash
# Copy permanent wisdom to session
cp -r .claude/skills/team-ux-improve/wisdom/* <session>/wisdom/
mkdir -p <session>/wisdom/contributions/
```

5. Initialize meta.json with pipeline config:
   ```
   team_msg(operation="log", session_id=<session-id>, from="coordinator",
            type="state_update",
            data={
              pipeline_mode: "standard",
              pipeline_stages: ["scan", "diagnose", "design", "implement", "test"],
              project_path: <path>,
              framework: <framework>
            })
   ```

---

## Phase 3: Task Chain Creation

Delegate to dispatch.md:

1. Read `roles/coordinator/commands/dispatch.md`
2. Execute Phase 2 (Context Loading)
3. Execute Phase 3 (Task Chain Creation)
4. Execute Phase 4 (Validation)

---

## Phase 4: Spawn-and-Stop Coordination

1. Find ready tasks (status=pending, no blockedBy or all blockedBy completed)
2. For each ready task:
   - Extract role from task owner
   - Spawn team-worker agent with role-spec path
   - Use spawn template from SKILL.md
3. STOP (idle, wait for worker callbacks)

**Spawn template**:
```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: "ux-improve",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-ux-improve/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: ux-improve
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

**Inner loop roles**: implementer (inner_loop: true)

---

## Phase 5: Report + Completion Action

1. Load session state -> count completed tasks, duration
2. List deliverables with output paths:
   - artifacts/scan-report.md
   - artifacts/diagnosis.md
   - artifacts/design-guide.md
   - artifacts/fixes/
   - artifacts/test-report.md

### Wisdom Consolidation

Before pipeline completion, handle knowledge contributions:

1. Check if `<session>/wisdom/contributions/` has any files
2. If contributions exist:
   - Summarize contributions for user review
   - Use AskUserQuestion to ask if user wants to merge valuable contributions back to permanent wisdom
   - If approved, copy selected contributions to `.claude/skills/team-ux-improve/wisdom/` (classify into patterns/, anti-patterns/, etc.)

Example interaction:
```
AskUserQuestion({
  questions: [{
    question: "Workers contributed new knowledge during this session. Merge to permanent wisdom?",
    header: "Knowledge",
    options: [
      { label: "Merge All", description: "Add all contributions to permanent wisdom" },
      { label: "Review First", description: "Show contributions before deciding" },
      { label: "Skip", description: "Keep contributions in session only" }
    ]
  }]
})
```

3. **Completion Action** (interactive mode):

```
AskUserQuestion({
  questions: [{
    question: "Team pipeline complete. What would you like to do?",
    header: "Completion",
    multiSelect: false,
    options: [
      { label: "Archive & Clean (Recommended)", description: "Archive session, clean up tasks and team resources" },
      { label: "Keep Active", description: "Keep session active for follow-up work or inspection" },
      { label: "Export Results", description: "Export deliverables to a specified location, then clean" }
    ]
  }]
})
```

4. Handle user choice:

| Choice | Steps |
|--------|-------|
| Archive & Clean | TaskList -> verify all completed -> update session status="completed" -> TeamDelete("ux-improve") -> output final summary with artifact paths |
| Keep Active | Update session status="paused" -> output: "Session paused. Resume with: Skill(skill='team-ux-improve', args='resume')" |
| Export Results | AskUserQuestion for target directory -> copy all artifacts -> Archive & Clean flow |

---

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Project path invalid | Re-prompt user for valid path |
| Framework detection fails | AskUserQuestion for framework selection |
| Worker spawn fails | Log error, mark task as failed, continue with other tasks |
| TeamCreate fails | Error: cannot proceed without team |
| Completion action timeout (5 min) | Default to Keep Active |
