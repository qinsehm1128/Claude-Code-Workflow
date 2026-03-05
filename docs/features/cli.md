# CLI Call System

## One-Liner

**The CLI Call System is a unified AI model invocation framework** — Provides a consistent interface for calling multiple AI models (Gemini, Qwen, Codex, Claude) with standardized prompts, modes, and templates.

---

## Pain Points Solved

| Pain Point | Current State | CLI Call Solution |
|------------|---------------|-------------------|
| **Single model limitation** | Can only use one AI model | Multi-model collaboration |
| **Inconsistent prompts** | Different prompt formats per model | Unified prompt template |
| **No mode control** | AI can modify files unexpectedly | analysis/write/review modes |
| **No templates** | Reinvent prompts each time | 30+ pre-built templates |

---

## vs Traditional Methods

| Dimension | Direct API | Individual CLIs | **CCW CLI** |
|-----------|------------|-----------------|-------------|
| Multi-model | Manual switch | Multiple tools | **Unified interface** |
| Prompt format | Per-model | Per-tool | **Standardized template** |
| Permission | Unclear | Unclear | **Explicit modes** |
| Templates | None | None | **30+ templates** |

---

## Core Concepts

| Concept | Description | Usage |
|---------|-------------|-------|
| **Tool** | AI model backend | `--tool gemini/qwen/codex/claude` |
| **Mode** | Permission level | `analysis/write/review` |
| **Template** | Pre-built prompt | `--rule analysis-review-code` |
| **Session** | Conversation continuity | `--resume <id>` |

---

## Usage

### Basic Command

```bash
ccw cli -p "Analyze authentication flow" --tool gemini --mode analysis
```

### With Template

```bash
ccw cli -p "PURPOSE: Security audit
TASK: • Check SQL injection • Verify CSRF tokens
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: Report with severity levels
CONSTRAINTS: Focus on authentication" --tool gemini --mode analysis --rule analysis-assess-security-risks
```

### Session Resume

```bash
ccw cli -p "Continue analysis" --resume
```

---

## Configuration

```json
// ~/.claude/cli-tools.json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "debug"]
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model"
    }
  }
}
```

---

## Available Templates

| Category | Templates |
|----------|-----------|
| Analysis | `analysis-review-code`, `analysis-diagnose-bug`, `analysis-assess-security` |
| Planning | `planning-plan-architecture`, `planning-breakdown-task` |
| Development | `development-implement-feature`, `development-refactor-codebase` |

---

## Related Links

- [Spec System](/features/spec) - Constraint injection
- [Memory System](/features/memory) - Persistent context
- [CodexLens](/features/codexlens) - Code indexing
