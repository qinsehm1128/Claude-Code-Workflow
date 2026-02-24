"""Unit tests for Config cascade settings validation.

Tests cover:
- Default cascade_strategy value
- Valid cascade strategies accepted by load_settings
- Invalid cascade strategy fallback behavior
- Staged cascade config defaults
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from codexlens.config import Config


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_config_dir():
    """Create temporary directory for config data_dir."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    yield Path(tmpdir.name)
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


# =============================================================================
# Tests: cascade config defaults
# =============================================================================


class TestConfigCascadeDefaults:
    """Tests for Config cascade-related defaults and load_settings()."""

    def test_default_cascade_strategy(self, temp_config_dir):
        """Default cascade_strategy should be 'binary'."""
        config = Config(data_dir=temp_config_dir)
        assert config.cascade_strategy == "binary"

    def test_valid_cascade_strategies(self, temp_config_dir):
        """load_settings should accept all valid cascade strategies."""
        valid_strategies = ["binary", "binary_rerank", "dense_rerank", "staged"]

        for strategy in valid_strategies:
            config = Config(data_dir=temp_config_dir)
            settings = {"cascade": {"strategy": strategy}}

            settings_path = config.settings_path
            settings_path.parent.mkdir(parents=True, exist_ok=True)
            with open(settings_path, "w", encoding="utf-8") as f:
                json.dump(settings, f)

            with patch.object(config, "_apply_env_overrides"):
                config.load_settings()

            assert config.cascade_strategy == strategy, (
                f"Strategy '{strategy}' should be accepted"
            )

    def test_invalid_cascade_strategy_fallback(self, temp_config_dir):
        """Invalid cascade strategy should keep default (not crash)."""
        config = Config(data_dir=temp_config_dir)
        settings = {"cascade": {"strategy": "invalid_strategy"}}

        settings_path = config.settings_path
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f)

        with patch.object(config, "_apply_env_overrides"):
            config.load_settings()

        # Should keep the default "binary" strategy
        assert config.cascade_strategy == "binary"

    def test_hybrid_cascade_strategy_alias_maps_to_binary_rerank(self, temp_config_dir):
        """Hybrid is a backward-compat alias for binary_rerank."""
        config = Config(data_dir=temp_config_dir)
        settings = {"cascade": {"strategy": "hybrid"}}

        settings_path = config.settings_path
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f)

        with patch.object(config, "_apply_env_overrides"):
            config.load_settings()

        assert config.cascade_strategy == "binary_rerank"

    def test_staged_config_defaults(self, temp_config_dir):
        """Staged cascade settings should have correct defaults."""
        config = Config(data_dir=temp_config_dir)
        assert config.staged_coarse_k == 200
        assert config.staged_lsp_depth == 2
        assert config.staged_stage2_mode == "precomputed"
        assert config.staged_clustering_strategy == "auto"
        assert config.staged_clustering_min_size == 3
        assert config.enable_staged_rerank is True
        assert config.cascade_coarse_k == 100
        assert config.cascade_fine_k == 10

    def test_staged_settings_load_from_settings_json(self, temp_config_dir):
        """load_settings should load staged.* settings when present."""
        config = Config(data_dir=temp_config_dir)
        settings = {
            "staged": {
                "coarse_k": 250,
                "lsp_depth": 3,
                "stage2_mode": "static_global_graph",
                "realtime_lsp_timeout_s": 11.0,
                "realtime_lsp_depth": 2,
                "realtime_lsp_max_nodes": 42,
                "realtime_lsp_max_seeds": 2,
                "realtime_lsp_max_concurrent": 4,
                "realtime_lsp_warmup_s": 0.5,
                "realtime_lsp_resolve_symbols": True,
                "clustering_strategy": "path",
                "clustering_min_size": 7,
                "enable_rerank": False,
            }
        }

        settings_path = config.settings_path
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f)

        with patch.object(config, "_apply_env_overrides"):
            config.load_settings()

        assert config.staged_coarse_k == 250
        assert config.staged_lsp_depth == 3
        assert config.staged_stage2_mode == "static_global_graph"
        assert config.staged_realtime_lsp_timeout_s == 11.0
        assert config.staged_realtime_lsp_depth == 2
        assert config.staged_realtime_lsp_max_nodes == 42
        assert config.staged_realtime_lsp_max_seeds == 2
        assert config.staged_realtime_lsp_max_concurrent == 4
        assert config.staged_realtime_lsp_warmup_s == 0.5
        assert config.staged_realtime_lsp_resolve_symbols is True
        assert config.staged_clustering_strategy == "path"
        assert config.staged_clustering_min_size == 7
        assert config.enable_staged_rerank is False
