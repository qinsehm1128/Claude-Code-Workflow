---
role: writer
prefix: DRAFT
inner_loop: true
discuss_rounds: [DISCUSS-002]
message_types:
  success: draft_ready
  revision: draft_revision
  error: error
---

# Writer — Phase 2-4

## Phase 2: Context Loading

**Objective**: Load all required inputs for document generation.

### Document type routing

| Task Subject Contains | Doc Type | Template | Validation |
|----------------------|----------|----------|------------|
| Product Brief | product-brief | templates/product-brief.md | self-validate |
| Requirements / PRD | requirements | templates/requirements-prd.md | DISCUSS-002 |
| Architecture | architecture | templates/architecture-doc.md | self-validate |
| Epics | epics | templates/epics-template.md | self-validate |

### Progressive dependency loading

| Doc Type | Requires |
|----------|----------|
| product-brief | discovery-context.json |
| requirements | + product-brief.md |
| architecture | + requirements/_index.md |
| epics | + architecture/_index.md |

**Prior decisions from accumulator**: Pass context_accumulator summaries as "Prior Decisions" to generation.

| Input | Source | Required |
|-------|--------|----------|
| Document standards | `../../specs/document-standards.md` | Yes |
| Template | From routing table | Yes |
| Spec config | `<session>/spec/spec-config.json` | Yes |
| Discovery context | `<session>/spec/discovery-context.json` | Yes |
| Discussion feedback | `<session>/discussions/<discuss-file>` | If exists |
| Prior decisions | context_accumulator (in-memory) | If prior tasks |

## Phase 3: Document Generation

**Objective**: Generate document using CLI tool.

```
Bash({
  command: `ccw cli -p "PURPOSE: Generate <doc-type> document following template and standards
TASK: • Load template • Apply spec config and discovery context • Integrate prior feedback • Generate all sections
MODE: write
CONTEXT: @<session>/spec/*.json @<template-path> | Memory: Prior decisions: <accumulator summary>
EXPECTED: Document at <output-path> with: YAML frontmatter, all sections, cross-references
CONSTRAINTS: Follow document-standards.md" --tool gemini --mode write --rule development-implement-feature --cd <session>`,
  run_in_background: false
})
```

## Phase 4: Validation

### 4a: Self-Validation (all doc types)

| Check | What to Verify |
|-------|---------------|
| has_frontmatter | Starts with YAML frontmatter |
| sections_complete | All template sections present |
| cross_references | session_id included |
| progressive_consistency | References to upstream docs are valid |

### 4b: Validation Routing

| Doc Type | Validation Method |
|----------|------------------|
| product-brief | Self-validation only → report |
| requirements (PRD) | Self-validation + **DISCUSS-002** |
| architecture | Self-validation only → report |
| epics | Self-validation only → report |

**DISCUSS-002** (PRD only) - Multi-perspective critique via parallel CLI calls:

```bash
# Quality perspective
Bash(`ccw cli -p "PURPOSE: Review requirements document from quality perspective
CONTEXT: @<session>/spec/requirements/_index.md
EXPECTED: Rating (1-5) + quality issues + improvement suggestions
CONSTRAINTS: Focus on completeness, testability, consistency" --tool gemini --mode analysis`, { run_in_background: true })

# Product perspective
Bash(`ccw cli -p "PURPOSE: Review requirements document from product perspective
CONTEXT: @<session>/spec/requirements/_index.md
EXPECTED: Rating (1-5) + product concerns + alignment feedback
CONSTRAINTS: Focus on user value, market fit, scope clarity" --tool codex --mode analysis`, { run_in_background: true })

# Coverage perspective
Bash(`ccw cli -p "PURPOSE: Review requirements document from coverage perspective
CONTEXT: @<session>/spec/requirements/_index.md
EXPECTED: Rating (1-5) + coverage gaps + missing requirements
CONSTRAINTS: Focus on edge cases, non-functional requirements, traceability" --tool claude --mode analysis`, { run_in_background: true })
```

Wait for all results, aggregate ratings and feedback, determine consensus verdict per protocol.

**Report**: doc type, validation status, discuss verdict (PRD only), output path.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI failure | Retry once with alternative tool. Still fails → log, continue next |
| CLI critique fails | Skip critique, log warning |
| Cumulative 3 task failures | SendMessage to coordinator, STOP |
| Prior doc not found | Notify coordinator, request prerequisite |
| Discussion contradicts prior docs | Note conflict, flag for coordinator |
