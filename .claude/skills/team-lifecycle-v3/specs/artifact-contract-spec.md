# Artifact Contract Specification

## Overview

Every worker role must generate an artifact manifest in Phase 4 to enable quality gating and automatic artifact discovery.

## Manifest Schema

**Location**: `<session>/artifacts/<task-id>/artifact-manifest.json`

```json
{
  "artifact_id": "uuid-...",
  "creator_role": "role-name",
  "artifact_type": "spec | architecture | plan | code | test | review",
  "version": "1.0.0",
  "path": "./artifacts/output.md",
  "dependencies": ["upstream-artifact-id"],
  "validation_status": "pending | passed | failed",
  "validation_summary": "Details...",
  "metadata": {
    "complexity": "low | medium | high",
    "priority": "P0 | P1 | P2"
  }
}
```

## Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| artifact_id | string | UUID for this artifact |
| creator_role | string | Role that created this artifact |
| artifact_type | enum | Type of artifact (spec/architecture/plan/code/test/review) |
| version | string | Semantic version |
| path | string | Relative path to artifact file |
| dependencies | array | List of upstream artifact IDs this depends on |
| validation_status | enum | pending/passed/failed |
| validation_summary | string | Human-readable validation result |
| metadata | object | Additional context (complexity, priority, etc.) |

## Validation Status

- **pending**: Artifact created, validation not yet run
- **passed**: All quality checks passed, ready for downstream consumption
- **failed**: Quality issues detected, blocks downstream spawn

## Coordinator Integration

The coordinator checks manifests in `handleCallback`:

1. Read `<session>/artifacts/<task-id>/artifact-manifest.json`
2. If `validation_status == "passed"`:
   - Register to artifact_registry
   - Spawn next dependent task
3. If `validation_status == "failed"`:
   - Create fix task
   - Notify user
   - Block downstream tasks

## Context Artifacts Discovery

Workers read `context-artifacts.json` to discover upstream artifacts:

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

## Auto-Discovery (v5)

In v5, workers declare `input_artifact_types: []` in frontmatter. The coordinator automatically discovers and provides matching artifacts without manual path configuration.

## Quality Gates

Validation checks vary by artifact type:

| Artifact Type | Required Checks |
|---------------|----------------|
| spec | Completeness, schema compliance |
| architecture | ADR presence, component diagram |
| plan | Task count (2-7), dependency graph validity |
| code | Syntax check, test coverage |
| test | Test count > 0, all passing |
| review | Issue count, severity distribution |

## Example Workflow

1. **Analyst** creates spec → manifest with `validation_status: "passed"`
2. **Coordinator** reads manifest → registers to artifact_registry
3. **Writer** spawned → reads `context-artifacts.json` → finds analyst's spec
4. **Writer** creates document → manifest with `validation_status: "passed"`
5. **Coordinator** spawns next role based on dependency graph
