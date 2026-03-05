# API Settings

## One-Liner

**API Settings manages AI model endpoint configuration** — Centralizes API keys, base URLs, and model selection for all supported AI backends.

---

## Configuration Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `~/.claude/cli-tools.json` | Global | Base |
| `.claude/settings.json` | Project | Override |
| `.claude/settings.local.json` | Local | Highest |

---

## Supported Backends

| Backend | Type | Models |
|---------|------|--------|
| **Gemini** | Builtin | gemini-2.5-flash, gemini-2.5-pro |
| **Qwen** | Builtin | coder-model |
| **Codex** | Builtin | gpt-5.2 |
| **Claude** | Builtin | sonnet, haiku |
| **OpenCode** | Builtin | opencode/glm-4.7-free |

---

## Configuration Example

```json
// ~/.claude/cli-tools.json
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
    }
  }
}
```

---

## Environment Variables

```bash
# API Keys
LITELLM_API_KEY=your-api-key
LITELLM_API_BASE=https://api.example.com/v1
LITELLM_MODEL=gpt-4o-mini

# Reranker (optional)
RERANKER_API_KEY=your-reranker-key
RERANKER_API_BASE=https://api.siliconflow.cn
RERANKER_PROVIDER=siliconflow
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
```

---

## Model Selection

### Via CLI Flag

```bash
ccw cli -p "Analyze code" --tool gemini --model gemini-2.5-pro
```

### Via Config

```json
{
  "tools": {
    "gemini": {
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-pro"
    }
  }
}
```

---

## Related Links

- [CLI Call](/features/cli) - Command invocation
- [System Settings](/features/system-settings) - System configuration
- [CodexLens](/features/codexlens) - Code indexing
