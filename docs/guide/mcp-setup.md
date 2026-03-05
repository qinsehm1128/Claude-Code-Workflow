# MCP Setup Guide

## What is MCP?

Model Context Protocol (MCP) is a standardized way for AI assistants to interact with external tools and services. CCW integrates with MCP servers to provide enhanced capabilities like semantic code search, browser automation, and advanced file operations.

## Recommended MCP Servers

CCW Dashboard provides 3 recommended MCP servers with wizard-based installation:

### 1. ACE Context Engine (Highly Recommended)

- **Purpose**: Real-time codebase semantic search and context retrieval
- **Installation**: `npx ace-tool --base-url <url> --token <token>`
- **Used by**: CCW's `mcp__ace-tool__search_context` tool
- **Why**: Provides semantic understanding of your codebase beyond simple text search

**Configuration**:
```json
{
  "mcpServers": {
    "ace-tool": {
      "command": "npx",
      "args": ["ace-tool", "--base-url", "https://acemcp.heroman.wtf/relay/", "--token", "your-token"],
      "env": {}
    }
  }
}
```

**Required Fields**:
- `baseUrl`: ACE MCP relay URL (default: `https://acemcp.heroman.wtf/relay/`)
- `token`: Your ACE API token

### 2. Chrome DevTools MCP

- **Purpose**: Browser automation and debugging
- **Installation**: `npx chrome-devtools-mcp@latest`
- **Used by**: UI testing, web scraping, debugging
- **Why**: Enables browser automation for web development tasks
- **No configuration required**

**Configuration**:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"],
      "type": "stdio",
      "env": {}
    }
  }
}
```

### 3. Exa MCP (Web Search)

- **Purpose**: Web search capabilities for documentation and research
- **Installation**: `npx -y exa-mcp-server`
- **Used by**: Research and documentation generation tasks
- **Why**: Enables CCW to search the web for current information

**Configuration**:
```json
{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "your-exa-api-key"
      }
    }
  }
}
```

**Optional Fields**:
- `apiKey`: Your Exa API key (optional but recommended for higher rate limits)

## Complete MCP Configuration

Combine all recommended MCP servers in your Claude Code settings:

```json
{
  "mcpServers": {
    "ace-tool": {
      "command": "npx",
      "args": ["ace-tool", "--base-url", "https://acemcp.heroman.wtf/relay/", "--token", "your-token"],
      "env": {}
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"],
      "type": "stdio",
      "env": {}
    },
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": {
        "EXA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## How to Configure MCP in Claude Code

### Method 1: Using CCW Dashboard (Recommended)

1. Run `ccw view` to open the CCW Dashboard
2. Navigate to **MCP Manager** page
3. Click on **Recommended** tab
4. Click **Install** on any recommended MCP server
5. Follow the wizard to configure

### Method 2: Manual Configuration

1. Open Claude Code
2. Click on **Settings** (gear icon)
3. Navigate to **MCP Servers** section
4. Click **+ Add Server**
5. Enter server name, command, and arguments
6. Add environment variables if needed
7. Click **Save**

### Verify MCP Connection

In Claude Code, invoke the MCP tools:

```
# Test ACE Context Engine
Bash: ccw cli -p "Search for authentication logic" --tool gemini --mode analysis
# This will use mcp__ace-tool__search_context if configured

# List available MCP tools
# Check Claude Code Settings → MCP Servers → Connection Status
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| MCP server not starting | Verify Node.js >= 18.0.0 is installed |
| Connection refused | Check MCP server configuration in Claude Code settings |
| ACE token invalid | Verify your ACE API token is correct |
| `npx` command not found | Ensure Node.js and npm are in your PATH |
| Windows path issues | CCW Dashboard auto-wraps commands with `cmd /c` on Windows |

## Minimum MCP Setup for CCW

For basic CCW functionality, the minimum recommended MCP servers are:

1. **ACE Context Engine** - For semantic code search (required for best experience)

All other MCP servers are optional and add specific capabilities.

## Next Steps

- [CCWMCP Guide](./ccwmcp.md) - Learn about CCW's custom MCP server
- [Installation](./installation.md) - Complete CCW installation guide
- [CLI Tools](./cli-tools.md) - Configure CLI tools for CCW
