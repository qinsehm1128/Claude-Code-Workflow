---
name: team-lifecycle-v2
description: Optimized team skill for full lifecycle. Reduced discuss (6→3), progressive spec refinement preserved. team-worker agent architecture. Triggers on "team lifecycle v2".
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Agent(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Lifecycle v2

Optimized lifecycle: specification → implementation → testing → review. Built on **team-worker agent architecture**. Key optimization: discuss rounds reduced from 6 to 3 (direction, requirements, final gate).

## Architecture

```
+---------------------------------------------------+
|  Skill(skill="team-lifecycle-v2")                  |
|  args="task description"                           |
+-------------------+-------------------------------+
                    |
         Orchestration Mode (auto -> coordinator)
                    |
              Coordinator (inline)
              Phase 0-5 orchestration
                    |
    +----+-----+-------+-------+-------+-------+
    v    v     v       v       v       v       v
 [team-worker agents, each loaded with a role-spec]
  analyst writer planner executor tester reviewer
                                    ^        ^
                              on-demand by coordinator
                            +---------+ +--------+
                            |architect| |fe-dev  |
                            +---------+ +--------+
                                        +--------+
                                        | fe-qa  |
                                        +--------+

  ⚠️ ARCHITECTURAL CONSTRAINT: Workers CANNOT spawn subagents.
  Workers use CLI tools for complex analysis (see "CLI Tool Usage in Workers" section).
```

## Role Router

Coordinator-only. Workers spawned as `team-worker` agents.

### Role Registry

| Role | Spec | Task Prefix | Type | Inner Loop |
|------|------|-------------|------|------------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | (none) | orchestrator | - |
| analyst | [role-specs/analyst.md](role-specs/analyst.md) | RESEARCH-* | pipeline | false |
| writer | [role-specs/writer.md](role-specs/writer.md) | DRAFT-* | pipeline | true |
| planner | [role-specs/planner.md](role-specs/planner.md) | PLAN-* | pipeline | true |
| executor | [role-specs/executor.md](role-specs/executor.md) | IMPL-* | pipeline | true |
| tester | [role-specs/tester.md](role-specs/tester.md) | TEST-* | pipeline | false |
| reviewer | [role-specs/reviewer.md](role-specs/reviewer.md) | REVIEW-* + QUALITY-* + IMPROVE-* | pipeline | false |
| architect | [role-specs/architect.md](role-specs/architect.md) | ARCH-* | consulting | false |
| fe-developer | [role-specs/fe-developer.md](role-specs/fe-developer.md) | DEV-FE-* | frontend | false |
| fe-qa | [role-specs/fe-qa.md](role-specs/fe-qa.md) | QA-FE-* | frontend | false |

### CLI Tool Usage in Workers

**⚠️ ARCHITECTURAL CONSTRAINT**: Workers CANNOT call Agent() to spawn subagents.
Workers must use CLI tools for complex analysis.

| Capability | CLI Command | Used By |
|------------|-------------|---------|
| Multi-perspective critique | `ccw cli --tool gemini --mode analysis` (parallel calls) | analyst, writer, reviewer |
| Codebase exploration | `ccw cli --tool gemini --mode analysis` | analyst, planner |
| Document generation | `ccw cli --tool gemini --mode write` | writer |

### Coordinator-Only Utilities

If Coordinator needs utility members for team-level orchestration, it can spawn them.
Workers cannot spawn utility members.

### Dispatch

Always route to coordinator. Coordinator reads `roles/coordinator/role.md`.

### Orchestration Mode

**Invocation**: `Skill(skill="team-lifecycle-v2", args="task description")`

**Lifecycle**:
```
User provides task description
  -> coordinator Phase 1-3: clarify -> TeamCreate -> create task chain
  -> coordinator Phase 4: spawn first batch workers (background) -> STOP
  -> Worker executes -> SendMessage callback -> coordinator advances
  -> Loop until pipeline complete -> Phase 5 report
```

**User Commands**:

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status, no advancement |
| `resume` / `continue` | Check worker states, advance next step |
| `revise <TASK-ID> [feedback]` | Create revision task + cascade downstream |
| `feedback <text>` | Analyze feedback, create targeted revision |
| `recheck` | Re-run QUALITY-001 quality check |
| `improve [dimension]` | Auto-improve weakest dimension |

---

## Coordinator Spawn Template

```
Agent({
  subagent_type: "team-worker",
  description: "Spawn <role> worker",
  team_name: <team-name>,
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-lifecycle-v2/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: <true|false>

Read role_spec file to load Phase 2-4 domain instructions.
Execute built-in Phase 1 (task discovery) -> role-spec Phase 2-4 -> built-in Phase 5 (report).`
})
```

---

## Pipeline Definitions

### Spec-only (6 tasks, 3 discuss)

```
RESEARCH-001(+D1) -> DRAFT-001 -> DRAFT-002(+D2) -> DRAFT-003 -> DRAFT-004 -> QUALITY-001(+D3)
```

Note: DRAFT-001, DRAFT-003, DRAFT-004 use self-validation only (no discuss).

### Impl-only (4 tasks)

```
PLAN-001 -> IMPL-001 -> TEST-001 + REVIEW-001
```

### Full-lifecycle (10 tasks)

```
[Spec pipeline] -> PLAN-001(blockedBy: QUALITY-001) -> IMPL-001 -> TEST-001 + REVIEW-001
```

### Frontend Pipelines

```
FE-only:       PLAN-001 -> DEV-FE-001 -> QA-FE-001
               (GC loop: max 2 rounds)

Fullstack:     PLAN-001 -> IMPL-001 || DEV-FE-001 -> TEST-001 || QA-FE-001 -> REVIEW-001

Full + FE:     [Spec pipeline] -> PLAN-001 -> IMPL-001 || DEV-FE-001 -> TEST-001 || QA-FE-001 -> REVIEW-001
```

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake -> process -> spawn -> STOP.

```
Beat Cycle
======================================================================
  Event                   Coordinator              Workers
----------------------------------------------------------------------
  callback/resume --> +- handleCallback -+
                      |  mark completed   |
                      |  check pipeline   |
                      +- handleSpawnNext -+
                      |  find ready tasks |
                      |  spawn workers ---+--> [team-worker] Phase 1-5
                      +- STOP (idle) -----+         |
                                                     |
  callback <-----------------------------------------+

  Fast-Advance (skips coordinator for simple linear successors)
======================================================================
  [Worker A] Phase 5 complete
    +- 1 ready task? simple successor?
    |   --> spawn team-worker B directly
    |   --> log fast_advance to message bus
    +- complex case? --> SendMessage to coordinator
======================================================================
```

### Checkpoints

| Trigger | Position | Behavior |
|---------|----------|----------|
| Spec->Impl transition | QUALITY-001 completed | Display checkpoint, pause for user |
| GC loop max | QA-FE max 2 rounds | Stop iteration, report |
| Pipeline stall | No ready + no running | Report to user |

**Checkpoint Output Template** (QUALITY-001):

```
[coordinator] ══════════════════════════════════════════
[coordinator] SPEC PHASE COMPLETE
[coordinator] Quality Gate: <PASS|REVIEW|FAIL> (<score>%)
[coordinator]
[coordinator] Dimension Scores:
[coordinator]   Completeness:  <bar> <n>%
[coordinator]   Consistency:   <bar> <n>%
[coordinator]   Traceability:  <bar> <n>%
[coordinator]   Depth:         <bar> <n>%
[coordinator]   Coverage:      <bar> <n>%
[coordinator]
[coordinator] Available Actions:
[coordinator]   resume              -> Proceed to implementation
[coordinator]   improve             -> Auto-improve weakest dimension
[coordinator]   revise <TASK-ID>    -> Revise specific document
[coordinator]   recheck             -> Re-run quality check
[coordinator]   feedback <text>     -> Inject feedback
[coordinator] ══════════════════════════════════════════
```

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Discuss |
|---------|------|-------|-------------|---------|
| RESEARCH-001 | analyst | spec | (none) | DISCUSS-001 |
| DRAFT-001 | writer | spec | RESEARCH-001 | self-validate |
| DRAFT-002 | writer | spec | DRAFT-001 | DISCUSS-002 |
| DRAFT-003 | writer | spec | DRAFT-002 | self-validate |
| DRAFT-004 | writer | spec | DRAFT-003 | self-validate |
| QUALITY-001 | reviewer | spec | DRAFT-004 | DISCUSS-003 |
| PLAN-001 | planner | impl | (none or QUALITY-001) | - |
| IMPL-001 | executor | impl | PLAN-001 | - |
| TEST-001 | tester | impl | IMPL-001 | - |
| REVIEW-001 | reviewer | impl | IMPL-001 | - |
| DEV-FE-001 | fe-developer | impl | PLAN-001 | - |
| QA-FE-001 | fe-qa | impl | DEV-FE-001 | - |

---

## Session Directory

```
.workflow/.team/TLS-<slug>-<date>/
+-- team-session.json
+-- spec/
|   +-- spec-config.json
|   +-- discovery-context.json
|   +-- product-brief.md
|   +-- requirements/
|   +-- architecture/
|   +-- epics/
|   +-- readiness-report.md
+-- discussions/
+-- plan/
|   +-- plan.json
|   +-- .task/TASK-*.json
+-- explorations/
+-- .msg/
+-- shared-memory.json
```

## Session Resume

1. Scan `.workflow/.team/TLS-*/team-session.json` for active/paused sessions
2. Multiple matches -> AskUserQuestion
3. Audit TaskList -> reconcile session state
4. Reset in_progress -> pending (interrupted tasks)
5. Rebuild team, spawn needed workers only
6. Kick first executable task

## Shared Resources

| Resource | Path | Usage |
|----------|------|-------|
| Document Standards | [specs/document-standards.md](specs/document-standards.md) | YAML frontmatter, naming, structure |
| Quality Gates | [specs/quality-gates.md](specs/quality-gates.md) | Per-phase quality gates |
| Team Config | [specs/team-config.json](specs/team-config.json) | Role registry, pipeline definitions |
| Product Brief Template | [templates/product-brief.md](templates/product-brief.md) | DRAFT-001 |
| Requirements Template | [templates/requirements-prd.md](templates/requirements-prd.md) | DRAFT-002 |
| Architecture Template | [templates/architecture-doc.md](templates/architecture-doc.md) | DRAFT-003 |
| Epics Template | [templates/epics-template.md](templates/epics-template.md) | DRAFT-004 |
| Discuss Subagent | [subagents/discuss-subagent.md](subagents/discuss-subagent.md) | 3-round discuss protocol |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown command | Error with available command list |
| Role spec file not found | Error with expected path |
| Command file not found | Fallback to inline execution |
| Discuss subagent fails | Worker proceeds without discuss, logs warning |
| Fast-advance spawns wrong task | Coordinator reconciles on next callback |
