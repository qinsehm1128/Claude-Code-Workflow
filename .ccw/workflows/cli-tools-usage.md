# CLI Tools Execution Specification

## Table of Contents
1. [Configuration Reference](#configuration-reference)
2. [Tool Selection](#tool-selection)
3. [Prompt Template](#prompt-template)
4. [CLI Execution](#cli-execution)
5. [Auto-Invoke Triggers](#auto-invoke-triggers)
6. [Best Practices](#best-practices)

---

## Configuration Reference

### Configuration File

**Path**: `~/.claude/cli-tools.json`

All tool availability, model selection, and routing are defined in this configuration file.

### Configuration Fields

| Field | Description |
|-------|-------------|
| `enabled` | Tool availability status |
| `primaryModel` | Default model for the tool |
| `secondaryModel` | Fallback model |
| `tags` | Capability tags for routing |

### Tool Types

| Type | Usage | Capabilities |
|------|-------|--------------|
| `builtin` | `--tool gemini` | Full (analysis + write tools) |
| `cli-wrapper` | `--tool doubao` | Full (analysis + write tools) |
| `api-endpoint` | `--tool g25` | **Analysis only** (no file write tools) |

> **Note**: `api-endpoint` tools only support analysis and code generation responses. They cannot create, modify, or delete files.

---

## Tool Selection

### Tag-Based Routing

Tools are selected based on **tags** defined in the configuration. Use tags to match task requirements to tool capabilities.

#### Common Tags

| Tag | Use Case |
|-----|----------|
| `analysis` | Code review, architecture analysis, exploration |
| `implementation` | Feature development, bug fixes |
| `documentation` | Doc generation, comments |
| `testing` | Test creation, coverage analysis |
| `refactoring` | Code restructuring |
| `security` | Security audits, vulnerability scanning |

### Selection Algorithm

```
1. Parse task intent → extract required capabilities
2. Load cli-tools.json → get enabled tools with tags
3. Match tags → filter tools supporting required capabilities
4. Select tool → choose by priority (explicit > tag-match > default)
5. Select model → use primaryModel, fallback to secondaryModel
```

### Selection Decision Tree

```
┌─ Explicit --tool specified?
│  └─→ YES: Use specified tool (validate enabled)
│
└─ NO: Tag-based selection
   ├─ Task requires tags?
   │  └─→ Match tools with matching tags
   │     └─→ Multiple matches? Use first enabled
   │
   └─ No tag match?
      └─→ Use default tool (first enabled in config)
```

### Command Structure

```bash
# Explicit tool selection
ccw cli -p "<PROMPT>" --tool <tool-id> --mode <analysis|write>

# Model override
ccw cli -p "<PROMPT>" --tool <tool-id> --model <model-id> --mode <analysis|write>

# Code review (codex only - review mode and target flags are invalid for other tools)
ccw cli -p "<PROMPT>" --tool codex --mode review
ccw cli --tool codex --mode review --commit <hash>

# Tag-based auto-selection (future)
ccw cli -p "<PROMPT>" --tags <tag1,tag2> --mode <analysis|write>
```

### Tool Fallback Chain

When primary tool fails or is unavailable:
1. Check `secondaryModel` for same tool
2. Try next enabled tool with matching tags
3. Fall back to default enabled tool

---

## Prompt Template

### Universal Prompt Template

```bash
ccw cli -p "PURPOSE: [what] + [why] + [success criteria] + [constraints/scope]
TASK: • [step 1: specific action] • [step 2: specific action] • [step 3: specific action]
MODE: [analysis|write]
CONTEXT: @[file patterns] | Memory: [session/tech/module context]
EXPECTED: [deliverable format] + [quality criteria] + [structure requirements]
CONSTRAINTS: [domain constraints]" --tool <tool-id> --mode <analysis|write> --rule <category-template>
```

### Intent Capture Checklist (Before CLI Execution)

**⚠️ CRITICAL**: Before executing any CLI command, verify these intent dimensions:

**Intent Validation Questions**:
- [ ] Is the objective specific and measurable?
- [ ] Are success criteria defined?
- [ ] Is the scope clearly bounded?
- [ ] Are constraints and limitations stated?
- [ ] Is the expected output format clear?
- [ ] Is the action level (read/write) explicit?

### Template Structure

Every command MUST include these fields:

- **PURPOSE**
  - Purpose: Goal + motivation + success
  - Components: What + Why + Success Criteria + Constraints
  - Bad Example: "Analyze code"
  - Good Example: "Identify security vulnerabilities in auth module to pass compliance audit; success = all OWASP Top 10 addressed; scope = src/auth/** only"

- **TASK**
  - Purpose: Actionable steps
  - Components: Specific verbs + targets
  - Bad Example: "• Review code • Find issues"
  - Good Example: "• Scan for SQL injection in query builders • Check XSS in template rendering • Verify CSRF token validation"

- **MODE**
  - Purpose: Permission level
  - Components: analysis / write / auto
  - Bad Example: (missing)
  - Good Example: "analysis" or "write"

- **CONTEXT**
  - Purpose: File scope + history
  - Components: File patterns + Memory
  - Bad Example: "@**/*"
  - Good Example: "@src/auth/**/*.ts @shared/utils/security.ts \| Memory: Previous auth refactoring (WFS-001)"

- **EXPECTED**
  - Purpose: Output specification
  - Components: Format + Quality + Structure
  - Bad Example: "Report"
  - Good Example: "Markdown report with: severity levels (Critical/High/Medium/Low), file:line references, remediation code snippets, priority ranking"

- **CONSTRAINTS**
  - Purpose: Domain-specific constraints
  - Components: Scope limits, special requirements, focus areas
  - Bad Example: (missing or too vague)
  - Good Example: "Focus on authentication | Ignore test files | No breaking changes"

### CONTEXT Configuration

**Format**: `CONTEXT: [file patterns] | Memory: [memory context]`

#### File Patterns

- **`@**/*`**: All files (default)
- **`@src/**/*.ts`**: TypeScript in src
- **`@../shared/**/*`**: Sibling directory (requires `--includeDirs`)
- **`@CLAUDE.md`**: Specific file

#### Memory Context

Include when building on previous work:

```bash
# Cross-task reference
Memory: Building on auth refactoring (commit abc123), implementing refresh tokens

# Cross-module integration
Memory: Integration with auth module, using shared error patterns from @shared/utils/errors.ts
```

**Memory Sources**:
- **Related Tasks**: Previous refactoring, extensions, conflict resolution
- **Tech Stack Patterns**: Framework conventions, security guidelines
- **Cross-Module References**: Integration points, shared utilities, type dependencies

#### Pattern Discovery Workflow

For complex requirements, discover files BEFORE CLI execution:

```bash
# Step 1: Discover files (choose one method)
# Method A: ACE semantic search (recommended)
mcp__ace-tool__search_context(project_root_path="/path", query="React components with export")

# Method B: Ripgrep pattern search
rg "export.*Component" --files-with-matches --type ts

# Step 2: Build CONTEXT
CONTEXT: @components/Auth.tsx @types/auth.d.ts | Memory: Previous type refactoring

# Step 3: Execute CLI
ccw cli -p "..." --tool <tool-id> --mode analysis --cd "src"
```

### --rule Configuration

**Use `--rule` option to auto-load templates**:

```bash
ccw cli -p "..." --tool gemini --mode analysis --rule analysis-review-architecture
```

### Mode Protocol References

**`--rule` auto-loads Protocol based on mode**:
- `--mode analysis` → analysis-protocol.md
- `--mode write` → write-protocol.md

**Protocol Mapping**:

- **`analysis`** mode
  - Permission: Read-only
  - Constraint: No file create/modify/delete

- **`write`** mode
  - Permission: Create/Modify/Delete files
  - Constraint: Full workflow execution

### Template System

**Available `--rule` template names**:

**Universal**:
- `universal-rigorous-style` - Precise tasks
- `universal-creative-style` - Exploratory tasks

**Analysis**:
- `analysis-trace-code-execution` - Execution tracing
- `analysis-diagnose-bug-root-cause` - Bug diagnosis
- `analysis-analyze-code-patterns` - Code patterns
- `analysis-analyze-technical-document` - Document analysis
- `analysis-review-architecture` - Architecture review
- `analysis-review-code-quality` - Code review
- `analysis-analyze-performance` - Performance analysis
- `analysis-assess-security-risks` - Security assessment

**Planning**:
- `planning-plan-architecture-design` - Architecture design
- `planning-breakdown-task-steps` - Task breakdown
- `planning-design-component-spec` - Component design
- `planning-plan-migration-strategy` - Migration strategy

**Development**:
- `development-implement-feature` - Feature implementation
- `development-refactor-codebase` - Code refactoring
- `development-generate-tests` - Test generation
- `development-implement-component-ui` - UI component
- `development-debug-runtime-issues` - Runtime debugging

---

## CLI Execution

### MODE Options

- **`analysis`**
  - Permission: Read-only
  - Use For: Code review, architecture analysis, pattern discovery, exploration
  - Specification: Safe for all tools

- **`write`**
  - Permission: Create/Modify/Delete
  - Use For: Feature implementation, bug fixes, documentation, code creation, file modifications
  - Specification: Requires explicit `--mode write`

- **`review`**
  - Permission: Read-only (code review output)
  - Use For: Git-aware code review of uncommitted changes, branch diffs, specific commits
  - Specification: **codex only** - uses `codex review` subcommand. Other tools MUST NOT use this mode
  - **Constraint**: Target flags (`--uncommitted`, `--base`, `--commit`) are **codex-only** and mutually exclusive with prompt
    - With prompt only: `ccw cli -p "Focus on security" --tool codex --mode review` (reviews uncommitted by default)
    - With target flag only: `ccw cli --tool codex --mode review --commit abc123` (no prompt allowed)

### Command Options

- **`--tool <tool>`**
  - Description: Tool from config (e.g., gemini, qwen, codex)
  - Default: First enabled tool in config

- **`--mode <mode>`**
  - Description: **REQUIRED**: analysis, write, review
  - Default: **NONE** (must specify)
  - Note: `review` mode is **codex-only**. Using `--mode review` with other tools (gemini/qwen/claude) is invalid and should be rejected

- **`--model <model>`**
  - Description: Model override
  - Default: Tool's primaryModel from config

- **`--cd "<path>"`**
  - Description: Working directory (quote if path contains spaces)
  - Default: current

- **`--includeDirs "<dirs>"`**
  - Description: Additional directories (comma-separated, quote if paths contain spaces)
  - Default: none

- **`--id <id>`**
  - Description: Execution ID (recommended, auto-generated if omitted)
  - Default: Auto-generated in format `{prefix}-{HHmmss}-{rand4}` (e.g., `gem-143022-x7k2`)
  - Prefix mapping: gemini→gem, qwen→qwn, codex→cdx, claude→cld, opencode→opc
  - Note: ID is always output to stderr as `[CCW_EXEC_ID=<id>]` for programmatic capture

- **`--resume [id]`**
  - Description: Resume previous session
  - Default: -

- **`--rule <template>`**
  - Description: Template name, auto-loads protocol + template appended to prompt
  - Default: universal-rigorous-style
  - Auto-selects protocol based on --mode

### Directory Configuration

#### Working Directory (`--cd`)

When using `--cd`:
- `@**/*` = Files within working directory tree only
- CANNOT reference parent/sibling via @ alone
- Must use `--includeDirs` for external directories

#### Include Directories (`--includeDirs`)

**TWO-STEP requirement for external files**:
1. Add `--includeDirs` parameter
2. Reference in CONTEXT with @ patterns

```bash
# Single directory
ccw cli -p "CONTEXT: @**/* @../shared/**/*" --tool <tool-id> --mode analysis --cd "src/auth" --includeDirs "../shared"

# Multiple directories
ccw cli -p "..." --tool <tool-id> --mode analysis --cd "src/auth" --includeDirs "../shared,../types,../utils"
```

**Rule**: If CONTEXT contains `@../dir/**/*`, MUST include `--includeDirs ../dir`

**Benefits**: Excludes unrelated directories, reduces token usage

### Session Resume

**When to Use**:
- Multi-round planning (analysis → planning → implementation)
- Multi-model collaboration (tool A → tool B on same topic)
- Topic continuity (building on previous findings)

**Usage**:

```bash
ccw cli -p "Continue analyzing" --tool <tool-id> --mode analysis --resume              # Resume last
ccw cli -p "Fix issues found" --tool <tool-id> --mode write --resume <id>              # Resume specific
ccw cli -p "Merge findings" --tool <tool-id> --mode analysis --resume <id1>,<id2>      # Merge multiple
```

- **`--resume`**: Last session
- **`--resume <id>`**: Specific session
- **`--resume <id1>,<id2>`**: Merge sessions (comma-separated)

**Context Assembly** (automatic):
```
=== PREVIOUS CONVERSATION ===
USER PROMPT: [Previous prompt]
ASSISTANT RESPONSE: [Previous output]
=== CONTINUATION ===
[Your new prompt]
```

### Subcommands

#### `show` — List All Executions

```bash
ccw cli show                     # Active + recent completed executions
ccw cli show --all               # Include full history
```

Displays a unified table of running and recent executions with: ID, Tool, Mode, Status, Duration, Prompt Preview.

#### `watch <id>` — Stream Execution Output

```bash
ccw cli watch <id>               # Stream until completion (output to stderr)
ccw cli watch <id> --timeout 120 # Auto-exit after 120 seconds
```

Behavior:
- Output written to **stderr** (does not pollute stdout)
- Exit code: 0 = success, 1 = error, 2 = timeout
- Callers can `ccw cli watch <id> 2>/dev/null` to silently wait

#### `output <id>` — Get Execution Output

```bash
ccw cli output <id>              # Final result only (default)
ccw cli output <id> --verbose    # Full metadata + raw output
ccw cli output <id> --raw        # Raw stdout (for piping)
```

Default returns `finalOutput > parsedOutput > stdout` — agent's final response text only.
`--verbose` shows full metadata (ID, turn, status, project) plus raw stdout/stderr.

#### ID Workflow Example

```bash
# Execute with auto-generated ID
ccw cli -p "analyze code" --tool gemini --mode analysis
# stderr outputs: [CCW_EXEC_ID=gem-143022-x7k2]

# Execute with custom ID
ccw cli -p "implement feature" --tool gemini --mode write --id my-task-1
# stderr outputs: [CCW_EXEC_ID=my-task-1]

# Check status
ccw cli show

# Watch running execution
ccw cli watch gem-143022-x7k2

# Get final result
ccw cli output gem-143022-x7k2

# Capture ID programmatically
EXEC_ID=$(ccw cli -p "test" --tool gemini --mode analysis 2>&1 | grep -oP 'CCW_EXEC_ID=\K[^\]]+')
ccw cli output $EXEC_ID
```

### Command Examples

#### Task-Type Specific Templates

**Analysis Task** (Security Audit):
```bash
ccw cli -p "PURPOSE: Identify OWASP Top 10 vulnerabilities in authentication module to pass security audit; success = all critical/high issues documented with remediation
TASK: • Scan for injection flaws (SQL, command, LDAP) • Check authentication bypass vectors • Evaluate session management • Assess sensitive data exposure
MODE: analysis
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Security report with: severity matrix, file:line references, CVE mappings where applicable, remediation code snippets prioritized by risk
CONSTRAINTS: Focus on authentication | Ignore test files
" --tool gemini --mode analysis --rule analysis-assess-security-risks --cd "src/auth"
```

**Implementation Task** (New Feature):
```bash
ccw cli -p "PURPOSE: Implement rate limiting for API endpoints to prevent abuse; must be configurable per-endpoint; backward compatible with existing clients
TASK: • Create rate limiter middleware with sliding window • Implement per-route configuration • Add Redis backend for distributed state • Include bypass for internal services
MODE: write
CONTEXT: @src/middleware/**/* @src/config/**/* | Memory: Using Express.js, Redis already configured, existing middleware pattern in auth.ts
EXPECTED: Production-ready code with: TypeScript types, unit tests, integration test, configuration example, migration guide
CONSTRAINTS: Follow existing middleware patterns | No breaking changes
" --tool gemini --mode write --rule development-implement-feature
```

**Bug Fix Task**:
```bash
ccw cli -p "PURPOSE: Fix memory leak in WebSocket connection handler causing server OOM after 24h; root cause must be identified before any fix
TASK: • Trace connection lifecycle from open to close • Identify event listener accumulation • Check cleanup on disconnect • Verify garbage collection eligibility
MODE: analysis
CONTEXT: @src/websocket/**/* @src/services/connection-manager.ts | Memory: Using ws library, ~5000 concurrent connections in production
EXPECTED: Root cause analysis with: memory profile, leak source (file:line), fix recommendation with code, verification steps
CONSTRAINTS: Focus on resource cleanup
" --tool gemini --mode analysis --rule analysis-diagnose-bug-root-cause --cd "src"
```

**Refactoring Task**:
```bash
ccw cli -p "PURPOSE: Refactor payment processing to use strategy pattern for multi-gateway support; no functional changes; all existing tests must pass
TASK: • Extract gateway interface from current implementation • Create strategy classes for Stripe, PayPal • Implement factory for gateway selection • Migrate existing code to use strategies
MODE: write
CONTEXT: @src/payments/**/* @src/types/payment.ts | Memory: Currently only Stripe, adding PayPal next sprint, must support future gateways
EXPECTED: Refactored code with: strategy interface, concrete implementations, factory class, updated tests, migration checklist
CONSTRAINTS: Preserve all existing behavior | Tests must pass
" --tool gemini --mode write --rule development-refactor-codebase
```

**Code Review Task** (codex review mode):
```bash
# Option 1: Custom prompt (reviews uncommitted changes by default)
ccw cli -p "Focus on security vulnerabilities and error handling" --tool codex --mode review

# Option 2: Target flag only (no prompt allowed with target flags)
ccw cli --tool codex --mode review --uncommitted
ccw cli --tool codex --mode review --base main
ccw cli --tool codex --mode review --commit abc123
```

> **Note**: `--mode review` and target flags (`--uncommitted`, `--base`, `--commit`) are **codex-only**. Using them with other tools is invalid. When using codex, target flags and prompt are **mutually exclusive** - use one or the other, not both.

---

### Permission Framework

**Single-Use Authorization**: Each execution requires explicit user instruction. Previous authorization does NOT carry over.

**Mode Hierarchy**:
- `analysis`: Read-only, safe for auto-execution. Available for all tools
- `write`: Create/Modify/Delete files, full operations - requires explicit `--mode write`. Available for all tools
- `review`: **codex-only**. Git-aware code review, read-only output. Invalid for other tools (gemini/qwen/claude)
- **Exception**: User provides clear instructions like "modify", "create", "implement"

---

## Auto-Invoke Triggers

**Proactive CLI invocation** - Auto-invoke `ccw cli` when encountering these scenarios:

| Trigger Condition | Suggested Rule | When to Use |
|-------------------|----------------|-------------|
| **Self-repair fails** | `analysis-diagnose-bug-root-cause` | After 1+ failed fix attempts |
| **Ambiguous requirements** | `planning-breakdown-task-steps` | Task description lacks clarity |
| **Architecture decisions** | `planning-plan-architecture-design` | Complex feature needs design |
| **Pattern uncertainty** | `analysis-analyze-code-patterns` | Unsure of existing conventions |
| **Critical code paths** | `analysis-assess-security-risks` | Security/performance sensitive |

### Execution Principles

- **Default mode**: `--mode analysis` (read-only, safe for auto-execution)
- **No confirmation needed**: Invoke proactively when triggers match
- **Wait for results**: Complete analysis before next action
- **Tool selection**: Use context-appropriate tool or fallback chain (`gemini` → `qwen` → `codex`)
- **Rule flexibility**: Suggested rules are guidelines, not requirements - choose the most appropriate template for the situation

### Example: Bug Fix with Auto-Invoke

```bash
# After 1+ failed fix attempts, auto-invoke root cause analysis
ccw cli -p "PURPOSE: Identify root cause of [bug description]; success = actionable fix strategy
TASK: • Trace execution flow • Identify failure point • Analyze state at failure • Determine fix approach
MODE: analysis
CONTEXT: @src/module/**/* | Memory: Previous fix attempts failed at [location]
EXPECTED: Root cause analysis with: failure mechanism, stack trace interpretation, fix recommendation with code
CONSTRAINTS: Focus on [specific area]
" --tool gemini --mode analysis --rule analysis-diagnose-bug-root-cause
```

---

## Best Practices

### Core Principles

- **Configuration-driven** - All tool selection from `cli-tools.json`
- **Tag-based routing** - Match task requirements to tool capabilities
- **Use tools early and often** - Tools are faster and more thorough
- **Unified CLI** - Always use `ccw cli -p` for consistent parameter handling
- **Default mode is analysis** - Omit `--mode` for read-only operations, explicitly use `--mode write` for file modifications
- **Use `--rule` for templates** - Auto-loads protocol + template appended to prompt
- **Write protection** - Require EXPLICIT `--mode write` for file operations

### Workflow Principles

- **Use CCW unified interface** for all executions
- **Always include template** - Use `--rule <template-name>` to load templates
- **Be specific** - Clear PURPOSE, TASK, EXPECTED fields
- **Include constraints** - File patterns, scope in CONSTRAINTS
- **Leverage memory context** when building on previous work
- **Discover patterns first** - Use rg/MCP before CLI execution
- **Default to full context** - Use `@**/*` unless specific files needed

### Planning Checklist

- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - `--mode analysis|write|review`
- [ ] **Context gathered** - File references + memory (default `@**/*`)
- [ ] **Directory navigation** - `--cd` and/or `--includeDirs`
- [ ] **Tool selected** - Explicit `--tool` or tag-based auto-selection
- [ ] **Rule template** - `--rule <template-name>` loads template
- [ ] **Constraints** - Domain constraints in CONSTRAINTS field

### Execution Workflow

1. **Load configuration** - Read `cli-tools.json` for available tools
2. **Match by tags** - Select tool based on task requirements
3. **Validate enabled** - Ensure selected tool is enabled
4. **Execute with mode** - Always specify `--mode analysis|write|review`
5. **Fallback gracefully** - Use secondary model or next matching tool on failure
