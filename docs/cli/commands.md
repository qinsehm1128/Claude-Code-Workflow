# CLI Commands Reference

Complete reference for all **43 CCW commands** organized by category, with **7 workflow chains** for common development scenarios.

## Command Categories

| Category | Commands | Description |
|----------|----------|-------------|
| [Orchestrators](#orchestrators) | 3 | Main workflow orchestration |
| [Workflow](#workflow-commands) | 10 | Project initialization and management |
| [Session](#session-commands) | 6 | Session lifecycle management |
| [Analysis](#analysis-commands) | 4 | Code analysis and debugging |
| [Planning](#planning-commands) | 3 | Brainstorming and planning |
| [Execution](#execution-commands) | 1 | Universal execution engine |
| [UI Design](#ui-design-commands) | 10 | Design token extraction and prototyping |
| [Issue](#issue-commands) | 8 | Issue discovery and resolution |
| [Memory](#memory-commands) | 2 | Memory and context management |
| [CLI](#cli-commands) | 2 | CLI configuration and review |

---

## Orchestrators

### ccw

**Purpose**: Main workflow orchestrator - analyze intent, select workflow, execute command chain

**Description**: Analyzes user intent, selects appropriate workflow, and executes command chain in main process.

**Flags**:
- `-y, --yes` - Skip all confirmations

**Mapped Skills**:
- workflow-lite-plan, workflow-plan, workflow-execute, workflow-tdd-plan
- workflow-test-fix, workflow-multi-cli-plan, review-cycle, brainstorm
- team-planex, team-iterdev, team-lifecycle, team-issue
- team-testing, team-quality-assurance, team-brainstorm, team-uidesign

```bash
ccw -y
```

### ccw-coordinator

**Purpose**: Command orchestration tool with external CLI execution

**Description**: Analyzes requirements, recommends chain, executes sequentially with state persistence. Uses background tasks with hook callbacks.

**Tools**: `Task`, `AskUserQuestion`, `Read`, `Write`, `Bash`, `Glob`, `Grep`

```bash
ccw-coordinator
```

### flow-create

**Purpose**: Generate workflow templates for meta-skill/flow-coordinator

```bash
flow-create
```

---

## Workflow Commands

### workflow init

**Purpose**: Initialize project-level state with intelligent project analysis

**Description**: Uses cli-explore-agent for intelligent project analysis, generating project-tech.json and specification files.

**Flags**:
- `--regenerate` - Force regeneration
- `--skip-specs` - Skip specification generation

**Output**:
- `.workflow/project-tech.json`
- `.workflow/specs/*.md`

**Delegates to**: `cli-explore-agent`

```bash
workflow init --regenerate
```

### workflow init-specs

**Purpose**: Interactive wizard for creating individual specs or personal constraints

**Flags**:
- `--scope <global|project>` - Scope selection
- `--dimension <specs|personal>` - Dimension selection
- `--category <general|exploration|planning|execution>` - Category selection

```bash
workflow init-specs --scope project --dimension specs
```

### workflow init-guidelines

**Purpose**: Interactive wizard to fill specs/*.md based on project analysis

**Flags**:
- `--reset` - Reset existing guidelines

```bash
workflow init-guidelines --reset
```

### workflow clean

**Purpose**: Intelligent code cleanup with mainline detection

**Description**: Discovers stale artifacts and executes safe cleanup operations.

**Flags**:
- `-y, --yes` - Skip confirmation
- `--dry-run` - Preview without changes

**Delegates to**: `cli-explore-agent`

```bash
workflow clean --dry-run
```

### workflow unified-execute-with-file

**Purpose**: Universal execution engine for any planning/brainstorm/analysis output

**Flags**:
- `-y, --yes` - Skip confirmation
- `-p, --plan <path>` - Plan file path
- `--auto-commit` - Auto-commit after execution

**Execution Methods**: Agent, CLI-Codex, CLI-Gemini, Auto

**Output**: `.workflow/.execution/{session-id}/execution-events.md`

```bash
workflow unified-execute-with-file -p plan.json --auto-commit
```

### workflow brainstorm-with-file

**Purpose**: Interactive brainstorming with multi-CLI collaboration

**Description**: Documents thought evolution with idea expansion.

**Flags**:
- `-y, --yes` - Skip confirmation
- `-c, --continue` - Continue previous session
- `-m, --mode <creative|structured>` - Brainstorming mode

**Delegates to**: `cli-explore-agent`, `Multi-CLI (Gemini/Codex/Claude)`

**Output**: `.workflow/.brainstorm/{session-id}/synthesis.json`

```bash
workflow brainstorm-with-file -m creative
```

### workflow analyze-with-file

**Purpose**: Interactive collaborative analysis with documented discussions

**Flags**:
- `-y, --yes` - Skip confirmation
- `-c, --continue` - Continue previous session

**Delegates to**: `cli-explore-agent`, `Gemini/Codex`

**Output**: `.workflow/.analysis/{session-id}/discussion.md`

```bash
workflow analyze-with-file
```

### workflow debug-with-file

**Purpose**: Interactive hypothesis-driven debugging

**Description**: Documents exploration with Gemini-assisted correction.

**Flags**:
- `-y, --yes` - Skip confirmation

**Output**: `.workflow/.debug/{session-id}/understanding.md`

```bash
workflow debug-with-file
```

### workflow collaborative-plan-with-file

**Purpose**: Collaborative planning with Plan Note

**Description**: Parallel agents fill pre-allocated sections with conflict detection.

**Flags**:
- `-y, --yes` - Skip confirmation
- `--max-agents=5` - Maximum parallel agents

**Output**: `.workflow/.planning/{session-id}/plan-note.md`

```bash
workflow collaborative-plan-with-file --max-agents=5
```

### workflow roadmap-with-file

**Purpose**: Strategic requirement roadmap with iterative decomposition

**Flags**:
- `-y, --yes` - Skip confirmation
- `-c, --continue` - Continue previous session
- `-m, --mode <progressive|direct|auto>` - Decomposition mode

**Output**:
- `.workflow/.roadmap/{session-id}/roadmap.md`
- `.workflow/issues/issues.jsonl`

**Handoff to**: `team-planex`

```bash
workflow roadmap-with-file -m progressive
```

---

## Session Commands

### workflow session start

**Purpose**: Discover existing sessions or start new workflow session

**Flags**:
- `--type <workflow|review|tdd|test|docs>` - Session type
- `--auto|--new` - Auto-discover or force new

**Calls first**: `workflow init`

```bash
workflow session start --type tdd
```

### workflow session resume

**Purpose**: Resume the most recently paused workflow session

```bash
workflow session resume
```

### workflow session list

**Purpose**: List all workflow sessions with status filtering

```bash
workflow session list
```

### workflow session sync

**Purpose**: Quick-sync session work to specs/*.md and project-tech

**Flags**:
- `-y, --yes` - Skip confirmation

**Updates**: `.workflow/specs/*.md`, `.workflow/project-tech.json`

```bash
workflow session sync -y
```

### workflow session solidify

**Purpose**: Crystallize session learnings into permanent project guidelines

**Flags**:
- `-y, --yes` - Skip confirmation
- `--type <convention|constraint|learning|compress>` - Solidification type
- `--category <category>` - Category for guidelines
- `--limit <N>` - Limit for compress mode

```bash
workflow session solidify --type learning
```

### workflow session complete

**Purpose**: Mark active workflow session as complete

**Description**: Archives with lessons learned, auto-calls sync.

**Flags**:
- `-y, --yes` - Skip confirmation
- `--detailed` - Detailed completion report

**Auto-calls**: `workflow session sync -y`

```bash
workflow session complete --detailed
```

---

## Analysis Commands

### workflow integration-test-cycle

**Purpose**: Self-iterating integration test workflow

**Description**: Autonomous test-fix cycles with reflection-driven adjustment.

**Flags**:
- `-y, --yes` - Skip confirmation
- `-c, --continue` - Continue previous session
- `--max-iterations=N` - Maximum iterations

**Output**: `.workflow/.integration-test/{session-id}/reflection-log.md`

```bash
workflow integration-test-cycle --max-iterations=5
```

### workflow refactor-cycle

**Purpose**: Tech debt discovery and self-iterating refactoring

**Flags**:
- `-y, --yes` - Skip confirmation
- `-c, --continue` - Continue previous session
- `--scope=module|project` - Refactoring scope

**Output**: `.workflow/.refactor/{session-id}/reflection-log.md`

```bash
workflow refactor-cycle --scope project
```

---

## Planning Commands

### workflow req-plan-with-file

**Purpose**: Requirement-level progressive roadmap planning with issue creation

**Description**: Decomposes requirements into convergent layers or task sequences.

```bash
workflow req-plan-with-file
```

---

## Execution Commands

### workflow execute

**Purpose**: Coordinate agent execution for workflow tasks

**Description**: Automatic session discovery, parallel task processing, and status tracking.

**Triggers**: `workflow-execute`

```bash
workflow execute
```

---

## UI Design Commands

### workflow ui-design style-extract

**Purpose**: Extract design style from reference images or text prompts

**Flags**:
- `-y, --yes` - Skip confirmation
- `--design-id <id>` - Design identifier
- `--session <id>` - Session identifier
- `--images <glob>` - Image file pattern
- `--prompt <desc>` - Text description
- `--variants <count>` - Number of variants
- `--interactive` - Interactive mode
- `--refine` - Refinement mode

**Modes**: Exploration, Refinement

**Output**: `style-extraction/style-{id}/design-tokens.json`

```bash
workflow ui-design style-extract --images "design/*.png" --variants 3
```

### workflow ui-design layout-extract

**Purpose**: Extract structural layout from reference images or text prompts

**Flags**:
- `-y, --yes` - Skip confirmation
- `--design-id <id>` - Design identifier
- `--session <id>` - Session identifier
- `--images <glob>` - Image file pattern
- `--prompt <desc>` - Text description
- `--targets <list>` - Target components
- `--variants <count>` - Number of variants
- `--device-type <desktop|mobile|tablet|responsive>` - Device type
- `--interactive` - Interactive mode
- `--refine` - Refinement mode

**Delegates to**: `ui-design-agent`

**Output**: `layout-extraction/layout-*.json`

```bash
workflow ui-design layout-extract --prompt "dashboard layout" --device-type responsive
```

### workflow ui-design generate

**Purpose**: Assemble UI prototypes by combining layout templates with design tokens

**Flags**:
- `--design-id <id>` - Design identifier
- `--session <id>` - Session identifier

**Delegates to**: `ui-design-agent`

**Prerequisites**: `workflow ui-design style-extract`, `workflow ui-design layout-extract`

```bash
workflow ui-design generate --design-id dashboard-001
```

### workflow ui-design animation-extract

**Purpose**: Extract animation and transition patterns

**Flags**:
- `-y, --yes` - Skip confirmation
- `--design-id <id>` - Design identifier
- `--session <id>` - Session identifier
- `--images <glob>` - Image file pattern
- `--focus <types>` - Animation types
- `--interactive` - Interactive mode
- `--refine` - Refinement mode

**Delegates to**: `ui-design-agent`

**Output**: `animation-extraction/animation-tokens.json`

```bash
workflow ui-design animation-extract --focus "transition,keyframe"
```

### workflow ui-design import-from-code

**Purpose**: Import design system from code files

**Description**: Automatic file discovery for CSS/JS/HTML/SCSS.

**Flags**:
- `--design-id <id>` - Design identifier
- `--session <id>` - Session identifier
- `--source <path>` - Source path

**Delegates to**: Style Agent, Animation Agent, Layout Agent

**Output**: `style-extraction`, `animation-extraction`, `layout-extraction`

```bash
workflow ui-design import-from-code --source src/styles
```

### workflow ui-design codify-style

**Purpose**: Extract styles from code and generate shareable reference package

**Flags**:
- `--package-name <name>` - Package name
- `--output-dir <path>` - Output directory
- `--overwrite` - Overwrite existing

**Orchestrates**: `workflow ui-design import-from-code`, `workflow ui-design reference-page-generator`

**Output**: `.workflow/reference_style/{package-name}/`

```bash
workflow ui-design codify-style --package-name my-design-system
```

### workflow ui-design reference-page-generator

**Purpose**: Generate multi-component reference pages from design run extraction

**Flags**:
- `--design-run <path>` - Design run path
- `--package-name <name>` - Package name
- `--output-dir <path>` - Output directory

**Output**: `.workflow/reference_style/{package-name}/preview.html`

```bash
workflow ui-design reference-page-generator --design-run .workflow/design-run-001
```

### workflow ui-design design-sync

**Purpose**: Synchronize finalized design system references to brainstorming artifacts

**Flags**:
- `--session <session_id>` - Session identifier
- `--selected-prototypes <list>` - Selected prototypes

**Updates**: Role analysis documents, context-package.json

```bash
workflow ui-design design-sync --session design-001
```

### workflow ui-design explore-auto

**Purpose**: Interactive exploratory UI design with style-centric batch generation

**Flags**:
- `--input <value>` - Input source
- `--targets <list>` - Target components
- `--target-type <page|component>` - Target type
- `--session <id>` - Session identifier
- `--style-variants <count>` - Style variants
- `--layout-variants <count>` - Layout variants

**Orchestrates**: `import-from-code`, `style-extract`, `animation-extract`, `layout-extract`, `generate`

```bash
workflow ui-design explore-auto --input "dashboard" --style-variants 3
```

### workflow ui-design imitate-auto

**Purpose**: UI design workflow with direct code/image input

**Flags**:
- `--input <value>` - Input source
- `--session <id>` - Session identifier

**Orchestrates**: Same as explore-auto

```bash
workflow ui-design imitate-auto --input ./reference.png
```

---

## Issue Commands

### issue new

**Purpose**: Create structured issue from GitHub URL or text description

**Flags**:
- `-y, --yes` - Skip confirmation
- `--priority 1-5` - Issue priority

**Features**: Clarity detection

**Output**: `.workflow/issues/issues.jsonl`

```bash
issue new --priority 3
```

### issue discover

**Purpose**: Discover potential issues from multiple perspectives

**Flags**:
- `-y, --yes` - Skip confirmation
- `--perspectives=bug,ux,...` - Analysis perspectives
- `--external` - Include external research

**Perspectives**: bug, ux, test, quality, security, performance, maintainability, best-practices

**Delegates to**: `cli-explore-agent`

**Output**: `.workflow/issues/discoveries/{discovery-id}/`

```bash
issue discover --perspectives=bug,security,performance
```

### issue discover-by-prompt

**Purpose**: Discover issues from user prompt with Gemini-planned exploration

**Flags**:
- `-y, --yes` - Skip confirmation
- `--scope=src/**` - File scope
- `--depth=standard|deep` - Analysis depth
- `--max-iterations=5` - Maximum iterations

**Delegates to**: `Gemini CLI`, `ACE search`, `multi-agent exploration`

```bash
issue discover-by-prompt --depth deep --scope "src/auth/**"
```

### issue plan

**Purpose**: Batch plan issue resolution using issue-plan-agent

**Flags**:
- `-y, --yes` - Skip confirmation
- `--all-pending` - Plan all pending issues
- `--batch-size 3` - Batch size

**Delegates to**: `issue-plan-agent`

**Output**: `.workflow/issues/solutions/{issue-id}.jsonl`

```bash
issue plan --all-pending --batch-size 5
```

### issue queue

**Purpose**: Form execution queue from bound solutions

**Flags**:
- `-y, --yes` - Skip confirmation
- `--queues <n>` - Number of queues
- `--issue <id>` - Specific issue

**Delegates to**: `issue-queue-agent`

**Output**: `.workflow/issues/queues/QUE-xxx.json`

```bash
issue queue --queues 2
```

### issue execute

**Purpose**: Execute queue with DAG-based parallel orchestration

**Flags**:
- `-y, --yes` - Skip confirmation
- `--queue <queue-id>` - Queue identifier
- `--worktree [<path>]` - Use worktree isolation

**Executors**: Codex (recommended), Gemini, Agent

```bash
issue execute --queue QUE-001 --worktree
```

### issue convert-to-plan

**Purpose**: Convert planning artifacts to issue solutions

**Flags**:
- `-y, --yes` - Skip confirmation
- `--issue <id>` - Issue identifier
- `--supplement` - Supplement existing solution

**Sources**: lite-plan, workflow-session, markdown, json

```bash
issue convert-to-plan --issue 123 --supplement
```

### issue from-brainstorm

**Purpose**: Convert brainstorm session ideas into issue with executable solution

**Flags**:
- `-y, --yes` - Skip confirmation
- `--idea=<index>` - Idea index
- `--auto` - Auto-select best idea

**Input Sources**: `synthesis.json`, `perspectives.json`, `.brainstorming/**`

**Output**: `issues.jsonl`, `solutions/{issue-id}.jsonl`

```bash
issue from-brainstorm --auto
```

---

## Memory Commands

### memory prepare

**Purpose**: Delegate to universal-executor agent for project analysis

**Description**: Returns JSON core content package for memory loading.

**Flags**:
- `--tool gemini|qwen` - AI tool selection

**Delegates to**: `universal-executor agent`

```bash
memory prepare --tool gemini
```

### memory style-skill-memory

**Purpose**: Generate SKILL memory package from style reference

**Flags**:
- `--regenerate` - Force regeneration

**Input**: `.workflow/reference_style/{package-name}/`

**Output**: `.claude/skills/style-{package-name}/SKILL.md`

```bash
memory style-skill-memory --regenerate
```

---

## CLI Commands

### cli init

**Purpose**: Generate .gemini/ and .qwen/ config directories

**Description**: Creates settings.json and ignore files based on workspace technology detection.

**Flags**:
- `--tool gemini|qwen|all` - Tool selection
- `--output path` - Output path
- `--preview` - Preview without writing

**Output**: `.gemini/`, `.qwen/`, `.geminiignore`, `.qwenignore`

```bash
cli init --tool all --preview
```

### cli codex-review

**Purpose**: Interactive code review using Codex CLI

**Flags**:
- `--uncommitted` - Review uncommitted changes
- `--base <branch>` - Compare to branch
- `--commit <sha>` - Review specific commit
- `--model <model>` - Model selection
- `--title <title>` - Review title

```bash
cli codex-review --base main --title "Security Review"
```

---

## Workflow Chains

Pre-defined command combinations for common development scenarios:

### 1. Project Initialization Chain

**Purpose**: Initialize project state and guidelines

```bash
workflow init
workflow init-specs --scope project
workflow init-guidelines
```

**Output**: `.workflow/project-tech.json`, `.workflow/specs/*.md`

---

### 2. Session Lifecycle Chain

**Purpose**: Complete session management workflow

```bash
workflow session start --type workflow
# ... work on tasks ...
workflow session sync -y
workflow session solidify --type learning
workflow session complete --detailed
```

---

### 3. Issue Workflow Chain

**Purpose**: Full issue discovery to execution cycle

```bash
issue discover --perspectives=bug,security
issue plan --all-pending
issue queue --queues 2
issue execute --queue QUE-001
```

---

### 4. Brainstorm to Issue Chain

**Purpose**: Convert brainstorm to executable issue

```bash
workflow brainstorm-with-file -m creative
issue from-brainstorm --auto
issue queue
issue execute
```

---

### 5. UI Design Full Cycle

**Purpose**: Complete UI design workflow

```bash
workflow ui-design style-extract --images "design/*.png"
workflow ui-design layout-extract --images "design/*.png"
workflow ui-design generate --design-id main-001
```

---

### 6. UI Design from Code Chain

**Purpose**: Extract design system from existing code

```bash
workflow ui-design import-from-code --source src/styles
workflow ui-design reference-page-generator --design-run .workflow/style-extraction
```

---

### 7. Roadmap to Team Execution Chain

**Purpose**: Strategic planning to team execution

```bash
workflow roadmap-with-file -m progressive
# Handoff to team-planex skill
```

---

## Command Dependencies

Some commands have prerequisites or call other commands:

| Command | Depends On |
|---------|------------|
| `workflow session start` | `workflow init` |
| `workflow session complete` | `workflow session sync` |
| `workflow ui-design generate` | `style-extract`, `layout-extract` |
| `workflow ui-design codify-style` | `import-from-code`, `reference-page-generator` |
| `issue from-brainstorm` | `workflow brainstorm-with-file` |
| `issue queue` | `issue plan` |
| `issue execute` | `issue queue` |
| `memory style-skill-memory` | `workflow ui-design codify-style` |

---

## Agent Delegations

Commands delegate work to specialized agents:

| Agent | Commands |
|-------|----------|
| `cli-explore-agent` | `workflow init`, `workflow clean`, `workflow brainstorm-with-file`, `workflow analyze-with-file`, `issue discover` |
| `universal-executor` | `memory prepare` |
| `issue-plan-agent` | `issue plan` |
| `issue-queue-agent` | `issue queue` |
| `ui-design-agent` | `workflow ui-design layout-extract`, `generate`, `animation-extract` |

::: info See Also
- [CLI Tools Configuration](../guide/cli-tools.md) - Configure CLI tools
- [Skills Library](../skills/core-skills.md) - Built-in skills
- [Agents](../agents/builtin.md) - Specialized agents
:::
