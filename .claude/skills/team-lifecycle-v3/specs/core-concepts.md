# Core Concepts

## Overview

Team Lifecycle v3 is an enhanced multi-agent orchestration system that manages the complete software development lifecycle from specification to implementation, testing, and review. It uses a **team-worker agent architecture** with **artifact contracts** and **automatic discovery** to coordinate parallel execution across specialized roles.

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

## Foundational Principles

### 1. Team-Worker Agent Architecture

The system uses a **coordinator-worker pattern**:

- **Coordinator**: Orchestrates the workflow, manages task dependencies, injects specialist roles dynamically, and maintains the artifact registry
- **Workers**: Specialized agents (analyst, writer, planner, executor, etc.) that execute specific tasks and produce artifacts
- **Communication**: Workers report completion via `SendMessage` callbacks to the coordinator

**Key Benefits**:
- Clear separation of concerns (orchestration vs execution)
- Parallel execution of independent tasks
- Dynamic scaling with specialist role injection

### 2. Artifact Contracts

All workers generate **artifact manifests** alongside their deliverables for validation gating and automatic discovery.

**Manifest Schema**:
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

**Validation Gating**:
- Coordinator checks `validation_status` before spawning downstream workers
- `passed` → spawn next worker
- `failed` → block spawn, trigger fix loop
- `pending` → wait or prompt manual validation

**Automatic Discovery**:
- Coordinator maintains in-memory artifact registry
- Workers read `context-artifacts.json` in Phase 2 to discover upstream artifacts automatically
- No manual artifact passing required

### 3. Quality Gating

Quality gates ensure artifact quality before proceeding to next phase:

- **Spec Phase Gate** (QUALITY-001): Multi-dimensional quality check
  - Completeness, Consistency, Traceability, Depth, Coverage
  - Checkpoint with user actions: resume, improve, revise, recheck, feedback
- **Implementation Gate**: Test coverage and review approval
- **Per-Artifact Validation**: Manifest-based validation status

### 4. Dynamic Role Injection

Coordinator analyzes task description and plan complexity to inject specialist roles at runtime:

| Trigger | Injected Role | Injection Point |
|---------|---------------|-----------------|
| Keywords: security, vulnerability, OWASP | security-expert | After PLAN-001 |
| Keywords: performance, optimization, bottleneck | performance-optimizer | After IMPL-* |
| Keywords: data, pipeline, ETL, schema | data-engineer | Parallel with IMPL-* |
| Keywords: devops, CI/CD, deployment, docker | devops-engineer | After IMPL-* |
| Keywords: ML, model, training, inference | ml-engineer | Parallel with IMPL-* |
| Complexity: High + multi-module | orchestrator | Replace IMPL-* with ORCH-* |

**Benefits**:
- Automatic expertise injection based on task requirements
- No manual role configuration needed
- Scales from simple to complex tasks

### 5. Priority Scheduling

Tasks are assigned priorities for execution ordering:

- **P0**: Critical path tasks (RESEARCH, DRAFT, PLAN, core IMPL)
- **P1**: Dependent tasks (TEST, REVIEW, QA)
- **P2**: Optional enhancements

**Scheduling Rules**:
- P0 > P1 > P2
- FIFO within same priority
- Parallel execution for independent tasks at same priority

### 6. Conditional Routing

PLAN-001 assesses complexity and routes accordingly:

| Complexity | Route | Roles |
|------------|-------|-------|
| Low (1-2 modules, shallow deps) | Direct IMPL | executor |
| Medium (3-4 modules, moderate deps) | Orchestrated IMPL | orchestrator → executor (parallel) |
| High (5+ modules, deep deps) | Architecture + Orchestrated IMPL | architect → orchestrator → executor (parallel) |

### 7. Beat-Based Cadence

Event-driven execution model where each beat = coordinator wake → process → spawn → STOP:

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
```

**Fast-Advance Optimization**:
- Workers can spawn simple linear successors directly
- Skips coordinator for simple cases
- Logs fast_advance to message bus

## Role Types

### Core Pipeline Roles (Always Present)

| Role | Purpose | Task Prefix |
|------|---------|-------------|
| analyst | Research and discovery | RESEARCH-* |
| writer | Document drafting | DRAFT-* |
| planner | Implementation planning | PLAN-* |
| executor | Code implementation | IMPL-* |
| tester | Test generation and execution | TEST-* |
| reviewer | Quality review and improvement | REVIEW-*, QUALITY-*, IMPROVE-* |

### Consulting Roles (High Complexity)

| Role | Purpose | Task Prefix |
|------|---------|-------------|
| architect | Architecture design | ARCH-* |
| fe-developer | Frontend development | DEV-FE-* |
| fe-qa | Frontend QA | QA-FE-* |

### Specialist Roles (Dynamic Injection)

| Role | Purpose | Task Prefix | Injection Trigger |
|------|---------|-------------|-------------------|
| orchestrator | Multi-module coordination | ORCH-* | Multi-module complexity |
| security-expert | Security analysis | SECURITY-* | Security keywords |
| performance-optimizer | Performance optimization | PERF-* | Performance keywords |
| data-engineer | Data pipeline work | DATA-* | Data keywords |
| devops-engineer | DevOps and deployment | DEVOPS-* | DevOps keywords |
| ml-engineer | ML/AI implementation | ML-* | ML keywords |

### Utility Members (Coordinator-Only)

| Utility | Purpose | Callable By |
|---------|---------|-------------|
| explorer | Parallel multi-angle exploration | Coordinator only |
| discussant | Aggregate multi-CLI critique | Coordinator only |

**Note**: Workers cannot spawn utility members. Workers needing similar capabilities must use CLI tools (`ccw cli --tool gemini --mode analysis`).

## CLI Tool Integration

Workers use CLI tools for complex analysis:

| Capability | CLI Command | Used By |
|------------|-------------|---------|
| Codebase exploration | `ccw cli --tool gemini --mode analysis` | analyst, planner, architect |
| Multi-perspective critique | `ccw cli --tool gemini --mode analysis` (parallel) | analyst, writer, reviewer |
| Document generation | `ccw cli --tool gemini --mode write` | writer |

## Session Management

### Session Directory Structure

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

### Session Resume

1. Scan `.workflow/.team/TLS-*/team-session.json` for active/paused sessions
2. Multiple matches → AskUserQuestion
3. Audit TaskList → reconcile session state
4. Reset in_progress → pending (interrupted tasks)
5. Rebuild team, spawn needed workers only
6. Restore artifact registry from session
7. Kick first executable task

## User Commands

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status, no advancement |
| `resume` / `continue` | Check worker states, advance next step |
| `revise <TASK-ID> [feedback]` | Create revision task + cascade downstream |
| `feedback <text>` | Analyze feedback, create targeted revision |
| `recheck` | Re-run QUALITY-001 quality check |
| `improve [dimension]` | Auto-improve weakest dimension |
