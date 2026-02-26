---
name: team-review
description: "Unified team skill for code scanning, vulnerability review, optimization suggestions, and automated fix. 4-role team: coordinator, scanner, reviewer, fixer. Triggers on team-review."
allowed-tools: Task, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, TaskGet, Read, Write, Edit, Bash, Glob, Grep, Skill, mcp__ace-tool__search_context
---

# Team Review — Role Router

Single entry point for code scanning, review, and fix. Parses `$ARGUMENTS`, extracts role, and dispatches to the corresponding `role.md`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SKILL.md (Role Router)                                     │
│  Parse $ARGUMENTS → Extract --role → Dispatch to role.md    │
│  No --role → Dispatch to coordinator                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
   ┌───────────┬───────────┼───────────┐
   ↓           ↓           ↓           ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ coord  │ │scanner │ │reviewer│ │ fixer  │
│ (RC-*) │ │(SCAN-*)│ │(REV-*) │ │(FIX-*) │
└────────┘ └────────┘ └────────┘ └────────┘
```

## Pipeline (CP-1 Linear)

```
coordinator dispatch
  → SCAN-* (scanner: toolchain + LLM scan)
  → REV-*  (reviewer: deep analysis + report)
  → [user confirm]
  → FIX-*  (fixer: plan + execute + verify)
```

## Available Roles

| Role | Prefix | Type | File |
|------|--------|------|------|
| coordinator | RC | orchestration | roles/coordinator/role.md |
| scanner | SCAN | read-only-analysis | roles/scanner/role.md |
| reviewer | REV | read-only-analysis | roles/reviewer/role.md |
| fixer | FIX | code-generation | roles/fixer/role.md |

## Role Router

```javascript
const VALID_ROLES = {
  "coordinator": "roles/coordinator/role.md",
  "scanner":     "roles/scanner/role.md",
  "reviewer":    "roles/reviewer/role.md",
  "fixer":       "roles/fixer/role.md"
}

// 1. Auto mode detection
const autoYes = /\b(-y|--yes)\b/.test($ARGUMENTS)

// 2. Extract role
const roleMatch = $ARGUMENTS.match(/--role[=\s]+(\w+)/)
const role = roleMatch ? roleMatch[1] : null

if (role && VALID_ROLES[role]) {
  // Explicit role → dispatch directly
  Read(VALID_ROLES[role]) → Execute with $ARGUMENTS
} else if (!role) {
  // No --role → coordinator handles all routing
  Read("roles/coordinator/role.md") → Execute with $ARGUMENTS
} else {
  Error(`Unknown role "${role}". Available: ${Object.keys(VALID_ROLES).join(", ")}`)
}
```

## Usage

```bash
# Via coordinator (auto pipeline)
Skill(skill="team-review", args="src/auth/**")                    # scan + review
Skill(skill="team-review", args="--full src/auth/**")             # scan + review + fix
Skill(skill="team-review", args="--fix .review/review-*.json")    # fix only
Skill(skill="team-review", args="-q src/auth/**")                 # quick scan only

# Direct role invocation
Skill(skill="team-review", args="--role=scanner src/auth/**")
Skill(skill="team-review", args="--role=reviewer --input scan-result.json")
Skill(skill="team-review", args="--role=fixer --input fix-manifest.json")

# Flags (all modes)
--dimensions=sec,cor,perf,maint    # custom dimensions (default: all 4)
-y / --yes                         # skip confirmations
-q / --quick                       # quick scan mode
--full                             # full pipeline (scan → review → fix)
--fix                              # fix mode only
```

## Coordinator Spawn Template

```javascript
// Coordinator spawns worker roles via Skill
Skill(skill="team-review", args="--role=scanner ${target} ${flags}")
Skill(skill="team-review", args="--role=reviewer --input ${scan_output} ${flags}")
Skill(skill="team-review", args="--role=fixer --input ${fix_manifest} ${flags}")
```

## Shared Infrastructure

| Component | Location |
|-----------|----------|
| Session directory | `.workflow/.team-review/{workflow_id}/` |
| Shared memory | `shared-memory.json` in session dir |
| Team config | `specs/team-config.json` |
| Finding schema | `specs/finding-schema.json` |
| Dimensions | `specs/dimensions.md` |

## Error Handling

| Error | Action |
|-------|--------|
| Unknown --role value | Error with available roles list |
| Role file not found | Error with expected file path |
| Invalid flags | Warn and continue with defaults |
| No target specified (no --role) | AskUserQuestion to clarify |

## Execution Rules

1. **Parse first**: Extract --role and flags from $ARGUMENTS before anything else
2. **Progressive loading**: Read ONLY the matched role.md, not all four
3. **Full delegation**: Role.md owns entire execution — do not add logic here
4. **Self-contained**: Each role.md includes its own message bus, task lifecycle, toolbox
5. **DO NOT STOP**: Continuous execution until role completes all 5 phases
