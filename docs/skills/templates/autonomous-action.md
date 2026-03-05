# Autonomous Action Template

> 用途: 自主行动模板，用于 Autonomous 类型 Skill 的具体行动

## 模板

```markdown
# Action: {Action Name}

> **Skill**: {Skill Name}
> **Action Type**: {Analysis|Execution|Verification}
> **Estimated Duration**: {X minutes}

## Description

详细描述这个行动的目的和功能

## Trigger Conditions

| Condition | Description | Check Method |
|-----------|-------------|--------------|
| condition1 | 描述 | 如何检查 |
| condition2 | 描述 | 如何检查 |

## Input Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| param1 | string | Yes | 参数描述 | - |
| param2 | number | No | 参数描述 | 42 |
| param3 | array | No | 参数描述 | [] |

## Output

| Field | Type | Description |
|-------|------|-------------|
| result1 | string | 结果描述 |
| result2 | object | 结果描述 |
| success | boolean | 行动是否成功 |

## Execution Logic

### Step 1: {Step Name}

**Description**: 步骤描述

**Implementation**:
```typescript
// 示例代码
const step1Result = await doSomething(input);
if (!step1Result) {
  throw new Error('Step 1 failed');
}
```

**Validation**: 如何验证步骤成功

### Step 2: {Step Name}

**Description**: 步骤描述

**Implementation**:
```typescript
// 示例代码
const step2Result = await process(step1Result);
```

**Validation**: 如何验证步骤成功

### Step 3: {Step Name}

...

## Error Handling

| Error | Cause | Handling | Retry |
|-------|-------|----------|-------|
| ErrorType1 | 原因描述 | 处理方式 | Yes/No |
| ErrorType2 | 原因描述 | 处理方式 | Yes/No |

**Error Recovery Logic**:
```typescript
try {
  return await execute();
} catch (error) {
  if (error instanceof RecoverableError) {
    return await recover(error);
  }
  throw error;
}
```

## Side Effects

| Effect | Description | Mitigation |
|--------|-------------|------------|
| Side effect 1 | 描述 | 缓解措施 |
| Side effect 2 | 描述 | 缓解措施 |

## Dependencies

| Dependency | Type | Version | Description |
|------------|------|---------|-------------|
| dep1 | internal | - | 内部依赖描述 |
| dep2 | external | ^1.0.0 | 外部依赖描述 |

## Testing

### Test Cases

| Case | Input | Expected Output |
|------|-------|-----------------|
| Normal case | `{param: "value"}` | `{result: "expected"}` |
| Edge case | `{param: null}` | `{result: "default"}` |
| Error case | `{param: "invalid"}` | Throws Error |

### Test Implementation

```typescript
describe('ActionName', () => {
  it('should handle normal case', async () => {
    const result = await actionName({ param: 'value' });
    expect(result).toEqual({ result: 'expected' });
  });

  it('should handle edge case', async () => {
    const result = await actionName({ param: null });
    expect(result).toEqual({ result: 'default' });
  });

  it('should throw on invalid input', async () => {
    await expect(actionName({ param: 'invalid' }))
      .rejects.toThrow(Error);
  });
});
```

## Metrics

| Metric | Type | Unit |
|--------|------|------|
| duration | histogram | milliseconds |
| success_rate | gauge | percentage |
| error_count | counter | count |

## Example Usage

```typescript
// 基本使用
const result = await actionName({
  param1: 'value1',
  param2: 100
});

console.log(result);

// 带重试
const result = await actionName.withRetry({
  param1: 'value1'
}, { maxRetries: 3 });

// 带回调
await actionName.withCallback({
  param1: 'value1'
}, {
  onProgress: (progress) => console.log(progress),
  onComplete: (result) => console.log('Done', result)
});
```
```

## 使用说明

1. **触发**: skill-generator Phase 3 (Autonomous 模式)
2. **输入**: Phase 2 skill-config.json
3. **输出**: actions/{action-name}.md
4. **命名**: 使用动词-名词格式 (如 collect-context.md)

---

## 示例

### 简化示例

```markdown
# Action: quick-scan

> **Skill**: review-code
> **Action Type**: Analysis
> **Estimated Duration**: 5 minutes

## Description

快速扫描目标代码，识别高风险区域，为深度审查提供焦点

## Trigger Conditions

| Condition | Description | Check Method |
|-----------|-------------|--------------|
| context_collected | 上下文收集完成 | state.context != null |
| target_exists | 目标路径有效 | file exists check |

## Input Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| files | array | Yes | 要扫描的文件列表 | - |
| dimensions | array | No | 要检查的维度 | ["all"] |
| risk_threshold | number | No | 风险阈值 | 0.5 |

## Output

| Field | Type | Description |
|-------|------|-------------|
| risk_areas | array | 高风险区域列表 |
| scan_summary | object | 扫描摘要 |
| recommendations | array | 建议的审查重点 |

## Execution Logic

### Step 1: 按文件类型分组

```typescript
const groups = groupBy(files, f => f.extension);
// ts/tsx -> TypeScript review rules
// py -> Python review rules
```

### Step 2: 应用快速检查规则

```typescript
const risks = [];
for (const file of files) {
  const fileRisks = applyQuickChecks(file);
  risks.push(...fileRisks);
}
```

### Step 3: 聚合和排序

```typescript
const aggregated = aggregateByLocation(risks);
const sorted = sortBySeverity(aggregated);
```

## Error Handling

| Error | Cause | Handling | Retry |
|-------|-------|----------|-------|
| FileAccessError | 文件无法读取 | 跳过文件，记录警告 | No |
| ParseError | 代码解析失败 | 标记为需要人工审查 | No |

## Testing

| Case | Input | Expected Output |
|------|-------|-----------------|
| Normal | 10 files | risk_areas non-empty |
| Empty | 0 files | risk_areas empty |
| ParseError | Invalid code | Area marked for manual review |
```
