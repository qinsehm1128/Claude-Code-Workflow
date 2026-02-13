---
description: "Interactive pre-flight checklist for ccw-loop. Discovers .task/*.json from collaborative-plan-with-file, analyze-with-file, brainstorm-to-cycle sessions; validates, transforms to ccw-loop task format, writes prep-package.json + .task/*.json, then launches the loop."
argument-hint: '[SOURCE="<path-to-.task/-dir-or-session-folder>"] [MAX_ITER=10]'
---

# Pre-Flight Checklist for CCW Loop

You are an interactive preparation assistant. Your job is to discover and consume task artifacts from upstream planning/analysis/brainstorm skills, validate them, transform into ccw-loop's task format, and launch an **unattended** development loop. Follow each step sequentially. **Ask the user questions when information is missing.**

---

## Step 1: Source Discovery

### 1.1 Auto-Detect Available Sessions

Scan for upstream artifacts from the three supported source skills:

```javascript
const projectRoot = Bash('git rev-parse --show-toplevel 2>/dev/null || pwd').trim()

// Source 1: collaborative-plan-with-file
const cplanSessions = Glob(`${projectRoot}/.workflow/.planning/CPLAN-*/.task/*.json`)
  .map(p => ({
    path: p.replace(/\/\.task\/[^/]+$/, '/.task'),
    source: 'collaborative-plan-with-file',
    type: 'task-dir',
    session: p.match(/CPLAN-[^/]+/)?.[0],
    mtime: fs.statSync(p).mtime
  }))
  // Deduplicate by session
  .filter((v, i, a) => a.findIndex(x => x.session === v.session) === i)

// Source 2: analyze-with-file
const anlSessions = Glob(`${projectRoot}/.workflow/.analysis/ANL-*/.task/*.json`)
  .map(p => ({
    path: p.replace(/\/\.task\/[^/]+$/, '/.task'),
    source: 'analyze-with-file',
    type: 'task-dir',
    session: p.match(/ANL-[^/]+/)?.[0],
    mtime: fs.statSync(p).mtime
  }))
  .filter((v, i, a) => a.findIndex(x => x.session === v.session) === i)

// Source 3: brainstorm-to-cycle
const bsSessions = Glob(`${projectRoot}/.workflow/.brainstorm/*/cycle-task.md`)
  .map(p => ({
    path: p,
    source: 'brainstorm-to-cycle',
    type: 'markdown',
    session: p.match(/\.brainstorm\/([^/]+)/)?.[1],
    mtime: fs.statSync(p).mtime
  }))

const allSources = [...cplanSessions, ...anlSessions, ...bsSessions]
  .sort((a, b) => b.mtime - a.mtime)  // Most recent first
```

### 1.2 Display Discovered Sources

```
可用的上游任务源
════════════════

collaborative-plan-with-file:
  1. CPLAN-auth-redesign-20260208  .task/  (5 tasks, 2h ago)
  2. CPLAN-api-cleanup-20260205    .task/  (3 days ago)

analyze-with-file:
  3. ANL-perf-audit-20260207       .task/  (8 tasks, 1d ago)

brainstorm-to-cycle:
  4. BS-notification-system         cycle-task.md  (1d ago)

手动输入:
  5. 自定义路径 (输入 .task/ 目录路径或任务描述)
```

### 1.3 User Selection

Ask the user to select a source:

> "请选择任务来源（输入编号），或输入 .task/ 目录的完整路径:
> 也可以输入 'manual' 手动输入任务描述（不使用上游任务文件）"

**If `$SOURCE` argument provided**, skip discovery and use directly:

```javascript
if (options.SOURCE) {
  // Validate path exists
  if (!fs.existsSync(options.SOURCE)) {
    console.error(`Path not found: ${options.SOURCE}`)
    return
  }
  selectedSource = {
    path: options.SOURCE,
    source: inferSource(options.SOURCE),
    type: fs.statSync(options.SOURCE).isDirectory() ? 'task-dir' : 'markdown'
  }
}
```

---

## Step 2: Source Validation & Task Loading

### 2.1 For .task/ Sources (collaborative-plan / analyze-with-file)

```javascript
function validateAndLoadTaskDir(taskDirPath) {
  const taskFiles = Glob(`${taskDirPath}/*.json`).sort()
  const tasks = []
  const errors = []

  for (let i = 0; i < taskFiles.length; i++) {
    try {
      const content = Read(taskFiles[i])
      const task = JSON.parse(content)

      // Required fields check (task-schema.json: id, title, description, depends_on, convergence)
      const requiredFields = ['id', 'title', 'description']
      const missing = requiredFields.filter(f => !task[f])
      if (missing.length > 0) {
        errors.push(`${taskFiles[i]}: missing fields: ${missing.join(', ')}`)
        continue
      }

      // Validate task structure
      if (task.id && task.title && task.description) {
        tasks.push(task)
      }
    } catch (e) {
      errors.push(`${taskFiles[i]}: invalid JSON: ${e.message}`)
    }
  }

  return { tasks, errors, total_files: taskFiles.length }
}
```

Display validation results:

```
JSONL 验证
══════════
目录: .workflow/.planning/CPLAN-auth-redesign-20260208/.task/
来源: collaborative-plan-with-file

✓ 5/5 任务文件解析成功
✓ 必需字段完整 (id, title, description)
✓ 3 个任务含收敛标准 (convergence)
⚠ 2 个任务缺少收敛标准 (将使用默认)

任务列表:
  TASK-001  [high]   Implement JWT token service          (feature, 3 files)
  TASK-002  [high]   Add OAuth2 Google strategy           (feature, 2 files)
  TASK-003  [medium] Create user session middleware       (feature, 4 files)
  TASK-004  [low]    Add rate limiting to auth endpoints  (enhancement, 2 files)
  TASK-005  [low]    Write integration tests              (testing, 5 files)
```

### 2.2 For Markdown Sources (brainstorm-to-cycle)

```javascript
function loadBrainstormTask(mdPath) {
  const content = Read(mdPath)

  // Extract enriched task description from cycle-task.md
  // Format: # Generated Task \n\n **Idea**: ... \n\n --- \n\n {enrichedTask}
  const taskMatch = content.match(/---\s*\n([\s\S]+)$/)
  const enrichedTask = taskMatch ? taskMatch[1].trim() : content

  // Parse into a single composite task
  return {
    tasks: [{
      id: 'TASK-001',
      title: extractTitle(content),
      description: enrichedTask,
      type: 'feature',
      priority: 'high',
      effort: 'large',
      source: { tool: 'brainstorm-to-cycle', path: mdPath }
    }],
    errors: [],
    is_composite: true  // Single large task from brainstorm
  }
}
```

Display:

```
Brainstorm 任务加载
══════════════════
文件: .workflow/.brainstorm/notification-system/cycle-task.md
来源: brainstorm-to-cycle

ℹ 脑暴输出为复合任务描述（非结构化 JSONL）
  标题: Build real-time notification system
  类型: feature (composite)

是否需要将其拆分为多个子任务？(Y/n)
```

If user selects **Y** (split), analyze the task description and generate sub-tasks:

```javascript
// Analyze and decompose the composite task into 3-7 sub-tasks
// Use mcp__ace-tool__search_context to find relevant patterns
// Generate structured tasks with convergence criteria
```

If user selects **n** (keep as single), use as-is.

### 2.3 Validation Gate

If validation has errors:

```
⚠ 验证发现 {N} 个问题:
  Line 3: missing fields: description
  Line 7: invalid JSON

选项:
  1. 跳过有问题的行，继续 ({valid_count} 个有效任务)
  2. 取消，手动修复后重试
```

**Block if 0 valid tasks.** Warn and continue if some tasks invalid.

---

## Step 3: Task Transformation

Transform unified task JSON files -> ccw-loop `develop.tasks[]` format.

```javascript
function transformToCcwLoopTasks(sourceTasks) {
  const now = getUtc8ISOString()

  return sourceTasks.map((task, index) => ({
    // Core fields (ccw-loop native)
    id: task.id || `task-${String(index + 1).padStart(3, '0')}`,
    description: task.title
      ? `${task.title}: ${task.description}`
      : task.description,
    tool: inferTool(task),       // 'gemini' | 'qwen' | 'codex'
    mode: 'write',
    status: 'pending',
    priority: mapPriority(task.priority),  // 1 (high) | 2 (medium) | 3 (low)
    files_changed: (task.files || []).map(f => f.path || f),
    created_at: now,
    completed_at: null,

    // Extended fields (preserved from source for agent reference)
    _source: task.source || { tool: 'manual' },
    _convergence: task.convergence || null,
    _type: task.type || 'feature',
    _effort: task.effort || 'medium',
    _depends_on: task.depends_on || []
  }))
}

function inferTool(task) {
  // Default to gemini for write tasks
  return 'gemini'
}

function mapPriority(priority) {
  switch (priority) {
    case 'high': case 'critical': return 1
    case 'medium': return 2
    case 'low': return 3
    default: return 2
  }
}
```

Display transformed tasks:

```
任务转换
════════
源格式: .task/*.json (collaborative-plan-with-file)
目标格式: ccw-loop develop.tasks

  task-001  [P1]  Implement JWT token service: Create JWT service...   gemini/write  pending
  task-002  [P1]  Add OAuth2 Google strategy: Implement passport...   gemini/write  pending
  task-003  [P2]  Create user session middleware: Add Express...       gemini/write  pending
  task-004  [P3]  Add rate limiting to auth endpoints: Implement...    gemini/write  pending
  task-005  [P3]  Write integration tests: Create test suite...        gemini/write  pending

共 5 个任务 (2 high, 1 medium, 2 low)
```

### 3.1 Task Reordering (Optional)

Ask: "是否需要调整任务顺序或移除某些任务？(输入编号排列如 '1,3,2,5' 或回车保持当前顺序)"

---

## Step 4: Auto-Loop Configuration

### 4.1 Present Defaults

```
自动循环配置
════════════
模式: 全自动 (develop → debug → validate → complete)
最大迭代: $MAX_ITER (默认 10)
超时: 10 分钟/action

收敛标准 (从源任务汇总):
  ${tasksWithConvergence} 个任务含收敛标准 → 自动验证
  ${tasksWithoutConvergence} 个任务无收敛标准 → 使用默认 (测试通过)

需要调整参数吗？(直接回车使用默认值)
```

### 4.2 Customization (if requested)

> "请选择要调整的项目:
> 1. 最大迭代次数 (当前: 10)
> 2. 每个 action 超时 (当前: 10 分钟)
> 3. 全部使用默认值"

---

## Step 5: Final Confirmation

```
══════════════════════════════════════════════
         Pre-Flight 检查完成
══════════════════════════════════════════════

来源:     collaborative-plan-with-file (CPLAN-auth-redesign-20260208)
任务数:   5 个 (2 high, 1 medium, 2 low)
验证:     ✓ 5/5 任务格式正确
收敛:     3/5 任务含收敛标准
自动模式: ON (最多 10 次迭代)

任务摘要:
  1. [P1] Implement JWT token service
  2. [P1] Add OAuth2 Google strategy
  3. [P2] Create user session middleware
  4. [P3] Add rate limiting to auth endpoints
  5. [P3] Write integration tests

══════════════════════════════════════════════
```

Ask: "确认启动？(Y/n)"
- If **Y** → proceed to Step 6
- If **n** → ask which part to revise

---

## Step 6: Write Artifacts

### 6.1 Write prep-package.json

Write to `{projectRoot}/.workflow/.loop/prep-package.json`:

```json
{
  "version": "1.0.0",
  "generated_at": "{ISO8601_UTC+8}",
  "prep_status": "ready",
  "target_skill": "ccw-loop",

  "environment": {
    "project_root": "{projectRoot}",
    "tech_stack": "{detected tech stack}",
    "test_framework": "{detected test framework}"
  },

  "source": {
    "tool": "collaborative-plan-with-file",
    "session_id": "CPLAN-auth-redesign-20260208",
    "task_dir": "{projectRoot}/.workflow/.planning/CPLAN-auth-redesign-20260208/.task",
    "task_count": 5,
    "tasks_with_convergence": 3
  },

  "tasks": {
    "total": 5,
    "by_priority": { "high": 2, "medium": 1, "low": 2 },
    "by_type": { "feature": 3, "enhancement": 1, "testing": 1 }
  },

  "auto_loop": {
    "enabled": true,
    "no_confirmation": true,
    "max_iterations": 10,
    "timeout_per_action_ms": 600000
  }
}
```

### 6.2 Write .task/*.json

Write transformed tasks to `{projectRoot}/.workflow/.loop/.task/` directory (one file per task, following task-schema.json):

```javascript
const taskDir = `${projectRoot}/.workflow/.loop/.task`
Bash(`mkdir -p ${taskDir}`)

for (const task of transformedTasks) {
  const fileName = `TASK-${task.id.replace(/^task-/, '')}.json`
  Write(`${taskDir}/${fileName}`, JSON.stringify(task, null, 2))
}
```

Confirm:

```
ok prep-package.json   -> .workflow/.loop/prep-package.json
ok .task/ directory     -> .workflow/.loop/.task/ (5 task files)
```

---

## Step 7: Launch Loop

Invoke the skill:

```
$ccw-loop --auto TASK="Execute tasks from {source.tool} session {source.session_id}"
```

其中:
- `$ccw-loop` — 展开为 skill 调用
- `--auto` — 启用全自动模式
- Skill 端会检测 `prep-package.json` 并加载 `.task/*.json`

**Skill 端会做以下检查**（见 Phase 1 Step 1.1）:
1. 检测 `prep-package.json` 是否存在
2. 验证 `prep_status === "ready"`
3. 验证 `target_skill === "ccw-loop"`
4. 校验 `project_root` 与当前项目一致
5. 校验文件时效（24h 内生成）
6. 验证 `.task/` 目录存在且含有效任务文件
7. 全部通过 -> 加载预构建任务列表；任一失败 -> 回退到默认 INIT 行为

Print:

```
启动 ccw-loop (自动模式)...
  prep-package.json → Phase 1 自动加载并校验
  .task/*.json      → 5 个预构建任务加载到 develop.tasks
  循环: develop → validate → complete (最多 10 次迭代)
```

---

## Error Handling

| 情况 | 处理 |
|------|------|
| 无可用上游会话 | 提示用户先运行 collaborative-plan / analyze-with-file / brainstorm，或选择手动输入 |
| JSONL 格式全部无效 | 报告错误，**不启动 loop** |
| JSONL 部分无效 | 警告无效文件，用有效任务继续 |
| brainstorm cycle-task.md 为空 | 报告错误，建议完成 brainstorm 流程 |
| 用户取消确认 | 保存 prep-package.json (prep_status="cancelled")，提示可修改后重新运行 |
| Skill 端 prep-package 校验失败 | Skill 打印警告，回退到无 prep 的默认 INIT 行为（不阻塞执行） |
