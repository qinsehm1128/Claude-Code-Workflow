"""Tests for performance optimizations in CodexLens.

This module tests the following optimizations:
1. Normalized keywords search (migration_001)
2. Optimized path lookup in registry
3. Prefix-mode symbol search
4. Graph expansion neighbor precompute overhead (<20%)
5. Cross-encoder reranking latency (<200ms)
"""

import json
import sqlite3
import tempfile
import time
from pathlib import Path

import pytest

from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.registry import RegistryStore
from codexlens.storage.migration_manager import MigrationManager
from codexlens.storage.migrations import migration_001_normalize_keywords


@pytest.fixture
def temp_index_db():
    """Create a temporary dir index database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_index.db"
        store = DirIndexStore(db_path)
        store.initialize()  # Initialize schema
        yield store
        store.close()


@pytest.fixture
def temp_registry_db():
    """Create a temporary registry database."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_registry.db"
        store = RegistryStore(db_path)
        store.initialize()  # Initialize schema
        yield store
        store.close()


@pytest.fixture
def populated_index_db(temp_index_db):
    """Create an index database with sample data.

    Uses 100 files to provide meaningful performance comparison between
    optimized and fallback implementations.
    """
    from codexlens.entities import Symbol

    store = temp_index_db

    # Add files with symbols and keywords
    # Using 100 files to show performance improvements
    file_ids = []

    # Define keyword pools for cycling
    keyword_pools = [
        ["auth", "security", "jwt"],
        ["database", "sql", "query"],
        ["auth", "login", "password"],
        ["api", "rest", "endpoint"],
        ["cache", "redis", "performance"],
        ["auth", "oauth", "token"],
        ["test", "unittest", "pytest"],
        ["database", "postgres", "migration"],
        ["api", "graphql", "resolver"],
        ["security", "encryption", "crypto"]
    ]

    for i in range(100):
        # Create symbols for first 50 files to have more symbol search data
        symbols = None
        if i < 50:
            symbols = [
                Symbol(name=f"get_user_{i}", kind="function", range=(1, 10)),
                Symbol(name=f"create_user_{i}", kind="function", range=(11, 20)),
                Symbol(name=f"UserClass_{i}", kind="class", range=(21, 40)),
            ]

        file_id = store.add_file(
            name=f"file_{i}.py",
            full_path=Path(f"/test/path/file_{i}.py"),
            content=f"def function_{i}(): pass\n" * 10,
            language="python",
            symbols=symbols
        )
        file_ids.append(file_id)

        # Add semantic metadata with keywords (cycle through keyword pools)
        keywords = keyword_pools[i % len(keyword_pools)]
        store.add_semantic_metadata(
            file_id=file_id,
            summary=f"Test file {file_id}",
            keywords=keywords,
            purpose="Testing",
            llm_tool="gemini"
        )

    return store


class TestKeywordNormalization:
    """Test normalized keywords functionality."""

    def test_migration_creates_tables(self, temp_index_db):
        """Test that migration creates keywords and file_keywords tables."""
        conn = temp_index_db._get_connection()

        # Verify tables exist (created by _create_schema)
        tables = conn.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name IN ('keywords', 'file_keywords')
        """).fetchall()

        assert len(tables) == 2

    def test_migration_creates_indexes(self, temp_index_db):
        """Test that migration creates necessary indexes."""
        conn = temp_index_db._get_connection()

        # Check for indexes
        indexes = conn.execute("""
            SELECT name FROM sqlite_master
            WHERE type='index' AND name IN (
                'idx_keywords_keyword',
                'idx_file_keywords_file_id',
                'idx_file_keywords_keyword_id'
            )
        """).fetchall()

        assert len(indexes) == 3

    def test_add_semantic_metadata_populates_normalized_tables(self, temp_index_db):
        """Test that adding metadata populates the normalized keyword tables."""
        # Add a file
        file_id = temp_index_db.add_file(
            name="test.py",
            full_path=Path("/test/test.py"),
            language="python",
            content="test"
        )

        # Add semantic metadata
        keywords = ["auth", "security", "jwt"]
        temp_index_db.add_semantic_metadata(
            file_id=file_id,
            summary="Test summary",
            keywords=keywords,
            purpose="Testing",
            llm_tool="gemini"
        )

        conn = temp_index_db._get_connection()

        # Check semantic_metadata table (without keywords column in current schema)
        row = conn.execute(
            "SELECT summary, purpose, llm_tool FROM semantic_metadata WHERE file_id=?",
            (file_id,)
        ).fetchone()
        assert row is not None
        assert row["summary"] == "Test summary"
        assert row["purpose"] == "Testing"
        assert row["llm_tool"] == "gemini"

        # Check normalized keywords table
        keyword_rows = conn.execute("""
            SELECT k.keyword
            FROM file_keywords fk
            JOIN keywords k ON fk.keyword_id = k.id
            WHERE fk.file_id = ?
        """, (file_id,)).fetchall()

        assert len(keyword_rows) == 3
        normalized_keywords = [row["keyword"] for row in keyword_rows]
        assert set(normalized_keywords) == set(keywords)

    def test_search_semantic_keywords_normalized(self, populated_index_db):
        """Test optimized keyword search using normalized tables."""
        results = populated_index_db.search_semantic_keywords("auth", use_normalized=True)

        # Should find 3 files with "auth" keyword
        assert len(results) >= 3

        # Verify results structure
        for file_entry, keywords in results:
            assert file_entry.name.startswith("file_")
            assert isinstance(keywords, list)
            assert any("auth" in k.lower() for k in keywords)

    def test_search_semantic_keywords_fallback(self, populated_index_db):
        """Test that fallback search still works."""
        results = populated_index_db.search_semantic_keywords("auth", use_normalized=False)

        # Should find files with "auth" keyword
        assert len(results) >= 3

        for file_entry, keywords in results:
            assert isinstance(keywords, list)


class TestPathLookupOptimization:
    """Test optimized path lookup in registry."""

    def test_find_nearest_index_shallow(self, temp_registry_db):
        """Test path lookup with shallow directory structure."""
        # Register a project first
        project = temp_registry_db.register_project(
            source_root=Path("/test"),
            index_root=Path("/tmp")
        )

        # Register directory mapping
        temp_registry_db.register_dir(
            project_id=project.id,
            source_path=Path("/test"),
            index_path=Path("/tmp/index.db"),
            depth=0,
            files_count=0
        )

        # Search for subdirectory
        result = temp_registry_db.find_nearest_index(Path("/test/subdir/file.py"))

        assert result is not None
        # Compare as strings for cross-platform compatibility
        assert "/test" in str(result.source_path) or "\\test" in str(result.source_path)

    def test_find_nearest_index_deep(self, temp_registry_db):
        """Test path lookup with deep directory structure."""
        # Register a project
        project = temp_registry_db.register_project(
            source_root=Path("/a"),
            index_root=Path("/tmp")
        )

        # Add directory mappings at different levels
        temp_registry_db.register_dir(
            project_id=project.id,
            source_path=Path("/a"),
            index_path=Path("/tmp/index_a.db"),
            depth=0,
            files_count=0
        )
        temp_registry_db.register_dir(
            project_id=project.id,
            source_path=Path("/a/b/c"),
            index_path=Path("/tmp/index_abc.db"),
            depth=2,
            files_count=0
        )

        # Should find nearest (longest) match
        result = temp_registry_db.find_nearest_index(Path("/a/b/c/d/e/f/file.py"))

        assert result is not None
        # Check that path contains the key parts
        result_path = str(result.source_path)
        assert "a" in result_path and "b" in result_path and "c" in result_path

    def test_find_nearest_index_not_found(self, temp_registry_db):
        """Test path lookup when no mapping exists."""
        result = temp_registry_db.find_nearest_index(Path("/nonexistent/path"))
        assert result is None

    def test_find_nearest_index_performance(self, temp_registry_db):
        """Basic performance test for path lookup."""
        # Register a project
        project = temp_registry_db.register_project(
            source_root=Path("/root"),
            index_root=Path("/tmp")
        )

        # Add mapping at root
        temp_registry_db.register_dir(
            project_id=project.id,
            source_path=Path("/root"),
            index_path=Path("/tmp/index.db"),
            depth=0,
            files_count=0
        )

        # Test with very deep path (10 levels)
        deep_path = Path("/root/a/b/c/d/e/f/g/h/i/j/file.py")

        start = time.perf_counter()
        result = temp_registry_db.find_nearest_index(deep_path)
        elapsed = time.perf_counter() - start

        # Should complete quickly (< 50ms even on slow systems)
        assert elapsed < 0.05
        assert result is not None


class TestSymbolSearchOptimization:
    """Test optimized symbol search."""

    def test_symbol_search_prefix_mode(self, populated_index_db):
        """Test symbol search with prefix mode."""
        results = populated_index_db.search_symbols("get", prefix_mode=True)

        # Should find symbols starting with "get"
        assert len(results) > 0
        for symbol in results:
            assert symbol.name.startswith("get")

    def test_symbol_search_substring_mode(self, populated_index_db):
        """Test symbol search with substring mode."""
        results = populated_index_db.search_symbols("user", prefix_mode=False)

        # Should find symbols containing "user"
        assert len(results) > 0
        for symbol in results:
            assert "user" in symbol.name.lower()

    def test_symbol_search_with_kind_filter(self, populated_index_db):
        """Test symbol search with kind filter."""
        results = populated_index_db.search_symbols(
            "UserClass",
            kind="class",
            prefix_mode=True
        )

        # Should find only class symbols
        assert len(results) > 0
        for symbol in results:
            assert symbol.kind == "class"

    def test_symbol_search_limit(self, populated_index_db):
        """Test symbol search respects limit."""
        results = populated_index_db.search_symbols("", prefix_mode=True, limit=5)

        # Should return at most 5 results
        assert len(results) <= 5


class TestMigrationManager:
    """Test migration manager functionality."""

    def test_migration_manager_tracks_version(self, temp_index_db):
        """Test that migration manager tracks schema version."""
        conn = temp_index_db._get_connection()
        manager = MigrationManager(conn)

        current_version = manager.get_current_version()
        assert current_version >= 0

    def test_migration_001_can_run(self, temp_index_db):
        """Test that migration_001 is idempotent on current schema.

        Note: Current schema already has normalized keywords tables created
        during initialize(), so migration_001 should be a no-op but not fail.
        The original migration was designed to migrate from semantic_metadata.keywords
        to normalized tables, but new databases use normalized tables directly.
        """
        conn = temp_index_db._get_connection()

        # Add some test data using the current normalized schema
        conn.execute("""
            INSERT INTO files(id, name, full_path, language, content, mtime, line_count)
            VALUES(100, 'test.py', '/test_migration.py', 'python', 'def test(): pass', 0, 10)
        """)

        # Insert directly into normalized tables (current schema)
        conn.execute("INSERT OR IGNORE INTO keywords(keyword) VALUES(?)", ("test",))
        conn.execute("INSERT OR IGNORE INTO keywords(keyword) VALUES(?)", ("keyword",))

        kw1_id = conn.execute("SELECT id FROM keywords WHERE keyword=?", ("test",)).fetchone()[0]
        kw2_id = conn.execute("SELECT id FROM keywords WHERE keyword=?", ("keyword",)).fetchone()[0]

        conn.execute("INSERT OR IGNORE INTO file_keywords(file_id, keyword_id) VALUES(?, ?)", (100, kw1_id))
        conn.execute("INSERT OR IGNORE INTO file_keywords(file_id, keyword_id) VALUES(?, ?)", (100, kw2_id))
        conn.commit()

        # Run migration (should be idempotent - tables already exist)
        try:
            migration_001_normalize_keywords.upgrade(conn)
            success = True
        except Exception as e:
            success = False
            print(f"Migration failed: {e}")

        assert success

        # Verify data still exists
        keyword_count = conn.execute("""
            SELECT COUNT(*) as c FROM file_keywords WHERE file_id=100
        """).fetchone()["c"]

        assert keyword_count == 2  # "test" and "keyword"


class TestPerformanceComparison:
    """Compare performance of old vs new implementations."""

    def test_keyword_search_performance(self, populated_index_db):
        """Compare keyword search performance.

        IMPORTANT: The normalized query optimization is designed for large datasets
        (1000+ files). On small datasets (< 1000 files), the overhead of JOINs and
        GROUP BY operations can make the normalized query slower than the simple
        LIKE query on JSON fields. This is expected behavior.

        Performance benefits appear when:
        - Dataset size > 1000 files
        - Full-table scans on JSON LIKE become the bottleneck
        - Index-based lookups provide O(log N) complexity advantage
        """
        # Normalized search
        start = time.perf_counter()
        normalized_results = populated_index_db.search_semantic_keywords(
            "auth",
            use_normalized=True
        )
        normalized_time = time.perf_counter() - start

        # Fallback search
        start = time.perf_counter()
        fallback_results = populated_index_db.search_semantic_keywords(
            "auth",
            use_normalized=False
        )
        fallback_time = time.perf_counter() - start

        # Verify correctness: both queries should return identical results
        assert len(normalized_results) == len(fallback_results)

        # Verify result content matches
        normalized_files = {entry.id for entry, _ in normalized_results}
        fallback_files = {entry.id for entry, _ in fallback_results}
        assert normalized_files == fallback_files, "Both queries must return same files"

        # Document performance characteristics (no strict assertion)
        # On datasets < 1000 files, normalized may be slower due to JOIN overhead
        print(f"\nKeyword search performance (100 files):")
        print(f"  Normalized: {normalized_time*1000:.3f}ms")
        print(f"  Fallback:   {fallback_time*1000:.3f}ms")
        print(f"  Ratio:      {normalized_time/fallback_time:.2f}x")
        print(f"  Note: Performance benefits appear with 1000+ files")

    def test_prefix_vs_substring_symbol_search(self, populated_index_db):
        """Compare prefix vs substring symbol search performance.

        IMPORTANT: Prefix search optimization (LIKE 'prefix%') benefits from B-tree
        indexes, but on small datasets (< 1000 symbols), the performance difference
        may not be measurable or may even be slower due to query planner overhead.

        Performance benefits appear when:
        - Symbol count > 1000
        - Index-based prefix search provides O(log N) advantage
        - Full table scans with LIKE '%substring%' become bottleneck
        """
        # Prefix search (optimized)
        start = time.perf_counter()
        prefix_results = populated_index_db.search_symbols("get", prefix_mode=True)
        prefix_time = time.perf_counter() - start

        # Substring search (fallback)
        start = time.perf_counter()
        substring_results = populated_index_db.search_symbols("get", prefix_mode=False)
        substring_time = time.perf_counter() - start

        # Verify correctness: prefix results should be subset of substring results
        prefix_names = {s.name for s in prefix_results}
        substring_names = {s.name for s in substring_results}
        assert prefix_names.issubset(substring_names), "Prefix must be subset of substring"

        # Verify all prefix results actually start with search term
        for symbol in prefix_results:
            assert symbol.name.startswith("get"), f"Symbol {symbol.name} should start with 'get'"

        # Document performance characteristics (no strict assertion)
        # On datasets < 1000 symbols, performance difference is negligible
        print(f"\nSymbol search performance (150 symbols):")
        print(f"  Prefix:    {prefix_time*1000:.3f}ms ({len(prefix_results)} results)")
        print(f"  Substring: {substring_time*1000:.3f}ms ({len(substring_results)} results)")
        print(f"  Ratio:     {prefix_time/substring_time:.2f}x")
        print(f"  Note: Performance benefits appear with 1000+ symbols")


class TestPerformanceBenchmarks:
    """Benchmark-style assertions for key performance requirements."""

    def test_graph_expansion_indexing_overhead_under_20_percent(self, temp_index_db, tmp_path):
        """Graph neighbor precompute adds <20% overhead versus indexing baseline."""
        from codexlens.entities import CodeRelationship, RelationshipType, Symbol
        from codexlens.storage.index_tree import _compute_graph_neighbors

        store = temp_index_db

        file_count = 60
        symbols_per_file = 8

        start = time.perf_counter()
        for file_idx in range(file_count):
            file_path = tmp_path / f"graph_{file_idx}.py"
            lines = []
            for sym_idx in range(symbols_per_file):
                lines.append(f"def func_{file_idx}_{sym_idx}():")
                lines.append(f"    return {sym_idx}")
                lines.append("")
            content = "\n".join(lines)

            symbols = [
                Symbol(
                    name=f"func_{file_idx}_{sym_idx}",
                    kind="function",
                    range=(sym_idx * 3 + 1, sym_idx * 3 + 2),
                    file=str(file_path),
                )
                for sym_idx in range(symbols_per_file)
            ]

            relationships = [
                CodeRelationship(
                    source_symbol=f"func_{file_idx}_{sym_idx}",
                    target_symbol=f"func_{file_idx}_{sym_idx + 1}",
                    relationship_type=RelationshipType.CALL,
                    source_file=str(file_path),
                    target_file=None,
                    source_line=sym_idx * 3 + 2,
                )
                for sym_idx in range(symbols_per_file - 1)
            ]

            store.add_file(
                name=file_path.name,
                full_path=file_path,
                content=content,
                language="python",
                symbols=symbols,
                relationships=relationships,
            )
        baseline_time = time.perf_counter() - start

        durations = []
        for _ in range(3):
            start = time.perf_counter()
            _compute_graph_neighbors(store)
            durations.append(time.perf_counter() - start)
        graph_time = min(durations)

        # Sanity-check that the benchmark exercised graph neighbor generation.
        conn = store._get_connection()
        neighbor_count = conn.execute(
            "SELECT COUNT(*) as c FROM graph_neighbors"
        ).fetchone()["c"]
        assert neighbor_count > 0

        assert baseline_time > 0.0
        overhead_ratio = graph_time / baseline_time
        assert overhead_ratio < 0.2, (
            f"Graph neighbor precompute overhead too high: {overhead_ratio:.2%} "
            f"(baseline={baseline_time:.3f}s, graph={graph_time:.3f}s)"
        )

    def test_stage2_expansion_precomputed_vs_static_global_graph_benchmark(self, tmp_path):
        """Benchmark Stage-2 expansion: precomputed graph_neighbors vs static global graph.

        This test is informational (prints timings) and asserts only correctness
        and that both expanders return some related results.
        """
        from codexlens.entities import CodeRelationship, RelationshipType, SearchResult, Symbol
        from codexlens.search.graph_expander import GraphExpander
        from codexlens.search.global_graph_expander import GlobalGraphExpander
        from codexlens.storage.dir_index import DirIndexStore
        from codexlens.storage.global_index import GlobalSymbolIndex
        from codexlens.storage.index_tree import _compute_graph_neighbors
        from codexlens.storage.path_mapper import PathMapper

        # Source + index roots
        source_dir = tmp_path / "proj" / "src"
        source_dir.mkdir(parents=True, exist_ok=True)
        mapper = PathMapper(index_root=tmp_path / "indexes")

        index_db_path = mapper.source_to_index_db(source_dir)
        index_db_path.parent.mkdir(parents=True, exist_ok=True)

        store = DirIndexStore(index_db_path)
        store.initialize()

        file_count = 30
        per_file_symbols = 2
        file_paths = []
        per_file_symbols_list = []
        per_file_relationships_list = []

        for i in range(file_count):
            file_path = source_dir / f"m{i}.py"
            file_paths.append(file_path)
            file_path.write_text("pass\n", encoding="utf-8")

            symbols = [
                Symbol(
                    name=f"func_{i}_{j}",
                    kind="function",
                    range=(j + 1, j + 1),
                    file=str(file_path.resolve()),
                )
                for j in range(per_file_symbols)
            ]
            per_file_symbols_list.append(symbols)

            relationships: list[CodeRelationship] = []
            # Intra-file edge: func_i_0 -> func_i_1
            relationships.append(
                CodeRelationship(
                    source_symbol=f"func_{i}_0",
                    target_symbol=f"func_{i}_1",
                    relationship_type=RelationshipType.CALL,
                    source_file=str(file_path.resolve()),
                    target_file=str(file_path.resolve()),
                    source_line=1,
                )
            )
            # Cross-file edge: func_i_0 -> func_(i+1)_0 (name-unique across dir)
            j = (i + 1) % file_count
            relationships.append(
                CodeRelationship(
                    source_symbol=f"func_{i}_0",
                    target_symbol=f"func_{j}_0",
                    relationship_type=RelationshipType.CALL,
                    source_file=str(file_path.resolve()),
                    target_file=str((source_dir / f"m{j}.py").resolve()),
                    source_line=1,
                )
            )
            per_file_relationships_list.append(relationships)

            store.add_file(
                name=file_path.name,
                full_path=file_path,
                content="pass\n",
                language="python",
                symbols=symbols,
                relationships=relationships,
            )

        # Precompute graph_neighbors for GraphExpander (precomputed Stage-2 build)
        start = time.perf_counter()
        _compute_graph_neighbors(store)
        graph_build_ms = (time.perf_counter() - start) * 1000.0
        store.close()

        # Build global symbol index + relationships for GlobalGraphExpander
        global_db_path = index_db_path.parent / GlobalSymbolIndex.DEFAULT_DB_NAME
        global_index = GlobalSymbolIndex(global_db_path, project_id=1)
        global_index.initialize()
        try:
            index_path_str = str(index_db_path.resolve())
            start = time.perf_counter()
            for file_path, symbols in zip(file_paths, per_file_symbols_list):
                file_path_str = str(file_path.resolve())
                global_index.update_file_symbols(
                    file_path_str,
                    symbols,
                    index_path=index_path_str,
                )
            global_symbols_ms = (time.perf_counter() - start) * 1000.0

            start = time.perf_counter()
            for file_path, relationships in zip(file_paths, per_file_relationships_list):
                file_path_str = str(file_path.resolve())
                global_index.update_file_relationships(file_path_str, relationships)
            global_relationships_ms = (time.perf_counter() - start) * 1000.0

            base_results = [
                SearchResult(
                    path=str(file_paths[i].resolve()),
                    score=1.0,
                    excerpt=None,
                    content=None,
                    start_line=1,
                    end_line=1,
                    symbol_name=f"func_{i}_0",
                    symbol_kind="function",
                )
                for i in range(min(10, file_count))
            ]

            pre_expander = GraphExpander(mapper)
            static_expander = GlobalGraphExpander(global_index)

            start = time.perf_counter()
            pre_related = pre_expander.expand(
                base_results,
                depth=2,
                max_expand=10,
                max_related=50,
            )
            pre_ms = (time.perf_counter() - start) * 1000.0

            start = time.perf_counter()
            static_related = static_expander.expand(
                base_results,
                top_n=10,
                max_related=50,
            )
            static_ms = (time.perf_counter() - start) * 1000.0

            assert pre_related, "Expected precomputed graph expansion to return related results"
            assert static_related, "Expected static global graph expansion to return related results"

            print("\nStage-2 build benchmark (30 files, 2 symbols/file):")
            print(f"  graph_neighbors precompute:   {graph_build_ms:.2f}ms")
            print(f"  global_symbols write:         {global_symbols_ms:.2f}ms")
            print(f"  global_relationships write:   {global_relationships_ms:.2f}ms")

            print("\nStage-2 expansion benchmark (30 files, 2 symbols/file):")
            print(f"  precomputed (graph_neighbors): {pre_ms:.2f}ms, related={len(pre_related)}")
            print(f"  static_global_graph:           {static_ms:.2f}ms, related={len(static_related)}")
        finally:
            global_index.close()

    def test_relationship_extraction_astgrep_vs_treesitter_benchmark(self, tmp_path):
        """Informational benchmark: relationship extraction via ast-grep vs tree-sitter.

        Skips when optional parser dependencies are unavailable.
        """
        import textwrap

        from codexlens.config import Config
        from codexlens.parsers.astgrep_processor import is_astgrep_processor_available
        from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser

        if not is_astgrep_processor_available():
            pytest.skip("ast-grep processor unavailable (optional dependency)")

        code = textwrap.dedent(
            """
            import os
            from typing import List

            class Base:
                pass

            class Child(Base):
                def method(self) -> List[str]:
                    return [os.path.join("a", "b")]
            """
        ).lstrip()

        file_path = tmp_path / "sample.py"
        file_path.write_text(code, encoding="utf-8")

        cfg_ts = Config(data_dir=tmp_path / "cfg_ts")
        cfg_ts.use_astgrep = False
        ts_parser = TreeSitterSymbolParser("python", file_path, config=cfg_ts)
        if not ts_parser.is_available():
            pytest.skip("tree-sitter python binding unavailable")

        cfg_ag = Config(data_dir=tmp_path / "cfg_ag")
        cfg_ag.use_astgrep = True
        ag_parser = TreeSitterSymbolParser("python", file_path, config=cfg_ag)
        if getattr(ag_parser, "_astgrep_processor", None) is None:
            pytest.skip("ast-grep processor failed to initialize")

        def _bench(parser: TreeSitterSymbolParser) -> tuple[float, int]:
            durations = []
            rel_counts = []
            for _ in range(3):
                start = time.perf_counter()
                indexed = parser.parse(code, file_path)
                durations.append(time.perf_counter() - start)
                rel_counts.append(0 if indexed is None else len(indexed.relationships))
            return min(durations) * 1000.0, max(rel_counts)

        ts_ms, ts_rels = _bench(ts_parser)
        ag_ms, ag_rels = _bench(ag_parser)

        assert ts_rels > 0, "Expected relationships extracted via tree-sitter"
        assert ag_rels > 0, "Expected relationships extracted via ast-grep"

        print("\nRelationship extraction benchmark (python, 1 file):")
        print(f"  tree-sitter: {ts_ms:.2f}ms, rels={ts_rels}")
        print(f"  ast-grep:    {ag_ms:.2f}ms, rels={ag_rels}")

    def test_cross_encoder_reranking_latency_under_200ms(self):
        """Cross-encoder rerank step completes under 200ms (excluding model load)."""
        from codexlens.entities import SearchResult
        from codexlens.search.ranking import cross_encoder_rerank

        query = "find function"
        results = [
            SearchResult(
                path=f"file_{idx}.py",
                score=1.0 / (idx + 1),
                excerpt=f"def func_{idx}():\n    return {idx}",
                symbol_name=f"func_{idx}",
                symbol_kind="function",
            )
            for idx in range(50)
        ]

        class DummyReranker:
            def score_pairs(self, pairs, batch_size=32):
                _ = batch_size
                # Return deterministic pseudo-logits to exercise sigmoid normalization.
                return [float(i) for i in range(len(pairs))]

        reranker = DummyReranker()

        start = time.perf_counter()
        reranked = cross_encoder_rerank(query, results, reranker, top_k=50, batch_size=32)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        assert len(reranked) == len(results)
        assert any(r.metadata.get("cross_encoder_reranked") for r in reranked[:50])
        assert elapsed_ms < 200.0, f"Cross-encoder rerank too slow: {elapsed_ms:.1f}ms"
