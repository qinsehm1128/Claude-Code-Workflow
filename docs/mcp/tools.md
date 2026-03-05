# MCP Tools Reference

Model Context Protocol (MCP) tools provide enhanced integration with external systems and services.

## What is MCP?

MCP is a protocol that allows CCW to interact with external tools, databases, and services through a standardized interface.

## Available MCP Tools

### File Operations

#### mcp__ccw-tools__read_file
Read file contents with pagination support.

```json
{
  "name": "read_file",
  "parameters": {
    "path": "string (required)",
    "offset": "number (optional)",
    "limit": "number (optional)"
  }
}
```

**Usage:**
```javascript
read_file({ path: "src/index.ts" })
read_file({ path: "large-file.log", offset: 100, limit: 50 })
```

#### mcp__ccw-tools__write_file
Write or overwrite files with directory creation.

```json
{
  "name": "write_file",
  "parameters": {
    "path": "string (required)",
    "content": "string (required)",
    "createDirectories": "boolean (default: true)",
    "backup": "boolean (default: false)"
  }
}
```

**Usage:**
```javascript
write_file({
  path: "src/new-file.ts",
  content: "// TypeScript code here"
})
```

#### mcp__ccw-tools__edit_file
Edit files with string replacement or line-based operations.

```json
{
  "name": "edit_file",
  "parameters": {
    "path": "string (required)",
    "mode": "update | line (default: update)",
    "oldText": "string (update mode)",
    "newText": "string (update mode)",
    "line": "number (line mode)",
    "operation": "insert_before | insert_after | replace | delete (line mode)"
  }
}
```

**Usage:**
```javascript
// Update mode - string replacement
edit_file({
  path: "config.json",
  oldText: '"version": "1.0.0"',
  newText: '"version": "2.0.0"'
})

// Line mode - insert after line 10
edit_file({
  path: "index.ts",
  mode: "line",
  operation: "insert_after",
  line: 10,
  text: "// New code here"
})
```

### Search Tools

#### mcp__ccw-tools__smart_search
Unified search with content search, file discovery, and semantic search.

```json
{
  "name": "smart_search",
  "parameters": {
    "action": "search | find_files | init | status",
    "query": "string (for search)",
    "pattern": "glob pattern (for find_files)",
    "mode": "fuzzy | semantic (default: fuzzy)",
    "output_mode": "full | files_only | count",
    "maxResults": "number (default: 20)"
  }
}
```

**Usage:**
```javascript
// Fuzzy search (default)
smart_search({
  action: "search",
  query: "authentication logic"
})

// Semantic search
smart_search({
  action: "search",
  query: "how to handle errors",
  mode: "semantic"
})

// Find files by pattern
smart_search({
  action: "find_files",
  pattern: "*.ts"
})
```

### Code Context

#### mcp__ace-tool__search_context
Semantic code search using real-time codebase index.

```json
{
  "name": "search_context",
  "parameters": {
    "project_root_path": "string (required)",
    "query": "string (required)"
  }
}
```

**Usage:**
```javascript
search_context({
  project_root_path: "/path/to/project",
  query: "Where is user authentication handled?"
})
```

### Memory Tools

#### mcp__ccw-tools__core_memory
Cross-session memory management for strategic context.

```json
{
  "name": "core_memory",
  "parameters": {
    "operation": "list | import | export | summary | embed | search",
    "text": "string (for import)",
    "id": "string (for export/summary)",
    "query": "string (for search)"
  }
}
```

**Usage:**
```javascript
// List all memories
core_memory({ operation: "list" })

// Import new memory
core_memory({
  operation: "import",
  text: "Important: Use JWT for authentication"
})

// Search memories
core_memory({
  operation: "search",
  query: "authentication"
})
```

## MCP Configuration

Configure MCP servers in `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
    },
    "git": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-git"]
    }
  }
}
```

## Tool Priority

When working with CCW, follow this priority for tool selection:

1. **MCP Tools** (highest priority) - For code search, file operations
2. **Built-in Tools** - For simple, direct operations
3. **Shell Commands** - Fallback when MCP unavailable

::: info See Also
- [CLI Reference](../cli/commands.md) - CLI tool usage
- [Agents](../agents/) - Agent tool integration
:::
