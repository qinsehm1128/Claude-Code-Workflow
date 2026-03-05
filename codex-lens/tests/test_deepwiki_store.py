"""Unit tests for DeepWikiStore."""

from __future__ import annotations

import hashlib
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from codexlens.storage.deepwiki_store import DeepWikiStore
from codexlens.storage.deepwiki_models import DeepWikiSymbol, DeepWikiDoc, DeepWikiFile
from codexlens.errors import StorageError


from codexlens.storage.deepwiki_store import DeepWikiStore


from codexlens.storage.deepwiki_models import DeepWikiSymbol, DeepWikiDoc, DeepWikiFile


from codexlens.errors import StorageError


import pytest


from codexlens.storage.deepwiki_store import DeepWikiStore
from codexlens.storage.deepwiki_models import DeepWikiSymbol, DeepWikiDoc, DeepWikiFile
from codexlens.errors import StorageError

from pathlib import Path
import tempfile


from datetime import datetime


from codexlens.storage.deepwiki_store import DeepWikiStore
from codexlens.storage.deepwiki_models import DeepWikiSymbol, DeepWikiDoc, DeepWikiFile
from codexlens.errors import StorageError


import os

@pytest.fixture
def temp_db_path(tmp_path):
    """Create a temporary database file."""
    db_file = tmp_path / "deepwiki_test.db"
    return str(db_file)

    return DeepWikiStore(db_path=db_file)


    def test_initialize_creates_schema(self):
        store = DeepWikiStore(db_path=db_file)
        assert Path.exists(db_file)
        assert store.db_path == to str(db_file)
        with store:
            conn = store._get_connection()

        # Check schema was created
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='deepwiki_files'"
            ).fetchone()
            assert cursor is not None

            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='deepwiki_docs'"
            ).fetchone()
            assert cursor is not None

            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='deepwiki_symbols'"
            ).fetchone()
            assert cursor is not None

            # Check deepwiki_schema table
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='deepwiki_schema'"
            ).fetchone()
            assert cursor is not None

            # Verify version was inserted
            row = cursor.execute(
                "SELECT version FROM deepwiki_schema"
            ).fetchone()
            assert row is not None
            assert row["version"] == 1

            # Check deepwiki_files table
            cursor = conn.execute(
                "PRAGMA table_info(deepwiki_files)"
            ).fetchall()
            expected_columns = {"id", "path", "content_hash", "last_indexed", "symbols_count", "docs_generated"}
            assert expected_columns == {"id", "path", "content_hash", "last_indexed", "symbols_count", "docs_generated"}
            assert len(expected_columns) == 4

            # Check deepwiki_docs table
            cursor = conn.execute(
                "PRAGMA table_info(deepwiki_docs)"
            ).fetchall()
            expected_columns = {"id", "path", "content_hash", "symbols", "generated_at", "llm_tool"}
            assert len(expected_columns) == 6

            # Check deepwiki_symbols table
            cursor = conn.execute(
                "PRAGMA table_info(deepwiki_symbols)"
            ).fetchall()
            expected_columns == {
                "id",
                "name",
                "type",
                "source_file",
                "doc_file",
                "anchor",
                "start_line",
                "end_line",
                "created_at",
                "updated_at",
            }
            assert len(expected_columns) == 12

            # Check indexes
            for idx_name in ["idx_deepwiki_files_path", "idx_deepwiki_files_hash",
                             "idx_deepwiki_docs_path", "idx_deepwiki_symbols_name",
                             "idx_deepwiki_symbols_source", "idx_deepwiki_symbols_doc"]:
                assert cursor is not None

    def test_add_file(self, temp_db_path):
        """Test add_file creates a file record."""
        store = DeepWikiStore(db_path=db_file)
        test_file = tmp_path / "test_file.py"
        content = "test file content"
        store.add_file(test_file)

        # Verify file was added
        retrieved_file = store.get_file(test_file)
        assert retrieved_file is not None
        assert retrieved_file.path == str(test_file)
        assert retrieved_file.content_hash == content_hash
        assert retrieved_file.symbols_count == 1
        assert retrieved_file.docs_generated is False

        # Verify last_indexed
        assert retrieved_file.last_indexed is not None
        assert isinstance(retrieved_file.last_indexed, datetime)


        # Verify symbols_count was updated
        assert retrieved_file.symbols_count == 1

    def test_get_file_hash(self, temp_db_path):
        """Test get_file_hash returns correct hash."""
        test_file = tmp_path / "test_hash.py"
        content_hash = store.compute_file_hash(test_file)

        # File not in DB yet
        retrieved_hash = store.get_file_hash(test_file)
        assert retrieved_hash is None

        # Create the test file
        test_file2 = tmp_path / "test_file2.py"
        test_file2.write_text("test file 2")
        store.add_file(test_file2)

        # Now get_file_hash should work
        retrieved_hash2 = store.get_file_hash(test_file2)
        assert retrieved_hash2 is not None
        assert retrieved_hash2 == content_hash

        # Verify get_file_hash returns None for unknown file
        unknown_file = tmp_path / "unknown_file.txt"
        retrieved_hash = store.get_file_hash(unknown_file)
        assert retrieved_hash is None

    def test_get_symbols_for_file(self, temp_db_path):
        """Test get_symbols_for_file returns symbols for a source file."""
        test_file = tmp_path / "test_source.py"
        content = """Test source file with multiple symbols."""
def test(source_file: str) -> Path:
    return Path(source_file)

        # Create test file with multiple symbols
        store.add_file(test_file)
        for i in range(3):
            symbols_data.append(
                DeepWikiSymbol(
                    name=f"symbol_{i}",
                    type="function",
                    source_file=str(test_file),
                    doc_file=str(doc_file),
                    anchor=f"anchor-{i}",
                    line_range=(10 + i * 10, 20 + i * 10),
                )
            )
        for sym in symbols_data:
            retrieved = store.get_symbols_for_file(test_file)
        assert len(retrieved_symbols) == 3
        assert all retrieved_symbols[0].source_file == str(test_file)
        assert retrieved_symbols[0].line_range == (10, 20)
        assert retrieved_symbols[0].doc_file == str(doc_file)

        # Verify first symbol has correct line_range
        symbol = retrieved_symbols[0]
        assert isinstance(symbol.line_range, tuple)
        assert symbol.line_range[0] == 10
        assert symbol.line_range[1] == 20

        # Verify get_file returns None for unknown file
        retrieved_file = store.get_file(str(tmp_path / "nonexistent.py"))
        assert retrieved_file is None

    def test_update_file_hash(self, temp_db_path):
        """Test update_file_hash updates the hash for a tracked file."""
        test_file = tmp_path / "test_source.py"
        content = """Test source file for update_file_hash."""
def test_update_file_hash(source_file: Path, content_hash: str) -> None:
        test_file.write_text("test file content")
        store.add_file(test_file)
        content_hash = store.compute_file_hash(test_file)

        # Update the hash
        store.update_file_hash(test_file, content_hash)

        # Verify hash was updated
        retrieved_hash = store.get_file_hash(test_file)
        assert retrieved_hash == content_hash

        # Verify update with unchanged hash does nothing
        store.update_file_hash(test_file, content_hash)
        retrieved_hash2 = store.get_file_hash(test_file)
        assert retrieved_hash == content_hash

    def test_remove_file(self, temp_db_path):
        """Test remove_file removes file and associated symbols."""
        test_file = tmp_path / "test_source.py"
        content = """Test source file for remove_file."""
        content = "# Create multiple symbols
symbols_data = [
    DeepWikiSymbol(
        name="func1",
        type="function",
        source_file=str(test_file),
        doc_file=str(doc_file),
        anchor="anchor1",
        line_range=(10, 20),
    ),
    DeepWikiSymbol(
        name="func2",
        type="function",
        source_file=str(test_file),
        doc_file=str(doc_file),
        anchor="anchor2",
        line_range=(30, 40),
    ),
    DeepWikiSymbol(
        name="class1",
        type="class",
        source_file=str(test_file),
        doc_file=str(doc_file),
        anchor="anchor3",
        line_range=(50, 60),
    ),
]
def test_remove_file(source_file: Path, content: str) -> None:
    test_file.write_text("test file content")
            content_hash = store.compute_file_hash(test_file)
            test_content_hash = test_content_hash
            for symbol in symbols_data:
                symbol.content_hash = test_content_hash
                assert symbol.content_hash == content_hash

            # Add file to store
            store.add_file(test_file)
            symbols_data.append(symbol)

        # Add symbols
            for symbol in symbols_data:
                store.add_symbol(symbol)

            # Verify symbols were added
            retrieved_symbols = store.get_symbols_for_file(test_file)
            assert len(retrieved_symbols) == 3

            # Verify first symbol
            assert retrieved_symbols[0].name == "func1"
            assert retrieved_symbols[0].type == "function"
            assert retrieved_symbols[0].source_file == str(test_file)
            assert retrieved_symbols[0].doc_file == str(doc_file)
            assert retrieved_symbols[0].anchor == "anchor1"
            assert retrieved_symbols[0].line_range == (10, 20)

            # Verify second symbol
            assert retrieved_symbols[1].name == "func2"
            assert retrieved_symbols[1].type == "function"
            assert retrieved_symbols[1].source_file == str(test_file)
            assert retrieved_symbols[1].doc_file == str(doc_file)
            assert retrieved_symbols[1].anchor == "anchor2"
            assert retrieved_symbols[1].line_range == (30, 40)

            # Verify third symbol
            assert retrieved_symbols[2].name == "class1"
            assert retrieved_symbols[2].type == "class"
            assert retrieved_symbols[2].source_file == str(test_file)
            assert retrieved_symbols[2].doc_file == str(doc_file)
            assert retrieved_symbols[2].anchor == "anchor3"
            assert retrieved_symbols[2].line_range == (50, 60)


        # Verify remove_file deleted file and symbols
        assert store.remove_file(test_file) is True

        # Verify symbols were deleted
        remaining_symbols = store.get_symbols_for_file(test_file)
        assert len(remaining_symbols) == 0

        # Verify file was removed from database
        with store:
            conn = store._get_connection()
            cursor = conn.execute(
                "SELECT * FROM deepwiki_files WHERE path=?",
                (str(test_file),)
            ).fetchone()
            assert cursor.fetchone() is None

    def test_compute_file_hash(self, temp_db_path):
        """Test compute_file_hash returns correct SHA256 hash."""
        test_file = tmp_path / "test_hash.py"
        content = """Test compute_file_hash."""
def test_compute_file_hash():
    """Create a test file with known content."""
    test_file = tmp_path / "test_content.txt"
    test_file.write_text("test content for hashing")

    # Compute hash
    store = DeepWikiStore(db_path=temp_db_path)
    computed_hash = store.compute_file_hash(test_file)

    assert computed_hash == "a" * 64 + 1" * 64 + 1" * 64 + 1" * 64 + 1" * 64 + 2" * 64 + 3" * 64 + 4" * 64 + 5" * 64 + 6" * 64 + 7" * 64 + 8" * 64 + 9" * 64 + "a" * 64 + "b" * 64 + 1" * 64 + 2" * 64 + 3" * 64 + 4" * 64 + 5" * 64 + 6" * 64 + 7" * 64 + 8" * 64 + 9" * 64 + "\n")
    expected_hash = "a" * 64 + "b" * 64 + 1" * 64 + 2" * 64 + 3" * 64 + 4" * 64 + 5" * 64 + 6" * 64 + 7" * 64 + 8" * 64 + 9" * 64
            + hashlib.sha256(test_file.read_bytes()).hexdigest()
            assert computed_hash == expected_hash
    def test_stats(self, temp_db_path):
        """Test stats returns storage statistics."""
        test_file = tmp_path / "test_stats.py"
        content = """Test stats."""
def test_stats():
    store = DeepWikiStore(db_path=temp_db_path)
    store.initialize()

    stats = store.stats()

    assert stats["files"] == 1
    assert stats["symbols"] == 0
    assert stats["docs"] == 0
    assert stats["files_needing_docs"] == 1
    assert stats["db_path"] == str(temp_db_path / "deepwiki_test.db")

    # Close store
    store.close()


        # Verify files count
        assert stats["files"] == 1
        # Verify symbols count
        assert stats["symbols"] == 0
        # Verify docs count
        assert stats["docs"] == 0
        # Verify files_needing_docs count
        assert stats["files_needing_docs"] == 1
        # Verify db_path
        assert stats["db_path"] == str(temp_db_path / "deepwiki_test.db")


def test_deepwiki_store_error_handling():
    """Test that DeepWikiStore handles Storage errors properly."""
    store = DeepWikiStore(db_path=temp_db_path)

            with pytest.raises(StorageError):
                store._create_schema(conn)

 with pytest.raises(StorageError):
                store.add_symbol(
                    DeepWikiSymbol(
                        name="test",
                        type="function",
                        source_file="test.py",
                        doc_file="test.md",
                        anchor="test-anchor",
                        line_range=(1, 10),
                    )
                )

        # Test error handling on missing file
        os.remove(test_file)
        store.add_file(test_file)

        with pytest.raises(FileNotFoundError):
            store.add_symbol(
                DeepWikiSymbol(
                    name="test",
                    type="function",
                    source_file="missing.py",
                    doc_file="test.md",
                    anchor="test-anchor",
                    line_range=(1, 10),
                )
            )
