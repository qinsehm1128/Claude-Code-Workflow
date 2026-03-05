# What is Claude Code Workflow

## One-Line Positioning

**Claude Code Workflow is an AI-powered development workbench for VS Code** — Through semantic code indexing, multi-model CLI invocation, and team collaboration systems, it enables AI to deeply understand your project and generate high-quality code according to specifications.

> AI capabilities bloom like vines — Claude Code Workflow is the trellis that guides AI along your project's architecture, coding standards, and team workflows.

---

## 1.1 Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|---------------------|
| **AI doesn't understand the project** | Every new session requires re-explaining project background, tech stack, and coding standards | Memory system persists project context, AI remembers project knowledge across sessions |
| **Difficult code search** | Keyword search can't find semantically related code, don't know where functions are called | CodexLens semantic indexing, supports natural language search and call chain tracing |
| **Single model limitation** | Can only call one AI model, different models excel in different scenarios | CCW unified invocation framework, supports multi-model collaboration (Gemini, Qwen, Codex, Claude) |
| **Chaotic collaboration process** | Team members work independently, inconsistent code styles, standards hard to implement | Team workflow system (PlanEx, IterDev, Lifecycle) ensures standard execution |
| **Standards hard to implement** | CLAUDE.md written but AI doesn't follow, project constraints ignored | Spec + Hook auto-injection, AI forced to follow project standards |

---

## 1.2 vs Traditional Methods

| Dimension | Traditional AI Assistant | **Claude Code Workflow** |
|-----------|-------------------------|-----------------|
| **Code Search** | Text keyword search | **Semantic vector search + LSP call chain** |
| **AI Invocation** | Single model fixed call | **Multi-model collaboration, optimal model per task** |
| **Project Memory** | Re-explain each session | **Cross-session persistent Memory** |
| **Standard Execution** | Relies on Prompt reminders | **Spec + Hook auto-injection** |
| **Team Collaboration** | Each person for themselves | **Structured workflow system** |
| **Code Quality** | Depends on AI capability | **Multi-dimensional review + auto-fix cycle** |

---

## 1.3 Core Concepts Overview

| Concept | Description | Location/Command |
|---------|-------------|------------------|
| **CodexLens** | Semantic code indexing and search engine | `mcp__ace-tool__search_context(project_root_path="...", query="...")` |
| **CCW** | Unified CLI tool invocation framework | `ccw cli` |
| **Memory** | Cross-session knowledge persistence | `mcp__ccw-tools__core_memory(operation="list")` |
| **Spec** | Project specification and constraint system | `.workflow/specs/` |
| **Hook** | Auto-triggered context injection scripts | `.claude/hooks/` |
| **Agent** | Specialized AI subprocess for specific roles | `.claude/agents/` |
| **Skill** | Reusable AI capability modules | `Skill(skill="<name>")` |
| **Workflow** | Multi-phase development orchestration | `/workflow:*` |

---

## 1.4 Architecture Overview

```mermaid
graph TB
    subgraph Claude Code Workflow_Architecture[Claude Code Workflow Architecture]
        A[CodexLens<br/>Semantic Index]
        B[CCW<br/>CLI Call Framework]
        C[Memory<br/>Persistent Context]
        D[Spec System]
        E[Hooks<br/>Inject]
        F[Skills<br/>Reusable]
        G[Agents<br/>Roles]

        A --> D
        B --> D
        C --> D
        D --> E
        D --> F
        D --> G
    end
```

---

## Next Steps

- [Getting Started](/guide/ch02-getting-started) - Install and configure
- [Core Concepts](/guide/ch03-core-concepts) - Understand the fundamentals
- [Workflow Basics](/guide/ch04-workflow-basics) - Start your first workflow
