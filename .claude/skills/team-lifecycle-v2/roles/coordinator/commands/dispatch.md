# Command: dispatch

Create task chains based on execution mode. v2: 3 discuss points instead of 6.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Mode | Phase 1 requirements | Yes |
| Session folder | Phase 2 session init | Yes |
| Scope | User requirements | Yes |

## Phase 3: Task Chain Creation

### Spec Pipeline (6 tasks, 3 discuss)

| # | Subject | Owner | BlockedBy | Description | Validation |
|---|---------|-------|-----------|-------------|------------|
| 1 | RESEARCH-001 | analyst | (none) | Seed analysis and context gathering | DISCUSS-001 |
| 2 | DRAFT-001 | writer | RESEARCH-001 | Generate Product Brief | self-validate |
| 3 | DRAFT-002 | writer | DRAFT-001 | Generate Requirements/PRD | DISCUSS-002 |
| 4 | DRAFT-003 | writer | DRAFT-002 | Generate Architecture Document | self-validate |
| 5 | DRAFT-004 | writer | DRAFT-003 | Generate Epics & Stories | self-validate |
| 6 | QUALITY-001 | reviewer | DRAFT-004 | 5-dimension spec quality + sign-off | DISCUSS-003 |

### Impl Pipeline (4 tasks)

| # | Subject | Owner | BlockedBy | Description |
|---|---------|-------|-----------|-------------|
| 1 | PLAN-001 | planner | (none) | Multi-angle exploration and planning |
| 2 | IMPL-001 | executor | PLAN-001 | Code implementation |
| 3 | TEST-001 | tester | IMPL-001 | Test-fix cycles |
| 4 | REVIEW-001 | reviewer | IMPL-001 | 4-dimension code review |

### FE Pipeline (3 tasks)

| # | Subject | Owner | BlockedBy | Description |
|---|---------|-------|-----------|-------------|
| 1 | PLAN-001 | planner | (none) | Planning (frontend focus) |
| 2 | DEV-FE-001 | fe-developer | PLAN-001 | Frontend implementation |
| 3 | QA-FE-001 | fe-qa | DEV-FE-001 | 5-dimension frontend QA |

### Fullstack Pipeline (6 tasks)

| # | Subject | Owner | BlockedBy | Description |
|---|---------|-------|-----------|-------------|
| 1 | PLAN-001 | planner | (none) | Fullstack planning |
| 2 | IMPL-001 | executor | PLAN-001 | Backend implementation |
| 3 | DEV-FE-001 | fe-developer | PLAN-001 | Frontend implementation |
| 4 | TEST-001 | tester | IMPL-001 | Backend test-fix |
| 5 | QA-FE-001 | fe-qa | DEV-FE-001 | Frontend QA |
| 6 | REVIEW-001 | reviewer | TEST-001, QA-FE-001 | Full code review |

### Composite Modes

| Mode | Construction | PLAN-001 BlockedBy |
|------|-------------|-------------------|
| full-lifecycle | Spec (6) + Impl (4) | QUALITY-001 |
| full-lifecycle-fe | Spec (6) + Fullstack (6) | QUALITY-001 |

### Task Description Template

```
TaskCreate({
  subject: "<TASK-ID>",
  description: "PURPOSE: <what> | Success: <criteria>
TASK:
  - <step 1>
  - <step 2>
  - <step 3>
CONTEXT:
  - Session: <session-folder>
  - Scope: <scope>
  - Upstream: <artifacts>
EXPECTED: <deliverable> + <quality>
CONSTRAINTS: <scope limits>
---
Validation: <DISCUSS-NNN or self-validate>
InnerLoop: <true|false>",
  addBlockedBy: [<deps>]
})
```

### Revision Task Template

```
TaskCreate({
  subject: "<ORIGINAL-ID>-R1",
  owner: "<same-role>",
  description: "PURPOSE: Revision of <ORIGINAL-ID> | Success: Address feedback
TASK:
  - Review original + feedback
  - Apply fixes
  - Validate
CONTEXT:
  - Session: <session-folder>
  - Original: <artifact-path>
  - Feedback: <text>
EXPECTED: Updated artifact + summary
---
Validation: <same-as-original>
InnerLoop: <true|false>",
  blockedBy: [<predecessor-R1 if cascaded>]
})
```

**Cascade Rules**:

| Revised Task | Downstream |
|-------------|-----------|
| RESEARCH-001 | DRAFT-001~004-R1, QUALITY-001-R1 |
| DRAFT-001 | DRAFT-002~004-R1, QUALITY-001-R1 |
| DRAFT-002 | DRAFT-003~004-R1, QUALITY-001-R1 |
| DRAFT-003 | DRAFT-004-R1, QUALITY-001-R1 |
| DRAFT-004 | QUALITY-001-R1 |

## Phase 4: Validation

| Check | Criteria |
|-------|----------|
| Task count | Matches mode total |
| Dependencies | Every blockedBy references existing task |
| Owner | Each task owner matches Role Registry |
| Session ref | Every task contains `Session:` |
| Validation field | Spec tasks have Validation field |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown mode | Reject with supported modes |
| Missing spec for impl-only | Error, suggest spec-only |
| TaskCreate fails | Log error, report |
| Duplicate task | Skip, log warning |
