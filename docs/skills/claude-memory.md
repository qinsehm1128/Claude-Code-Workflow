# Claude Skills - Memory Management

## One-Liner

**Memory Management Skills is a cross-session knowledge persistence system** — Through Memory compression, Tips recording, and Memory updates, AI remembers project context across sessions.

## Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|----------------------|
| **New session amnesia** | Every conversation needs to re-explain project background | Memory persists context |
| **Knowledge loss** | Valuable insights and decisions disappear with session | Memory compression and Tips recording |
| **Context window limits** | Context exceeds window after long conversations | Memory extraction and merging |
| **Difficult knowledge retrieval** | Hard to find historical records | Memory search and embedding |

## Skills List

| Skill | Function | Trigger |
|-------|----------|---------|
| `memory-capture` | Unified memory capture (session compression/quick notes) | `/memory-capture` |
| `memory-manage` | Memory update (full/related/single) | `/memory-manage` |

## Skills Details

### memory-capture

**One-Liner**: Unified memory capture — Dual-mode routing for session compression or quick notes

**Trigger**:
```
/memory-capture                              # Interactive mode selection
/memory-capture compact                      # Session compression mode
/memory-capture tip "Note content"           # Quick note mode
/memory-capture "Use Redis" --tag config     # Note with tags
```

**Features**:
- Dual-mode routing: Auto-detects user intent, routes to compression mode or notes mode
- **Compact mode**: Compresses complete session memory to structured text for session recovery
- **Tips mode**: Quickly records ideas, snippets, insights

**Architecture Overview**:
```
┌─────────────────────────────────────────────┐
│  Memory Capture (Router)                    │
│  → Parse input → Detect mode → Route to phase│
└───────────────┬─────────────────────────────┘
                │
        ┌───────┴───────┐
        ↓               ↓
  ┌───────────┐   ┌───────────┐
  │  Compact  │   │   Tips    │
  │  (Phase1) │   │  (Phase2) │
  │  Full     │   │  Quick    │
  │  Session  │   │  Note     │
  └─────┬─────┘   └─────┬─────┘
        │               │
        └───────┬───────┘
                ↓
        ┌───────────────┐
        │  core_memory  │
        │   (import)    │
        └───────────────┘
```

**Auto Routing Rules** (priority order):
| Signal | Route | Example |
|--------|-------|---------|
| Keywords: compact, session, 压缩, recovery | → Compact | "Compress current session" |
| Keywords: tip, note, 记录, 快速 | → Tips | "Record an idea" |
| Has `--tag` or `--context` flag | → Tips | `"note content" --tag bug` |
| Short text (<100 chars) + no session keywords | → Tips | "Remember to use Redis" |
| Ambiguous or no parameters | → **AskUserQuestion** | `/memory-capture` |

**Compact Mode**:
- Use case: Compress current complete session memory (for session recovery)
- Input: Optional `"session description"` as supplementary context
- Output: Structured text + Recovery ID
- Example: `/memory-capture compact` or `/memory-capture "Completed authentication module"`

**Tips Mode**:
- Use case: Quickly record a note/idea/tip
- Input:
  - Required: `<note content>` - Note text
  - Optional: `--tag <tag1,tag2>` categories
  - Optional: `--context <context>` associated code/feature reference
- Output: Confirmation + ID + tags
- Example: `/memory-capture tip "Use Redis for rate limiting" --tag config`

**Core Rules**:
1. **Single-phase execution**: Each call executes only one phase — never both
2. **Content fidelity**: Phase files contain complete execution details — follow exactly
3. **Absolute paths**: All file paths in output must be absolute paths
4. **No summarization**: Compact mode preserves complete plan — never abbreviate
5. **Speed priority**: Tips mode should be fast — minimal analysis overhead

---

### memory-manage

**One-Liner**: Memory update — Full/related/single update modes

**Trigger**:
```
/memory-manage                               # Interactive mode
/memory-manage full                          # Full update
/memory-manage related <query>               # Related update
/memory-manage single <id> <content>         # Single update
```

**Features**:
- Three update modes: Full update, related update, single update
- Memory search and embedding
- Memory merge and compression

**Update Modes**:
| Mode | Trigger | Description |
|------|---------|-------------|
| **full** | `full` or `-f` | Regenerate all Memory |
| **related** | `related <query>` or `-r <query>` | Update Memory related to query |
| **single** | `single <id> <content>` or `-s <id> <content>` | Update single Memory entry |

**Memory Storage**:
- Location: `C:\Users\dyw\.claude\projects\D--ccw-doc2\memory\`
- File: MEMORY.md (main memory file, truncated after 200 lines)
- Topic files: Independent memory files organized by topic

**Memory Types**:
| Type | Format | Description |
|------|--------|-------------|
| `CMEM-YYYYMMDD-HHMMSS` | Timestamp format | Timestamped persistent memory |
| Topic files | `debugging.md`, `patterns.md` | Memory organized by topic |

**Core Rules**:
1. **Prefer update**: Update existing memory rather than writing duplicate content
2. **Topic organization**: Create independent memory files categorized by topic
3. **Delete outdated**: Delete memory entries that are proven wrong or outdated
4. **Session-specific**: Don't save session-specific context (current task, in-progress work, temporary state)

## Related Commands

- [Memory Feature Documentation](../features/memory.md)
- [CCW CLI Tools](../features/cli.md)

## Best Practices

1. **Session compression**: Use `memory-capture compact` after long conversations to save complete context
2. **Quick notes**: Use `memory-capture tip` to quickly record ideas and insights
3. **Tag categorization**: Use `--tag` to add tags to notes for later retrieval
4. **Memory search**: Use `memory-manage related <query>` to find related memories
5. **Regular merging**: Regularly use `memory-manage full` to merge and compress memories

## Memory File Structure

```
memory/
├── MEMORY.md                 # Main memory file (line limit)
├── debugging.md              # Debugging patterns and insights
├── patterns.md               # Code patterns and conventions
├── conventions.md            # Project conventions
└── [topic].md               # Other topic files
```

## Usage Examples

```bash
# Compress current session
/memory-capture compact

# Quickly record an idea
/memory-capture tip "Use Redis for rate limiting" --tag config

# Record note with context
/memory-capture "Authentication module uses JWT" --context "src/auth/"

# Update related memories
/memory-manage related "authentication"

# Full memory update
/memory-manage full
```
