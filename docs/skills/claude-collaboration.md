# Claude Skills - Team Collaboration

## One-Line Positioning

**Team Collaboration Skills is a multi-role collaborative work orchestration system** — Through coordinator, worker roles, and message bus, it enables parallel processing and state synchronization for complex tasks.

## Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|----------------------|
| **Single model limitation** | Can only call one AI model | Multi-role parallel collaboration, leveraging respective strengths |
| **Chaotic task orchestration** | Manual task dependency and state management | Automatic task discovery, dependency resolution, pipeline orchestration |
| **Fragmented collaboration** | Team members work independently | Unified message bus, shared state, progress sync |
| **Resource waste** | Repeated context loading | Wisdom accumulation, exploration cache, artifact reuse |

---

## Skills Overview

| Skill | Function | Use Case |
| --- | --- | --- |
| `team-coordinate` | Universal team coordinator (dynamic role generation) | Any complex task |
| `team-lifecycle` | Full lifecycle team (spec→impl→test) | Complete feature development |
| `team-planex` | Plan-execute pipeline | Issue batch processing |
| `team-review` | Code review team | Code review, vulnerability scanning |
| `team-testing` | Testing team | Test coverage, test case generation |
| `team-arch-opt` | Architecture optimization team | Refactoring, architecture analysis |
| `team-perf-opt` | Performance optimization team | Performance tuning, bottleneck analysis |
| `team-brainstorm` | Brainstorming team | Multi-angle analysis, idea generation |
| `team-frontend` | Frontend development team | UI development, design system |
| `team-uidesign` | UI design team | Design system, component specs |
| `team-issue` | Issue processing team | Issue analysis, implementation |
| `team-iterdev` | Iterative development team | Incremental delivery, agile development |
| `team-quality-assurance` | Quality assurance team | Quality scanning, defect management |
| `team-roadmap-dev` | Roadmap development team | Phased development, milestones |
| `team-tech-debt` | Tech debt team | Debt cleanup, code governance |
| `team-ultra-analyze` | Deep analysis team | Complex problem analysis, collaborative exploration |
| `team-executor` | Lightweight executor | Session resume, pure execution |

---

## Core Architecture

All Team Skills share a unified **team-worker agent architecture**:

```
┌──────────────────────────────────────────────────────────┐
│  Skill(skill="team-xxx", args="task description")         │
└────────────────────────┬─────────────────────────────────┘
                         │ Role Router
              ┌──── --role present? ────┐
              │ NO                      │ YES
              ↓                         ↓
       Orchestration Mode         Role Dispatch
       (auto → coordinator)      (route to role.md)
              │
    ┌─────────┴─────────┬───────────────┬──────────────┐
    ↓                   ↓               ↓              ↓
┌────────┐         ┌────────┐      ┌────────┐     ┌────────┐
│ coord  │         │worker 1│      │worker 2│     │worker N│
│(orchestrate)│    │(execute)│     │(execute)│    │(execute)│
└────────┘         └────────┘      └────────┘     └────────┘
    │                   │               │              │
    └───────────────────┴───────────────┴──────────────┘
                         │
              Message Bus (message bus)
```

**Core Components**:
- **Coordinator**: Built-in orchestrator for task analysis, dispatch, monitoring
- **Team-Worker Agent**: Unified agent, loads role-spec to execute role logic
- **Role Router**: `--role=xxx` parameter routes to role execution
- **Message Bus**: Inter-team member communication protocol
- **Shared Memory**: Cross-task knowledge accumulation (Wisdom)

---

## Skills Details

### team-coordinate

**One-Liner**: Universal team coordinator — Dynamically generates roles and orchestrates execution based on task analysis

**Trigger**:
```bash
team-coordinate <task-description>
team-coordinate --role=coordinator <task>
```

**Features**:
- Only coordinator is built-in, all worker roles are dynamically generated at runtime
- Supports inner-loop roles (handle multiple same-prefix tasks)
- Fast-Advance mechanism skips coordinator to directly spawn successor tasks
- Wisdom accumulates cross-task knowledge

**Session Directory**:
```
.workflow/.team/TC-<slug>-<date>/
├── team-session.json           # Session state + dynamic role registry
├── task-analysis.json          # Phase 1 output
├── roles/                      # Dynamic role definitions
├── artifacts/                  # All MD deliverables
├── wisdom/                     # Cross-task knowledge
└── .msg/                       # Team message bus logs
```

---

### team-lifecycle

**One-Liner**: Full lifecycle team — Complete pipeline from specification to implementation to testing to review

**Trigger**:
```bash
team-lifecycle <task-description>
```

**Features**:
- Based on team-worker agent architecture, all workers share the same agent definition
- Role-specific Phase 2-4 loaded from markdown specs
- Supports specification pipeline, implementation pipeline, frontend pipeline

**Role Registry**:
| Role | Spec | Task Prefix | Inner Loop |
|------|------|-------------|------------|
| coordinator | roles/coordinator/role.md | (none) | - |
| analyst | role-specs/analyst.md | RESEARCH-* | false |
| writer | role-specs/writer.md | DRAFT-* | true |
| planner | role-specs/planner.md | PLAN-* | true |
| executor | role-specs/executor.md | IMPL-* | true |
| tester | role-specs/tester.md | TEST-* | false |
| reviewer | role-specs/reviewer.md | REVIEW-* | false |

**Pipeline Definitions**:
```
Specification Pipeline:  RESEARCH → DRAFT → QUALITY
Implementation Pipeline: PLAN → IMPL → TEST + REVIEW
Full Lifecycle:          [Spec Pipeline] → [Impl Pipeline]
```

---

### team-planex

**One-Liner**: Plan-and-execute team — Per-issue beat pipeline

**Trigger**:
```bash
team-planex <task-description>
team-planex --role=planner <input>
team-planex --role=executor --input <solution-file>
```

**Features**:
- 2-member team (planner + executor), planner serves as lead role
- Per-issue beat: planner creates EXEC-* task immediately after completing each issue
- Solution written to intermediate artifact file, executor loads from file

**Wave Pipeline**:
```
Issue 1:  planner plans → write artifact → create EXEC-* → executor executes
Issue 2:  planner plans → write artifact → create EXEC-* → executor parallel consume
Final:    planner sends all_planned → executor completes remaining → finish
```

---

### team-review

**One-Liner**: Code review team — Unified code scanning, vulnerability review, auto-fix

**Trigger**:
```bash
team-review <target-path>
team-review --full <target-path>      # scan + review + fix
team-review --fix <review-files>      # fix only
team-review -q <target-path>          # quick scan only
```

**Role Registry**:
| Role | Task Prefix | Type |
|------|-------------|------|
| coordinator | RC-* | orchestrator |
| scanner | SCAN-* | read-only analysis |
| reviewer | REV-* | read-only analysis |
| fixer | FIX-* | code generation |

**Pipeline**:
```
SCAN-* (scan) → REV-* (review) → [User confirmation] → FIX-* (fix)
```

**Review Dimensions**: Security, Correctness, Performance, Maintainability

---

### team-testing

**One-Liner**: Testing team — Progressive test coverage through Generator-Critic loop

**Trigger**:
```bash
team-testing <task-description>
```

**Role Registry**:
| Role | Task Prefix | Type |
|------|-------------|------|
| coordinator | (none) | orchestrator |
| strategist | STRATEGY-* | pipeline |
| generator | TESTGEN-* | pipeline |
| executor | TESTRUN-* | pipeline |
| analyst | TESTANA-* | pipeline |

**Three Pipelines**:
```
Targeted:   STRATEGY → TESTGEN(L1) → TESTRUN
Standard:   STRATEGY → TESTGEN(L1) → TESTRUN → TESTGEN(L2) → TESTRUN → TESTANA
Comprehensive: STRATEGY → [TESTGEN(L1+L2) parallel] → [TESTRUN parallel] → TESTGEN(L3) → TESTRUN → TESTANA
```

**Test Layers**: L1: Unit (80%) → L2: Integration (60%) → L3: E2E (40%)

---

### team-arch-opt

**One-Liner**: Architecture optimization team — Analyze architecture issues, design refactoring strategies, implement improvements

**Trigger**:
```bash
team-arch-opt <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| analyzer | ANALYZE-* | architecture analysis |
| designer | DESIGN-* | refactoring design |
| refactorer | REFACT-* | implement refactoring |
| validator | VALID-* | validate improvements |
| reviewer | REVIEW-* | code review |

**Detection Scope**: Dependency cycles, coupling/cohesion, layering violations, God Classes, dead code

---

### team-perf-opt

**One-Liner**: Performance optimization team — Performance profiling, bottleneck identification, optimization implementation

**Trigger**:
```bash
team-perf-opt <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| profiler | PROFILE-* | performance profiling |
| strategist | STRAT-* | optimization strategy |
| optimizer | OPT-* | implement optimization |
| benchmarker | BENCH-* | benchmarking |
| reviewer | REVIEW-* | code review |

---

### team-brainstorm

**One-Liner**: Brainstorming team — Multi-angle creative analysis, Generator-Critic loop

**Trigger**:
```bash
team-brainstorm <topic>
team-brainstorm --role=ideator <topic>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| ideator | IDEA-* | idea generation |
| challenger | CHALLENGE-* | critical questioning |
| synthesizer | SYNTH-* | synthesis integration |
| evaluator | EVAL-* | evaluation scoring |

---

### team-frontend

**One-Liner**: Frontend development team — Built-in ui-ux-pro-max design intelligence

**Trigger**:
```bash
team-frontend <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| analyst | ANALYZE-* | requirement analysis |
| architect | ARCH-* | architecture design |
| developer | DEV-* | frontend implementation |
| qa | QA-* | quality assurance |

---

### team-uidesign

**One-Liner**: UI design team — Design system analysis, token definition, component specs

**Trigger**:
```bash
team-uidesign <task>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| researcher | RESEARCH-* | design research |
| designer | DESIGN-* | design definition |
| reviewer | AUDIT-* | accessibility audit |
| implementer | BUILD-* | code implementation |

---

### team-issue

**One-Liner**: Issue processing team — Issue processing pipeline

**Trigger**:
```bash
team-issue <issue-ids>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| explorer | EXPLORE-* | code exploration |
| planner | PLAN-* | solution planning |
| implementer | IMPL-* | code implementation |
| reviewer | REVIEW-* | code review |
| integrator | INTEG-* | integration validation |

---

### team-iterdev

**One-Liner**: Iterative development team — Generator-Critic loop, incremental delivery

**Trigger**:
```bash
team-iterdev <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| architect | ARCH-* | architecture design |
| developer | DEV-* | feature development |
| tester | TEST-* | test validation |
| reviewer | REVIEW-* | code review |

**Features**: Developer-Reviewer loop (max 3 rounds), Task Ledger real-time progress

---

### team-quality-assurance

**One-Liner**: Quality assurance team — Issue discovery + test validation closed loop

**Trigger**:
```bash
team-quality-assurance <task-description>
team-qa <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| scout | SCOUT-* | issue discovery |
| strategist | QASTRAT-* | strategy formulation |
| generator | QAGEN-* | test generation |
| executor | QARUN-* | test execution |
| analyst | QAANA-* | result analysis |

---

### team-roadmap-dev

**One-Liner**: Roadmap development team — Phased development, milestone management

**Trigger**:
```bash
team-roadmap-dev <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | human interaction |
| planner | PLAN-* | phase planning |
| executor | EXEC-* | phase execution |
| verifier | VERIFY-* | phase validation |

---

### team-tech-debt

**One-Liner**: Tech debt team — Debt scanning, assessment, cleanup, validation

**Trigger**:
```bash
team-tech-debt <task-description>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| scanner | TDSCAN-* | debt scanning |
| assessor | TDEVAL-* | quantitative assessment |
| planner | TDPLAN-* | governance planning |
| executor | TDFIX-* | cleanup execution |
| validator | TDVAL-* | validation regression |

---

### team-ultra-analyze

**One-Liner**: Deep analysis team — Multi-role collaborative exploration, progressive understanding

**Trigger**:
```bash
team-ultra-analyze <topic>
team-analyze <topic>
```

**Role Registry**:
| Role | Task Prefix | Function |
|------|-------------|----------|
| coordinator | (none) | orchestrator |
| explorer | EXPLORE-* | code exploration |
| analyst | ANALYZE-* | deep analysis |
| discussant | DISCUSS-* | discussion interaction |
| synthesizer | SYNTH-* | synthesis output |

**Features**: Supports Quick/Standard/Deep three depth modes

---

### team-executor

**One-Liner**: Lightweight executor — Resume session, pure execution mode

**Trigger**:
```bash
team-executor --session=<path>
```

**Features**:
- No analysis, no role generation — only load and execute existing session
- Used to resume interrupted team-coordinate sessions

---

## User Commands

All Team Skills support unified user commands (wake paused coordinator):

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no progress |
| `resume` / `continue` | Check worker status, advance next step |
| `revise <TASK-ID>` | Create revision task + cascade downstream |
| `feedback <text>` | Analyze feedback impact, create targeted revision chain |

---

## Best Practices

1. **Choose the right team type**:
   - General tasks → `team-coordinate`
   - Complete feature development → `team-lifecycle`
   - Issue batch processing → `team-planex`
   - Code review → `team-review`
   - Test coverage → `team-testing`
   - Architecture optimization → `team-arch-opt`
   - Performance tuning → `team-perf-opt`
   - Brainstorming → `team-brainstorm`
   - Frontend development → `team-frontend`
   - UI design → `team-uidesign`
   - Tech debt → `team-tech-debt`
   - Deep analysis → `team-ultra-analyze`

2. **Leverage inner-loop roles**: Set `inner_loop: true` to let single worker handle multiple same-prefix tasks

3. **Wisdom accumulation**: All roles in team sessions accumulate knowledge to `wisdom/` directory

4. **Fast-Advance**: Simple linear successor tasks automatically skip coordinator to spawn directly

5. **Checkpoint recovery**: All team skills support session recovery via `--resume` or `resume` command

---

## Related Commands

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Claude Commands - Session](../commands/claude/session.md)
