"""Packaging metadata tests for codex-lens (LSP/semantic extras)."""

from __future__ import annotations

from pathlib import Path


def _read_pyproject() -> str:
    repo_root = Path(__file__).resolve().parents[2]
    return (repo_root / "pyproject.toml").read_text(encoding="utf-8")


def test_lsp_script_entrypoint_points_to_server_main() -> None:
    pyproject = _read_pyproject()
    assert 'codexlens-lsp = "codexlens.lsp.server:main"' in pyproject


def test_semantic_extras_do_not_pin_yanked_fastembed_020() -> None:
    pyproject = _read_pyproject()
    assert "fastembed~=0.2.0" not in pyproject
    assert "fastembed~=0.2.1" in pyproject


def test_click_dependency_is_explicitly_guarded() -> None:
    pyproject = _read_pyproject()
    assert "click>=8.0.0,<9" in pyproject

