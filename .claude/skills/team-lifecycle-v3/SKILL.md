---
name: team-lifecycle-v3
description: Enhanced lifecycle with parallel execution, conditional routing, dynamic role injection, and task priority scheduling. Built on team-worker agent architecture with artifact contracts and automatic discovery.
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Agent(*), AskUserQuestion(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*)
---

# Team Lifecycle v3

Enhanced lifecycle: specification → implementation → testing → review with parallel execution, conditional routing, and dynamic specialist role injection. Built on **team-worker agent architecture** with **artifact contracts** and **automatic discovery**.


## Architecture

```
+---------------------------------------------------+
|  Skill(skill="team-lifecycle-v3")                  |
|  args="task description"                           |
+-------------------+-------------------------------+
                    |
         Orchestration Mode (auto -> coordinator)
                    |
              Coordinator (inline)
              Phase 0-5 orchestration
              + Dynamic role injection
              + Priority scheduling
              + Artifact registry
                    |
    +----+-----+-------+-------+-------+-------+-------+
    v    v     v       v       v       v       v       v
 [team-worker agents, each loaded with a role-spec]

  Core Pipeline (9 roles from v2):
    analyst writer planner executor tester reviewer
    architect fe-developer fe-qa

  Specialist Roles (6 new roles, injected on-demand):
    orchestrator security-expert performance-optimizer
    data-engineer devops-engineer ml-engineer

  Utility Members (3):
    [explorer] [discussant] [doc-generator]
```

## Role Router

Coordinator-only. Workers spawned as `team-worker` agents.

### Role Registry

| Role | Spec | Task Prefix | Type | Inner Loop | Injection |
|------|------|-------------|------|------------|-----------|
| coordinator | [roles/coordinator/role.md](roles/coordinator/role.md) | (none) | orchestrator | - | Always |
| analyst | [role-specs/analyst.md](role-specs/analyst.md) | RESEARCH-* | pipeline | false | Always |
| writer | [role-specs/writer.md](role-specs/writer.md) | DRAFT-* | pipeline | true | Always |
| planner | [role-specs/planner.md](role-specs/planner.md) | PLAN-* | pipeline | true | Always |
| executor | [role-specs/executor.md](role-specs/executor.md) | IMPL-* | pipeline | true | Always |
| tester | [role-specs/tester.md](role-specs/tester.md) | TEST-* | pipeline | false | Always |
| reviewer | [role-specs/reviewer.md](role-specs/reviewer.md) | REVIEW-* + QUALITY-* + IMPROVE-* | pipeline | false | Always |
| architect | [role-specs/architect.md](role-specs/architect.md) | ARCH-* | consulting | false | High complexity |
| fe-developer | [role-specs/fe-developer.md](role-specs/fe-developer.md) | DEV-FE-* | frontend | false | Frontend tasks |
| fe-qa | [role-specs/fe-qa.md](role-specs/fe-qa.md) | QA-FE-* | frontend | false | Frontend tasks |
| **orchestrator** | [role-specs/orchestrator.md](role-specs/orchestrator.md) | ORCH-* | specialist | false | **Multi-module** |
| **security-expert** | [role-specs/security-expert.md](role-specs/security-expert.md) | SECURITY-* | specialist | false | **security keywords** |
| **performance-optimizer** | [role-specs/performance-optimizer.md](role-specs/performance-optimizer.md) | PERF-* | specialist | false | **performance keywords** |
| **data-engineer** | [role-specs/data-engineer.md](role-specs/data-engineer.md) | DATA-* | specialist | false | **data keywords** |
| **devops-engineer** | [role-specs/devops-engineer.md](role-specs/devops-engineer.md) | DEVOPS-* | specialist | false | **devops keywords** |
| **ml-engineer** | [role-specs/ml-engineer.md](role-specs/ml-engineer.md) | ML-* | specialist | false | **ML keywords** |

### CLI Tool Usage in Workers

Workers use CLI tools for complex analysis:

| Capability | CLI Command | Used By |
|------------|-------------|---------|
| Codebase exploration | `ccw cli --tool gemini --mode analysis` | analyst, planner, architect |
| Multi-perspective critique | `ccw cli --tool gemini --mode analysis` (parallel) | analyst, writer, reviewer |
| Document generation | `ccw cli --tool gemini --mode write` | writer |

### Coordinator-Only Utility Members

**⚠️ COORDINATOR ONLY**: Utility members can only be spawned by Coordinator.
Workers CANNOT call Agent() to spawn utility members.

Coordinator can spawn utility members for team-level orchestration:

| Utility Member | Purpose | When | Callable By |
|----------------|---------|------|-------------|
| explorer | Parallel multi-angle exploration | High complexity analysis | **Coordinator only** |
| discussant | Aggregate multi-CLI critique | Critical decision points | **Coordinator only** |

### Worker Alternatives

Workers needing similar capabilities must use CLI tools:

| Capability | CLI Command | Example |
|------------|-------------|---------|
| Codebase exploration | `ccw cli --tool gemini --mode analysis` | Explore architecture patterns |
| Multi-perspective critique | Parallel CLI calls | Security + performance + quality reviews |
| Document generation | `ccw cli --tool gemini --mode write` | Generate PRD from research |

### Dynamic Role Injection

Coordinator analyzes task description and plan complexity to inject specialist roles at runtime:

| Trigger | Injected Role | Injection Point |
|---------|---------------|-----------------|
| Keywords: security, vulnerability, OWASP | security-expert | After PLAN-001 |
| Keywords: performance, optimization, bottleneck | performance-optimizer | After IMPL-* |
| Keywords: data, pipeline, ETL, schema | data-engineer | Parallel with IMPL-* |
| Keywords: devops, CI/CD, deployment, docker | devops-engineer | After IMPL-* |
| Keywords: ML, model, training, inference | ml-engineer | Parallel with IMPL-* |
| Complexity: High + multi-module | orchestrator | Replace IMPL-* with ORCH-* |

### Dispatch

Always route to coordinator. Coordinator reads `roles/coordinator/role.md`.

### Orchestration Mode

**Invocation**: `Skill(skill="team-lifecycle-v3", args="task description")`

**Lifecycle**:
```
User provides task description
  -> coordinator Phase 1-3: clarify -> TeamCreate -> analyze complexity -> inject roles -> create task chain
  -> coordinator Phase 4: spawn first batch workers (background) -> STOP
  -> Worker executes -> SendMessage callback -> coordinator advances
  -> Loop until pipeline complete -> Phase 5 report + completion action
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
role_spec: .claude/skills/team-lifecycle-v3/role-specs/<role>.md
session: <session-folder>
session_id: <session-id>
team_name: <team-name>
requirement: <task-description>
inner_loop: <true|false>
priority: <P0|P1|P2>

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

### Impl-only (4 tasks)

```
PLAN-001 -> IMPL-001 -> TEST-001 + REVIEW-001
```

### Full-lifecycle (10 tasks, v2 compatible)

```
[Spec pipeline] -> PLAN-001(blockedBy: QUALITY-001) -> IMPL-001 -> TEST-001 + REVIEW-001
```

### Enhanced Parallel Pipeline (v3 NEW)

```
RESEARCH-001(+D1) -> DRAFT-001 -> DRAFT-002(+D2) -> DRAFT-003 -> DRAFT-004 -> QUALITY-001(+D3)
                                                                                    |
                                                                                    v
                                                                              PLAN-001 (complexity assessment)
                                                                                    |
                                                                    +---------------+---------------+
                                                                    |               |               |
                                                              Low: IMPL-001   Med: ORCH-001   High: ARCH-001
                                                                    |          -> IMPL-*         -> ORCH-001
                                                                    |                                -> IMPL-*
                                                                    v
                                                              IMPL-001 || DEV-FE-001 (parallel, P0)
                                                                    |
                                                                    v
                                                              TEST-001 || QA-FE-001 (parallel, P1)
                                                                    |
                                                                    v
                                                              REVIEW-001 (P1)
```

### Conditional Routing (v3 NEW)

PLAN-001 assesses complexity and routes accordingly:

| Complexity | Route | Roles |
|------------|-------|-------|
| Low (1-2 modules, shallow deps) | Direct IMPL | executor |
| Medium (3-4 modules, moderate deps) | Orchestrated IMPL | orchestrator -> executor (parallel) |
| High (5+ modules, deep deps) | Architecture + Orchestrated IMPL | architect -> orchestrator -> executor (parallel) |

### Dynamic Injection Example (v3 NEW)

Task description: "Implement user authentication with OAuth2, add security audit, optimize login performance"

Injected roles:
- security-expert (keyword: security, audit)
- performance-optimizer (keyword: optimize, performance)

Pipeline becomes:
```
PLAN-001 -> IMPL-001 || SECURITY-001 || PERF-001 -> TEST-001 -> REVIEW-001
```

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake -> process -> spawn -> STOP.

```
Beat Cycle (v3 Enhanced)
======================================================================
  Event                   Coordinator              Workers
----------------------------------------------------------------------
  callback/resume --> +- handleCallback -+
                      |  mark completed   |
                      |  check artifacts  |  <- v3: artifact validation
                      |  update registry  |  <- v3: artifact registry
                      +- handleSpawnNext -+
                      |  find ready tasks |
                      |  priority sort    |  <- v3: P0/P1/P2 scheduling
                      |  inject roles     |  <- v3: dynamic injection
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
| Complexity routing | PLAN-001 completed | Display routing decision, continue |
| Parallel merge | All parallel tasks complete | Validate integration, continue |
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

| Task ID | Role | Phase | Dependencies | Discuss | Priority |
|---------|------|-------|-------------|---------|----------|
| RESEARCH-001 | analyst | spec | (none) | DISCUSS-001 | P0 |
| DRAFT-001 | writer | spec | RESEARCH-001 | self-validate | P0 |
| DRAFT-002 | writer | spec | DRAFT-001 | DISCUSS-002 | P0 |
| DRAFT-003 | writer | spec | DRAFT-002 | self-validate | P0 |
| DRAFT-004 | writer | spec | DRAFT-003 | self-validate | P0 |
| QUALITY-001 | reviewer | spec | DRAFT-004 | DISCUSS-003 | P0 |
| PLAN-001 | planner | impl | (none or QUALITY-001) | - | P0 |
| ARCH-001 | architect | impl | PLAN-001 | - | P0 (if High complexity) |
| ORCH-001 | orchestrator | impl | PLAN-001 or ARCH-001 | - | P0 (if Med/High complexity) |
| IMPL-001 | executor | impl | PLAN-001 or ORCH-001 | - | P0 |
| DEV-FE-001 | fe-developer | impl | PLAN-001 or ORCH-001 | - | P0 (parallel with IMPL-001) |
| TEST-001 | tester | impl | IMPL-001 | - | P1 |
| QA-FE-001 | fe-qa | impl | DEV-FE-001 | - | P1 (parallel with TEST-001) |
| REVIEW-001 | reviewer | impl | IMPL-001 | - | P1 |
| SECURITY-001 | security-expert | impl | IMPL-001 | - | P0 (if injected) |
| PERF-001 | performance-optimizer | impl | IMPL-001 | - | P1 (if injected) |
| DATA-001 | data-engineer | impl | PLAN-001 | - | P0 (if injected, parallel) |
| DEVOPS-001 | devops-engineer | impl | IMPL-001 | - | P1 (if injected) |
| ML-001 | ml-engineer | impl | PLAN-001 | - | P0 (if injected, parallel) |

---

## v3 Artifact Contract

All workers generate `artifact-manifest.json` alongside deliverables for validation gating and automatic discovery.

### Manifest Schema

```json
{
  "artifact_id": "string",
  "creator_role": "string",
  "artifact_type": "string",
  "version": "string",
  "path": "string",
  "dependencies": ["string"],
  "validation_status": "pending|passed|failed",
  "validation_summary": "string",
  "metadata": {
    "created_at": "ISO8601 timestamp",
    "task_id": "string",
    "priority": "P0|P1|P2"
  }
}
```

### Validation Gating

Coordinator checks `validation_status` before spawning downstream workers:

| Status | Action |
|--------|--------|
| `passed` | Spawn next worker |
| `failed` | Block spawn, trigger fix loop |
| `pending` | Wait or prompt manual validation |

### Artifact Registry

Coordinator maintains in-memory artifact registry for automatic discovery:

```json
{
  "artifacts": {
    "<artifact-id>": {
      "manifest": { ... },
      "discovered_at": "timestamp",
      "consumed_by": ["<role-name>"]
    }
  }
}
```

Workers read `context-artifacts.json` in Phase 2 to discover upstream artifacts automatically.

---

## Session Directory

```
.workflow/.team/TLS-<slug>-<date>/
+-- team-session.json
+-- artifact-registry.json          <- v3 NEW
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
+-- artifacts/                      <- v3 NEW: artifact manifests
|   +-- artifact-manifest-*.json
+-- .msg/
+-- shared-memory.json
```

## Session Resume

1. Scan `.workflow/.team/TLS-*/team-session.json` for active/paused sessions
2. Multiple matches -> AskUserQuestion
3. Audit TaskList -> reconcile session state
4. Reset in_progress -> pending (interrupted tasks)
5. Rebuild team, spawn needed workers only
6. Restore artifact registry from session
7. Kick first executable task

## Shared Resources

| Resource | Path | Usage |
|----------|------|-------|
| Document Standards | [specs/document-standards.md](specs/document-standards.md) | YAML frontmatter, naming, structure |
| Quality Gates | [specs/quality-gates.md](specs/quality-gates.md) | Per-phase quality gates |
| Team Config | [specs/team-config.json](specs/team-config.json) | Role registry, pipeline definitions |
| Artifact Contract | [specs/artifact-contract-spec.md](specs/artifact-contract-spec.md) | Artifact manifest schema |
| Role Library | [specs/role-library/](specs/role-library/) | Dynamic role definitions |
| Product Brief Template | [templates/product-brief.md](templates/product-brief.md) | DRAFT-001 |
| Requirements Template | [templates/requirements-prd.md](templates/requirements-prd.md) | DRAFT-002 |
| Architecture Template | [templates/architecture-doc.md](templates/architecture-doc.md) | DRAFT-003 |
| Epics Template | [templates/epics-template.md](templates/epics-template.md) | DRAFT-004 |
| Discuss Subagent | [subagents/discuss-subagent.md](subagents/discuss-subagent.md) | 3-round discuss protocol |
| Explorer Subagent | [subagents/explorer-subagent.md](subagents/explorer-subagent.md) | Shared exploration with cache |
| Doc Generator Subagent | [subagents/doc-generator-subagent.md](subagents/doc-generator-subagent.md) | Template-based doc generation |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown command | Error with available command list |
| Role spec file not found | Error with expected path |
| Command file not found | Fallback to inline execution |
| Discuss subagent fails | Worker proceeds without discuss, logs warning |
| Fast-advance spawns wrong task | Coordinator reconciles on next callback |
| Artifact validation fails | Block downstream, trigger fix loop |
| Dynamic role injection fails | Log warning, continue with core roles |
| Priority conflict | P0 > P1 > P2, FIFO within same priority |
| Parallel merge timeout | Report stall, prompt user intervention |
