---
适用CLI: claude
分类: specialized
---

# Skills Reference

Quick reference guide for all **33 CCW built-in skills**.

## Core Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| **brainstorm** | `brainstorm`, `头脑风暴` | Unified brainstorming with dual-mode operation (auto pipeline / single role) |
| **review-code** | `review code`, `code review`, `审查代码` | Multi-dimensional code review (6 dimensions) |
| **review-cycle** | `workflow:review-cycle` | Code review + automated fix orchestration |
| **memory-capture** | `memory capture`, `compact session` | Session compact or quick tips capture |
| **memory-manage** | `memory manage`, `update claude`, `update memory`, `generate docs`, `更新记忆`, `生成文档` | CLAUDE.md updates and documentation generation |
| **spec-generator** | `generate spec`, `create specification`, `spec generator`, `workflow:spec` | 6-phase specification generator (brief → PRD → architecture → epics) |
| **skill-generator** | `create skill`, `new skill` | Meta-skill for creating new Claude Code skills |
| **skill-tuning** | `skill tuning`, `tune skill` | Universal skill diagnosis and optimization tool |
| **issue-manage** | `manage issue`, `list issues` | Interactive issue management (CRUD operations) |
| **ccw-help** | `ccw-help`, `ccw-issue` | CCW command help system |
| **software-manual** | `software manual`, `user guide` | Generate interactive TiddlyWiki-style HTML manuals |

## Workflow Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| **workflow-plan** | `workflow-plan`, `workflow-plan-verify`, `workflow:replan` | 4-phase planning workflow with verification and interactive replanning |
| **workflow-lite-planex** | `workflow-lite-planex` | Lightweight planning and execution skill |
| **workflow-multi-cli-plan** | `workflow-multi-cli-plan`, `workflow:multi-cli-plan` | Multi-CLI collaborative planning with ACE context engine |
| **workflow-execute** | `workflow-execute` | Coordinate agent execution for workflow tasks |
| **workflow-tdd-plan** | `workflow-tdd-plan`, `workflow-tdd-verify` | TDD workflow with Red-Green-Refactor task chain |
| **workflow-test-fix** | `workflow-test-fix`, `test fix workflow` | Unified test-fix pipeline with adaptive strategy |
| **workflow-skill-designer** | `design workflow skill`, `create workflow skill`, `workflow skill designer` | Meta-skill for designing orchestrator+phases structured workflow skills |

## Team Skills

| Skill | Trigger | Roles | Purpose |
|-------|---------|-------|---------|
| **team-lifecycle** | `team lifecycle` | variable | Full spec/impl/test lifecycle team (v5, team-worker architecture) |
| **team-coordinate** | `team coordinate` | variable | Generic team coordination (legacy) |
| **team-coordinate** | - | variable | team-worker architecture coordination |
| **team-executor** | `team executor` | variable | Lightweight session execution |
| **team-executor** | - | variable | team-worker architecture execution |
| **team-planex** | `team planex` | 3 | Plan-and-execute wave pipeline |
| **team-iterdev** | `team iterdev` | 5 | Generator-critic loop iterative development |
| **team-issue** | `team issue` | 6 | Issue resolution pipeline |
| **team-testing** | `team testing` | 5 | Progressive test coverage team |
| **team-quality-assurance** | `team qa`, `team quality-assurance` | 6 | QA closed-loop workflow |
| **team-brainstorm** | `team brainstorm` | 5 | Multi-role collaborative brainstorming |
| **team-uidesign** | `team ui design` | 4 | UI design team with design token system |
| **team-frontend** | `team frontend` | 6 | Frontend development with UI/UX integration |
| **team-review** | `team-review` | 4 | Code scanning and automated fix |
| **team-roadmap-dev** | `team roadmap-dev` | 4 | Roadmap-driven development |
| **team-tech-debt** | `tech debt cleanup`, `team tech-debt`, `技术债务` | 6 | Tech debt identification and cleanup |
| **team-ultra-analyze** | `team ultra-analyze`, `team analyze` | 5 | Deep collaborative analysis |

## Command Generation Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| **command-generator** | `generate command` | Command file generation meta-skill |

## Skill Categories Summary

| Category | Count | Description |
|----------|-------|-------------|
| Core Skills | 12 | Single-purpose skills for specific tasks |
| Workflow Skills | 7 | Planning and execution pipeline skills |
| Team Skills | 17+ | Multi-agent collaborative skills |
| Command Gen Skills | 1 | Command file generation |
| **Total** | **37+** | |

## Usage

### Basic Invocation

```javascript
Skill(skill="brainstorm")
Skill(skill="team-lifecycle", args="Build user authentication system")
Skill(skill="workflow-plan", args="--mode verify")
```

### CLI Invocation

```bash
# Via /ccw orchestrator
/ccw "brainstorm: user authentication flow"
/ccw "team planex: OAuth2 implementation"

# Direct skill triggers (in some contexts)
workflow-plan
team lifecycle
```

## Trigger Keywords

| Keyword | Skill |
|---------|-------|
| `brainstorm`, `头脑风暴` | brainstorm |
| `review code`, `code review`, `审查代码` | review-code |
| `workflow:review-cycle` | review-cycle |
| `workflow-plan` | workflow-plan |
| `workflow-lite-planex` | workflow-lite-planex |
| `workflow-multi-cli-plan`, `workflow:multi-cli-plan` | workflow-multi-cli-plan |
| `workflow-execute` | workflow-execute |
| `workflow-tdd-plan` | workflow-tdd-plan |
| `workflow-test-fix`, `test fix workflow` | workflow-test-fix |
| `design workflow skill`, `create workflow skill`, `workflow skill designer` | workflow-skill-designer |
| `team lifecycle` | team-lifecycle (v5) |
| `team planex` | team-planex |
| `team iterdev` | team-iterdev |
| `team issue` | team-issue |
| `team testing` | team-testing |
| `team qa`, `team quality-assurance` | team-quality-assurance |
| `team brainstorm` | team-brainstorm |
| `team ui design`, `team uidesign` | team-uidesign |
| `team frontend` | team-frontend |
| `team-review` | team-review |
| `team roadmap-dev` | team-roadmap-dev |
| `tech debt cleanup`, `team tech-debt`, `技术债务` | team-tech-debt |
| `team ultra-analyze`, `team analyze` | team-ultra-analyze |
| `memory capture`, `compact session`, `记录`, `压缩会话` | memory-capture |
| `memory manage`, `update claude`, `update memory`, `generate docs`, `更新记忆`, `生成文档` | memory-manage |
| `generate spec`, `create specification`, `spec generator`, `workflow:spec` | spec-generator |
| `create skill`, `new skill` | skill-generator |
| `skill tuning`, `tune skill`, `skill diagnosis` | skill-tuning |
| `manage issue`, `list issues`, `edit issue` | issue-manage |
| `software manual`, `user guide`, `generate manual`, `create docs` | software-manual |
| `generate command` | command-generator |

## Team Skill Architecture

### Version History

| Version | Architecture | Status |
|---------|-------------|--------|
| v2 | Legacy | Obsolete |
| v3 | 3-phase lifecycle | Legacy |
| v4 | 5-phase lifecycle with inline discuss | Stable |
| **v5** | **team-worker architecture** | **Latest** |

### v5 Team Worker Roles

The latest team-lifecycle (v5) uses the team-worker agent with dynamic role assignment:

| Role | Prefix | Phase |
|------|--------|-------|
| doc-analyst | ANALYSIS | Requirements analysis |
| doc-writer | DRAFT | Document creation |
| planner | PLAN | Implementation planning |
| executor | IMPL | Code implementation |
| tester | TEST | Testing and QA |
| reviewer | REVIEW | Code review |

## Design Patterns

| Pattern | Skills Using It |
|---------|----------------|
| Orchestrator + Workers | team-lifecycle, team-testing, team-quality-assurance |
| Generator-Critic Loop | team-iterdev |
| Wave Pipeline | team-planex |
| Red-Green-Refactor | workflow-tdd-plan |
| Pure Orchestrator | workflow-plan, workflow-lite-planex |
| Progressive Phase Loading | workflow-plan, workflow-tdd-plan, team-lifecycle |

::: info See Also
- [Core Skills Detail](./core-skills.md) - Detailed skill documentation
- [Custom Skills](./custom.md) - Create your own skills
- [CLI Commands](../cli/commands.md) - Command reference
- [Team Workflows](../workflows/teams.md) - Team workflow patterns
:::
