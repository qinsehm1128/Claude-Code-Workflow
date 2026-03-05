# Codex Skills Overview

## One-Liner

**Codex Skills is a specialized skill system for the Codex model** — implementing multi-agent parallel development and collaborative analysis through lifecycle, workflow, and specialized skill categories.

## vs Claude Skills Comparison

| Dimension | Claude Skills | Codex Skills |
|-----------|---------------|--------------|
| **Model** | Claude model | Codex model |
| **Architecture** | team-worker agent architecture | spawn-wait-close agent pattern |
| **Subagents** | discuss/explore subagents (inline calls) | discuss/explore subagents (independent calls) |
| **Coordinator** | Built-in coordinator + dynamic roles | Main process inline orchestration |
| **State Management** | team-session.json | state file |
| **Cache** | explorations/cache-index.json | shared discoveries.ndjson |

## Skill Categories

| Category | Document | Description |
|----------|----------|-------------|
| **Lifecycle** | [lifecycle.md](./codex-lifecycle.md) | Full lifecycle orchestration |
| **Workflow** | [workflow.md](./codex-workflow.md) | Parallel development and collaborative workflows |
| **Specialized** | [specialized.md](./codex-specialized.md) | Specialized skills |

## Core Concepts Overview

| Concept | Description | Location/Command |
|---------|-------------|------------------|
| **team-lifecycle** | Full lifecycle orchestrator | `/team-lifecycle` |
| **parallel-dev-cycle** | Parallel development cycle | `/parallel-dev-cycle` |
| **analyze-with-file** | Collaborative analysis | `/analyze-with-file` |
| **brainstorm-with-file** | Brainstorming | `/brainstorm-with-file` |
| **debug-with-file** | Hypothesis-driven debugging | `/debug-with-file` |

## Lifecycle Skills

### team-lifecycle

**One-Liner**: Full lifecycle orchestrator — spawn-wait-close pipeline for spec/implementation/test

**Triggers**:
```shell
/team-lifecycle <task-description>
```

**Features**:
- 5-phase pipeline: requirements clarification → session initialization → task chain creation → pipeline coordination → completion report
- **Inline discuss**: Production roles (analyst, writer, reviewer) inline invoke discuss subagents, reducing spec pipeline from 12 beats to 6
- **Shared explore cache**: All agents share centralized `explorations/` directory, eliminating duplicate codebase exploration
- **Fast-advance spawning**: Immediately spawn next linear successor after agent completion
- **Consensus severity routing**: Discussion results routed through HIGH/MEDIUM/LOW severity levels

**Agent Registry**:
| Agent | Role | Mode |
|-------|------|------|
| analyst | Seed analysis, context collection, DISCUSS-001 | 2.8 Inline Subagent |
| writer | Documentation generation, DISCUSS-002 to DISCUSS-005 | 2.8 Inline Subagent |
| planner | Multi-angle exploration, plan generation | 2.9 Cached Exploration |
| executor | Code implementation | 2.1 Standard |
| tester | Test-fix loop | 2.3 Deep Interaction |
| reviewer | Code review + spec quality, DISCUSS-006 | 2.8 Inline Subagent |
| architect | Architecture consultation (on-demand) | 2.1 Standard |
| fe-developer | Frontend implementation | 2.1 Standard |
| fe-qa | Frontend QA, GC loop | 2.3 Deep Interaction |

**Pipeline Definition**:
```plaintext
Spec-only (6 beats):
  RESEARCH-001(+D1) → DRAFT-001(+D2) → DRAFT-002(+D3) → DRAFT-003(+D4) → DRAFT-004(+D5) → QUALITY-001(+D6)

Impl-only (3 beats):
  PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001

Full-lifecycle (9 beats):
  [Spec pipeline] → PLAN-001 → IMPL-001 → TEST-001 || REVIEW-001
```

**Beat Cycle**:
```plaintext
event (phase advance / user resume)
      ↓
  [Orchestrator]
      +-- read state file
      +-- find ready tasks
      +-- spawn agent(s)
      +-- wait(agent_ids, timeout)
      +-- process results
      +-- update state file
      +-- close completed agents
      +-- fast-advance: spawn next
      +-- yield (wait for next event)
```

**Session Directory**:
```plaintext
.workflow/.team/TLS-<slug>-<date>/
├── team-session.json           # Pipeline state
├── spec/                       # Specification artifacts
├── discussions/                # Discussion records
├── explorations/               # Shared exploration cache
├── architecture/               # Architecture assessments
├── analysis/                   # Analyst design intelligence
├── qa/                         # QA audit reports
└── wisdom/                     # Cross-task knowledge accumulation
```

---

### parallel-dev-cycle

**One-Liner**: Multi-agent parallel development cycle — requirements analysis, exploration planning, code development, validation

**Triggers**:
```shell
/parallel-dev-cycle TASK="Implement feature"
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123
/parallel-dev-cycle --auto TASK="Add OAuth"
```

**Features**:
- 4 specialized workers: RA (requirements), EP (exploration), CD (development), VAS (validation)
- Main process inline orchestration (no separate orchestrator agent)
- Each agent maintains one main document (complete rewrite per iteration) + auxiliary log (append)
- Automatically archive old versions to `history/` directory

**Workers**:
| Worker | Main Document | Auxiliary Log |
|--------|---------------|---------------|
| RA | requirements.md | changes.log |
| EP | exploration.md, architecture.md, plan.json | changes.log |
| CD | implementation.md, issues.md | changes.log, debug-log.ndjson |
| VAS | summary.md, test-results.json | changes.log |

**Shared Discovery Board**:
- All agents share real-time discovery board `coordination/discoveries.ndjson`
- Agents read at start, append discoveries during work
- Eliminates redundant codebase exploration

**Session Structure**:
```plaintext
{projectRoot}/.workflow/.cycle/
├── {cycleId}.json                     # Main state file
├── {cycleId}.progress/
│   ├── ra/                         # RA agent artifacts
│   │   ├── requirements.md        # Current version (complete rewrite)
│   │   ├── changes.log           # NDJSON full history (append)
│   │   └── history/              # Archived snapshots
│   ├── ep/                         # EP agent artifacts
│   ├── cd/                         # CD agent artifacts
│   ├── vas/                        # VAS agent artifacts
│   └── coordination/               # Coordination data
│       ├── discoveries.ndjson      # Shared discovery board
│       ├── timeline.md             # Execution timeline
│       └── decisions.log            # Decision log
```

**Execution Flow**:
```plaintext
Phase 1: Session initialization
    ↓ cycleId, state, progressDir

Phase 2: Agent execution (parallel)
    ├─ Spawn RA → EP → CD → VAS
    └─ Wait for all agents to complete

Phase 3: Result aggregation & iteration
    ├─ Parse PHASE_RESULT
    ├─ Detect issues (test failures, blockers)
    ├─ Issues AND iteration < max?
    │   ├─ Yes → Send feedback, loop back to Phase 2
    │   └─ No → Proceed to Phase 4
    └─ Output: parsedResults, iteration status

Phase 4: Completion and summary
    ├─ Generate unified summary report
    ├─ Update final state
    ├─ Close all agents
    └─ Output: Final cycle report
```

**Version Control**:
- 1.0.0: Initial cycle → 1.x.0: Each iteration (minor version increment)
- Each iteration: Archive old version → Complete rewrite → Append changes.log

## Workflow Skills

### analyze-with-file

**One-Liner**: Collaborative analysis — interactive analysis with documented discussions, inline exploration, and evolving understanding

**Triggers**:
```shell
/analyze-with-file TOPIC="<question>"
/analyze-with-file TOPIC="--depth=deep"
```

**Core Workflow**:
```plaintext
Topic → Explore → Discuss → Document → Refine → Conclude → (Optional) Quick Execute
```

**Key Features**:
- **Documented discussion timeline**: Capture understanding evolution across all phases
- **Decision logging at every key point**: Force recording of key findings, direction changes, trade-offs
- **Multi-perspective analysis**: Support up to 4 analysis perspectives (serial, inline)
- **Interactive discussion**: Multi-round Q&A, user feedback and direction adjustment
- **Quick execute**: Direct conversion of conclusions to executable tasks

**Decision Recording Protocol**:
| Trigger | Content to Record | Target Section |
|---------|-------------------|----------------|
| Direction choice | Choice, reason, alternatives | `#### Decision Log` |
| Key findings | Finding, impact scope, confidence | `#### Key Findings` |
| Assumption change | Old assumption → New understanding, reason, impact | `#### Corrected Assumptions` |
| User feedback | User's raw input, adoption/adjustment reason | `#### User Input` |

---

### brainstorm-with-file

**One-Liner**: Multi-perspective brainstorming — 4 perspectives (Product, Technical, Risk, User) parallel analysis

**Triggers**:
```shell
/brainstorm-with-file TOPIC="<idea>"
```

**Features**:
- 4-perspective parallel analysis: Product, Technical, Risk, User
- Consistency scoring and convergence determination
- Feasibility recommendations and action items

**Perspectives**:
| Perspective | Focus Areas |
|-------------|-------------|
| **Product** | Market fit, user value, business viability |
| **Technical** | Feasibility, tech debt, performance, security |
| **Risk** | Risk identification, dependencies, failure modes |
| **User** | Usability, user experience, adoption barriers |

---

### debug-with-file

**One-Liner**: Hypothesis-driven debugging — documented exploration, understanding evolution, analysis-assisted correction

**Triggers**:
```shell
/debug-with-file BUG="<bug description>"
```

**Core Workflow**:
```plaintext
Explore → Document → Log → Analyze → Correct Understanding → Fix → Verify
```

**Key Enhancements**:
- **understanding.md**: Timeline of exploration and learning
- **Analysis-assisted correction**: Verify and correct assumptions
- **Consolidation**: Simplify proven-misunderstood concepts to avoid confusion
- **Learning preservation**: Retain insights from failed attempts

**Session Folder Structure**:
```plaintext
{projectRoot}/.workflow/.debug/DBG-{slug}-{date}/
├── debug.log           # NDJSON log (execution evidence)
├── understanding.md    # Exploration timeline + consolidated understanding
└── hypotheses.json     # Hypothesis history (with determination)
```

**Modes**:
| Mode | Trigger Condition |
|------|-------------------|
| **Explore** | No session or no understanding.md |
| **Continue** | Session exists but no debug.log content |
| **Analyze** | debug.log has content |

---

### collaborative-plan-with-file

**One-Liner**: Collaborative planning — multi-agent collaborative planning (alternative to team-planex)

**Triggers**:
```shell
/collaborative-plan-with-file <task>
```

**Features**:
- Multi-agent collaborative planning
- planner and executor work in parallel
- Intermediate artifact files pass solution

---

### unified-execute-with-file

**One-Liner**: Universal execution engine — alternative to workflow-execute

**Triggers**:
```shell
/unified-execute-with-file <session>
```

**Features**:
- Universal execution engine
- Support multiple task types
- Automatic session recovery

---

### roadmap-with-file

**One-Liner**: Requirement roadmap planning

**Triggers**:
```shell
/roadmap-with-file <requirements>
```

**Features**:
- Requirement to roadmap planning
- Priority sorting
- Milestone definition

---

### review-cycle

**One-Liner**: Review cycle (Codex version)

**Triggers**:
```shell
/review-cycle <target>
```

**Features**:
- Code review
- Fix loop
- Verify fix effectiveness

---

### workflow-test-fix-cycle

**One-Liner**: Test-fix workflow

**Triggers**:
```shell
/workflow-test-fix-cycle <failing-tests>
```

**Features**:
- Diagnose test failure causes
- Fix code or tests
- Verify fixes
- Loop until passing

## Specialized Skills

### clean

**One-Liner**: Intelligent code cleanup

**Triggers**:
```shell
/clean <target>
```

**Features**:
- Automated code cleanup
- Code formatting
- Dead code removal

---

### csv-wave-pipeline

**One-Liner**: CSV wave processing pipeline

**Triggers**:
```shell
/csv-wave-pipeline <csv-file>
```

**Features**:
- CSV data processing
- Wave processing
- Data transformation and export

---

### memory-compact

**One-Liner**: Memory compression (Codex version)

**Triggers**:
```shell
/memory-compact
```

**Features**:
- Memory compression and merging
- Clean redundant data
- Optimize storage

---

### ccw-cli-tools

**One-Liner**: CLI tool execution specification

**Triggers**:
```shell
/ccw-cli-tools <command>
```

**Features**:
- Standardized CLI tool execution
- Parameter specification
- Unified output format

---

### issue-discover

**One-Liner**: Issue discovery

**Triggers**:
```shell
/issue-discover <context>
```

**Features**:
- Discover issues from context
- Issue classification
- Priority assessment

## Related Documentation

- [Claude Skills](./claude-index.md)
- [Feature Documentation](../features/spec)

## Best Practices

1. **Choose the right team type**:
   - Full lifecycle → `team-lifecycle`
   - Parallel development → `parallel-dev-cycle`
   - Collaborative analysis → `analyze-with-file`

2. **Leverage Inline Discuss**: Production roles inline invoke discuss subagents, reducing orchestration overhead

3. **Shared Cache**: Utilize shared exploration cache to avoid duplicate codebase exploration

4. **Fast-Advance**: Linear successor tasks automatically skip orchestrator, improving efficiency

5. **Consensus Routing**: Understand consensus routing behavior for different severity levels

## Usage Examples

```bash
# Full lifecycle development
/team-lifecycle "Build user authentication API"

# Parallel development
/parallel-dev-cycle TASK="Implement notifications"

# Collaborative analysis
/analyze-with-file TOPIC="How to optimize database queries?"

# Brainstorming
/brainstorm-with-file TOPIC="Design payment system"

# Debugging
/debug-with-file BUG="System crashes intermittently"

# Test-fix
/workflow-test-fix-cycle "Unit tests failing"
```

## Statistics

| Category | Count |
|----------|-------|
| Lifecycle | 2 |
| Workflow | 8 |
| Specialized | 6 |
| **Total** | **16+** |
