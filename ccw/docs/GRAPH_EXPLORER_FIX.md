# Graph Explorer Fix - Migration 005 Compatibility

## Issue Description

The CCW Dashboard's Graph Explorer view was broken after codex-lens migration 005, which cleaned up unused database fields.

### Root Cause

Migration 005 removed unused/redundant columns from the codex-lens database:
- `symbols.token_count` (unused, always NULL)
- `symbols.symbol_type` (redundant duplicate of `kind`)

However, `ccw/src/core/routes/graph-routes.ts` was still querying these removed columns, causing SQL errors:

```typescript
// BEFORE (broken):
SELECT
  s.id,
  s.name,
  s.kind,
  s.start_line,
  s.token_count,      // ❌ Column removed in migration 005
  s.symbol_type,      // ❌ Column removed in migration 005
  f.path as file
FROM symbols s
```

This resulted in database query failures when trying to load the graph visualization.

## Fix Applied

Updated `graph-routes.ts` to match the new database schema (v5):

### 1. Updated GraphNode Interface

**Before:**
```typescript
interface GraphNode {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
  docstring?: string;    // ❌ Removed (no longer available)
  tokenCount?: number;   // ❌ Removed (no longer available)
}
```

**After:**
```typescript
interface GraphNode {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
}
```

### 2. Updated SQL Query

**Before:**
```typescript
SELECT
  s.id,
  s.name,
  s.kind,
  s.start_line,
  s.token_count,    // ❌ Removed
  s.symbol_type,    // ❌ Removed
  f.path as file
FROM symbols s
```

**After:**
```typescript
SELECT
  s.id,
  s.name,
  s.kind,
  s.start_line,
  f.path as file
FROM symbols s
```

### 3. Updated Row Mapping

**Before:**
```typescript
return rows.map((row: any) => ({
  id: `${row.file}:${row.name}:${row.start_line}`,
  name: row.name,
  type: mapSymbolKind(row.kind),
  file: row.file,
  line: row.start_line,
  docstring: row.symbol_type || undefined,   // ❌ Removed
  tokenCount: row.token_count || undefined,  // ❌ Removed
}));
```

**After:**
```typescript
return rows.map((row: any) => ({
  id: `${row.file}:${row.name}:${row.start_line}`,
  name: row.name,
  type: mapSymbolKind(row.kind),
  file: row.file,
  line: row.start_line,
}));
```

### 4. Updated API Documentation

Updated `graph-routes.md` to reflect the simplified schema without the removed fields.

## How to Use Graph Explorer

### Prerequisites

1. **CodexLens must be installed and initialized:**
   ```bash
   pip install -e codex-lens/
   ```

2. **Project must be indexed:**
   ```bash
   # Via CLI
   codex init <project-path>

   # Or via CCW Dashboard
   # Navigate to "CodexLens" view → Click "Initialize" → Select project
   ```

   This creates the `_index.db` database at `~/.codexlens/indexes/<normalized-path>/_index.db`

3. **Symbols and relationships must be extracted:**
   - CodexLens automatically indexes symbols during `init`
   - Requires TreeSitter parsers for your programming language
   - Relationships are extracted via migration 003 (code_relationships table)

### Accessing Graph Explorer

1. **Start CCW Dashboard:**
   ```bash
   ccw view
   ```

2. **Navigate to Graph Explorer:**
   - Click the "Graph" icon in the left sidebar (git-branch icon)
   - Or use keyboard shortcut if configured

3. **View Code Structure:**
   - **Code Relations Tab**: Interactive graph visualization of symbols and their relationships
   - **Search Process Tab**: Visualizes search pipeline steps (experimental)

### Graph Controls

**Toolbar (top-right):**
- **Fit View**: Zoom to fit all nodes in viewport
- **Center**: Center the graph
- **Reset Filters**: Clear all node/edge type filters
- **Refresh**: Reload data from database

**Sidebar Filters:**
- **Node Types**: Filter by MODULE, CLASS, FUNCTION, METHOD, VARIABLE
- **Edge Types**: Filter by CALLS, IMPORTS, INHERITS
- **Legend**: Color-coded guide for node/edge types

**Interaction:**
- **Click node**: Show details panel with symbol information
- **Drag nodes**: Rearrange graph layout
- **Scroll**: Zoom in/out
- **Pan**: Click and drag on empty space

### API Endpoints

The Graph Explorer uses these REST endpoints:

1. **GET /api/graph/nodes**
   - Returns all symbols as graph nodes
   - Query param: `path` (optional, defaults to current project)

2. **GET /api/graph/edges**
   - Returns all code relationships as graph edges
   - Query param: `path` (optional)

3. **GET /api/graph/impact**
   - Returns impact analysis for a symbol
   - Query params: `path`, `symbol` (required, format: `file:name:line`)

## Verification

To verify the fix works:

1. **Ensure project is indexed:**
   ```bash
   ls ~/.codexlens/indexes/
   # Should show your project path
   ```

2. **Check database has symbols:**
   ```bash
   sqlite3 ~/.codexlens/indexes/<your-project>/_index.db "SELECT COUNT(*) FROM symbols"
   # Should return > 0
   ```

3. **Check schema version:**
   ```bash
   sqlite3 ~/.codexlens/indexes/<your-project>/_index.db "PRAGMA user_version"
   # Should return: 5 (after migration 005)
   ```

4. **Test Graph Explorer:**
   - Open CCW dashboard: `ccw view`
   - Navigate to Graph view
   - Should see nodes/edges displayed without errors

## Related Files

- **Implementation**: `ccw/src/core/routes/graph-routes.ts`
- **Frontend**: `ccw/frontend/src/components/GraphExplorer.tsx` (React SPA)
- **Styles**: Embedded in React components
- **API Docs**: `ccw/src/core/routes/graph-routes.md`
- **Migration**: `codex-lens/src/codexlens/storage/migrations/migration_005_cleanup_unused_fields.py`

## Impact

- **Breaking Change**: Graph Explorer required codex-lens database schema v5
- **Data Loss**: None (removed fields were unused or redundant)
- **Compatibility**: Graph Explorer now works correctly with migration 005+
- **Future**: All CCW features requiring codex-lens database access must respect schema version 5

## References

- Migration 005 Documentation: `codex-lens/docs/MIGRATION_005_SUMMARY.md`
- Graph Routes API: `ccw/src/core/routes/graph-routes.md`
- CodexLens Schema: `codex-lens/src/codexlens/storage/dir_index.py`
