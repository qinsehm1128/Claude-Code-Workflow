"""Tests for global_relationships table in GlobalSymbolIndex."""

import sqlite3
import tempfile
import time
from pathlib import Path

import pytest

from codexlens.entities import CodeRelationship, RelationshipType
from codexlens.storage.global_index import GlobalSymbolIndex


@pytest.fixture()
def temp_paths():
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def _make_rel(
    source_symbol: str,
    target_symbol: str,
    rel_type: RelationshipType = RelationshipType.CALL,
    source_file: str = "src/a.py",
    target_file: str | None = None,
    source_line: int = 1,
) -> CodeRelationship:
    return CodeRelationship(
        source_symbol=source_symbol,
        target_symbol=target_symbol,
        relationship_type=rel_type,
        source_file=source_file,
        target_file=target_file,
        source_line=source_line,
    )


# ------------------------------------------------------------------
# Schema creation (fresh DB)
# ------------------------------------------------------------------


def test_fresh_schema_creates_relationships_table(temp_paths: Path):
    """New DB at SCHEMA_VERSION=2 should have global_relationships table."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        conn = store._get_connection()
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "global_relationships" in tables
        assert "global_symbols" in tables

        # Verify indexes exist
        indexes = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            ).fetchall()
        }
        assert "idx_global_rel_project_target" in indexes
        assert "idx_global_rel_project_source" in indexes


def test_schema_version_is_2(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    with GlobalSymbolIndex(db_path, project_id=1) as store:
        conn = store._get_connection()
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        assert version == 2


# ------------------------------------------------------------------
# Migration v1 -> v2
# ------------------------------------------------------------------


def test_migration_v1_to_v2(temp_paths: Path):
    """A v1 database should gain the global_relationships table on upgrade."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Simulate a v1 database: create global_symbols table + set version=1.
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS global_symbols (
            id INTEGER PRIMARY KEY,
            project_id INTEGER NOT NULL,
            symbol_name TEXT NOT NULL,
            symbol_kind TEXT NOT NULL,
            file_path TEXT NOT NULL,
            start_line INTEGER,
            end_line INTEGER,
            index_path TEXT NOT NULL,
            UNIQUE(project_id, symbol_name, symbol_kind, file_path, start_line, end_line)
        )
        """
    )
    conn.execute("PRAGMA user_version = 1")
    conn.commit()
    conn.close()

    # Now open with the new code -- migration should fire.
    with GlobalSymbolIndex(db_path, project_id=1) as store:
        conn = store._get_connection()
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        assert version == 2

        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert "global_relationships" in tables


def test_migration_idempotent(temp_paths: Path):
    """Running migration twice should not fail (CREATE TABLE IF NOT EXISTS)."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"

    # First init
    store = GlobalSymbolIndex(db_path, project_id=1)
    store.initialize()
    store.close()

    # Second init on same DB -- should be a no-op.
    store2 = GlobalSymbolIndex(db_path, project_id=1)
    store2.initialize()
    store2.close()


# ------------------------------------------------------------------
# update_file_relationships
# ------------------------------------------------------------------


def test_update_file_relationships_insert(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "auth.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel("login", "validate_token", source_file="src/auth.py", source_line=10),
        _make_rel("login", "hash_password", source_file="src/auth.py", source_line=15),
        _make_rel("AuthManager", "BaseManager", RelationshipType.INHERITS, "src/auth.py", source_line=1),
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, rels)

        # Verify rows exist
        conn = store._get_connection()
        count = conn.execute(
            "SELECT COUNT(*) FROM global_relationships WHERE project_id=1"
        ).fetchone()[0]
        assert count == 3


def test_update_file_relationships_replaces_atomically(temp_paths: Path):
    """Second call should delete old rows and insert new ones."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "mod.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    old_rels = [_make_rel("foo", "bar", source_file="src/mod.py", source_line=5)]
    new_rels = [
        _make_rel("baz", "qux", source_file="src/mod.py", source_line=10),
        _make_rel("baz", "quux", source_file="src/mod.py", source_line=11),
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, old_rels)
        store.update_file_relationships(file_path, new_rels)

        conn = store._get_connection()
        rows = conn.execute(
            "SELECT source_symbol FROM global_relationships WHERE project_id=1 ORDER BY source_line"
        ).fetchall()
        names = [r[0] for r in rows]
        assert "foo" not in names
        assert "baz" in names
        assert len(rows) == 2


def test_update_file_relationships_empty_clears(temp_paths: Path):
    """Passing empty list should delete all relationships for the file."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "x.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(
            file_path,
            [_make_rel("a", "b", source_file="src/x.py")],
        )
        store.update_file_relationships(file_path, [])

        conn = store._get_connection()
        count = conn.execute(
            "SELECT COUNT(*) FROM global_relationships WHERE project_id=1"
        ).fetchone()[0]
        assert count == 0


# ------------------------------------------------------------------
# query_by_target
# ------------------------------------------------------------------


def test_query_by_target_exact(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "a.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel("caller", "TargetClass", source_file="src/a.py", source_line=10),
        _make_rel("caller2", "TargetClassExtra", source_file="src/a.py", source_line=20),
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, rels)

        # Exact match
        results = store.query_by_target("TargetClass", prefix_mode=False)
        assert len(results) == 1
        src_file, src_sym, rel_type, line = results[0]
        assert src_sym == "caller"
        assert rel_type == "calls"
        assert line == 10


def test_query_by_target_prefix(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "a.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel("c1", "TargetClass", source_file="src/a.py", source_line=10),
        _make_rel("c2", "TargetClassExtra", source_file="src/a.py", source_line=20),
        _make_rel("c3", "Unrelated", source_file="src/a.py", source_line=30),
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, rels)

        # Prefix match should return both Target* rows
        results = store.query_by_target("TargetClass", prefix_mode=True)
        assert len(results) == 2
        symbols = {r[1] for r in results}
        assert symbols == {"c1", "c2"}


def test_query_by_target_cross_directory(temp_paths: Path):
    """Relationships from different files can be queried by the same target."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_a = temp_paths / "src" / "a.py"
    file_b = temp_paths / "lib" / "b.py"
    for f in (file_a, file_b):
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(
            file_a,
            [_make_rel("funcA", "SharedTarget", source_file="src/a.py", source_line=5)],
        )
        store.update_file_relationships(
            file_b,
            [_make_rel("funcB", "SharedTarget", source_file="lib/b.py", source_line=8)],
        )

        results = store.query_by_target("SharedTarget", prefix_mode=False)
        assert len(results) == 2
        files = {r[0] for r in results}
        assert str(file_a.resolve()) in files
        assert str(file_b.resolve()) in files


# ------------------------------------------------------------------
# query_relationships_for_symbols
# ------------------------------------------------------------------


def test_query_relationships_for_symbols_source_match(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "mod.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel("MyClass", "BaseClass", RelationshipType.INHERITS, "src/mod.py", source_line=1),
        _make_rel("helper", "utils", RelationshipType.IMPORTS, "src/mod.py", source_line=2),
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, rels)

        # Query by source_symbol name
        rows = store.query_relationships_for_symbols(["MyClass"])
        assert len(rows) >= 1
        assert any(r["source_symbol"] == "MyClass" for r in rows)


def test_query_relationships_for_symbols_target_match(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "mod.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel("caller", "TargetFunc", source_file="src/mod.py", source_line=5),
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, rels)

        # Query by target name -- should match via LIKE %TargetFunc
        rows = store.query_relationships_for_symbols(["TargetFunc"])
        assert len(rows) >= 1
        assert any(r["target_qualified_name"] == "TargetFunc" for r in rows)


def test_query_relationships_for_symbols_empty_list(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        rows = store.query_relationships_for_symbols([])
        assert rows == []


def test_query_relationships_for_symbols_qualified_target(temp_paths: Path):
    """A qualified target like 'lib/b.py::BaseClass' should still match 'BaseClass'."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "a.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rel = CodeRelationship(
        source_symbol="Child",
        target_symbol="BaseClass",
        relationship_type=RelationshipType.INHERITS,
        source_file="src/a.py",
        target_file="lib/b.py",
        source_line=1,
    )

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, [rel])

        # The qualified name is "lib/b.py::BaseClass"
        # query_relationships_for_symbols uses LIKE %BaseClass which should match
        rows = store.query_relationships_for_symbols(["BaseClass"])
        assert len(rows) == 1
        assert rows[0]["target_qualified_name"] == "lib/b.py::BaseClass"


# ------------------------------------------------------------------
# delete_file_relationships
# ------------------------------------------------------------------


def test_delete_file_relationships(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "a.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(
            file_path,
            [
                _make_rel("f1", "t1", source_file="src/a.py", source_line=1),
                _make_rel("f2", "t2", source_file="src/a.py", source_line=2),
            ],
        )

        deleted = store.delete_file_relationships(file_path)
        assert deleted == 2

        conn = store._get_connection()
        count = conn.execute(
            "SELECT COUNT(*) FROM global_relationships WHERE project_id=1"
        ).fetchone()[0]
        assert count == 0


def test_delete_file_relationships_no_rows(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    nonexistent = temp_paths / "src" / "nope.py"

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        deleted = store.delete_file_relationships(nonexistent)
        assert deleted == 0


# ------------------------------------------------------------------
# Project isolation
# ------------------------------------------------------------------


def test_project_isolation(temp_paths: Path):
    """Relationships from different project_ids should not leak."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "a.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    store1 = GlobalSymbolIndex(db_path, project_id=1)
    store1.initialize()
    store2 = GlobalSymbolIndex(db_path, project_id=2)
    # store2 reuses the same DB; schema already created.

    store1.update_file_relationships(
        file_path,
        [_make_rel("a", "SharedTarget", source_file="src/a.py")],
    )
    store2.update_file_relationships(
        file_path,
        [_make_rel("b", "SharedTarget", source_file="src/a.py")],
    )

    results1 = store1.query_by_target("SharedTarget", prefix_mode=False)
    results2 = store2.query_by_target("SharedTarget", prefix_mode=False)
    assert len(results1) == 1
    assert results1[0][1] == "a"
    assert len(results2) == 1
    assert results2[0][1] == "b"

    store1.close()
    store2.close()


# ------------------------------------------------------------------
# Performance benchmarks
# ------------------------------------------------------------------


def test_update_file_relationships_100_rows_under_50ms(temp_paths: Path):
    """Batch insert of 100 relationships should complete in < 50ms."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "perf.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel(f"src_{i}", f"tgt_{i}", source_file="src/perf.py", source_line=i + 1)
        for i in range(100)
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        start = time.perf_counter()
        store.update_file_relationships(file_path, rels)
        elapsed_ms = (time.perf_counter() - start) * 1000
        assert elapsed_ms < 50.0, f"Took {elapsed_ms:.1f}ms, expected < 50ms"


def test_query_by_target_exact_under_5ms(temp_paths: Path):
    """Exact-match query should complete in < 5ms with 500 rows."""
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "perf.py"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("", encoding="utf-8")

    rels = [
        _make_rel(f"src_{i}", f"Target_{i}", source_file="src/perf.py", source_line=i + 1)
        for i in range(500)
    ]

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.update_file_relationships(file_path, rels)

        start = time.perf_counter()
        results = store.query_by_target("Target_250", prefix_mode=False)
        elapsed_ms = (time.perf_counter() - start) * 1000
        assert elapsed_ms < 5.0, f"Took {elapsed_ms:.1f}ms, expected < 5ms"
        assert len(results) == 1


# ------------------------------------------------------------------
# _build_qualified_name
# ------------------------------------------------------------------


def test_build_qualified_name_with_target_file():
    rel = _make_rel("src", "tgt", target_file="lib/utils.py")
    assert GlobalSymbolIndex._build_qualified_name(rel) == "lib/utils.py::tgt"


def test_build_qualified_name_without_target_file():
    rel = _make_rel("src", "tgt", target_file=None)
    assert GlobalSymbolIndex._build_qualified_name(rel) == "tgt"
