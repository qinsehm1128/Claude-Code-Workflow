# Workflow Comparison Table

> **Complete reference for all CCW workflows** - Compare workflows by invocation, pipeline, use case, complexity, and auto-chain behavior.

## Quick Reference

| Workflow | Best For | Level | Self-Contained |
|----------|----------|-------|----------------|
| workflow-lite-planex | Quick tasks, bug fixes | 2 (Lightweight) | YES |
| workflow-plan → workflow-execute | Complex features | 3-4 (Standard) | NO (requires execute) |
| workflow-tdd-plan → workflow-execute | TDD development | 3 (Standard) | NO (requires execute) |
| workflow-test-fix | Test generation/fix | 3 (Standard) | YES |
| workflow-multi-cli-plan | Multi-perspective planning | 3 (Standard) | YES |
| brainstorm-with-file | Ideation, exploration | 4 (Full) | NO (chains to plan) |
| analyze-with-file | Deep analysis | 3 (Standard) | NO (chains to lite-plan) |
| debug-with-file | Hypothesis-driven debugging | 3 (Standard) | YES |
| collaborative-plan-with-file | Multi-agent planning | 3 (Standard) | NO (chains to execute) |
| roadmap-with-file | Strategic roadmaps | 4 (Strategic) | NO (chains to team-planex) |
| integration-test-cycle | Integration testing | 3 (Standard) | YES |
| refactor-cycle | Tech debt refactoring | 3 (Standard) | YES |
| review-cycle | Code review | 3 (Standard) | YES |
| spec-generator | Specification packages | 4 (Full) | NO (chains to plan) |
| team-planex | Issue batch execution | Team | YES |
| team-lifecycle | Full lifecycle | Team | YES |
| issue pipeline | Issue management | 2.5 (Bridge) | YES |

---

## Complete Comparison Table

| Workflow | Invocation | Pipeline | Use Case | Level | Self-Contained | Auto-Chains To |
|----------|------------|----------|----------|-------|----------------|----------------|
| **Plan+Execute Workflows** |
| workflow-lite-planex | `/ccw "task"` (auto for low/medium complexity) | explore → plan → confirm → execute | Quick features, bug fixes, simple tasks | 2 (Lightweight) | YES | workflow-test-fix |
| workflow-plan | `/ccw "complex feature"` (high complexity) | session → context → convention → gen → verify/replan | Complex feature planning, formal verification | 3-4 (Standard) | NO | workflow-execute |
| workflow-execute | `/workflow-execute` (after plan) | session discovery → task processing → commit | Execute pre-generated plans | 3 (Standard) | YES | review-cycle (optional) |
| workflow-multi-cli-plan | `/ccw "multi-cli plan: ..."` | ACE context → CLI discussion → plan → execute | Multi-perspective planning | 3 (Standard) | YES | (internal handoff) |
| **TDD Workflows** |
| workflow-tdd-plan | `/ccw "Implement with TDD"` | 6-phase TDD plan → verify | Test-driven development planning | 3 (Standard) | NO | workflow-execute |
| workflow-test-fix | `/ccw "generate tests"` or auto-chained | session → context → analysis → gen → cycle | Test generation, coverage improvement | 3 (Standard) | YES | (standalone) |
| **Brainstorm Workflows** |
| brainstorm | `/brainstorm "topic"` | mode detect → framework → parallel analysis → synthesis | Multi-perspective ideation | 4 (Full) | YES (ideation only) | workflow-plan |
| brainstorm-with-file | `/ccw "brainstorm: ..."` | brainstorm + documented artifacts | Documented ideation with session | 4 (Full) | NO | workflow-plan → execute |
| collaborative-plan-with-file | `/ccw "collaborative plan: ..."` | understanding → parallel agents → plan-note.md | Multi-agent collaborative planning | 3 (Standard) | NO | unified-execute-with-file |
| **Analysis Workflows** |
| analyze-with-file | `/ccw "analyze: ..."` | multi-CLI analysis → discussion.md | Deep understanding, architecture exploration | 3 (Standard) | NO | workflow-lite-planex |
| debug-with-file | `/ccw "debug: ..."` | hypothesis-driven iteration → debug.log | Systematic debugging | 3 (Standard) | YES | (standalone) |
| **Review Workflows** |
| review-cycle | `/ccw "review code"` | discovery → analysis → aggregation → deep-dive → completion | Code review, quality gates | 3 (Standard) | YES | fix mode (if findings) |
| **Specification Workflows** |
| spec-generator | `/ccw "specification: ..."` | study → discovery → brief → PRD → architecture → epics | Complete specification package | 4 (Full) | YES (docs only) | workflow-plan / team-planex |
| **Team Workflows** |
| team-planex | `/ccw "team planex: ..."` | coordinator → planner wave → executor wave | Issue-based parallel execution | Team | YES | (complete pipeline) |
| team-lifecycle | `/ccw "team lifecycle: ..."` | spec pipeline → impl pipeline | Full lifecycle specification to validation | Team | YES | (complete lifecycle) |
| team-arch-opt | (architecture optimization) | architecture analysis → optimization | Architecture optimization | Team | YES | (complete) |
| **Cycle Workflows** |
| integration-test-cycle | `/ccw "integration test: ..."` | explore → test dev → test-fix cycle → reflection | Integration testing with iteration | 3 (Standard) | YES | (self-iterating) |
| refactor-cycle | `/ccw "refactor: ..."` | discover → prioritize → execute → validate | Tech debt discovery and refactoring | 3 (Standard) | YES | (self-iterating) |
| **Issue Workflow** |
| issue pipeline | `/ccw "use issue workflow"` | discover → plan → queue → execute | Structured issue management | 2.5 (Bridge) | YES | (complete pipeline) |
| **Roadmap Workflow** |
| roadmap-with-file | `/ccw "roadmap: ..."` | strategic roadmap → issue creation → execution-plan | Strategic requirement decomposition | 4 (Strategic) | NO | team-planex |

---

## Workflow Level Classification

| Level | Workflows | Characteristics |
|-------|-----------|-----------------|
| **2 (Lightweight)** | workflow-lite-planex, docs | Quick execution, minimal phases |
| **2.5 (Bridge)** | issue pipeline, rapid-to-issue | Bridge to issue workflow |
| **3 (Standard)** | workflow-plan, workflow-execute, workflow-tdd-plan, workflow-test-fix, review-cycle, debug-with-file, analyze-with-file, workflow-multi-cli-plan | Full planning/execution, multi-phase |
| **4 (Full)** | brainstorm, spec-generator, brainstorm-with-file, roadmap-with-file | Complete exploration, specification |
| **Team** | team-planex, team-lifecycle, team-arch-opt | Multi-agent parallel execution |
| **Cycle** | integration-test-cycle, refactor-cycle | Self-iterating with reflection |

---

## Auto-Chain Reference

| Source Workflow | Auto-Chains To | Condition |
|-----------------|---------------|-----------|
| workflow-lite-planex | workflow-test-fix | Default (unless skip-tests) |
| workflow-plan | workflow-execute | After plan confirmation |
| workflow-execute | review-cycle | User choice via Phase 6 |
| workflow-tdd-plan | workflow-execute | After TDD plan validation |
| brainstorm | workflow-plan | Auto-chain for formal planning |
| brainstorm-with-file | workflow-plan → workflow-execute | Auto |
| analyze-with-file | workflow-lite-planex | Auto |
| debug-with-file | (none) | Standalone |
| collaborative-plan-with-file | unified-execute-with-file | Auto |
| roadmap-with-file | team-planex | Auto |
| spec-generator | workflow-plan / team-planex | User choice |
| review-cycle | fix mode | If findings exist |

---

## Self-Contained vs Multi-Skill

| Workflow | Self-Contained | Notes |
|----------|---------------|-------|
| workflow-lite-planex | YES | Complete plan + execute |
| workflow-plan | NO | Requires workflow-execute |
| workflow-execute | YES | Complete execution |
| workflow-tdd-plan | NO | Requires workflow-execute |
| workflow-test-fix | YES | Complete generation + execution |
| brainstorm | YES (ideation) | NO for implementation |
| review-cycle | YES | Complete review + optional fix |
| spec-generator | YES (docs) | NO for implementation |
| team-planex | YES | Complete team pipeline |
| team-lifecycle | YES | Complete lifecycle |
| debug-with-file | YES | Complete debugging |
| integration-test-cycle | YES | Self-iterating |
| refactor-cycle | YES | Self-iterating |

---

## Keyword Detection Reference

| Keyword Pattern | Detected Workflow |
|-----------------|-------------------|
| `urgent`, `critical`, `hotfix` | bugfix-hotfix |
| `from scratch`, `greenfield`, `new project` | greenfield |
| `brainstorm`, `ideation`, `multi-perspective` | brainstorm |
| `debug`, `hypothesis`, `systematic` | debug-with-file |
| `analyze`, `understand`, `collaborative analysis` | analyze-with-file |
| `roadmap` | roadmap-with-file |
| `specification`, `PRD`, `产品需求` | spec-generator |
| `integration test`, `集成测试` | integration-test-cycle |
| `refactor`, `技术债务` | refactor-cycle |
| `team planex`, `wave pipeline` | team-planex |
| `multi-cli`, `多模型协作` | workflow-multi-cli-plan |
| `TDD`, `test-driven` | workflow-tdd-plan |
| `review`, `code review` | review-cycle |
| `issue workflow`, `use issue workflow` | issue pipeline |

---

## Workflow Selection Guide

| Task Type | Recommended Workflow | Command Chain |
|-----------|---------------------|---------------|
| Quick feature | `/ccw "..."` | lite-planex → test-fix |
| Bug fix | `/ccw "fix ..."` | lite-planex --bugfix → test-fix |
| Complex feature | `/ccw "..."` (detected) | plan → execute → review → test-fix |
| Exploration | `/workflow:analyze-with-file "..."` | analysis → (optional) lite-planex |
| Ideation | `/workflow:brainstorm-with-file "..."` | brainstorm → plan → execute |
| Debugging | `/workflow:debug-with-file "..."` | hypothesis-driven debugging |
| Issue management | `/issue:new` → `/issue:plan` → `/issue:queue` → `/issue:execute` | issue workflow |
| Multi-issue batch | `/issue:discover` → `/issue:plan --all-pending` | issue batch workflow |
| Code review | `/cli:codex-review --uncommitted` | codex review |
| Team coordination | `team-lifecycle` or `team-planex` | team workflow |
| TDD development | `/ccw "Implement with TDD"` | tdd-plan → execute |
| Integration testing | `/ccw "integration test: ..."` | integration-test-cycle |
| Tech debt | `/ccw "refactor: ..."` | refactor-cycle |
| Specification docs | `/ccw "specification: ..."` | spec-generator → plan |

---

## Greenfield Development Paths

| Size | Pipeline | Complexity |
|------|----------|------------|
| Small | brainstorm-with-file → workflow-plan → workflow-execute | 3 |
| Medium | brainstorm-with-file → workflow-plan → workflow-execute → workflow-test-fix | 3 |
| Large | brainstorm-with-file → workflow-plan → workflow-execute → review-cycle → workflow-test-fix | 4 |

---

## Related Documentation

- [4-Level System](./4-level.md) - Detailed workflow explanation
- [Best Practices](./best-practices.md) - Workflow optimization tips
- [Examples](./examples.md) - Workflow usage examples
- [Teams](./teams.md) - Team workflow coordination
