# Role Library - Team Lifecycle v3

Dynamic role specification library for team-lifecycle-v3. Role definitions are loaded at runtime to extend the built-in role detection table.

## Purpose

- Extend role inference beyond hardcoded defaults
- Support domain-specific specialist roles
- Enable dynamic role injection based on task keywords
- Maintain backward compatibility with v2 core roles

## Role Categories

### Core Pipeline Roles (v2 inherited)
- analyst, writer, planner, executor, tester, reviewer
- architect, fe-developer, fe-qa

### Specialist Roles (v3 new)
- **orchestrator**: Complex task decomposition and parallel coordination
- **security-expert**: Security analysis and vulnerability scanning
- **performance-optimizer**: Performance profiling and optimization
- **data-engineer**: Data pipeline and schema design
- **devops-engineer**: Infrastructure as code and CI/CD
- **ml-engineer**: Machine learning pipeline implementation

## Dynamic Role Injection

Specialist roles are injected at runtime when coordinator detects matching keywords in task descriptions:

| Keywords | Injected Role |
|----------|---------------|
| security, vulnerability, OWASP | security-expert |
| performance, optimization, bottleneck | performance-optimizer |
| data, pipeline, ETL, schema | data-engineer |
| devops, CI/CD, deployment, docker | devops-engineer |
| machine learning, ML, model, training | ml-engineer |
| orchestrate, complex, multi-module | orchestrator |

## Role Definition Format

Each role definition is a `.role.md` file with YAML frontmatter + description.

### Schema

```yaml
---
role: <role-name>
keywords: [<keyword1>, <keyword2>, ...]
responsibility_type: <Orchestration|Code generation|Validation|Read-only analysis>
task_prefix: <PREFIX>
default_inner_loop: <true|false>
category: <domain-category>
capabilities: [<capability1>, <capability2>, ...]
---

<Role description and responsibilities>
```

## Usage

Role library is loaded by coordinator during Phase 1 (Requirements Collection) to extend role detection capabilities. Custom roles override built-in roles with same `role` identifier.

## Extensibility

Users can add custom role definitions by creating new `.role.md` files in this directory following the schema above.
