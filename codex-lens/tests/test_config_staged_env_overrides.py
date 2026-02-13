"""Unit tests for Config .env overrides for staged/cascade settings."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from codexlens.config import Config


@pytest.fixture
def temp_config_dir() -> Path:
    """Create temporary directory for config data_dir."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    yield Path(tmpdir.name)
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def test_staged_env_overrides_apply(temp_config_dir: Path) -> None:
    config = Config(data_dir=temp_config_dir)

    env_path = temp_config_dir / ".env"
    env_path.write_text(
        "\n".join(
            [
                "ENABLE_CASCADE_SEARCH=true",
                "CASCADE_STRATEGY=staged",
                "CASCADE_COARSE_K=111",
                "CASCADE_FINE_K=7",
                "STAGED_STAGE2_MODE=realtime",
                "STAGED_CLUSTERING_STRATEGY=path",
                "STAGED_CLUSTERING_MIN_SIZE=5",
                "ENABLE_STAGED_RERANK=false",
                "STAGED_REALTIME_LSP_TIMEOUT_S=12.5",
                "STAGED_REALTIME_LSP_DEPTH=2",
                "STAGED_REALTIME_LSP_MAX_NODES=123",
                "STAGED_REALTIME_LSP_MAX_SEEDS=3",
                "STAGED_REALTIME_LSP_MAX_CONCURRENT=4",
                "STAGED_REALTIME_LSP_WARMUP_S=0.25",
                "STAGED_REALTIME_LSP_RESOLVE_SYMBOLS=yes",
                "",
            ]
        ),
        encoding="utf-8",
    )

    config.load_settings()

    assert config.enable_cascade_search is True
    assert config.cascade_strategy == "staged"
    assert config.cascade_coarse_k == 111
    assert config.cascade_fine_k == 7

    assert config.staged_stage2_mode == "realtime"
    assert config.staged_clustering_strategy == "path"
    assert config.staged_clustering_min_size == 5
    assert config.enable_staged_rerank is False
    assert config.staged_realtime_lsp_timeout_s == 12.5
    assert config.staged_realtime_lsp_depth == 2
    assert config.staged_realtime_lsp_max_nodes == 123
    assert config.staged_realtime_lsp_max_seeds == 3
    assert config.staged_realtime_lsp_max_concurrent == 4
    assert config.staged_realtime_lsp_warmup_s == 0.25
    assert config.staged_realtime_lsp_resolve_symbols is True


def test_staged_env_overrides_prefixed_wins(temp_config_dir: Path) -> None:
    config = Config(data_dir=temp_config_dir)

    env_path = temp_config_dir / ".env"
    env_path.write_text(
        "\n".join(
            [
                "STAGED_CLUSTERING_STRATEGY=score",
                "CODEXLENS_STAGED_CLUSTERING_STRATEGY=path",
                "STAGED_STAGE2_MODE=precomputed",
                "CODEXLENS_STAGED_STAGE2_MODE=realtime",
                "",
            ]
        ),
        encoding="utf-8",
    )

    config.load_settings()

    assert config.staged_clustering_strategy == "path"
    assert config.staged_stage2_mode == "realtime"


def test_staged_env_overrides_invalid_ignored(temp_config_dir: Path) -> None:
    config = Config(data_dir=temp_config_dir)

    env_path = temp_config_dir / ".env"
    env_path.write_text(
        "\n".join(
            [
                "STAGED_STAGE2_MODE=bogus",
                "STAGED_CLUSTERING_STRATEGY=embedding_remote",
                "STAGED_REALTIME_LSP_TIMEOUT_S=nope",
                "CASCADE_STRATEGY=???",
                "",
            ]
        ),
        encoding="utf-8",
    )

    config.load_settings()

    assert config.cascade_strategy == "binary"
    assert config.staged_stage2_mode == "precomputed"
    assert config.staged_clustering_strategy == "auto"
    assert config.staged_realtime_lsp_timeout_s == 30.0
