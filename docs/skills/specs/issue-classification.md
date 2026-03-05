# Issue Classification

> 本文档定义代码审查中发现的问题分类标准和严重性等级。

## 概述

问题分类确保审查报告的一致性和可操作性。所有问题应按严重性等级标记，并提供明确的修复建议。

## 严重性等级

| 等级 | 前缀 | 描述 | 修复优先级 | 必须修复 |
|------|------|------|-----------|---------|
| **Critical** | [C] | 阻塞性问题，必须立即修复 | P0 - 立即 | 是，合并前必须修复 |
| **High** | [H] | 重要问题，需要修复 | P1 - 高 | 是，应该尽快修复 |
| **Medium** | [M] | 建议改进 | P2 - 中 | 建议，有时间应修复 |
| **Low** | [L] | 可选优化 | P3 - 低 | 可选，最好修复 |
| **Info** | [I] | 信息性建议 | P4 - 建议 | 无，仅供参考 |

## 分类标准

### Critical (严重)

**定义**: 阻止代码正常工作或造成严重后果的问题。

**典型问题**:
- 安全漏洞（SQL 注入、XSS、硬编码密钥）
- 数据丢失风险（未处理错误导致状态不一致）
- 崩溃风险（空指针、未捕获异常）
- 业务逻辑错误（核心功能不正确）

**示例**:
```typescript
// [C] SQL Injection Risk
const query = `SELECT * FROM users WHERE id='${userId}'`;
// 用户输入直接拼接 SQL，可被注入攻击

// [C] Null Pointer Crash
return user.profile.name; // user 可能为 null
```

---

### High (高)

**定义**: 影响代码质量或可维护性的重要问题。

**典型问题**:
- 性能问题（明显的低效算法）
- 错误处理缺失（网络请求、文件操作）
- 类型安全问题（过度使用 any）
- 资源泄漏（未关闭连接、未释放内存）

**示例**:
```typescript
// [H] Unhandled Promise
fetch(url).then(res => res.json()); // 没有错误处理

// [H] Memory Leak
const listeners = [];
listeners.push(callback); // 永不移除
```

---

### Medium (中)

**定义**: 改进空间，不影响当前功能。

**典型问题**:
- 代码重复（相同逻辑出现多次）
- 命名不清晰（变量名含糊）
- 函数过长（超过 50 行）
- 缺少文档（复杂逻辑没有注释）

**示例**:
```typescript
// [M] Code Duplication
if (user.role === 'admin') { /* 20 lines */ }
if (user.role === 'moderator') { /* similar 20 lines */ }

// [M] Unclear Naming
const d = data[0]; // "d" 含义不明
```

---

### Low (低)

**定义**: 小改进，代码风格问题。

**典型问题**:
- 格式不一致（缩进、空行）
- 未使用的变量/导入
- 魔法数字（直接使用的常量）
- 注释风格不统一

**示例**:
```typescript
// [L] Unused Import
import { unused } from './lib';

// [L] Magic Number
if (count > 42) { /* ... */ } // 42 是什么？
```

---

### Info (信息)

**定义**: 提示性建议，非问题。

**典型问题**:
- 可以使用更简洁的语法
- 推荐使用的新特性
- 性能优化建议（非关键）

**示例**:
```typescript
// [I] Could use optional chaining
user && user.profile && user.profile.name;
// 可简化为: user?.profile?.name
```

---

## 问题格式模板

每个问题应包含以下信息：

```markdown
### [等级] 问题标题

**位置**: `文件路径:行号`

**问题**: 问题描述（1-2 句话）

**严重性**: {Critical|High|Medium|Low|Info} - 修复必要性说明

**推荐修复**:
```typescript
// 修复前代码
// ↓
// 修复后代码
```

**参考**: [相关文档链接](relative/path.md)
```

---

## 按维度分类

| 维度 | 常见 Critical | 常见 High | 常见 Medium |
|------|---------------|-----------|-------------|
| **Correctness** | 空指针、类型错误 | 边界条件 | 命名、格式 |
| **Readability** | - | 长函数、深嵌套 | 注释、命名 |
| **Performance** | O(n²) 以上 | I/O 在循环 | 缓存优化 |
| **Security** | 注入、密钥泄露 | 权限检查 | - |
| **Testing** | 关键路径无测试 | 边界测试 | 覆盖率 |
| **Architecture** | 循环依赖 | 违反 SOLID | 设计模式 |

---

## 修复优先级

### P0 - 立即修复 (Critical)

- 阻塞合并
- 安全风险
- 数据风险

### P1 - 高优先级 (High)

- 本迭代内修复
- 影响用户体验
- 技术债务积累

### P2 - 中优先级 (Medium)

- 下迭代修复
- 代码质量改进
- 可维护性提升

### P3 - 低优先级 (Low)

- 有空时修复
- 代码风格统一
- 优化改进

### P4 - 建议 (Info)

- 可选修复
- 学习参考

---

## 参考

- [Review Dimensions](review-dimensions.md)
- [Quality Standards](quality-standards.md)
