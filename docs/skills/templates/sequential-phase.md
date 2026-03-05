# Sequential Phase Template

> 用途: 顺序执行阶段的模板，用于 Sequential 类型 Skill

## 模板

```markdown
# Phase {N}: {Phase Name}

> **Skill**: {Skill Name}
> **Phase Number**: {N}
> **Execution Mode**: Sequential
> **Estimated Duration**: {X minutes}

## Objective

本阶段的目标描述（1-2 句话）

## Prerequisites

在执行本阶段之前，必须满足以下条件：

- [ ] Prerequisite 1
- [ ] Prerequisite 2
- [ ] Prerequisite 3

## Input Data

| Data | Source | Format | Required |
|------|--------|--------|----------|
| data1 | {source} | {format} | Yes |
| data2 | {source} | {format} | Yes |
| data3 | {source} | {format} | No |

## Execution Steps

### Step 1: {Step Name}

**Description**: 详细描述步骤内容

**Action**: 具体要执行的操作

**Validation**: 如何验证步骤完成

**Output**: 产出什么数据或文件

### Step 2: {Step Name}

**Description**: 详细描述步骤内容

**Action**: 具体要执行的操作

**Validation**: 如何验证步骤完成

**Output**: 产出什么数据或文件

### Step 3: {Step Name}

...

## Output

本阶段将产生以下输出：

| Output | Format | Location | Description |
|--------|--------|----------|-------------|
| output1 | {format} | {path} | 描述 |
| output2 | {format} | {path} | 描述 |

## Quality Checks

执行完成后，检查以下项目：

- [ ] 所有步骤已执行
- [ ] 输出文件已创建
- [ ] 输出格式正确
- [ ] 数据完整性验证
- [ ] 无错误或警告

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Error 1 | 原因描述 | 解决方案 |
| Error 2 | 原因描述 | 解决方案 |

## Next Phase

完成本阶段后，进入 **Phase {N+1}: {Next Phase Name}**

**传递数据**:
- data1 → Next phase input 1
- data2 → Next phase input 2

## Completion Criteria

本阶段被视为完成，当：

1. 所有执行步骤已完成
2. 所有质量检查已通过
3. 输出文件已生成并验证
4. 无未处理的错误
```

## 使用说明

1. **触发**: skill-generator Phase 3 (Sequential 模式)
2. **输入**: Phase 2 生成的目录结构
3. **输出**: phases/NN-{phase-name}.md
4. **命名**: 使用数字前缀排序 (01-, 02-, 03-)

---

## 示例

### 简化示例

```markdown
# Phase 1: Context Collection

> **Skill**: review-code
> **Phase Number**: 1
> **Execution Mode**: Sequential
> **Estimated Duration**: 5 minutes

## Objective

收集目标代码的上下文信息，识别技术栈和代码结构

## Prerequisites

- [ ] Phase 0: 规范学习已完成
- [ ] 目标路径已提供
- [ ] specs/ 文档已阅读

## Input Data

| Data | Source | Format | Required |
|------|--------|--------|----------|
| target_path | User input | string | Yes |
| review_dimensions | specs/review-dimensions.md | list | Yes |

## Execution Steps

### Step 1: 扫描目标目录

**Description**: 使用 Glob 或 ACE 搜索工具扫描目标路径

**Action**:
```bash
# 扫描所有源文件
Glob(pattern="{target}/**/*.ts")
Glob(pattern="{target}/**/*.tsx")
```

**Validation**: 至少找到 1 个文件

**Output**: file_list.json

### Step 2: 识别技术栈

**Description**: 分析配置文件和依赖，识别技术栈

**Action**:
- 读取 package.json
- 读取 tsconfig.json
- 分析导入语句

**Validation**: 识别出主要语言和框架

**Output**: tech_stack.json

### Step 3: 构建代码模型

**Description**: 构建代码的依赖关系图

**Action**: 使用 ACE 工具分析代码关系

**Validation**: 依赖图构建完成

**Output**: code_model.json

## Output

| Output | Format | Location | Description |
|--------|--------|----------|-------------|
| file_list | JSON | state/context/files.json | 所有扫描到的文件 |
| tech_stack | JSON | state/context/tech-stack.json | 技术栈信息 |
| code_model | JSON | state/context/code-model.json | 代码关系图 |

## Quality Checks

- [ ] 文件列表非空
- [ ] 技术栈识别准确
- [ ] 代码模型无循环依赖警告

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| No files found | 路径错误或路径为空 | 提示用户检查路径 |
| Unknown tech | 无法识别技术栈 | 使用默认配置 |

## Next Phase

完成本阶段后，进入 **Phase 2: Quick Scan**

**传递数据**:
- file_list → Quick Scan 输入
- tech_stack → Quick Scan 输入

## Completion Criteria

1. 所有文件已扫描
2. 技术栈已识别
3. 代码模型已构建
4. state/context/ 目录已创建
```
