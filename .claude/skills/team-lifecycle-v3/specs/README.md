# Specifications Directory

This directory contains all specification documents for Team Lifecycle v3.

## Core Specifications (Mandatory Reading)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [core-concepts.md](core-concepts.md) | Foundational principles: team-worker architecture, artifact contracts, quality gating, dynamic role injection, priority scheduling | **Before using the skill** - P0 Critical |
| [domain-model.md](domain-model.md) | Core entity definitions (Task, Artifact, Role, Session) with JSON schemas, relationships, and state machines | **Before using the skill** - P0 Critical |
| [artifact-contract-spec.md](artifact-contract-spec.md) | Artifact manifest schema and validation rules | **Before using the skill** - P0 Critical |
| [execution-flow.md](execution-flow.md) | End-to-end execution walkthrough with pipeline definitions, beat cycle, conditional routing, and examples | **When understanding workflow** - P1 High |

## Supporting Specifications

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [quality-gates.md](quality-gates.md) | Quality validation criteria for each phase | When reviewing quality checkpoints |
| [document-standards.md](document-standards.md) | Document formatting standards (YAML frontmatter, naming conventions) | When creating new documents |
| [team-config.json](team-config.json) | Role registry and pipeline definitions (machine-readable) | When modifying role configuration |

## Document Hierarchy

```
specs/
├── README.md                       # This file
├── core-concepts.md                # P0 - Foundational principles
├── artifact-contract-spec.md       # P0 - Artifact manifest schema
├── execution-flow.md               # P1 - Execution walkthrough
├── quality-gates.md                # Supporting - Quality criteria
├── document-standards.md           # Supporting - Formatting standards
└── team-config.json                # Supporting - Role registry
```

## Reading Path

### For New Users

1. **Start here**: [core-concepts.md](core-concepts.md) - Understand the system architecture and principles
2. **Then read**: [artifact-contract-spec.md](artifact-contract-spec.md) - Learn how artifacts flow between agents
3. **Finally read**: [execution-flow.md](execution-flow.md) - See how tasks execute end-to-end

### For Developers Extending the Skill

1. Read all core specifications above
2. Review [quality-gates.md](quality-gates.md) for validation logic
3. Review [document-standards.md](document-standards.md) for formatting rules
4. Modify [team-config.json](team-config.json) for role changes

### For Troubleshooting

1. Check [execution-flow.md](execution-flow.md) for pipeline definitions
2. Check [artifact-contract-spec.md](artifact-contract-spec.md) for validation rules
3. Check [quality-gates.md](quality-gates.md) for quality criteria

## Cross-References

- **Role specifications**: See [../roles/README.md](../roles/README.md)
- **Templates**: See [../templates/README.md](../templates/README.md)
- **Subagents**: See [../subagents/](../subagents/)
- **Main entry**: See [../SKILL.md](../SKILL.md)
