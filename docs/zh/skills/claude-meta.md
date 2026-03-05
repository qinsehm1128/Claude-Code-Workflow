# Claude Skills - 元技能类

## 一句话定位

**元技能类 Skills 是创建和管理其他技能的工具系统** — 通过规范生成、Skill 生成、命令生成和帮助系统实现技能生态的可持续发展。

## 解决的痛点

| 痛点 | 现状 | Claude Code Workflow 方案 |
| --- | --- | --- |
| **Skill 创建复杂** | 手动创建 Skill 结构和文件 | 自动化 Skill 生成 |
| **规范缺失** | 项目规范散落各处 | 统一规范生成系统 |
| **命令发现困难** | 难以找到合适的命令 | 智能命令推荐和搜索 |
| **技能调优繁琐** | 技能优化缺乏指导 | 自动化诊断和调优 |

## Skills 列表

| Skill | 功能 | 触发方式 |
| --- | --- | --- |
| `spec-generator` | 规范生成器（6 阶段文档链） | `/spec-generator <idea>` |
| `brainstorm` | 头脑风暴（多角色并行分析） | `/brainstorm <topic>` |
| `skill-generator` | Skill 生成器（元技能） | `/skill-generator` |
| `skill-tuning` | Skill 调优诊断 | `/skill-tuning <skill-name>` |
| `command-generator` | 命令生成器 | `/command-generator` |
| `ccw-help` | CCW 命令帮助系统 | `/ccw-help` |
| `issue-manage` | Issue 管理 | `/issue-manage` |

## Skills 详解

### spec-generator

**一句话定位**: 规范生成器 — 6 阶段文档链生成完整规范包（产品简报、PRD、架构、Epics）

**触发**:
```shell
/spec-generator <idea>
/spec-generator --continue        # 从断点恢复
/spec-generator -y <idea>        # 自动模式
```

**功能**:
- 6 阶段文档链：发现 → 需求扩展 → 产品简报 → PRD → 架构 → Epics → 就绪检查
- 多视角分析：CLI 工具（Gemini/Codex/Claude）提供产品、技术、用户视角
- 交互式默认：每个阶段提供用户确认点；`-y` 标志启用全自动模式
- 可恢复会话：`spec-config.json` 跟踪已完成阶段；`-c` 标志从断点恢复
- 纯文档：无代码生成或执行 — 干净移交给现有执行工作流

**架构概览**:
```plaintext
Phase 0:   Specification Study (Read specs/ + templates/ - mandatory prerequisite)
           |
Phase 1:   Discovery               -> spec-config.json + discovery-context.json
           |
Phase 1.5: Req Expansion           -> refined-requirements.json (interactive discussion + CLI gap analysis)
           |                           (-y auto mode: auto-expansion, skip interaction)
Phase 2:   Product Brief            -> product-brief.md  (multi-CLI parallel analysis)
           |
Phase 3:   Requirements (PRD)      -> requirements/  (_index.md + REQ-*.md + NFR-*.md)
           |
Phase 4:   Architecture            -> architecture/  (_index.md + ADR-*.md, multi-CLI review)
           |
Phase 5:   Epics & Stories         -> epics/  (_index.md + EPIC-*.md)
           |
Phase 6:   Readiness Check         -> readiness-report.md + spec-summary.md
           |
           Handoff to execution workflows
```

**⚠️ 强制前置条件**:

> **不要跳过**: 在执行任何操作之前，**必须**完整阅读以下文档。

**规范文档**（必读）:
| 文档 | 用途 | 优先级 |
|------|------|--------|
| [specs/document-standards.md](/skills/specs/document-standards) | 文档格式、frontmatter、命名约定 | **P0 - 执行前必读** |
| [specs/quality-gates.md](/skills/specs/quality-gates) | 每阶段质量关卡标准和评分 | **P0 - 执行前必读** |

**模板文件**（生成前必读）:
| 文档 | 用途 |
|------|------|
| [templates/product-brief.md](/skills/templates/product-brief) | 产品简报文档模板 |
| [templates/requirements-prd.md](/skills/templates/requirements-prd) | PRD 文档模板 |
| [templates/architecture-doc.md](/skills/templates/architecture-doc) | 架构文档模板 |
| [templates/epics-template.md](/skills/templates/epics-template) | Epic/Story 文档模板 |

**输出结构**:
```plaintext
.workflow/.spec/SPEC-{slug}-{YYYY-MM-DD}/
├── spec-config.json              # 会话配置 + 阶段状态
├── discovery-context.json        # 代码库探索结果（可选）
├── refined-requirements.json     # Phase 1.5: 讨论后确认的需求
├── product-brief.md              # Phase 2: 产品简报
├── requirements/                 # Phase 3: 详细 PRD（目录）
│   ├── _index.md                 #   摘要、MoSCoW 表、可追溯性、链接
│   ├── REQ-NNN-{slug}.md         #   单个功能需求
│   └── NFR-{type}-NNN-{slug}.md  #   单个非功能需求
├── architecture/                 # Phase 4: 架构决策（目录）
│   ├── _index.md                 #   摘要、组件、技术栈、链接
│   └── ADR-NNN-{slug}.md         #   单个架构决策记录
├── epics/                        # Phase 5: Epic/Story 分解（目录）
│   ├── _index.md                 #   Epic 表、依赖图、MVP 范围
│   └── EPIC-NNN-{slug}.md        #   单个 Epic 及 Stories
├── readiness-report.md           # Phase 6: 质量报告
└── spec-summary.md               # Phase 6: 一页执行摘要
```

**移交选项**（Phase 6 完成后）:
| 选项 | 说明 |
|------|------|
| `lite-plan` | 提取第一个 MVP Epic 描述 → 直接文本输入 |
| `plan` / `req-plan` | 创建 WFS 会话 + .brainstorming/ 桥接文件 |
| `issue:new` | 为每个 Epic 创建 Issue |

---

### brainstorm

**一句话定位**: 头脑风暴 — 交互式框架生成、多角色并行分析和跨角色综合

**触发**:
```shell
/brainstorm <topic>
/brainstorm --count 3 "Build platform"
/brainstorm -y "GOAL: Build SCOPE: Users" --count 5
/brainstorm system-architect --session WFS-xxx
```

**功能**:
- 双模式路由：交互式模式选择，支持参数自动检测
- **Auto 模式**: Phase 2 (artifacts) → Phase 3 (N×Role 并行) → Phase 4 (综合)
- **Single Role 模式**: Phase 3 (1×Role 分析)
- 渐进式阶段加载：阶段文件按需通过 `Ref:` 标记加载
- 会话连续性：所有阶段通过 workflow-session.json 共享会话状态

**架构概览**:
```
┌─────────────────────────────────────────────────────────────┐
│                    /brainstorm                                │
│         Unified Entry Point + Interactive Routing             │
└───────────────────────┬─────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ↓                   ↓
    ┌─────────────────┐  ┌──────────────────┐
    │   Auto Mode     │  │ Single Role Mode │
    │  (自动模式)      │  │ (单角色分析模式)   │
    └────────┬────────┘  └────────┬─────────┘
             │                    │
    ┌────────┼────────┐          │
    ↓        ↓        ↓          ↓
 Phase 2  Phase 3  Phase 4    Phase 3
Artifacts  N×Role  Synthesis  1×Role
 (7步)    Analysis  (8步)    Analysis
           并行               (4步)
```

**可用角色**:
| 角色 ID | 标题 | 关注领域 |
|---------|------|----------|
| `data-architect` | 数据架构师 | 数据模型、存储策略、数据流 |
| `product-manager` | 产品经理 | 产品策略、路线图、优先级 |
| `product-owner` | 产品负责人 | 待办事项管理、用户故事、验收标准 |
| `scrum-master` | 敏捷教练 | 流程促进、障碍消除 |
| `subject-matter-expert` | 领域专家 | 领域知识、业务规则、合规性 |
| `system-architect` | 系统架构师 | 技术架构、可扩展性、集成 |
| `test-strategist` | 测试策略师 | 测试策略、质量保证 |
| `ui-designer` | UI设计师 | 视觉设计、原型、设计系统 |
| `ux-expert` | UX专家 | 用户研究、信息架构、旅程 |

**输出结构**:
```plaintext
.workflow/active/WFS-{topic}/
├── workflow-session.json              # 会话元数据
├── .process/
│   └── context-package.json           # Phase 0 输出（auto 模式）
└── .brainstorming/
    ├── guidance-specification.md      # 框架（Phase 2, auto 模式）
    ├── feature-index.json             # 功能索引（Phase 4, auto 模式）
    ├── synthesis-changelog.md         # 综合决策审计跟踪（Phase 4, auto 模式）
    ├── feature-specs/                 # 功能规范（Phase 4, auto 模式）
    │   ├── F-001-{slug}.md
    │   └── F-00N-{slug}.md
    ├── {role}/                        # 角色分析（Phase 3 后不可变）
    │   ├── {role}-context.md          # 交互式问答响应
    │   ├── analysis.md                # 主/索引文档
    │   ├── analysis-cross-cutting.md  # 跨功能
    │   └── analysis-F-{id}-{slug}.md  # 每功能
    └── synthesis-specification.md     # 综合（Phase 4, 非 feature 模式）
```

**核心规则**:
1. **从模式检测开始**: 第一个动作是 Phase 1（解析参数 + 检测模式）
2. **交互式路由**: 如果模式无法从参数确定，ASK 用户
3. **无预分析**: 在 Phase 2 之前不分析主题
4. **解析每个输出**: 从每个阶段提取所需数据
5. **通过 TodoList 自动继续**: 检查 TodoList 状态自动执行下一个待处理阶段
6. **并行执行**: Auto 模式 Phase 3 同时附加多个代理任务用于并发执行

---

### skill-generator

**一句话定位**: Skill 生成器 — 元技能，用于创建新的 Claude Code Skills

**触发**:
```shell
/skill-generator
/create skill
/new skill
```

**功能**:
- 元技能，用于创建新的 Claude Code Skills
- 可配置执行模式：顺序（固定顺序）或自治（无状态自动选择）
- 用途：Skill 脚手架、Skill 创建、构建新工作流

**执行模式**:
| 模式 | 说明 | 用例 |
|------|------|------|
| **Sequential** | 传统线性执行，阶段按数字前缀顺序执行 | 流水线任务、强依赖、固定输出 |
| **Autonomous** | 智能路由，动态选择执行路径 | 交互任务、无强依赖、动态响应 |

**Phase 0**: **强制前置** — 规范研究（必须完成才能继续）

**⚠️ 强制前置条件**:

> **不要跳过**: 在执行任何操作之前，**必须**完整阅读以下文档。

**核心规范**（必读）:
| 文档 | 用途 | 优先级 |
|------|------|--------|
| [_shared/SKILL-DESIGN-SPEC.md](/skills/_shared/SKILL-DESIGN-SPEC) | 通用设计规范 — 定义所有 Skills 的结构、命名、质量标准 | **P0 - 关键** |
| [specs/reference-docs-spec.md](/skills/specs/reference-docs-spec) | 参考文档生成规范 — 确保生成的 Skills 有适当的基于阶段的参考文档 | **P0 - 关键** |

**模板文件**（生成前必读）:
| 文档 | 用途 |
|------|------|
| [templates/skill-md.md](/skills/templates/skill-md) | SKILL.md 入口文件模板 |
| [templates/sequential-phase.md](/skills/templates/sequential-phase) | 顺序阶段模板 |
| [templates/autonomous-orchestrator.md](/skills/templates/autonomous-orchestrator) | 自治编排器模板 |
| [templates/autonomous-action.md](/skills/templates/autonomous-action) | 自治动作模板 |

**执行流程**:
```plaintext
Phase 0: 规范研究（强制）
   - Read: ../_shared/SKILL-DESIGN-SPEC.md
   - Read: All templates/*.md files
   - 理解: 结构规则、命名约定、质量标准

Phase 1: 需求发现
   - AskUserQuestion 收集需求
   - 生成: skill-config.json

Phase 2: 结构生成
   - Bash: mkdir -p directory structure
   - Write: SKILL.md

Phase 3: 阶段/动作生成（模式依赖）
   - Sequential → 生成 phases/*.md
   - Autonomous → 生成 orchestrator + actions/*.md

Phase 4: 规范和模板
   - 生成: domain specs, templates

Phase 5: 验证和文档
   - 验证: 完整性检查
   - 生成: README.md, validation-report.json
```

**输出结构** (Sequential):
```plaintext
.claude/skills/{skill-name}/
├── SKILL.md                        # 入口文件
├── phases/
│   ├── _orchestrator.md            # 声明式编排器
│   ├── workflow.json               # 工作流定义
│   ├── 01-{step-one}.md           # Phase 1
│   ├── 02-{step-two}.md           # Phase 2
│   └── 03-{step-three}.md         # Phase 3
├── specs/
│   ├── {skill-name}-requirements.md
│   └── quality-standards.md
├── templates/
│   └── agent-base.md
├── scripts/
└── README.md
```

---

### ccw-help

**一句话定位**: CCW 命令帮助系统 — 命令搜索、推荐、文档查看

**触发**:
```shell
/ccw-help
/ccw "task description"          # 自动选择工作流并执行
/ccw-help search <keyword>       # 搜索命令
/ccw-help next <command>         # 获取下一步建议
```

**功能**:
- 命令搜索、推荐、文档查看
- 自动工作流编排
- 新手入门引导

**操作模式**:
| 模式 | 触发 | 说明 |
|------|------|------|
| **Command Search** | "搜索命令", "find command" | 查询 command.json，过滤相关命令 |
| **Smart Recommendations** | "下一步", "what's next" | 查询 flow.next_steps |
| **Documentation** | "怎么用", "how to use" | 读取源文件，提供上下文示例 |
| **Beginner Onboarding** | "新手", "getting started" | 查询 essential_commands |
| **CCW Command Orchestration** | "ccw ", "自动工作流" | 分析意图，自动选择工作流 |
| **Issue Reporting** | "ccw-issue", "报告 bug" | 收集上下文，生成问题模板 |

**支持的 Workflows**:
- **Level 1** (Lite-Lite-Lite): 超简单快速任务
- **Level 2** (Rapid/Hotfix): Bug 修复、简单功能、文档
- **Level 2.5** (Rapid-to-Issue): 从快速规划桥接到 Issue 工作流
- **Level 3** (Coupled): 复杂功能（规划、执行、审查、测试）
- **Level 3 Variants**: TDD、Test-fix、Review、UI 设计工作流
- **Level 4** (Full): 探索性任务（头脑风暴）
- **With-File Workflows**: 文档化探索（多 CLI 协作）
- **Issue Workflow**: 批量 Issue 发现、规划、排队、执行

**Slash Commands**:
```bash
/ccw "task description"          # 自动选择工作流并执行
/ccw-help                        # 帮助入口
/ccw-help search <keyword>       # 搜索命令
/ccw-help next <command>         # 下一步建议
/ccw-issue                       # Issue 报告
```

**CCW Command Examples**:
```bash
/ccw "Add user authentication"     # → auto-select level 2-3
/ccw "Fix memory leak"             # → auto-select bugfix
/ccw "Implement with TDD"          # → detect TDD workflow
/ccw "头脑风暴: 用户通知系统"      # → detect brainstorm
```

**统计数据**:
- **Commands**: 50+
- **Agents**: 16
- **Workflows**: 6 主层级 + 3 with-file 变体
- **Essential**: 10 核心命令

---

### skill-tuning

**一句话定位**: Skill 调优诊断 — 自动化诊断和优化建议

**触发**:
```shell
/skill-tuning <skill-name>
```

**功能**:
- 诊断 Skill 问题
- 提供优化建议
- 应用优化
- 验证改进

**诊断流程**:
```plaintext
分析 Skill → 识别问题 → 生成建议 → 应用优化 → 验证效果
```

---

### command-generator

**一句话定位**: 命令生成器 — 生成 Claude 命令

**触发**:
```shell
/command-generator
```

**功能**:
- 根据需求生成命令
- 遵循命令规范
- 生成命令文档

---

### issue-manage

**一句话定位**: Issue 管理 — Issue 创建、更新、状态管理

**触发**:
```shell
/issue-manage
/issue:new
```

**功能**:
- Issue 创建
- Issue 状态管理
- Issue 关联和依赖

## 相关命令

- [Claude Commands - CLI](../commands/claude/cli.md)
- [CCW CLI Tools](../features/cli.md)

## 最佳实践

1. **规范生成**: 使用 `spec-generator` 生成完整规范包，然后移交给执行工作流
2. **头脑风暴**: 使用 `brainstorm` 进行多角色分析，获得全面视角
3. **Skill 创建**: 使用 `skill-generator` 创建符合规范的 Skills
4. **命令帮助**: 使用 `ccw-help` 查找命令和工作流
5. **持续调优**: 使用 `skill-tuning` 定期优化 Skill 性能

## 使用示例

```bash
# 生成产品规范
/spec-generator "Build real-time collaboration platform"

# 头脑风暴
/brainstorm "Design payment system" --count 3
/brainstorm system-architect --session WFS-xxx

# 创建新 Skill
/skill-generator

# 获取帮助
/ccw "Add JWT authentication"
/ccw-help search "review"

# 管理 Issues
/issue-manage
```
