# Dispatch Command - Task Chain Creation

**Purpose**: Create task chains based on execution mode (spec-only, impl-only, full-lifecycle)

**Invoked by**: Coordinator role.md Phase 3

**Output Tag**: `[coordinator]`

---

## Task Chain Strategies

### Strategy 1: Spec-Only Mode (12 tasks)

```javascript
if (requirements.mode === "spec-only") {
  Output("[coordinator] Creating spec-only task chain (12 tasks)")

  // Task 1: Requirements Analysis
  TaskCreate({
    team_id: teamId,
    task_id: "req-analysis",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Analyze requirements and extract key features",
    dependencies: [],
    input: {
      scope: requirements.scope,
      focus: requirements.focus,
      depth: requirements.depth
    },
    status: "active" // First task starts immediately
  })

  // Task 2: Architecture Design
  TaskCreate({
    team_id: teamId,
    task_id: "arch-design",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design system architecture",
    dependencies: ["req-analysis"],
    status: "blocked"
  })

  // Task 3: API Design
  TaskCreate({
    team_id: teamId,
    task_id: "api-design",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design API contracts and endpoints",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 4: Data Model Design
  TaskCreate({
    team_id: teamId,
    task_id: "data-model",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design data models and schemas",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 5: UI Specification
  TaskCreate({
    team_id: teamId,
    task_id: "ui-spec",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design UI components and user flows",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 6: Test Strategy
  TaskCreate({
    team_id: teamId,
    task_id: "test-strategy",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Define testing strategy and test cases",
    dependencies: ["api-design", "data-model"],
    status: "blocked"
  })

  // Task 7: Error Handling Design
  TaskCreate({
    team_id: teamId,
    task_id: "error-handling",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design error handling and recovery mechanisms",
    dependencies: ["api-design"],
    status: "blocked"
  })

  // Task 8: Security Review
  TaskCreate({
    team_id: teamId,
    task_id: "security-review",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Review security considerations and vulnerabilities",
    dependencies: ["api-design", "data-model"],
    status: "blocked"
  })

  // Task 9: Performance Requirements
  TaskCreate({
    team_id: teamId,
    task_id: "perf-requirements",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Define performance requirements and benchmarks",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 10: Documentation Outline
  TaskCreate({
    team_id: teamId,
    task_id: "doc-outline",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Create documentation structure and outline",
    dependencies: ["api-design"],
    status: "blocked"
  })

  // Task 11: Review Specifications
  TaskCreate({
    team_id: teamId,
    task_id: "review-spec",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Review all specifications for consistency",
    dependencies: ["test-strategy", "error-handling", "security-review", "perf-requirements", "doc-outline"],
    status: "blocked"
  })

  // Task 12: Finalize Specifications
  TaskCreate({
    team_id: teamId,
    task_id: "finalize-spec",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Finalize and package all specifications",
    dependencies: ["review-spec"],
    status: "blocked"
  })

  Output("[coordinator] Spec-only task chain created (12 tasks)")
  Output("[coordinator] Starting with: req-analysis")
}
```

---

### Strategy 2: Impl-Only Mode (4 tasks)

```javascript
if (requirements.mode === "impl-only") {
  Output("[coordinator] Creating impl-only task chain (4 tasks)")

  // Verify spec exists
  const specExists = AskUserQuestion({
    question: "Implementation mode requires existing specifications. Do you have a spec file?",
    choices: ["yes", "no"]
  })

  if (specExists === "no") {
    Output("[coordinator] ERROR: impl-only mode requires existing specifications")
    Output("[coordinator] Please run spec-only mode first or use full-lifecycle mode")
    throw new Error("Missing specifications for impl-only mode")
  }

  const specFile = AskUserQuestion({
    question: "Provide path to specification file:",
    type: "text"
  })

  // Validate spec file exists
  const specContent = Read(specFile)
  if (!specContent) {
    throw new Error(`Specification file not found: ${specFile}`)
  }

  Output(`[coordinator] Using specification: ${specFile}`)

  // Task 1: Setup Scaffold
  TaskCreate({
    team_id: teamId,
    task_id: "setup-scaffold",
    assigned_to: "implementer",
    phase: "impl",
    description: "Setup project scaffold and dependencies",
    dependencies: [],
    input: {
      spec_file: specFile,
      scope: requirements.scope
    },
    status: "active" // First task starts immediately
  })

  // Task 2: Core Implementation
  TaskCreate({
    team_id: teamId,
    task_id: "core-impl",
    assigned_to: "implementer",
    phase: "impl",
    description: "Implement core functionality",
    dependencies: ["setup-scaffold"],
    input: {
      spec_file: specFile
    },
    status: "blocked"
  })

  // Task 3: Integration
  TaskCreate({
    team_id: teamId,
    task_id: "integration",
    assigned_to: "implementer",
    phase: "impl",
    description: "Integrate components and test",
    dependencies: ["core-impl"],
    input: {
      spec_file: specFile
    },
    status: "blocked"
  })

  // Task 4: Finalize Implementation
  TaskCreate({
    team_id: teamId,
    task_id: "finalize-impl",
    assigned_to: "implementer",
    phase: "impl",
    description: "Finalize implementation and documentation",
    dependencies: ["integration"],
    input: {
      spec_file: specFile
    },
    status: "blocked"
  })

  Output("[coordinator] Impl-only task chain created (4 tasks)")
  Output("[coordinator] Starting with: setup-scaffold")
}
```

---

### Strategy 3: Full-Lifecycle Mode (16 tasks)

```javascript
if (requirements.mode === "full-lifecycle") {
  Output("[coordinator] Creating full-lifecycle task chain (16 tasks)")

  // ========================================
  // SPEC PHASE (12 tasks)
  // ========================================

  // Task 1: Requirements Analysis
  TaskCreate({
    team_id: teamId,
    task_id: "req-analysis",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Analyze requirements and extract key features",
    dependencies: [],
    input: {
      scope: requirements.scope,
      focus: requirements.focus,
      depth: requirements.depth
    },
    status: "active" // First task starts immediately
  })

  // Task 2: Architecture Design
  TaskCreate({
    team_id: teamId,
    task_id: "arch-design",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design system architecture",
    dependencies: ["req-analysis"],
    status: "blocked"
  })

  // Task 3: API Design
  TaskCreate({
    team_id: teamId,
    task_id: "api-design",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design API contracts and endpoints",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 4: Data Model Design
  TaskCreate({
    team_id: teamId,
    task_id: "data-model",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design data models and schemas",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 5: UI Specification
  TaskCreate({
    team_id: teamId,
    task_id: "ui-spec",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design UI components and user flows",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 6: Test Strategy
  TaskCreate({
    team_id: teamId,
    task_id: "test-strategy",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Define testing strategy and test cases",
    dependencies: ["api-design", "data-model"],
    status: "blocked"
  })

  // Task 7: Error Handling Design
  TaskCreate({
    team_id: teamId,
    task_id: "error-handling",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Design error handling and recovery mechanisms",
    dependencies: ["api-design"],
    status: "blocked"
  })

  // Task 8: Security Review
  TaskCreate({
    team_id: teamId,
    task_id: "security-review",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Review security considerations and vulnerabilities",
    dependencies: ["api-design", "data-model"],
    status: "blocked"
  })

  // Task 9: Performance Requirements
  TaskCreate({
    team_id: teamId,
    task_id: "perf-requirements",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Define performance requirements and benchmarks",
    dependencies: ["arch-design"],
    status: "blocked"
  })

  // Task 10: Documentation Outline
  TaskCreate({
    team_id: teamId,
    task_id: "doc-outline",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Create documentation structure and outline",
    dependencies: ["api-design"],
    status: "blocked"
  })

  // Task 11: Review Specifications
  TaskCreate({
    team_id: teamId,
    task_id: "review-spec",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Review all specifications for consistency",
    dependencies: ["test-strategy", "error-handling", "security-review", "perf-requirements", "doc-outline"],
    status: "blocked"
  })

  // Task 12: Finalize Specifications
  TaskCreate({
    team_id: teamId,
    task_id: "finalize-spec",
    assigned_to: "spec-writer",
    phase: "spec",
    description: "Finalize and package all specifications",
    dependencies: ["review-spec"],
    status: "blocked"
  })

  // ========================================
  // IMPL PHASE (4 tasks)
  // ========================================

  // Task 13: Setup Scaffold
  TaskCreate({
    team_id: teamId,
    task_id: "setup-scaffold",
    assigned_to: "implementer",
    phase: "impl",
    description: "Setup project scaffold and dependencies",
    dependencies: ["finalize-spec"], // Blocked until spec phase completes
    status: "blocked"
  })

  // Task 14: Core Implementation
  TaskCreate({
    team_id: teamId,
    task_id: "core-impl",
    assigned_to: "implementer",
    phase: "impl",
    description: "Implement core functionality",
    dependencies: ["setup-scaffold"],
    status: "blocked"
  })

  // Task 15: Integration
  TaskCreate({
    team_id: teamId,
    task_id: "integration",
    assigned_to: "implementer",
    phase: "impl",
    description: "Integrate components and test",
    dependencies: ["core-impl"],
    status: "blocked"
  })

  // Task 16: Finalize Implementation
  TaskCreate({
    team_id: teamId,
    task_id: "finalize-impl",
    assigned_to: "implementer",
    phase: "impl",
    description: "Finalize implementation and documentation",
    dependencies: ["integration"],
    status: "blocked"
  })

  Output("[coordinator] Full-lifecycle task chain created (16 tasks)")
  Output("[coordinator] Starting with: req-analysis")
}
```

---

## Execution Method Handling

### Sequential Execution

```javascript
if (requirements.executionMethod === "sequential") {
  Output("[coordinator] Sequential execution: tasks will run one at a time")
  // Only one task marked as "active" at a time
  // Next task activated only after predecessor completes
}
```

### Parallel Execution

```javascript
if (requirements.executionMethod === "parallel") {
  Output("[coordinator] Parallel execution: independent tasks will run concurrently")

  // Activate all tasks with no dependencies
  const independentTasks = allTasks.filter(t => t.dependencies.length === 0)
  for (const task of independentTasks) {
    TaskUpdate(task.task_id, { status: "active" })
    Output(`[coordinator] Activated parallel task: ${task.task_id}`)
  }

  // As tasks complete, activate all tasks whose dependencies are met
  // (Handled in coordination loop)
}
```

---

## Task Metadata Reference

```javascript
const TASK_METADATA = {
  // Spec tasks
  "req-analysis": { phase: "spec", deps: [], description: "Analyze requirements" },
  "arch-design": { phase: "spec", deps: ["req-analysis"], description: "Design architecture" },
  "api-design": { phase: "spec", deps: ["arch-design"], description: "Design API contracts" },
  "data-model": { phase: "spec", deps: ["arch-design"], description: "Design data models" },
  "ui-spec": { phase: "spec", deps: ["arch-design"], description: "Design UI specifications" },
  "test-strategy": { phase: "spec", deps: ["api-design", "data-model"], description: "Define test strategy" },
  "error-handling": { phase: "spec", deps: ["api-design"], description: "Design error handling" },
  "security-review": { phase: "spec", deps: ["api-design", "data-model"], description: "Security review" },
  "perf-requirements": { phase: "spec", deps: ["arch-design"], description: "Performance requirements" },
  "doc-outline": { phase: "spec", deps: ["api-design"], description: "Documentation outline" },
  "review-spec": { phase: "spec", deps: ["test-strategy", "error-handling", "security-review", "perf-requirements", "doc-outline"], description: "Review specifications" },
  "finalize-spec": { phase: "spec", deps: ["review-spec"], description: "Finalize specifications" },

  // Impl tasks
  "setup-scaffold": { phase: "impl", deps: ["finalize-spec"], description: "Setup project scaffold" },
  "core-impl": { phase: "impl", deps: ["setup-scaffold"], description: "Core implementation" },
  "integration": { phase: "impl", deps: ["core-impl"], description: "Integration work" },
  "finalize-impl": { phase: "impl", deps: ["integration"], description: "Finalize implementation" }
}
```

---

## Output Format

All outputs from this command use the `[coordinator]` tag:

```
[coordinator] Creating spec-only task chain (12 tasks)
[coordinator] Task created: req-analysis
[coordinator] Task created: arch-design
...
[coordinator] Starting with: req-analysis
```
