# Execution Flow

This document provides a detailed walkthrough of how tasks flow through the Team Lifecycle v3 system, from initial user request to final completion.

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Definitions](#pipeline-definitions)
3. [Execution Lifecycle](#execution-lifecycle)
4. [Beat-Based Cadence](#beat-based-cadence)
5. [Conditional Routing](#conditional-routing)
6. [Dynamic Role Injection](#dynamic-role-injection)
7. [Quality Checkpoints](#quality-checkpoints)
8. [Task Metadata Registry](#task-metadata-registry)

## Overview

Team Lifecycle v3 uses an **event-driven, beat-based execution model**:

1. User provides task description
2. Coordinator clarifies requirements and creates team
3. Coordinator analyzes complexity and injects specialist roles
4. Coordinator creates task chain based on pipeline selection
5. Coordinator spawns first batch of workers (background execution)
6. Workers execute and report completion via SendMessage callbacks
7. Coordinator advances pipeline, spawning next ready tasks
8. Process repeats until pipeline complete
9. Coordinator generates final report

## Pipeline Definitions

### Spec-only Pipeline (6 tasks, 3 discussions)

For documentation, requirements gathering, and design work.

```
RESEARCH-001(+D1) → DRAFT-001 → DRAFT-002(+D2) → DRAFT-003 → DRAFT-004 → QUALITY-001(+D3)
```

**Tasks**:
- **RESEARCH-001** (analyst): Research and discovery with DISCUSS-001
- **DRAFT-001** (writer): Product brief with self-validation
- **DRAFT-002** (writer): Requirements PRD with DISCUSS-002
- **DRAFT-003** (writer): Architecture document with self-validation
- **DRAFT-004** (writer): Epics breakdown with self-validation
- **QUALITY-001** (reviewer): Multi-dimensional quality check with DISCUSS-003

**Checkpoint**: After QUALITY-001, user can review, improve, or revise before proceeding.

### Impl-only Pipeline (4 tasks)

For quick implementations with clear requirements.

```
PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001
```

**Tasks**:
- **PLAN-001** (planner): Implementation planning and complexity assessment
- **IMPL-001** (executor): Code implementation
- **TEST-001** (tester): Test generation and execution (parallel with REVIEW-001)
- **REVIEW-001** (reviewer): Code quality review (parallel with TEST-001)

### Full-lifecycle Pipeline (10 tasks, v2 compatible)

Complete feature development from requirements to implementation.

```
[Spec pipeline] → PLAN-001(blockedBy: QUALITY-001) → IMPL-001 → TEST-001 + REVIEW-001
```

**Checkpoint**: After QUALITY-001, user reviews spec quality before proceeding to implementation.

### Enhanced Parallel Pipeline (v3 NEW)

Advanced pipeline with conditional routing and parallel execution.

```
RESEARCH-001(+D1) → DRAFT-001 → DRAFT-002(+D2) → DRAFT-003 → DRAFT-004 → QUALITY-001(+D3)
                                                                                    |
                                                                                    v
                                                                              PLAN-001 (complexity assessment)
                                                                                    |
                                                                    +---------------+---------------+
                                                                    |               |               |
                                                              Low: IMPL-001   Med: ORCH-001   High: ARCH-001
                                                                    |          → IMPL-*         → ORCH-001
                                                                    |                                → IMPL-*
                                                                    v
                                                              IMPL-001 || DEV-FE-001 (parallel, P0)
                                                                    |
                                                                    v
                                                              TEST-001 || QA-FE-001 (parallel, P1)
                                                                    |
                                                                    v
                                                              REVIEW-001 (P1)
```

**Key Features**:
- Conditional routing based on complexity assessment
- Parallel execution of independent tasks (IMPL-001 || DEV-FE-001)
- Priority-based scheduling (P0 > P1 > P2)
- Dynamic specialist role injection

## Execution Lifecycle

### Phase 0: User Request

User invokes the skill with a task description:

```
Skill(skill="team-lifecycle-v3", args="Implement user authentication with OAuth2")
```

### Phase 1: Clarification & Team Creation

**Coordinator Actions**:
1. Parse task description
2. Ask clarifying questions if needed (via AskUserQuestion)
3. Determine pipeline type (spec-only, impl-only, full-lifecycle)
4. Create team session folder: `.workflow/.team/TLS-<slug>-<date>/`
5. Initialize team via TeamCreate

**Output**: Team session created, requirements clarified

### Phase 2: Complexity Analysis & Role Injection

**Coordinator Actions**:
1. Analyze task description for keywords
2. Assess complexity indicators (module count, dependencies)
3. Inject specialist roles based on triggers:
   - Security keywords → `security-expert`
   - Performance keywords → `performance-optimizer`
   - Data keywords → `data-engineer`
   - DevOps keywords → `devops-engineer`
   - ML keywords → `ml-engineer`
   - High complexity → `orchestrator`, `architect`

**Output**: Role injection plan, updated task chain

### Phase 3: Task Chain Creation

**Coordinator Actions**:
1. Select pipeline based on requirements
2. Create task metadata for each step
3. Assign priorities (P0/P1/P2)
4. Establish dependencies (blockedBy relationships)
5. Register tasks via TaskCreate

**Output**: Complete task chain with dependencies

### Phase 4: Worker Spawning & Execution

**Coordinator Actions**:
1. Find ready tasks (no unmet dependencies)
2. Sort by priority (P0 > P1 > P2)
3. Spawn workers via Agent tool (background execution)
4. Update task status to `in_progress`
5. Enter idle state (STOP)

**Worker Actions**:
1. Load role specification
2. Execute Phase 1-5 (task discovery, domain work, reporting)
3. Generate artifacts with manifest
4. Send completion callback to coordinator via SendMessage

**Output**: Workers executing in background

### Phase 5: Callback Handling & Advancement

**Coordinator Actions** (on callback):
1. Mark completed task
2. Validate artifact (check manifest validation_status)
3. Update artifact registry
4. Find next ready tasks
5. Check for checkpoints (e.g., QUALITY-001 complete)
6. If checkpoint: display status, wait for user command
7. If no checkpoint: spawn next batch, return to idle

**Output**: Pipeline advances, next workers spawned

### Phase 6: Completion & Reporting

**Coordinator Actions** (when all tasks complete):
1. Generate final report
2. Summarize artifacts produced
3. Display completion status
4. Offer completion actions (archive session, continue work)

**Output**: Final report, session complete

## Beat-Based Cadence

The system uses an **event-driven beat model** where each beat = coordinator wake → process → spawn → STOP.

### Beat Cycle (v3 Enhanced)

```
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
======================================================================
```

### Fast-Advance Optimization

For simple linear successors, workers can spawn the next worker directly:

```
======================================================================
  [Worker A] Phase 5 complete
    +- 1 ready task? simple successor?
    |   --> spawn team-worker B directly
    |   --> log fast_advance to message bus
    +- complex case? --> SendMessage to coordinator
======================================================================
```

**Benefits**:
- Reduces coordinator overhead for simple chains
- Faster execution for linear pipelines
- Coordinator still maintains authority via message bus logs

## Conditional Routing

PLAN-001 assesses complexity and routes to appropriate implementation strategy.

### Complexity Assessment Algorithm

**Module Definition**: A **module** is a cohesive unit of code with clear boundaries and a single primary responsibility. Typically corresponds to:
- A file or class with related functionality
- A directory containing related files (e.g., `auth/`, `payment/`)
- A service or component with well-defined interfaces

**Quantifiable Complexity Criteria**:

| Metric | Low | Medium | High |
|--------|-----|--------|------|
| **Module Count** | 1-2 modules | 3-5 modules | 6+ modules |
| **Lines of Code (LOC)** | <500 LOC | 500-2000 LOC | 2000+ LOC |
| **Dependency Depth** | 1-2 levels | 3-4 levels | 5+ levels |
| **Responsibilities** | Single responsibility | 2-3 responsibilities | 4+ responsibilities |
| **Cross-Cutting Concerns** | None | 1-2 (e.g., logging, validation) | 3+ (e.g., auth, caching, monitoring) |
| **External Integrations** | 0-1 (e.g., database) | 2-3 (e.g., DB, API, cache) | 4+ (e.g., DB, APIs, queues, storage) |

**Complexity Score Calculation** (Pseudocode):

```
function assessComplexity(plan):
  score = 0

  // Module count (weight: 3)
  if plan.module_count >= 6:
    score += 3 * 3
  else if plan.module_count >= 3:
    score += 2 * 3
  else:
    score += 1 * 3

  // Lines of code (weight: 2)
  if plan.estimated_loc >= 2000:
    score += 3 * 2
  else if plan.estimated_loc >= 500:
    score += 2 * 2
  else:
    score += 1 * 2

  // Dependency depth (weight: 2)
  if plan.dependency_depth >= 5:
    score += 3 * 2
  else if plan.dependency_depth >= 3:
    score += 2 * 2
  else:
    score += 1 * 2

  // Responsibilities (weight: 1)
  if plan.responsibilities >= 4:
    score += 3 * 1
  else if plan.responsibilities >= 2:
    score += 2 * 1
  else:
    score += 1 * 1

  // Cross-cutting concerns (weight: 1)
  if plan.cross_cutting_concerns >= 3:
    score += 3 * 1
  else if plan.cross_cutting_concerns >= 1:
    score += 2 * 1
  else:
    score += 1 * 1

  // External integrations (weight: 1)
  if plan.external_integrations >= 4:
    score += 3 * 1
  else if plan.external_integrations >= 2:
    score += 2 * 1
  else:
    score += 1 * 1

  // Total score range: 10-30
  // Low: 10-15, Medium: 16-22, High: 23-30

  if score >= 23:
    return "High"
  else if score >= 16:
    return "Medium"
  else:
    return "Low"
```

**Routing Decision Tree**:

```
                    ┌─────────────────────┐
                    │  PLAN-001 Complete  │
                    │  Assess Complexity  │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
         ┌────────────┐ ┌────────────┐ ┌────────────┐
         │    Low     │ │   Medium   │ │    High    │
         │ Score:10-15│ │ Score:16-22│ │ Score:23-30│
         └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
                │              │              │
                ▼              ▼              ▼
         ┌────────────┐ ┌────────────┐ ┌────────────┐
         │  IMPL-001  │ │  ORCH-001  │ │  ARCH-001  │
         │  (direct)  │ │ (parallel) │ │ (design)   │
         └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
                │              │              │
                │              ▼              ▼
                │       ┌────────────┐ ┌────────────┐
                │       │ IMPL-001   │ │  ORCH-001  │
                │       │ IMPL-002   │ │ (parallel) │
                │       │ IMPL-003   │ └──────┬─────┘
                │       │ (parallel) │        │
                │       └──────┬─────┘        ▼
                │              │       ┌────────────┐
                │              │       │ IMPL-001   │
                │              │       │ IMPL-002   │
                │              │       │ ...        │
                │              │       │ (parallel) │
                │              │       └──────┬─────┘
                │              │              │
                └──────────────┴──────────────┘
                               │
                               ▼
                        ┌────────────┐
                        │  TEST-001  │
                        │ REVIEW-001 │
                        │ (parallel) │
                        └────────────┘
```

### Complexity Assessment Criteria

| Complexity | Module Count | Dependency Depth | Routing Decision |
|------------|--------------|------------------|------------------|
| Low | 1-2 modules | Shallow (1-2 levels) | Direct IMPL |
| Medium | 3-5 modules | Moderate (3-4 levels) | Orchestrated IMPL |
| High | 6+ modules | Deep (5+ levels) | Architecture + Orchestrated IMPL |

### Routing Paths

#### Low Complexity Route

```
PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001
```

**Roles**: planner → executor → tester + reviewer

**Use Case**: Simple feature, single module, clear implementation path

#### Medium Complexity Route

```
PLAN-001 → ORCH-001 → IMPL-001 || IMPL-002 || IMPL-003 → TEST-001 + REVIEW-001
```

**Roles**: planner → orchestrator → executor (parallel) → tester + reviewer

**Use Case**: Multi-module feature, moderate dependencies, parallel implementation possible

#### High Complexity Route

```
PLAN-001 → ARCH-001 → ORCH-001 → IMPL-001 || IMPL-002 || ... → TEST-001 + REVIEW-001
```

**Roles**: planner → architect → orchestrator → executor (parallel) → tester + reviewer

**Use Case**: Complex feature, many modules, deep dependencies, architecture design needed

## Dynamic Role Injection

Specialist roles are automatically injected based on task analysis.

### Injection Triggers

| Trigger | Injected Role | Injection Point | Priority |
|---------|---------------|-----------------|----------|
| Keywords: security, vulnerability, OWASP, auth | security-expert | After PLAN-001 | P0 |
| Keywords: performance, optimization, bottleneck, latency | performance-optimizer | After IMPL-* | P1 |
| Keywords: data, pipeline, ETL, schema, database | data-engineer | Parallel with IMPL-* | P0 |
| Keywords: devops, CI/CD, deployment, docker, kubernetes | devops-engineer | After IMPL-* | P1 |
| Keywords: ML, model, training, inference, AI | ml-engineer | Parallel with IMPL-* | P0 |
| Complexity: High + multi-module | orchestrator | Replace IMPL-* with ORCH-* | P0 |
| Complexity: High + deep dependencies | architect | Before ORCH-* | P0 |

### Injection Example

**Task Description**: "Implement user authentication with OAuth2, add security audit, optimize login performance"

**Analysis**:
- Keywords detected: "authentication", "OAuth2", "security", "audit", "optimize", "performance"
- Complexity: Medium (3-4 modules)

**Injected Roles**:
- `security-expert` (keywords: security, audit, authentication)
- `performance-optimizer` (keywords: optimize, performance)

**Resulting Pipeline**:
```
PLAN-001 → IMPL-001 || SECURITY-001 || PERF-001 → TEST-001 → REVIEW-001
```

## Quality Checkpoints

Checkpoints pause execution for user review and feedback.

### Checkpoint 1: Spec Phase Complete (QUALITY-001)

**Trigger**: QUALITY-001 task completes

**Coordinator Output**:
```
[coordinator] ══════════════════════════════════════════
[coordinator] SPEC PHASE COMPLETE
[coordinator] Quality Gate: <PASS|REVIEW|FAIL> (<score>%)
[coordinator]
[coordinator] Dimension Scores:
[coordinator]   Completeness:  ████████░░ 80%
[coordinator]   Consistency:   █████████░ 90%
[coordinator]   Traceability:  ███████░░░ 70%
[coordinator]   Depth:         ████████░░ 80%
[coordinator]   Coverage:      ██████████ 100%
[coordinator]
[coordinator] Available Actions:
[coordinator]   resume              -> Proceed to implementation
[coordinator]   improve             -> Auto-improve weakest dimension
[coordinator]   revise <TASK-ID>    -> Revise specific document
[coordinator]   recheck             -> Re-run quality check
[coordinator]   feedback <text>     -> Inject feedback
[coordinator] ══════════════════════════════════════════
```

**User Actions**:
- `resume` → Proceed to PLAN-001
- `improve` → Auto-improve weakest dimension (Traceability in example)
- `revise DRAFT-003` → Revise architecture document
- `recheck` → Re-run QUALITY-001
- `feedback "Add more API examples"` → Targeted revision

### Checkpoint 2: Complexity Routing Decision (PLAN-001)

**Trigger**: PLAN-001 completes with complexity assessment

**Coordinator Output**:
```
[coordinator] ══════════════════════════════════════════
[coordinator] COMPLEXITY ASSESSMENT COMPLETE
[coordinator] Complexity: Medium (3 modules, moderate dependencies)
[coordinator] Routing: Orchestrated Implementation
[coordinator]
[coordinator] Next Steps:
[coordinator]   ORCH-001: Coordinate parallel implementation
[coordinator]   IMPL-001: Core authentication module
[coordinator]   IMPL-002: OAuth2 integration
[coordinator]   IMPL-003: Session management
[coordinator]
[coordinator] Continuing automatically...
[coordinator] ══════════════════════════════════════════
```

**Note**: This checkpoint is informational only; execution continues automatically.

### Checkpoint 3: Parallel Merge (All Parallel Tasks Complete)

**Trigger**: All parallel tasks at same level complete

**Coordinator Actions**:
1. Validate integration (check for conflicts)
2. Merge artifacts if needed
3. Continue to next phase

**Note**: If integration issues detected, coordinator may pause for user intervention.

### Checkpoint 4: Pipeline Stall (No Ready + No Running)

**Trigger**: No tasks ready to execute and no tasks currently running

**Coordinator Output**:
```
[coordinator] ══════════════════════════════════════════
[coordinator] PIPELINE STALLED
[coordinator] Reason: Circular dependency or missing task
[coordinator]
[coordinator] Current State:
[coordinator]   Completed: 5 tasks
[coordinator]   Blocked: 2 tasks (waiting on IMPL-001)
[coordinator]   Running: 0 tasks
[coordinator]
[coordinator] Action Required: Check task dependencies
[coordinator] ══════════════════════════════════════════
```

**User Actions**: Investigate and resolve dependency issues

## Task Metadata Registry

Complete task metadata for all pipeline tasks.

| Task ID | Role | Phase | Dependencies | Discuss | Priority | Notes |
|---------|------|-------|-------------|---------|----------|-------|
| RESEARCH-001 | analyst | spec | (none) | DISCUSS-001 | P0 | Initial research |
| DRAFT-001 | writer | spec | RESEARCH-001 | self-validate | P0 | Product brief |
| DRAFT-002 | writer | spec | DRAFT-001 | DISCUSS-002 | P0 | Requirements PRD |
| DRAFT-003 | writer | spec | DRAFT-002 | self-validate | P0 | Architecture doc |
| DRAFT-004 | writer | spec | DRAFT-003 | self-validate | P0 | Epics breakdown |
| QUALITY-001 | reviewer | spec | DRAFT-004 | DISCUSS-003 | P0 | Quality gate |
| PLAN-001 | planner | impl | (none or QUALITY-001) | - | P0 | Implementation plan |
| ARCH-001 | architect | impl | PLAN-001 | - | P0 | Architecture design (if High complexity) |
| ORCH-001 | orchestrator | impl | PLAN-001 or ARCH-001 | - | P0 | Orchestration (if Med/High complexity) |
| IMPL-001 | executor | impl | PLAN-001 or ORCH-001 | - | P0 | Core implementation |
| DEV-FE-001 | fe-developer | impl | PLAN-001 or ORCH-001 | - | P0 | Frontend (parallel with IMPL-001) |
| TEST-001 | tester | impl | IMPL-001 | - | P1 | Test generation |
| QA-FE-001 | fe-qa | impl | DEV-FE-001 | - | P1 | Frontend QA (parallel with TEST-001) |
| REVIEW-001 | reviewer | impl | IMPL-001 | - | P1 | Code review |
| SECURITY-001 | security-expert | impl | IMPL-001 | - | P0 | Security audit (if injected) |
| PERF-001 | performance-optimizer | impl | IMPL-001 | - | P1 | Performance optimization (if injected) |
| DATA-001 | data-engineer | impl | PLAN-001 | - | P0 | Data pipeline (if injected, parallel) |
| DEVOPS-001 | devops-engineer | impl | IMPL-001 | - | P1 | DevOps setup (if injected) |
| ML-001 | ml-engineer | impl | PLAN-001 | - | P0 | ML implementation (if injected, parallel) |

### Task State Transitions

```
pending → ready → in_progress → completed
                              → failed → pending (retry)
```

**States**:
- `pending`: Task created, waiting for dependencies
- `ready`: Dependencies met, ready to execute
- `in_progress`: Worker spawned, executing
- `completed`: Worker finished successfully
- `failed`: Worker encountered error (triggers retry)

### Dependency Resolution

**Rules**:
1. Task becomes `ready` when all `blockedBy` tasks are `completed`
2. Coordinator checks dependencies on each beat
3. Failed tasks block downstream until retry succeeds
4. Parallel tasks (no dependencies) execute simultaneously

## Execution Examples

### Example 1: Simple Implementation (Low Complexity)

**Task**: "Add logging to user service"

**Pipeline**: Impl-only
```
PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001
```

**Execution**:
1. Beat 1: Spawn PLAN-001 (planner)
2. Beat 2: PLAN-001 completes → Spawn IMPL-001 (executor)
3. Beat 3: IMPL-001 completes → Spawn TEST-001 + REVIEW-001 (parallel)
4. Beat 4: Both complete → Generate report

**Duration**: ~4 beats

### Example 2: Full Lifecycle with Specialist Injection (High Complexity)

**Task**: "Implement user authentication with OAuth2, add security audit, optimize login performance"

**Pipeline**: Full-lifecycle with injections
```
RESEARCH-001 → DRAFT-001 → DRAFT-002 → DRAFT-003 → DRAFT-004 → QUALITY-001
  → PLAN-001 → ARCH-001 → ORCH-001 → IMPL-001 || SECURITY-001 || PERF-001
  → TEST-001 → REVIEW-001
```

**Execution**:
1. Beat 1-6: Spec phase (RESEARCH → DRAFT-* → QUALITY)
2. Checkpoint: User reviews spec quality, chooses `resume`
3. Beat 7: Spawn PLAN-001 (planner)
4. Beat 8: PLAN-001 completes (High complexity) → Spawn ARCH-001 (architect)
5. Beat 9: ARCH-001 completes → Spawn ORCH-001 (orchestrator)
6. Beat 10: ORCH-001 completes → Spawn IMPL-001 || SECURITY-001 || PERF-001 (parallel, P0)
7. Beat 11: All parallel tasks complete → Spawn TEST-001 (P1)
8. Beat 12: TEST-001 completes → Spawn REVIEW-001 (P1)
9. Beat 13: REVIEW-001 completes → Generate report

**Duration**: ~13 beats + 1 checkpoint

### Example 3: Spec-only with Revision Loop

**Task**: "Design API for payment processing"

**Pipeline**: Spec-only
```
RESEARCH-001 → DRAFT-001 → DRAFT-002 → DRAFT-003 → DRAFT-004 → QUALITY-001
```

**Execution**:
1. Beat 1-6: Spec phase completes
2. Checkpoint: User reviews, quality score 65% (FAIL)
3. User: `improve` → Auto-improve weakest dimension (Traceability)
4. Beat 7: Spawn IMPROVE-001 (reviewer)
5. Beat 8: IMPROVE-001 completes → Spawn QUALITY-001 (recheck)
6. Beat 9: QUALITY-001 completes, quality score 85% (PASS)
7. Checkpoint: User reviews, chooses `resume` → Generate report

**Duration**: ~9 beats + 2 checkpoints
