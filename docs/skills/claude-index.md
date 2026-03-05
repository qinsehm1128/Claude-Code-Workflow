---
适用CLI: claude
分类: specialized
---

# Claude Skills Overview

## One-Liner

**Claude Skills is an AI skill system for VS Code extension** — Through five categories (team collaboration, workflow, memory management, code review, and meta-skills), it enables complete development flow automation from specification to implementation to testing to review.

## vs Traditional Methods Comparison

| Dimension | Traditional Methods | **Claude Code Workflow** |
|-----------|---------------------|-----------------|
| Task orchestration | Manual management | Automatic pipeline orchestration |
| AI models | Single model | Multi-model parallel collaboration |
| Code review | Manual review | 6-dimension automatic review |
| Knowledge management | Lost per session | Cross-session persistence |
| Development workflow | Human-driven | AI-driven automation |

## Skills Categories

| Category | Document | Description |
|----------|----------|-------------|
| **Team Collaboration** | [collaboration.md](./claude-collaboration.md) | Multi-role collaborative work orchestration system |
| **Workflow** | [workflow.md](./claude-workflow.md) | Task orchestration and execution pipeline |
| **Memory Management** | [memory.md](./claude-memory.md) | Cross-session knowledge persistence |
| **Code Review** | [review.md](./claude-review.md) | Multi-dimensional code quality analysis |
| **Meta-Skills** | [meta.md](./claude-meta.md) | Create and manage other skills |

## Core Concepts Overview

| Concept | Description | Location/Command |
|---------|-------------|------------------|
| **team-coordinate** | Universal team coordinator (dynamic roles) | `/team-coordinate` |
| **team-lifecycle** | Full lifecycle team | `/team-lifecycle` |
| **team-planex** | Plan-and-execute team | `/team-planex` |
| **workflow-plan** | Unified planning skill | `/workflow-plan` |
| **workflow-execute** | Agent-coordinated execution | `/workflow-execute` |
| **memory-capture** | Memory capture | `/memory-capture` |
| **review-code** | Multi-dimensional code review | `/review-code` |
| **brainstorm** | Brainstorming | `/brainstorm` |
| **spec-generator** | Specification generator | `/spec-generator` |
| **ccw-help** | Command help system | `/ccw-help` |

## Team Collaboration Skills

### Team Architecture Models

Claude Code Workflow supports two team architecture models:

1. **team-coordinate** (Universal Coordinator)
   - Only coordinator is built-in
   - All worker roles are dynamically generated at runtime
   - Supports dynamic teams for any task type

2. **team-lifecycle** (Full Lifecycle Team)
   - Based on team-worker agent architecture
   - All workers share the same agent definition
   - Role-specific Phase 2-4 loaded from markdown specs

### Team Types Comparison

| Team Type | Roles | Use Case |
|-----------|-------|----------|
| **team-coordinate** | coordinator + dynamic roles | General task orchestration |
| **team-lifecycle** | 9 predefined roles | Spec→Impl→Test→Review |
| **team-planex** | planner + executor | Plan-and-execute in parallel |
| **team-review** | coordinator + scanner + reviewer + fixer | Code review and fix |
| **team-testing** | coordinator + strategist + generator + executor + analyst | Test coverage |

## Workflow Skills

### Workflow Levels

| Level | Name | Workflow | Use Case |
|-------|------|----------|----------|
| Level 1 | Lite-Lite-Lite | lite-plan | Super simple quick tasks |
| Level 2 | Rapid | plan → execute | Bug fixes, simple features |
| Level 2.5 | Rapid-to-Issue | plan → issue:new | From rapid planning to Issue |
| Level 3 | Coupled | plan → execute | Complex features (plan+execute+review+test) |
| Level 4 | Full | brainstorm → plan → execute | Exploratory tasks |
| With-File | Documented exploration | analyze/brainstorm/debug-with-file | Multi-CLI collaborative analysis |

### Workflow Selection Guide

```
Task Complexity
    ↓
┌───┴────┬────────────┬─────────────┐
│        │            │             │
Simple   Medium      Complex      Exploratory
│        │            │             │
↓        ↓            ↓             ↓
lite-plan  plan        plan         brainstorm
          ↓            ↓             ↓
       execute    brainstorm     plan
                     ↓             ↓
                  plan         execute
                     ↓
                  execute
```

## Memory Management Skills

### Memory Types

| Type | Format | Use Case |
|------|--------|----------|
| **Session compression** | Structured text | Full context save after long conversations |
| **Quick notes** | Notes with tags | Quick capture of ideas and insights |

### Memory Storage

```
memory/
├── MEMORY.md           # Main memory file (line limit)
├── debugging.md        # Debugging patterns and insights
├── patterns.md         # Code patterns and conventions
├── conventions.md      # Project conventions
└── [topic].md         # Other topic files
```

## Code Review Skills

### Review Dimensions

| Dimension | Check Points | Tool |
|-----------|--------------|------|
| **Correctness** | Logic correctness, boundary conditions | review-code |
| **Readability** | Naming, function length, comments | review-code |
| **Performance** | Algorithm complexity, I/O optimization | review-code |
| **Security** | Injection, sensitive data | review-code |
| **Testing** | Test coverage adequacy | review-code |
| **Architecture** | Design patterns, layering | review-code |

### Issue Severity Levels

| Level | Prefix | Description | Required Action |
|-------|--------|-------------|-----------------|
| Critical | [C] | Blocking issue | Must fix before merge |
| High | [H] | Important issue | Should fix |
| Medium | [M] | Suggested improvement | Consider fixing |
| Low | [L] | Optional optimization | Nice to have |
| Info | [I] | Informational suggestion | Reference only |

## Meta-Skills

### Meta-Skills List

| Skill | Function | Use Case |
|-------|----------|----------|
| **spec-generator** | 6-stage spec generation | Product brief, PRD, Architecture, Epics |
| **brainstorm** | Multi-role parallel analysis | Multi-perspective brainstorming |
| **skill-generator** | Skill creation | Generate new Claude Skills |
| **skill-tuning** | Skill optimization | Diagnose and optimize |
| **ccw-help** | Command help | Search, recommend, document |
| **command-generator** | Command generation | Generate Claude commands |
| **issue-manage** | Issue management | Issue creation and status management |

## Quick Start

### 1. Choose Team Type

```bash
# General tasks
/team-coordinate "Build user authentication system"

# Full feature development
/team-lifecycle "Create REST API for user management"

# Issue batch processing
/team-planex ISS-20260215-001 ISS-20260215-002

# Code review
/team-review src/auth/**
```

### 2. Choose Workflow

```bash
# Quick task
/workflow-lite-planex "Fix login bug"

# Full development
/workflow-plan "Add user notifications"
/workflow-execute

# TDD development
/workflow-tdd-plan "Implement payment processing"
```

### 3. Use Memory Management

```bash
# Compress session
/memory-capture compact

# Quick note
/memory-capture tip "Use Redis for rate limiting" --tag config
```

### 4. Code Review

```bash
# Full review (6 dimensions)
/review-code src/auth/**

# Review specific dimensions
/review-code --dimensions=sec,perf src/api/
```

### 5. Meta-Skills

```bash
# Generate specification
/spec-generator "Build real-time collaboration platform"

# Brainstorm
/brainstorm "Design payment system" --count 3

# Get help
/ccw "Add JWT authentication"
```

## Best Practices

1. **Team Selection**:
   - General tasks → `team-coordinate`
   - Full features → `team-lifecycle`
   - Issue batching → `team-planex`
   - Code review → `team-review`
   - Test coverage → `team-testing`

2. **Workflow Selection**:
   - Super simple → `workflow-lite-planex`
   - Complex features → `workflow-plan` → `workflow-execute`
   - TDD → `workflow-tdd-plan`
   - Test fixes → `workflow-test-fix`

3. **Memory Management**:
   - Use `memory-capture compact` after long conversations
   - Use `memory-capture tip` for quick idea capture
   - Regularly use `memory-manage full` to merge and compress

4. **Code Review**:
   - Read specification documents completely before reviewing
   - Use `--dimensions` to specify focus areas
   - Quick scan first to identify high-risk areas, then deep review

5. **Meta-Skills**:
   - Use `spec-generator` for complete spec packages
   - Use `brainstorm` for multi-perspective analysis
   - Use `ccw-help` to find appropriate commands

## Related Documentation

- [Claude Commands](../commands/claude/)
- [Codex Skills](./codex-index.md)
- [Features](../features/spec)

## Statistics

| Category | Count |
|----------|-------|
| Team Collaboration Skills | 5 |
| Workflow Skills | 8 |
| Memory Management Skills | 2 |
| Code Review Skills | 2 |
| Meta-Skills | 7 |
| **Total** | **24+** |
