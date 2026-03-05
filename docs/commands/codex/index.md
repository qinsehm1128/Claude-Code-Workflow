# Codex Prompts

## One-Liner

**Codex Prompts is the prompt template system used by Codex CLI** — standardized prompt formats ensure consistent code quality and review effectiveness.

## Core Concepts

| Concept | Description | Use Cases |
|----------|-------------|-----------|
| **Prep Prompts** | Project context preparation prompts | Analyze project structure, extract relevant files |
| **Review Prompts** | Code review prompts | Multi-dimensional code quality checks |

## Prompt List

### Prep Series

| Prompt | Function | Use Cases |
|--------|----------|-----------|
| [`memory:prepare`](./prep.md#memory-prepare) | Project context preparation | Prepare structured project context for tasks |

### Review Series

| Prompt | Function | Use Cases |
|--------|----------|-----------|
| [`codex-review`](./review.md#codex-review) | Interactive code review | Code review using Codex CLI |

## Prompt Template Format

All Codex Prompts follow the standard CCW CLI prompt template:

```
PURPOSE: [objective] + [reason] + [success criteria] + [constraints/scope]
TASK: • [step 1] • [step 2] • [step 3]
MODE: review
CONTEXT: [review target description] | Memory: [relevant context]
EXPECTED: [deliverable format] + [quality criteria]
CONSTRAINTS: [focus constraints]
```

## Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| **PURPOSE** | Objective and reason | "Identify security vulnerabilities to ensure code safety" |
| **TASK** | Specific steps | "• Scan for injection vulnerabilities • Check authentication logic" |
| **MODE** | Execution mode | analysis, write, review |
| **CONTEXT** | Context information | "@CLAUDE.md @src/auth/**" |
| **EXPECTED** | Output format | "Structured report with severity levels" |
| **CONSTRAINTS** | Constraint conditions | "Focus on actionable suggestions" |

## Related Documentation

- [Claude Commands](../claude/)
- [CLI Invocation System](../../features/cli.md)
- [Code Review](../../features/spec)
