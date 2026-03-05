---
role: writer
prefix: DRAFT
inner_loop: true
discuss_rounds: [DISCUSS-002]
input_artifact_types: [spec]
message_types:
  success: draft_ready
  revision: draft_revision
  error: error
---

# Writer — Phase 2-4

## Phase 2: Context Loading

**Objective**: Load all required inputs for document generation.

### 2a: Read Upstream Artifacts

Load `context-artifacts.json` to discover upstream artifacts:

```json
{
  "artifacts": [
    {
      "artifact_id": "uuid-...",
      "artifact_type": "spec",
      "path": "./spec/discovery-context.json",
      "creator_role": "analyst"
    }
  ]
}
```

### 2b: Document Type Routing

| Task Subject Contains | Doc Type | Template | Validation |
|----------------------|----------|----------|------------|
| Product Brief | product-brief | templates/product-brief.md | self-validate |
| Requirements / PRD | requirements | templates/requirements-prd.md | DISCUSS-002 |
| Architecture | architecture | templates/architecture-doc.md | self-validate |
| Epics | epics | templates/epics-template.md | self-validate |

### 2c: Progressive Dependency Loading

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

## Phase 4: Validation + Artifact Manifest

### 4a: Self-Validation (all doc types)

| Check | What to Verify |
|-------|---------------|
| has_frontmatter | Starts with YAML frontmatter |
| sections_complete | All template sections present |
| cross_references | session_id included |
| progressive_consistency | References to upstream docs are valid |

### 4b: Generate Artifact Manifest

Create `<session>/artifacts/<task-id>/artifact-manifest.json`:

```json
{
  "artifact_id": "uuid-...",
  "creator_role": "writer",
  "artifact_type": "spec",
  "version": "1.0.0",
  "path": "./spec/<doc-type>/_index.md",
  "dependencies": ["analyst-artifact-id"],
  "validation_status": "passed | failed",
  "validation_summary": "All sections complete, frontmatter valid",
  "metadata": {
    "doc_type": "product-brief | requirements | architecture | epics",
    "sections_count": 8
  }
}
```

### 4c: Validation Routing

| Doc Type | Validation Method |
|----------|------------------|
| product-brief | Self-validation only → report |
| requirements (PRD) | Self-validation + **DISCUSS-002** |
| architecture | Self-validation only → report |
| epics | Self-validation only → report |

**DISCUSS-002** (PRD only):
- Artifact: `<session>/spec/requirements/_index.md`
- Round: DISCUSS-002
- Perspectives: quality, product, coverage

Handle discuss verdict per consensus protocol.

**Report**: doc type, validation status, discuss verdict (PRD only), output path.

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI failure | Retry once with alternative tool. Still fails → log, continue next |
| Discuss subagent fails | Skip discuss, log warning |
| Cumulative 3 task failures | SendMessage to coordinator, STOP |
| Prior doc not found | Notify coordinator, request prerequisite |
| Discussion contradicts prior docs | Note conflict, flag for coordinator |
