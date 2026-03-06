# CCW Workflow Guide

## Overview

CCW provides a comprehensive workflow system built on **Team Architecture v2** and **Skill-based Workflows**, designed to cover the complete software development lifecycle.

## What's New in v7.0

**Major New Features**:
- **Team Architecture v2**: `team-coordinate` and `team-executor` with unified team-worker agent
- **team-lifecycle**: Unified team skill for full lifecycle (spec -> impl -> test -> review)
- **Queue Scheduler**: Background task execution with dependency resolution
- **Workflow Session Commands**: `start`, `resume`, `complete`, `sync` for full lifecycle management
- **Beat/Cadence Orchestration**: Event-driven coordination model

---

## Skills vs Commands

CCW uses two types of invocations:

| Type | Format | Examples |
|------|--------|----------|
| **Skills** | Trigger phrase (no slash) | `workflow-lite-plan`, `brainstorm`, `workflow-plan` |
| **Commands** | Slash command | `/ccw`, `/workflow/session:start`, `/issue/new` |

---

## Workflow Skills

### Lightweight Planning

| Skill Trigger | Purpose | Phases |
|---------------|---------|--------|
| `workflow-lite-plan` | Lightweight planning with exploration (Skill handoff to lite-execute) | 5 phases |

**5-Phase Interactive Workflow**:
```
Phase 1: Task Analysis & Exploration (30-90s)
Phase 2: Clarification (user-dependent)
Phase 3: Planning (20-60s)
Phase 4: Three-Dimensional Confirmation
Phase 5: Execution & Tracking
```

### Multi-CLI Planning

| Skill Trigger | Purpose |
|---------------|---------|
| `workflow-multi-cli-plan` | Multi-CLI collaborative analysis |

**5-Phase Workflow**:
```
Phase 1: Context Gathering (ACE semantic search)
Phase 2: Multi-CLI Discussion (iterative)
Phase 3: Present Options
Phase 4: User Decision
Phase 5: Plan Generation
```

### Standard Planning

| Skill Trigger | Purpose | Phases |
|---------------|---------|--------|
| `workflow-plan` | Full planning with session | 5 phases |
| `workflow-plan-verify` | Plan verification | Verification |
| `workflow:replan` | Interactive replanning | Replanning |

### TDD Workflow

| Skill Trigger | Purpose |
|---------------|---------|
| `workflow-tdd-plan` | TDD planning |
| `workflow-tdd-verify` | TDD verification |

**6-Phase TDD Planning + Red-Green-Refactor**:
```
Phase 1: Test Design
Phase 2: Red (write failing test)
Phase 3: Green (minimal implementation)
Phase 4: Refactor
Phase 5: Verify
Phase 6: Next cycle
```

### Test-Fix Workflow

| Skill Trigger | Purpose |
|---------------|---------|
| `workflow-test-fix` | Test generation and fix |
| `workflow-test-fix` | Execute test cycles |

**Progressive Test Layers (L0-L3)**:

| Layer | Name | Focus |
|-------|------|-------|
| **L0** | Static Analysis | Compilation, imports, types, AI code issues |
| **L1** | Unit Tests | Function/class behavior |
| **L2** | Integration Tests | Component interactions, API contracts |
| **L3** | E2E Tests | User journeys, critical paths |

---

## Session Lifecycle

### Session Commands

```bash
/workflow:session:start     # Start new workflow session
/workflow:session:resume    # Resume paused session
/workflow:session:list      # List all sessions
/workflow:session:sync      # Sync session work
/workflow:session:complete  # Complete session
/workflow:session:solidify  # Crystallize learnings into permanent memory
```

### Session Types

| Type | Prefix | Description |
|------|--------|-------------|
| **Workflow** | `WFS-` | General development sessions |
| **Review** | `WFS-review-` | Code review sessions |
| **TDD** | `WFS-tdd-` | TDD workflow sessions |
| **Test** | `WFS-test-` | Test generation sessions |

### Session Directory Structure

```
.workflow/active/{session-id}/
├── workflow-session.json    # Session metadata
├── IMPL_PLAN.md             # Implementation plan
├── TODO_LIST.md             # Task checklist
├── .task/                   # Task JSON files
└── .process/                # Process artifacts
```

---

## Team Architecture v2

### Core Concepts

- **team-worker agent**: Unified worker agent for all roles
- **role-spec files**: Lightweight YAML frontmatter + Phase 2-4 logic
- **Inner loop framework**: Batch processing for same-prefix tasks
- **Beat/Cadence model**: Event-driven coordination

### Available Team Skills

| Skill | Purpose |
|-------|---------|
| `team-coordinate` | Dynamic role generation and coordination |
| `team-executor` | Pure execution of existing sessions |
| `team-lifecycle` | Full lifecycle (spec -> impl -> test) |
| `team-brainstorm` | Brainstorming team |
| `team-frontend` | Frontend development team |
| `team-testing` | Testing team |
| `team-review` | Code review team |

### Available Roles

| Role | Responsibility |
|------|----------------|
| analyst | Code analysis, requirements |
| writer | Documentation, content |
| planner | Planning, architecture |
| executor | Implementation, coding |
| tester | Testing, QA |
| reviewer | Code review, feedback |
| architect | System design, architecture |
| fe-developer | Frontend development |
| fe-qa | Frontend QA |

---

## Command Categories

### Root Commands

| Command | Description |
|---------|-------------|
| `/ccw` | Main workflow orchestrator |
| `/ccw-coordinator` | Smart chain orchestrator |
| `/flow-create` | Flow template generator |

### Issue Commands

| Command | Description |
|---------|-------------|
| `/issue/new` | Create new issue |
| `/issue/plan` | Batch plan issue resolution |
| `/issue/queue` | Form execution queue |
| `/issue/execute` | Execute queue |
| `/issue/discover` | Discover potential issues |
| `/issue/discover-by-prompt` | Discover from prompt |

### Workflow Commands

| Command | Description |
|---------|-------------|
| `/workflow/init` | Initialize project state |
| `/workflow/init-specs` | Create spec files |
| `/workflow/init-guidelines` | Fill spec files |
| `/workflow/clean` | Code cleanup |
| `/workflow/analyze-with-file` | Collaborative analysis |
| `/workflow/brainstorm-with-file` | Brainstorming |
| `/workflow/collaborative-plan-with-file` | Collaborative planning |
| `/workflow/debug-with-file` | Debugging workflow |
| `/workflow/refactor-cycle` | Refactoring workflow |
| `/workflow/integration-test-cycle` | Integration testing |
| `/workflow/roadmap-with-file` | Roadmap planning |
| `/workflow/unified-execute-with-file` | Unified execution |

### UI Design Commands

| Command | Description |
|---------|-------------|
| `/workflow/ui-design/style-extract` | Extract styles |
| `/workflow/ui-design/layout-extract` | Extract layouts |
| `/workflow/ui-design/animation-extract` | Extract animations |
| `/workflow/ui-design/generate` | Generate UI prototypes |
| `/workflow/ui-design/import-from-code` | Import design from code |
| `/workflow/ui-design/codify-style` | Codify styles |
| `/workflow/ui-design/design-sync` | Sync design references |

---

## Skill Categories

### Workflow Skills

| Skill | Trigger |
|-------|---------|
| workflow-lite-plan | `workflow-lite-plan` |
| workflow-multi-cli-plan | `workflow-multi-cli-plan` |
| workflow-plan | `workflow-plan`, `workflow-plan-verify`, `workflow:replan` |
| workflow-execute | `workflow-execute` |
| workflow-tdd-plan | `workflow-tdd-plan`, `workflow-tdd-verify` |
| workflow-test-fix | `workflow-test-fix`, `workflow-test-fix` |

### Specialized Skills

| Skill | Trigger |
|-------|---------|
| brainstorm | `brainstorm` |
| review-code | `review code` |
| review-cycle | `workflow:review-cycle` |
| spec-generator | `workflow:spec`, `generate spec` |
| skill-generator | `create skill` |
| skill-tuning | `skill tuning` |

### Memory Skills

| Skill | Trigger |
|-------|---------|
| memory-capture | `memory capture` |
| memory-manage | `memory manage` |

---

## Workflow Selection Guide

```
                    Task Complexity
                    Low         Medium        High
                    │            │             │
────────────────────┼────────────┼─────────────┼────────────
                    │            │             │
Quick Fix           │            │             │
Config Change    ───┼──>         │             │
Single Module       │            │             │
                    │  lite-plan │             │
                    │            │             │
────────────────────┼────────────┼─────────────┼────────────
                    │            │             │
Multi-Module        │            │             │
Feature Dev        ─┼────────────┼──>          │
                    │            │   plan      │
                    │            │             │
────────────────────┼────────────┼─────────────┼────────────
                    │            │             │
Architecture        │            │             │
New System         ─┼────────────┼─────────────┼──>
                    │            │             │ brainstorm
                    │            │             │ + plan
                    │            │             │ + execute
```

### Decision Flowchart

```
Start
  │
  ├─ Is it a quick fix or config change?
  │    └─> Yes: workflow-lite-plan
  │
  ├─ Is it a single module feature?
  │    └─> Yes: workflow-lite-plan
  │
  ├─ Does it need multi-CLI analysis?
  │    └─> Yes: workflow-multi-cli-plan
  │
  ├─ Is it multi-module with session?
  │    └─> Yes: workflow-plan
  │
  ├─ Is it TDD development?
  │    └─> Yes: workflow-tdd-plan
  │
  ├─ Is it test generation?
  │    └─> Yes: workflow-test-fix
  │
  └─ Is it architecture/new system?
       └─> Yes: brainstorm + workflow-plan
```

---

## Issue Workflow

### Issue Lifecycle

```
/issue/new          Create issue with solution
      ↓
/issue/plan         Batch plan resolution
      ↓
/issue/queue        Form execution queue (DAG)
      ↓
/issue/execute      Execute with parallel orchestration
```

### Issue Commands

| Command | Purpose |
|---------|---------|
| `/issue/new` | Create structured issue from URL or description |
| `/issue/discover` | Discover issues from multiple perspectives |
| `/issue/plan` | Batch plan using issue-plan-agent |
| `/issue/queue` | Form queue using issue-queue-agent |
| `/issue/execute` | DAG-based parallel execution |

---

## Quick Reference

### Most Common Skills

| Skill | When to Use |
|-------|-------------|
| `workflow-lite-plan` | Quick fixes, single features |
| `workflow-plan` | Multi-module development |
| `brainstorm` | Architecture, new features |
| `workflow-execute` | Execute planned work |

### Most Common Commands

| Command | When to Use |
|---------|-------------|
| `/ccw` | Auto workflow selection |
| `/workflow/session:start` | Start new session |
| `/workflow/session:resume` | Continue paused work |
| `/issue/new` | Create new issue |
