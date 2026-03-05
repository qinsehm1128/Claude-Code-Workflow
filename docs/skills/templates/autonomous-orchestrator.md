# Autonomous Orchestrator Template

> 用途: 自主编排器模板，用于 Autonomous 类型 Skill

## 模板

```markdown
# Orchestrator

> **Skill**: {Skill Name}
> **Type**: Autonomous (State-Driven)
> **Version**: 1.0.0

## Overview

本编排器使用状态驱动的决策引擎，根据当前状态自动选择下一步行动。

## State Machine

### State Definition

| State | Description | Entry Condition | Exit Actions |
|-------|-------------|-----------------|--------------|
| `initialized` | 初始状态，等待目标 | Skill 启动 | 转到 `collecting_context` |
| `collecting_context` | 收集上下文信息 | 进入状态 | 收集完成后转到 `analyzing` |
| `analyzing` | 分析目标内容 | 上下文就绪 | 分析完成后转到 `planning` 或 `executing` |
| `planning` | 制定执行计划 | 需要复杂规划 | 计划完成后转到 `executing` |
| `executing` | 执行具体行动 | 计划就绪 | 执行完成后转到 `verifying` |
| `verifying` | 验证执行结果 | 执行完成 | 验证通过转到 `completed`，否则转到 `analyzing` |
| `completed` | 任务完成 | 所有目标达成 | 结束 |
| `error` | 错误状态 | 发生错误 | 根据错误类型恢复或终止 |

### State Transitions

```plaintext
                    ┌─────────────────┐
                    │   initialized   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │collecting_context│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    analyzing    │◄─────────┐
                    └────────┬────────┘          │
                             │                   │
                    ┌────────┴────────┐          │
                    │                 │          │
                    ▼                 ▼          │
              ┌──────────┐      ┌──────────┐    │
              │ planning │      │executing │────┘
              └────┬─────┘      └────┬─────┘
                   │                │
                   │       ┌────────┴────────┐
                   │       │                 │
                   ▼       ▼                 ▼
              ┌──────────────────────────────┐
              │          verifying           │
              └───────────┬──────────────────┘
                          │
                ┌─────────┴─────────┐
                │                   │
                ▼                   ▼
          ┌──────────┐        ┌──────────┐
          │completed │        │   error  │
          └──────────┘        └──────────┘
```

## Action Registry

### Available Actions

| Action | From States | To States | Description |
|--------|------------|-----------|-------------|
| `collect_context` | `initialized`, `error` | `analyzing` | 收集必要的上下文信息 |
| `analyze_target` | `collecting_context` | `planning` or `executing` | 分析目标，决定需要规划还是直接执行 |
| `create_plan` | `analyzing` | `executing` | 创建详细执行计划 |
| `execute_action` | `planning`, `analyzing` | `verifying` | 执行具体行动 |
| `verify_result` | `executing` | `completed` or `analyzing` | 验证执行结果 |
| `handle_error` | Any | `error` or `analyzing` | 处理错误情况 |
| `complete` | `verifying` | `completed` | 标记任务完成 |

## Routing Logic

### Decision Tree

```typescript
// 伪代码：状态路由决策
function route(currentState: State, context: Context): Action {
  switch (currentState) {
    case 'initialized':
      return Action.COLLECT_CONTEXT;

    case 'collecting_context':
      if (context.hasEnoughData()) {
        return Action.ANALYZE_TARGET;
      }
      return Action.COLLECT_CONTEXT; // 继续收集

    case 'analyzing':
      if (context.needsPlanning()) {
        return Action.CREATE_PLAN;
      }
      return Action.EXECUTE_ACTION;

    case 'planning':
      return Action.EXECUTE_ACTION;

    case 'executing':
      return Action.VERIFY_RESULT;

    case 'verifying':
      if (context.isResultValid()) {
        return Action.COMPLETE;
      }
      return Action.ANALYZE_TARGET; // 重新分析

    case 'error':
      if (context.isRecoverable()) {
        return Action.ANALYZE_TARGET;
      }
      throw new UnrecoverableError(context.error);

    default:
      throw new UnknownStateError(currentState);
  }
}
```

### Condition Evaluation

| Condition | Evaluation | Result |
|-----------|------------|--------|
| `hasEnoughData()` | context.files.length > 0 | Boolean |
| `needsPlanning()` | context.complexity > threshold | Boolean |
| `isResultValid()` | validation.checks passed | Boolean |
| `isRecoverable()` | error.type in recoverableErrors | Boolean |

## State Persistence

### State File Structure

```json
{
  "state": "analyzing",
  "history": [
    { "state": "initialized", "timestamp": "2026-03-01T10:00:00Z" },
    { "state": "collecting_context", "timestamp": "2026-03-01T10:00:05Z" },
    { "state": "analyzing", "timestamp": "2026-03-01T10:00:15Z" }
  ],
  "context": {
    "target": "...",
    "files": [],
    "findings": []
  },
  "metrics": {
    "actionsExecuted": 3,
    "errors": 0,
    "startTime": "2026-03-01T10:00:00Z"
  }
}
```

### Save/Restore

- **Save**: 每次状态转换后保存
- **Restore**: Skill 重启时从文件恢复
- **Reset**: 新任务开始时重置状态

## Error Handling

### Error Classification

| Error Type | Severity | Recovery |
|------------|----------|----------|
| `ContextError` | Medium | 重新收集上下文 |
| `ValidationError` | High | 重新分析并调整 |
| `ExecutionError` | High | 尝试替代行动 |
| `FatalError` | Critical | 终止并报告 |

### Error Recovery Strategies

```typescript
function handleError(error: Error, state: State): RecoveryAction {
  if (error instanceof ContextError) {
    return RecoveryAction.RETRY_WITH_ALTERNATIVE_SOURCE;
  }
  if (error instanceof ValidationError) {
    return RecoveryAction.ADJUST_AND_RETRY;
  }
  if (error instanceof ExecutionError) {
    return RecoveryAction.TRY_ALTERNATIVE_ACTION;
  }
  return RecoveryAction.ABORT;
}
```

## Metrics and Observability

### Tracked Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `state_transitions` | Counter | 状态转换次数 |
| `action_duration` | Histogram | 每个行动的执行时间 |
| `error_count` | Counter | 错误发生次数 |
| `completion_rate` | Gauge | 任务完成率 |

### Logging

```typescript
// 每次状态转换记录日志
log.info('State transition', {
  from: oldState,
  to: newState,
  action: executedAction,
  timestamp: now()
});
```

## Testing

### Test Scenarios

1. **Happy Path**: 正常流程从初始化到完成
2. **Error Recovery**: 错误发生后正确恢复
3. **State Persistence**: 状态正确保存和恢复
4. **Edge Cases**: 边界条件处理

### Test Example

```typescript
describe('Orchestrator', () => {
  it('should complete happy path', async () => {
    const orchestrator = new Orchestrator();
    await orchestrator.run({ target: 'test' });
    expect(orchestrator.state).toBe('completed');
  });

  it('should recover from errors', async () => {
    const orchestrator = new Orchestrator();
    // 模拟错误后恢复
    await expect(orchestrator.run()).toEventuallyComplete();
  });
});
```
```

## 使用说明

1. **触发**: skill-generator Phase 3 (Autonomous 模式)
2. **输入**: Phase 2 skill-config.json
3. **输出**: phases/_orchestrator.md
4. **验证**: 确保状态转换逻辑完整

---

## 示例

### 简化示例

```markdown
# Orchestrator

> **Skill**: review-code
> **Type**: Autonomous (State-Driven)
> **Version**: 1.0.0

## State Transitions

```plaintext
initialized → collecting_context → analyzing
                                      ↓
                              ┌───────┴────────┐
                              ↓                ↓
                         quick_scan      deep_review
                              ↓                ↓
                              └───────┬────────┘
                                      ↓
                                  generating_report
                                      ↓
                                  completed
```

## Action Registry

| Action | Description |
|--------|-------------|
| `collect_context` | 收集目标文件信息 |
| `quick_scan` | 快速扫描识别高风险区域 |
| `deep_review` | 按 6 维度深度审查 |
| `generate_report` | 生成审查报告 |

## Routing Logic

```typescript
function route(state, context) {
  if (state === 'initialized') return 'collect_context';
  if (state === 'collecting_context') return 'quick_scan';
  if (state === 'analyzing') {
    if (context.hasHighRiskAreas()) return 'deep_review';
    return 'generate_report';
  }
  if (state === 'deep_review') return 'generate_report';
  return 'complete';
}
```
```
