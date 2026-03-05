# CodexLens Code Indexing

## One-Liner

**CodexLens is a semantic code search engine** — Based on vector databases and LSP integration, it enables AI to understand code semantics rather than just keyword matching.

---

## Pain Points Solved

| Pain Point | Current State | CodexLens Solution |
|------------|---------------|-------------------|
| **Imprecise search** | Keywords can't find semantically related code | Semantic vector search |
| **No context** | Search results lack call chain context | LSP integration provides reference chains |
| **No understanding** | AI doesn't understand code relationships | Static analysis + semantic indexing |
| **Slow navigation** | Manual file traversal | Instant semantic navigation |

---

## vs Traditional Methods

| Dimension | Text Search | IDE Search | **CodexLens** |
|-----------|-------------|------------|---------------|
| Search type | Keyword | Keyword + symbol | **Semantic vector** |
| Context | None | File-level | **Call chain + imports** |
| AI-ready | No | No | **Direct AI consumption** |
| Multi-file | Poor | Good | **Excellent** |

---

## Core Concepts

| Concept | Description | Location |
|---------|-------------|----------|
| **Index** | Vector representation of code | `.codex-lens/index/` |
| **Chunk** | Code segment for embedding | Configurable size |
| **Retrieval** | Hybrid search (vector + keyword) | HybridSearch engine |
| **LSP** | Language Server Protocol integration | Built-in LSP client |

---

## Usage

### Via MCP Tool (Recommended)

```typescript
// ACE semantic search
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "authentication logic"
})
```

> **Note**: The CLI commands `ccw index` and `ccw search` are deprecated. Use MCP tools directly for semantic search.

```typescript
// ACE semantic search
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "authentication logic"
})
```

---

## Configuration

```json
// ~/.codexlens/settings.json
{
  "embedding": {
    "backend": "litellm",
    "model": "Qwen/Qwen3-Embedding-8B",
    "use_gpu": false
  },
  "indexing": {
    "static_graph_enabled": true,
    "chunk_size": 512
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│              CodexLens                   │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Parsers │  │ Chunker  │  │  LSP   │ │
│  │(TS/Py/..)│  │          │  │ Client │ │
│  └────┬─────┘  └────┬─────┘  └───┬────┘ │
│       │             │            │       │
│       └─────────────┼────────────┘       │
│                     │                    │
│              ┌──────┴──────┐             │
│              │   Hybrid    │             │
│              │   Search    │             │
│              └─────────────┘             │
└─────────────────────────────────────────┘
```

---

## Related Links

- [CLI Call](/features/cli) - AI model invocation
- [Memory System](/features/memory) - Persistent context
- [MCP Tools](/mcp/tools) - MCP integration
