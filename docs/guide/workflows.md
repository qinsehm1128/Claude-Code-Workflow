# CCW Workflows

Understanding and using CCW's workflow system for efficient development.

## What are Workflows?

CCW workflows are orchestrated sequences of tasks that guide a project from initial concept to completed implementation. They ensure consistency, quality, and proper documentation throughout the development lifecycle.

## Workflow Levels

CCW uses a 4-level workflow system:

```
Level 1: SPECIFICATION
    ↓
Level 2: PLANNING
    ↓
Level 3: IMPLEMENTATION
    ↓
Level 4: VALIDATION
```

## Using Workflows

### Starting a Workflow

Begin a new workflow with the team-lifecycle-v4 skill:

```javascript
Skill(skill="team-lifecycle-v4", args="Build user authentication system")
```

This creates a complete workflow:
1. Specification phase (RESEARCH-001 through QUALITY-001)
2. Planning phase (PLAN-001)
3. Implementation phase (IMPL-001)
4. Validation phase (TEST-001 and REVIEW-001)

### Workflow Execution

The workflow executes automatically:

1. **Specification**: Analyst and writer agents research and document requirements
2. **Checkpoint**: User reviews and approves specification
3. **Planning**: Planner creates implementation plan with task breakdown
4. **Implementation**: Executor writes code
5. **Validation**: Tester and reviewer validate quality

### Resume Workflow

After a checkpoint, resume the workflow:

```javascript
Skill(skill="workflow-execute", args="--resume")
```

## Workflow Tasks

### Specification Tasks

| Task | Agent | Output |
|------|-------|--------|
| RESEARCH-001 | analyst | Discovery context |
| DRAFT-001 | writer | Product brief |
| DRAFT-002 | writer | Requirements (PRD) |
| DRAFT-003 | writer | Architecture design |
| DRAFT-004 | writer | Epics & stories |
| QUALITY-001 | reviewer | Readiness report |

### Implementation Tasks

| Task | Agent | Output |
|------|-------|--------|
| PLAN-001 | planner | Implementation plan |
| IMPL-001 | executor | Source code |
| TEST-001 | tester | Test results |
| REVIEW-001 | reviewer | Code review |

## Custom Workflows

Create custom workflows for your team:

```yaml
# .ccw/workflows/feature-development.yaml
name: Feature Development
description: Standard workflow for new features

levels:
  - name: specification
    tasks:
      - type: research
        agent: analyst
      - type: document
        agent: writer
        documents: [prd, architecture]

  - name: planning
    tasks:
      - type: plan
        agent: planner

  - name: implementation
    tasks:
      - type: implement
        agent: executor
      - type: test
        agent: tester

  - name: validation
    tasks:
      - type: review
        agent: reviewer

checkpoints:
  - after: specification
    action: await_user_approval
  - after: validation
    action: verify_quality_gates
```

## Workflow Configuration

Configure workflow behavior in `~/.claude/workflows/config.json`:

```json
{
  "defaults": {
    "autoAdvance": true,
    "checkpoints": ["specification", "implementation"],
    "parallel": true
  },
  "agents": {
    "analyst": {
      "timeout": 300000,
      "retries": 3
    }
  }
}
```

## Best Practices

### 1. Clear Requirements

Start with clear, specific requirements:

```javascript
// Good: Specific
Skill(skill="team-lifecycle-v4", args="Build JWT authentication with refresh tokens")

// Bad: Vague
Skill(skill="team-lifecycle-v4", args="Add auth")
```

### 2. Checkpoint Reviews

Always review checkpoints:

- Specification checkpoint: Validate requirements
- Implementation checkpoint: Verify progress

### 3. Feedback Loops

Provide feedback during workflow:

```javascript
// Add feedback during review
Skill(skill="workflow-execute", args="--feedback --task REVIEW-001")
```

### 4. Monitor Progress

Track workflow status:

```javascript
// Check workflow status
Skill(skill="workflow-execute", args="--status")

// View task details
Skill(skill="workflow-execute", args="--task IMPL-001")
```

## Troubleshooting

### Stalled Workflow

If a workflow stalls:

```javascript
// Check for blocked tasks
Skill(skill="workflow-execute", args="--status --blocked")

// Reset stuck tasks
Skill(skill="workflow-execute", args="--reset --task IMPL-001")
```

### Failed Tasks

Retry failed tasks:

```javascript
// Retry with new prompt
Skill(skill="workflow-execute", args="--retry --task IMPL-001")
```

::: info See Also
- [4-Level System](../workflows/4-level.md) - Detailed workflow explanation
- [Best Practices](../workflows/best-practices.md) - Workflow optimization
:::
