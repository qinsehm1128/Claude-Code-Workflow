// Using the bundled core-memory command
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const memoryText = `## Session ID
(none)

## Project Root
D:\\Claude_dms3

## Objective
为 CCW spec 系统添加独立的 category 分类字段，实现 workflow stage 标记与 keywords 的分离，支持按阶段过滤加载 spec 文档。

## Execution Plan

### Source: inferred

<details>
<summary>Full Execution Plan (Click to expand)</summary>

1. 分析当前 spec 系统实现
2. 设计 category 分类方案 (general | exploration | planning | execution)
3. 后端实现：
   - spec-index-builder.ts: 添加 category 字段到 SpecIndexEntry
   - spec-init.ts: 更新 seed documents 使用 category
   - spec-loader.ts: 支持 category 过滤
   - commands/spec.ts: 添加 --category 选项
   - cli.ts: 注册 --category 选项
4. 前端实现：
   - api.ts: 添加 category 类型
   - SpecCard.tsx: 显示 category badge
   - SpecsSettingsPage.tsx: 添加 category 过滤 UI
5. 测试所有 ccw spec 命令

</details>

## Working Files (Modified)
- D:\\Claude_dms3\\ccw\\src\\tools\\spec-index-builder.ts (role: core types + parsing)
- D:\\Claude_dms3\\ccw\\src\\tools\\spec-init.ts (role: seed documents)
- D:\\Claude_dms3\\ccw\\src\\tools\\spec-loader.ts (role: loading + filtering)
- D:\\Claude_dms3\\ccw\\src\\commands\\spec.ts (role: CLI command handler)
- D:\\Claude_dms3\\ccw\\src\\cli.ts (role: CLI registration)
- D:\\Claude_dms3\\ccw\\frontend\\src\\lib\\api.ts (role: frontend types)
- D:\\Claude_dms3\\ccw\\frontend\\src\\components\\specs\\SpecCard.tsx (role: UI display)
- D:\\Claude_dms3\\ccw\\frontend\\src\\components\\specs\\index.ts (role: exports)
- D:\\Claude_dms3\\ccw\\frontend\\src\\pages\\SpecsSettingsPage.tsx (role: filtering UI)

## Reference Files (Read-Only)
- D:\\Claude_dms3\\ccw\\src\\core\\routes\\spec-routes.ts (role: API routes)
- D:\\Claude_dms3\\ccw\\frontend\\src\\hooks\\useSystemSettings.ts (role: hooks)

## Last Action
成功测试所有 ccw spec 命令：
- ccw spec help ✅
- ccw spec init ✅
- ccw spec rebuild ✅
- ccw spec list ✅
- ccw spec status ✅
- ccw spec load --category general ✅ (仅加载 general 分类)
- ccw spec load --category planning ✅ (仅加载 planning 分类)

发现并修复 CLI 启动问题：cli.ts 中 run() 函数未被调用，已添加 run(process.argv) 调用。

## Decisions
- 添加 category 为独立字段而非混入 keywords: 清晰的职责分离，keywords 用于主题匹配，category 用于 workflow stage 过滤
- 使用 general 作为默认值: 适用于所有阶段的通用规范
- 前端显示 category badge: 提供可视化分类指示
- SpecIndexEntry 增加 contentLength 字段: 由用户系统优化添加，避免重复读取文件

## Constraints
- 保持向后兼容：category 为可选字段，默认 general
- 不修改现有 spec 文档的 keywords 语义

## Dependencies
(none)

## Known Issues
- 前端构建存在预存 TypeScript 错误（IssuePanel.tsx, IssueManagerPage.tsx），与本功能无关
- esbuild 打包需要正确配置 --packages=external 以避免动态 require 问题

## Changes Made
- spec-index-builder.ts: 添加 SpecCategory 类型、VALID_CATEGORIES、isValidCategory()、buildEntry() 解析 category
- spec-init.ts: SpecFrontmatter 添加 category，SEED_DOCS 使用独立 category 字段
- spec-loader.ts: SpecLoadOptions 添加 category，filterSpecs() 支持 category 过滤
- spec.ts: SpecOptions 添加 category，loadAction() 传递 category 到 loadSpecs
- cli.ts: 添加 --category 选项，修复 run() 未调用问题
- api.ts: SpecEntry 添加 category 类型
- SpecCard.tsx: 添加 SpecCategory 类型、categoryConfig 配置、显示 category badge
- SpecsSettingsPage.tsx: 添加 CategoryFilter 状态、categoryCounts 计算、category 过滤按钮

## Pending
(none - 功能实现完成并测试通过)

## Notes
**Category 设计思路**：
- general: 适用于所有阶段（如编码规范）
- exploration: 代码探索、分析、调试
- planning: 任务规划、需求分析
- execution: 实现、测试、部署

系统级加载示例：ccw spec load --category exploration

**索引验证**：
{
  "title": "Architecture Constraints",
  "category": "planning",
  "keywords": ["architecture", "module", "layer", "pattern"]
}
keywords 不再包含 exploration/planning/execution 标记。`;

  // Write memory text to temp file
  const tempFile = path.join(__dirname, '.temp-memory-import.txt');
  fs.writeFileSync(tempFile, memoryText.trim(), 'utf8');

  try {
    // Change to project directory and run ccw core-memory import with the text from file
    process.chdir('D:\\Claude_dms3');
    const textContent = fs.readFileSync(tempFile, 'utf8');
    // Escape for command line - use base64 to avoid escaping issues
    const base64Content = Buffer.from(textContent).toString('base64');
    const result = execSync(`node -e "const s=require('fs');const t=Buffer.from('${base64Content}','base64').toString();const{getCoreMemoryStore}=require('./ccw/dist/commands/core-memory.js');const m=getCoreMemoryStore('.').upsertMemory({content:t});console.log(JSON.stringify({operation:'import',id:m.id,message:'Created memory: '+m.id,recovery_id:m.id}))"`, {
      cwd: 'D:\\Claude_dms3',
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    console.log(result);
  } finally {
    // Cleanup
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
