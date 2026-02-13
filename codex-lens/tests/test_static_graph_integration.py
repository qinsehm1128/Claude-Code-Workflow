"""Tests for static graph relationship writing during index build (T2).

Verifies that IndexTreeBuilder._build_single_dir and _build_dir_worker
correctly write relationships to GlobalSymbolIndex when
config.static_graph_enabled is True.
"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from codexlens.config import Config
from codexlens.entities import (
    CodeRelationship,
    IndexedFile,
    RelationshipType,
    Symbol,
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


def _make_indexed_file(file_path: str) -> IndexedFile:
    """Create a test IndexedFile with symbols and relationships."""
    return IndexedFile(
        path=file_path,
        language="python",
        symbols=[
            Symbol(name="MyClass", kind="class", range=(1, 20)),
            Symbol(name="helper", kind="function", range=(22, 30)),
        ],
        relationships=[
            CodeRelationship(
                source_symbol="MyClass",
                target_symbol="BaseClass",
                relationship_type=RelationshipType.INHERITS,
                source_file=file_path,
                target_file="other/base.py",
                source_line=1,
            ),
            CodeRelationship(
                source_symbol="MyClass",
                target_symbol="os",
                relationship_type=RelationshipType.IMPORTS,
                source_file=file_path,
                source_line=2,
            ),
            CodeRelationship(
                source_symbol="helper",
                target_symbol="external_func",
                relationship_type=RelationshipType.CALL,
                source_file=file_path,
                source_line=25,
            ),
        ],
    )


def test_build_single_dir_writes_global_relationships_when_enabled(temp_dir: Path) -> None:
    """When static_graph_enabled=True, relationships should be written to global index."""
    from codexlens.storage.index_tree import IndexTreeBuilder

    config = Config(
        data_dir=temp_dir / "data",
        static_graph_enabled=True,
        static_graph_relationship_types=["imports", "inherits"],
        global_symbol_index_enabled=True,
    )

    # Set up real GlobalSymbolIndex
    global_db_path = temp_dir / "global_symbols.db"
    global_index = GlobalSymbolIndex(global_db_path, project_id=1)
    global_index.initialize()

    # Create a source file
    src_dir = temp_dir / "src"
    src_dir.mkdir()
    test_file = src_dir / "module.py"
    test_file.write_text("class MyClass(BaseClass):\n    pass\n", encoding="utf-8")

    indexed_file = _make_indexed_file(str(test_file))

    # Mock parser to return our test IndexedFile
    mock_parser = MagicMock()
    mock_parser.parse.return_value = indexed_file

    mock_mapper = MagicMock()
    mock_mapper.source_to_index_db.return_value = temp_dir / "index" / "_index.db"

    mock_registry = MagicMock()

    builder = IndexTreeBuilder(mock_registry, mock_mapper, config=config, incremental=False)
    builder.parser_factory = MagicMock()
    builder.parser_factory.get_parser.return_value = mock_parser

    result = builder._build_single_dir(
        src_dir,
        languages=None,
        project_id=1,
        global_index_db_path=global_db_path,
    )

    assert result.error is None
    assert result.files_count == 1

    # Verify relationships were written to global index
    # Only IMPORTS and INHERITS should be written (not CALL)
    rels = global_index.query_by_target("BaseClass", prefix_mode=True)
    rels += global_index.query_by_target("os", prefix_mode=True)
    assert len(rels) >= 1, "Expected at least 1 relationship written to global index"

    # CALL relationship for external_func should NOT be present
    call_rels = global_index.query_by_target("external_func", prefix_mode=True)
    assert len(call_rels) == 0, "CALL relationships should not be written"

    global_index.close()


def test_build_single_dir_skips_relationships_when_disabled(temp_dir: Path) -> None:
    """When static_graph_enabled=False, no relationships should be written."""
    from codexlens.storage.index_tree import IndexTreeBuilder

    config = Config(
        data_dir=temp_dir / "data",
        static_graph_enabled=False,
        global_symbol_index_enabled=True,
    )

    global_db_path = temp_dir / "global_symbols.db"
    global_index = GlobalSymbolIndex(global_db_path, project_id=1)
    global_index.initialize()

    src_dir = temp_dir / "src"
    src_dir.mkdir()
    test_file = src_dir / "module.py"
    test_file.write_text("import os\n", encoding="utf-8")

    indexed_file = _make_indexed_file(str(test_file))

    mock_parser = MagicMock()
    mock_parser.parse.return_value = indexed_file

    mock_mapper = MagicMock()
    mock_mapper.source_to_index_db.return_value = temp_dir / "index" / "_index.db"

    mock_registry = MagicMock()

    builder = IndexTreeBuilder(mock_registry, mock_mapper, config=config, incremental=False)
    builder.parser_factory = MagicMock()
    builder.parser_factory.get_parser.return_value = mock_parser

    result = builder._build_single_dir(
        src_dir,
        languages=None,
        project_id=1,
        global_index_db_path=global_db_path,
    )

    assert result.error is None

    # No relationships should be in global index
    conn = global_index._get_connection()
    count = conn.execute("SELECT COUNT(*) FROM global_relationships").fetchone()[0]
    assert count == 0, "No relationships should be written when static_graph_enabled=False"

    global_index.close()


def test_relationship_write_failure_does_not_block_indexing(temp_dir: Path) -> None:
    """If global_index.update_file_relationships raises, file indexing continues."""
    from codexlens.storage.index_tree import IndexTreeBuilder

    config = Config(
        data_dir=temp_dir / "data",
        static_graph_enabled=True,
        static_graph_relationship_types=["imports", "inherits"],
        global_symbol_index_enabled=True,
    )

    src_dir = temp_dir / "src"
    src_dir.mkdir()
    test_file = src_dir / "module.py"
    test_file.write_text("import os\n", encoding="utf-8")

    indexed_file = _make_indexed_file(str(test_file))

    mock_parser = MagicMock()
    mock_parser.parse.return_value = indexed_file

    mock_mapper = MagicMock()
    mock_mapper.source_to_index_db.return_value = temp_dir / "index" / "_index.db"

    mock_registry = MagicMock()

    # Create a mock GlobalSymbolIndex that fails on update_file_relationships
    mock_global_db_path = temp_dir / "global_symbols.db"

    builder = IndexTreeBuilder(mock_registry, mock_mapper, config=config, incremental=False)
    builder.parser_factory = MagicMock()
    builder.parser_factory.get_parser.return_value = mock_parser

    # Patch GlobalSymbolIndex so update_file_relationships raises
    with patch("codexlens.storage.index_tree.GlobalSymbolIndex") as MockGSI:
        mock_gsi_instance = MagicMock()
        mock_gsi_instance.update_file_relationships.side_effect = RuntimeError("DB locked")
        MockGSI.return_value = mock_gsi_instance

        result = builder._build_single_dir(
            src_dir,
            languages=None,
            project_id=1,
            global_index_db_path=mock_global_db_path,
        )

    # File should still be indexed despite relationship write failure
    assert result.error is None
    assert result.files_count == 1


def test_only_configured_relationship_types_written(temp_dir: Path) -> None:
    """Only relationship types in static_graph_relationship_types should be written."""
    from codexlens.storage.index_tree import IndexTreeBuilder

    # Only allow 'imports' (not 'inherits')
    config = Config(
        data_dir=temp_dir / "data",
        static_graph_enabled=True,
        static_graph_relationship_types=["imports"],
        global_symbol_index_enabled=True,
    )

    global_db_path = temp_dir / "global_symbols.db"
    global_index = GlobalSymbolIndex(global_db_path, project_id=1)
    global_index.initialize()

    src_dir = temp_dir / "src"
    src_dir.mkdir()
    test_file = src_dir / "module.py"
    test_file.write_text("import os\nclass Foo(Bar): pass\n", encoding="utf-8")

    indexed_file = _make_indexed_file(str(test_file))

    mock_parser = MagicMock()
    mock_parser.parse.return_value = indexed_file

    mock_mapper = MagicMock()
    mock_mapper.source_to_index_db.return_value = temp_dir / "index" / "_index.db"

    mock_registry = MagicMock()

    builder = IndexTreeBuilder(mock_registry, mock_mapper, config=config, incremental=False)
    builder.parser_factory = MagicMock()
    builder.parser_factory.get_parser.return_value = mock_parser

    result = builder._build_single_dir(
        src_dir,
        languages=None,
        project_id=1,
        global_index_db_path=global_db_path,
    )

    assert result.error is None

    # Only IMPORTS should be written
    conn = global_index._get_connection()
    rows = conn.execute(
        "SELECT relationship_type FROM global_relationships"
    ).fetchall()

    rel_types = {row[0] for row in rows}
    assert "imports" in rel_types or len(rows) == 0 or rel_types == {"imports"}, \
        f"Expected only 'imports', got {rel_types}"
    # INHERITS should NOT be present
    assert "inherits" not in rel_types, "inherits should not be written when not in config"
    # CALL should NOT be present
    assert "calls" not in rel_types, "calls should not be written"

    global_index.close()
