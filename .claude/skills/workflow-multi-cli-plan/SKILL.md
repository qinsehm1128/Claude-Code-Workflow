---
name: workflow-multi-cli-plan
description: Multi-CLI collaborative planning and execution skill - route to multi-cli-plan or lite-execute with prompt enhancement. Triggers on "workflow:multi-cli-plan", "workflow:lite-execute".
allowed-tools: Skill, Task, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep, mcp__ace-tool__search_context
---

# Workflow Multi-CLI Plan

Unified multi-CLI collaborative planning and execution skill. Routes to multi-cli-plan (ACE context + multi-CLI discussion + plan generation) or lite-execute (execution engine) based on trigger, with prompt enhancement for both modes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  SKILL.md (Router + Prompt Enhancement)                  │
│  → Detect mode → Enhance prompt → Dispatch to phase     │
└──────────────────────┬──────────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           ↓                       ↓
     ┌──────────────┐        ┌───────────┐
     │multi-cli-plan│        │lite-execute│
     │   Phase 1    │        │  Phase 2   │
     │  Plan+Exec   │─handoff→│ Standalone │
     └──────────────┘        └───────────┘
```

## Mode Detection & Routing

```javascript
const args = $ARGUMENTS
const mode = detectMode()

function detectMode() {
  if (skillName === 'workflow:lite-execute') return 'execute'
  return 'plan'  // default: workflow:multi-cli-plan
}
```

**Routing Table**:

| Trigger | Mode | Phase Document | Description |
|---------|------|----------------|-------------|
| `workflow:multi-cli-plan` | plan | [phases/01-multi-cli-plan.md](phases/01-multi-cli-plan.md) | Multi-CLI collaborative planning (ACE context → discussion → plan → execute) |
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
  // Read phases/01-multi-cli-plan.md and execute
} else {
  // Read phases/02-lite-execute.md and execute
}
```

## Execution Flow

### Plan Mode (workflow:multi-cli-plan)

```
1. Parse flags (-y/--yes, --max-rounds, --tools, --mode) and task description
2. Enhance prompt with project context availability
3. Read phases/01-multi-cli-plan.md
4. Execute multi-cli-plan pipeline (Phase 1-5 within the phase doc)
5. Phase 5 internally calls workflow:lite-execute via Skill handoff
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
# Multi-CLI plan mode
/workflow:multi-cli-plan "Implement user authentication"
/workflow:multi-cli-plan --yes "Add dark mode support"
/workflow:multi-cli-plan "Refactor payment module" --max-rounds=3 --tools=gemini,codex

# Execute mode (standalone)
/workflow:lite-execute "Add unit tests for auth"     # Prompt description
/workflow:lite-execute plan.json                     # File input
/workflow:lite-execute --in-memory                   # Called by multi-cli-plan internally
```

## Phase Reference Documents

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-multi-cli-plan.md](phases/01-multi-cli-plan.md) | Complete multi-CLI planning pipeline: ACE context, iterative discussion, options, user decision, plan generation, handoff |
| 2 | [phases/02-lite-execute.md](phases/02-lite-execute.md) | Complete execution engine: input modes, task grouping, batch execution, code review |
