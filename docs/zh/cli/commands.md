# CLI 命令参考

全部 **43 个 CCW 命令**的完整参考，按类别组织，包含 **7 条工作流链**用于常见开发场景。

## 命令类别

| 类别 | 命令数 | 描述 |
|----------|----------|-------------|
| [编排器](#编排器) | 3 | 主工作流编排 |
| [工作流命令](#工作流命令) | 10 | 项目初始化和管理 |
| [会话命令](#会话命令) | 6 | 会话生命周期管理 |
| [分析命令](#分析命令) | 4 | 代码分析和调试 |
| [规划命令](#规划命令) | 3 | 头脑风暴和规划 |
| [执行命令](#执行命令) | 1 | 通用执行引擎 |
| [UI 设计命令](#ui-设计命令) | 10 | 设计令牌提取和原型设计 |
| [问题命令](#问题命令) | 8 | 问题发现和解决 |
| [记忆命令](#记忆命令) | 2 | 记忆和上下文管理 |
| [CLI 命令](#cli-命令) | 2 | CLI 配置和审查 |

---

## 编排器

### ccw

**用途**：主工作流编排器 - 分析意图、选择工作流、执行命令链

**描述**：分析用户意图，选择适当的工作流，并在主进程中执行命令链。

**标志**：
- `-y, --yes` - 跳过所有确认

**映射技能**：
- workflow-lite-plan, workflow-plan, workflow-execute, workflow-tdd-plan
- workflow-test-fix, workflow-multi-cli-plan, review-cycle, brainstorm
- team-planex, team-iterdev, team-lifecycle, team-issue
- team-testing, team-quality-assurance, team-brainstorm, team-uidesign

```bash
ccw -y
```

### ccw-coordinator

**用途**：具有外部 CLI 执行功能的命令编排工具

**描述**：分析需求、推荐链、按顺序执行并持久化状态。使用带钩子回调的后台任务。

**工具**：`Task`, `AskUserQuestion`, `Read`, `Write`, `Bash`, `Glob`, `Grep`

```bash
ccw-coordinator
```

### flow-create

**用途**：为 meta-skill/flow-coordinator 生成工作流模板

```bash
flow-create
```

---

## 工作流命令

### workflow init

**用途**：通过智能项目分析初始化项目级状态

**描述**：使用 cli-explore-agent 进行智能项目分析，生成 project-tech.json 和规范文件。

**标志**：
- `--regenerate` - 强制重新生成
- `--skip-specs` - 跳过规范生成

**输出**：
- `.workflow/project-tech.json`
- `.workflow/specs/*.md`

**委托给**：`cli-explore-agent`

```bash
workflow init --regenerate
```

### workflow init-specs

**用途**：创建单个规范或个人约束的交互式向导

**标志**：
- `--scope <global|project>` - 范围选择
- `--dimension <specs|personal>` - 维度选择
- `--category <general|exploration|planning|execution>` - 类别选择

```bash
workflow init-specs --scope project --dimension specs
```

### workflow init-guidelines

**用途**：基于项目分析填充 specs/*.md 的交互式向导

**标志**：
- `--reset` - 重置现有指南

```bash
workflow init-guidelines --reset
```

### workflow clean

**用途**：具有主线检测的智能代码清理

**描述**：发现过期工件并执行安全清理操作。

**标志**：
- `-y, --yes` - 跳过确认
- `--dry-run` - 预览而不更改

**委托给**：`cli-explore-agent`

```bash
workflow clean --dry-run
```

### workflow unified-execute-with-file

**用途**：用于任何规划/头脑风暴/分析输出的通用执行引擎

**标志**：
- `-y, --yes` - 跳过确认
- `-p, --plan <path>` - 规划文件路径
- `--auto-commit` - 执行后自动提交

**执行方法**：Agent, CLI-Codex, CLI-Gemini, Auto

**输出**：`.workflow/.execution/{session-id}/execution-events.md`

```bash
workflow unified-execute-with-file -p plan.json --auto-commit
```

### workflow brainstorm-with-file

**用途**：具有多 CLI 协作的交互式头脑风暴

**描述**：通过想法扩展记录思维演变。

**标志**：
- `-y, --yes` - 跳过确认
- `-c, --continue` - 继续上一次会话
- `-m, --mode <creative|structured>` - 头脑风暴模式

**委托给**：`cli-explore-agent`, `Multi-CLI (Gemini/Codex/Claude)`

**输出**：`.workflow/.brainstorm/{session-id}/synthesis.json`

```bash
workflow brainstorm-with-file -m creative
```

### workflow analyze-with-file

**用途**：具有文档化讨论的交互式协作分析

**标志**：
- `-y, --yes` - 跳过确认
- `-c, --continue` - 继续上一次会话

**委托给**：`cli-explore-agent`, `Gemini/Codex`

**输出**：`.workflow/.analysis/{session-id}/discussion.md`

```bash
workflow analyze-with-file
```

### workflow debug-with-file

**用途**：交互式假设驱动调试

**描述**：通过 Gemini 辅助校正记录探索过程。

**标志**：
- `-y, --yes` - 跳过确认

**输出**：`.workflow/.debug/{session-id}/understanding.md`

```bash
workflow debug-with-file
```

### workflow collaborative-plan-with-file

**用途**：使用规划笔记的协作规划

**描述**：并行代理填充预分配部分并进行冲突检测。

**标志**：
- `-y, --yes` - 跳过确认
- `--max-agents=5` - 最大并行代理数

**输出**：`.workflow/.planning/{session-id}/plan-note.md`

```bash
workflow collaborative-plan-with-file --max-agents=5
```

### workflow roadmap-with-file

**用途**：具有迭代分解的战略需求路线图

**标志**：
- `-y, --yes` - 跳过确认
- `-c, --continue` - 继续上一次会话
- `-m, --mode <progressive|direct|auto>` - 分解模式

**输出**：
- `.workflow/.roadmap/{session-id}/roadmap.md`
- `.workflow/issues/issues.jsonl`

**移交至**：`team-planex`

```bash
workflow roadmap-with-file -m progressive
```

---

## 会话命令

### workflow session start

**用途**：发现现有会话或启动新的工作流会话

**标志**：
- `--type <workflow|review|tdd|test|docs>` - 会话类型
- `--auto|--new` - 自动发现或强制新建

**首先调用**：`workflow init`

```bash
workflow session start --type tdd
```

### workflow session resume

**用途**：恢复最近暂停的工作流会话

```bash
workflow session resume
```

### workflow session list

**用途**：列出所有工作流会话并按状态过滤

```bash
workflow session list
```

### workflow session sync

**用途**：快速同步会话工作到 specs/*.md 和 project-tech

**标志**：
- `-y, --yes` - 跳过确认

**更新**：`.workflow/specs/*.md`, `.workflow/project-tech.json`

```bash
workflow session sync -y
```

### workflow session solidify

**用途**：将会话学习成果固化为永久项目指南

**标志**：
- `-y, --yes` - 跳过确认
- `--type <convention|constraint|learning|compress>` - 固化类型
- `--category <category>` - 指南类别
- `--limit <N>` - 压缩模式的限制

```bash
workflow session solidify --type learning
```

### workflow session complete

**用途**：将活动的工作流会话标记为完成

**描述**：归档经验教训，自动调用 sync。

**标志**：
- `-y, --yes` - 跳过确认
- `--detailed` - 详细完成报告

**自动调用**：`workflow session sync -y`

```bash
workflow session complete --detailed
```

---

## 分析命令

### workflow integration-test-cycle

**用途**：自迭代集成测试工作流

**描述**：具有反思驱动调整的自主测试-修复循环。

**标志**：
- `-y, --yes` - 跳过确认
- `-c, --continue` - 继续上一次会话
- `--max-iterations=N` - 最大迭代次数

**输出**：`.workflow/.integration-test/{session-id}/reflection-log.md`

```bash
workflow integration-test-cycle --max-iterations=5
```

### workflow refactor-cycle

**用途**：技术债务发现和自迭代重构

**标志**：
- `-y, --yes` - 跳过确认
- `-c, --continue` - 继续上一次会话
- `--scope=module|project` - 重构范围

**输出**：`.workflow/.refactor/{session-id}/reflection-log.md`

```bash
workflow refactor-cycle --scope project
```

---

## 规划命令

### workflow req-plan-with-file

**用途**：具有问题创建的需求级渐进式路线图规划

**描述**：将需求分解为收敛层或任务序列。

```bash
workflow req-plan-with-file
```

---

## 执行命令

### workflow execute

**用途**：协调工作流任务的代理执行

**描述**：自动会话发现、并行任务处理和状态跟踪。

**触发器**：`workflow-execute`

```bash
workflow execute
```

---

## UI 设计命令

### workflow ui-design style-extract

**用途**：从参考图像或文本提示中提取设计风格

**标志**：
- `-y, --yes` - 跳过确认
- `--design-id <id>` - 设计标识符
- `--session <id>` - 会话标识符
- `--images <glob>` - 图像文件模式
- `--prompt <desc>` - 文本描述
- `--variants <count>` - 变体数量
- `--interactive` - 交互模式
- `--refine` - 精化模式

**模式**：探索、精化

**输出**：`style-extraction/style-{id}/design-tokens.json`

```bash
workflow ui-design style-extract --images "design/*.png" --variants 3
```

### workflow ui-design layout-extract

**用途**：从参考图像或文本提示中提取结构布局

**标志**：
- `-y, --yes` - 跳过确认
- `--design-id <id>` - 设计标识符
- `--session <id>` - 会话标识符
- `--images <glob>` - 图像文件模式
- `--prompt <desc>` - 文本描述
- `--targets <list>` - 目标组件
- `--variants <count>` - 变体数量
- `--device-type <desktop|mobile|tablet|responsive>` - 设备类型
- `--interactive` - 交互模式
- `--refine` - 精化模式

**委托给**：`ui-design-agent`

**输出**：`layout-extraction/layout-*.json`

```bash
workflow ui-design layout-extract --prompt "dashboard layout" --device-type responsive
```

### workflow ui-design generate

**用途**：通过组合布局模板和设计令牌来组装 UI 原型

**标志**：
- `--design-id <id>` - 设计标识符
- `--session <id>` - 会话标识符

**委托给**：`ui-design-agent`

**前置条件**：`workflow ui-design style-extract`, `workflow ui-design layout-extract`

```bash
workflow ui-design generate --design-id dashboard-001
```

### workflow ui-design animation-extract

**用途**：提取动画和过渡模式

**标志**：
- `-y, --yes` - 跳过确认
- `--design-id <id>` - 设计标识符
- `--session <id>` - 会话标识符
- `--images <glob>` - 图像文件模式
- `--focus <types>` - 动画类型
- `--interactive` - 交互模式
- `--refine` - 精化模式

**委托给**：`ui-design-agent`

**输出**：`animation-extraction/animation-tokens.json`

```bash
workflow ui-design animation-extract --focus "transition,keyframe"
```

### workflow ui-design import-from-code

**用途**：从代码文件导入设计系统

**描述**：自动发现 CSS/JS/HTML/SCSS 文件。

**标志**：
- `--design-id <id>` - 设计标识符
- `--session <id>` - 会话标识符
- `--source <path>` - 源路径

**委托给**：Style Agent, Animation Agent, Layout Agent

**输出**：`style-extraction`, `animation-extraction`, `layout-extraction`

```bash
workflow ui-design import-from-code --source src/styles
```

### workflow ui-design codify-style

**用途**：从代码中提取样式并生成可共享的参考包

**标志**：
- `--package-name <name>` - 包名称
- `--output-dir <path>` - 输出目录
- `--overwrite` - 覆盖现有文件

**编排**：`workflow ui-design import-from-code`, `workflow ui-design reference-page-generator`

**输出**：`.workflow/reference_style/{package-name}/`

```bash
workflow ui-design codify-style --package-name my-design-system
```

### workflow ui-design reference-page-generator

**用途**：从设计运行提取生成多组件参考页面

**标志**：
- `--design-run <path>` - 设计运行路径
- `--package-name <name>` - 包名称
- `--output-dir <path>` - 输出目录

**输出**：`.workflow/reference_style/{package-name}/preview.html`

```bash
workflow ui-design reference-page-generator --design-run .workflow/design-run-001
```

### workflow ui-design design-sync

**用途**：将最终确定的设计系统参考同步到头脑风暴工件

**标志**：
- `--session <session_id>` - 会话标识符
- `--selected-prototypes <list>` - 选定的原型

**更新**：角色分析文档, context-package.json

```bash
workflow ui-design design-sync --session design-001
```

### workflow ui-design explore-auto

**用途**：具有以风格为中心的批量生成的交互式探索性 UI 设计

**标志**：
- `--input <value>` - 输入源
- `--targets <list>` - 目标组件
- `--target-type <page|component>` - 目标类型
- `--session <id>` - 会话标识符
- `--style-variants <count>` - 风格变体数
- `--layout-variants <count>` - 布局变体数

**编排**：`import-from-code`, `style-extract`, `animation-extract`, `layout-extract`, `generate`

```bash
workflow ui-design explore-auto --input "dashboard" --style-variants 3
```

### workflow ui-design imitate-auto

**用途**：具有直接代码/图像输入的 UI 设计工作流

**标志**：
- `--input <value>` - 输入源
- `--session <id>` - 会话标识符

**编排**：与 explore-auto 相同

```bash
workflow ui-design imitate-auto --input ./reference.png
```

---

## 问题命令

### issue new

**用途**：从 GitHub URL 或文本描述创建结构化问题

**标志**：
- `-y, --yes` - 跳过确认
- `--priority 1-5` - 问题优先级

**功能**：清晰度检测

**输出**：`.workflow/issues/issues.jsonl`

```bash
issue new --priority 3
```

### issue discover

**用途**：从多个视角发现潜在问题

**标志**：
- `-y, --yes` - 跳过确认
- `--perspectives=bug,ux,...` - 分析视角
- `--external` - 包含外部研究

**视角**：bug, ux, test, quality, security, performance, maintainability, best-practices

**委托给**：`cli-explore-agent`

**输出**：`.workflow/issues/discoveries/{discovery-id}/`

```bash
issue discover --perspectives=bug,security,performance
```

### issue discover-by-prompt

**用途**：通过用户提示和 Gemini 规划的探索发现问题

**标志**：
- `-y, --yes` - 跳过确认
- `--scope=src/**` - 文件范围
- `--depth=standard|deep` - 分析深度
- `--max-iterations=5` - 最大迭代次数

**委托给**：`Gemini CLI`, `ACE search`, `multi-agent exploration`

```bash
issue discover-by-prompt --depth deep --scope "src/auth/**"
```

### issue plan

**用途**：使用 issue-plan-agent 批量规划问题解决方案

**标志**：
- `-y, --yes` - 跳过确认
- `--all-pending` - 规划所有待处理问题
- `--batch-size 3` - 批量大小

**委托给**：`issue-plan-agent`

**输出**：`.workflow/issues/solutions/{issue-id}.jsonl`

```bash
issue plan --all-pending --batch-size 5
```

### issue queue

**用途**：从绑定的解决方案形成执行队列

**标志**：
- `-y, --yes` - 跳过确认
- `--queues <n>` - 队列数量
- `--issue <id>` - 特定问题

**委托给**：`issue-queue-agent`

**输出**：`.workflow/issues/queues/QUE-xxx.json`

```bash
issue queue --queues 2
```

### issue execute

**用途**：使用基于 DAG 的并行编排执行队列

**标志**：
- `-y, --yes` - 跳过确认
- `--queue <queue-id>` - 队列标识符
- `--worktree [<path>]` - 使用工作树隔离

**执行器**：Codex（推荐）, Gemini, Agent

```bash
issue execute --queue QUE-001 --worktree
```

### issue convert-to-plan

**用途**：将规划工件转换为问题解决方案

**标志**：
- `-y, --yes` - 跳过确认
- `--issue <id>` - 问题标识符
- `--supplement` - 补充现有解决方案

**来源**：lite-plan, workflow-session, markdown, json

```bash
issue convert-to-plan --issue 123 --supplement
```

### issue from-brainstorm

**用途**：将头脑风暴会话想法转换为具有可执行解决方案的问题

**标志**：
- `-y, --yes` - 跳过确认
- `--idea=<index>` - 想法索引
- `--auto` - 自动选择最佳想法

**输入来源**：`synthesis.json`, `perspectives.json`, `.brainstorming/**`

**输出**：`issues.jsonl`, `solutions/{issue-id}.jsonl`

```bash
issue from-brainstorm --auto
```

---

## 记忆命令

### memory prepare

**用途**：委托给 universal-executor 代理进行项目分析

**描述**：返回用于记忆加载的 JSON 核心内容包。

**标志**：
- `--tool gemini|qwen` - AI 工具选择

**委托给**：`universal-executor agent`

```bash
memory prepare --tool gemini
```

### memory style-skill-memory

**用途**：从样式参考生成 SKILL 记忆包

**标志**：
- `--regenerate` - 强制重新生成

**输入**：`.workflow/reference_style/{package-name}/`

**输出**：`.claude/skills/style-{package-name}/SKILL.md`

```bash
memory style-skill-memory --regenerate
```

---

## CLI 命令

### cli init

**用途**：生成 .gemini/ 和 .qwen/ 配置目录

**描述**：基于工作区技术检测创建 settings.json 和忽略文件。

**标志**：
- `--tool gemini|qwen|all` - 工具选择
- `--output path` - 输出路径
- `--preview` - 预览而不写入

**输出**：`.gemini/`, `.qwen/`, `.geminiignore`, `.qwenignore`

```bash
cli init --tool all --preview
```

### cli codex-review

**用途**：使用 Codex CLI 进行交互式代码审查

**标志**：
- `--uncommitted` - 审查未提交的更改
- `--base <branch>` - 与分支比较
- `--commit <sha>` - 审查特定提交
- `--model <model>` - 模型选择
- `--title <title>` - 审查标题

```bash
cli codex-review --base main --title "Security Review"
```

---

## 工作流链

用于常见开发场景的预定义命令组合：

### 1. 项目初始化链

**用途**：初始化项目状态和指南

```bash
workflow init
workflow init-specs --scope project
workflow init-guidelines
```

**输出**：`.workflow/project-tech.json`, `.workflow/specs/*.md`

---

### 2. 会话生命周期链

**用途**：完整的会话管理工作流

```bash
workflow session start --type workflow
# ... 处理任务 ...
workflow session sync -y
workflow session solidify --type learning
workflow session complete --detailed
```

---

### 3. 问题工作流链

**用途**：从问题发现到执行的完整周期

```bash
issue discover --perspectives=bug,security
issue plan --all-pending
issue queue --queues 2
issue execute --queue QUE-001
```

---

### 4. 头脑风暴到问题链

**用途**：将头脑风暴转换为可执行问题

```bash
workflow brainstorm-with-file -m creative
issue from-brainstorm --auto
issue queue
issue execute
```

---

### 5. UI 设计完整周期

**用途**：完整的 UI 设计工作流

```bash
workflow ui-design style-extract --images "design/*.png"
workflow ui-design layout-extract --images "design/*.png"
workflow ui-design generate --design-id main-001
```

---

### 6. 从代码提取 UI 设计链

**用途**：从现有代码提取设计系统

```bash
workflow ui-design import-from-code --source src/styles
workflow ui-design reference-page-generator --design-run .workflow/style-extraction
```

---

### 7. 路线图到团队执行链

**用途**：从战略规划到团队执行

```bash
workflow roadmap-with-file -m progressive
# 移交至 team-planex 技能
```

---

## 命令依赖

某些命令具有前置条件或调用其他命令：

| 命令 | 依赖 |
|---------|------------|
| `workflow session start` | `workflow init` |
| `workflow session complete` | `workflow session sync` |
| `workflow ui-design generate` | `style-extract`, `layout-extract` |
| `workflow ui-design codify-style` | `import-from-code`, `reference-page-generator` |
| `issue from-brainstorm` | `workflow brainstorm-with-file` |
| `issue queue` | `issue plan` |
| `issue execute` | `issue queue` |
| `memory style-skill-memory` | `workflow ui-design codify-style` |

---

## 代理委托

命令将工作委托给专门的代理：

| 代理 | 命令 |
|-------|----------|
| `cli-explore-agent` | `workflow init`, `workflow clean`, `workflow brainstorm-with-file`, `workflow analyze-with-file`, `issue discover` |
| `universal-executor` | `memory prepare` |
| `issue-plan-agent` | `issue plan` |
| `issue-queue-agent` | `issue queue` |
| `ui-design-agent` | `workflow ui-design layout-extract`, `generate`, `animation-extract` |

::: info 另请参阅
- [CLI 工具配置](../guide/cli-tools.md) - 配置 CLI 工具
- [技能库](../skills/core-skills.md) - 内置技能
- [代理](../agents/builtin.md) - 专门代理
:::
