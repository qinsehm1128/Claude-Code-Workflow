
# Claude Code Workflow (CCW) - Command Specification

**Version**: 7.0.6
**Updated**: 2026-02-28

## 1. Introduction

This document provides a detailed technical specification for every command available in the Claude Code Workflow (CCW) system. It is intended for advanced users and developers who wish to understand the inner workings of CCW, customize commands, or build new workflows.

> **Version 6.2.0 Changes**: Native CodexLens replaces Code Index MCP (FTS + Semantic + HNSW), CLI refactored to `ccw cli -p`, session clustering replaces knowledge graph, new Dashboard views (CLAUDE.md Manager, Skills Manager, Graph Explorer, Core Memory), TypeScript backend migration.

For a user-friendly overview, please see [COMMAND_REFERENCE.md](COMMAND_REFERENCE.md).

## 2. Command Categories

Commands are organized into the following categories:

- **Workflow Commands**: High-level orchestration for multi-phase development processes.
- **CLI Commands**: Direct access to AI tools for analysis and interaction.
- **Task Commands**: Management of individual work units within a workflow.
- **Memory Commands**: Context and documentation management.
- **UI Design Commands**: Specialized workflow for UI/UX design and prototyping.
- **Testing Commands**: TDD and test generation workflows.

---

## 3. Workflow Commands

High-level orchestrators for complex, multi-phase development processes.

### **/workflow-plan**

- **Syntax**: `/workflow-plan [--agent] [--cli-execute] "text description"|file.md`
- **Parameters**:
  - `--agent` (Optional, Flag): Use the `task-generate-agent` for autonomous task generation.
  - `--cli-execute` (Optional, Flag): Generate tasks with commands ready for CLI execution (e.g., using Codex).
  - `description|file.md` (Required, String): A description of the planning goal or a path to a markdown file containing the requirements.
- **Responsibilities**: Orchestrates a 5-phase planning workflow that includes session start, context gathering, intelligent analysis, concept clarification (quality gate), and task generation.
- **Agent Calls**: Delegates analysis to `@cli-execution-agent` and task generation to `@action-planning-agent`.
- **Skill Invocation**: Does not directly invoke a skill, but the underlying agents may.
- **Integration**: This is a primary entry point for starting a development workflow. It is followed by `/workflow-execute`.
- **Example**:
  ```bash
  /workflow-plan "Create a simple Express API that returns Hello World"
  ```

### **/workflow-lite-plan** ⚡ NEW

- **Syntax**: `/workflow-lite-plan [--tool claude|gemini|qwen|codex] [-e|--explore] "task description"|file.md`
- **Parameters**:
  - `--tool` (Optional, String): Preset CLI tool for execution (claude|gemini|qwen|codex). If not provided, user selects during confirmation.
  - `-e, --explore` (Optional, Flag): Force code exploration phase (overrides auto-detection logic).
  - `task description|file.md` (Required, String): Task description or path to .md file.
- **Responsibilities**: Lightweight interactive planning and execution workflow with 5 phases:
  1. **Task Analysis & Exploration**: Auto-detects need for codebase context, optionally launches `@cli-explore-agent` (30-90s)
  2. **Clarification**: Interactive Q&A based on exploration findings (user-dependent)
  3. **Planning**: Adaptive planning strategy - direct (Low complexity) or delegate to `@cli-planning-agent` (Medium/High complexity) (20-60s)
  4. **Three-Dimensional Confirmation**: Multi-select interaction for task approval + execution method + code review tool (user-dependent)
  5. **Execution & Tracking**: Live TodoWrite progress updates with selected method (5-120min)
- **Key Features**:
  - **Smart Code Exploration**: Auto-detects when codebase context is needed (use `-e` to force)
  - **In-Memory Planning**: No file artifacts generated during planning phase
  - **Three-Dimensional Multi-Select**: Task approval (Allow/Modify/Cancel) + Execution method (Agent/Provide Plan/CLI) + Code review (No/Claude/Gemini/Qwen/Codex)
  - **Parallel Task Execution**: Identifies independent tasks for concurrent execution
  - **Flexible Execution**: Choose between Agent (@code-developer) or CLI (Gemini/Qwen/Codex)
  - **Optional Post-Review**: Built-in code quality analysis with user-selectable AI tool
- **Agent Calls**:
  - `@cli-explore-agent` (conditional, Phase 1)
  - `@cli-planning-agent` (conditional, Phase 3 for Medium/High complexity)
  - `@code-developer` (conditional, Phase 5 if Agent execution selected)
- **Skill Invocation**: None directly, but agents may invoke skills.
- **Integration**: Standalone workflow for quick tasks. Alternative to `/workflow-plan` + `/workflow-execute` pattern.
- **Example**:
  ```bash
  # Basic usage with auto-detection
  /workflow-lite-plan "Add JWT authentication to user login"

  # Force code exploration
  /workflow-lite-plan -e "Refactor logging module for better performance"

  # Basic usage
  /workflow-lite-plan "Add unit tests for auth service"
  ```

### **/workflow-execute**

- **Syntax**: `/workflow-execute [--resume-session="session-id"]`
- **Parameters**:
  - `--resume-session` (Optional, String): The ID of a paused session to resume.
- **Responsibilities**: Discovers and executes all pending tasks in the active (or specified) workflow session. It handles dependency resolution and orchestrates agents to perform the work.
- **Agent Calls**: Dynamically calls the agent specified in each task's `meta.agent` field (e.g., `@code-developer`, `@test-fix-agent`).
- **Integration**: The primary command for implementing a plan generated by `/workflow-plan`.
- **Example**:
  ```bash
  # Execute tasks in the currently active session
  /workflow-execute
  ```

### **/workflow:resume**

- **Syntax**: `/workflow:resume "session-id"`
- **Parameters**:
  - `session-id` (Required, String): The ID of the workflow session to resume.
- **Responsibilities**: A two-phase orchestrator that first analyzes the status of a paused session and then resumes it by calling `/workflow-execute --resume-session`.
- **Agent Calls**: None directly. It orchestrates `/workflow:status` and `/workflow-execute`.
- **Integration**: Used to continue a previously paused or interrupted workflow.
- **Example**:
  ```bash
  /workflow:resume "WFS-user-login-feature"
  ```

### **/workflow:review**

- **Syntax**: `/workflow:review [--type=security|architecture|action-items|quality] [session-id]`
- **Parameters**:
  - `--type` (Optional, String): The type of review to perform. Defaults to `quality`.
  - `session-id` (Optional, String): The session to review. Defaults to the active session.
- **Responsibilities**: Performs a specialized, post-implementation review. This is optional, as the default quality gate is passing tests.
- **Agent Calls**: Uses `gemini` or `qwen-wrapper` for analysis based on the review type.
- **Integration**: Used after `/workflow-execute` to perform audits before deployment.
- **Example**:
  ```bash
  /workflow:review --type=security
  ```

### **/workflow:status**

- **Syntax**: `/workflow:status [task-id]`
- **Parameters**:
  - `task-id` (Optional, String): If provided, shows details for a specific task.
- **Responsibilities**: Generates and displays an on-demand view of the current workflow's status by reading task JSON data. Does not modify any state.
- **Agent Calls**: None.
- **Integration**: A read-only command used to check progress at any point.
- **Example**:
  ```bash
  /workflow:status
  ```

---

## 4. Session Management Commands

Commands for creating, listing, and managing workflow sessions.

### **/workflow:session:start**
- **Syntax**: `/workflow:session:start [--auto|--new] [description]`
- **Parameters**:
  - `--auto` (Flag): Intelligently reuses an active session if relevant, otherwise creates a new one.
  - `--new` (Flag): Forces the creation of a new session.
  - `description` (Optional, String): A description for the new session's goal.
- **Responsibilities**: Manages session creation and activation. It can discover existing sessions, create new ones, and set the active session marker.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /workflow:session:start "My New Feature"
  ```

### **/workflow:session:list**
- **Syntax**: `/workflow:session:list`
- **Parameters**: None.
- **Responsibilities**: Lists all workflow sessions found in the `.workflow/` directory, showing their status (active, paused, completed).
- **Agent Calls**: None.
- **Example**:
  ```bash
  /workflow:session:list
  ```

### **/workflow:session:resume**
- **Syntax**: `/workflow:session:resume`
- **Parameters**: None.
- **Responsibilities**: Finds the most recently paused session and marks it as active.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /workflow:session:resume
  ```

### **/workflow:session:complete**
- **Syntax**: `/workflow:session:complete [--detailed]`
- **Parameters**:
  - `--detailed` (Flag): Shows a more detailed completion summary.
- **Responsibilities**: Marks the currently active session as "completed", records timestamps, and moves the session from `.workflow/active/` to `.workflow/archives/`.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /workflow:session:complete
  ```

---

## 5. CLI Commands

CLI tool configuration commands.

### **/cli:cli-init**
- **Syntax**: `/cli:cli-init [--tool gemini|qwen|all] [--output path] [--preview]`
- **Responsibilities**: Initializes configuration for CLI tools (`.gemini/`, `.qwen/`) by analyzing the workspace and creating optimized `.geminiignore` and `.qwenignore` files.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /cli:cli-init
  ```

> **Note**: For analysis, planning, and bug fixing, use workflow commands (`/workflow-lite-plan`, `/workflow:debug-with-file`) or semantic invocation through natural language. Claude will automatically use appropriate CLI tools (Gemini/Qwen/Codex) with templates as needed.

---

## 6. Task Commands

Commands for managing individual tasks within a workflow session.

### **/task:create**
- **Syntax**: `/task:create "task title"`
- **Parameters**:
  - `title` (Required, String): The title of the task.
- **Responsibilities**: Creates a new task JSON file within the active session, auto-generating an ID and inheriting context.
- **Agent Calls**: Suggests an agent (e.g., `@code-developer`) based on task type but does not call it.
- **Example**:
  ```bash
  /task:create "Build authentication module"
  ```

### **/task:breakdown**
- **Syntax**: `/task:breakdown <task-id>`
- **Parameters**:
  - `task-id` (Required, String): The ID of the parent task to break down.
- **Responsibilities**: Manually decomposes a complex parent task into smaller, executable subtasks. Enforces a 10-task limit and file cohesion.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /task:breakdown IMPL-1
  ```

### **/task:execute**
- **Syntax**: `/task:execute <task-id>`
- **Parameters**:
  - `task-id` (Required, String): The ID of the task to execute.
- **Responsibilities**: Executes a single task or a parent task (by executing its subtasks) using the assigned agent.
- **Agent Calls**: Calls the agent specified in the task's `meta.agent` field.
- **Example**:
  ```bash
  /task:execute IMPL-1.1
  ```

### **/task:replan**
- **Syntax**: `/task:replan <task-id> ["text"|file.md] | --batch [report.md]`
- **Parameters**:
  - `task-id` (String): The ID of the task to replan.
  - `input` (String): Text or a file path with the new specifications.
  - `--batch` (Flag): Enables batch processing from a verification report.
- **Responsibilities**: Updates a task's specification, creating a versioned backup of the previous state.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /task:replan IMPL-1 "Add OAuth2 authentication support"
  ```

---

## 7. Memory and Versioning Commands

### **/memory:update-full**
- **Syntax**: `/memory:update-full [--tool gemini|qwen|codex] [--path <directory>]`
- **Responsibilities**: Orchestrates a complete, project-wide update of all `CLAUDE.md` documentation files.
- **Agent Calls**: None directly, but orchestrates CLI tools (`gemini`, etc.).
- **Example**:
  ```bash
  /memory:update-full
  ```

### **/memory:load**
- **Syntax**: `/memory:load [--tool gemini|qwen] "task context description"`
- **Parameters**:
  - `"task context description"` (Required, String): Task description to guide context extraction.
  - `--tool <gemini|qwen>` (Optional): Specify CLI tool for agent to use (default: gemini).
- **Responsibilities**: Delegates to `@general-purpose` agent to analyze the project and return a structured "Core Content Pack". This pack is loaded into the main thread's memory, providing essential context for subsequent operations.
- **Agent-Driven Execution**: Fully delegates to general-purpose agent which autonomously:
  1. Analyzes project structure and documentation
  2. Extracts keywords from task description
  3. Discovers relevant files using ripgrep/find search tools
  4. Executes Gemini/Qwen CLI for deep analysis
  5. Generates structured JSON content package
- **Core Philosophy**: Read-only analysis, token-efficient (CLI analysis in agent), structured output
- **Agent Calls**: `@general-purpose` agent.
- **Integration**: Provides quick, task-relevant context for subsequent agent operations while minimizing token consumption.
- **Example**:
  ```bash
  /memory:load "在当前前端基础上开发用户认证功能"
  /memory:load --tool qwen "重构支付模块API"
  ```

### **/memory:update-related**
- **Syntax**: `/memory:update-related [--tool gemini|qwen|codex]`
- **Responsibilities**: Performs a context-aware update of `CLAUDE.md` files for modules affected by recent git changes.
- **Agent Calls**: None directly, but orchestrates CLI tools.
- **Example**:
  ```bash
  /memory:update-related
  ```

### **/version**
- **Syntax**: `/version`
- **Parameters**: None.
- **Responsibilities**: Displays local and global installation versions and checks for updates from GitHub.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /version
  ```

### **/enhance-prompt**
- **Syntax**: `/enhance-prompt <user input>` or use `-e` flag in conversation
- **Responsibilities**: A system-level skill that enhances a user's prompt by adding context from session memory and codebase analysis. It is typically triggered by the `-e` flag in natural conversation.
- **Skill Invocation**: This is a core skill, invoked when `-e` is used in conversation.
- **Agent Calls**: None.
- **Example (in natural conversation)**:
  ```
  User: "fix the login button -e"
  → Prompt-enhancer expands and enhances the request
  ```

---

## 8. UI Design Commands

Specialized workflow for UI/UX design, from style extraction to prototype generation.

### **/workflow:ui-design:explore-auto**
- **Syntax**: `/workflow:ui-design:explore-auto [--prompt "..."] [--images "..."] [--targets "..."] ...`
- **Responsibilities**: Fully autonomous, multi-phase workflow that orchestrates style extraction, layout extraction, and prototype generation.
- **Agent Calls**: `@ui-design-agent`.
- **Example**:
  ```bash
  /workflow:ui-design:explore-auto --prompt "Modern blog: home, article, author"
  ```

### **/workflow:ui-design:imitate-auto**
- **Syntax**: `/workflow:ui-design:imitate-auto --input "<value>" [--session <id>]`
- **Responsibilities**: UI design workflow with direct code/image input for design token extraction and prototype generation. Accepts local code files, images (glob patterns), or text descriptions.
- **Agent Calls**: `@ui-design-agent`.
- **Example**:
  ```bash
  # Image reference
  /workflow:ui-design:imitate-auto --input "design-refs/*.png"

  # Code import
  /workflow:ui-design:imitate-auto --input "./src/components"

  # Text prompt
  /workflow:ui-design:imitate-auto --input "Modern minimalist design"
  ```

### **/workflow:ui-design:style-extract**
- **Syntax**: `/workflow:ui-design:style-extract [--images "<glob>"] [--prompt "<desc>"] [--variants <count>] ...`
- **Responsibilities**: Extracts design styles from images or text prompts and generates production-ready design systems (`design-tokens.json`, `style-guide.md`).
- **Agent Calls**: `@ui-design-agent`.
- **Example**:
  ```bash
  /workflow:ui-design:style-extract --images "design-refs/*.png" --variants 3
  ```

### **/workflow:ui-design:layout-extract**
- **Syntax**: `/workflow:ui-design:layout-extract [--images "<glob>"] [--prompt "<desc>"] [--targets "<list>"] ...`
- **Responsibilities**: Extracts structural layout information (HTML structure, CSS layout rules) from images or text prompts.
- **Agent Calls**: `@ui-design-agent`.
- **Example**:
  ```bash
  /workflow:ui-design:layout-extract --images "design-refs/*.png" --targets "home,dashboard"
  ```

### **/workflow:ui-design:generate**
- **Syntax**: `/workflow:ui-design:generate [--base-path <path>] ...`
- **Responsibilities**: A pure assembler that combines pre-extracted layout templates with design tokens to generate final UI prototypes.
- **Agent Calls**: `@ui-design-agent`.
- **Example**:
  ```bash
  /workflow:ui-design:generate --session WFS-design-run
  ```

### **/workflow:ui-design:design-sync**
- **Syntax**: `/workflow:ui-design:design-sync --session <session_id> [--selected-prototypes "<list>"]`
- **Responsibilities**: Synchronizes the finalized design system references into the core brainstorming artifacts (`role analysis documents`) to make them available for the planning phase.
- **Agent Calls**: None.
- **Example**:
  ```bash
  /workflow:ui-design:design-sync --session WFS-my-app
  ```

### **/workflow:ui-design:animation-extract**
- **Syntax**: `/workflow:ui-design:animation-extract [--urls "<list>"] [--mode <auto|interactive>] ...`
- **Responsibilities**: Extracts animation and transition patterns from URLs (auto mode) or through interactive questioning to generate animation tokens.
- **Agent Calls**: `@ui-design-agent` (for interactive mode).
- **Example**:
  ```bash
  /workflow:ui-design:animation-extract --urls "home:https://linear.app" --mode auto
  ```

---

## 9. Testing Commands

Workflows for Test-Driven Development (TDD) and post-implementation test generation.

### **/workflow-tdd-plan**
- **Syntax**: `/workflow-tdd-plan [--agent] "feature description"|file.md`
- **Responsibilities**: Orchestrates a 7-phase TDD planning workflow, creating tasks with Red-Green-Refactor cycles.
- **Agent Calls**: Orchestrates sub-commands which may call agents.
- **Example**:
  ```bash
  /workflow-tdd-plan "Implement a secure login endpoint"
  ```

### **/workflow-tdd-verify**
- **Syntax**: `/workflow-tdd-verify [session-id]`
- **Responsibilities**: Verifies TDD workflow compliance by analyzing task chains, test coverage, and cycle execution.
- **Agent Calls**: None directly, orchestrates `gemini`.
- **Example**:
  ```bash
  /workflow-tdd-verify WFS-login-tdd
  ```

### **/workflow:test-gen**
- **Syntax**: `/workflow:test-gen [--use-codex] [--cli-execute] <source-session-id>`
- **Responsibilities**: Creates an independent test-fix workflow by analyzing a completed implementation session.
- **Agent Calls**: Orchestrates sub-commands that call `@code-developer` and `@test-fix-agent`.
- **Example**:
  ```bash
  /workflow:test-gen WFS-user-auth-v2
  ```

### **/workflow-test-fix**
- **Syntax**: `/workflow-test-fix [--use-codex] [--cli-execute] (<source-session-id> | "description" | /path/to/file.md)`
- **Responsibilities**: Creates an independent test-fix workflow from either a completed session or a feature description.
- **Agent Calls**: Orchestrates sub-commands that call `@code-developer` and `@test-fix-agent`.
- **Example**:
  ```bash
  /workflow-test-fix "Test the user authentication API endpoints"
  ```

### **/workflow-test-fix**
- **Syntax**: `/workflow-test-fix [--resume-session="session-id"] [--max-iterations=N]`
- **Responsibilities**: Executes a test-fix workflow by delegating to `/workflow-execute`. Generates test tasks dynamically and creates intermediate fix tasks based on test results.
- **Agent Calls**: Delegates to `/workflow-execute` which invokes `@test-fix-agent` for task execution.
- **Note**: This command generates tasks; actual execution is performed by `/workflow-execute`.
- **Example**:
  ```bash
  /workflow-test-fix --resume-session="WFS-test-user-auth"
  ```
