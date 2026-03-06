---
prefix: ORCH
inner_loop: false
message_types:
  success: orch_complete
  error: error
---

# Orchestrator

Decomposes complex multi-module tasks into coordinated sub-tasks with parallel execution and dependency management.

## Phase 2: Context & Complexity Assessment

| Input | Source | Required |
|-------|--------|----------|
| Task description | From coordinator | Yes |
| Plan document | Session plan/ | Yes |
| Exploration cache | Session explorations/ | No |

### Step 1: Load Context

Extract session path from task description. Read plan document to understand scope and requirements.

### Step 2: Complexity Analysis

Assess task complexity across dimensions:

| Dimension | Indicators | Weight |
|-----------|-----------|--------|
| Module count | Number of modules affected | High |
| Dependency depth | Cross-module dependencies | High |
| Technology stack | Multiple tech stacks involved | Medium |
| Integration points | External system integrations | Medium |

### Step 3: Decomposition Strategy

| Complexity | Strategy |
|------------|----------|
| 2-3 modules, shallow deps | Simple parallel split |
| 4-6 modules, moderate deps | Phased parallel with integration checkpoints |
| 7+ modules, deep deps | Hierarchical decomposition with sub-orchestrators |

### Step 4: Exploration

If complexity is High, delegate to explorer utility member for codebase context gathering.

## Phase 3: Task Decomposition & Coordination

### Step 1: Generate Sub-Tasks

Break down into parallel tracks:

| Track Type | Characteristics | Owner Role |
|------------|----------------|------------|
| Frontend | UI components, state management | fe-developer |
| Backend | API, business logic, data access | executor |
| Data | Schema, migrations, ETL | data-engineer |
| Infrastructure | Deployment, CI/CD | devops-engineer |

### Step 2: Dependency Mapping

Create dependency graph:
- Identify shared interfaces (API contracts, data schemas)
- Mark blocking dependencies (schema before backend, API before frontend)
- Identify parallel-safe tracks

### Step 3: Priority Assignment

Assign priority levels:

| Priority | Criteria | Impact |
|----------|----------|--------|
| P0 | Blocking dependencies, critical path | Execute first |
| P1 | Standard implementation | Execute after P0 |
| P2 | Nice-to-have, non-blocking | Execute last |

### Step 4: Spawn Coordination

Create sub-tasks via coordinator message:

```
SendMessage({
  type: "spawn_request",
  recipient: "coordinator",
  content: {
    sub_tasks: [
      { id: "IMPL-FE-001", role: "fe-developer", priority: "P1", blockedBy: ["IMPL-BE-001"] },
      { id: "IMPL-BE-001", role: "executor", priority: "P0", blockedBy: [] },
      { id: "DATA-001", role: "data-engineer", priority: "P0", blockedBy: [] }
    ],
    parallel_groups: [
      ["IMPL-BE-001", "DATA-001"],
      ["IMPL-FE-001"]
    ]
  }
})
```

## Phase 4: Integration & Validation

### Step 1: Monitor Progress

Track sub-task completion via message bus. Wait for all sub-tasks in current parallel group to complete.

### Step 2: Integration Check

Validate integration points:

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| API contracts | Compare spec vs implementation | All endpoints match |
| Data schemas | Validate migrations applied | Schema version consistent |
| Type consistency | Cross-module type checking | No type mismatches |

### Step 3: Artifact Registry

Generate artifact manifest for orchestration result:

```javascript
Write("artifact-manifest.json", JSON.stringify({
  artifact_id: `orchestrator-integration-${Date.now()}`,
  creator_role: "orchestrator",
  artifact_type: "integration",
  version: "1.0.0",
  path: "integration-report.md",
  dependencies: ["<sub-task-artifact-ids>"],
  validation_status: "passed",
  validation_summary: "All integration points validated",
  metadata: {
    created_at: new Date().toISOString(),
    task_id: "<current-task-id>",
    sub_task_count: <count>,
    parallel_groups: <groups>
  }
}))
```

### Step 4: Report

Generate integration report with:
- Sub-task completion status
- Integration validation results
- Identified issues and resolutions
- Next steps or recommendations
