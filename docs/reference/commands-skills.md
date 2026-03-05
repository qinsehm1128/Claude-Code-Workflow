# Commands & Skills Reference

> **Quick Reference**: Complete catalog of Claude commands, skills, and Codex capabilities

---

## Quick Reference Table

### Commands Quick Reference

| Category | Command | Description | Arguments |
|----------|---------|-------------|-----------|
| **Orchestrator** | `/ccw` | Main workflow orchestrator | `"task description"` |
| **Orchestrator** | `/ccw-coordinator` | Command orchestration tool | `[task description]` |
| **Session** | `/workflow:session:start` | Start workflow session | `[--type] [--auto|--new] [task]` |
| **Session** | `/workflow:session:resume` | Resume paused session | - |
| **Session** | `/workflow:session:complete` | Complete active session | `[-y] [--detailed]` |
| **Session** | `/workflow:session:list` | List all sessions | - |
| **Session** | `/workflow:session:sync` | Sync session to specs | `[-y] ["what was done"]` |
| **Session** | `/workflow:session:solidify` | Crystallize learnings | `[--type] [--category] "rule"` |
| **Issue** | `/issue:new` | Create structured issue | `<url|text> [--priority 1-5]` |
| **Issue** | `/issue:discover` | Discover potential issues | `<path> [--perspectives=...]` |
| **Issue** | `/issue:plan` | Plan issue resolution | `--all-pending <ids>` |
| **Issue** | `/issue:queue` | Form execution queue | `[--queues <n>] [--issue <id>]` |
| **Issue** | `/issue:execute` | Execute queue | `--queue <id> [--worktree]` |
| **IDAW** | `/idaw:run` | IDAW orchestrator | `[--task <ids>] [--dry-run]` |
| **IDAW** | `/idaw:add` | Add task to queue | - |
| **IDAW** | `/idaw:resume` | Resume IDAW session | - |
| **IDAW** | `/idaw:status` | Show queue status | - |
| **With-File** | `/workflow:brainstorm-with-file` | Interactive brainstorming | `[-c] [-m creative|structured] "topic"` |
| **With-File** | `/workflow:analyze-with-file` | Collaborative analysis | `[-c] "topic"` |
| **With-File** | `/workflow:debug-with-file` | Hypothesis-driven debugging | `"bug description"` |
| **With-File** | `/workflow:collaborative-plan-with-file` | Multi-agent planning | - |
| **With-File** | `/workflow:roadmap-with-file` | Strategic roadmap | - |
| **Cycle** | `/workflow:integration-test-cycle` | Integration test cycle | - |
| **Cycle** | `/workflow:refactor-cycle` | Refactor cycle | - |
| **CLI** | `/cli:codex-review` | Codex code review | `[--uncommitted|--base|--commit]` |
| **CLI** | `/cli:cli-init` | Initialize CLI config | - |
| **Memory** | `/memory:prepare` | Prepare memory context | - |
| **Memory** | `/memory:style-skill-memory` | Style/skill memory | - |

### Skills Quick Reference

| Category | Skill | Internal Pipeline | Use Case |
|----------|-------|-------------------|----------|
| **Workflow** | workflow-lite-planex | explore → plan → confirm → execute | Quick features, bug fixes |
| **Workflow** | workflow-plan | session → context → convention → gen → verify/replan | Complex feature planning |
| **Workflow** | workflow-execute | session discovery → task processing → commit | Execute pre-generated plans |
| **Workflow** | workflow-tdd-plan | 6-phase TDD plan → verify | TDD development |
| **Workflow** | workflow-test-fix | session → context → analysis → gen → cycle | Test generation and fixes |
| **Workflow** | workflow-multi-cli-plan | ACE context → CLI discussion → plan → execute | Multi-perspective planning |
| **Workflow** | workflow-skill-designer | - | Create new skills |
| **Team** | team-lifecycle | spec pipeline → impl pipeline | Full lifecycle |
| **Team** | team-planex | planner wave → executor wave | Issue batch execution |
| **Team** | team-arch-opt | architecture analysis → optimization | Architecture optimization |
| **Utility** | brainstorm | framework → parallel analysis → synthesis | Multi-perspective ideation |
| **Utility** | review-cycle | discovery → analysis → aggregation → deep-dive | Code review |
| **Utility** | spec-generator | study → brief → PRD → architecture → epics | Specification packages |

---

## 1. Main Orchestrator Commands

### /ccw

**Description**: Main workflow orchestrator - analyze intent, select workflow, execute command chain in main process

**Arguments**: `"task description"`

**Category**: orchestrator

**5-Phase Workflow**:
1. Phase 1: Analyze Intent (detect task type, complexity, clarity)
2. Phase 1.5: Requirement Clarification (if clarity < 2)
3. Phase 2: Select Workflow & Build Command Chain
4. Phase 3: User Confirmation
5. Phase 4: Setup TODO Tracking & Status File
6. Phase 5: Execute Command Chain

**Skill Mapping**:

| Skill | Internal Pipeline |
|-------|-------------------|
| workflow-lite-planex | explore → plan → confirm → execute |
| workflow-plan | session → context → convention → gen → verify/replan |
| workflow-execute | session discovery → task processing → commit |
| workflow-tdd-plan | 6-phase TDD plan → verify |
| workflow-test-fix | session → context → analysis → gen → cycle |
| workflow-multi-cli-plan | ACE context → CLI discussion → plan → execute |
| review-cycle | session/module review → fix orchestration |
| brainstorm | auto/single-role → artifacts → analysis → synthesis |
| spec-generator | product-brief → PRD → architecture → epics |

**Auto Mode**: `-y` or `--yes` flag skips confirmations, propagates to all skills

---

### /ccw-coordinator

**Description**: Command orchestration tool - analyze requirements, recommend chain, execute sequentially with state persistence

**Arguments**: `[task description]`

**Category**: orchestrator

**3-Phase Workflow**:
1. Phase 1: Analyze Requirements
2. Phase 2: Discover Commands & Recommend Chain
3. Phase 3: Execute Sequential Command Chain

**Minimum Execution Units**:

| Unit | Commands | Purpose |
|------|----------|---------|
| Quick Implementation | lite-plan (plan → execute) | Lightweight plan and execution |
| Multi-CLI Planning | multi-cli-plan | Multi-perspective planning |
| Bug Fix | lite-plan --bugfix | Bug diagnosis and fix |
| Full Planning + Execution | plan → execute | Detailed planning |
| Verified Planning + Execution | plan → plan-verify → execute | Planning with verification |
| TDD Planning + Execution | tdd-plan → execute | TDD workflow |
| Issue Workflow | discover → plan → queue → execute | Complete issue lifecycle |

---

### /flow-create

**Description**: Flow template generator for meta-skill/flow-coordinator

**Arguments**: `[template-name] [--output <path>]`

**Category**: utility

**Execution Flow**:
1. Phase 1: Template Design (name + description + level)
2. Phase 2: Step Definition (command category → specific command → execution unit → mode)
3. Phase 3: Generate JSON

---

## 2. Workflow Session Commands

### /workflow:session:start

**Description**: Discover existing sessions or start new workflow session with intelligent session management and conflict detection

**Arguments**: `[--type <workflow|review|tdd|test|docs>] [--auto|--new] [task description]`

**Category**: session-management

**Session Types**:

| Type | Description | Default For |
|------|-------------|-------------|
| workflow | Standard implementation | workflow-plan skill |
| review | Code review sessions | review-cycle skill |
| tdd | TDD-based development | workflow-tdd-plan skill |
| test | Test generation/fix | workflow-test-fix skill |
| docs | Documentation sessions | memory-manage skill |

**Modes**:
- **Discovery Mode** (default): List active sessions, prompt user
- **Auto Mode** (`--auto`): Intelligent session selection
- **Force New Mode** (`--new`): Create new session

---

### /workflow:session:resume

**Description**: Resume the most recently paused workflow session with automatic session discovery and status update

**Category**: session-management

---

### /workflow:session:complete

**Description**: Mark active workflow session as complete, archive with lessons learned, update manifest, remove active flag

**Arguments**: `[-y|--yes] [--detailed]`

**Category**: session-management

**Execution Phases**:
1. Find Session
2. Generate Manifest Entry
3. Atomic Commit (mv to archives)
4. Auto-Sync Project State

---

### /workflow:session:list

**Description**: List all workflow sessions with status filtering, shows session metadata and progress information

**Category**: session-management

---

### /workflow:session:sync

**Description**: Quick-sync session work to specs/*.md and project-tech

**Arguments**: `[-y|--yes] ["what was done"]`

**Category**: session-management

**Process**:
1. Gather Context (git diff, session, summary)
2. Extract Updates (guidelines, tech)
3. Preview & Confirm
4. Write both files

---

### /workflow:session:solidify

**Description**: Crystallize session learnings and user-defined constraints into permanent project guidelines, or compress recent memories

**Arguments**: `[-y|--yes] [--type <convention|constraint|learning|compress>] [--category <category>] [--limit <N>] "rule or insight"`

**Category**: session-management

**Type Categories**:

| Type | Subcategories |
|------|---------------|
| convention | coding_style, naming_patterns, file_structure, documentation |
| constraint | architecture, tech_stack, performance, security |
| learning | architecture, performance, security, testing, process, other |
| compress | (operates on core memories) |

---

## 3. Issue Workflow Commands

### /issue:new

**Description**: Create structured issue from GitHub URL or text description

**Arguments**: `[-y|--yes] <github-url | text-description> [--priority 1-5]`

**Category**: issue

**Execution Flow**:
1. Input Analysis & Clarity Detection
2. Data Extraction (GitHub or Text)
3. Lightweight Context Hint (ACE for medium clarity)
4. Conditional Clarification
5. GitHub Publishing Decision
6. Create Issue

---

### /issue:discover

**Description**: Discover potential issues from multiple perspectives using CLI explore. Supports Exa external research for security and best-practices perspectives.

**Arguments**: `[-y|--yes] <path-pattern> [--perspectives=bug,ux,...] [--external]`

**Category**: issue

**Available Perspectives**:

| Perspective | Focus | Categories |
|-------------|-------|------------|
| bug | Potential Bugs | edge-case, null-check, resource-leak, race-condition |
| ux | User Experience | error-message, loading-state, feedback, accessibility |
| test | Test Coverage | missing-test, edge-case-test, integration-gap |
| quality | Code Quality | complexity, duplication, naming, documentation |
| security | Security Issues | injection, auth, encryption, input-validation |
| performance | Performance | n-plus-one, memory-usage, caching, algorithm |
| maintainability | Maintainability | coupling, cohesion, tech-debt, extensibility |
| best-practices | Best Practices | convention, pattern, framework-usage, anti-pattern |

---

### /issue:plan

**Description**: Batch plan issue resolution using issue-plan-agent (explore + plan closed-loop)

**Arguments**: `[-y|--yes] --all-pending <issue-id>[,<issue-id>,...] [--batch-size 3]`

**Category**: issue

**Execution Process**:
1. Issue Loading & Intelligent Grouping
2. Unified Explore + Plan (issue-plan-agent)
3. Solution Registration & Binding
4. Summary

---

### /issue:queue

**Description**: Form execution queue from bound solutions using issue-queue-agent (solution-level)

**Arguments**: `[-y|--yes] [--queues <n>] [--issue <id>]`

**Category**: issue

**Core Capabilities**:
- Agent-driven ordering logic
- Solution-level granularity
- Conflict clarification
- Parallel/Sequential group assignment

---

### /issue:execute

**Description**: Execute queue with DAG-based parallel orchestration (one commit per solution)

**Arguments**: `[-y|--yes] --queue <queue-id> [--worktree [<existing-path>]]`

**Category**: issue

**Execution Flow**:
1. Validate Queue ID (REQUIRED)
2. Get DAG & User Selection
3. Dispatch Parallel Batch (DAG-driven)
4. Next Batch (repeat)
5. Worktree Completion

**Recommended Executor**: Codex (2hr timeout, full write access)

---

### /issue:from-brainstorm

**Description**: Convert brainstorm session ideas into issue with executable solution for parallel-dev-cycle

**Arguments**: `SESSION="<session-id>" [--idea=<index>] [--auto] [-y|--yes]`

**Category**: issue

**Execution Flow**:
1. Session Loading
2. Idea Selection
3. Enrich Issue Context
4. Create Issue
5. Generate Solution Tasks
6. Bind Solution

---

## 4. IDAW Commands

### /idaw:run

**Description**: IDAW orchestrator - execute task skill chains serially with git checkpoints

**Arguments**: `[-y|--yes] [--task <id>[,<id>,...]] [--dry-run]`

**Category**: idaw

**Skill Chain Mapping**:

| Task Type | Skill Chain |
|-----------|-------------|
| bugfix | workflow-lite-planex → workflow-test-fix |
| bugfix-hotfix | workflow-lite-planex |
| feature | workflow-lite-planex → workflow-test-fix |
| feature-complex | workflow-plan → workflow-execute → workflow-test-fix |
| refactor | workflow:refactor-cycle |
| tdd | workflow-tdd-plan → workflow-execute |
| test | workflow-test-fix |
| test-fix | workflow-test-fix |
| review | review-cycle |
| docs | workflow-lite-planex |

**6-Phase Execution**:
1. Load Tasks
2. Session Setup
3. Startup Protocol
4. Main Loop (serial, one task at a time)
5. Checkpoint (per task)
6. Report

---

### /idaw:add

**Description**: Add task to IDAW queue with auto-inferred task type and skill chain

**Category**: idaw

---

### /idaw:resume

**Description**: Resume IDAW session with crash recovery

**Category**: idaw

---

### /idaw:status

**Description**: Show IDAW queue status

**Category**: idaw

---

### /idaw:run-coordinate

**Description**: Multi-agent IDAW execution with parallel task coordination

**Category**: idaw

---

## 5. With-File Workflows

### /workflow:brainstorm-with-file

**Description**: Interactive brainstorming with multi-CLI collaboration, idea expansion, and documented thought evolution

**Arguments**: `[-y|--yes] [-c|--continue] [-m|--mode creative|structured] "idea or topic"`

**Category**: with-file

**Output Directory**: `.workflow/.brainstorm/{session-id}/`

**4-Phase Workflow**:
1. Phase 1: Seed Understanding (parse topic, select roles, expand vectors)
2. Phase 2: Divergent Exploration (cli-explore-agent + Multi-CLI perspectives)
3. Phase 3: Interactive Refinement (multi-round)
4. Phase 4: Convergence & Crystallization

**Output Artifacts**:
- `brainstorm.md` - Complete thought evolution timeline
- `exploration-codebase.json` - Codebase context
- `perspectives.json` - Multi-CLI findings
- `synthesis.json` - Final synthesis

---

### /workflow:analyze-with-file

**Description**: Interactive collaborative analysis with documented discussions, CLI-assisted exploration, and evolving understanding

**Arguments**: `[-y|--yes] [-c|--continue] "topic or question"`

**Category**: with-file

**Output Directory**: `.workflow/.analysis/{session-id}/`

**4-Phase Workflow**:
1. Phase 1: Topic Understanding
2. Phase 2: CLI Exploration (cli-explore-agent + perspectives)
3. Phase 3: Interactive Discussion (multi-round)
4. Phase 4: Synthesis & Conclusion

**Decision Recording Protocol**: Must record direction choices, key findings, assumption changes, user feedback

---

### /workflow:debug-with-file

**Description**: Interactive hypothesis-driven debugging with documented exploration, understanding evolution, and Gemini-assisted correction

**Arguments**: `[-y|--yes] "bug description or error message"`

**Category**: with-file

**Output Directory**: `.workflow/.debug/{session-id}/`

**Core Workflow**: Explore → Document → Log → Analyze → Correct Understanding → Fix → Verify

**Output Artifacts**:
- `debug.log` - NDJSON execution evidence
- `understanding.md` - Exploration timeline + consolidated understanding
- `hypotheses.json` - Hypothesis history with verdicts

---

### /workflow:collaborative-plan-with-file

**Description**: Multi-agent collaborative planning with Plan Note shared doc

**Category**: with-file

---

### /workflow:roadmap-with-file

**Description**: Strategic requirement roadmap → issue creation → execution-plan.json

**Category**: with-file

---

### /workflow:unified-execute-with-file

**Description**: Universal execution engine - consumes plan output from collaborative-plan, roadmap, brainstorm

**Category**: with-file

---

## 6. Cycle Workflows

### /workflow:integration-test-cycle

**Description**: Self-iterating integration test with reflection - explore → test dev → test-fix cycle → reflection

**Category**: cycle

**Output Directory**: `.workflow/.test-cycle/`

---

### /workflow:refactor-cycle

**Description**: Tech debt discovery → prioritize → execute → validate

**Category**: cycle

**Output Directory**: `.workflow/.refactor-cycle/`

---

## 7. CLI Commands

### /cli:codex-review

**Description**: Interactive code review using Codex CLI via ccw endpoint with configurable review target, model, and custom instructions

**Arguments**: `[--uncommitted|--base <branch>|--commit <sha>] [--model <model>] [--title <title>] [prompt]`

**Category**: cli

**Review Targets**:

| Target | Flag | Description |
|--------|------|-------------|
| Uncommitted changes | `--uncommitted` | Review staged, unstaged, and untracked changes |
| Compare to branch | `--base <BRANCH>` | Review changes against base branch |
| Specific commit | `--commit <SHA>` | Review changes introduced by a commit |

**Focus Areas**: General review, Security focus, Performance focus, Code quality

**Important**: Target flags and prompt are mutually exclusive

---

### /cli:cli-init

**Description**: Initialize CLI configuration for ccw endpoint

**Category**: cli

---

## 8. Memory Commands

### /memory:prepare

**Description**: Prepare memory context for session

**Category**: memory

---

### /memory:style-skill-memory

**Description**: Style and skill memory management

**Category**: memory

---

## 9. Team Skills

### Team Lifecycle Skills

| Skill | Description |
|-------|-------------|
| team-lifecycle | Full team lifecycle with role-spec-driven worker agents |
| team-planex | Planner + executor wave pipeline (for large issue batches or roadmap outputs) |
| team-coordinate | Team coordination and orchestration |
| team-executor | Task execution with worker agents |
| team-arch-opt | Architecture optimization skill |

### Team Domain Skills

| Skill | Description |
|-------|-------------|
| team-brainstorm | Multi-perspective brainstorming |
| team-review | Code review workflow |
| team-testing | Testing workflow |
| team-frontend | Frontend development workflow |
| team-issue | Issue management workflow |
| team-iterdev | Iterative development workflow |
| team-perf-opt | Performance optimization workflow |
| team-quality-assurance | QA workflow |
| team-roadmap-dev | Roadmap development workflow |
| team-tech-debt | Technical debt management |
| team-uidesign | UI design workflow |
| team-ultra-analyze | Deep analysis workflow |

---

## 10. Workflow Skills

| Skill | Internal Pipeline | Description |
|-------|-------------------|-------------|
| workflow-lite-planex | explore → plan → confirm → execute | Lightweight merged-mode planning |
| workflow-plan | session → context → convention → gen → verify/replan | Full planning with architecture design |
| workflow-execute | session discovery → task processing → commit | Execute from planning session |
| workflow-tdd-plan | 6-phase TDD plan → verify | TDD workflow planning |
| workflow-test-fix | session → context → analysis → gen → cycle | Test generation and fix cycle |
| workflow-multi-cli-plan | ACE context → CLI discussion → plan → execute | Multi-CLI collaborative planning |
| workflow-skill-designer | - | Workflow skill design and generation |

---

## 11. Utility Skills

| Skill | Description |
|-------|-------------|
| brainstorm | Unified brainstorming skill (auto-parallel + role analysis) |
| review-code | Code review skill |
| review-cycle | Session/module review → fix orchestration |
| spec-generator | Product-brief → PRD → architecture → epics |
| skill-generator | Generate new skills |
| skill-tuning | Tune existing skills |
| command-generator | Generate new commands |
| memory-capture | Capture session memories |
| memory-manage | Manage stored memories |
| issue-manage | Issue management utility |
| ccw-help | CCW help and documentation |

---

## 12. Codex Capabilities

### Codex Review Mode

**Command**: `ccw cli --tool codex --mode review [OPTIONS]`

| Option | Description |
|--------|-------------|
| `[PROMPT]` | Custom review instructions (positional, no target flags) |
| `-c model=<model>` | Override model via config |
| `--uncommitted` | Review staged, unstaged, and untracked changes |
| `--base <BRANCH>` | Review changes against base branch |
| `--commit <SHA>` | Review changes introduced by a commit |
| `--title <TITLE>` | Optional commit title for review summary |

**Available Models**:
- Default: gpt-5.2
- o3: OpenAI o3 reasoning model
- gpt-4.1: GPT-4.1 model
- o4-mini: OpenAI o4-mini (faster)

**Constraints**:
- Target flags (`--uncommitted`, `--base`, `--commit`) **cannot** be used with positional `[PROMPT]`
- Custom prompts only supported WITHOUT target flags (reviews uncommitted by default)

### Codex Integration Points

| Integration Point | Description |
|-------------------|-------------|
| CLI endpoint | `ccw cli --tool codex --mode <analysis\|write\|review>` |
| Multi-CLI planning | Pragmatic perspective in workflow-multi-cli-plan |
| Code review | `/cli:codex-review` command |
| Issue execution | Recommended executor for `/issue:execute` |
| Devil's advocate | Challenge mode in brainstorm refinement |

### Codex Mode Summary

| Mode | Permission | Use Case |
|------|------------|----------|
| analysis | Read-only | Code analysis, architecture review |
| write | Full access | Implementation, file modifications |
| review | Read-only output | Git-aware code review |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Main Orchestrator Commands | 3 |
| Workflow Session Commands | 6 |
| Issue Workflow Commands | 6 |
| IDAW Commands | 5 |
| With-File Workflows | 6 |
| Cycle Workflows | 2 |
| CLI Commands | 2 |
| Memory Commands | 2 |
| Team Skills | 17 |
| Workflow Skills | 7 |
| Utility Skills | 11 |
| **Total Commands** | 32 |
| **Total Skills** | 35 |

---

## Invocation Patterns

### Slash Command Invocation

```
/<namespace>:<command> [arguments] [flags]
```

Examples:
- `/ccw "Add user authentication"`
- `/workflow:session:start --auto "implement feature"`
- `/issue:new https://github.com/org/repo/issues/123`
- `/cli:codex-review --base main`

### Skill Invocation (from code)

```javascript
Skill({ skill: "workflow-lite-planex", args: '"task description"' })
Skill({ skill: "brainstorm", args: '"topic or question"' })
Skill({ skill: "review-cycle", args: '--session="WFS-xxx"' })
```

### CLI Tool Invocation

```bash
ccw cli -p "PURPOSE: ... TASK: ... MODE: analysis|write" --tool <tool> --mode <mode>
```

---

## Related Documentation

- [Workflow Comparison Table](../workflows/comparison-table.md) - Workflow selection guide
- [Workflow Overview](../workflows/index.md) - 4-Level workflow system
- [Claude Workflow Skills](../skills/claude-workflow.md) - Detailed skill documentation
