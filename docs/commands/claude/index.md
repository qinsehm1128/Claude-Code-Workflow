# Claude Commands

## One-Liner

**Claude Commands is the core command system of Claude Code Workflow** — invoking various workflows, tools, and collaboration features through slash commands.

## Core Concepts

| Category | Command Count | Description |
|----------|---------------|-------------|
| **Core Orchestration** | 2 | Main workflow orchestrators (ccw, ccw-coordinator) |
| **Workflow** | 20+ | Planning, execution, review, TDD, testing workflows |
| **Session Management** | 6 | Session creation, listing, resuming, completion |
| **Issue Workflow** | 8 | Issue discovery, planning, queue, execution |
| **IDAW** | 5 | Batch autonomous task execution with git checkpoints |
| **Memory** | 8 | Memory capture, update, document generation |
| **CLI Tools** | 2 | CLI initialization, Codex review |
| **UI Design** | 10 | UI design prototype generation, style extraction |

## Command Categories

### 1. Core Orchestration Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/ccw`](./core-orchestration.md#ccw) | Main workflow orchestrator - intent analysis -> workflow selection -> command chain execution | Intermediate |
| [`/ccw-coordinator`](./core-orchestration.md#ccw-coordinator) | Command orchestration tool - chained command execution and state persistence | Intermediate |

### 2. Workflow Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/workflow-lite-plan`](./workflow.md#lite-plan) | Lightweight interactive planning workflow | Intermediate |
| [`/workflow-plan`](./workflow.md#plan) | 5-phase planning workflow | Intermediate |
| [`/workflow-execute`](./workflow.md#execute) | Coordinate agent execution of workflow tasks | Intermediate |
| [`/workflow:replan`](./workflow.md#replan) | Interactive workflow replanning | Intermediate |
| [`/workflow-multi-cli-plan`](./workflow.md#multi-cli-plan) | Multi-CLI collaborative planning | Intermediate |
| [`/workflow:review`](./workflow.md#review) | Post-implementation review | Intermediate |
| [`/workflow:clean`](./workflow.md#clean) | Smart code cleanup | Intermediate |
| [`/workflow:init`](./workflow.md#init) | Initialize project state | Intermediate |
| [`/workflow:brainstorm-with-file`](./workflow.md#brainstorm-with-file) | Interactive brainstorming | Intermediate |
| [`/workflow:analyze-with-file`](./workflow.md#analyze-with-file) | Interactive collaborative analysis | Beginner |
| [`/workflow:debug-with-file`](./workflow.md#debug-with-file) | Interactive hypothesis-driven debugging | Intermediate |
| [`/workflow:unified-execute-with-file`](./workflow.md#unified-execute-with-file) | Universal execution engine | Intermediate |

### 3. Session Management Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/workflow:session:start`](./session.md#start) | Discover existing sessions or start new workflow session | Intermediate |
| [`/workflow:session:list`](./session.md#list) | List all workflow sessions | Beginner |
| [`/workflow:session:resume`](./session.md#resume) | Resume most recently paused workflow session | Intermediate |
| [`/workflow:session:sync`](./session.md#sync) | Quick-sync session work to specs and project-tech | Intermediate |
| [`/workflow:session:complete`](./session.md#complete) | Mark active workflow session as completed | Intermediate |
| [`/workflow:session:solidify`](./session.md#solidify) | Crystallize session learnings into project guidelines | Intermediate |

### 4. Issue Workflow Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/issue:new`](./issue.md#new) | Create structured issue from GitHub URL or text description | Intermediate |
| [`/issue:discover`](./issue.md#discover) | Discover potential issues from multiple perspectives | Intermediate |
| [`/issue:discover-by-prompt`](./issue.md#discover-by-prompt) | Discover issues via user prompt | Intermediate |
| [`/issue:from-brainstorm`](./issue.md#from-brainstorm) | Convert brainstorm session ideas into issue with executable solution | Intermediate |
| [`/issue:plan`](./issue.md#plan) | Batch plan issue solutions | Intermediate |
| [`/issue:queue`](./issue.md#queue) | Form execution queue | Intermediate |
| [`/issue:execute`](./issue.md#execute) | Execute queue | Intermediate |
| [`/issue:convert-to-plan`](./issue.md#convert-to-plan) | Convert planning artifact to issue solution | Intermediate |

### 5. IDAW Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/idaw:add`](./idaw.md#add) | Create tasks manually or import from ccw issue | Beginner |
| [`/idaw:run`](./idaw.md#run) | Execute task queue with skill chains and git checkpoints | Intermediate |
| [`/idaw:run-coordinate`](./idaw.md#run-coordinate) | Execute via external CLI with hook callbacks | Intermediate |
| [`/idaw:status`](./idaw.md#status) | View task and session progress | Beginner |
| [`/idaw:resume`](./idaw.md#resume) | Resume interrupted session from last checkpoint | Intermediate |

### 6. Memory Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/memory:compact`](./memory.md#compact) | Compress current session memory to structured text | Intermediate |
| [`/memory:tips`](./memory.md#tips) | Quick note-taking | Beginner |
| [`/memory:prepare`](./memory.md#prepare) | Load task context via CLI project analysis | Intermediate |
| [`/memory:update-full`](./memory.md#update-full) | Update all CLAUDE.md files | Intermediate |
| [`/memory:update-related`](./memory.md#update-related) | Update CLAUDE.md for git-changed modules | Intermediate |
| [`/memory:docs-full-cli`](./memory.md#docs-full-cli) | Generate full project documentation using CLI | Intermediate |
| [`/memory:docs-related-cli`](./memory.md#docs-related-cli) | Generate documentation for git-changed modules | Intermediate |
| [`/memory:style-skill-memory`](./memory.md#style-skill-memory) | Generate SKILL memory package from style reference | Intermediate |

### 7. CLI Tool Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/cli:cli-init`](./cli.md#cli-init) | Generate configuration directory and settings files | Intermediate |
| [`/cli:codex-review`](./cli.md#codex-review) | Interactive code review using Codex CLI | Intermediate |

### 8. UI Design Commands

| Command | Function | Difficulty |
|---------|----------|------------|
| [`/workflow:ui-design:explore-auto`](./ui-design.md#explore-auto) | Interactive exploratory UI design workflow | Intermediate |
| [`/workflow:ui-design:imitate-auto`](./ui-design.md#imitate-auto) | Direct code/image input UI design | Intermediate |
| [`/workflow:ui-design:style-extract`](./ui-design.md#style-extract) | Extract design styles from reference images or prompts | Intermediate |
| [`/workflow:ui-design:layout-extract`](./ui-design.md#layout-extract) | Extract layout information from reference images | Intermediate |
| [`/workflow:ui-design:animation-extract`](./ui-design.md#animation-extract) | Extract animation and transition patterns | Intermediate |
| [`/workflow:ui-design:codify-style`](./ui-design.md#codify-style) | Extract styles from code and generate shareable reference package | Intermediate |
| [`/workflow:ui-design:generate`](./ui-design.md#generate) | Combine layout templates with design tokens to generate prototypes | Intermediate |

## Auto Mode

Most commands support the `--yes` or `-y` flag to enable auto mode and skip confirmation steps.

```bash
# Standard mode - requires confirmation
/ccw "implement user authentication"

# Auto mode - execute directly without confirmation
/ccw "implement user authentication" --yes
```

## Usage Examples

### Quick Analysis

```bash
# Analyze codebase structure
/ccw "Analyze the authentication module architecture"

# Quick bug diagnosis
/ccw "Diagnose why the login timeout issue occurs"
```

### Planning & Implementation

```bash
# Create implementation plan
/workflow-plan "Add OAuth2 authentication with Google and GitHub providers"

# Execute with auto mode
/workflow-execute --yes
```

### Code Review

```bash
# Review current changes
/cli:codex-review

# Focus on specific area
/cli:codex-review "Focus on security vulnerabilities in auth module"
```

### Session Management

```bash
# List all sessions
/workflow:session:list

# Resume a paused session
/workflow:session:resume "WFS-001"

# Mark session as complete
/workflow:session:complete "WFS-001"
```

### Issue Workflow

```bash
# Discover issues from codebase
/issue:discover

# Create plan for specific issue
/issue:plan "ISSUE-001"

# Execute the fix
/issue:execute --commit
```

### Memory Management

```bash
# Capture current session learnings
/memory:capture "Key insights from authentication refactoring"

# List all memories
/memory:list

# Search memories
/memory:search "authentication patterns"
```

### CLI Tool Invocation

```bash
# Initialize CLI configuration
/cli:cli-init

# Run Gemini analysis
ccw cli -p "Analyze code patterns in src/auth" --tool gemini --mode analysis

# Run with specific rule template
ccw cli -p "Review code quality" --tool gemini --mode analysis --rule analysis-review-code-quality
```

### UI Design Workflow

```bash
# Extract styles from reference image
/workflow:ui-design:style-extract --input "path/to/reference.png"

# Generate prototype
/workflow:ui-design:generate --layout "dashboard" --tokens "design-tokens.json"
```

## Tips

1. **Use Auto Mode Sparingly**: Only use `--yes` or `-y` for routine tasks. Keep manual confirmation for complex decisions.

2. **Session Persistence**: Always complete sessions with `/workflow:session:complete` to preserve learnings.

3. **Memory Capture**: Regularly capture important insights with `/memory:capture` to build project knowledge.

4. **CLI Tool Selection**: Let `/ccw` auto-select the appropriate tool, or explicitly specify with `--tool gemini|qwen|codex`.

## Related Documentation

- [Skills Reference](../../skills/)
- [CLI Invocation System](../../features/cli.md)
- [Workflow Guide](../../guide/ch04-workflow-basics.md)
