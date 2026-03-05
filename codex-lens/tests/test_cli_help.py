"""Smoke tests for CodexLens CLI help output.

These tests ensure that help text generation does not crash at import time
or during Click/Typer option parsing.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from typer.testing import CliRunner


def _subprocess_env() -> dict[str, str]:
    env = os.environ.copy()
    codex_lens_root = Path(__file__).resolve().parents[1]
    src_dir = codex_lens_root / "src"
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = str(src_dir) + (os.pathsep + existing if existing else "")
    return env


def test_python_module_help_does_not_crash() -> None:
    proc = subprocess.run(
        [sys.executable, "-m", "codexlens", "--help"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=_subprocess_env(),
    )
    assert proc.returncode == 0, proc.stderr
    assert "Traceback" not in (proc.stderr or "")


def test_typer_app_help_does_not_crash() -> None:
    from codexlens.cli.commands import app

    runner = CliRunner()
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0, result.output


def test_extract_embedding_error_uses_details() -> None:
    from codexlens.cli.commands import _extract_embedding_error

    embed_result = {
        "success": False,
        "result": {
            "details": [
                {"index_path": "/tmp/a/_index.db", "success": False, "error": "Backend timeout"},
                {"index_path": "/tmp/b/_index.db", "success": False, "error": "Rate limit"},
            ]
        },
    }
    msg = _extract_embedding_error(embed_result)
    assert "Unknown error" not in msg
    assert "Backend timeout" in msg
