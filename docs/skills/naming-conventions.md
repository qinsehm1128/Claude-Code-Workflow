# Naming Conventions

CCW uses consistent naming conventions across skills, commands, files, and configurations. Following these conventions ensures your custom skills integrate seamlessly with the built-in ecosystem.

## Overview

Consistent naming conventions help with:
- **Discoverability**: Skills and commands are easy to find and understand
- **Integration**: Custom skills work well with built-in ones
- **Maintenance**: Clear naming reduces cognitive load when debugging
- **Documentation**: Self-documenting code and configuration

## Skill Naming

### Built-in Skill Pattern

Built-in CCW skills follow these patterns:

| Pattern | Examples | Usage |
|---------|----------|-------|
| `team-*` | `team-lifecycle-v4`, `team-brainstorm` | Multi-agent team skills |
| `workflow-*` | `workflow-plan`, `workflow-execute` | Planning and execution workflows |
| `*-cycle` | `review-cycle`, `refactor-cycle` | Iterative process skills |
| `memory-*` | `memory-capture`, `memory-manage` | Memory-related operations |

### Custom Skill Naming

When creating custom skills, use these guidelines:

```yaml
# Good: Clear, descriptive, follows convention
name: generate-react-component
name: api-scaffolding
name: test-coverage-analyzer

# Avoid: Too generic or unclear
name: helper
name: stuff
name: my-skill-v2
```

### Naming Principles

1. **Use kebab-case**: All skill names use lowercase with hyphens
   ```yaml
   name: team-lifecycle-v4  # Good
   name: teamLifecycleV4    # Bad
   ```

2. **Start with action or category**: Indicate what the skill does
   ```yaml
   name: generate-component  # Action-based
   name: test-coverage       # Category-based
   ```

3. **Use version suffixes for iterations**: Not "v2" but purpose
   ```yaml
   name: team-lifecycle   # Version iteration
   name: workflow-lite       # Lightweight variant
   ```

## Command Naming

### CLI Command Pattern

Commands follow a `category:action:variant` pattern:

```bash
# Format
ccw <category>:<action>:<variant>

# Examples
ccw workflow:plan:verify
ccw workflow:replan
ccw memory:capture:session
ccw team:lifecycle
```

### Command Aliases

Short aliases for common commands:

| Full Command | Short Alias |
|--------------|-------------|
| `workflow:multi-cli-plan` | `workflow:multi-cli-plan` |
| `team-lifecycle-v4` | (via `/ccw "从零开始: ..."` or `Skill()`) |
| `brainstorm` | (via `/ccw "头脑风暴: ..."` or `Skill()`) |

## File Naming

### Skill Files

```
~/.claude/skills/my-skill/
├── SKILL.md          # Skill definition (required, uppercase)
├── index.ts          # Skill logic (optional)
├── phases/           # Phase files (optional)
│   ├── phase-1.md    # Numbered phases
│   └── phase-2.md
└── examples/         # Usage examples
    └── basic-usage.md
```

### Documentation Files

Documentation follows clear hierarchical patterns:

```
docs/
├── skills/
│   ├── index.md           # Skills overview
│   ├── core-skills.md     # Built-in skills reference
│   ├── naming-conventions.md  # This file
│   └── custom.md          # Custom skill development
├── workflows/
│   ├── index.md
│   ├── teams.md           # Team workflows
│   └── best-practices.md
└── zh/                    # Chinese translations
    └── skills/
        └── index.md
```

### Markdown File Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `index.md` | `skills/index.md` | Section overview |
| `kebab-case.md` | `naming-conventions.md` | Topic pages |
| `UPPERCASE.md` | `SKILL.md`, `README.md` | Special/config files |

## Configuration Keys

### Skill Frontmatter

```yaml
---
name: workflow-plan              # kebab-case
description: 4-phase planning    # Sentence case
version: 1.0.0                   # Semantic versioning
triggers:                        # Array format
  - workflow-plan
  - workflow:replan
category: planning               # Lowercase
tags:                            # Array of keywords
  - planning
  - verification
---
```

### CLI Tool Configuration

```json
{
  "tools": {
    "gemini": {
      "enabled": true,           // camelCase for JSON
      "primaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "Debug"]
    }
  }
}
```

## Variable Naming in Code

### TypeScript/JavaScript

```typescript
// Files and directories
import { SkillContext } from './types'

// Variables and functions
const skillName = "my-skill"
function executeSkill() {}

// Classes and interfaces
class SkillExecutor {}
interface SkillOptions {}

// Constants
const MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 5000
```

### Configuration Keys

```yaml
# Use kebab-case for YAML configuration keys
skill-name: my-skill
max-retries: 3
default-timeout: 5000

# JSON uses camelCase
{
  "skillName": "my-skill",
  "maxRetries": 3,
  "defaultTimeout": 5000
}
```

## Trigger Keywords

### Skill Triggers

Triggers define how skills are invoked:

| Skill | Triggers (English) | Triggers (Chinese) |
|-------|-------------------|-------------------|
| brainstorm | `brainstorm`, `brainstorming` | `头脑风暴` |
| team-planex | `team planex`, `wave pipeline` | `波浪流水线` |
| review-code | `review code`, `code review` | `代码审查` |
| memory-manage | `memory manage`, `update memory` | `更新记忆` |

### Trigger Guidelines

1. **Use natural language**: Triggers should be conversational
2. **Support multiple languages**: English and Chinese for built-in skills
3. **Include variants**: Add common synonyms and abbreviations
4. **Be specific**: Avoid overly generic triggers that conflict

## Session Naming

### Workflow Sessions

Sessions use timestamp-based naming:

```
.workflow/.team/
├── TLS-my-project-2026-03-02/    # Team:Project:Date
├── WS-feature-dev-2026-03-02/    # Workflow:Feature:Date
└── review-session-2026-03-02/    # Descriptor:Date
```

### Session ID Format

```
<TYPE>-<DESCRIPTOR>-<DATE>

Types:
- TLS  = Team Lifecycle Session
- WS   = Workflow Session
- RS   = Review Session
```

## Examples

### Example 1: Good Skill Naming

```yaml
---
name: api-scaffolding
description: Generate REST API boilerplate with routes, controllers, and tests
version: 1.0.0
triggers:
  - generate api
  - api scaffold
  - create api
category: development
tags: [api, rest, scaffolding, generator]
---
```

### Example 2: Good File Organization

```
~/.claude/skills/api-scaffolding/
├── SKILL.md
├── index.ts
├── templates/
│   ├── controller.ts.template
│   ├── route.ts.template
│   └── test.spec.ts.template
└── examples/
    ├── basic-api.md
    └── authenticated-api.md
```

### Example 3: Good Command Naming

```bash
# Clear and hierarchical
ccw api:scaffold:rest
ccw api:scaffold:graphql
ccw api:test:coverage

# Aliases for convenience
ccw api:scaffold    # Defaults to REST
ccw api:test        # Defaults to coverage
```

## Migration Checklist

When renaming skills or commands:

- [ ] Update `SKILL.md` frontmatter
- [ ] Update all trigger references
- [ ] Update documentation links
- [ ] Add migration note in old skill description
- [ ] Update session naming if applicable
- [ ] Test all command invocations

::: info See Also
- [Custom Skill Development](./custom.md) - Creating your own skills
- [Core Skills Reference](./core-skills.md) - All built-in skills
- [Skills Library](./index.md) - Skill overview and categories
:::
