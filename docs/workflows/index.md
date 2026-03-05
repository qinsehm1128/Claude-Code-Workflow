# Workflow System

CCW's 4-level workflow system orchestrates the entire development lifecycle from requirements to deployed code.

## Workflow Levels

```text
Level 1: SPECIFICATION
    ↓
Level 2: PLANNING
    ↓
Level 3: IMPLEMENTATION
    ↓
Level 4: VALIDATION
```

## Level 1: Specification

Define what to build and why.

**Activities:**
- Requirements gathering
- User story creation
- Acceptance criteria definition
- Risk assessment

**Output:**
- Product brief
- Requirements document (PRD)
- Architecture design
- Epics and stories

**Agents:** analyst, writer

## Level 2: Planning

Define how to build it.

**Activities:**
- Technical planning
- Task breakdown
- Dependency mapping
- Resource estimation

**Output:**
- Implementation plan
- Task definitions
- Dependency graph
- Risk mitigation

**Agents:** planner, architect

## Level 3: Implementation

Build the solution.

**Activities:**
- Code implementation
- Unit testing
- Documentation
- Code review

**Output:**
- Source code
- Tests
- Documentation
- Build artifacts

**Agents:** executor, code-developer

## Level 4: Validation

Ensure quality.

**Activities:**
- Integration testing
- QA testing
- Performance testing
- Security review

**Output:**
- Test reports
- QA findings
- Review feedback
- Deployment readiness

**Agents:** tester, reviewer

## Complete Workflow Example

```bash
# Level 1: Specification
Skill(skill="team-lifecycle", args="Build user authentication system")
# => Creates RESEARCH-001, DRAFT-001/002/003/004, QUALITY-001
# Note: v5 is the latest version with team-worker architecture

# Level 2: Planning (auto-triggered after QUALITY-001)
# => Creates PLAN-001 with task breakdown

# Level 3: Implementation (auto-triggered after PLAN-001)
# => Executes IMPL-001 with code generation

# Level 4: Validation (auto-triggered after IMPL-001)
# => Runs TEST-001 and REVIEW-001
```

## Workflow Visualization

```text
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW ORCHESTRATION                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [RESEARCH-001]   Product Discovery                          │
│       ↓                                                       │
│  [DRAFT-001]      Product Brief                              │
│       ↓                                                       │
│  [DRAFT-002]      Requirements (PRD)                         │
│       ↓                                                       │
│  [DRAFT-003]      Architecture Design                        │
│       ↓                                                       │
│  [DRAFT-004]      Epics & Stories                            │
│       ↓                                                       │
│  [QUALITY-001]    Spec Quality Check ◄── CHECKPOINT         │
│       ↓                  ↓                                   │
│  [PLAN-001]       Implementation Plan                       │
│       ↓                                                       │
│  [IMPL-001]       Code Implementation                        │
│       ↓                                                       │
│  [TEST-001] ───┐                                            │
│                ├──► [REVIEW-001] ◄── FINAL GATE             │
│  [REVIEW-001] ─┘                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Checkpoints

### Spec Checkpoint (After QUALITY-001)

Pauses for user confirmation before implementation.

**Validation:**
- All requirements documented
- Architecture approved
- Risks assessed
- Acceptance criteria defined

### Final Gate (After REVIEW-001)

Final quality gate before deployment.

**Validation:**
- All tests passing
- Critical issues resolved
- Documentation complete
- Performance acceptable

## Custom Workflows

Define custom workflows for your team:

```yaml
# .ccw/workflows/my-workflow.yaml
name: "Feature Development"
levels:
  - name: "discovery"
    agent: "analyst"
    tasks: ["research", "user-stories"]
  - name: "design"
    agent: "architect"
    tasks: ["api-design", "database-schema"]
  - name: "build"
    agent: "executor"
    tasks: ["implementation", "unit-tests"]
  - name: "verify"
    agent: "tester"
    tasks: ["integration-tests", "e2e-tests"]
```

::: info See Also
- [4-Level System](./4-level.md) - Detailed workflow explanation
- [Best Practices](./best-practices.md) - Workflow optimization tips
:::
