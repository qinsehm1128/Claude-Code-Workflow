# System Settings

## One-Liner

**System Settings manages global and project-level configuration** — Controls hooks, agents, skills, and core system behavior.

---

## Configuration Files

| File | Scope | Purpose |
|------|-------|---------|
| `~/.claude/CLAUDE.md` | Global | Global instructions |
| `.claude/CLAUDE.md` | Project | Project instructions |
| `~/.claude/cli-tools.json` | Global | CLI tool config |
| `.claude/settings.json` | Project | Project settings |
| `.claude/settings.local.json` | Local | Local overrides |

---

## Settings Schema

```json
{
  "permissions": {
    "allow": ["Bash(npm install)", "Bash(git status)"],
    "deny": ["Bash(rm -rf)"]
  },
  "env": {
    "ANTHROPIC_API_KEY": "your-key"
  },
  "enableAll": false,
  "autoCheck": true
}
```

---

## Key Settings

### Permissions

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run*)",
      "Read(**)",
      "Edit(**/*.ts)"
    ],
    "deny": [
      "Bash(rm -rf /*)"
    ]
  }
}
```

### Hooks

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [".claude/hooks/pre-bash.sh"]
      }
    ]
  }
}
```

### MCP Servers

```json
{
  "mcpServers": {
    "ccw-tools": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
```

---

## Hook Configuration

Hooks are scripts that run at specific events:

| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before tool execution | Validation, logging |
| `PostToolUse` | After tool execution | Cleanup, notifications |
| `Notification` | On notifications | Custom handlers |
| `Stop` | On session end | Cleanup |

### Hook Example

```bash
#!/bin/bash
# .claude/hooks/pre-bash.sh
echo "Executing: $1" >> ~/.claude/bash.log
```

---

## Agent Configuration

```json
// .claude/agents/my-agent.md
---
description: Custom analysis agent
model: claude-sonnet
tools:
  - Read
  - Grep
---

# Agent Instructions
...
```

---

## Related Links

- [API Settings](/features/api-settings) - API configuration
- [CLI Call](/features/cli) - Command invocation
- [Dashboard](/features/dashboard) - Visual management
