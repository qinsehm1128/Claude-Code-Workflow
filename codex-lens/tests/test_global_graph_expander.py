"""Tests for GlobalGraphExpander."""

import tempfile
from pathlib import Path

import pytest

from codexlens.entities import (
    CodeRelationship,
    RelationshipType,
    SearchResult,
    Symbol,
)
from codexlens.search.global_graph_expander import (
    DECAY_FACTORS,
    DEFAULT_DECAY,
    GlobalGraphExpander,
)
from codexlens.storage.global_index import GlobalSymbolIndex


@pytest.fixture()
def temp_dir():
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    yield Path(tmpdir.name)
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def _setup_global_index(root: Path) -> GlobalSymbolIndex:
    """Create a GlobalSymbolIndex with test symbols and relationships."""
    db_path = root / "test_global.db"
    gsi = GlobalSymbolIndex(db_path, project_id=1)
    gsi.initialize()

    # Files in different directories (cross-directory scenario)
    file_a = str((root / "pkg_a" / "module_a.py").resolve())
    file_b = str((root / "pkg_b" / "module_b.py").resolve())
    file_c = str((root / "pkg_c" / "module_c.py").resolve())
    index_path = str((root / "indexes" / "_index.db").resolve())

    symbols_a = [
        Symbol(name="ClassA", kind="class", range=(1, 20), file=file_a),
        Symbol(name="func_a", kind="function", range=(22, 30), file=file_a),
    ]
    symbols_b = [
        Symbol(name="ClassB", kind="class", range=(1, 15), file=file_b),
    ]
    symbols_c = [
        Symbol(name="helper_c", kind="function", range=(1, 10), file=file_c),
    ]

    gsi.update_file_symbols(file_a, symbols_a, index_path=index_path)
    gsi.update_file_symbols(file_b, symbols_b, index_path=index_path)
    gsi.update_file_symbols(file_c, symbols_c, index_path=index_path)

    # Relationships:
    # ClassA --imports--> ClassB (cross-directory)
    # ClassA --calls--> helper_c (cross-directory)
    # ClassB --inherits--> ClassA (cross-directory)
    relationships_a = [
        CodeRelationship(
            source_symbol="ClassA",
            target_symbol="ClassB",
            relationship_type=RelationshipType.IMPORTS,
            source_file=file_a,
            target_file=file_b,
            source_line=2,
        ),
        CodeRelationship(
            source_symbol="ClassA",
            target_symbol="helper_c",
            relationship_type=RelationshipType.CALL,
            source_file=file_a,
            target_file=file_c,
            source_line=10,
        ),
    ]
    relationships_b = [
        CodeRelationship(
            source_symbol="ClassB",
            target_symbol="ClassA",
            relationship_type=RelationshipType.INHERITS,
            source_file=file_b,
            target_file=file_a,
            source_line=1,
        ),
    ]

    gsi.update_file_relationships(file_a, relationships_a)
    gsi.update_file_relationships(file_b, relationships_b)

    return gsi


def test_expand_returns_related_results(temp_dir: Path) -> None:
    """expand() should return related symbols from global relationships."""
    gsi = _setup_global_index(temp_dir)
    try:
        expander = GlobalGraphExpander(gsi)

        file_a = str((temp_dir / "pkg_a" / "module_a.py").resolve())
        base_results = [
            SearchResult(
                path=file_a,
                score=1.0,
                excerpt=None,
                content=None,
                start_line=1,
                end_line=20,
                symbol_name="ClassA",
                symbol_kind="class",
            ),
        ]

        related = expander.expand(base_results, top_n=10, max_related=50)

        assert len(related) > 0
        # All results should have static_graph source metadata
        for r in related:
            assert r.metadata.get("source") == "static_graph"
        # Should find ClassB and/or helper_c as related symbols
        related_symbols = {r.symbol_name for r in related}
        assert len(related_symbols) > 0
    finally:
        gsi.close()


def test_score_decay_by_relationship_type(temp_dir: Path) -> None:
    """Score decay factors should be: IMPORTS=0.4, INHERITS=0.5, CALLS=0.3."""
    # Verify the constants
    assert DECAY_FACTORS["imports"] == 0.4
    assert DECAY_FACTORS["inherits"] == 0.5
    assert DECAY_FACTORS["calls"] == 0.3
    assert DEFAULT_DECAY == 0.3

    gsi = _setup_global_index(temp_dir)
    try:
        expander = GlobalGraphExpander(gsi)

        file_a = str((temp_dir / "pkg_a" / "module_a.py").resolve())
        base_results = [
            SearchResult(
                path=file_a,
                score=1.0,
                excerpt=None,
                content=None,
                start_line=1,
                end_line=20,
                symbol_name="ClassA",
                symbol_kind="class",
            ),
        ]

        related = expander.expand(base_results, top_n=10, max_related=50)

        # Check that scores use decay factors
        for r in related:
            rel_type = r.metadata.get("relationship_type")
            if rel_type:
                expected_decay = DECAY_FACTORS.get(rel_type, DEFAULT_DECAY)
                # Score should be base_score * decay (possibly * 0.8 for unresolved)
                assert r.score <= 1.0 * expected_decay + 0.01
                assert r.score > 0.0
    finally:
        gsi.close()


def test_expand_with_no_relationships_returns_empty(temp_dir: Path) -> None:
    """expand() should return empty list when no relationships exist."""
    db_path = temp_dir / "empty_global.db"
    gsi = GlobalSymbolIndex(db_path, project_id=1)
    gsi.initialize()

    try:
        # Add a symbol but no relationships
        file_x = str((temp_dir / "isolated.py").resolve())
        index_path = str((temp_dir / "idx.db").resolve())
        gsi.update_file_symbols(
            file_x,
            [Symbol(name="IsolatedFunc", kind="function", range=(1, 5), file=file_x)],
            index_path=index_path,
        )

        expander = GlobalGraphExpander(gsi)
        base_results = [
            SearchResult(
                path=file_x,
                score=0.9,
                excerpt=None,
                content=None,
                start_line=1,
                end_line=5,
                symbol_name="IsolatedFunc",
                symbol_kind="function",
            ),
        ]

        related = expander.expand(base_results, top_n=10, max_related=50)
        assert related == []
    finally:
        gsi.close()


def test_expand_deduplicates_against_input(temp_dir: Path) -> None:
    """expand() should not include results already present in input."""
    gsi = _setup_global_index(temp_dir)
    try:
        expander = GlobalGraphExpander(gsi)

        file_a = str((temp_dir / "pkg_a" / "module_a.py").resolve())
        file_b = str((temp_dir / "pkg_b" / "module_b.py").resolve())

        # Include both ClassA and ClassB in input - ClassB should be deduplicated
        base_results = [
            SearchResult(
                path=file_a,
                score=1.0,
                excerpt=None,
                content=None,
                start_line=1,
                end_line=20,
                symbol_name="ClassA",
                symbol_kind="class",
            ),
            SearchResult(
                path=file_b,
                score=0.8,
                excerpt=None,
                content=None,
                start_line=1,
                end_line=15,
                symbol_name="ClassB",
                symbol_kind="class",
            ),
        ]

        related = expander.expand(base_results, top_n=10, max_related=50)

        # No related result should match (path, symbol_name, start_line)
        # of any input result
        input_keys = {(r.path, r.symbol_name, r.start_line) for r in base_results}
        for r in related:
            assert (r.path, r.symbol_name, r.start_line) not in input_keys
    finally:
        gsi.close()


def test_resolve_target_with_double_colon_format(temp_dir: Path) -> None:
    """_resolve_target_to_file should handle 'file_path::symbol_name' format."""
    gsi = _setup_global_index(temp_dir)
    try:
        expander = GlobalGraphExpander(gsi)

        file_b = str((temp_dir / "pkg_b" / "module_b.py").resolve())
        target_qname = f"{file_b}::ClassB"

        result = expander._resolve_target_to_file(target_qname)
        assert result is not None
        resolved_file, start_line, end_line = result
        assert resolved_file == file_b
        # ClassB is at range (1, 15)
        assert start_line == 1
        assert end_line == 15
    finally:
        gsi.close()


def test_resolve_target_with_dot_notation(temp_dir: Path) -> None:
    """_resolve_target_to_file should handle 'module.ClassName' dot notation."""
    gsi = _setup_global_index(temp_dir)
    try:
        expander = GlobalGraphExpander(gsi)

        # "pkg.ClassB" - leaf name "ClassB" should be found via search
        result = expander._resolve_target_to_file("pkg.ClassB")
        assert result is not None
        resolved_file, start_line, end_line = result
        # Should resolve to ClassB's file
        file_b = str((temp_dir / "pkg_b" / "module_b.py").resolve())
        assert resolved_file == file_b
        assert start_line == 1
        assert end_line == 15
    finally:
        gsi.close()


def test_expand_empty_results_returns_empty(temp_dir: Path) -> None:
    """expand() with empty input should return empty list."""
    db_path = temp_dir / "empty.db"
    gsi = GlobalSymbolIndex(db_path, project_id=1)
    gsi.initialize()
    try:
        expander = GlobalGraphExpander(gsi)
        assert expander.expand([]) == []
    finally:
        gsi.close()


def test_expand_results_without_symbol_names_returns_empty(temp_dir: Path) -> None:
    """expand() should skip results without symbol_name."""
    db_path = temp_dir / "nosym.db"
    gsi = GlobalSymbolIndex(db_path, project_id=1)
    gsi.initialize()
    try:
        expander = GlobalGraphExpander(gsi)
        base_results = [
            SearchResult(
                path="/some/file.py",
                score=1.0,
                excerpt="some text",
                content=None,
                start_line=1,
                end_line=5,
                symbol_name=None,
                symbol_kind=None,
            ),
        ]
        assert expander.expand(base_results) == []
    finally:
        gsi.close()
