---
name: workflow-lite-plan
description: Lightweight planning and execution skill - route to lite-plan or lite-execute with prompt enhancement. Triggers on "workflow:lite-plan", "workflow:lite-execute".
allowed-tools: Skill, Task, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Lite-Plan

Unified lightweight planning and execution skill. Routes to lite-plan (planning pipeline) or lite-execute (execution engine) based on trigger, with prompt enhancement for both modes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  SKILL.md (Router + Prompt Enhancement)              │
│  → Detect mode → Enhance prompt → Dispatch to phase │
└──────────────────────┬──────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           ↓                       ↓
     ┌───────────┐           ┌───────────┐
     │ lite-plan │           │lite-execute│
     │ Phase 1   │           │ Phase 2    │
     │ Plan+Exec │──handoff─→│ Standalone │
     └───────────┘           └───────────┘
```

## Mode Detection & Routing

```javascript
const args = $ARGUMENTS
const mode = detectMode()

function detectMode() {
  if (skillName === 'workflow:lite-execute') return 'execute'
  return 'plan'  // default: workflow:lite-plan
}
```

**Routing Table**:

| Trigger | Mode | Phase Document | Description |
|---------|------|----------------|-------------|
| `workflow:lite-plan` | plan | [phases/01-lite-plan.md](phases/01-lite-plan.md) | Full planning pipeline (explore → plan → confirm → execute) |
| `workflow:lite-execute` | execute | [phases/02-lite-execute.md](phases/02-lite-execute.md) | Standalone execution (in-memory / prompt / file) |

## Prompt Enhancement

Before dispatching to the target phase, enhance context:

```javascript
// Step 1: Check for project context files
const hasProjectTech = fileExists('.workflow/project-tech.json')
const hasProjectGuidelines = fileExists('.workflow/project-guidelines.json')

// Step 2: Log available context
if (hasProjectTech) {
  console.log('Project tech context available: .workflow/project-tech.json')
}
if (hasProjectGuidelines) {
  console.log('Project guidelines available: .workflow/project-guidelines.json')
}

// Step 3: Dispatch to phase
if (mode === 'plan') {
  // Read phases/01-lite-plan.md and execute
} else {
  // Read phases/02-lite-execute.md and execute
}
```

## Execution Flow

### Plan Mode (workflow:lite-plan)

```
1. Parse flags (-y/--yes, -e/--explore) and task description
2. Enhance prompt with project context availability
3. Read phases/01-lite-plan.md
4. Execute lite-plan pipeline (Phase 1-5 within the phase doc)
5. lite-plan Phase 5 internally calls workflow:lite-execute via Skill handoff
```

### Execute Mode (workflow:lite-execute)

```
1. Parse flags (--in-memory, -y/--yes) and input
2. Enhance prompt with project context availability
3. Read phases/02-lite-execute.md
4. Execute lite-execute pipeline (input detection → execution → review)
```

## Usage

```bash
# Plan mode
/workflow:lite-plan "实现JWT认证"                    # Interactive
/workflow:lite-plan --yes "实现JWT认证"              # Auto mode
/workflow:lite-plan -y -e "优化数据库查询性能"       # Auto + force exploration

# Execute mode (standalone)
/workflow:lite-execute "Add unit tests for auth"     # Prompt description
/workflow:lite-execute plan.json                     # File input
/workflow:lite-execute --in-memory                   # Called by lite-plan internally
```

## Phase Reference Documents

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-lite-plan.md](phases/01-lite-plan.md) | Complete planning pipeline: exploration, clarification, planning, confirmation, handoff |
| 2 | [phases/02-lite-execute.md](phases/02-lite-execute.md) | Complete execution engine: input modes, task grouping, batch execution, code review |
