# Workflow Best Practices

Optimize your CCW workflows for maximum efficiency and quality.

## Specification Phase

### DO

- **Start with clear objectives**: Define success criteria upfront
- **Involve stakeholders**: Gather requirements from all stakeholders
- **Document assumptions**: Make implicit knowledge explicit
- **Identify risks early**: Assess technical and project risks

### DON'T

- Skip research phase
- Assume requirements without validation
- Ignore technical constraints
- Over-engineer solutions

## Planning Phase

### DO

- **Break down tasks**: Granular tasks are easier to estimate
- **Map dependencies**: Identify task relationships early
- **Estimate realistically**: Use historical data for estimates
- **Plan for iteration**: Include buffer for unknowns

### DON'T

- Create monolithic tasks
- Ignore task dependencies
- Underestimate complexity
- Plan everything upfront

## Implementation Phase

### DO

- **Follow the plan**: Trust the planning process
- **Test as you go**: Write tests alongside code
- **Document changes**: Keep documentation in sync
- **Validate frequently**: Run tests after each change

### DON'T

- Deviate from the plan without discussion
- Skip testing for speed
- Defer documentation
- Ignore feedback

## Validation Phase

### DO

- **Test comprehensively**: Cover happy paths and edge cases
- **Review code**: Use code review guidelines
- **Measure quality**: Use automated metrics
- **Document findings**: Create test reports

### DON'T

- Skip edge case testing
- Ignore review feedback
- Rely on manual testing only
- Hide test failures

## Team Coordination

### Communication

- **Use SendMessage**: Always communicate through coordinator
- **Be specific**: Clear messages reduce back-and-forth
- **Report progress**: Update status regularly
- **Escalate blockers**: Don't wait on blockers

### Collaboration

- **Respect boundaries**: Each role has specific responsibilities
- **Trust the process**: The workflow ensures quality
- **Share knowledge**: Contribute to wisdom files
- **Learn from failures**: Post-mortems improve future workflows

## Common Pitfalls

### Specification

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Vague requirements | Rework | Use acceptance criteria |
| Missing constraints | Failed implementation | List NFRs explicitly |
| Unclear scope | Scope creep | Define in/out scope |

### Planning

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Optimistic estimates | Delays | Use cone of uncertainty |
| Unknown dependencies | Blocked tasks | Explore codebase first |
| Single-threaded planning | Bottlenecks | Identify parallel opportunities |

### Implementation

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Skipping tests | Bugs in production | Test-first approach |
| Ignoring feedback | Rejected PRs | Address review comments |
| Gold plating | Delayed delivery | Follow requirements |

## Workflow Optimization

### Reduce Cycle Time

1. **Batch similar tasks**: Reduce context switching
2. **Automate validation**: Continuous integration
3. **Parallel execution**: Identify independent tasks
4. **Fast-advance**: Skip coordinator for simple successions

### Improve Quality

1. **Early validation**: Test-first development
2. **Peer review**: Multiple reviewer perspectives
3. **Automated testing**: Comprehensive test coverage
4. **Metrics tracking**: Measure quality indicators

### Scale Effectively

1. **Epic decomposition**: Large projects → epics → tasks
2. **Team specialization**: Role-based agent assignment
3. **Knowledge sharing**: Wisdom accumulation
4. **Process refinement**: Continuous improvement

## Examples

### Good Workflow

```text
[Specification]
  ↓ Clear requirements with acceptance criteria
[Planning]
  ↓ Realistic estimates with identified dependencies
[Implementation]
  ↓ Tests pass, documentation updated
[Validation]
  ↓ All acceptance criteria met
[Complete]
```

### Problematic Workflow

```text
[Specification]
  ↓ Vague requirements, no acceptance criteria
[Planning]
  ↓ Optimistic estimates, missed dependencies
[Implementation]
  ↓ No tests, incomplete documentation
[Validation]
  ↓ Failed tests, missing requirements
[Rework]
```

::: info See Also
- [4-Level System](./4-level.md) - Detailed workflow explanation
- [Agents](../agents/) - Agent capabilities
:::
