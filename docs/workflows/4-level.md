# 4-Level Workflow System

The CCW 4-level workflow system provides a structured approach to software development from specification to deployment.

## Overview

```text
Level 1: SPECIFICATION → Level 2: PLANNING → Level 3: IMPLEMENTATION → Level 4: VALIDATION
```

## Level 1: Specification

**Goal**: Define what to build and why.

### Activities

| Activity | Description | Output |
|----------|-------------|--------|
| Research | Analyze requirements and context | Discovery context |
| Product Brief | Define product vision | Product brief |
| Requirements | Create PRD with acceptance criteria | Requirements document |
| Architecture | Design system architecture | Architecture document |
| Epics & Stories | Break down into trackable items | Epics and stories |

### Agents

- **analyst**: Conducts research and analysis
- **writer**: Creates specification documents
- **discuss-subagent**: Multi-perspective critique

### Quality Gate

**QUALITY-001** validates:
- All requirements documented
- Architecture approved
- Risks assessed
- Acceptance criteria defined

### Example Tasks

```text
RESEARCH-001 → DRAFT-001 → DRAFT-002 → DRAFT-003 → DRAFT-004 → QUALITY-001
```

## Level 2: Planning

**Goal**: Define how to build it.

### Activities

| Activity | Description | Output |
|----------|-------------|--------|
| Exploration | Multi-angle codebase analysis | Exploration cache |
| Task Breakdown | Create implementation tasks | Task definitions |
| Dependency Mapping | Identify task dependencies | Dependency graph |
| Resource Estimation | Estimate effort and complexity | Plan metadata |

### Agents

- **planner**: Creates implementation plan
- **architect**: Provides technical consultation (on-demand)
- **explore-subagent**: Codebase exploration

### Output

```json
{
  "epic_count": 5,
  "total_tasks": 27,
  "execution_order": [...],
  "tech_stack": {...}
}
```

## Level 3: Implementation

**Goal**: Build the solution.

### Activities

| Activity | Description | Output |
|----------|-------------|--------|
| Code Generation | Write source code | Source files |
| Unit Testing | Create unit tests | Test files |
| Documentation | Document code and APIs | Documentation |
| Self-Validation | Verify implementation quality | Validation report |

### Agents

- **executor**: Coordinates implementation
- **code-developer**: Simple, direct edits
- **ccw cli**: Complex, multi-file changes

### Execution Strategy

Tasks executed in topological order based on dependencies:

```text
TASK-001 (no deps) → TASK-002 (depends on 001) → TASK-003 (depends on 002)
```

### Backends

| Backend | Use Case |
|---------|----------|
| agent | Simple, direct edits |
| codex | Complex, architecture |
| gemini | Analysis-heavy |

## Level 4: Validation

**Goal**: Ensure quality.

### Activities

| Activity | Description | Output |
|----------|-------------|--------|
| Integration Testing | Verify component integration | Test results |
| QA Testing | User acceptance testing | QA report |
| Performance Testing | Measure performance | Performance metrics |
| Security Review | Security vulnerability scan | Security findings |
| Code Review | Final quality check | Review feedback |

### Agents

- **tester**: Executes test-fix cycles
- **reviewer**: 4-dimension code review

### Review Dimensions

| Dimension | Focus |
|-----------|-------|
| Product | Requirements alignment |
| Technical | Code quality, patterns |
| Quality | Testing, edge cases |
| Coverage | Completeness |
| Risk | Security, performance |

## Workflow Orchestration

### Beat Model

Event-driven execution with coordinator orchestration:

```text
Event           Coordinator              Workers
────────────────────────────────────────────────
callback/resume → handleCallback ─────────────────┐
                 → mark completed                 │
                 → check pipeline                │
                 → handleSpawnNext ──────────────┼───→ [Worker A]
                 → find ready tasks              │
                 → spawn workers ─────────────────┼───→ [Worker B]
                 → STOP (idle) ──────────────────┘      │
                                                        │
callback <──────────────────────────────────────────────┘
```

### Checkpoints

**Spec Checkpoint** (after QUALITY-001):
- Pauses for user confirmation
- Validates specification completeness
- Requires manual resume to proceed

**Final Gate** (after REVIEW-001):
- Final quality validation
- All tests must pass
- Critical issues resolved

### Fast-Advance

For simple linear successions, workers can spawn successors directly:

```text
[Worker A] complete
    → Check: 1 ready task? simple successor?
    → YES: Spawn Worker B directly
    → NO: SendMessage to coordinator
```

## Parallel Execution

Some epics can execute in parallel:

```text
EPIC-003: Content Modules ──┐
                           ├──→ EPIC-005: Interaction Features
EPIC-004: Search & Nav ────┘
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Syntax errors | Retry with error context (max 3) |
| Missing dependencies | Request from coordinator |
| Backend unavailable | Fallback to alternative |
| Circular dependencies | Abort, report graph |

::: info See Also
- [Best Practices](./best-practices.md) - Workflow optimization
- [Agents](../agents/) - Agent specialization
:::
