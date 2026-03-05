# Skills Library

Complete reference for all **33 CCW built-in skills** across 3 categories, plus custom skill development.

## What are Skills?

Skills are reusable, domain-specific capabilities that CCW can execute. Each skill is designed for a specific development task or workflow, and can be combined into powerful workflow chains.

## Categories Overview

| Category | Count | Description |
|----------|-------|-------------|
| [Standalone](./core-skills.md#standalone-skills) | 12 | Single-purpose skills for specific tasks |
| [Team](./core-skills.md#team-skills) | 14 | Multi-agent collaborative skills |
| [Workflow](./core-skills.md#workflow-skills) | 7 | Planning and execution pipeline skills |

## Quick Reference

### Standalone Skills

| Skill | Triggers | Description |
|-------|----------|-------------|
| [brainstorm](./core-skills.md#brainstorm) | `brainstorm`, `头脑风暴` | Unified brainstorming with dual-mode operation |
| [ccw-help](./core-skills.md#ccw-help) | `ccw-help`, `ccw-issue` | Command help system |
| [memory-capture](./core-skills.md#memory-capture) | `memory capture`, `compact session` | Session compact or quick tips |
| [memory-manage](./core-skills.md#memory-manage) | `memory manage`, `update claude`, `更新记忆` | CLAUDE.md updates and docs generation |
| [issue-manage](./core-skills.md#issue-manage) | `manage issue`, `list issues` | Interactive issue management |
| [review-code](./core-skills.md#review-code) | `review code`, `code review` | 6-dimensional code review |
| [review-cycle](./core-skills.md#review-cycle) | `workflow:review-cycle` | Review with automated fix |
| [skill-generator](./core-skills.md#skill-generator) | `create skill`, `new skill` | Meta-skill for creating skills |
| [skill-tuning](./core-skills.md#skill-tuning) | `skill tuning`, `tune skill` | Skill diagnosis and optimization |
| [spec-generator](./core-skills.md#spec-generator) | `generate spec`, `create specification`, `spec generator` | 6-phase specification generation |
| [software-manual](./core-skills.md#software-manual) | `software manual`, `user guide` | Interactive HTML documentation |
| [command-generator](./core-skills.md#command-generator) | `generate command` | Command file generation |

### Team Skills

| Skill | Triggers | Roles | Description |
|-------|----------|-------|-------------|
| [team-lifecycle-v4](./core-skills.md#team-lifecycle-v4) | `team lifecycle` | 8 | Full spec/impl/test lifecycle |
| [team-brainstorm](./core-skills.md#team-brainstorm) | `team brainstorm` | 5 | Multi-angle ideation |
| [team-frontend](./core-skills.md#team-frontend) | `team frontend` | 6 | Frontend development with UI/UX |
| [team-issue](./core-skills.md#team-issue) | `team issue` | 6 | Issue resolution pipeline |
| [team-iterdev](./core-skills.md#team-iterdev) | `team iterdev` | 5 | Generator-critic loop |
| [team-planex](./core-skills.md#team-planex) | `team planex` | 3 | Plan-and-execute pipeline |
| [team-quality-assurance](./core-skills.md#team-quality-assurance) | `team qa`, `team quality-assurance` | 6 | QA testing workflow |
| [team-review](./core-skills.md#team-review) | `team-review` | 4 | Code scanning and fix |
| [team-roadmap-dev](./core-skills.md#team-roadmap-dev) | `team roadmap-dev` | 4 | Roadmap-driven development |
| [team-tech-debt](./core-skills.md#team-tech-debt) | `tech debt cleanup`, `技术债务` | 6 | Tech debt identification |
| [team-testing](./core-skills.md#team-testing) | `team testing` | 5 | Progressive test coverage |
| [team-uidesign](./core-skills.md#team-uidesign) | `team uidesign` | 4 | UI design with tokens |
| [team-ultra-analyze](./core-skills.md#team-ultra-analyze) | `team ultra-analyze`, `team analyze` | 5 | Deep collaborative analysis |

### Workflow Skills

| Skill | Triggers | Description |
|-------|----------|-------------|
| [workflow-plan](./core-skills.md#workflow-plan) | `workflow-plan`, `workflow-plan-verify`, `workflow:replan` | 4-phase planning with verification |
| [workflow-lite-planex](./core-skills.md#workflow-lite-planex) | `workflow-lite-planex` | Lightweight planning |
| [workflow-multi-cli-plan](./core-skills.md#workflow-multi-cli-plan) | `workflow-multi-cli-plan`, `workflow:multi-cli-plan` | Multi-CLI collaborative planning |
| [workflow-execute](./core-skills.md#workflow-execute) | `workflow-execute` | Task execution coordination |
| [workflow-tdd-plan](./core-skills.md#workflow-tdd-plan) | `workflow-tdd-plan` | TDD with Red-Green-Refactor |
| [workflow-test-fix](./core-skills.md#workflow-test-fix) | `workflow-test-fix`, `test fix workflow` | Test-fix pipeline |
| [workflow-skill-designer](./core-skills.md#workflow-skill-designer) | `design workflow skill`, `create workflow skill` | Meta-skill for workflow creation |

## Workflow Combinations

Skills can be combined for powerful workflows. See [Workflow Combinations](./core-skills.md#workflow-combinations) for 15 pre-defined combinations.

### Popular Combinations

#### Full Lifecycle Development
```bash
Skill(skill="brainstorm")
Skill(skill="workflow-plan")
Skill(skill="workflow-execute")
Skill(skill="review-cycle")
```

#### Quick Iteration
```bash
Skill(skill="workflow-lite-planex")
Skill(skill="workflow-execute")
```

#### Test-Driven Development
```bash
Skill(skill="workflow-tdd-plan", args="--mode tdd-plan")
Skill(skill="workflow-execute")
Skill(skill="workflow-tdd-plan", args="--mode tdd-verify")
```

## Using Skills

### Recommended: CCW Orchestrator

Use `/ccw` command with natural language - CCW analyzes intent and auto-selects appropriate skill:

```bash
# CCW auto-routes to brainstorm skill
/ccw "头脑风暴: 用户通知系统设计"

# CCW auto-routes to team lifecycle workflow
/ccw "从零开始: 用户认证系统"

# CCW auto-routes to review cycle
/ccw "review: 代码质量检查"
```

### Direct Skill Invocation

Use `Skill()` tool for direct skill calls:

```javascript
// Basic usage
Skill(skill="brainstorm")

// With arguments
Skill(skill="team-lifecycle-v4", args="Build user authentication")

// With mode selection
Skill(skill="workflow-plan", args="--mode verify")
```

### CCW Team CLI (Message Bus Only)

`ccw team` is **only** for team message bus operations, not for invoking team skills:

```bash
# Message bus operations
ccw team log --session-id TLS-xxx --from executor --type state_update
ccw team list --session-id TLS-xxx --last 5
ccw team status --session-id TLS-xxx
```

## Custom Skills

Create your own skills for team-specific workflows:

### Skill Structure

```
~/.claude/skills/my-skill/
├── SKILL.md          # Skill definition
├── phases/           # Phase files (optional)
│   ├── phase-1.md
│   └── phase-2.md
└── templates/        # Output templates (optional)
    └── output.md
```

### Skill Template

```markdown
---
name: my-custom-skill
description: My custom skill for X
version: 1.0.0
triggers: [trigger1, trigger2]
---

# My Custom Skill

## Description
Detailed description of what this skill does.

## Phases
1. Phase 1: Description
2. Phase 2: Description

## Usage

\`\`\`javascript
Skill(skill="my-custom-skill", args="input")
\`\`\`
```

### Best Practices

1. **Single Responsibility**: Each skill should do one thing well
2. **Clear Triggers**: Define recognizable trigger phrases
3. **Progressive Phases**: Break complex skills into phases
4. **Compact Recovery**: Use TodoWrite for progress tracking
5. **Documentation**: Include usage examples and expected outputs

## Practical Examples

### Example 1: Feature Development

**Scenario**: Implement a new user dashboard feature

```bash
# Step 1: Brainstorm the feature (via CCW orchestrator)
/ccw "头脑风暴: 用户仪表板功能设计"
# Or use Skill directly:
# Skill(skill="brainstorm")

# Step 2: Plan implementation (via CCW orchestrator)
/ccw "Plan: Build user dashboard with configurable widgets"
# Or use Skill directly:
# Skill(skill="workflow-plan", args="Build user dashboard")

# Step 3: Execute with team lifecycle
Skill(skill="team-lifecycle-v4", args="Build user dashboard")
# Or use quick iteration:
# Skill(skill="workflow-lite-planex")

# Step 4: Review and refine
Skill(skill="review-code")
# Fix any issues found
```

### Example 2: Bug Investigation

**Scenario**: Debug performance issue in API endpoint

```bash
# Step 1: Quick analysis
ccw cli -p "Analyze /api/users endpoint for N+1 query issues" --tool gemini --mode analysis

# Step 2: Deep dive if needed
ccw workflow:debug-with-file
# Creates hypothesis, instruments code, analyzes logs

# Step 3: Apply fix
ccw workflow-execute --task "Fix N+1 query in user endpoint"
```

### Example 3: Code Migration

**Scenario**: Migrate from JavaScript to TypeScript

```bash
# Step 1: Analyze codebase (via CCW orchestrator)
/ccw "refactor: JavaScript to TypeScript migration"
# Or use Skill directly:
# Skill(skill="workflow:refactor-cycle")

# Step 2: Execute with team roadmap
Skill(skill="team-roadmap-dev", args="--epic ts-migration")
# Progressively migrates modules with tests
```

### Example 4: Documentation Generation

**Scenario**: Generate API documentation

```bash
# Step 1: Capture existing patterns via memory skill
Skill(skill="memory-capture", args="API patterns: REST, versioning, error handling")

# Step 2: Generate docs
ccw software-manual --output ./docs/api/
```

### Example 5: Code Review Pipeline

**Scenario**: Review PR changes

```bash
# Comprehensive review
ccw review-code --focus security,performance

# Or use cycle for auto-fix
ccw review-cycle --max-iterations 3
```

### Tips for Best Results

1. **Start Small**: Begin with `workflow-lite-planex` for simple tasks
2. **Use Memory**: Capture insights with `memory:capture` for future reference
3. **Verify Plans**: Always review generated plans before execution
4. **Iterate**: Use `review-cycle` for continuous improvement
5. **Check Sessions**: Use `workflow:session:list` to track progress

## Design Patterns

Skills use these proven patterns:

| Pattern | Example |
|---------|---------|
| Orchestrator + Workers | team-lifecycle-v4 |
| Generator-Critic Loop | team-iterdev |
| Wave Pipeline | team-planex |
| Red-Green-Refactor | workflow-tdd-plan |

::: info See Also
- [Core Skills Reference](./core-skills.md) - Detailed skill documentation
- [Custom Skills](./custom.md) - Skill development guide
- [CLI Commands](../cli/commands.md) - Command reference
- [Agents](../agents/builtin.md) - Specialized agents
:::
