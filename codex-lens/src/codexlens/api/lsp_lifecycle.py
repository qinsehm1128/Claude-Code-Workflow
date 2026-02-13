"""LSP server lifecycle management API.

Provides synchronous wrappers around StandaloneLspManager's async
start/stop methods for use via the executeCodexLensPythonAPI bridge.
"""

from __future__ import annotations

import asyncio
import shutil
from typing import Any, Dict


def lsp_start(workspace_root: str) -> Dict[str, Any]:
    """Start the standalone LSP manager and report configured servers.

    Loads configuration and checks which language server commands are
    available on the system.  Does NOT start individual language servers
    (they start on demand when a file of that type is opened).

    Args:
        workspace_root: Absolute path to the workspace root directory.

    Returns:
        Dict with keys: servers (list of server info dicts),
        workspace_root (str).
    """
    from codexlens.lsp.standalone_manager import StandaloneLspManager

    async def _run() -> Dict[str, Any]:
        manager = StandaloneLspManager(workspace_root=workspace_root)
        await manager.start()

        servers = []
        for language_id, cfg in sorted(manager._configs.items()):
            cmd0 = cfg.command[0] if cfg.command else None
            servers.append({
                "language_id": language_id,
                "display_name": cfg.display_name,
                "extensions": list(cfg.extensions),
                "command": list(cfg.command),
                "command_available": bool(shutil.which(cmd0)) if cmd0 else False,
            })

        # Stop the manager - individual servers are started on demand
        await manager.stop()

        return {
            "servers": servers,
            "server_count": len(servers),
            "workspace_root": workspace_root,
        }

    return asyncio.run(_run())


def lsp_stop(workspace_root: str) -> Dict[str, Any]:
    """Stop all running language servers for the given workspace.

    Creates a temporary manager instance, starts it (loads config),
    then immediately stops it -- which terminates any running server
    processes that match this workspace root.

    Args:
        workspace_root: Absolute path to the workspace root directory.

    Returns:
        Dict confirming shutdown.
    """
    from codexlens.lsp.standalone_manager import StandaloneLspManager

    async def _run() -> Dict[str, Any]:
        manager = StandaloneLspManager(workspace_root=workspace_root)
        await manager.start()
        await manager.stop()
        return {"stopped": True}

    return asyncio.run(_run())


def lsp_restart(workspace_root: str) -> Dict[str, Any]:
    """Restart the standalone LSP manager (stop then start).

    Equivalent to calling lsp_stop followed by lsp_start, but avoids
    the overhead of two separate Python process invocations.

    Args:
        workspace_root: Absolute path to the workspace root directory.

    Returns:
        Dict with keys: servers, server_count, workspace_root.
    """
    from codexlens.lsp.standalone_manager import StandaloneLspManager

    async def _run() -> Dict[str, Any]:
        # Stop phase
        stop_manager = StandaloneLspManager(workspace_root=workspace_root)
        await stop_manager.start()
        await stop_manager.stop()

        # Start phase
        start_manager = StandaloneLspManager(workspace_root=workspace_root)
        await start_manager.start()

        servers = []
        for language_id, cfg in sorted(start_manager._configs.items()):
            cmd0 = cfg.command[0] if cfg.command else None
            servers.append({
                "language_id": language_id,
                "display_name": cfg.display_name,
                "extensions": list(cfg.extensions),
                "command": list(cfg.command),
                "command_available": bool(shutil.which(cmd0)) if cmd0 else False,
            })

        await start_manager.stop()

        return {
            "servers": servers,
            "server_count": len(servers),
            "workspace_root": workspace_root,
        }

    return asyncio.run(_run())
