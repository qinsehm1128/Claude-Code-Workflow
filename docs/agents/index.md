# Agents

CCW provides specialized agents for different development workflows.

## What are Agents?

Agents are specialized AI assistants with specific expertise and tools for different aspects of software development. They are invoked via the `Task` tool in skills and workflows.

## Built-in Agents

### Execution Agents

#### code-developer

Pure code execution agent for implementing programming tasks and writing tests.

**Expertise:**
- Feature implementation
- Code generation and modification
- Test writing
- Bug fixes
- All programming languages and frameworks

```javascript
Task({
  subagent_type: "code-developer",
  prompt: "Implement user authentication API",
  run_in_background: false
})
```

#### tdd-developer

TDD-aware execution agent supporting Red-Green-Refactor workflow.

**Expertise:**
- Test-first development
- Red-Green-Refactor cycle
- Test-driven implementation
- Refactoring with test safety

```javascript
Task({
  subagent_type: "tdd-developer",
  prompt: "Execute TDD task IMPL-1 with test-first development",
  run_in_background: false
})
```

#### test-fix-agent

Executes tests, diagnoses failures, and fixes code until tests pass.

**Expertise:**
- Test execution and analysis
- Failure diagnosis
- Automated fixing
- Iterative test-fix cycles

```javascript
Task({
  subagent_type: "test-fix-agent",
  prompt: "Run tests and fix any failures",
  run_in_background: false
})
```

#### universal-executor

Universal executor for general-purpose execution tasks.

**Expertise:**
- General task execution
- Document generation
- Multi-step workflows
- Cross-domain tasks

```javascript
Task({
  subagent_type: "universal-executor",
  prompt: "Generate documentation for the API",
  run_in_background: false
})
```

### Analysis Agents

#### context-search-agent

Intelligent context collector for development tasks.

**Expertise:**
- Codebase exploration
- Pattern discovery
- Context gathering
- File relationship analysis

```javascript
Task({
  subagent_type: "context-search-agent",
  prompt: "Gather context for implementing user authentication",
  run_in_background: false
})
```

#### debug-explore-agent

Hypothesis-driven debugging agent with NDJSON logging.

**Expertise:**
- Root cause analysis
- Hypothesis generation and testing
- Debug logging
- Systematic troubleshooting

```javascript
Task({
  subagent_type: "debug-explore-agent",
  prompt: "Debug the WebSocket connection timeout issue",
  run_in_background: false
})
```

#### cli-explore-agent

CLI-based code exploration agent.

**Expertise:**
- CLI code analysis
- External tool integration
- Shell-based exploration
- Command-line workflows

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: "Explore codebase for authentication patterns",
  run_in_background: false
})
```

### Planning Agents

#### action-planning-agent

Creates implementation plans based on requirements and control flags.

**Expertise:**
- Task breakdown
- Implementation planning
- Dependency analysis
- Priority sequencing

```javascript
Task({
  subagent_type: "action-planning-agent",
  prompt: "Create implementation plan for OAuth2 authentication",
  run_in_background: false
})
```

#### issue-plan-agent

Planning agent specialized for issue resolution.

**Expertise:**
- Issue analysis
- Solution planning
- Task generation
- Impact assessment

```javascript
Task({
  subagent_type: "issue-plan-agent",
  prompt: "Plan solution for GitHub issue #123",
  run_in_background: false
})
```

### Specialized Agents

#### team-worker

Unified team worker agent for role-based collaboration.

**Expertise:**
- Multi-role execution (analyst, writer, planner, executor, tester, reviewer)
- Team coordination
- Lifecycle management
- Inter-role communication

```javascript
Task({
  subagent_type: "team-worker",
  description: "Spawn executor worker",
  team_name: "my-team",
  name: "executor",
  run_in_background: true,
  prompt: "## Role Assignment\nrole: executor\n..."
})
```

#### doc-generator

Documentation generation agent.

**Expertise:**
- API documentation
- User guides
- Technical writing
- Diagram generation

```javascript
Task({
  subagent_type: "doc-generator",
  prompt: "Generate documentation for the REST API",
  run_in_background: false
})
```

## Agent Categories

| Category | Agents | Purpose |
|----------|--------|---------|
| **Execution** | code-developer, tdd-developer, test-fix-agent, universal-executor | Implement code and run tasks |
| **Analysis** | context-search-agent, debug-explore-agent, cli-explore-agent | Explore and analyze code |
| **Planning** | action-planning-agent, issue-plan-agent, cli-planning-agent | Create plans and strategies |
| **Specialized** | team-worker, doc-generator, ui-design-agent | Domain-specific tasks |

## Agent Communication

Agents can communicate and coordinate with each other:

```javascript
// Agent sends message
SendMessage({
  type: "message",
  recipient: "tester",
  content: "Feature implementation complete, ready for testing"
})

// Agent receives message via system
```

## Team Workflows

Multiple agents can work together on complex tasks:

```
[analyst] -> RESEARCH (requirements analysis)
    |
    v
[writer] -> DRAFT (specification creation)
    |
    v
[planner] -> PLAN (implementation planning)
    |
    +--[executor] -> IMPL (code implementation)
    |               |
    |               v
    +-----------[tester] -> TEST (testing)
    |
    v
[reviewer] -> REVIEW (code review)
```

## Using Agents

### Via Task Tool

```javascript
// Foreground execution
Task({
  subagent_type: "code-developer",
  prompt: "Implement user dashboard",
  run_in_background: false
})

// Background execution
Task({
  subagent_type: "code-developer",
  prompt: "Implement user dashboard",
  run_in_background: true
})
```

### Via Team Skills

Team skills automatically coordinate multiple agents:

```javascript
Skill({
  skill: "team-lifecycle",
  args: "Build user authentication system"
})
```

### Configuration

Agent behavior is configured via role-spec files in team workflows:

```markdown
---
role: executor
prefix: IMPL
inner_loop: true
subagents: [explore]
---
```

::: info See Also
- [Skills](../skills/) - Reusable skill library
- [Workflows](../workflows/) - Orchestration system
- [Teams](../workflows/teams.md) - Team workflow reference
:::
