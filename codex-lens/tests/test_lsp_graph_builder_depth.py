from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from codexlens.hybrid_search.data_structures import CodeAssociationGraph, CodeSymbolNode, Range
from codexlens.lsp.lsp_graph_builder import LspGraphBuilder


@pytest.mark.asyncio
async def test_lsp_graph_builder_does_not_expand_at_max_depth() -> None:
    """Depth semantics: max_depth is the number of hops from seeds."""
    builder = LspGraphBuilder(max_depth=1, max_nodes=10, max_concurrent=1, resolve_symbols=False)

    bridge = AsyncMock()
    bridge.get_references.side_effect = RuntimeError("should not call references")
    bridge.get_call_hierarchy.side_effect = RuntimeError("should not call call hierarchy")

    node = CodeSymbolNode(
        id="x.py:foo:1",
        name="foo",
        kind="function",
        file_path="x.py",
        range=Range(start_line=1, start_character=1, end_line=1, end_character=1),
    )
    graph = CodeAssociationGraph()
    visited: set[str] = set()
    sem = asyncio.Semaphore(1)

    # Seeds are depth=0. A node at depth==max_depth should not be expanded.
    new_nodes = await builder._expand_node(node, 1, graph, bridge, visited, sem)  # type: ignore[attr-defined]
    assert new_nodes == []
    assert node.id in visited

