from __future__ import annotations

import asyncio
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from codexlens.lsp.standalone_manager import ServerConfig, ServerState, StandaloneLspManager


@pytest.mark.asyncio
async def test_open_document_skips_when_unchanged(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "a.py"
    target.write_text("print('hi')\n", encoding="utf-8")

    manager = StandaloneLspManager(workspace_root=str(tmp_path))
    # Make language detection deterministic.
    manager._extension_map["py"] = "python"  # type: ignore[attr-defined]

    cfg = ServerConfig(
        language_id="python",
        display_name="Pyright",
        extensions=["py"],
        command=["pyright-langserver", "--stdio"],
    )

    # ServerState requires reader/writer/process, but _open_document only uses writer via _send_notification.
    dummy_process = SimpleNamespace(returncode=None)
    dummy_reader = asyncio.StreamReader()
    dummy_writer = MagicMock()
    state = ServerState(config=cfg, process=dummy_process, reader=dummy_reader, writer=dummy_writer)

    sent: list[str] = []

    async def _send_notification(_state, method: str, _params):
        sent.append(method)

    monkeypatch.setattr(manager, "_send_notification", _send_notification)

    await manager._open_document(state, str(target))  # type: ignore[attr-defined]
    await manager._open_document(state, str(target))  # unchanged: should be skipped

    assert sent.count("textDocument/didOpen") == 1
    assert "textDocument/didChange" not in sent


@pytest.mark.asyncio
async def test_open_document_sends_did_change_on_mtime_change(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    target = tmp_path / "a.py"
    target.write_text("print('hi')\n", encoding="utf-8")

    manager = StandaloneLspManager(workspace_root=str(tmp_path))
    manager._extension_map["py"] = "python"  # type: ignore[attr-defined]

    cfg = ServerConfig(
        language_id="python",
        display_name="Pyright",
        extensions=["py"],
        command=["pyright-langserver", "--stdio"],
    )

    dummy_process = SimpleNamespace(returncode=None)
    dummy_reader = asyncio.StreamReader()
    dummy_writer = MagicMock()
    state = ServerState(config=cfg, process=dummy_process, reader=dummy_reader, writer=dummy_writer)

    sent: list[str] = []

    async def _send_notification(_state, method: str, _params):
        sent.append(method)

    monkeypatch.setattr(manager, "_send_notification", _send_notification)

    await manager._open_document(state, str(target))  # type: ignore[attr-defined]

    # Ensure filesystem mtime changes (Windows can have coarse resolution).
    time.sleep(0.02)
    target.write_text("print('changed')\n", encoding="utf-8")

    await manager._open_document(state, str(target))  # changed -> didChange

    assert sent.count("textDocument/didOpen") == 1
    assert sent.count("textDocument/didChange") == 1

