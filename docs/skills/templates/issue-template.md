# Issue Template

> 用途: Issue 记录模板，用于代码审查和问题追踪

## 模板

```markdown
### [{Severity}] {Issue Title}

**Location**: `{file-path}:{line}`

**Category**: {Correctness|Readability|Performance|Security|Testing|Architecture}
**Dimension**: {Dimension Name}

#### Issue Description

{Detailed description of the issue, 1-3 sentences}

#### Current Code

```typescript
// {file-path}:{line}
{current code snippet}
```

#### Severity

{Critical|High|Medium|Low|Info} - {为什么是这个严重性的理由}

#### Recommendation

```typescript
// Suggested fix
{fixed code snippet}
```

**Explanation**: {解释为什么这样修复}

#### Impact

- **Breaks**: {什么功能会受影响}
- **Risk**: {风险等级}
- **Users Affected**: {受影响的用户范围}

#### Effort

- **Complexity**: {Low|Medium|High}
- **Estimated Time**: {X hours/days}
- **Files to Change**: {N files}

#### Related

- **Requirement**: {REQ-XXX} (if applicable)
- **ADR**: {ADR-XXX} (if applicable)
- **Similar Issues**: {link to similar issues}

---

**Tags**: {tag1}, {tag2}, {tag3}
```

## 使用说明

1. **触发**: 任何问题记录场景
2. **输入**: 问题发现时的上下文
3. **输出**: 结构化 issue 记录
4. **位置**: 可在审查报告、Issue 追踪系统等使用

---

## 变体

### 简化变体 (用于快速记录)

```markdown
### [{Severity}] {Title}

**Location**: `{file}:{line}`
**Category**: {category}

{Brief description}

**Fix**:
```typescript
// Before
{code}

// After
{fix}
```
```

### 安全 Issue 变体

```markdown
### [{Severity}] Security: {Title}

**Location**: `{file}:{line}`
**CVSS**: {score}
**CWE**: {CWE-ID}

**Vulnerability**: {漏洞描述}

**Exploit Scenario**: {攻击场景}

**Mitigation**:
```typescript
{修复代码}
```

**References**:
- {OWASP link}
- {CVE link}
```

### 性能 Issue 变体

```markdown
### [{Severity}] Performance: {Title}

**Location**: `{file}:{line}`
**Complexity**: {O(n) / O(n²) / etc.}

**Current Performance**: {当前性能指标}
**Target Performance**: {目标性能指标}

**Bottleneck**: {瓶颈描述}

**Optimization**:
```typescript
{优化代码}
```

**Expected Improvement**: {预期改进}
```

---

## 示例

### 完整示例

```markdown
### [C] SQL Injection Vulnerability

**Location**: `src/auth/login.ts:45`
**Category**: Security
**Dimension**: Security

#### Issue Description

User input is directly concatenated into SQL query without sanitization,
allowing attackers to inject arbitrary SQL commands.

#### Current Code

```typescript
// src/auth/login.ts:45
const userId = req.params.id;
const query = `SELECT * FROM users WHERE id='${userId}'`;
const result = await db.query(query);
```

#### Severity

Critical - Allows unauthorized data access and potential data breach

#### Recommendation

```typescript
// Use parameterized query
const userId = req.params.id;
const query = 'SELECT * FROM users WHERE id = ?';
const result = await db.query(query, [userId]);
```

**Explanation**: Parameterized queries prevent SQL injection by separating
SQL logic from data. The database driver properly escapes the parameter.

#### Impact

- **Breaks**: User authentication, data integrity
- **Risk**: Data breach, unauthorized access
- **Users Affected**: All users

#### Effort

- **Complexity**: Low
- **Estimated Time**: 1 hour
- **Files to Change**: 3 files (all query locations)

#### Related

- **Requirement**: NFR-SEC-001
- **ADR**: ADR-002 (Security Standards)
- **Similar Issues**: None in this codebase

---

**Tags**: security, sql-injection, critical, authentication
```

### 简化示例

```markdown
### [M] Long Function

**Location**: `src/utils/data.ts:123`
**Category**: Readability

Function `processUserData` is 120 lines long, handles too many responsibilities.

**Fix**:
```typescript
// Before: One big function
function processUserData(user) {
  // 120 lines...
}

// After: Split into smaller functions
function processUserData(user) {
  validateUser(user);
  enrichUserData(user);
  saveUser(user);
}
```
```

### 安全 Issue 示例

```markdown
### [C] Hardcoded API Key

**Location**: `src/config/api.ts:10`
**CVSS**: 7.5 (High)
**CWE**: 798

**Vulnerability**: API key is hardcoded in source code and will be exposed
in version control.

**Exploit Scenario**: Anyone with repository access can extract the API key
and make unauthorized API calls.

**Mitigation**:
```typescript
// Before
const API_KEY = 'sk-1234567890abcdef';

// After
const API_KEY = process.env.API_KEY || throw new Error('API_KEY required');
```

**References**:
- OWASP: https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_cryptographic_key
- CWE-798: https://cwe.mitre.org/data/definitions/798.html
```

### 性能 Issue 示例

```markdown
### [H] Nested Loop Performance

**Location**: `src/processing/analyzer.ts:67`
**Complexity**: O(n²)

**Current Performance**: Processing 10k items takes ~5 seconds
**Target Performance**: Should be < 1 second

**Bottleneck**: Nested loop comparing every item with every other item.

**Optimization**:
```typescript
// Before: O(n²)
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    if (compare(items[i], items[j])) {
      // ...
    }
  }
}

// After: O(n) using Map
const map = new Map();
for (const item of items) {
  const key = item.category;
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(item);
}
```

**Expected Improvement**: ~100x faster for large datasets
```
```
