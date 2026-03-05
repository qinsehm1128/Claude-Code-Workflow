# Best Practices

## One-Line Positioning

**Best Practices ensure efficient team collaboration** — Practical experience summary on standard formulation, code review, documentation maintenance, and team collaboration.

---

## 6.1 Team Collaboration Standards

### 6.1.1 Role Responsibility Definitions

| Role | Responsibility | Skill Requirements |
| --- | --- | --- |
| **Planner** | Requirement analysis, task breakdown | Architectural thinking, communication skills |
| **Developer** | Code implementation, unit testing | Coding ability, testing awareness |
| **Reviewer** | Code review, quality gatekeeping | Code sensitivity, standard understanding |
| **QA** | Quality assurance, test verification | Test design, risk identification |
| **Facilitator** | Coordination, progress tracking | Project management, conflict resolution |

### 6.1.2 Workflow Selection

| Scenario | Recommended Workflow | Rationale |
| --- | --- | --- |
| **New Feature Development** | PlanEx | Planning-execution separation, reduces risk |
| **Bug Fix** | Lifecycle | Complete closed loop, ensures fix quality |
| **Code Refactoring** | IterDev | Iterative improvement, continuous optimization |
| **Technical Decision** | Brainstorm | Multi-perspective analysis, comprehensive consideration |
| **Issue Management** | Issue | Traceable, manageable |
| **UI Development** | UIDesign | Seamless design-to-code transition |

### 6.1.3 Communication Protocols

#### Message Format

```
[<Role>] <Action> <Object>: <Result>

Examples:
[Planner] Task breakdown complete: Generated 5 subtasks
[Developer] Code implementation complete: user-auth.ts, 324 lines
[Reviewer] Code review complete: Found 2 issues, suggested 1 optimization
```

#### Status Reporting

| Status | Meaning | Next Action |
| --- | --- | --- |
| **pending** | Pending | Wait for dependencies to complete |
| **in_progress** | In progress | Continue execution |
| **completed** | Completed | Can be depended upon |
| **blocked** | Blocked | Manual intervention required |

---

## 6.2 Code Review Process

### 6.2.1 Review Dimensions

| Dimension | Check Items | Severity |
| --- | --- | --- |
| **Correctness** | Logic correct, boundary handling | HIGH |
| **Performance** | Algorithm efficiency, resource usage | MEDIUM |
| **Security** | Injection vulnerabilities, permission checks | HIGH |
| **Maintainability** | Code clarity, modularity | MEDIUM |
| **Test Coverage** | Unit tests, boundary tests | MEDIUM |
| **Standard Compliance** | Coding standards, project conventions | LOW |

### 6.2.2 Review Process

```mermaid
graph LR
    A[Submit Code] --> B[Review Code]
    B --> C[Feedback Comments]
    C --> D[Fix Issues]

    A --> A1[Push PR<br/>CI Check]
    B --> B1[Auto Review<br/>6 Dimensions]
    C --> C1[Manual Review<br/>Code Walkthrough]
    D --> D1[Fix Verify<br/>Re-review]
```

### 6.2.3 Review Checklist

#### Code Correctness
- [ ] Logic correct, no bugs
- [ ] Boundary condition handling
- [ ] Complete error handling
- [ ] Proper resource cleanup

#### Performance
- [ ] Reasonable algorithm complexity
- [ ] No memory leaks
- [ ] No redundant computation
- [ ] Reasonable caching strategy

#### Security
- [ ] No SQL injection
- [ ] No XSS vulnerabilities
- [ ] Complete permission checks
- [ ] Sensitive data protection

#### Maintainability
- [ ] Clear naming
- [ ] Good modularity
- [ ] Sufficient comments
- [ ] Easy to test

#### Test Coverage
- [ ] Complete unit tests
- [ ] Boundary test coverage
- [ ] Exception case testing
- [ ] Integration test verification

#### Standard Compliance
- [ ] Unified coding style
- [ ] Naming standard compliance
- [ ] Project convention adherence
- [ ] Complete documentation

### 6.2.4 Feedback Format

```markdown
## Review Results

### Issues
1. **[HIGH]** SQL injection risk
   - Location: `src/auth/login.ts:45`
   - Recommendation: Use parameterized queries

2. **[MEDIUM]** Performance issue
   - Location: `src/utils/cache.ts:78`
   - Recommendation: Use LRU cache

### Suggestions
1. Naming optimization: `data` → `userData`
2. Module separation: Consider extracting Auth logic independently

### Approval Conditions
- [ ] Fix HIGH issues
- [ ] Consider MEDIUM suggestions
```

---

## 6.3 Documentation Maintenance Strategy

### 6.3.1 Documentation Classification

| Type | Location | Update Frequency | Owner |
| --- | --- | --- | --- |
| **Spec Documents** | `.workflow/specs/` | As needed | Architect |
| **Reference Docs** | `docs/ref/` | Every change | Developer |
| **Guide Docs** | `docs/guide/` | Monthly | Technical Writer |
| **API Docs** | `docs/api/` | Auto-generated | Tools |
| **FAQ** | `docs/faq.md` | Weekly | Support Team |

### 6.3.2 Documentation Update Triggers

| Event | Update Content |
| --- | --- |
| **New Feature** | Add feature documentation and API reference |
| **Spec Change** | Update spec documents and migration guide |
| **Bug Fix** | Update FAQ and known issues |
| **Architecture Change** | Update architecture docs and decision records |
| **Code Review** | Supplement missing comments and docs |

### 6.3.3 Documentation Quality Standards

| Standard | Requirement |
| --- | --- |
| **Accuracy** | Consistent with actual code |
| **Completeness** | Cover all public APIs |
| **Clarity** | Easy to understand, sufficient examples |
| **Timeliness** | Updated promptly, not lagging |
| **Navigability** | Clear structure, easy to find |

---

## 6.4 Memory Management Best Practices

### 6.4.1 Memory Recording Triggers

| Trigger | Record Content |
| --- | --- |
| **Architecture Decisions** | Technology selection, design decisions |
| **Problem Resolution** | Bug root cause, solutions |
| **Experience Summary** | Best practices, gotchas |
| **Standard Conventions** | Coding standards, naming conventions |
| **Known Issues** | Bugs, limitations, TODOs |

### 6.4.2 Memory Format Standards

```markdown
## [Type] Title

### Background
- **Problem**: ...
- **Impact**: ...
- **Context**: ...

### Analysis/Decision
- **Solution**: ...
- **Rationale**: ...
- **Alternatives**: ...

### Result
- **Effect**: ...
- **Data**: ...

### Related
- [Related Memory](memory-id)
- [Related Code](file-link)
- [Related Documentation](doc-link)
```

### 6.4.3 Memory Maintenance

| Maintenance Item | Frequency | Content |
| --- | --- | --- |
| **Deduplication** | Weekly | Merge duplicate memories |
| **Update** | As needed | Update outdated content |
| **Archive** | Monthly | Archive historical memories |
| **Cleanup** | Quarterly | Delete useless memories |

---

## 6.5 Hook Usage Standards

### 6.5.1 Hook Types

| Hook Type | Purpose | Example |
| --- | --- | --- |
| **pre-command** | Inject specifications, load context | Auto-load CLAUDE.md |
| **post-command** | Save Memory, update index | Auto-save decisions |
| **pre-commit** | Code review, standard checks | Auto-run Lint |
| **file-change** | Auto-format, update index | Auto-format code |

### 6.5.2 Hook Configuration Principles

| Principle | Description |
| --- | --- |
| **Minimize** | Only configure necessary Hooks |
| **Idempotent** | Hook execution results are repeatable |
| **Recoverable** | Hook failure doesn't affect main flow |
| **Observable** | Hook execution has logging |

---

## 6.6 Team Collaboration Techniques

### 6.6.1 Conflict Resolution

| Conflict Type | Resolution Strategy |
| --- | --- |
| **Standard Conflict** | Team discussion, unify standards |
| **Technical Disagreement** | Brainstorm, data-driven |
| **Schedule Conflict** | Priority sorting, resource adjustment |
| **Quality Conflict** | Set standards, automated checks |

### 6.6.2 Knowledge Sharing

| Method | Frequency | Content |
| --- | --- | --- |
| **Tech Sharing** | Weekly | New technologies, best practices |
| **Code Walkthrough** | Every PR | Code logic, design approach |
| **Documentation Sync** | Monthly | Documentation updates, standard changes |
| **Incident Retrospective** | Every incident | Root cause analysis, improvements |

### 6.6.3 Efficiency Improvement

| Technique | Effect |
| --- | --- |
| **Templating** | Reuse successful patterns |
| **Automation** | Reduce repetitive work |
| **Tooling** | Improve development efficiency |
| **Standardization** | Lower communication cost |

---

## 6.7 Quick Reference

### Workflow Selection Guide

| Scenario | Workflow | Command |
| --- | --- | --- |
| New Feature | PlanEx | `/workflow-plan` |
| Bug Fix | Lifecycle | `/unified-execute-with-file` |
| Refactoring | IterDev | `/refactor-cycle` |
| Decision | Brainstorm | `/brainstorm-with-file` |
| UI Development | UIDesign | `/workflow:ui-design` |

### Code Review Checklist

- [ ] Correctness check
- [ ] Performance check
- [ ] Security check
- [ ] Maintainability check
- [ ] Test coverage check
- [ ] Standard compliance check

### Memory Maintenance

| Operation | MCP Tool |
| --- | --- |
| List memories | `mcp__ccw-tools__core_memory(operation="list")` |
| Search memories | `mcp__ccw-tools__core_memory(operation="search", query="...")` |
| Import memory | `mcp__ccw-tools__core_memory(operation="import", text="...")` |
| Export memory | `mcp__ccw-tools__core_memory(operation="export", id="...")` |

> **Note**: The CLI commands `ccw memory *` are deprecated. Use MCP tools directly.

---

## Summary

Claude Code Workflow best practices can be summarized as:

1. **Standards First** - Establish clear team standards
2. **Process Assurance** - Use appropriate workflows
3. **Quality Gatekeeping** - Strict code review
4. **Knowledge Accumulation** - Continuously maintain Memory and documentation
5. **Continuous Improvement** - Regular retrospectives and optimization

---

## Related Links

- [What is Claude Code Workflow](ch01-what-is-claude-dms3.md)
- [Getting Started](ch02-getting-started.md)
- [Core Concepts](ch03-core-concepts.md)
- [Workflow Basics](ch04-workflow-basics.md)
- [Advanced Tips](ch05-advanced-tips.md)
