# CLI Tools Configuration

Configure and customize CCW CLI tools for your development workflow.

## Configuration File

CCW CLI tools are configured in `~/.claude/cli-tools.json`:

```json
{
  "version": "3.3.0",
  "tools": {
    "tool-id": {
      "enabled": true,
      "primaryModel": "model-name",
      "secondaryModel": "fallback-model",
      "tags": ["tag1", "tag2"],
      "type": "builtin | api-endpoint | cli-wrapper"
    }
  }
}
```

## Tool Types

### Builtin Tools

Full-featured tools with all capabilities:

```json
{
  "gemini": {
    "enabled": true,
    "primaryModel": "gemini-2.5-flash",
    "secondaryModel": "gemini-2.5-pro",
    "tags": ["analysis", "debug"],
    "type": "builtin"
  }
}
```

**Capabilities**: Analysis + Write tools

### API Endpoint Tools

Analysis-only tools for specialized tasks:

```json
{
  "custom-api": {
    "enabled": true,
    "primaryModel": "custom-model",
    "tags": ["specialized-analysis"],
    "type": "api-endpoint"
  }
}
```

**Capabilities**: Analysis only

## CLI Command Format

### Universal Template

```bash
ccw cli -p "PURPOSE: [goal] + [why] + [success criteria]
TASK: • [step 1] • [step 2] • [step 3]
MODE: [analysis|write|review]
CONTEXT: @[file patterns] | Memory: [context]
EXPECTED: [output format]
CONSTRAINTS: [constraints]" --tool <tool-id> --mode <mode> --rule <template>
```

### Required Parameters

| Parameter | Description | Options |
|-----------|-------------|---------|
| `--mode <mode>` | **REQUIRED** - Execution permission level | `analysis` (read-only) \| `write` (create/modify) \| `review` (git-aware review) |
| `-p <prompt>` | **REQUIRED** - Task prompt with structured template | - |

### Optional Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `--tool <tool>` | Explicit tool selection | `--tool gemini` |
| `--rule <template>` | Load rule template for structured prompts | `--rule analysis-review-architecture` |
| `--resume [id]` | Resume previous session | `--resume` or `--resume session-id` |
| `--cd <path>` | Set working directory | `--cd src/auth` |
| `--includeDirs <dirs>` | Include additional directories (comma-separated) | `--includeDirs ../shared,../types` |
| `--model <model>` | Override tool's primary model | `--model gemini-2.5-pro` |

## Tool Selection

### Tag-Based Routing

Tools are selected based on task requirements:

```bash
# Task with "analysis" tag routes to gemini
ccw cli -p "PURPOSE: Debug authentication issue
TASK: • Trace auth flow • Identify failure point
MODE: analysis" --tool gemini --mode analysis

# No tags - uses first enabled tool
ccw cli -p "PURPOSE: Implement feature X
TASK: • Create component • Add tests
MODE: write" --mode write
```

### Explicit Selection

Override automatic selection:

```bash
ccw cli -p "Task description" --tool codex --mode write
```

### Rule Templates

Auto-load structured prompt templates:

```bash
# Architecture review template
ccw cli -p "Analyze system architecture" --mode analysis --rule analysis-review-architecture

# Feature implementation template
ccw cli -p "Add OAuth2 authentication" --mode write --rule development-implement-feature
```

## Model Configuration

### Primary vs Secondary

```json
{
  "codex": {
    "primaryModel": "gpt-5.2",
    "secondaryModel": "gpt-5.2"
  }
}
```

- **primaryModel**: Default model for the tool
- **secondaryModel**: Fallback if primary fails

### Available Models

| Tool | Available Models |
|------|------------------|
| gemini | gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash |
| codex | gpt-5.2 |
| claude | sonnet, haiku |
| qwen | coder-model |

## Tool Tags

Tags enable automatic tool selection:

| Tag | Use Case |
|-----|----------|
| analysis | Code review, architecture analysis |
| debug | Bug diagnosis, troubleshooting |
| implementation | Feature development, code generation |
| documentation | Doc generation, technical writing |
| testing | Test generation, coverage analysis |

## Example Configurations

### Development Setup

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "tags": ["development", "debug"],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "tags": ["implementation", "review"],
      "type": "builtin"
    }
  }
}
```

### Cost Optimization

```json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.0-flash",
      "tags": ["analysis"],
      "type": "builtin"
    }
  }
}
```

### Quality Focus

```json
{
  "tools": {
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "tags": ["review", "implementation"],
      "type": "builtin"
    },
    "claude": {
      "enabled": true,
      "primaryModel": "sonnet",
      "tags": ["documentation"],
      "type": "builtin"
    }
  }
}
```

## Validation

To verify your configuration, check the config file directly:

```bash
cat ~/.claude/cli-tools.json
```

Or test tool availability:

```bash
ccw cli -p "PURPOSE: Test tool availability
TASK: Verify tool is working
MODE: analysis" --mode analysis
```

## Troubleshooting

### Tool Not Available

```bash
Error: Tool 'custom-tool' not found
```

**Solution**: Check tool is enabled in config:

```json
{
  "custom-tool": {
    "enabled": true
  }
}
```

### Model Not Found

```bash
Error: Model 'invalid-model' not available
```

**Solution**: Use valid model name from available models list.

::: info See Also
- [CLI Reference](../cli/commands.md) - CLI usage
- [Modes](#modes) - Execution modes
:::
