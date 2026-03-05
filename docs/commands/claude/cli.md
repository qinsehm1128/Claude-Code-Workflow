# CLI Tool Commands

## One-Liner

**CLI tool commands are the bridge to external model invocation** — integrating Gemini, Qwen, Codex and other multi-model capabilities into workflows.

## Core Concepts

| Concept | Description | Configuration |
|----------|-------------|---------------|
| **CLI Tool** | External AI model invocation interface | `cli-tools.json` |
| **Endpoint** | Available model services | gemini, qwen, codex, claude |
| **Mode** | analysis / write / review | Permission level |

## Command List

| Command | Function | Syntax |
|---------|----------|--------|
| [`cli-init`](#cli-init) | Generate configuration directory and settings files | `/cli:cli-init [--tool gemini\|qwen\|all] [--output path] [--preview]` |
| [`codex-review`](#codex-review) | Interactive code review using Codex CLI | `/cli:codex-review [--uncommitted\|--base <branch>\|--commit <sha>] [prompt]` |

## Command Details

### cli-init

**Function**: Generate `.gemini/` and `.qwen/` configuration directories based on workspace tech detection, including settings.json and ignore files.

**Syntax**:
```bash
/cli:cli-init [--tool gemini|qwen|all] [--output path] [--preview]
```

**Options**:
- `--tool=tool`: gemini, qwen or all
- `--output=path`: Output directory
- `--preview`: Preview mode (don't actually create)

**Generated File Structure**:
```plaintext
.gemini/
├── settings.json      # Gemini configuration
└── ignore            # Ignore patterns

.qwen/
├── settings.json      # Qwen configuration
└── ignore            # Ignore patterns
```

**Tech Detection**:

| Detection Item | Generated Config |
|----------------|------------------|
| TypeScript | tsconfig-related config |
| React | React-specific config |
| Vue | Vue-specific config |
| Python | Python-specific config |

**Examples**:
```bash
# Initialize all tools
/cli:cli-init --tool all

# Initialize specific tool
/cli:cli-init --tool gemini

# Specify output directory
/cli:cli-init --output ./configs

# Preview mode
/cli:cli-init --preview
```

### codex-review

**Function**: Interactive code review using Codex CLI via ccw endpoint, supporting configurable review targets, models, and custom instructions.

**Syntax**:
```bash
/cli:codex-review [--uncommitted|--base <branch>|--commit <sha>] [--model <model>] [--title <title>] [prompt]
```

**Options**:
- `--uncommitted`: Review uncommitted changes
- `--base <branch>`: Compare with branch
- `--commit <sha>`: Review specific commit
- `--model <model>`: Specify model
- `--title <title>`: Review title

**Note**: Target flags and prompt are mutually exclusive

**Examples**:
```bash
# Review uncommitted changes
/cli:codex-review --uncommitted

# Compare with main branch
/cli:codex-review --base main

# Review specific commit
/cli:codex-review --commit abc123

# With custom instructions
/cli:codex-review --uncommitted "focus on security issues"

# Specify model and title
/cli:codex-review --model gpt-5.2 --title "Authentication module review"
```

## CLI Tool Configuration

### cli-tools.json Structure

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "Debug"],
      "type": "builtin"
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "tags": [],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

### Mode Descriptions

| Mode | Permission | Use Cases |
|------|------------|-----------|
| `analysis` | Read-only | Code review, architecture analysis, pattern discovery |
| `write` | Create/modify/delete | Feature implementation, bug fixes, documentation creation |
| `review` | Git-aware code review | Review uncommitted changes, branch diffs, specific commits |

## Related Documentation

- [CLI Invocation System](../../features/cli.md)
- [Core Orchestration](./core-orchestration.md)
- [Workflow Commands](./workflow.md)
