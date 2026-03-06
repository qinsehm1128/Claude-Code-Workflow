---
适用CLI: claude
分类: specialized
---

# Core Skills

CCW includes **33 built-in skills** organized across 3 categories, with **15 workflow combinations** for common development scenarios.

## Categories Overview

| Category | Count | Description |
|----------|-------|-------------|
| [Standalone](#standalone-skills) | 12 | Single-purpose skills for specific tasks |
| [Team](#team-skills) | 14 | Multi-agent collaborative skills |
| [Workflow](#workflow-skills) | 7 | Planning and execution pipeline skills |

---

## Standalone Skills

### brainstorm

**Purpose**: Unified brainstorming with dual-mode operation

**Triggers**: `brainstorm`, `头脑风暴`

**Description**: Auto pipeline and single role analysis for idea generation.

**Roles**: coordinator, product-manager, data-architect, security-engineer, performance-engineer, frontend-engineer, backend-engineer, devops-engineer, qa-engineer, technical-writer

**Phases**:
1. Phase 1: Initialization
2. Phase 2: Parallel Analysis (auto mode) / Single Role Selection (single mode)
3. Phase 3: Consolidation

**Modes**: `auto`, `single-role`

```bash
Skill(skill="brainstorm")
```

---

### ccw-help

**Purpose**: CCW command help system

**Triggers**: `ccw-help`, `ccw-issue`

**Description**: Search, browse, and recommend commands.

**Phases**:
1. Command Discovery
2. Intent Understanding
3. Command Recommendation
4. Workflow Orchestration

**Modes**: `search`, `browse`, `recommend`

```bash
Skill(skill="ccw-help", args="search auth")
```

---

### memory-capture

**Purpose**: Unified memory capture with routing

**Triggers**: `memory capture`, `compact session`, `save session`, `quick tip`, `memory tips`, `记录`, `压缩会话`

**Description**: Session compact or quick tips capture.

**Phases**:
1. Mode Detection
2. Session Compact (memory-capture mode) / Quick Tips (quick-tips mode)

**Modes**: `memory-capture`, `quick-tips`

```bash
Skill(skill="memory-capture")
```

---

### memory-manage

**Purpose**: Unified memory management

**Triggers**: `memory manage`, `update claude`, `update memory`, `generate docs`, `更新记忆`, `生成文档`

**Description**: CLAUDE.md updates and documentation generation with interactive routing.

**Phases**:
1. Mode Selection
2. CLAUDE.md Update / Documentation Generation

**Modes**: `claude-update`, `docs-generation`

```bash
Skill(skill="memory-manage")
```

---

### issue-manage

**Purpose**: Interactive issue management with menu-driven CRUD operations

**Triggers**: `manage issue`, `list issues`, `edit issue`, `delete issue`, `bulk update`, `issue dashboard`, `issue history`, `completed issues`

**Phases**:
1. Menu Selection
2. Operation Execution

**Mode**: `interactive-menu`

```bash
Skill(skill="issue-manage")
```

---

### review-code

**Purpose**: Multi-dimensional code review with structured reports

**Triggers**: `review code`, `code review`, `审查代码`, `代码审查`

**Description**: Analyzes correctness, readability, performance, security, testing, and architecture.

**Phases**:
1. Input Parsing
2. 6-Dimension Analysis
3. Report Generation

**Dimensions**: correctness, readability, performance, security, testing, architecture

```bash
Skill(skill="review-code")
```

---

### review-cycle

**Purpose**: Unified multi-dimensional code review with automated fix orchestration

**Triggers**: `workflow:review-cycle`, `workflow:review-session-cycle`, `workflow:review-module-cycle`, `workflow:review-cycle-fix`

**Description**: Routes to session-based, module-based, or fix mode.

**Phases**:
1. Mode Routing
2. Session-based Review / Module-based Review / Fix Mode

**Modes**: `session`, `module`, `fix`

```bash
Skill(skill="review-cycle")
```

---

### skill-generator

**Purpose**: Meta-skill for creating new Claude Code skills

**Triggers**: `create skill`, `new skill`, `skill generator`

**Description**: Configurable execution modes for skill scaffolding.

**Phases**:
1. Requirements Gathering
2. Skill Generation
3. Validation

**Modes**: `sequential`, `autonomous`

```bash
Skill(skill="skill-generator")
```

---

### skill-tuning

**Purpose**: Universal skill diagnosis and optimization tool

**Triggers**: `skill tuning`, `tune skill`, `skill diagnosis`, `optimize skill`, `skill debug`

**Description**: Detects and fixes skill execution issues.

**Issues**: context-explosion, long-tail-forgetting, data-flow-disruption, agent-coordination-failure

**Phases**:
1. Skill Loading
2. Diagnosis
3. Optimization
4. Validation

```bash
Skill(skill="skill-tuning")
```

---

### spec-generator

**Purpose**: Specification generator with 6-phase document chain

**Triggers**: `generate spec`, `create specification`, `spec generator`, `workflow:spec`

**Description**: Produces product brief, PRD, architecture, and epics.

**Roles**: product-manager, business-analyst, architect, tech-lead, project-manager, qa-lead

**Phases**:
1. Phase 1: Product Brief
2. Phase 2: PRD
3. Phase 3: Architecture Design
4. Phase 4: Tech Stack
5. Phase 5: Epics
6. Phase 6: Quality Gate

**Outputs**: PRODUCT_BRIEF.md, PRD.md, ARCHITECTURE.md, TECH_STACK.md, EPICS.md, QUALITY_GATE.md

```bash
Skill(skill="spec-generator")
```

---

### software-manual

**Purpose**: Generate interactive TiddlyWiki-style HTML software manuals

**Triggers**: `software manual`, `user guide`, `generate manual`, `create docs`

**Description**: Screenshots, API docs, and multi-level code examples.

**Roles**: Product Manager, UX Expert, API Architect, DevOps Engineer, Support Engineer, Developer Advocate

**Phases**:
1. Requirements Discovery
2. Project Exploration
3. API Extraction
4. Parallel Analysis (6 agents)
5. Consolidation
6. Screenshot Capture
7. HTML Assembly
8. Iterative Refinement

**Features**: search, collapse-expand, tag-navigation, theme-toggle, single-file, offline, print-friendly

```bash
Skill(skill="software-manual")
```

---

### command-generator

**Purpose**: Command file generation meta-skill

**Triggers**: `generate command`

**Description**: Generates CCW command files with standardized structure.

**Phases**:
1. Requirements Gathering
2. Command File Generation
3. Validation

**Outputs**: Command definition files

```bash
Skill(skill="command-generator")
```

---

## Team Skills

### team-lifecycle-v4 [已废弃]

**Purpose**: Unified team skill for full lifecycle - spec/impl/test

**Triggers**: `team lifecycle`

**Description**: **[已废弃]** 请使用 `team-lifecycle` (v5)。v4 保留用于向后兼容。

**Status**: Legacy - 已被 team-lifecycle (v5) 取代

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| spec-lead | SPEC | lead |
| architect | ARCH | worker |
| impl-lead | IMPL | lead |
| frontend-dev | FE | worker |
| backend-dev | BE | worker |
| test-lead | TEST | lead |
| qa-analyst | QA | worker |

**Phases**:
1. Phase 1: Spec Planning (coordinator + spec-lead)
2. Phase 2: Architecture Design (architect)
3. Phase 3: Implementation Planning (impl-lead + dev team)
4. Phase 4: Test Planning (test-lead + qa-analyst)
5. Phase 5: Execution & Verification

**Integrations**: inline-discuss, shared-explore, ui-ux-pro-max

```bash
Skill(skill="team-lifecycle-v4", args="Build user authentication system")
```

---

### team-brainstorm

**Purpose**: Unified team skill for brainstorming team

**Triggers**: `team brainstorm`

**Description**: Multi-angle ideation with collaborative roles.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| ideator | IDEA | worker |
| challenger | CHAL | worker |
| synthesizer | SYNC | worker |
| evaluator | EVAL | worker |

**Phases**:
1. Setup
2. Ideation
3. Challenge
4. Synthesis
5. Evaluation

**Output**: `brainstorm-results.md`

```bash
Skill(skill="team-brainstorm")
```

---

### team-frontend

**Purpose**: Unified team skill for frontend development team

**Triggers**: `team frontend`

**Description**: Built-in ui-ux-pro-max design intelligence.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| frontend-lead | FE-LEAD | lead |
| ui-developer | UI-DEV | worker |
| ux-engineer | UX | worker |
| component-dev | COMP | worker |
| qa-specialist | QA | worker |

**Phases**: Planning, Design Integration, Component Development, Integration, Testing

**Integrations**: ui-ux-pro-max

```bash
Skill(skill="team-frontend")
```

---

### team-issue

**Purpose**: Unified team skill for issue resolution

**Triggers**: `team issue`

**Description**: 5-phase pipeline from exploration to integration.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| explorer | EXP | worker |
| planner | PLAN | worker |
| implementer | IMPL | worker |
| reviewer | REV | worker |
| integrator | INT | worker |

**Phases**:
1. Exploration
2. Planning
3. Implementation
4. Review
5. Integration

```bash
Skill(skill="team-issue")
```

---

### team-iterdev

**Purpose**: Unified team skill for iterative development team

**Triggers**: `team iterdev`

**Description**: Generator-critic loop pattern.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| generator | GEN | worker |
| critic | CRIT | worker |
| integrator | INT | worker |
| validator | VAL | worker |

**Phases**: Generation, Critique, Refinement, Integration, Validation

**Pattern**: generator-critic-loop

```bash
Skill(skill="team-iterdev")
```

---

### team-planex

**Purpose**: Unified team skill for plan-and-execute pipeline

**Triggers**: `team planex`

**Description**: 2-member team with wave pipeline for concurrent planning and execution.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| planner | PLAN | lead |
| executor | EXEC | lead |

**Phases**:
- Wave 1: Initial Plan
- Wave 2: Execution + Next Wave Planning
- Wave N: Progressive Execution

**Pattern**: wave-pipeline

```bash
Skill(skill="team-planex")
```

---

### team-quality-assurance

**Purpose**: Unified team skill for quality assurance team

**Triggers**: `team quality-assurance`, `team qa`

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| scout | SCOUT | worker |
| strategist | STRAT | worker |
| generator | GEN | worker |
| executor | EXEC | worker |
| analyst | ANA | worker |

**Phases**: Scouting, Strategy, Generation, Execution, Analysis

```bash
Skill(skill="team-quality-assurance")
```

---

### team-review

**Purpose**: Unified team skill for code scanning and review

**Triggers**: `team-review`

**Description**: Vulnerability review, optimization suggestions, and automated fix.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| scanner | SCAN | worker |
| reviewer | REV | worker |
| fixer | FIX | worker |

**Phases**: Scanning, Review, Fix Planning, Fix Execution

```bash
Skill(skill="team-review")
```

---

### team-roadmap-dev

**Purpose**: Unified team skill for roadmap-driven development workflow

**Triggers**: `team roadmap-dev`

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| planner | PLAN | lead |
| executor | EXEC | lead |
| verifier | VER | worker |

**Phases**: Roadmap Discussion, Phased Execution (plan → execute → verify)

```bash
Skill(skill="team-roadmap-dev")
```

---

### team-tech-debt

**Purpose**: Unified team skill for tech debt identification and cleanup

**Triggers**: `team tech-debt`, `tech debt cleanup`, `技术债务`

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| scanner | SCAN | worker |
| assessor | ASSESS | worker |
| planner | PLAN | worker |
| executor | EXEC | worker |
| validator | VAL | worker |

**Phases**: Scanning, Assessment, Planning, Execution, Validation

```bash
Skill(skill="team-tech-debt")
```

---

### team-testing

**Purpose**: Unified team skill for testing team

**Triggers**: `team testing`

**Description**: Progressive test coverage.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| strategist | STRAT | worker |
| generator | GEN | worker |
| executor | EXEC | worker |
| analyst | ANA | worker |

**Phases**: Strategy, Generation, Execution, Analysis

```bash
Skill(skill="team-testing")
```

---

### team-uidesign

**Purpose**: Unified team skill for UI design team

**Triggers**: `team uidesign`

**Description**: Design token system and CP-9 dual-track.

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| designer | DES | worker |
| developer | DEV | worker |
| reviewer | REV | worker |

**Phases**: Design, Implementation, Review

**Integrations**: ui-ux-pro-max, design-token-system

**Pattern**: CP-9-dual-track

```bash
Skill(skill="team-uidesign")
```

---

### team-ultra-analyze

**Purpose**: Unified team skill for deep collaborative analysis

**Triggers**: `team ultra-analyze`, `team analyze`

**Roles**:

| Role | Prefix | Type |
|------|--------|------|
| coordinator | COORD | orchestrator |
| explorer | EXP | worker |
| analyst | ANA | worker |
| discussant | DIS | worker |
| synthesizer | SYNC | worker |

**Phases**: Exploration, Analysis, Discussion, Synthesis

```bash
Skill(skill="team-ultra-analyze")
```

---

## Workflow Skills

### workflow-plan

**Purpose**: Unified planning skill with 4-phase workflow

**Triggers**: `workflow-plan`, `workflow-plan-verify`, `workflow:replan`

**Description**: Plan verification and interactive replanning.

**Phases**:
1. Session Discovery
2. Context Gathering
3. Conflict Resolution (conditional)
4. Task Generation
5. Plan Verification (verify mode)
6. Interactive Replan (replan mode)

**Modes**: `plan`, `verify`, `replan`

**Artifacts**: IMPL_PLAN.md, task JSONs, TODO_LIST.md, PLAN_VERIFICATION.md

**Protection**: TodoWrite tracking + sentinel fallback for compact recovery

```bash
Skill(skill="workflow-plan")
```

---

### workflow-lite-plan

**Purpose**: Lightweight planning and execution skill

**Triggers**: `workflow-lite-plan`

**Description**: Unified planning and execution skill (Phase 1: plan, Phase 2: execute) with prompt enhancement.

**Phases**:
1. Phase 1: Lite Plan (planning pipeline)
2. Phase 2: Lite Execute (execution engine, internal)

**Modes**: `plan` (Phase 1 → Phase 2 automatically)

**Artifacts**: LITE_PLAN.md, execution results

```bash
Skill(skill="workflow-lite-plan")
```

---

### workflow-multi-cli-plan

**Purpose**: Multi-CLI collaborative planning and execution skill

**Triggers**: `workflow-multi-cli-plan`, `workflow:multi-cli-plan`

**Description**: Multi-CLI collaborative planning and execution skill (Phase 1: plan, Phase 2: execute) with prompt enhancement.

**Phases**:
1. Phase 1: Multi-CLI Plan (ACE context → discussion → plan → execute)
2. Phase 2: Lite Execute (execution engine)

**Modes**: `plan`, `execute`

**Features**: ACE context engine, multi-CLI discussion, handoff to execution

```bash
Skill(skill="workflow-multi-cli-plan")
```

---

### workflow-execute

**Purpose**: Coordinate agent execution for workflow tasks

**Triggers**: `workflow-execute`

**Description**: Automatic session discovery, parallel task processing, and status tracking.

**Phases**:
1. Session Discovery
2. Task Execution
3. Status Tracking

**Features**: parallel execution, session discovery, progress tracking

```bash
Skill(skill="workflow-execute")
```

---

### workflow-tdd-plan

**Purpose**: Unified TDD workflow skill

**Triggers**: `workflow-tdd-plan`, `workflow-tdd-verify`

**Description**: 6-phase TDD planning with Red-Green-Refactor task chain generation.

**Phases**:
1. Feature Analysis
2. Test Design
3. Task Generation
4. Planning Documentation
5. Quality Gate
6. Preparation
7. Verification Phases 1-4

**Modes**: `tdd-plan`, `tdd-verify`

**Artifacts**: TDD_PLAN.md, task chain JSONs, TDD_VERIFICATION.md

**Pattern**: Red-Green-Refactor

```bash
Skill(skill="workflow-tdd-plan")
```

---

### workflow-test-fix

**Purpose**: Unified test-fix pipeline

**Triggers**: `workflow-test-fix`, `workflow-test-fix`, `test fix workflow`

**Description**: Combines test generation with iterative test-cycle execution.

**Phases**:
- Generation Phase 1: Session Discovery
- Generation Phase 2: Context Gathering
- Generation Phase 3: Analysis
- Generation Phase 4: Task Generation
- Execution Phases 1-4: Adaptive strategy, progressive testing, CLI fallback

**Modes**: `test-fix-gen`, `test-cycle-execute`

**Features**: adaptive strategy, progressive testing, CLI fallback

```bash
Skill(skill="workflow-test-fix")
```

---

### workflow-skill-designer

**Purpose**: Meta-skill for designing orchestrator+phases structured workflow skills

**Triggers**: `design workflow skill`, `create workflow skill`, `workflow skill designer`

**Description**: Creates SKILL.md coordinator with progressive phase loading.

**Phases**:
1. Requirements
2. Structure Design
3. SKILL.md Generation
4. Phase Files Generation

**Outputs**: SKILL.md, phases/*.md

**Patterns**: progressive phase loading, TodoWrite patterns, data flow, compact recovery

```bash
Skill(skill="workflow-skill-designer")
```

---

## Workflow Combinations

Pre-defined skill sequences for common development scenarios:

### 1. Full Lifecycle Development

**Purpose**: Complete spec → impl → test workflow

**Use Case**: New feature development with full planning and verification

```bash
Skill(skill="brainstorm")
Skill(skill="workflow-plan")
Skill(skill="workflow-plan", args="--mode verify")
Skill(skill="workflow-execute")
Skill(skill="review-cycle")
```

**Team Alternative**: `team-lifecycle`

---

### 2. Quick Iteration

**Purpose**: Fast plan and execute cycle

**Use Case**: Quick iterations and rapid prototyping

```bash
Skill(skill="workflow-lite-plan")
Skill(skill="workflow-execute")
```

**Team Alternative**: `team-planex`

---

### 3. Multi-CLI Collaborative Planning

**Purpose**: Deep analysis with multiple CLIs collaborating

**Use Case**: Complex tasks requiring deep semantic analysis

```bash
Skill(skill="workflow-multi-cli-plan")
Skill(skill="workflow-execute")
```

---

### 4. Test-Driven Development

**Purpose**: TDD workflow with test generation and verification

**Use Case**: Test-driven development with Red-Green-Refactor cycle

```bash
Skill(skill="workflow-tdd-plan", args="--mode tdd-plan")
Skill(skill="workflow-execute")
Skill(skill="workflow-tdd-plan", args="--mode tdd-verify")
```

---

### 5. Test-Fix Cycle

**Purpose**: Generate tests and iteratively fix failures

**Use Case**: Improving test coverage with automatic fix loops

```bash
Skill(skill="workflow-test-fix", args="--mode test-fix-gen")
Skill(skill="workflow-test-fix", args="--mode test-cycle-execute")
```

---

### 6. Spec Generation Workflow

**Purpose**: Generate complete specification documents

**Use Case**: Creating product documentation from initial ideas

```bash
Skill(skill="brainstorm")
Skill(skill="spec-generator")
```

---

### 7. Issue Resolution Workflow

**Purpose**: End-to-end issue management and resolution

**Use Case**: Managing and resolving reported issues

```bash
Skill(skill="issue-manage")
Skill(skill="team-issue")
Skill(skill="review-cycle", args="--mode fix")
```

---

### 8. Code Quality Workflow

**Purpose**: Review and fix code quality issues

**Use Case**: Code quality improvement with automated fixes

```bash
Skill(skill="review-code")
Skill(skill="review-cycle", args="--mode fix")
```

**Team Alternative**: `team-review`

---

### 9. Tech Debt Cleanup

**Purpose**: Identify and resolve technical debt

**Use Case**: Managing technical debt systematically

```bash
Skill(skill="team-tech-debt")
Skill(skill="workflow-execute")
Skill(skill="review-cycle")
```

---

### 10. UI Design and Implementation

**Purpose**: Design UI and implement components

**Use Case**: Complete UI/UX design to implementation

```bash
Skill(skill="team-uidesign")
Skill(skill="team-frontend")
```

**Integrations**: ui-ux-pro-max

---

### 11. Quality Assurance Pipeline

**Purpose**: Comprehensive QA testing workflow

**Use Case**: Full quality assurance coverage

```bash
Skill(skill="team-quality-assurance")
Skill(skill="team-testing")
```

---

### 12. Documentation Generation

**Purpose**: Generate software documentation

**Use Case**: Creating interactive user manuals

```bash
Skill(skill="software-manual")
```

---

### 13. Deep Analysis Workflow

**Purpose**: Collaborative deep codebase analysis

**Use Case**: Complex architectural analysis and understanding

```bash
Skill(skill="team-ultra-analyze")
```

---

### 14. Replanning Workflow

**Purpose**: Modify existing plans

**Use Case**: Adjusting plans based on new requirements

```bash
Skill(skill="workflow-plan", args="--mode replan")
```

---

### 15. Skill Development Workflow

**Purpose**: Create new workflow skills

**Use Case**: Meta-skill for extending CCW capabilities

```bash
Skill(skill="workflow-skill-designer")
Skill(skill="skill-tuning")
```

---

## Skill Relationships

### Hierarchy

| Level | Skills |
|-------|--------|
| Meta Skills | skill-generator, skill-tuning, workflow-skill-designer |
| Orchestrators | workflow-plan, workflow-lite-plan, workflow-multi-cli-plan |
| Executors | workflow-execute |
| Team Leads | team-lifecycle (v5) |

### Integrations

| Integration | Skills |
|-------------|--------|
| ui-ux-pro-max | team-uidesign, team-frontend, team-lifecycle |
| ACE Context | workflow-multi-cli-plan |
| Chrome MCP | software-manual |

### Session Management

| Category | Skills |
|----------|--------|
| Session Commands | workflow session start, resume, list, complete, solidify, sync |
| Dependent Skills | workflow-plan, workflow-tdd-plan, workflow-test-fix |

### Issue Management

| Category | Skills |
|----------|--------|
| Issue CLI | issue new, plan, execute, queue, discover, convert-to-plan |
| Dependent Skills | issue-manage, team-issue |

### Memory Management

| Category | Skills |
|----------|--------|
| Memory Skills | memory-capture, memory-manage |
| Related CLI | memory prepare, memory style-skill-memory |

---

## Trigger Mapping

Quick reference for skill triggers:

| Trigger | Skill |
|---------|-------|
| `brainstorm`, `头脑风暴` | brainstorm |
| `review code`, `code review`, `审查代码` | review-code |
| `manage issue` | issue-manage |
| `workflow-plan`, `workflow-plan-verify`, `workflow:replan` | workflow-plan |
| `workflow-execute` | workflow-execute |
| `workflow-lite-plan` | workflow-lite-plan |
| `workflow-multi-cli-plan`, `workflow:multi-cli-plan` | workflow-multi-cli-plan |
| `workflow-tdd-plan` | workflow-tdd-plan |
| `workflow-test-fix`, `test fix workflow` | workflow-test-fix |
| `design workflow skill`, `create workflow skill`, `workflow skill designer` | workflow-skill-designer |
| `generate command` | command-generator |
| `team lifecycle` | team-lifecycle (v5) |
| `team brainstorm` | team-brainstorm |
| `team frontend` | team-frontend |
| `team issue` | team-issue |
| `team qa`, `team quality-assurance` | team-quality-assurance |
| `tech debt cleanup`, `team tech-debt`, `技术债务` | team-tech-debt |
| `team ultra-analyze`, `team analyze` | team-ultra-analyze |
| `memory capture`, `compact session`, `记录`, `压缩会话` | memory-capture |
| `memory manage`, `update claude`, `update memory`, `generate docs`, `更新记忆`, `生成文档` | memory-manage |
| `generate spec`, `create specification`, `spec generator`, `workflow:spec` | spec-generator |
| `create skill`, `new skill` | skill-generator |
| `skill tuning`, `tune skill`, `skill diagnosis` | skill-tuning |
| `software manual`, `user guide`, `generate manual`, `create docs` | software-manual |

---

## Design Patterns

Skills use these design patterns:

| Pattern | Description |
|---------|-------------|
| Orchestrator + Workers | Coordinator dispatches work to specialized agents |
| Coordinator + Lead + Worker | Hierarchical team structure |
| Pure Orchestrator with Phase Files | Phase-based execution with file loading |
| Generator-Critic Loop | Iterative improvement through feedback |
| Wave Pipeline | Concurrent planning and execution |
| TodoWrite Progress Tracking | Compact recovery with progress persistence |

---

## Key Features

| Feature | Description |
|---------|-------------|
| Progressive Phase Loading | Load phases on-demand to reduce context |
| Compact Recovery | TodoWrite + sentinel fallback for session continuity |
| Multi-CLI Collaboration | Gemini, Codex, Claude working together |
| ACE Semantic Search Integration | Real-time codebase context |
| Interactive Mode Detection | Auto-detect user interaction needs |
| Auto Mode Support (-y/--yes) | Skip confirmations for automation |

::: info See Also
- [Agents](../agents/builtin.md) - Specialized agents
- [CLI Commands](../cli/commands.md) - Command reference
- [Custom Skills](./custom.md) - Create custom skills
:::
