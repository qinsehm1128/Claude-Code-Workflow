# Installation

Learn how to install and configure CCW (Claude Code Workflow) on your system.

## What is CCW?

CCW is a **Claude Code extension system** that provides advanced workflow orchestration, team collaboration, and MCP integration. It is **NOT** an npm package or standalone CLI tool.

CCW is installed as a set of command definitions, skills, and agents in your `~/.claude/` directory, and is invoked directly within Claude Code using slash commands.

## Prerequisites

Before installing CCW, make sure you have:

- **Claude Code** installed and configured
- **Git** >= 2.30.0 (for version control features)
- **Node.js** >= 20.0.0 (only required for MCP servers)
- **npm** >= 10.0.0 or **bun** >= 1.0.0 (only for MCP server installation)

> **Note**: CCW itself runs within Claude Code and doesn't require Node.js for its core functionality. Node.js is only needed if you want to use MCP servers.

## Install CCW

### Method 1: Clone and Install (Recommended)

```bash
# 1. Clone the CCW repository
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd Claude-Code-Workflow

# 2. Install dependencies
npm install

# 3. Install CCW to your system (interactive)
ccw install

# Or specify installation mode directly:
# ccw install --mode Global    # Install to home directory (recommended)
# ccw install --mode Path      # Install to specific project path
```

The `ccw install` command will:
- Copy `.claude/`, `.codex/`, `.gemini/`, `.qwen/`, `.ccw/` directories to the appropriate locations
- Create installation manifest for tracking
- Preserve user settings (`settings.json`, `settings.local.json`)
- Optionally install Git Bash fix on Windows

### Method 2: Manual Installation

If you prefer manual installation, copy the directories:

```bash
# Copy to your home directory
cp -r .claude ~/.claude/
cp -r .codex ~/.codex/
cp -r .gemini ~/.gemini/
cp -r .qwen ~/.qwen/
cp -r .ccw ~/.ccw/
```

### Verify Installation

In Claude Code, invoke the CCW commands:

```
/ccw
```

You should see the CCW orchestrator prompt with workflow options.

To check available CCW commands, you can list them:

```
Available CCW Commands:
- /ccw - Main workflow orchestrator
- /ccw-coordinator - External CLI orchestration
- /workflow:init - Initialize project configuration
- /workflow:status - Generate project views
- /issue:discover - Discover and plan issues
- /brainstorm - Multi-perspective brainstorming
- /review-code - Multi-dimensional code review
```

## Configuration

### CLI Tools Configuration

Create or edit `~/.claude/cli-tools.json` to configure external AI tools:

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "debug"],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "secondaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "secondaryModel": "coder-model",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

See [CLI Tools Guide](./cli-tools.md) for more configuration options.

### CLAUDE.md Instructions

Create `CLAUDE.md` in your project root to define project-specific instructions:

```markdown
# Project Instructions

## Coding Standards
- Use TypeScript for type safety
- Follow ESLint configuration
- Write tests for all new features

## Architecture
- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Database: PostgreSQL

## CLI Endpoints
- **CLI Tools Usage**: @~/.ccw/workflows/cli-tools-usage.md
- **CLI Endpoints Config**: @~/.claude/cli-tools.json
```

### Project Configuration

Initialize CCW in your project:

```
/workflow:init
```

This creates `.workflow/project-tech.json` with your project's technology stack.

## MCP Integration (Optional)

CCW works best with MCP (Model Context Protocol) servers for enhanced capabilities:

- **ACE Context Engine** - Real-time codebase semantic search
- **Chrome DevTools MCP** - Browser automation and debugging
- **Web Reader MCP** - Web content extraction
- **File System MCP** - Enhanced file operations

See [MCP Setup Guide](./mcp-setup.md) for detailed installation instructions.

## Updating CCW

```bash
# Navigate to your CCW clone location
cd ~/.claude/ccw-source  # or wherever you cloned it

# Pull latest changes
git pull origin main

# Copy updated files
cp -r commands/* ~/.claude/commands/
cp -r skills/* ~/.claude/skills/
cp -r agents/* ~/.claude/agents/
```

## Uninstallation

CCW provides a smart uninstall command that automatically handles installation manifests, orphan file cleanup, and global file protection.

### Using CCW Uninstall Command (Recommended)

```bash
ccw uninstall
```

Uninstallation flow:

1. **Scan Installation Manifests** - Automatically detects all installed CCW instances (Global and Path modes)
2. **Interactive Selection** - Displays installation list for you to choose which to uninstall
3. **Smart Protection** - When uninstalling Path mode, if a Global installation exists, global files (workflows, scripts, templates) are automatically preserved
4. **Orphan File Cleanup** - Automatically cleans up skills and commands files no longer referenced by any installation
5. **Empty Directory Cleanup** - Removes empty directories left behind
6. **Git Bash Fix Removal** - On Windows, after the last installation is removed, asks whether to remove the Git Bash multi-line prompt fix

### Uninstall Output Example

```
  Found installations:

  1. Global
     Path: /Users/username/my-project
     Date: 2026/3/2
     Version: 7.0.5
     Files: 156 | Dirs: 23

──────────────────────────────────────
? Select installation to uninstall: Global - /Users/username/my-project
? Are you sure you want to uninstall Global installation? Yes

✔ Removing files...
✔ Uninstall complete!

╔══════════════════════════════════════╗
║           Uninstall Summary          ║
╠══════════════════════════════════════╣
║ ✓ Successfully Uninstalled           ║
║                                      ║
║ Files removed: 156                   ║
║ Directories removed: 23              ║
║ Orphan files cleaned: 3              ║
║                                      ║
║ Manifest removed                     ║
╚══════════════════════════════════════╝
```

### Manual Uninstallation

If you need to manually remove CCW files (not recommended):

```bash
# CCW installed directories (safe to remove)
rm -rf ~/.claude/commands/ccw.md
rm -rf ~/.claude/commands/ccw-coordinator.md
rm -rf ~/.claude/commands/workflow
rm -rf ~/.claude/commands/issue
rm -rf ~/.claude/commands/cli
rm -rf ~/.claude/commands/memory
rm -rf ~/.claude/commands/idaw
rm -rf ~/.claude/skills/workflow-*
rm -rf ~/.claude/skills/team-*
rm -rf ~/.claude/skills/review-*
rm -rf ~/.claude/agents/team-worker.md
rm -rf ~/.claude/agents/cli-*-agent.md
rm -rf ~/.claude/workflows
rm -rf ~/.claude/scripts
rm -rf ~/.claude/templates
rm -rf ~/.claude/manifests
rm -rf ~/.claude/version.json

# Codex related directories
rm -rf ~/.codex/prompts
rm -rf ~/.codex/skills
rm -rf ~/.codex/agents

# Other CLI directories
rm -rf ~/.gemini
rm -rf ~/.qwen

# CCW core directory
rm -rf ~/.ccw
```

::: danger Danger
**Do NOT** run `rm -rf ~/.claude` - this will delete your Claude Code personal configurations:
- `~/.claude/settings.json` - Your Claude Code settings
- `~/.claude/settings.local.json` - Local override settings
- MCP server configurations, etc.

Always use `ccw uninstall` for controlled uninstallation.
:::

## Troubleshooting

### Command Not Found

If `/ccw` or other CCW commands don't work:

1. **Verify files are in the correct location**:
   ```bash
   ls ~/.claude/commands/ccw.md
   ls ~/.claude/commands/ccw-coordinator.md
   ```

2. **Restart Claude Code** - Commands may need a restart to be detected

3. **Check file syntax** - Ensure `.md` files have valid frontmatter

### MCP Tools Not Working

If MCP tools (like `mcp__ace-tool__search_context`) don't work:

1. **Verify MCP servers are running**:
   - Check Claude Code Settings → MCP Servers
   - Ensure required MCP servers are enabled

2. **Install missing MCP servers**:
   ```bash
   # ACE Context Engine
   npm install -g @anthropic/ace-mcp

   # File System MCP
   npm install -g @modelcontextprotocol/server-filesystem
   ```

3. **Check MCP configuration** - See [MCP Setup Guide](./mcp-setup.md)

### Permission Issues

If you encounter permission errors when copying files:

```bash
# Use appropriate permissions for your system
# On Linux/macOS with sudo
sudo cp -r commands/* ~/.claude/commands/

# Fix ownership
sudo chown -R $USER:$USER ~/.claude/
```

### Configuration Errors

If `cli-tools.json` has syntax errors:

1. **Validate JSON**:
   ```bash
   cat ~/.claude/cli-tools.json | python -m json.tool
   ```

2. **Check for trailing commas** - JSON doesn't allow them

3. **Verify version field** - Should match expected format (e.g., "3.3.0")

::: info Next Steps
After installation, check out the [Quick Start](./getting-started.md) guide.
:::

## Quick Start Example

After installation, try these commands to verify everything works:

```
# 1. Initialize in your project
/workflow:init

# 2. Try a simple analysis using the CLI tool
Bash: ccw cli -p "Analyze the project structure" --tool gemini --mode analysis

# 3. Run the main orchestrator
/ccw
# Prompt: "Summarize the codebase architecture"

# 4. Try brainstorming
/brainstorm "Improve the authentication flow"
```

### Expected Output

**Using /ccw command:**
```
You: /ccw
Claude: CCW Orchestrator - 5-Phase Workflow Execution

Phase 1: Intent Understanding
What would you like to accomplish? Please describe your task.
```

**Using workflow init:**
```
You: /workflow:init
✔ Created .workflow/project-tech.json
✔ Project configuration complete
```

### Common First-Time Issues

| Issue | Solution |
|-------|----------|
| `/ccw` command not recognized | Verify commands copied to `~/.claude/commands/` and restart Claude Code |
| `Permission denied` copying files | Use `sudo` or fix directory ownership with `chown` |
| MCP tools not available | Install and configure MCP servers (see [MCP Setup](./mcp-setup.md)) |
| CLI tools configuration error | Validate `~/.claude/cli-tools.json` has correct JSON syntax |

