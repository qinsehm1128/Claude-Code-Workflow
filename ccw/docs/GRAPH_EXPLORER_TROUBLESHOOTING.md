# Graph Explorer 故障排查指南

## 问题 1: 数据库列名错误

### 症状
```
[Graph] Failed to query symbols: no such column: s.token_count
[Graph] Failed to query relationships: no such column: f.path
```

### 原因
Migration 004 和 005 修改了数据库 schema：
- Migration 004: `files.path` → `files.full_path`
- Migration 005: 删除 `symbols.token_count` 和 `symbols.symbol_type`

### 解决方案
✅ **已修复** - `graph-routes.ts` 已更新为使用正确的列名：
- 使用 `f.full_path` 代替 `f.path`
- 移除对 `s.token_count` 和 `s.symbol_type` 的引用

---

## 问题 2: 图谱显示为空（无节点/边）

### 症状
- 前端 Graph Explorer 视图加载成功，但图谱为空
- 控制台显示 `nodes: []` 和 `edges: []`

### 诊断步骤

#### 1. 检查数据库是否存在

```bash
# Windows (Git Bash)
ls ~/.codexlens/indexes/

# 应该看到您的项目路径，例如：
# D/Claude_dms3/
```

#### 2. 检查数据库内容

```bash
# 进入项目索引数据库
cd ~/.codexlens/indexes/D/Claude_dms3/  # 替换为您的项目路径

# 检查符号数量
sqlite3 _index.db "SELECT COUNT(*) FROM symbols;"

# 检查文件数量
sqlite3 _index.db "SELECT COUNT(*) FROM files;"

# 检查关系数量（重要！）
sqlite3 _index.db "SELECT COUNT(*) FROM code_relationships;"
```

#### 3. 判断问题类型

**情况 A：所有计数都是 0**
- 问题：项目未索引
- 解决方案：运行 `codex init <project-path>`

**情况 B：symbols > 0, files > 0, code_relationships = 0**
- 问题：**旧索引缺少关系数据**（本次遇到的情况）
- 解决方案：重新索引以提取关系

**情况 C：所有计数都 > 0**
- 问题：前端或 API 路由错误
- 解决方案：检查浏览器控制台错误

### 解决方案：重新索引提取代码关系

#### 方案 1: 使用 CodexLens CLI（推荐）

```bash
# 1. 清除旧索引（可选但推荐）
rm -rf ~/.codexlens/indexes/D/Claude_dms3/_index.db

# 2. 重新初始化项目
cd /d/Claude_dms3
codex init .

# 3. 验证关系数据已提取
sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "SELECT COUNT(*) FROM code_relationships;"
# 应该返回 > 0
```

#### 方案 2: 使用 Python 脚本手动提取

创建临时脚本 `extract_relationships.py`：

```python
#!/usr/bin/env python3
"""
临时脚本：为已索引项目提取代码关系
适用于 migration 003 之前创建的索引
"""
from pathlib import Path
from codexlens.storage.dir_index import DirIndexStore
from codexlens.semantic.graph_analyzer import GraphAnalyzer

def extract_relationships_for_project(project_path: str):
    """为已索引项目提取并添加代码关系"""
    project = Path(project_path).resolve()

    # 打开索引数据库
    store = DirIndexStore(project)
    store.initialize()

    print(f"Processing project: {project}")

    # 获取所有已索引文件
    with store._get_connection() as conn:
        cursor = conn.execute("""
            SELECT f.id, f.full_path, f.language, f.content
            FROM files f
            WHERE f.language IN ('python', 'javascript', 'typescript')
            AND f.content IS NOT NULL
        """)
        files = cursor.fetchall()

    total = len(files)
    processed = 0
    relationships_added = 0

    for file_id, file_path, language, content in files:
        processed += 1
        print(f"[{processed}/{total}] Processing {file_path}...")

        try:
            # 创建图分析器
            analyzer = GraphAnalyzer(language)

            if not analyzer.is_available():
                print(f"  ⚠ GraphAnalyzer not available for {language}")
                continue

            # 获取符号
            with store._get_connection() as conn:
                cursor = conn.execute("""
                    SELECT name, kind, start_line, end_line
                    FROM symbols
                    WHERE file_id = ?
                    ORDER BY start_line
                """, (file_id,))
                symbol_rows = cursor.fetchall()

            # 构造 Symbol 对象
            from codexlens.entities import Symbol
            symbols = [
                Symbol(
                    name=row[0],
                    kind=row[1],
                    start_line=row[2],
                    end_line=row[3],
                    file_path=file_path
                )
                for row in symbol_rows
            ]

            # 提取关系
            relationships = analyzer.analyze_with_symbols(
                content,
                Path(file_path),
                symbols
            )

            if relationships:
                store.add_relationships(file_path, relationships)
                relationships_added += len(relationships)
                print(f"  ✓ Added {len(relationships)} relationships")
            else:
                print(f"  - No relationships found")

        except Exception as e:
            print(f"  ✗ Error: {e}")
            continue

    store.close()

    print(f"\n✅ Complete!")
    print(f"   Files processed: {processed}")
    print(f"   Relationships added: {relationships_added}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python extract_relationships.py <project-path>")
        sys.exit(1)

    extract_relationships_for_project(sys.argv[1])
```

运行脚本：

```bash
cd /d/Claude_dms3/codex-lens
python extract_relationships.py D:/Claude_dms3
```

#### 验证修复

```bash
# 1. 检查关系数量
sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "SELECT COUNT(*) FROM code_relationships;"
# 应该 > 0

# 2. 检查示例关系
sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "
SELECT
    s.name as source,
    r.relationship_type,
    r.target_qualified_name
FROM code_relationships r
JOIN symbols s ON r.source_symbol_id = s.id
LIMIT 5;
"

# 3. 重启 CCW Dashboard
ccw view

# 4. 打开 Graph Explorer，应该能看到节点和边
```

---

## 问题 3: Graph Explorer 不显示（404 或空白）

### 症状
- 左侧边栏的 Graph 图标不响应点击
- 或点击后显示空白页面

### 诊断

1. **检查路由是否注册**：
   ```bash
   cd /d/Claude_dms3/ccw
   rg "handleGraphRoutes" src/
   ```

2. **检查前端是否包含 Graph Explorer 组件**：
   ```bash
   ls ccw/frontend/src/components/GraphExplorer.tsx
   ```

3. **检查 React 前端是否正确构建**：
   ```bash
   ls ccw/frontend/dist/index.html
   ```

### 解决方案

确保以下文件存在且正确：
- `ccw/src/core/routes/graph-routes.ts` - API 路由处理
- `ccw/frontend/src/components/GraphExplorer.tsx` - React 前端组件
- `ccw/frontend/dist/index.html` - 构建后的前端入口

---

## 问题 4: 关系提取失败（调试模式）

### 启用调试日志

```bash
# 设置日志级别为 DEBUG
export CODEXLENS_LOG_LEVEL=DEBUG

# 重新索引
codex init /d/Claude_dms3

# 检查日志中的关系提取信息
# 应该看到：
# DEBUG: Extracting relationships from <file>
# DEBUG: Found N relationships
```

### 常见失败原因

1. **TreeSitter 解析器缺失**：
   ```bash
   python -c "from codexlens.semantic.graph_analyzer import GraphAnalyzer; print(GraphAnalyzer('python').is_available())"
   # 应该返回: True
   ```

2. **文件语言未识别**：
   ```sql
   sqlite3 _index.db "SELECT DISTINCT language FROM files;"
   # 应该看到: python, javascript, typescript
   ```

3. **源代码无法解析**：
   - 语法错误的文件会被静默跳过
   - 检查 DEBUG 日志中的解析错误

---

## 快速诊断命令汇总

```bash
# 1. 检查数据库 schema 版本
sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "PRAGMA user_version;"
# 应该 >= 5

# 2. 检查表结构
sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "PRAGMA table_info(files);"
# 应该看到: full_path（不是 path）

sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "PRAGMA table_info(symbols);"
# 不应该看到: token_count, symbol_type

# 3. 检查数据统计
sqlite3 ~/.codexlens/indexes/D/Claude_dms3/_index.db "
SELECT
    (SELECT COUNT(*) FROM files) as files,
    (SELECT COUNT(*) FROM symbols) as symbols,
    (SELECT COUNT(*) FROM code_relationships) as relationships;
"

# 4. 测试 API 端点
curl "http://localhost:3000/api/graph/nodes" | jq '.nodes | length'
curl "http://localhost:3000/api/graph/edges" | jq '.edges | length'
```

---

## 相关文档

- [Graph Explorer 修复说明](./GRAPH_EXPLORER_FIX.md)
- [Migration 005 总结](../../codex-lens/docs/MIGRATION_005_SUMMARY.md)
- [Graph Routes API](../src/core/routes/graph-routes.md)
