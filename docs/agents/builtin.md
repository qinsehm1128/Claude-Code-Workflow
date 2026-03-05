# Built-in Agents

CCW includes **21 specialized agents** organized across 5 categories, each designed for specific development tasks. Agents can work independently or be orchestrated together for complex workflows.

## Categories Overview

| Category | Count | Primary Use |
|----------|-------|-------------|
| [CLI](#cli-agents) | 6 | CLI-based interactions, exploration, and planning |
| [Development](#development-agents) | 5 | Code implementation and debugging |
| [Planning](#planning-agents) | 4 | Strategic planning and issue management |
| [Testing](#testing-agents) | 3 | Test generation, execution, and quality assurance |
| [Documentation](#documentation-agents) | 3 | Documentation and design systems |

---

## CLI Agents

### cli-explore-agent

**Purpose**: Specialized CLI exploration with 3 analysis modes

**Capabilities**:
- Quick-scan (Bash only)
- Deep-scan (Bash + Gemini)
- Dependency-map (graph construction)
- 4-phase workflow: Task Understanding → Analysis Execution → Schema Validation → Output Generation

**Tools**: `Bash`, `Read`, `Grep`, `Glob`, `ccw cli (gemini/qwen/codex)`, `ACE search_context`

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: "Analyze authentication module dependencies"
})
```

### cli-discuss-agent

**Purpose**: Multi-CLI collaborative discussion with cross-verification

**Capabilities**:
- 5-phase workflow: Context Prep → CLI Execution → Cross-Verify → Synthesize → Output
- Loads discussion history
- Maintains context across sessions

**Tools**: `Read`, `Grep`, `Glob`, `ccw cli`

**Calls**: `cli-explore-agent` for codebase discovery before discussions

```javascript
Task({
  subagent_type: "cli-discuss-agent",
  prompt: "Discuss architecture patterns for microservices"
})
```

### cli-execution-agent

**Purpose**: Intelligent CLI execution with automated context discovery

**Capabilities**:
- 5-phase workflow: Task Understanding → Context Discovery → Prompt Enhancement → Tool Execution → Output Routing
- Background execution support
- Result polling

**Tools**: `Bash`, `Read`, `Grep`, `Glob`, `ccw cli`, `TaskOutput`

**Calls**: `cli-explore-agent` for discovery before execution

```javascript
Task({
  subagent_type: "cli-execution-agent",
  prompt: "Execute security scan on authentication module"
})
```

### cli-lite-planning-agent

**Purpose**: Lightweight planning for quick task breakdowns

**Capabilities**:
- Creates simplified task JSONs without complex schema validation
- For straightforward implementation tasks

**Tools**: `Read`, `Write`, `Bash`, `Grep`

```javascript
Task({
  subagent_type: "cli-lite-planning-agent",
  prompt: "Plan user registration feature"
})
```

### cli-planning-agent

**Purpose**: Full-featured planning for complex implementations

**Capabilities**:
- 6-field schema with context loading
- Flow control and artifact integration
- Comprehensive task JSON generation

**Tools**: `Read`, `Write`, `Bash`, `Grep`, `Glob`, `mcp__ace-tool__search_context`

```javascript
Task({
  subagent_type: "cli-planning-agent",
  prompt: "Plan microservices architecture migration"
})
```

### cli-roadmap-plan-agent

**Purpose**: Strategic planning for roadmap and milestone generation

**Capabilities**:
- Creates long-term project plans
- Generates epics, milestones, and delivery timelines
- Issue creation via ccw

**Tools**: `Read`, `Write`, `Bash`, `Grep`

```javascript
Task({
  subagent_type: "cli-roadmap-plan-agent",
  prompt: "Create Q1 roadmap for payment system"
})
```

---

## Development Agents

### code-developer

**Purpose**: Core code execution for any implementation task

**Capabilities**:
- Adapts to any domain while maintaining quality standards
- Supports analysis, implementation, documentation, research
- Complex multi-step workflows

**Tools**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`, `Task`, `mcp__ccw-tools__edit_file`, `mcp__ccw-tools__write_file`

```javascript
Task({
  subagent_type: "code-developer",
  prompt: "Implement user authentication with JWT"
})
```

### tdd-developer

**Purpose**: TDD-aware code execution for Red-Green-Refactor workflows

**Capabilities**:
- Extends code-developer with TDD cycle awareness
- Automatic test-fix iteration
- CLI session resumption

**Tools**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`, `ccw cli`

**Extends**: `code-developer`

```javascript
Task({
  subagent_type: "tdd-developer",
  prompt: "Implement payment processing with TDD"
})
```

### context-search-agent

**Purpose**: Specialized context collector for brainstorming workflows

**Capabilities**:
- Analyzes existing codebase
- Identifies patterns
- Generates standardized context packages

**Tools**: `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`, `Read`, `Grep`, `Glob`, `Bash`

```javascript
Task({
  subagent_type: "context-search-agent",
  prompt: "Gather context for API refactoring"
})
```

### debug-explore-agent

**Purpose**: Debugging specialist for code analysis and problem diagnosis

**Capabilities**:
- Hypothesis-driven debugging with NDJSON logging
- CLI-assisted analysis
- Iterative verification
- Traces execution flow, identifies failure points, analyzes state at failure

**Tools**: `Read`, `Grep`, `Bash`, `ccw cli`

**Workflow**: Bug Analysis → Hypothesis Generation → Instrumentation → Log Analysis → Fix Verification

```javascript
Task({
  subagent_type: "debug-explore-agent",
  prompt: "Debug memory leak in connection handler"
})
```

### universal-executor

**Purpose**: Versatile execution for implementing any task efficiently

**Capabilities**:
- Adapts to any domain while maintaining quality standards
- Handles analysis, implementation, documentation, research
- Complex multi-step workflows

**Tools**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`, `Task`, `mcp__ace-tool__search_context`, `mcp__exa__web_search_exa`

```javascript
Task({
  subagent_type: "universal-executor",
  prompt: "Implement GraphQL API with authentication"
})
```

---

## Planning Agents

### action-planning-agent

**Purpose**: Pure execution agent for creating implementation plans

**Capabilities**:
- Transforms requirements and brainstorming artifacts into structured plans
- Quantified deliverables and measurable acceptance criteria
- Control flags for execution modes

**Tools**: `Read`, `Write`, `Bash`, `Grep`, `Glob`, `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`

```javascript
Task({
  subagent_type: "action-planning-agent",
  prompt: "Create implementation plan for user dashboard"
})
```

### conceptual-planning-agent

**Purpose**: High-level planning for architectural and conceptual design

**Capabilities**:
- Creates system designs
- Architecture patterns
- Technical strategies

**Tools**: `Read`, `Write`, `Bash`, `Grep`, `ccw cli`

```javascript
Task({
  subagent_type: "conceptual-planning-agent",
  prompt: "Design event-driven architecture for order system"
})
```

### issue-plan-agent

**Purpose**: Issue resolution planning with closed-loop exploration

**Capabilities**:
- Analyzes issues and generates solution plans
- Creates task JSONs with dependencies and acceptance criteria
- 5-phase tasks from exploration to solution

**Tools**: `Read`, `Write`, `Bash`, `Grep`, `mcp__ace-tool__search_context`

```javascript
Task({
  subagent_type: "issue-plan-agent",
  prompt: "Plan resolution for issue #123"
})
```

### issue-queue-agent

**Purpose**: Solution ordering agent for queue formation

**Capabilities**:
- Receives solutions from bound issues
- Uses Gemini for intelligent conflict detection
- Produces ordered execution queue

**Tools**: `Read`, `Write`, `Bash`, `ccw cli (gemini)`, `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`

**Calls**: `issue-plan-agent`

```javascript
Task({
  subagent_type: "issue-queue-agent",
  prompt: "Form execution queue for issues #101, #102, #103"
})
```

---

## Testing Agents

### test-action-planning-agent

**Purpose**: Specialized agent for test planning documents

**Capabilities**:
- Extends action-planning-agent for test planning
- Progressive L0-L3 test layers (Static, Unit, Integration, E2E)
- AI code issue detection (L0.5) with CRITICAL/ERROR/WARNING severity
- Project-specific templates
- Test anti-pattern detection with quality gates

**Tools**: `Read`, `Write`, `Bash`, `Grep`, `Glob`

**Extends**: `action-planning-agent`

```javascript
Task({
  subagent_type: "test-action-planning-agent",
  prompt: "Create test plan for payment module"
})
```

### test-context-search-agent

**Purpose**: Specialized context collector for test generation workflows

**Capabilities**:
- Analyzes test coverage
- Identifies missing tests
- Loads implementation context from source sessions
- Generates standardized test-context packages

**Tools**: `mcp__ccw-tools__codex_lens`, `Read`, `Glob`, `Bash`, `Grep`

```javascript
Task({
  subagent_type: "test-context-search-agent",
  prompt: "Gather test context for authentication module"
})
```

### test-fix-agent

**Purpose**: Execute tests, diagnose failures, and fix code until all tests pass

**Capabilities**:
- Multi-layered test execution (L0-L3)
- Analyzes failures and modifies source code
- Quality gate for passing tests

**Tools**: `Bash`, `Read`, `Edit`, `Write`, `Grep`, `ccw cli`

```javascript
Task({
  subagent_type: "test-fix-agent",
  prompt: "Run tests for user service and fix failures"
})
```

---

## Documentation Agents

### doc-generator

**Purpose**: Documentation generation for technical docs, API references, and code comments

**Capabilities**:
- Synthesizes context from multiple sources
- Produces comprehensive documentation
- Flow_control-based task execution

**Tools**: `Read`, `Write`, `Bash`, `Grep`, `Glob`

```javascript
Task({
  subagent_type: "doc-generator",
  prompt: "Generate API documentation for REST endpoints"
})
```

### memory-bridge

**Purpose**: Documentation update coordinator for complex projects

**Capabilities**:
- Orchestrates parallel CLAUDE.md updates
- Uses MCP tools directly for module documentation
- Processes every module path

**Tools**: `Bash`, `mcp__ccw-tools__*`, `TodoWrite`

```javascript
Task({
  subagent_type: "memory-bridge",
  prompt: "Update CLAUDE.md for all modules"
})
```

### ui-design-agent

**Purpose**: UI design token management and prototype generation

**Capabilities**:
- W3C Design Tokens Format compliance
- State-based component definitions (default, hover, focus, active, disabled)
- Complete component library coverage (12+ interactive components)
- Animation-component state integration
- WCAG AA compliance validation
- Token-driven prototype generation

**Tools**: `Read`, `Write`, `Edit`, `Bash`, `mcp__exa__web_search_exa`, `mcp__exa__get_code_context_exa`

```javascript
Task({
  subagent_type: "ui-design-agent",
  prompt: "Generate design tokens for dashboard components"
})
```

---

## Orchestration Patterns

Agents can be combined using these orchestration patterns:

### Inheritance Chain

Agent extends another agent's capabilities:

| Parent | Child | Extension |
|--------|-------|-----------|
| code-developer | tdd-developer | Adds TDD Red-Green-Refactor workflow, test-fix cycle |
| action-planning-agent | test-action-planning-agent | Adds L0-L3 test layers, AI issue detection |

### Sequential Delegation

Agent calls another agent for preprocessing:

| Caller | Callee | Purpose |
|--------|--------|---------|
| cli-discuss-agent | cli-explore-agent | Codebase discovery before discussion |
| cli-execution-agent | cli-explore-agent | Discovery before CLI command execution |

### Queue Formation

Agent collects outputs from multiple agents and orders them:

| Collector | Source | Purpose |
|-----------|--------|---------|
| issue-queue-agent | issue-plan-agent | Collect solutions, detect conflicts, produce ordered queue |

### Context Loading Chain

Agent generates context packages used by execution agents:

| Context Provider | Consumer | Purpose |
|------------------|----------|---------|
| context-search-agent | code-developer | Provides brainstorming context packages |
| test-context-search-agent | test-fix-agent | Provides test context packages |

### Quality Gate Chain

Sequential execution through validation gates:

```
code-developer (IMPL-001)
  → test-fix-agent (IMPL-001.3 validation)
  → test-fix-agent (IMPL-001.5 review)
  → test-fix-agent (IMPL-002 fix)
```

---

## Agent Selection Guide

| Task | Recommended Agent | Alternative |
|------|------------------|-------------|
| Explore codebase | cli-explore-agent | context-search-agent |
| Implement code | code-developer | tdd-developer |
| Debug issues | debug-explore-agent | cli-execution-agent |
| Plan implementation | cli-planning-agent | action-planning-agent |
| Generate tests | test-action-planning-agent | test-fix-agent |
| Review code | test-fix-agent | doc-generator |
| Create documentation | doc-generator | ui-design-agent |
| UI design | ui-design-agent | - |
| Manage issues | issue-plan-agent | issue-queue-agent |

---

## Tool Dependencies

### Core Tools

All agents have access to: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`

### MCP Tools

Specialized agents use: `mcp__ace-tool__search_context`, `mcp__ccw-tools__smart_search`, `mcp__ccw-tools__edit_file`, `mcp__ccw-tools__write_file`, `mcp__ccw-tools__codex_lens`, `mcp__exa__web_search_exa`

### CLI Tools

CLI-capable agents use: `ccw cli`, MCP tools directly

### Workflow Tools

Coordinating agents use: `Task`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskOutput`, `TodoWrite`, `SendMessage`

::: info See Also
- [Agents Overview](./index.md) - Agent system introduction
- [Custom Agents](./custom.md) - Create custom agents
- [Team Skills](../skills/core-skills.md#team-skills) - Multi-agent team skills
:::
