# CLAUDE.md Guide

Configure project-specific instructions for CCW using CLAUDE.md.

## What is CLAUDE.md?

`CLAUDE.md` is a special file that contains project-specific instructions, conventions, and preferences for CCW. It's automatically loaded when CCW operates on your project.

## File Location

Place `CLAUDE.md` in your project root:

```
my-project/
├── CLAUDE.md          # Project instructions
├── package.json
└── src/
```

## File Structure

```markdown
# Project Name

## Overview
Brief description of the project.

## Tech Stack
- Frontend: Framework + libraries
- Backend: Runtime + framework
- Database: Storage solution

## Coding Standards
- Style guide
- Linting rules
- Formatting preferences

## Architecture
- Project structure
- Key patterns
- Important conventions

## Development Guidelines
- How to add features
- Testing requirements
- Documentation standards
```

## Example CLAUDE.md

```markdown
# E-Commerce Platform

## Overview
Multi-tenant e-commerce platform with headless architecture.

## Tech Stack
- Frontend: Vue 3 + TypeScript + Vite
- Backend: Node.js + NestJS
- Database: PostgreSQL + Redis
- Queue: BullMQ

## Coding Standards

### TypeScript
- Use strict mode
- No implicit any
- Explicit return types

### Naming Conventions
- Components: PascalCase (UserProfile.ts)
- Utilities: camelCase (formatDate.ts)
- Constants: UPPER_SNAKE_CASE (API_URL)

### File Structure
```
src/
├── components/     # Vue components
├── composables/    # Vue composables
├── services/       # Business logic
├── types/          # TypeScript types
└── utils/          # Utilities
```

## Architecture

### Layered Architecture
1. **Presentation Layer**: Vue components
2. **Application Layer**: Composables and services
3. **Domain Layer**: Business logic
4. **Infrastructure Layer**: External services

### Key Patterns
- Repository pattern for data access
- Factory pattern for complex objects
- Strategy pattern for payments

## Development Guidelines

### Adding Features
1. Create feature branch from develop
2. Implement feature with tests
3. Update documentation
4. Create PR with template

### Testing
- Unit tests: Vitest
- E2E tests: Playwright
- Coverage: >80%

### Commits
Follow conventional commits:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Refactoring
- test: Tests

## Important Notes
- Always use TypeScript strict mode
- Never commit .env files
- Run linter before commit
- Update API docs for backend changes
```

## Sections

### Required Sections

| Section | Purpose |
|---------|---------|
| Overview | Project description |
| Tech Stack | Technologies used |
| Coding Standards | Style conventions |
| Architecture | System design |

### Optional Sections

| Section | Purpose |
|---------|---------|
| Testing | Test requirements |
| Deployment | Deploy process |
| Troubleshooting | Common issues |
| References | External docs |

## Best Practices

### 1. Keep It Current

Update CLAUDE.md when:
- Tech stack changes
- New patterns adopted
- Standards updated

### 2. Be Specific

Instead of:
```markdown
## Style
Follow good practices
```

Use:
```markdown
## Style
- Use ESLint with project config
- Max line length: 100
- Use single quotes for strings
```

### 3. Provide Examples

```markdown
## Naming
Components use PascalCase:
- UserProfile.vue ✓
- userProfile.vue ✗
```

## Multiple Projects

For monorepos, use multiple CLAUDE.md files:

```
monorepo/
├── CLAUDE.md           # Root instructions
├── packages/
│   ├── frontend/
│   │   └── CLAUDE.md   # Frontend specific
│   └── backend/
│       └── CLAUDE.md   # Backend specific
```

## Template

```markdown
# [Project Name]

## Overview
[1-2 sentence description]

## Tech Stack
- [Framework/Language]
- [Key libraries]

## Coding Standards
- [Style guide]
- [Linting]

## Architecture
- [Structure]
- [Patterns]

## Development
- [How to add features]
- [Testing approach]

## Notes
- [Important conventions]
```

::: info See Also
- [Configuration](./cli-tools.md) - CLI tools config
- [Workflows](../workflows/) - Development workflows
:::
