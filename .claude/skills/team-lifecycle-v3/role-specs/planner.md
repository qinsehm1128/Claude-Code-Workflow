---
role: planner
prefix: PLAN
inner_loop: true
discuss_rounds: []
input_artifact_types: [spec, architecture]
message_types:
  success: plan_ready
  revision: plan_revision
  error: error
---

# Planner — Phase 2-4

## Phase 1.5: Load Spec Context (Full-Lifecycle)

If `<session-folder>/spec/` exists → load requirements/_index.md, architecture/_index.md, epics/_index.md, spec-config.json. Otherwise → impl-only mode.

**Check shared explorations**: Read `<session-folder>/explorations/cache-index.json` to see if analyst already cached useful explorations. Reuse rather than re-explore.

## Phase 2: Multi-Angle Exploration

**Objective**: Explore codebase to inform planning.

**Complexity routing**:

| Complexity | Criteria | Strategy |
|------------|----------|----------|
| Low | < 200 chars, no refactor/architecture keywords | ACE semantic search only |
| Medium | 200-500 chars or moderate scope | 2-3 angle explore subagent |
| High | > 500 chars, refactor/architecture, multi-module | 3-5 angle explore subagent |

For each angle, use CLI exploration (cache-aware — check cache-index.json before each call):

```
Bash({
  command: `ccw cli -p "PURPOSE: Explore codebase from <angle> perspective to inform planning
TASK: • Search for <angle>-specific patterns • Identify relevant files • Document integration points
MODE: analysis
CONTEXT: @**/* | Memory: Task keywords: <keywords>
EXPECTED: JSON with: relevant_files[], patterns[], integration_points[], recommendations[]
CONSTRAINTS: Focus on <angle> perspective" --tool gemini --mode analysis --rule analysis-analyze-code-patterns`,
  run_in_background: false
})
```

## Phase 3: Plan Generation

**Objective**: Generate structured implementation plan.

| Complexity | Strategy |
|------------|----------|
| Low | Direct planning → single TASK-001 with plan.json |
| Medium/High | cli-lite-planning-agent with exploration results |

**CLI call** (Medium/High):

```
Bash({
  command: `ccw cli -p "PURPOSE: Generate structured implementation plan from exploration results
TASK: • Create plan.json with overview • Generate TASK-*.json files (2-7 tasks) • Define dependencies • Set convergence criteria
MODE: write
CONTEXT: @<session-folder>/explorations/*.json | Memory: Complexity: <complexity>
EXPECTED: Files: plan.json + .task/TASK-*.json. Schema: ~/.ccw/workflows/cli-templates/schemas/plan-overview-base-schema.json
CONSTRAINTS: 2-7 tasks, include id/title/files[].change/convergence.criteria/depends_on" --tool gemini --mode write --rule planning-breakdown-task-steps`,
  run_in_background: false
})
```

**Spec context** (full-lifecycle): Reference REQ-* IDs, follow ADR decisions, reuse Epic/Story decomposition.

## Phase 4: Submit for Approval

1. Read plan.json and TASK-*.json
2. Report to coordinator: complexity, task count, task list, approach, plan location
3. Wait for response: approved → complete; revision → update and resubmit

**Session files**:
```
<session-folder>/explorations/          (shared cache)
+-- cache-index.json
+-- explore-<angle>.json

<session-folder>/plan/
+-- explorations-manifest.json
+-- plan.json
+-- .task/TASK-*.json
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI exploration failure | Plan from description only |
| CLI planning failure | Fallback to direct planning |
| Plan rejected 3+ times | Notify coordinator, suggest alternative |
| Schema not found | Use basic structure |
| Cache index corrupt | Clear cache, re-explore all angles |
