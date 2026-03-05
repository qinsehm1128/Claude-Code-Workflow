import logging
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from codexlens.config import Config
from codexlens.entities import Symbol
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


@pytest.fixture()
def temp_paths():
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def test_symbol_filtering_handles_path_failures(monkeypatch: pytest.MonkeyPatch, caplog, temp_paths: Path) -> None:
    project_root = temp_paths / "project"
    (project_root / "src").mkdir(parents=True, exist_ok=True)

    index_root = temp_paths / "indexes"
    mapper = PathMapper(index_root=index_root)
    index_db_path = mapper.source_to_index_db(project_root)
    index_db_path.parent.mkdir(parents=True, exist_ok=True)
    index_db_path.write_text("", encoding="utf-8")  # existence is enough for _find_start_index

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    project_info = registry.register_project(project_root, mapper.source_to_index_dir(project_root))

    global_db_path = project_info.index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
    global_index = GlobalSymbolIndex(global_db_path, project_id=project_info.id)
    global_index.initialize()

    valid_file = project_root / "src" / "auth.py"
    valid_sym = Symbol(name="AuthManager", kind="class", range=(1, 2), file=str(valid_file))
    bad_null = Symbol(name="BadNull", kind="class", range=(1, 2), file="bad\0path.py")
    bad_relative = Symbol(name="BadRelative", kind="class", range=(1, 2), file="relative/path.py")

    candidates = [valid_sym, bad_null, bad_relative]

    if os.name == "nt":
        root_drive, _ = os.path.splitdrive(str(project_root.resolve()))
        other_drive = "C:" if root_drive.lower() != "c:" else "D:"
        candidates.append(
            Symbol(name="CrossDrive", kind="class", range=(1, 2), file=f"{other_drive}\\other\\file.py")
        )

    def fake_search(self, name: str, kind=None, limit: int = 20, prefix_mode: bool = False):
        return candidates

    monkeypatch.setattr(GlobalSymbolIndex, "search", fake_search)

    config = Config(data_dir=temp_paths / "data", global_symbol_index_enabled=True)
    engine = ChainSearchEngine(registry, mapper, config=config)
    engine._search_symbols_parallel = MagicMock(side_effect=AssertionError("should not traverse chain"))

    caplog.set_level(logging.DEBUG, logger="codexlens.search.chain_search")
    symbols = engine.search_symbols(
        "Auth",
        project_root,
        options=SearchOptions(depth=5, total_limit=10),
    )

    assert [s.name for s in symbols] == ["AuthManager"]
    assert "BadNull" in caplog.text
    assert "BadRelative" in caplog.text
    if os.name == "nt":
        assert "CrossDrive" in caplog.text


def test_cascade_search_strategy_routing(temp_paths: Path) -> None:
    """Test cascade_search() routes to correct strategy implementation."""
    from unittest.mock import patch
    from codexlens.search.chain_search import ChainSearchResult, SearchStats

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")

    engine = ChainSearchEngine(registry, mapper, config=config)
    source_path = temp_paths / "src"

    # Test strategy='staged' routing
    with patch.object(engine, "staged_cascade_search") as mock_staged:
        mock_staged.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="staged")
        mock_staged.assert_called_once()

    # Test strategy='binary' routing
    with patch.object(engine, "binary_cascade_search") as mock_binary:
        mock_binary.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="binary")
        mock_binary.assert_called_once()

    # Test strategy='binary_rerank' routing
    with patch.object(engine, "binary_rerank_cascade_search") as mock_br:
        mock_br.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="binary_rerank")
        mock_br.assert_called_once()

    # Test strategy='dense_rerank' routing
    with patch.object(engine, "dense_rerank_cascade_search") as mock_dr:
        mock_dr.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="dense_rerank")
        mock_dr.assert_called_once()

    # Test default routing (no strategy specified) - defaults to binary
    with patch.object(engine, "binary_cascade_search") as mock_default:
        mock_default.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path)
        mock_default.assert_called_once()


def test_cascade_search_invalid_strategy(temp_paths: Path) -> None:
    """Test cascade_search() defaults to 'binary' for invalid strategy."""
    from unittest.mock import patch
    from codexlens.search.chain_search import ChainSearchResult, SearchStats

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")

    engine = ChainSearchEngine(registry, mapper, config=config)
    source_path = temp_paths / "src"

    # Invalid strategy should default to binary
    with patch.object(engine, "binary_cascade_search") as mock_binary:
        mock_binary.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="invalid_strategy")
        mock_binary.assert_called_once()


def test_vector_warmup_uses_embedding_config(monkeypatch: pytest.MonkeyPatch, temp_paths: Path) -> None:
    calls: list[dict[str, object]] = []

    def fake_get_embedder(**kwargs: object) -> object:
        calls.append(dict(kwargs))
        return object()

    import codexlens.semantic.factory as factory

    monkeypatch.setattr(factory, "get_embedder", fake_get_embedder)

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(
        data_dir=temp_paths / "data",
        embedding_backend="fastembed",
        embedding_model="fast",
        embedding_use_gpu=False,
    )

    engine = ChainSearchEngine(registry, mapper, config=config)
    monkeypatch.setattr(engine, "_get_executor", lambda _workers: MagicMock())

    engine._search_parallel([], "query", SearchOptions(enable_vector=True))

    assert calls == [
        {
            "backend": "fastembed",
            "profile": "fast",
            "use_gpu": False,
        }
    ]
