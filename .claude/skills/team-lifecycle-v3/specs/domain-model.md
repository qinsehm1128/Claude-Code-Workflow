# Domain Model

This document defines the core entities, schemas, relationships, and state machines for Team Lifecycle v3.

## 1. Core Entities

### 1.1 Task

A **Task** represents a unit of work assigned to a specific role. Tasks have dependencies, priorities, and lifecycle states.

**Definition**: An atomic work item with a unique identifier, assigned role, execution phase, dependency constraints, and status tracking.

**Fields**:
- `id` (string): Unique task identifier following pattern `{PREFIX}-{NNN}` (e.g., `IMPL-001`, `TEST-001`)
- `role` (string): Role name responsible for execution (e.g., `executor`, `tester`, `reviewer`)
- `phase` (string): Execution phase (`spec`, `impl`, `test`, `review`)
- `dependencies` (array): List of task IDs that must complete before this task can start (blockedBy)
- `status` (enum): Current task state (`pending`, `ready`, `in_progress`, `completed`, `failed`)
- `priority` (enum): Execution priority (`P0`, `P1`, `P2`)
- `metadata` (object): Additional context (created_at, updated_at, attempt_count, error_message)

### 1.2 Artifact

An **Artifact** represents a deliverable produced by a worker, with validation status and dependency tracking.

**Definition**: A versioned output (document, code, test suite) with a manifest describing its type, creator, validation status, and dependencies.

**Fields**:
- `artifact_id` (string): Unique artifact identifier (e.g., `product-brief-v1`, `impl-auth-service`)
- `artifact_type` (string): Type classification (`document`, `code`, `test`, `config`, `report`)
- `path` (string): File system path relative to session directory
- `creator_role` (string): Role that produced this artifact
- `version` (string): Semantic version (e.g., `1.0`, `1.1`)
- `validation_status` (enum): Validation state (`pending`, `passed`, `failed`)
- `validation_summary` (string): Human-readable validation result
- `dependencies` (array): List of artifact IDs this artifact depends on
- `metadata` (object): Additional context (created_at, task_id, priority, file_size, checksum)

### 1.3 Role

A **Role** defines a specialized agent's capabilities, task prefix, and injection trigger.

**Definition**: A specification for an agent type, including its responsibilities, task naming convention, and conditions for activation.

**Fields**:
- `name` (string): Role identifier (e.g., `executor`, `security-expert`, `orchestrator`)
- `type` (enum): Role classification (`coordinator`, `pipeline`, `specialist`, `utility`)
- `task_prefix` (string): Task ID prefix pattern (e.g., `IMPL-*`, `SECURITY-*`, `ORCH-*`)
- `injection_trigger` (enum): Activation condition (`always`, `complexity`, `keywords`, `manual`)
- `injection_criteria` (object): Specific trigger conditions (keywords, complexity_threshold)
- `capabilities` (array): List of capabilities (e.g., `code_generation`, `security_audit`, `performance_analysis`)
- `inner_loop` (boolean): Whether role supports iterative refinement
- `phase_execution` (array): List of execution phases (1-5)

### 1.4 Session

A **Session** represents a complete workflow execution instance with persistent state.

**Definition**: A stateful execution context that tracks all tasks, artifacts, and coordination state for a single workflow run.

**Fields**:
- `session_id` (string): Unique session identifier (e.g., `TLS-auth-impl-20260305`)
- `slug` (string): Human-readable short name derived from task description
- `created_at` (string): ISO8601 timestamp of session creation
- `updated_at` (string): ISO8601 timestamp of last state change
- `status` (enum): Session lifecycle state (`created`, `active`, `paused`, `completed`, `archived`, `failed`)
- `pipeline_type` (enum): Selected pipeline (`spec-only`, `impl-only`, `full-lifecycle`, `enhanced-parallel`)
- `artifact_registry` (object): Map of artifact_id → Artifact manifest
- `task_list` (array): Ordered list of Task objects
- `injected_roles` (array): List of dynamically injected specialist roles
- `checkpoint_history` (array): Record of user checkpoint interactions
- `session_directory` (string): File system path to session workspace

---

## 2. Entity Schemas

### 2.1 Task Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Task",
  "required": ["id", "role", "phase", "status", "priority"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[A-Z]+-[0-9]{3}$",
      "description": "Unique task identifier (e.g., IMPL-001)"
    },
    "role": {
      "type": "string",
      "description": "Role name responsible for execution"
    },
    "phase": {
      "type": "string",
      "enum": ["spec", "impl", "test", "review"],
      "description": "Execution phase"
    },
    "dependencies": {
      "type": "array",
      "items": {"type": "string", "pattern": "^[A-Z]+-[0-9]{3}$"},
      "default": [],
      "description": "List of task IDs that must complete first"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "ready", "in_progress", "completed", "failed"],
      "description": "Current task state"
    },
    "priority": {
      "type": "string",
      "enum": ["P0", "P1", "P2"],
      "description": "Execution priority (P0 = highest)"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "created_at": {"type": "string", "format": "date-time"},
        "updated_at": {"type": "string", "format": "date-time"},
        "attempt_count": {"type": "integer", "minimum": 0},
        "error_message": {"type": "string"}
      }
    }
  }
}
```

### 2.2 Artifact Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Artifact",
  "required": ["artifact_id", "artifact_type", "path", "creator_role", "validation_status"],
  "properties": {
    "artifact_id": {
      "type": "string",
      "description": "Unique artifact identifier"
    },
    "artifact_type": {
      "type": "string",
      "enum": ["document", "code", "test", "config", "report"],
      "description": "Type classification"
    },
    "path": {
      "type": "string",
      "description": "File system path relative to session directory"
    },
    "creator_role": {
      "type": "string",
      "description": "Role that produced this artifact"
    },
    "version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+$",
      "description": "Semantic version (e.g., 1.0)"
    },
    "validation_status": {
      "type": "string",
      "enum": ["pending", "passed", "failed"],
      "description": "Validation state"
    },
    "validation_summary": {
      "type": "string",
      "description": "Human-readable validation result"
    },
    "dependencies": {
      "type": "array",
      "items": {"type": "string"},
      "default": [],
      "description": "List of artifact IDs this depends on"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "created_at": {"type": "string", "format": "date-time"},
        "task_id": {"type": "string", "pattern": "^[A-Z]+-[0-9]{3}$"},
        "priority": {"type": "string", "enum": ["P0", "P1", "P2"]},
        "file_size": {"type": "integer", "minimum": 0},
        "checksum": {"type": "string"}
      }
    }
  }
}
```

### 2.3 Role Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Role",
  "required": ["name", "type", "task_prefix", "injection_trigger"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Role identifier"
    },
    "type": {
      "type": "string",
      "enum": ["coordinator", "pipeline", "specialist", "utility"],
      "description": "Role classification"
    },
    "task_prefix": {
      "type": "string",
      "pattern": "^[A-Z]+-\\*$",
      "description": "Task ID prefix pattern (e.g., IMPL-*)"
    },
    "injection_trigger": {
      "type": "string",
      "enum": ["always", "complexity", "keywords", "manual"],
      "description": "Activation condition"
    },
    "injection_criteria": {
      "type": "object",
      "properties": {
        "keywords": {"type": "array", "items": {"type": "string"}},
        "complexity_threshold": {"type": "string", "enum": ["low", "medium", "high"]}
      }
    },
    "capabilities": {
      "type": "array",
      "items": {"type": "string"},
      "description": "List of capabilities"
    },
    "inner_loop": {
      "type": "boolean",
      "description": "Supports iterative refinement"
    },
    "phase_execution": {
      "type": "array",
      "items": {"type": "integer", "minimum": 1, "maximum": 5},
      "description": "Execution phases (1-5)"
    }
  }
}
```

### 2.4 Session Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Session",
  "required": ["session_id", "slug", "status", "pipeline_type"],
  "properties": {
    "session_id": {
      "type": "string",
      "pattern": "^TLS-[a-z0-9-]+-[0-9]{8}$",
      "description": "Unique session identifier"
    },
    "slug": {
      "type": "string",
      "description": "Human-readable short name"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "Session creation timestamp"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time",
      "description": "Last state change timestamp"
    },
    "status": {
      "type": "string",
      "enum": ["created", "active", "paused", "completed", "archived", "failed"],
      "description": "Session lifecycle state"
    },
    "pipeline_type": {
      "type": "string",
      "enum": ["spec-only", "impl-only", "full-lifecycle", "enhanced-parallel"],
      "description": "Selected pipeline"
    },
    "artifact_registry": {
      "type": "object",
      "additionalProperties": {"$ref": "#/definitions/Artifact"},
      "description": "Map of artifact_id to Artifact manifest"
    },
    "task_list": {
      "type": "array",
      "items": {"$ref": "#/definitions/Task"},
      "description": "Ordered list of tasks"
    },
    "injected_roles": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Dynamically injected specialist roles"
    },
    "checkpoint_history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "checkpoint_id": {"type": "string"},
          "timestamp": {"type": "string", "format": "date-time"},
          "user_action": {"type": "string", "enum": ["resume", "improve", "revise", "recheck", "feedback"]},
          "context": {"type": "string"}
        }
      }
    },
    "session_directory": {
      "type": "string",
      "description": "File system path to session workspace"
    }
  }
}
```

---

## 3. Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                          Session                                 │
│  - session_id                                                    │
│  - status: created|active|paused|completed|archived|failed       │
│  - pipeline_type: spec-only|impl-only|full-lifecycle|enhanced    │
├─────────────────────────────────────────────────────────────────┤
│  artifact_registry: Map<artifact_id, Artifact>                   │
│  task_list: Task[]                                               │
│  injected_roles: string[]                                        │
│  checkpoint_history: Checkpoint[]                                │
└──────────────┬──────────────────────────────┬───────────────────┘
               │                              │
               │ 1:N                          │ 1:N
               ▼                              ▼
       ┌───────────────┐              ┌──────────────┐
       │   Artifact    │              │     Task     │
       ├───────────────┤              ├──────────────┤
       │ artifact_id   │              │ id           │
       │ artifact_type │              │ role ────────┼──┐
       │ path          │              │ phase        │  │
       │ creator_role ─┼──┐           │ dependencies │  │ N:1
       │ validation_   │  │           │ status       │  │
       │   status      │  │           │ priority     │  │
       │ dependencies ─┼──┼───┐       └──────┬───────┘  │
       └───────────────┘  │   │              │          │
                          │   │              │ produces │
                          │   │              │ 1:1      │
                          │   │              ▼          │
                          │   │       ┌──────────────┐  │
                          │   └──────▶│   Artifact   │  │
                          │           └──────────────┘  │
                          │                             │
                          │ N:1                         │
                          ▼                             ▼
                   ┌──────────────┐            ┌──────────────┐
                   │     Role     │            │     Role     │
                   ├──────────────┤            ├──────────────┤
                   │ name         │            │ name         │
                   │ type         │            │ type         │
                   │ task_prefix  │            │ task_prefix  │
                   │ injection_   │            │ injection_   │
                   │   trigger    │            │   trigger    │
                   │ capabilities │            │ capabilities │
                   └──────────────┘            └──────────────┘
```

**Relationship Descriptions**:

1. **Session → Task** (1:N): A session contains multiple tasks in its task_list
2. **Session → Artifact** (1:N): A session tracks multiple artifacts in its artifact_registry
3. **Task → Role** (N:1): Each task is assigned to one role for execution
4. **Task → Artifact** (1:1): Each task produces one primary artifact upon completion
5. **Task → Task** (N:N): Tasks can depend on other tasks (dependencies field)
6. **Artifact → Role** (N:1): Each artifact is created by one role (creator_role)
7. **Artifact → Artifact** (N:N): Artifacts can depend on other artifacts (dependencies field)

---

## 4. State Machines

### 4.1 Task Status State Machine

```
                    ┌─────────────┐
                    │   pending   │ (initial state)
                    └──────┬──────┘
                           │
                           │ dependencies met
                           ▼
                    ┌─────────────┐
                    │    ready    │
                    └──────┬──────┘
                           │
                           │ worker spawned
                           ▼
                    ┌─────────────┐
                    │ in_progress │
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                │ success             │ failure
                ▼                     ▼
         ┌─────────────┐       ┌─────────────┐
         │  completed  │       │   failed    │
         └─────────────┘       └──────┬──────┘
                                      │
                                      │ retry (attempt_count++)
                                      ▼
                               ┌─────────────┐
                               │   pending   │
                               └─────────────┘
```

**State Transitions**:
- `pending → ready`: All dependencies completed
- `ready → in_progress`: Worker spawned by coordinator
- `in_progress → completed`: Worker reports success via SendMessage
- `in_progress → failed`: Worker reports failure or timeout
- `failed → pending`: Coordinator triggers retry (with exponential backoff)

**Terminal States**: `completed`

**Retry Logic**: Failed tasks return to `pending` with incremented `attempt_count`. Max retries configurable (default: 3).

### 4.2 Session Lifecycle State Machine

```
                    ┌─────────────┐
                    │   created   │ (initial state)
                    └──────┬──────┘
                           │
                           │ first task spawned
                           ▼
                    ┌─────────────┐
                    │    active   │◀──────────┐
                    └──────┬──────┘           │
                           │                  │
                ┌──────────┴──────────┐       │
                │                     │       │
                │ user pause          │ resume│
                ▼                     │       │
         ┌─────────────┐              │       │
         │   paused    │──────────────┘       │
         └─────────────┘                      │
                                              │
                    ┌─────────────┐           │
                    │    active   │───────────┘
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                │ all tasks done      │ unrecoverable error
                ▼                     ▼
         ┌─────────────┐       ┌─────────────┐
         │  completed  │       │   failed    │
         └──────┬──────┘       └──────┬──────┘
                │                     │
                │ archive             │ archive
                ▼                     ▼
         ┌─────────────┐       ┌─────────────┐
         │  archived   │       │  archived   │
         └─────────────┘       └─────────────┘
```

**State Transitions**:
- `created → active`: Coordinator spawns first batch of tasks
- `active → paused`: User issues pause command or checkpoint requires review
- `paused → active`: User issues resume command
- `active → completed`: All tasks in task_list reach `completed` status
- `active → failed`: Unrecoverable error (e.g., circular dependency, resource exhaustion)
- `completed → archived`: Session archived after retention period
- `failed → archived`: Failed session archived after investigation

**Terminal States**: `archived`

**Checkpoint Behavior**: Session transitions to `paused` at quality checkpoints (e.g., after QUALITY-001). User actions (`resume`, `improve`, `revise`) transition back to `active`.

### 4.3 Artifact Validation State Machine

```
                    ┌─────────────┐
                    │   pending   │ (initial state)
                    └──────┬──────┘
                           │
                           │ validation triggered
                           ▼
                    ┌─────────────┐
                    │  validating │
                    └──────┬──────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                │ validation success  │ validation failure
                ▼                     ▼
         ┌─────────────┐       ┌─────────────┐
         │   passed    │       │   failed    │
         └─────────────┘       └──────┬──────┘
                                      │
                                      │ fix applied
                                      ▼
                               ┌─────────────┐
                               │   pending   │
                               └─────────────┘
```

**State Transitions**:
- `pending → validating`: Coordinator triggers validation (e.g., quality gate check)
- `validating → passed`: Artifact meets quality criteria
- `validating → failed`: Artifact fails quality criteria
- `failed → pending`: Worker applies fix and re-submits artifact

**Terminal States**: `passed`

**Validation Gating**: Downstream tasks blocked until upstream artifacts reach `passed` state.

---

## 5. Invariants and Constraints

### 5.1 Task Invariants

1. **Unique Task IDs**: No two tasks in a session can have the same `id`
2. **Acyclic Dependencies**: Task dependency graph must be a DAG (no cycles)
3. **Valid Dependencies**: All task IDs in `dependencies` array must exist in session's task_list
4. **Priority Ordering**: P0 tasks execute before P1, P1 before P2 (within same dependency level)
5. **Single Active Worker**: A task can only be `in_progress` for one worker at a time

### 5.2 Artifact Invariants

1. **Unique Artifact IDs**: No two artifacts in a session can have the same `artifact_id`
2. **Valid Creator Role**: `creator_role` must match a defined role in the system
3. **Path Uniqueness**: No two artifacts can have the same `path` within a session
4. **Dependency Validity**: All artifact IDs in `dependencies` array must exist in artifact_registry

### 5.3 Session Invariants

1. **Unique Session IDs**: No two sessions can have the same `session_id`
2. **Monotonic Timestamps**: `updated_at` >= `created_at`
3. **Task Completeness**: All tasks in `task_list` must reach terminal state before session can be `completed`
4. **Artifact Registry Consistency**: All artifacts referenced in task metadata must exist in `artifact_registry`

---

## 6. Usage Examples

### 6.1 Creating a Task

```json
{
  "id": "IMPL-001",
  "role": "executor",
  "phase": "impl",
  "dependencies": ["PLAN-001"],
  "status": "pending",
  "priority": "P0",
  "metadata": {
    "created_at": "2026-03-05T10:00:00Z",
    "updated_at": "2026-03-05T10:00:00Z",
    "attempt_count": 0
  }
}
```

### 6.2 Creating an Artifact Manifest

```json
{
  "artifact_id": "auth-service-impl-v1",
  "artifact_type": "code",
  "path": "artifacts/auth-service.ts",
  "creator_role": "executor",
  "version": "1.0",
  "validation_status": "passed",
  "validation_summary": "Code review passed: 95% test coverage, no security issues",
  "dependencies": ["auth-service-plan-v1"],
  "metadata": {
    "created_at": "2026-03-05T11:30:00Z",
    "task_id": "IMPL-001",
    "priority": "P0",
    "file_size": 15420,
    "checksum": "sha256:abc123..."
  }
}
```

### 6.3 Session State Example

```json
{
  "session_id": "TLS-auth-impl-20260305",
  "slug": "auth-impl",
  "created_at": "2026-03-05T09:00:00Z",
  "updated_at": "2026-03-05T12:00:00Z",
  "status": "active",
  "pipeline_type": "impl-only",
  "artifact_registry": {
    "auth-service-plan-v1": { ... },
    "auth-service-impl-v1": { ... }
  },
  "task_list": [
    {"id": "PLAN-001", "status": "completed", ...},
    {"id": "IMPL-001", "status": "in_progress", ...},
    {"id": "TEST-001", "status": "pending", ...}
  ],
  "injected_roles": ["security-expert"],
  "checkpoint_history": [],
  "session_directory": ".workflow/.team/TLS-auth-impl-20260305/"
}
```

---

## 7. Cross-References

- **Artifact Contract Specification**: [artifact-contract-spec.md](artifact-contract-spec.md)
- **Execution Flow**: [execution-flow.md](execution-flow.md)
- **Core Concepts**: [core-concepts.md](core-concepts.md)
- **Role Specifications**: [../roles/README.md](../roles/README.md)
