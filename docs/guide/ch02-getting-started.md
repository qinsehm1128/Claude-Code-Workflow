# Getting Started

## One-Line Positioning

**Getting Started is a 5-minute quick-start guide** — Installation, first command, first workflow, quickly experience Claude Code Workflow's core features.

---

## 2.1 Installation

### 2.1.1 Prerequisites

| Requirement | Version | Description |
| --- | --- | --- |
| **Node.js** | 18+ | Required for CCW modules |
| **Python** | 3.10+ | Required for CodexLens modules |
| **VS Code** | Latest | Extension runtime environment |
| **Git** | Latest | Version control |

### 2.1.2 Clone Project

```bash
# Clone repository (replace with your fork or the actual repository URL)
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd claude-dms3

# Install dependencies
npm install
```

### 2.1.3 Configure API Keys

Configure API Keys in `~/.claude/cli-tools.json`:

```json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "settings": {
        "apiKey": "AIza-xxx"
      }
    },
    "claude": {
      "enabled": true,
      "primaryModel": "sonnet",
      "settings": {
        "apiKey": "sk-ant-xxx"
      }
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "settings": {
        "apiKey": "sk-xxx"
      }
    }
  }
}
```

::: tip Tip
API Keys can also be configured at the project level in `.claude/cli-tools.json`. Project-level configuration takes priority over global configuration.
:::

---

## 2.2 Initialize Project

### 2.2.1 Start Workflow Session

Open your project in VS Code, then run:

```
/workflow:session:start
```

This creates a new workflow session. All subsequent operations will be performed within this session context.

### 2.2.2 Initialize Project Specs

```
/workflow:init
```

This creates the `project-tech.json` file, recording your project's technology stack information.

### 2.2.3 Populate Project Specs

```
/workflow:init-guidelines
```

Interactively populate project specifications, including coding style, architectural decisions, and other information.

---

## 2.3 First Command

### 2.3.1 Code Analysis

Use CCW CLI tool to analyze code:

```bash
ccw cli -p "Analyze the code structure and design patterns of this file" --tool gemini --mode analysis
```

**Parameter Description**:
- `-p`: Prompt (task description)
- `--tool gemini`: Use Gemini model
- `--mode analysis`: Analysis mode (read-only, no file modifications)

### 2.3.2 Code Generation

Use CCW CLI tool to generate code:

```bash
ccw cli -p "Create a React component implementing user login form" --tool qwen --mode write
```

**Parameter Description**:
- `--mode write`: Write mode (can create/modify files)

::: danger Warning
`--mode write` will modify files. Ensure your code is committed or backed up.
:::

---

## 2.4 First Workflow

### 2.4.1 Start Planning Workflow

```
/workflow-plan
```

This launches the PlanEx workflow, including the following steps:

1. **Analyze Requirements** - Understand user intent
2. **Explore Code** - Search related code and patterns
3. **Generate Plan** - Create structured task list
4. **Execute Tasks** - Execute development according to plan

### 2.4.2 Brainstorming

```
/brainstorm
```

Multi-perspective brainstorming for diverse viewpoints:

| Perspective | Role | Focus |
| --- | --- | --- |
| Product | Product Manager | Market fit, user value |
| Technical | Tech Lead | Feasibility, technical debt |
| Quality | QA Lead | Completeness, testability |
| Risk | Risk Analyst | Risk identification, dependencies |

---

## 2.5 Using Memory

### 2.5.1 View Project Memory

```typescript
mcp__ccw-tools__core_memory(operation="list")
```

Display all project memories, including learnings, decisions, conventions, and issues.

### 2.5.2 Search Related Memory

```typescript
mcp__ccw-tools__core_memory(operation="search", query="authentication")
```

Semantic search for memories related to "authentication".

### 2.5.3 Add Memory

```
/memory-capture
```

Interactively capture important knowledge points from the current session.

---

## 2.6 Code Search

### 2.6.1 Semantic Search

Use ACE semantic search via MCP tool:

```typescript
mcp__ace-tool__search_context(
  project_root_path="/path/to/project",
  query="user login logic"
)
```

> **Note**: The CLI commands `ccw search` and `ccw memory` are deprecated. Use MCP tools directly.

---

## 2.7 Dashboard Panel

### 2.7.1 Open Dashboard

Run in VS Code:

```
ccw-dashboard.open
```

Or use Command Palette (Ctrl+Shift+P) and search "CCW Dashboard".

### 2.7.2 Panel Features

| Feature | Description |
| --- | --- |
| **Tech Stack** | Display frameworks and libraries used |
| **Specs Docs** | Quick view of project specifications |
| **Memory** | Browse and search project memory |
| **Code Search** | Integrated CodexLens semantic search |

---

## 2.8 FAQ

### 2.8.1 API Key Configuration

**Q: Where to configure API Keys?**

A: Can be configured in two locations:
- Global configuration: `~/.claude/cli-tools.json`
- Project configuration: `.claude/cli-tools.json`

Project configuration takes priority over global configuration.

### 2.8.2 Model Selection

**Q: How to choose the right model?**

A: Select based on task type:
- Code analysis, architecture design → Gemini
- General development → Qwen
- Code review → Codex (GPT)
- Long text understanding → Claude

### 2.8.3 Workflow Selection

**Q: When to use which workflow?**

A: Select based on task objective:
- New feature development → `/workflow-plan`
- Problem diagnosis → `/debug-with-file`
- Code review → `/review-code`
- Refactoring planning → `/refactor-cycle`
- UI development → `/workflow:ui-design`

---

## 2.9 Quick Reference

### Installation Steps

```bash
# 1. Clone project (replace with your fork or the actual repository URL)
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd claude-dms3

# 2. Install dependencies
npm install

# 3. Configure API Keys
# Edit ~/.claude/cli-tools.json

# 4. Start workflow session
/workflow:session:start

# 5. Initialize project
/workflow:init
```

### Common Commands

| Command | Function |
| --- | --- |
| `/workflow:session:start` | Start session |
| `/workflow-plan` | Planning workflow |
| `/brainstorm` | Brainstorming |
| `/review-code` | Code review |
| `mcp__ccw-tools__core_memory(operation="list")` | View Memory |
| `ccw cli -p "..."` | CLI invocation |

---

## Next Steps

- [Core Concepts](ch03-core-concepts.md) — Deep dive into Commands, Skills, Prompts
- [Workflow Basics](ch04-workflow-basics.md) — Learn various workflow commands
- [Advanced Tips](ch05-advanced-tips.md) — CLI toolchain, multi-model collaboration, memory management optimization
