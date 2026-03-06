# Templates Directory

This directory contains document templates used by workers during execution.

## Available Templates

| Template | Used By | Task | Purpose |
|----------|---------|------|---------|
| [product-brief.md](product-brief.md) | writer | DRAFT-001 | Product vision and high-level requirements |
| [requirements-prd.md](requirements-prd.md) | writer | DRAFT-002 | Detailed product requirements document |
| [architecture-doc.md](architecture-doc.md) | writer | DRAFT-003 | System architecture and design decisions |
| [epics-template.md](epics-template.md) | writer | DRAFT-004 | Epic breakdown and user stories |

## Template Structure

All templates follow this structure:

```markdown
---
title: <Document Title>
type: <product-brief|requirements|architecture|epics>
version: 1.0
created: <ISO8601 timestamp>
author: <role-name>
---

# <Document Title>

## Section 1
...

## Section 2
...
```

## Usage

### By Workers

Workers load templates during Phase 3 (Domain Work):

1. Read template file
2. Fill in sections based on research/context
3. Generate artifact with proper frontmatter
4. Create artifact manifest

### By Coordinator

Coordinator references templates when creating tasks:

- DRAFT-001 → `product-brief.md`
- DRAFT-002 → `requirements-prd.md`
- DRAFT-003 → `architecture-doc.md`
- DRAFT-004 → `epics-template.md`

## Template Customization

To customize templates:

1. Modify template files in this directory
2. Ensure YAML frontmatter structure is preserved
3. Update section headings as needed
4. Test with a sample task

## Document Standards

All generated documents must follow:

- **Formatting**: See [../specs/document-standards.md](../specs/document-standards.md)
- **Quality criteria**: See [../specs/quality-gates.md](../specs/quality-gates.md)
- **Artifact contract**: See [../specs/artifact-contract-spec.md](../specs/artifact-contract-spec.md)

## Cross-References

- **Specifications**: See [../specs/README.md](../specs/README.md)
- **Role specifications**: See [../roles/README.md](../roles/README.md)
- **Writer role**: See [../roles/pipeline/writer.md](../roles/pipeline/writer.md)
- **Main entry**: See [../SKILL.md](../SKILL.md)
