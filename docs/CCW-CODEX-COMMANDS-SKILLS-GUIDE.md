# CCW / Codex 命令与 Skill 完整指南

> **Who（谁来用）**: 项目开发者 - 使用 Claude Code 或 Codex CLI 进行代码开发、审查、调试、规划的开发人员

---

## 一、CCW CLI 命令

### 1.1 核心命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `ccw view` | 启动 Dashboard 服务器 | `ccw view --port 3456` |
| `ccw stop` | 停止服务器 | `ccw stop --force` |
| `ccw cli` | 统一 CLI 工具执行 | `ccw cli -p "..." --tool gemini` |
| `ccw session` | 会话生命周期管理 | `ccw session list` |
| `ccw issue` | Issue 生命周期管理 | `ccw issue create --title "..."` |
| `ccw memory` | 上下文跟踪 | `ccw memory search --query "..."` |
| `ccw team` | 团队消息总线 | `ccw team status --session-id <id>` |

### 1.2 CLI 执行命令详解

#### 基础语法

```bash
ccw cli -p "<PROMPT>" --tool <tool> --mode <mode> [options]
```

#### 三种执行模式

| 模式 | 权限 | 用途 | 工具支持 |
|------|------|------|----------|
| `analysis` | 只读 | 代码审查、架构分析、模式发现 | 全部 |
| `write` | 创建/修改/删除 | 功能实现、Bug修复、代码重构 | 全部 |
| `review` | 只读（Git感知） | 代码变更审查 | **codex 专用** |

#### CLI 工具配置 (`~/.claude/cli-tools.json`)

```json
{
  "tools": {
    "gemini": { "enabled": true, "primaryModel": "gemini-2.5-pro", "tags": ["分析", "Debug"] },
    "qwen": { "enabled": true, "primaryModel": "coder-model" },
    "codex": { "enabled": true, "primaryModel": "gpt-5.2" },
    "claude": { "enabled": true, "primaryModel": "sonnet" },
    "opencode": { "enabled": true, "primaryModel": "opencode/glm-4.7-free" }
  }
}
```

#### CLI 子命令

```bash
# 列出所有执行
ccw cli show --all

# 流式输出（stderr）
ccw cli watch <id> --timeout 120

# 获取执行结果
ccw cli output <id>              # 最终结果
ccw cli output <id> --verbose    # 完整元数据
ccw cli output <id> --raw        # 原始输出
```

#### CLI 核心选项

| 选项 | 说明 |
|------|------|
| `-p, --prompt <text>` | 提示文本 |
| `-f, --file <file>` | 从文件读取提示 |
| `--tool <tool>` | 工具选择 (gemini/qwen/codex/claude) |
| `--mode <mode>` | 执行模式 (analysis/write/review) |
| `--model <model>` | 模型覆盖 |
| `--cd <path>` | 工作目录 |
| `--includeDirs <dirs>` | 额外目录（逗号分隔） |
| `--rule <template>` | 模板规则名称 |
| `--resume [id]` | 恢复会话（空=最近） |
| `--id <id>` | 执行 ID（推荐指定） |
| `--yes` | 自动模式 |

#### 目录配置

```bash
# 单额外目录
ccw cli -p "CONTEXT: @**/* @../shared/**/*" \
  --cd src/auth --includeDirs ../shared

# 多额外目录
ccw cli -p "..." --cd src/auth --includeDirs ../shared,../types,../utils
```

### 1.3 Codex Review 命令

**重要约束**: 目标标志 (`--uncommitted`, `--base`, `--commit`) 和 `[PROMPT]` **互斥**

```bash
# 方式1: 带提示（审查未提交）
ccw cli -p "聚焦安全漏洞" --tool codex --mode review

# 方式2: 目标标志（无提示）
ccw cli --tool codex --mode review --uncommitted     # 未提交更改
ccw cli --tool codex --mode review --base main       # 与 main 对比
ccw cli --tool codex --mode review --commit abc123   # 特定提交

# ❌ 无效组合（互斥）
ccw cli -p "review" --tool codex --mode review --uncommitted
```

---

## 二、模板规则（--rule）

### 2.1 分析模板

| 模板 | 用途 |
|------|------|
| `analysis-assess-security-risks` | 安全风险评估 |
| `analysis-diagnose-bug-root-cause` | Bug 根因诊断 |
| `analysis-review-architecture` | 架构审查 |
| `analysis-analyze-code-patterns` | 代码模式分析 |
| `analysis-review-code-quality` | 代码质量审查 |
| `analysis-analyze-performance` | 性能分析 |
| `analysis-trace-code-execution` | 执行追踪 |

### 2.2 规划模板

| 模板 | 用途 |
|------|------|
| `planning-plan-architecture-design` | 架构设计规划 |
| `planning-breakdown-task-steps` | 任务步骤分解 |
| `planning-design-component-spec` | 组件规格设计 |
| `planning-plan-migration-strategy` | 迁移策略规划 |

### 2.3 开发模板

| 模板 | 用途 |
|------|------|
| `development-implement-feature` | 功能实现 |
| `development-refactor-codebase` | 代码重构 |
| `development-generate-tests` | 测试生成 |
| `development-implement-component-ui` | UI 组件实现 |
| `development-debug-runtime-issues` | 运行时调试 |

---

## 三、Claude Slash Commands

### 3.1 Workflow 命令

| 命令 | 阶段 | 用途 |
|------|------|------|
| `/workflow:lite-plan` | 5 | 快速任务规划（explore → clarify → plan → confirm → handoff） |
| `/workflow-plan` | 4 | 正式规划（explore → analyze → plan → verify） |
| `/workflow-execute` | 6+ | 执行工作流（session → tasks → commit） |
| `/workflow-tdd-plan` | 6 | TDD 规划（Red-Green-Refactor） |
| `/workflow-test-fix` | 5 | 测试生成与修复管道 |
| `/workflow:debug-with-file` | 5 | 假设驱动调试 |
| `/workflow:brainstorm-with-file` | 4 | 4视角并行头脑风暴 |
| `/workflow:analyze-with-file` | 4 | 协作分析（带文档） |
| `/workflow:refactor-cycle` | 4 | 重构循环 |
| `/workflow:integration-test-cycle` | 4 | 集成测试循环 |

### 3.2 Issue 命令

| 命令 | 用途 |
|------|------|
| `/issue:new` | 创建新 Issue |
| `/issue:discover` | 发现潜在问题 |
| `/issue:discover-by-prompt` | 通过提示发现问题 |
| `/issue:plan` | 规划解决方案 |
| `/issue:queue` | 形成执行队列 |
| `/issue:execute` | 执行方案队列 |
| `/issue:convert-to-plan` | 转换为规划工件 |

### 3.3 DDD 命令

| 命令 | 用途 |
|------|------|
| `/ddd:auto` | 文档驱动自动化（chain） |
| `/ddd:plan` | 文档驱动规划 |
| `/ddd:execute` | 文档驱动执行 |
| `/ddd:scan` | 扫描代码库构建文档 |
| `/ddd:index-build` | 构建文档索引 |
| `/ddd:doc-generate` | 生成完整文档树 |
| `/ddd:doc-refresh` | 增量更新文档 |
| `/ddd:sync` | 任务后同步 |
| `/ddd:update` | 增量索引更新 |

### 3.4 Session 命令

| 命令 | 用途 |
|------|------|
| `/workflow:session:start` | 启动工作流会话 |
| `/workflow:session:resume` | 恢复最近会话 |
| `/workflow:session:list` | 列出所有会话 |
| `/workflow:session:sync` | 同步到 specs |
| `/workflow:session:complete` | 完成会话 |

### 3.5 Spec 命令

| 命令 | 用途 |
|------|------|
| `/workflow:spec:setup` | 初始化项目级配置 |
| `/workflow:spec:add` | 添加规格/约束 |

### 3.6 UI Design 命令

| 命令 | 用途 |
|------|------|
| `/workflow:ui-design:explore-auto` | UI 设计自动工作流 |
| `/workflow:ui-design:imitate-auto` | UI 模仿自动工作流 |
| `/workflow:ui-design:style-extract` | 提取设计样式 |
| `/workflow:ui-design:layout-extract` | 提取布局 |
| `/workflow:ui-design:animation-extract` | 提取动画 |
| `/workflow:ui-design:codify-style` | 代码化样式 |
| `/workflow:ui-design:design-sync` | 同步设计系统 |
| `/workflow:ui-design:import-from-code` | 从代码导入设计 |
| `/workflow:ui-design:generate` | 组装 UI 原型 |
| `/workflow:ui-design:reference-page-generator` | 生成参考页面 |

### 3.7 Memory 命令

| 命令 | 用途 |
|------|------|
| `/memory:prepare` | 准备记忆上下文 |
| `/memory:style-skill-memory` | 生成 Skill 记忆包 |

### 3.8 IDAW 命令

| 命令 | 用途 |
|------|------|
| `/idaw:add` | 添加 IDAW 任务 |
| `/idaw:run` | 执行 IDAW 任务链 |
| `/idaw:run-coordinate` | IDAW 协调器 |
| `/idaw:resume` | 恢复 IDAW 会话 |
| `/idaw:status` | 查看 IDAW 状态 |

### 3.9 CLI 命令

| 命令 | 用途 |
|------|------|
| `/cli:cli-init` | 初始化 CLI 配置 |
| `/cli:codex-review` | Codex 代码审查 |

### 3.10 其他命令

| 命令 | 用途 |
|------|------|
| `/ccw` | 主工作流协调器 |
| `/ccw-coordinator` | 命令协调工具 |
| `/flow-create` | Flow 模板生成器 |
| `/workflow:clean` | 智能代码清理 |
| `/workflow:roadmap-with-file` | 战略路线图规划 |
| `/workflow:collaborative-plan-with-file` | 协作规划 |
| `/workflow:unified-execute-with-file` | 统一执行引擎 |
| `/workflow:debug-with-file` | 调试工作流 |
| `/workflow:brainstorm-with-file` | 头脑风暴 |
| `/workflow:analyze-with-file` | 协作分析 |

---

## 四、CCW Skills（41 个）

### 4.1 Workflow Skills（9 个）

| Skill | 阶段 | 触发 | 用途 |
|-------|------|------|------|
| `workflow-plan` | 4 | "workflow-plan", 正式规划 | 4阶段规划（explore → analyze → plan → verify） |
| `workflow-execute` | 6+ | "workflow-execute", 执行 | Agent 执行编排，延迟加载阶段文件 |
| `workflow-lite-plan` | 5 | "lite-plan", 快速任务 | 轻量级规划（explore → clarify → plan → confirm → handoff） |
| `workflow-lite-execute` | - | "lite-execute" | 轻量级执行，支持多模式输入 |
| `workflow-tdd-plan` | 6 | "tdd", "TDD" | 6阶段 TDD 规划（Red-Green-Refactor） |
| `workflow-test-fix` | 5 | "test-fix" | 测试生成与执行管道 |
| `workflow-multi-cli-plan` | - | "multi-cli" | 多 CLI 协作规划（Gemini/Codex/Claude） |
| `workflow-skill-designer` | - | "skill-designer" | 元技能，生成新的 workflow skills |

### 4.2 Team Skills（21 个）

#### 生命周期

| Skill | 角色 | 用途 |
|-------|------|------|
| `team-lifecycle-v4` | 7+ | 完整生命周期：specification → planning → implementation → testing → review |
| `team-planex` | 4 | 规划+执行 wave pipeline |
| `team-roadmap-dev` | 5 | 分阶段执行，对齐路线图 |

#### 质量保障

| Skill | 角色 | 用途 |
|-------|------|------|
| `team-review` | 3 | 代码审查管道：scanner → reviewer → fixer |
| `team-quality-assurance` | 5 | 完整 QA：scout → strategist → generator → executor → analyst |
| `team-testing` | 4 | 测试管道：strategist → generator → executor → analyst |

#### 优化

| Skill | 角色 | 用途 |
|-------|------|------|
| `team-arch-opt` | 4 | 架构优化：analyze → optimize → verify |
| `team-perf-opt` | 4 | 性能优化：profile → strategy → implement → benchmark |
| `team-tech-debt` | 4 | 技术债务：scan → assess → plan → fix |
| `team-ux-improve` | 5 | UX 改进：scan → diagnose → design → implement → test |

#### 开发

| Skill | 角色 | 用途 |
|-------|------|------|
| `team-frontend` | 4+ | 前端开发团队 |
| `team-frontend-debug` | 3+ | 前端调试（Chrome DevTools MCP） |
| `team-iterdev` | 3 | 迭代开发（Generator-Critic 循环） |
| `team-issue` | 5 | Issue 解决：explore → plan → review → marshal → implement |

#### 分析与设计

| Skill | 角色 | 用途 |
|-------|------|------|
| `team-ultra-analyze` | 4 | 深度分析：explore → analyze → discuss → synthesize |
| `team-brainstorm` | 4 | 头脑风暴（Generator-Critic 循环） |
| `team-uidesign` | 4 | UI 设计：research → tokens → audit → implement |

#### 协调

| Skill | 角色 | 用途 |
|-------|------|------|
| `team-coordinate` | 动态 | 通用协调，动态角色生成 |
| `team-executor` | - | 轻量级执行，无分析阶段 |
| `team-edict` | 多部门 | 三省六部架构 |

#### 其他

| Skill | 用途 |
|-------|------|
| `team-designer` | 元技能，生成团队 skills |
| `team-lifecycle` | Codex 完整生命周期 |

### 4.3 Utility Skills（11 个）

| Skill | 阶段 | 触发 | 用途 |
|-------|------|------|------|
| `review-code` | 6维度 | "review" | 6维度代码审查（正确性、可读性、性能、安全、测试、架构） |
| `review-cycle` | 3模式 | "review-cycle" | 统一审查（session/module/fix 模式） |
| `skill-tuning` | - | "tuning", "诊断" | Skill 诊断和调优 |
| `skill-simplify` | 3 | "simplify" | Skill 简化（完整性验证） |
| `skill-generator` | 5 | "create skill", "new skill" | 元技能，创建新 skills |
| `command-generator` | 5 | "create command", "new command" | 命令文件生成器 |
| `spec-generator` | 6 | "spec" | 规格文档生成器 |
| `memory-capture` | 2 | "memory", "记忆" | 记忆捕获（compact/tips 模式） |
| `memory-manage` | 5 | "CLAUDE.md" | CLAUDE.md 更新和文档生成 |
| `brainstorm` | 2 | "brainstorm", "头脑风暴" | 双模式头脑风暴 |
| `ccw-help` | - | "help", "帮助" | 命令帮助系统 |

---

## 五、Team Skills 架构

### 5.1 协调器 + Worker 模式

```javascript
// SKILL.md 是路由器
if (hasFlag('--role <name>')) {
  // Worker 模式
  Read(`roles/<name>/role.md`)
  execute Phase 2-4
} else {
  // Coordinator 模式
  Read('roles/coordinator/role.md')
  spawn workers
}
```

### 5.2 Worker 生成模板

```javascript
Agent({
  subagent_type: "team-worker",
  team_name: "planex",
  name: "<role>",
  run_in_background: true,
  prompt: `## Role Assignment
role: <role>
role_spec: .claude/skills/team-planex/roles/<role>/role.md
session: <session-folder>
session_id: <session-id>
inner_loop: true`
})
```

### 5.3 消息总线通信

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  session_id: sessionId,
  from: role,
  type: "state_update",
  data: { 
    status: "task_complete", 
    task_id: "...", 
    ref: "..." 
  }
})
```

### 5.4 会话目录结构

```
.workflow/.team/<PREFIX>-<slug>-<date>/
├── team-session.json     # 会话状态 + 角色注册
├── artifacts/            # 交付物
├── evidence/             # 调试证据
├── wisdom/               # 跨任务知识
└── .msg/                 # 消息总线存储
```

---

## 六、Codex Skills

### 6.1 核心 Skills

| Skill | 触发 | 用途 |
|-------|------|------|
| `team-lifecycle` | `/team-lifecycle <task>` | 5阶段管道（requirements → init → tasks → coordination → report） |
| `parallel-dev-cycle` | `/parallel-dev-cycle TASK="..."` | 4专家并行（RA, EP, CD, VAS） |
| `analyze-with-file` | `/analyze-with-file TOPIC="..."` | 协作分析，带文档讨论 |
| `brainstorm-with-file` | `/brainstorm-with-file TOPIC="..."` | 4视角并行分析 |
| `debug-with-file` | `/debug-with-file BUG="..."` | 假设驱动调试 |
| `review-cycle` | `/review-cycle <target>` | 多维代码审查 + 修复 |
| `workflow-test-fix-cycle` | `/workflow-test-fix-cycle <tests>` | 测试-修复循环 |

### 6.2 专用 Skills

| Skill | 触发 | 用途 |
|-------|------|------|
| `clean` | `/clean` | 代码清理 |
| `memory-compact` | `/memory-compact` | 记忆压缩 |
| `issue-discover` | `/issue-discover` | 问题发现 |
| `session-sync` | `/session-sync` | 会话同步 |
| `spec-add` | `/spec-add` | 添加规格 |
| `spec-setup` | `/spec-setup` | 设置规格 |

---

## 七、Skill 执行模式

### 7.1 Sequential 模式（固定顺序）

```
Phase 01 → Phase 02 → Phase 03 → ... → Phase N
```

**适用**: 流水线任务、阶段间强依赖、固定输出结构

**文件**: `phases/01-*.md`, `phases/02-*.md`, ...

### 7.2 Autonomous 模式（状态驱动）

```
Orchestrator → 读取状态 → 选择 Action → 执行 → 更新状态
```

**适用**: 交互式任务、阶段间无强依赖、需动态响应

**文件**: `phases/orchestrator.md`, `phases/actions/*.md`, `phases/state-schema.md`

---

## 八、通用参数

### 8.1 自动模式（-y/--yes）

所有命令支持跳过确认：

```bash
/workflow-execute --yes
/issue:new -y "问题描述"
/team-planex --yes "任务描述"
```

### 8.2 会话恢复（--resume）

```bash
# 恢复最近会话
/workflow-execute --resume

# 恢复特定会话
/workflow-execute --resume="WFS-auth"
```

### 8.3 角色指定（--role）

```bash
# Team Skills 角色路由
/team-lifecycle-v4 --role coordinator
/team-lifecycle-v4 --role planner
```

---

## 九、使用示例

### 9.1 分析任务（安全模式）

```bash
# 安全审计
ccw cli -p "PURPOSE: 识别认证模块的安全漏洞
TASK: • 扫描注入漏洞 • 检查认证绕过 • 评估会话管理
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: 安全报告（严重级别 + 文件位置 + 修复建议）" \
  --tool gemini --mode analysis --rule analysis-assess-security-risks

# 架构审查
ccw cli -p "..." --tool gemini --mode analysis --rule analysis-review-architecture

# 代码模式分析
ccw cli -p "..." --tool gemini --mode analysis --rule analysis-analyze-code-patterns
```

### 9.2 实现任务（写入模式）

```bash
# 功能实现
ccw cli -p "PURPOSE: 实现 API 限流
TASK: • 创建滑动窗口中间件 • Redis 后端 • 按路由配置
MODE: write
CONTEXT: @src/middleware/**/*
EXPECTED: 生产代码 + 测试 + 配置示例" \
  --tool gemini --mode write --rule development-implement-feature

# Bug 修复
ccw cli -p "..." --tool gemini --mode analysis --rule analysis-diagnose-bug-root-cause

# 代码重构
ccw cli -p "..." --tool gemini --mode write --rule development-refactor-codebase
```

### 9.3 Codex 代码审查

```bash
# 审查未提交更改（带焦点）
ccw cli -p "聚焦安全漏洞和错误处理" --tool codex --mode review

# 审查特定提交
ccw cli --tool codex --mode review --commit abc123

# 审查分支差异
ccw cli --tool codex --mode review --base main
```

### 9.4 工作流执行

```bash
# 交互式执行
/workflow-execute

# 自动模式
/workflow-execute --yes

# 自动提交
/workflow-execute --with-commit

# 恢复会话
/workflow-execute --resume-session="WFS-auth"
```

### 9.5 团队协作

```bash
# 启动团队工作流
/team-planex --yes "实现用户认证系统"

# 角色分配（自动）
# coordinator: 协调任务分发
# planner: 生成规划方案
# executor: 执行具体任务
# reviewer: 审查执行结果
```

---

## 十、相关资源

- [CLI Tools 使用规范](~/.ccw/workflows/cli-tools-usage.md)
- [Skill 设计规范](.claude/skills/_shared/SKILL-DESIGN-SPEC.md)
- [命令到 Skill 转换](.claude/skills/_shared/COMMAND-TO-SKILL-CONVERSION.md)
- [编码哲学](~/.ccw/workflows/coding-philosophy.md)
- [OMO 命令速查一页纸](https://linux.do/t/topic/1637568)
