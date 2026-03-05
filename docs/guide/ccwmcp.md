# CCWMCP Guide

## What is CCWMCP?

CCWMCP is CCW's custom MCP (Model Context Protocol) server that provides core tool integration for the CCW workflow system. It enables advanced features like team messaging, file operations, memory management, and user interaction within Claude Code.

## Features

CCWMCP provides the following capabilities:

| Feature | Description |
|---------|-------------|
| **Enhanced Context** | ACE semantic search for codebase understanding |
| **File Operations** | Advanced read, write, edit operations with validation |
| **Team Operations** | Message bus for multi-agent team workflows |
| **Memory Management** | Core memory system for cross-session persistence |
| **User Interaction** | Interactive question/answer prompts |
| **Code Diagnostics** | Real-time error detection and validation |

## Available CCWMCP Tools

### File Operations

| Tool | Description |
|------|-------------|
| `mcp__ccw-tools__read_file` | Read single files with pagination support |
| `mcp__ccw-tools__write_file` | Create or overwrite files with auto-directory creation |
| `mcp__ccw-tools__edit_file` | Edit files with dry-run preview and line-based operations |

**Usage in Skills**:
```yaml
allowed-tools: mcp__ccw-tools__read_file(*), mcp__ccw-tools__write_file(*), mcp__ccw-tools__edit_file(*)
```

### Search Operations

| Tool | Description |
|------|-------------|
| `mcp__ace-tool__search_context` | Real-time semantic codebase search with context |
| `mcp__ccw-tools__smart_search` | Structured search with regex and pattern matching |

**Usage in Skills**:
```yaml
allowed-tools: mcp__ace-tool__search_context(*), mcp__ccw-tools__smart_search(*)
```

### Team Operations

| Tool | Description |
|------|-------------|
| `mcp__ccw-tools__team_msg` | Team message bus for logging and communication |

**Usage in Skills**:
```yaml
allowed-tools: mcp__ccw-tools__team_msg(*)
```

### Memory Operations

| Tool | Description |
|------|-------------|
| `mcp__ccw-tools__core_memory` | Persistent memory management for cross-session context |

**Usage in Skills**:
```yaml
allowed-tools: mcp__ccw-tools__core_memory(*)
```

### User Interaction

| Tool | Description |
|------|-------------|
| `mcp__ccw-tools__ask_question` | Interactive question/answer prompts for user input |

**Usage in Skills**:
```yaml
allowed-tools: mcp__ccw-tools__ask_question(*)
```

### Code Diagnostics

| Tool | Description |
|------|-------------|
| `mcp__ide__getDiagnostics` | Real-time code error checking and validation |

**Usage in Skills**:
```yaml
allowed-tools: mcp__ide__getDiagnostics(*)
```

## Installation

CCWMCP is bundled with CCW installation. No separate installation is required.

If you're installing CCW from source:

```bash
# 1. Clone the CCW repository
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd Claude-Code-Workflow

# 2. Install dependencies
npm install

# 3. Install CCW (includes ccwmcp)
ccw install
```

## Configuration

CCWMCP tools are automatically available once CCW is installed. No additional configuration is required.

### Verify CCWMCP is Working

In Claude Code, test a CCWMCP tool:

```
# Test file read operation
Bash: read_file("path/to/file.txt")

# Test semantic search
Bash: ace_tool__search_context("authentication logic")

# Test memory operation
Bash: core_memory("list")
```

## Usage Examples

### Example 1: Reading a File

```yaml
---
name: file-reader
description: Read and display file contents
allowed-tools: mcp__ccw-tools__read_file(*)
---

# Read file content
read_file(path="/path/to/file.txt")
```

### Example 2: Editing a File

```yaml
---
name: file-editor
description: Edit files with validation
allowed-tools: mcp__ccw-tools__edit_file(*)
---

# Edit file with dry-run preview
edit_file(
  path="/path/to/file.txt",
  oldText="old content",
  newText="new content",
  dryRun=true  # Preview changes first
)
```

### Example 3: Semantic Search

```yaml
---
name: code-searcher
description: Search codebase semantically
allowed-tools: mcp__ace-tool__search_context(*)
---

# Search for authentication logic
ace_tool__search_context(
  project_root_path="/path/to/project",
  query="user authentication login flow"
)
```

### Example 4: Team Messaging

```yaml
---
name: team-worker
description: Multi-agent team worker
allowed-tools: mcp__ccw-tools__team_msg(*)
---

# Log message to team bus
team_msg(
  operation="log",
  team="session-id",
  from="worker",
  to="coordinator",
  type="status",
  summary="Task complete"
)
```

## CCWMCP in Team Workflows

CCWMCP is essential for CCW's team-lifecycle system:

- **Team Messaging**: Enables communication between team members (analyst, writer, planner, executor, tester, reviewer)
- **Fast-Advance**: Coordinates workflow progression through team pipeline
- **Knowledge Transfer**: Shares context across team roles via shared-memory.json

### Team Message Bus Protocol

```javascript
team_msg({
  operation: "log",           // Operation: log, read, list, status
  team: "session-id",         // Session ID (not team name)
  from: "role",               // Sender role
  to: "coordinator",          // Recipient (usually coordinator)
  type: "draft_complete",     // Message type from role_spec
  summary: "[role] task complete",
  ref: "path/to/artifact"     // Optional artifact reference
})
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CCWMCP tools not available | Verify CCW files are in `~/.claude/` directory |
| `mcp__ccw-tools__*` not found | Restart Claude Code after CCW installation |
| Team messaging not working | Check session ID format (use folder name, not team name) |
| File operations failing | Verify file paths are absolute, not relative |
| Semantic search not working | Ensure ACE MCP server is installed and configured |

## Integration with Other MCP Servers

CCWMCP works alongside other MCP servers:

| MCP Server | Purpose | Integration |
|------------|---------|-------------|
| **ACE Context Engine** | Semantic search | CCWMCP uses `mcp__ace-tool__search_context` |
| **File System MCP** | File operations | CCWMCP provides `mcp__ccw-tools__*` file tools |
| **Chrome DevTools MCP** | Browser automation | Used in UI design workflows |
| **Web Reader MCP** | Web content | Used in research and documentation tasks |

## Best Practices

1. **Always use absolute paths** for file operations
2. **Use dry-run mode** when editing files to preview changes
3. **Verify session ID format** when using team messaging
4. **Enable ACE MCP** for best semantic search experience
5. **Check tool permissions** in skill frontmatter before use

## Advanced Usage

### Custom Tool Wrappers

Create custom wrappers for CCWMCP tools:

```yaml
---
name: custom-file-writer
description: Custom file writer with validation
allowed-tools: mcp__ccw-tools__write_file(*)
---

# Write file with backup
write_file(
  path="/path/to/file.txt",
  content="file content",
  backup=true  # Create backup before overwrite
)
```

### Batch Operations

Use CCWMCP for batch file operations:

```yaml
---
name: batch-editor
description: Edit multiple files at once
allowed-tools: mcp__ccw-tools__edit_file(*)
---

# Batch edit with multiple replacements
edit_file(
  path="/path/to/file.txt",
  edits=[
    {oldText: "foo", newText: "bar"},
    {oldText: "baz", newText: "qux"}
  ]
)
```

## Reference

- [MCP Setup Guide](./mcp-setup.md) - Configure external MCP servers
- [Installation](./installation.md) - CCW installation guide
- [Team Workflows](/workflows/teams) - team-lifecycle documentation
