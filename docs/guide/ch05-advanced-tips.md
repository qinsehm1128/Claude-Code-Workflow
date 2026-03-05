# Advanced Tips

## One-Line Positioning

**Drive AI tool orchestration with natural language** — Semantic CLI invocation, multi-model collaboration, intelligent memory management.

---

## 5.1 Semantic Tool Orchestration

### 5.1.1 Core Concept

CCW's CLI tools are **AI-automated capability extensions**. Users simply describe needs in natural language, and AI automatically selects and invokes the appropriate tools.

::: tip Key Understanding
- User says: "Use Gemini to analyze this code"
- AI automatically: Invokes Gemini CLI + applies analysis rules + returns results
- Users don't need to know `ccw cli` command details
:::

### 5.1.2 Available Tools & Capabilities

| Tool | Strengths | Typical Trigger Words |
| --- | --- | --- |
| **Gemini** | Deep analysis, architecture design, bug diagnosis | "use Gemini", "deep understanding" |
| **Qwen** | Code generation, feature implementation | "let Qwen implement", "code generation" |
| **Codex** | Code review, Git operations | "use Codex", "code review" |
| **OpenCode** | Open-source multi-model | "use OpenCode" |

### 5.1.3 Semantic Trigger Examples

Simply express naturally in conversation, AI will automatically invoke the corresponding tool:

| Goal | User Semantic Description | AI Auto-Executes |
| :--- | :--- | :--- |
| **Security Assessment** | "Use Gemini to scan auth module for security vulnerabilities" | Gemini + Security analysis rule |
| **Code Implementation** | "Let Qwen implement a rate limiting middleware" | Qwen + Feature implementation rule |
| **Code Review** | "Use Codex to review this PR's changes" | Codex + Review rule |
| **Bug Diagnosis** | "Use Gemini to analyze the root cause of this memory leak" | Gemini + Diagnosis rule |

### 5.1.4 Underlying Configuration (Optional)

AI tool invocation configuration file at `~/.claude/cli-tools.json`:

```json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "Debug"]
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "tags": ["implementation"]
    }
  }
}
```

::: info Note
Tags help AI automatically select the most suitable tool based on task type. Users typically don't need to modify this configuration.
:::

---

## 5.2 Multi-Model Collaboration

### 5.2.1 Collaboration Patterns

Through semantic descriptions, multiple AI models can work together:

| Pattern | Description Style | Use Case |
| --- | --- | --- |
| **Collaborative** | "Let Gemini and Codex jointly analyze architecture issues" | Multi-perspective analysis of the same problem |
| **Pipeline** | "Gemini designs, Qwen implements, Codex reviews" | Stage-by-stage complex task completion |
| **Iterative** | "Use Gemini to diagnose, Codex to fix, iterate until tests pass" | Bug fix loop |
| **Parallel** | "Let Gemini and Qwen each provide optimization suggestions" | Compare different approaches |

### 5.2.2 Semantic Examples

**Collaborative Analysis**
```
User: Let Gemini and Codex jointly analyze security and performance of src/auth module
AI: [Automatically invokes both models, synthesizes analysis results]
```

**Pipeline Development**
```
User: I need to implement a WebSocket real-time notification feature.
      Please have Gemini design the architecture, Qwen implement the code, and Codex review.
AI: [Sequentially invokes three models, completing design→implement→review flow]
```

**Iterative Fix**
```
User: Tests failed. Use Gemini to diagnose the issue, have Qwen fix it, loop until tests pass.
AI: [Automatically iterates diagnose-fix loop until problem is resolved]
```

### 5.2.3 Model Selection Guide

| Task Type | Recommended Model | Reason |
| --- | --- | --- |
| **Architecture Analysis** | Gemini | Strong at deep understanding and pattern recognition |
| **Bug Diagnosis** | Gemini | Powerful root cause analysis capability |
| **Code Generation** | Qwen | High code generation efficiency |
| **Code Review** | Codex | Good Git integration, standard review format |
| **Long Text Processing** | Claude | Large context window |

---

## 5.3 Intelligent Memory Management

### 5.3.1 Memory System Overview

CCW's memory system is an **AI self-managed** knowledge base, including:

| Category | Purpose | Example |
| --- | --- | --- |
| **learnings** | Learning insights | New technology usage experience, best practices |
| **decisions** | Architecture decisions | Technology selection rationale, design tradeoffs |
| **conventions** | Coding standards | Naming conventions, code style |
| **issues** | Known issues | Bug records, limitations |

### 5.3.2 Automatic Memory Usage

AI automatically retrieves and applies relevant memories when executing tasks:

```
User: Help me implement the user authentication module
AI: [Automatically retrieves authentication-related decisions and conventions from memory]
    Based on previous technical decisions, we use JWT + bcrypt approach...
```

### 5.3.3 How Users Guide Memory

While AI manages memory automatically, users can actively reinforce:

**Explicitly Request to Remember**
```
User: Remember this naming convention: all API routes use kebab-case
AI: [Stores this convention in conventions memory]
```

**Request to Review Decisions**
```
User: Why did we choose Redis for caching before?
AI: [Retrieves from decisions memory and responds]
```

**Correct Wrong Memory**
```
User: The previous decision changed, we now use PostgreSQL instead of MongoDB
AI: [Updates related decision memory]
```

### 5.3.4 Memory File Locations

- **Global Memory**: `~/.claude/projects/{project-name}/memory/`
- **Project Memory**: `.claude/memory/` or `MEMORY.md`

---

## 5.4 Hook Automation

### 5.4.1 Hook Concept

Hooks are automated processes before and after AI executes tasks, users don't need to trigger manually:

| Hook Type | Trigger Time | Purpose |
| --- | --- | --- |
| **pre-command** | Before AI thinking | Load project specs, retrieve memory |
| **post-command** | After AI completion | Save decisions, update index |
| **pre-commit** | Before Git commit | Code review, standard checks |

### 5.4.2 Configuration Example

Configure in `.claude/hooks.json`:

```json
{
  "pre-command": [
    {
      "name": "load-project-specs",
      "description": "Load project specifications",
      "command": "cat .workflow/specs/project-constraints.md"
    }
  ],
  "post-command": [
    {
      "name": "save-decisions",
      "description": "Save important decisions",
      "command": "mcp__ccw-tools__core_memory(operation=\"import\", text=\"{content}\")"
    }
  ]
}
```

---

## 5.5 ACE Semantic Search

### 5.5.1 What is ACE

ACE (Augment Context Engine) is AI's **code perception capability**, enabling AI to understand the entire codebase semantically.

### 5.5.2 How AI Uses ACE

When users ask questions, AI automatically uses ACE to search for relevant code:

```
User: How is the authentication flow implemented?
AI: [Uses ACE semantic search for auth-related code]
    Based on code analysis, the authentication flow is...
```

### 5.5.3 Configuration Reference

| Configuration Method | Link |
| --- | --- |
| **Official Docs** | [Augment MCP Documentation](https://docs.augmentcode.com/context-services/mcp/overview) |
| **Proxy Tool** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

---

## 5.6 Semantic Prompt Cheatsheet

### Common Semantic Patterns

| Goal | Semantic Description Example |
| --- | --- |
| **Analyze Code** | "Use Gemini to analyze the architecture design of src/auth" |
| **Security Audit** | "Use Gemini to scan for security vulnerabilities, focus on OWASP Top 10" |
| **Implement Feature** | "Let Qwen implement a cached user repository" |
| **Code Review** | "Use Codex to review recent changes" |
| **Bug Diagnosis** | "Use Gemini to analyze the root cause of this memory leak" |
| **Multi-Model Collaboration** | "Gemini designs, Qwen implements, Codex reviews" |
| **Remember Convention** | "Remember: all APIs use RESTful style" |
| **Review Decision** | "Why did we choose this tech stack before?" |

### Collaboration Pattern Cheatsheet

| Pattern | Semantic Example |
| --- | --- |
| **Collaborative** | "Let Gemini and Codex jointly analyze..." |
| **Pipeline** | "Gemini designs, Qwen implements, Codex reviews" |
| **Iterative** | "Diagnose and fix until tests pass" |
| **Parallel** | "Let multiple models each provide suggestions" |

---

## Next Steps

- [Best Practices](ch06-best-practices.md) — Team collaboration standards, code review process, documentation maintenance strategy
