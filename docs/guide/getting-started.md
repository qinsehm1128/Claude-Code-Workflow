# Getting Started with CCW

Welcome to CCW (Claude Code Workflow) - an advanced workflow orchestration system for Claude Code that helps you build better software faster.

## What is CCW?

CCW is a Claude Code extension system that provides:

- **Main Orchestrator (`/ccw`)**: Intent-aware workflow selection and automatic command routing
- **AI-Powered CLI Tools**: Analyze, review, and implement code with multiple AI backends (Gemini, Codex, Qwen)
- **Specialized Agents**: Code execution, TDD development, testing, debugging, and documentation
- **Workflow Orchestration**: 5-phase workflow system from intent to execution
- **Extensible Skills**: 100+ built-in skills with custom skill support
- **Team Pipeline**: Multi-agent collaboration with role-based workflows (analyst, writer, planner, executor, tester, reviewer)
- **MCP Integration**: Model Context Protocol for enhanced tool integration

## Quick Start

### Installation

**Important**: CCW is NOT an npm package. It's a Claude Code extension system.

```bash
# 1. Clone the CCW repository
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd Claude-Code-Workflow

# 2. Install dependencies
npm install

# 3. Install CCW (interactive - will prompt for Global/Path mode)
ccw install
```

See [Installation Guide](./installation.md) for detailed instructions.

### Your First Workflow

Create a simple workflow in under 5 minutes:

```
# Main orchestrator - automatically selects workflow based on intent
/ccw
# Prompt: "Create a new project"                    # Auto-selects appropriate workflow
# Prompt: "Analyze the codebase structure"          # Auto-selects analysis workflow
# Prompt: "Add user authentication"                 # Auto-selects implementation workflow

# Auto-mode - skip confirmation
/ccw -y
# Prompt: "Fix the login timeout issue"             # Execute without confirmation prompts

# Or use specific workflow commands
/workflow:init                                      # Initialize project state
/workflow-plan
# Prompt: "Add OAuth2 authentication"               # Create implementation plan
/workflow-execute                                   # Execute planned tasks
```

## Next Steps

- [Installation Guide](./installation.md) - Detailed installation instructions
- [First Workflow](./first-workflow.md) - 30-minute quickstart tutorial
- [CLI Tools](./cli-tools.md) - Customize your CCW setup

::: tip Need Help?
Check out our [GitHub Discussions](https://github.com/catlog22/Claude-Code-Workflow/discussions) or visit the [GitHub repository](https://github.com/catlog22/Claude-Code-Workflow).
:::
