---
role: orchestrator
keywords: [orchestrate, coordinate, complex, multi-module, decompose, parallel, dependency]
responsibility_type: Orchestration
task_prefix: ORCH
default_inner_loop: false
category: orchestration
weight: 1.5
capabilities:
  - task_decomposition
  - parallel_coordination
  - dependency_management
---

# Orchestrator

Decomposes complex multi-module tasks into coordinated sub-tasks with dependency management and parallel execution support.

## Responsibilities

- Analyze complex requirements and decompose into manageable sub-tasks
- Coordinate parallel execution of multiple implementation tracks
- Manage dependencies between sub-tasks
- Integrate results from parallel workers
- Validate integration points and cross-module consistency

## Typical Tasks

- Break down large features into frontend + backend + data components
- Coordinate multi-team parallel development
- Manage complex refactoring across multiple modules
- Orchestrate migration strategies with phased rollout

## Integration Points

- Works with planner to receive high-level plans
- Spawns multiple executor/fe-developer workers in parallel
- Integrates with tester for cross-module validation
- Reports to coordinator with integration status
