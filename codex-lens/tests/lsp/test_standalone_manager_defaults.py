"""Tests for StandaloneLspManager default config behavior."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import pytest

from codexlens.lsp.standalone_manager import StandaloneLspManager


def test_loads_builtin_defaults_when_no_config_found(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    manager = StandaloneLspManager(workspace_root=str(tmp_path))

    with caplog.at_level(logging.INFO):
        asyncio.run(manager.start())

    assert manager._configs  # type: ignore[attr-defined]
    assert manager.get_language_id(str(tmp_path / "example.py")) == "python"

    expected_root = str(tmp_path / "lsp-servers.json")
    expected_codexlens = str(tmp_path / ".codexlens" / "lsp-servers.json")

    assert "using built-in defaults" in caplog.text.lower()
    assert expected_root in caplog.text
    assert expected_codexlens in caplog.text

