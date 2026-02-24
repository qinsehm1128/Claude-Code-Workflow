# Hooks Integration for Progressive Disclosure

This document describes how to integrate session hooks with CCW's progressive disclosure system, including the new Soft Enforcement Stop Hook, Mode System, and Checkpoint/Recovery features.

## Overview

CCW supports automatic context injection via hooks. When a session starts, the system can automatically provide a progressive disclosure index showing related sessions from the same cluster.

### Key Features

- **Automatic Context Injection**: Session start hooks inject cluster context
- **Progressive Disclosure**: Shows related sessions, their summaries, and recovery commands
- **Silent Failure**: Hook failures don't block session start (< 5 seconds timeout)
- **Multiple Hook Types**: Supports `session-start`, `context`, `PreCompact`, `Stop`, and custom hooks
- **Soft Enforcement**: Stop hooks never block - they inject continuation messages instead
- **Mode System**: Keyword-based mode activation with exclusive mode conflict detection
- **Checkpoint/Recovery**: Automatic state preservation before context compaction

## Hook Configuration

### Location

Place hook configurations in `.claude/settings.json`:

```json
{
  "hooks": {
    "session-start": [
      {
        "name": "Progressive Disclosure",
        "description": "Injects progressive disclosure index at session start with recovery detection",
        "enabled": true,
        "handler": "internal:context",
        "timeout": 5000,
        "failMode": "silent",
        "notes": [
          "Checks for recovery checkpoints and injects recovery message if found",
          "Uses RecoveryHandler.checkRecovery() for session recovery"
        ]
      }
    ]
  }
}
```

### Hook Types

#### `session-start`
Triggered when a new session begins. Ideal for injecting context and checking for recovery checkpoints.

#### `PreCompact`
Triggered before context compaction. Creates checkpoints to preserve session state including:
- Active mode states
- Workflow progress
- TODO summaries

#### `Stop`
Triggered when a stop is requested. Uses **Soft Enforcement** - never blocks, but may inject continuation messages.

#### `UserPromptSubmit`
Triggered when a prompt is submitted. Detects mode keywords and activates corresponding execution modes.

#### `session-end`
Triggered when a session ends. Useful for:
- Updating cluster metadata
- Cleaning up mode states
- Final checkpoint creation

#### `file-modified`
Triggered when files are modified. Can be used for auto-commits or notifications.

### Hook Properties

- **`name`**: Human-readable hook name
- **`description`**: What the hook does
- **`enabled`**: Boolean to enable/disable the hook
- **`handler`**: `internal:context` for built-in context generation, or use `command` field
- **`command`**: Shell command to execute (alternative to `handler`)
- **`timeout`**: Maximum execution time in milliseconds (default: 5000)
- **`failMode`**: How to handle failures
  - `silent`: Ignore errors, don't log
  - `log`: Log errors but continue
  - `fail`: Abort on error
- **`async`**: Run in background without blocking (default: false)

### Available Variables

In `command` fields, use these variables:

- `$SESSION_ID`: Current session ID
- `$FILE_PATH`: File path (for file-modified hooks)
- `$PROJECT_PATH`: Current project path
- `$CLUSTER_ID`: Active cluster ID (if available)

---

## Soft Enforcement Stop Hook

The Stop Hook implements **Soft Enforcement**: it never blocks stops, but injects continuation messages to encourage task completion.

### Priority Order

1. **context-limit**: Always allow (deadlock prevention)
2. **user-abort**: Respect user intent
3. **active-workflow**: Inject continuation message
4. **active-mode**: Inject continuation message via ModeRegistryService

### Configuration Example

```json
{
  "hooks": {
    "Stop": [
      {
        "name": "Soft Enforcement Stop",
        "description": "Injects continuation messages for active workflows/modes",
        "enabled": true,
        "command": "ccw hook stop --stdin",
        "timeout": 5000,
        "failMode": "silent"
      }
    ]
  }
}
```

### Behavior Matrix

| Condition | continue | mode | message |
|-----------|----------|------|---------|
| Context limit reached | `true` | `context-limit` | None |
| User requested stop | `true` | `user-abort` | None |
| Active workflow | `true` | `active-workflow` | Continuation message |
| Active mode | `true` | `active-mode` | Mode-specific message |
| Normal stop | `true` | `none` | None |

### Context Limit Detection

Detected via `ContextLimitDetector`:
- `stop_reason: "context_limit_reached"`
- `stop_reason: "end_turn_limit"`
- `end_turn_reason: "max_tokens"`
- `stop_reason: "max_context"`

### User Abort Detection

Detected via `UserAbortDetector`:
- `user_requested: true`
- `stop_reason: "user_cancel"`
- `stop_reason: "cancel"`

---

## Mode System

The Mode System provides centralized mode state management with file-based persistence.

### Supported Modes

| Mode | Type | Description |
|------|------|-------------|
| `autopilot` | Exclusive | Autonomous execution mode for multi-step tasks |
| `ralph` | Non-exclusive | Research and Analysis Learning Pattern Handler |
| `ultrawork` | Non-exclusive | Ultra-focused work mode for deep tasks |
| `swarm` | Exclusive | Multi-agent swarm execution mode |
| `pipeline` | Exclusive | Pipeline execution mode for sequential tasks |
| `team` | Non-exclusive | Team collaboration mode |
| `ultraqa` | Non-exclusive | Ultra-focused QA mode |

### Exclusive Mode Conflict

Exclusive modes (`autopilot`, `swarm`, `pipeline`) cannot run concurrently. Attempting to start one while another is active will be blocked.

### Mode State Storage

Mode states are stored in `.workflow/modes/`:
```
.workflow/modes/
├── sessions/
│   ├── {session-id}/
│   │   ├── autopilot-state.json
│   │   └── ralph-state.json
│   └── ...
└── (legacy shared states)
```

### Stale Marker Cleanup

Mode markers older than 1 hour are automatically cleaned up to prevent crashed sessions from blocking indefinitely.

### Mode Activation via Keyword

Configure the `UserPromptSubmit` hook to detect keywords:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "name": "Keyword Detection",
        "description": "Detects mode keywords in prompts and activates corresponding modes",
        "enabled": true,
        "command": "ccw hook keyword --stdin",
        "timeout": 5000,
        "failMode": "silent"
      }
    ]
  }
}
```

### Supported Keywords

| Keyword | Mode | Aliases |
|---------|------|---------|
| `autopilot` | autopilot | - |
| `ultrawork` | ultrawork | `ulw` |
| `ralph` | ralph | - |
| `swarm` | swarm | - |
| `pipeline` | pipeline | - |
| `team` | team | - |
| `ultraqa` | ultraqa | - |
| `cancelomc` | Cancel | `stopomc` |
| `codex` | Delegate | `gpt` |
| `gemini` | Delegate | - |

---

## Checkpoint and Recovery

The Checkpoint System preserves session state before context compaction.

### Checkpoint Triggers

| Trigger | Description |
|---------|-------------|
| `manual` | User-initiated checkpoint |
| `auto` | Automatic checkpoint |
| `compact` | Before context compaction |
| `mode-switch` | When switching modes |
| `session-end` | At session termination |

### Checkpoint Storage

Checkpoints are stored in `.workflow/checkpoints/`:

```
.workflow/checkpoints/
├── 2025-02-18T10-30-45-sess123.json
├── 2025-02-18T11-15-22-sess123.json
└── ...
```

### Checkpoint Contents

```json
{
  "id": "2025-02-18T10-30-45-sess123",
  "created_at": "2025-02-18T10:30:45.000Z",
  "trigger": "compact",
  "session_id": "sess123",
  "project_path": "/path/to/project",
  "workflow_state": null,
  "mode_states": {
    "autopilot": {
      "active": true,
      "activatedAt": "2025-02-18T10:00:00.000Z"
    }
  },
  "memory_context": null,
  "todo_summary": {
    "pending": 3,
    "in_progress": 1,
    "completed": 5
  }
}
```

### Recovery Flow

```
┌─────────────────┐
│  Session Start  │
└────────┬────────┘
         │
         v
┌─────────────────┐     No checkpoint
│  Check Recovery │ ──────────────────► Continue normally
└────────┬────────┘
         │ Checkpoint found
         v
┌─────────────────┐
│ Load Checkpoint │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Restore Modes   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Inject Message  │
└─────────────────┘
```

### Automatic Cleanup

Only the last 10 checkpoints per session are retained. Older checkpoints are automatically removed.

---

## PreCompact Hook with Mutex

The PreCompact hook uses a mutex to prevent concurrent compaction operations for the same directory.

### Mutex Behavior

```
Request 1 ──► PreCompact ──► Create checkpoint ──► Return
                                                ▲
Request 2 ──► Wait for Request 1 ────────────────┘
```

This prevents race conditions when multiple subagent results arrive simultaneously (e.g., in swarm/ultrawork modes).

---

## API Endpoint

### Trigger Hook

```bash
POST http://localhost:3456/api/hook
Content-Type: application/json

{
  "type": "session-start",
  "sessionId": "WFS-20241218-001",
  "projectPath": "/path/to/project"
}
```

### Response Format

```json
{
  "success": true,
  "type": "context",
  "format": "markdown",
  "content": "<ccw-session-context>...</ccw-session-context>",
  "sessionId": "WFS-20241218-001"
}
```

### Query Parameters

- `?path=/project/path`: Override project path
- `?format=markdown|json`: Response format (default: markdown)

---

## Progressive Disclosure Output Format

The hook returns a structured Markdown document:

```markdown
<ccw-session-context>
## Related Sessions Index

### Active Cluster: {cluster_name} ({member_count} sessions)
**Intent**: {cluster_intent}

| # | Session | Type | Summary | Tokens |
|---|---------|------|---------|--------|
| 1 | WFS-001 | Workflow | Implement auth | ~1200 |
| 2 | CLI-002 | CLI | Fix login bug | ~800 |

**Resume Commands**:
```bash
# Load specific session
ccw core-memory load {session_id}

# Load entire cluster context
ccw core-memory load-cluster {cluster_id}
```

### Timeline
```
2024-12-15 -- WFS-001 (Implement auth)
        │
2024-12-16 -- CLI-002 (Fix login bug) <- Current
```

---
**Tip**: Use `ccw core-memory search <keyword>` to find more sessions
</ccw-session-context>
```

---

## Complete Configuration Example

```json
{
  "hooks": {
    "session-start": [
      {
        "name": "Progressive Disclosure",
        "description": "Injects progressive disclosure index at session start with recovery detection",
        "enabled": true,
        "handler": "internal:context",
        "timeout": 5000,
        "failMode": "silent"
      }
    ],
    "session-end": [
      {
        "name": "Update Cluster Metadata",
        "description": "Updates cluster metadata after session ends",
        "enabled": true,
        "command": "ccw core-memory update-cluster --session $SESSION_ID",
        "timeout": 30000,
        "async": true,
        "failMode": "log"
      },
      {
        "name": "Mode State Cleanup",
        "description": "Deactivates all active modes for the session",
        "enabled": true,
        "command": "ccw hook session-end --stdin",
        "timeout": 5000,
        "failMode": "silent"
      }
    ],
    "PreCompact": [
      {
        "name": "Create Checkpoint",
        "description": "Creates checkpoint before context compaction",
        "enabled": true,
        "command": "ccw hook precompact --stdin",
        "timeout": 10000,
        "failMode": "log"
      }
    ],
    "Stop": [
      {
        "name": "Soft Enforcement Stop",
        "description": "Injects continuation messages for active workflows/modes",
        "enabled": true,
        "command": "ccw hook stop --stdin",
        "timeout": 5000,
        "failMode": "silent"
      }
    ],
    "UserPromptSubmit": [
      {
        "name": "Keyword Detection",
        "description": "Detects mode keywords in prompts and activates corresponding modes",
        "enabled": true,
        "command": "ccw hook keyword --stdin",
        "timeout": 5000,
        "failMode": "silent"
      }
    ],
    "file-modified": [
      {
        "name": "Auto Commit Checkpoint",
        "description": "Creates git checkpoint on file modifications",
        "enabled": false,
        "command": "git add . && git commit -m \"[Auto] Checkpoint: $FILE_PATH\"",
        "timeout": 10000,
        "async": true,
        "failMode": "log"
      }
    ]
  },
  "notes": {
    "handler": "Use 'internal:context' for built-in context generation, or 'command' for external commands",
    "failMode": "Options: 'silent' (ignore errors), 'log' (log errors), 'fail' (abort on error)",
    "variables": "Available: $SESSION_ID, $FILE_PATH, $PROJECT_PATH, $CLUSTER_ID",
    "async": "Async hooks run in background and don't block the main flow",
    "Stop hook": "The Stop hook uses Soft Enforcement - it never blocks but may inject continuation messages",
    "PreCompact hook": "Creates checkpoint before compaction; uses mutex to prevent concurrent operations",
    "UserPromptSubmit hook": "Detects mode keywords and activates corresponding execution modes",
    "session-end hook": "Cleans up mode states using ModeRegistryService.deactivateMode()"
  }
}
```

---

## Testing

### Test Hook Trigger

```bash
# Using curl
curl -X POST http://localhost:3456/api/hook \
  -H "Content-Type: application/json" \
  -d '{"type":"session-start","sessionId":"test-001"}'

# Using ccw (if CLI command exists)
ccw core-memory context --format markdown
```

### Run Integration Tests

```bash
# Run all hook integration tests
node --test tests/integration/hooks-integration.test.ts

# Run with verbose output
node --test tests/integration/hooks-integration.test.ts --test-name-pattern="INT-.*"
```

### Expected Output

If a cluster exists:
- Table of related sessions
- Resume commands
- Timeline visualization

If no cluster exists:
- Message indicating no cluster found
- Commands to search or trigger clustering

---

## Troubleshooting

### Hook Not Triggering

1. Check that hooks are enabled in `.claude/settings.json`
2. Verify the hook type matches the event
3. Ensure the server is running on the correct port

### Timeout Issues

1. Increase `timeout` value for slow operations
2. Use `async: true` for long-running commands
3. Check logs for performance issues

### Empty Context

1. Ensure clustering has been run: `ccw core-memory cluster --auto`
2. Verify session metadata exists
3. Check that the session has been added to a cluster

### Mode Not Activating

1. Check for conflicting exclusive modes
2. Verify keyword spelling (case-insensitive)
3. Check that keyword is not inside code blocks

### Checkpoint Not Created

1. Verify `.workflow/checkpoints/` directory exists
2. Check disk space
3. Review logs for error messages

### Recovery Not Working

1. Verify checkpoint exists in `.workflow/checkpoints/`
2. Check that session ID matches
3. Ensure checkpoint file is valid JSON

---

## Performance Considerations

- Progressive disclosure index generation is fast (< 1 second typical)
- Uses cached metadata to avoid full session parsing
- Timeout enforced to prevent blocking
- Failures return empty content instead of errors
- Mutex prevents concurrent compaction operations
- Stale marker cleanup runs automatically

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Session                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Hook Events
                              v
┌─────────────────────────────────────────────────────────────┐
│                      Hook System                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Session Start │  │ PreCompact   │  │    Stop      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          v                 v                  v
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│RecoveryHandler  │ │CheckpointService│ │  StopHandler    │
│                 │ │                 │ │                 │
│ - checkRecovery │ │ - create        │ │ - SoftEnforce   │
│ - formatMessage │ │ - save          │ │ - detectMode    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         v                   v                   v
┌─────────────────────────────────────────────────────────────┐
│                   ModeRegistryService                        │
│                                                              │
│  - activateMode / deactivateMode                            │
│  - getActiveModes / canStartMode                            │
│  - cleanupStaleMarkers                                      │
│                                                              │
│  Storage: .workflow/modes/sessions/{sessionId}/             │
└─────────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────┐
│                  Checkpoint Storage                          │
│                                                              │
│  .workflow/checkpoints/{checkpoint-id}.json                 │
│  - session_id, trigger, mode_states, workflow_state         │
│  - Automatic cleanup (keep last 10 per session)             │
└─────────────────────────────────────────────────────────────┘
```

---

## References

- **Session Clustering**: See `session-clustering-service.ts`
- **Core Memory Store**: See `core-memory-store.ts`
- **Hook Routes**: See `routes/hooks-routes.ts`
- **Stop Handler**: See `core/hooks/stop-handler.ts`
- **Mode Registry**: See `core/services/mode-registry-service.ts`
- **Checkpoint Service**: See `core/services/checkpoint-service.ts`
- **Recovery Handler**: See `core/hooks/recovery-handler.ts`
- **Keyword Detector**: See `core/hooks/keyword-detector.ts`
- **Example Configuration**: See `templates/hooks-config-example.json`
