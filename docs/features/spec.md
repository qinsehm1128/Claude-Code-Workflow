# Spec System

## One-Liner

**The Spec System is an automatic constraint injection mechanism** — Through specification documents defined in YAML frontmatter, relevant constraints are automatically loaded at the start of AI sessions, ensuring AI follows project coding standards and architectural requirements.

---

## Pain Points Solved

| Pain Point | Current State | Spec System Solution |
|------------|---------------|---------------------|
| **AI ignores standards** | CLAUDE.md written but AI ignores it after 5 turns | Hook auto-injection, every session carries specs |
| **Standards scattered** | Coding conventions in different places, hard to maintain | Unified in `.workflow/specs/*.md` |
| **Context loss** | New session requires re-explaining constraints | Spec auto-loads based on task context |
| **Inconsistent code** | Different developers write different styles | Shared Spec ensures consistency |

---

## vs Traditional Methods

| Dimension | CLAUDE.md | `.cursorrules` | **Spec System** |
|-----------|-----------|----------------|-----------------|
| Injection | Auto-load but easily truncated | Manual load | **Hook auto-injection, task-precise loading** |
| Granularity | One large file | One large file | **Per-module files, combined by task** |
| Cross-session memory | None | None | **Workflow journal persistence** |
| Team sharing | Single person | Single person | **Git versioned Spec library** |

---

## Core Concepts

| Concept | Description | Location |
|---------|-------------|----------|
| **Spec File** | Markdown document with YAML frontmatter | `.workflow/specs/*.md` |
| **Hook** | Script that auto-injects specs into AI context | `.claude/hooks/` |
| **Spec Index** | Registry of all available specs | `.workflow/specs/index.yaml` |
| **Spec Selector** | Logic that chooses relevant specs for a task | Built into CCW |

---

## Usage

### Creating a Spec

```markdown
---
name: coding-standards
description: Project coding standards
triggers:
  - pattern: "**/*.ts"
  - command: "/implement"
  - skill: "code-developer"
applyTo:
  - "src/**"
priority: high
---

# Coding Standards

## TypeScript Guidelines
- Use strict mode
- Prefer interfaces over types
- ...
```

### Spec Loading

Specs are automatically loaded based on:
1. File patterns being edited
2. Commands being executed
3. Skills being invoked

---

## Configuration

```yaml
# .workflow/specs/index.yaml
specs:
  - name: coding-standards
    path: ./coding-standards.md
    enabled: true
    
  - name: api-conventions
    path: ./api-conventions.md
    enabled: true
```

---

## Related Links

- [Memory System](/features/memory) - Persistent context
- [CLI Call](/features/cli) - Command line invocation
- [Dashboard](/features/dashboard) - Visual management
