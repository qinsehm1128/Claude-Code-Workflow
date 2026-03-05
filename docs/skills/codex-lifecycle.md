# Codex Skills - Lifecycle Category

## One-Liner

**Lifecycle Codex Skills is a full lifecycle orchestration system** — implementing complete development flow automation from specification to implementation to testing to review through team-lifecycle and parallel-dev-cycle.

## vs Traditional Methods Comparison

| Dimension | Traditional Methods | **Codex Skills** |
|-----------|---------------------|------------------|
| Pipeline orchestration | Manual task management | Automatic spawn-wait-close pipeline |
| Agent communication | Direct communication | Subagent inline calls |
| Codebase exploration | Repeated exploration | Shared cache system |
| Coordination overhead | Coordinate every step | Fast-advance linear skip |

## Skills List

| Skill | Function | Trigger |
| --- | --- | --- |
| `team-lifecycle` | Full lifecycle orchestrator | `/team-lifecycle <task>` |
| `parallel-dev-cycle` | Multi-agent parallel development cycle | `/parallel-dev-cycle TASK="..."` |

## Skills Details

### team-lifecycle

**One-Liner**: Full lifecycle orchestrator — spawn-wait-close pipeline for spec/implementation/test

**Architecture Overview**:
```
+-------------------------------------------------------------+
|  Team Lifecycle Orchestrator                                  |
|  Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5         |
|  Require    Init       Dispatch   Coordinate   Report         |
+----------+------------------------------------------------+--+
           |
     +-----+------+----------+-----------+-----------+
     v            v          v           v           v
+---------+ +---------+ +---------+ +---------+ +---------+
| Phase 1 | | Phase 2 | | Phase 3 | | Phase 4 | | Phase 5 |
| Require | | Init    | | Dispatch| | Coord   | | Report  |
+---------+ +---------+ +---------+ +---------+ +---------+
     |            |          |          |||          |
  params       session     tasks     agents      summary
                                    /  |  \
                              spawn  wait  close
                              /        |        \
                       +------+   +-------+   +--------+
                       |agent1|   |agent2 |   |agent N |
                       +------+   +-------+   +--------+
                          |           |            |
                     (may call discuss/explore subagents internally)
```

**Key Design Principles**:

1. **Inline discuss subagent**: Production roles (analyst, writer, reviewer) inline invoke discuss subagents, reducing spec pipeline from 12 beats to 6
2. **Shared explore cache**: All agents share centralized `explorations/` directory, eliminating duplicate codebase exploration
3. **Fast-advance spawning**: Immediately spawn next linear successor after agent completion
4. **Consensus severity routing**: Discussion results routed through HIGH/MEDIUM/LOW severity levels
5. **Beat model**: Each pipeline step is a beat — spawn agent, wait for results, process output, spawn next

**Agent Registry**:
| Agent | Role File | Responsibility | Mode |
|-------|-----------|----------------|------|
| analyst | ~/.codex/agents/analyst.md | Seed analysis, context collection, DISCUSS-001 | 2.8 Inline Subagent |
| writer | ~/.codex/agents/writer.md | Documentation generation, DISCUSS-002 to DISCUSS-005 | 2.8 Inline Subagent |
| planner | ~/.codex/agents/planner.md | Multi-angle exploration, plan generation | 2.9 Cached Exploration |
| executor | ~/.codex/agents/executor.md | Code implementation | 2.1 Standard |
| tester | ~/.codex/agents/tester.md | Test-fix loop | 2.3 Deep Interaction |
| reviewer | ~/.codex/agents/reviewer.md | Code review + spec quality, DISCUSS-006 | 2.8 Inline Subagent |
| architect | ~/.codex/agents/architect.md | Architecture consultation (on-demand) | 2.1 Standard |
| fe-developer | ~/.codex/agents/fe-developer.md | Frontend implementation | 2.1 Standard |
| fe-qa | ~/.codex/agents/fe-qa.md | Frontend QA, GC loop | 2.3 Deep Interaction |

**Subagent Registry**:
| Subagent | Agent File | Callable By | Purpose |
|----------|------------|-------------|---------|
| discuss | ~/.codex/agents/discuss-agent.md | analyst, writer, reviewer | Multi-perspective critique via CLI tool |
| explore | ~/.codex/agents/explore-agent.md | analyst, planner, any agent | Codebase exploration with shared cache |

**Pipeline Definition**:
```
Spec-only (6 beats):
  RESEARCH-001(+D1) → DRAFT-001(+D2) → DRAFT-002(+D3) → DRAFT-003(+D4) → DRAFT-004(+D5) → QUALITY-001(+D6)

Impl-only (3 beats):
  PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001

Full-lifecycle (9 beats):
  [Spec pipeline] → PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001
```

**Beat Cycle**:
```
event (phase advance / user resume)
      ↓
  [Orchestrator]
      +-- read state file
      +-- find ready tasks
      +-- spawn agent(s)
      +-- wait(agent_ids, timeout)
      +-- process results (consensus routing, artifacts)
      +-- update state file
      +-- close completed agents
      +-- fast-advance: immediately spawn next if linear successor
      +-- yield (wait for next event or user command)
```

**Fast-Advance Decision Table**:
| Condition | Action |
|-----------|--------|
| 1 ready task, simple linear successor, no checkpoint | Immediately `spawn_agent` next task (fast-advance) |
| Multiple ready tasks (parallel window) | Batch spawn all ready tasks, then `wait` all |
| No ready tasks, other agents running | Yield, wait for those agents to complete |
| No ready tasks, nothing running | Pipeline complete, enter Phase 5 |
| Checkpoint task complete (e.g., QUALITY-001) | Pause, output checkpoint message, wait for user |

**Consensus Severity Routing**:
| Verdict | Severity | Orchestrator Action |
|---------|----------|---------------------|
| consensus_reached | - | Proceed normally, fast-advance to next task |
| consensus_blocked | LOW | Treat as reached with notes, proceed |
| consensus_blocked | MEDIUM | Log warning to `wisdom/issues.md`, include divergences in next task context, continue |
| consensus_blocked | HIGH | Create revision task or pause waiting for user |
| consensus_blocked | HIGH (DISCUSS-006) | Always pause waiting for user decision (final sign-off gate) |

**Revision Task Creation** (HIGH severity, non-DISCUSS-006):
```javascript
const revisionTask = {
  id: "<original-task-id>-R1",
  owner: "<same-agent-role>",
  blocked_by: [],
  description: "Revision of <original-task-id>: address consensus-blocked divergences.\n"
    + "Session: <session-dir>\n"
    + "Original artifact: <artifact-path>\n"
    + "Divergences: <divergence-details>\n"
    + "Action items: <action-items-from-discuss>\n"
    + "InlineDiscuss: <same-round-id>",
  status: "pending",
  is_revision: true
}
```

**Session Directory Structure**:
```
.workflow/.team/TLS-<slug>-<date>/
├── team-session.json           # Pipeline state (replaces TaskCreate/TaskList)
├── spec/                       # Specification artifacts
│   ├── spec-config.json
│   ├── discovery-context.json
│   ├── product-brief.md
│   ├── requirements/
│   ├── architecture/
│   ├── epics/
│   ├── readiness-report.md
│   └── spec-summary.md
├── discussions/                # Discussion records (written by discuss subagents)
├── plan/                       # Plan artifacts
│   ├── plan.json
│   └── tasks/                  # Detailed task specifications
├── explorations/               # Shared exploration cache
│   ├── cache-index.json        # { angle -> file_path }
│   └── explore-<angle>.json
├── architecture/               # Architect assessments + design-tokens.json
├── analysis/                   # Analyst design-intelligence.json (UI mode)
├── qa/                         # QA audit reports
├── wisdom/                     # Cross-task knowledge accumulation
│   ├── learnings.md            # Patterns and insights
│   ├── decisions.md            # Architecture and design decisions
│   ├── conventions.md          # Codebase conventions
│   └── issues.md               # Known risks and issues
└── shared-memory.json          # Cross-agent state
```

**State File Schema** (team-session.json):
```json
{
  "session_id": "TLS-<slug>-<date>",
  "mode": "<spec-only | impl-only | full-lifecycle | fe-only | fullstack | full-lifecycle-fe>",
  "scope": "<project description>",
  "status": "<active | paused | completed>",
  "started_at": "<ISO8601>",
  "updated_at": "<ISO8601>",
  "tasks_total": 0,
  "tasks_completed": 0,
  "pipeline": [
    {
      "id": "RESEARCH-001",
      "owner": "analyst",
      "status": "pending | in_progress | completed | failed",
      "blocked_by": [],
      "description": "...",
      "inline_discuss": "DISCUSS-001",
      "agent_id": null,
      "artifact_path": null,
      "discuss_verdict": null,
      "discuss_severity": null,
      "started_at": null,
      "completed_at": null,
      "revision_of": null,
      "revision_count": 0
    }
  ],
  "active_agents": [],
  "completed_tasks": [],
  "revision_chains": {},
  "wisdom_entries": [],
  "checkpoints_hit": [],
  "gc_loop_count": 0
}
```

**User Commands**:
| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph (read-only, no progress) |
| `resume` / `continue` | Check agent status, advance pipeline |
| New session request | Phase 0 detection, enter normal Phase 1-5 flow |

**Status Graph Output Format**:
```
[orchestrator] Pipeline Status
[orchestrator] Mode: <mode> | Progress: <completed>/<total> (<percent>%)

[orchestrator] Execution Graph:
  Spec Phase:
    [V RESEARCH-001(+D1)] -> [V DRAFT-001(+D2)] -> [>>> DRAFT-002(+D3)]
    -> [o DRAFT-003(+D4)] -> [o DRAFT-004(+D5)] -> [o QUALITY-001(+D6)]

  V=completed  >>>=running  o=pending  .=not created

[orchestrator] Active Agents:
  > <task-id> (<agent-role>) - running <elapsed>

[orchestrator] Commands: 'resume' to advance | 'check' to refresh
```

---

### parallel-dev-cycle

**One-Liner**: Multi-agent parallel development cycle — requirements analysis, exploration planning, code development, validation

**Architecture Overview**:
```
┌─────────────────────────────────────────────────────────────┐
│                    User Input (Task)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
              ┌──────────────────────────────┐
              │  Main Flow (Inline Orchestration)  │
              │  Phase 1 → 2 → 3 → 4              │
              └──────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        v                    v                    v
    ┌────────┐         ┌────────┐         ┌────────┐
    │  RA    │         │  EP    │         │  CD    │
    │Agent   │         │Agent   │         │Agent   │
    └────────┘         └────────┘         └────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             v
                         ┌────────┐
                         │  VAS   │
                         │ Agent  │
                         └────────┘
                             │
                             v
              ┌──────────────────────────────┐
              │    Summary Report            │
              │  & Markdown Docs             │
              └──────────────────────────────┘
```

**Key Design Principles**:

1. **Main document + auxiliary log**: Each agent maintains one main document (complete rewrite per iteration) and auxiliary log (append)
2. **Version-based overwriting**: Main document completely rewritten each iteration; log append-only
3. **Automatic archiving**: Old main document versions automatically archived to `history/` directory
4. **Complete audit trail**: Changes.log (NDJSON) retains all change history
5. **Parallel coordination**: Four agents started simultaneously; coordinated via shared state and inline main flow
6. **File references**: Use short file paths rather than content passing
7. **Self-enhancement**: RA agent proactively expands requirements based on context
8. **Shared discovery board**: All agents share exploration discoveries via `discoveries.ndjson`

**Workers**:
| Worker | Main Document (rewrite each iteration) | Append Log |
|--------|----------------------------------------|------------|
| **RA** | requirements.md | changes.log |
| **EP** | exploration.md, architecture.md, plan.json | changes.log |
| **CD** | implementation.md, issues.md | changes.log, debug-log.ndjson |
| **VAS** | summary.md, test-results.json | changes.log |

**Shared Discovery Board**:
- All agents share real-time discovery board `coordination/discoveries.ndjson`
- Agents read at start, append discoveries during work
- Eliminates redundant codebase exploration

**Discovery Types**:
| Type | Dedup Key | Writer | Readers |
|------|-----------|--------|---------|
| `tech_stack` | singleton | RA | EP, CD, VAS |
| `project_config` | `data.path` | RA | EP, CD |
| `existing_feature` | `data.name` | RA, EP | CD |
| `architecture` | singleton | EP | CD, VAS |
| `code_pattern` | `data.name` | EP, CD | CD, VAS |
| `integration_point` | `data.file` | EP | CD |
| `test_command` | singleton | CD, VAS | VAS, CD |
| `blocker` | `data.issue` | Any | All |

**Execution Flow**:
```
Phase 1: Session initialization
    ├─ Create new cycle OR resume existing cycle
    ├─ Initialize state file and directory structure
    └─ Output: cycleId, state, progressDir

Phase 2: Agent execution (parallel)
    ├─ Attached task: spawn RA → spawn EP → spawn CD → spawn VAS → wait all
    ├─ Parallel spawn RA, EP, CD, VAS agents
    ├─ Wait for all agents to complete (with timeout handling)
    └─ Output: agentOutputs (4 agent results)

Phase 3: Result aggregation & iteration
    ├─ Parse PHASE_RESULT from each agent
    ├─ Detect issues (test failures, blockers)
    ├─ Decision: Issues found AND iteration < max?
    │   ├─ Yes → Send feedback via send_input, loop back to Phase 2
    │   └─ No → Proceed to Phase 4
    └─ Output: parsedResults, iteration status

Phase 4: Completion and summary
    ├─ Generate unified summary report
    ├─ Update final state
    ├─ Close all agents
    └─ Output: Final cycle report and continuation instructions
```

**Session Structure**:
```
{projectRoot}/.workflow/.cycle/
├── {cycleId}.json                     # Main state file
├── {cycleId}.progress/
│   ├── ra/                         # RA agent artifacts
│   │   ├── requirements.md        # Current version (complete rewrite)
│   │   ├── changes.log           # NDJSON full history (append)
│   │   └── history/              # Archived snapshots
│   ├── ep/                         # EP agent artifacts
│   │   ├── exploration.md        # Codebase exploration report
│   │   ├── architecture.md       # Architecture design
│   │   ├── plan.json             # Structured task list (current version)
│   │   ├── changes.log           # NDJSON full history
│   │   └── history/
│   ├── cd/                         # CD agent artifacts
│   │   ├── implementation.md     # Current version
│   │   ├── debug-log.ndjson      # Debug hypothesis tracking
│   │   ├── changes.log           # NDJSON full history
│   │   └── history/
│   ├── vas/                        # VAS agent artifacts
│   │   ├── summary.md            # Current version
│   │   ├── changes.log           # NDJSON full history
│   │   └── history/
│   └── coordination/               # Coordination data
│       ├── discoveries.ndjson      # Shared discovery board (all agents append)
│       ├── timeline.md             # Execution timeline
│       └── decisions.log            # Decision log
```

**Version Control**:
- 1.0.0: Initial cycle → 1.x.0: Each iteration (minor version increment)
- Each iteration: Archive old version → Complete rewrite → Append changes.log

## Related Commands

- [Codex Skills - Workflow](./codex-workflow.md)
- [Codex Skills - Specialized](./codex-specialized.md)
- [Claude Skills - Team Collaboration](./claude-collaboration.md)

## Best Practices

1. **Choose the right team type**:
   - Full feature development → `team-lifecycle`
   - Parallel development cycle → `parallel-dev-cycle`

2. **Leverage Inline Discuss**: Production roles inline invoke discuss subagents, reducing orchestration overhead

3. **Shared Cache**: Utilize shared exploration cache to avoid duplicate codebase exploration

4. **Fast-Advance**: Linear successor tasks automatically skip orchestrator, improving efficiency

5. **Consensus Routing**: Understand consensus routing behavior for different severity levels

## Usage Examples

```bash
# Full lifecycle development
/team-lifecycle "Build user authentication API"

# Specification pipeline
/team-lifecycle --mode=spec-only "Design payment system"

# Parallel development
/parallel-dev-cycle TASK="Implement notifications"

# Continue cycle
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123

# Auto mode
/parallel-dev-cycle --auto TASK="Add OAuth"
```
