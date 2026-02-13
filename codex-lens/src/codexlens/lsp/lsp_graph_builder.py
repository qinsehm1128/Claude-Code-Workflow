"""Graph builder for code association graphs via LSP."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional, Set, Tuple

from codexlens.hybrid_search.data_structures import (
    CallHierarchyItem,
    CodeAssociationGraph,
    CodeSymbolNode,
    Range,
)
from codexlens.lsp.lsp_bridge import (
    Location,
    LspBridge,
)

logger = logging.getLogger(__name__)


class LspGraphBuilder:
    """Builds code association graph by expanding from seed symbols using LSP."""

    def __init__(
        self,
        max_depth: int = 2,
        max_nodes: int = 100,
        max_concurrent: int = 10,
        resolve_symbols: bool = True,
    ):
        """Initialize GraphBuilder.

        Args:
            max_depth: Maximum depth for BFS expansion from seeds.
            max_nodes: Maximum number of nodes in the graph.
            max_concurrent: Maximum concurrent LSP requests.
            resolve_symbols: If False, skip documentSymbol lookups and create lightweight nodes.
        """
        self.max_depth = max_depth
        self.max_nodes = max_nodes
        self.max_concurrent = max_concurrent
        self.resolve_symbols = resolve_symbols
        # Cache for document symbols per file (avoids per-location hover queries)
        self._document_symbols_cache: Dict[str, List[Dict[str, Any]]] = {}

    async def build_from_seeds(
        self,
        seeds: List[CodeSymbolNode],
        lsp_bridge: LspBridge,
    ) -> CodeAssociationGraph:
        """Build association graph by BFS expansion from seeds.

        For each seed:
        1. Get references via LSP
        2. Get call hierarchy via LSP
        3. Add nodes and edges to graph
        4. Continue expanding until max_depth or max_nodes reached

        Args:
            seeds: Initial seed symbols to expand from.
            lsp_bridge: LSP bridge for querying language servers.

        Returns:
            CodeAssociationGraph with expanded nodes and relationships.
        """
        graph = CodeAssociationGraph()
        visited: Set[str] = set()
        semaphore = asyncio.Semaphore(self.max_concurrent)

        # Initialize queue with seeds at depth 0
        queue: List[Tuple[CodeSymbolNode, int]] = [(s, 0) for s in seeds]

        # Add seed nodes to graph
        for seed in seeds:
            graph.add_node(seed)

        # BFS expansion
        while queue and len(graph.nodes) < self.max_nodes:
            # Take a batch of nodes from queue
            batch_size = min(self.max_concurrent, len(queue))
            batch = queue[:batch_size]
            queue = queue[batch_size:]

            # Expand nodes in parallel
            tasks = [
                self._expand_node(
                    node, depth, graph, lsp_bridge, visited, semaphore
                )
                for node, depth in batch
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results and add new nodes to queue
            for result in results:
                if isinstance(result, Exception):
                    logger.warning("Error expanding node: %s", result)
                    continue
                if result:
                    # Add new nodes to queue if not at max depth
                    for new_node, new_depth in result:
                        if (
                            new_depth <= self.max_depth
                            and len(graph.nodes) < self.max_nodes
                        ):
                            queue.append((new_node, new_depth))

        return graph

    async def _expand_node(
        self,
        node: CodeSymbolNode,
        depth: int,
        graph: CodeAssociationGraph,
        lsp_bridge: LspBridge,
        visited: Set[str],
        semaphore: asyncio.Semaphore,
    ) -> List[Tuple[CodeSymbolNode, int]]:
        """Expand a single node, return new nodes to process.

        Args:
            node: Node to expand.
            depth: Current depth in BFS.
            graph: Graph to add nodes and edges to.
            lsp_bridge: LSP bridge for queries.
            visited: Set of visited node IDs.
            semaphore: Semaphore for concurrency control.

        Returns:
            List of (new_node, new_depth) tuples to add to queue.
        """
        # Skip if already visited or at max depth
        if node.id in visited:
            return []
        # Depth is 0 for seeds. To limit expansion to N hops from seeds,
        # we expand nodes with depth < max_depth.
        if depth >= self.max_depth:
            visited.add(node.id)
            return []
        if len(graph.nodes) >= self.max_nodes:
            return []

        visited.add(node.id)
        new_nodes: List[Tuple[CodeSymbolNode, int]] = []

        async with semaphore:
            # Get relationships in parallel
            try:
                refs_task = lsp_bridge.get_references(node)
                calls_task = lsp_bridge.get_call_hierarchy(node)

                refs, calls = await asyncio.gather(
                    refs_task, calls_task, return_exceptions=True
                )

                # Handle reference results
                if isinstance(refs, Exception):
                    logger.debug(
                        "Failed to get references for %s: %s", node.id, refs
                    )
                    refs = []

                # Handle call hierarchy results
                if isinstance(calls, Exception):
                    logger.debug(
                        "Failed to get call hierarchy for %s: %s",
                        node.id,
                        calls,
                    )
                    calls = []

                # Process references
                for ref in refs:
                    if len(graph.nodes) >= self.max_nodes:
                        break

                    ref_node = await self._location_to_node(ref, lsp_bridge)
                    if ref_node and ref_node.id != node.id:
                        if ref_node.id not in graph.nodes:
                            graph.add_node(ref_node)
                            new_nodes.append((ref_node, depth + 1))
                        # Use add_edge since both nodes should exist now
                        graph.add_edge(node.id, ref_node.id, "references")

                # Process call hierarchy (incoming calls)
                for call in calls:
                    if len(graph.nodes) >= self.max_nodes:
                        break

                    call_node = await self._call_hierarchy_to_node(
                        call, lsp_bridge
                    )
                    if call_node and call_node.id != node.id:
                        if call_node.id not in graph.nodes:
                            graph.add_node(call_node)
                            new_nodes.append((call_node, depth + 1))
                        # Incoming call: call_node calls node
                        graph.add_edge(call_node.id, node.id, "calls")

            except Exception as e:
                logger.warning(
                    "Error during node expansion for %s: %s", node.id, e
                )

        return new_nodes

    def clear_cache(self) -> None:
        """Clear the document symbols cache.

        Call this between searches to free memory and ensure fresh data.
        """
        self._document_symbols_cache.clear()

    async def _get_symbol_at_location(
        self,
        file_path: str,
        line: int,
        lsp_bridge: LspBridge,
    ) -> Optional[Dict[str, Any]]:
        """Find symbol at location using cached document symbols.

        This is much more efficient than individual hover queries because
        document symbols are fetched once per file and cached.

        Args:
            file_path: Path to the source file.
            line: Line number (1-based).
            lsp_bridge: LSP bridge for fetching document symbols.

        Returns:
            Symbol dictionary with name, kind, range, etc., or None if not found.
        """
        # Get or fetch document symbols for this file
        if file_path not in self._document_symbols_cache:
            symbols = await lsp_bridge.get_document_symbols(file_path)
            self._document_symbols_cache[file_path] = symbols

        symbols = self._document_symbols_cache[file_path]

        # Find symbol containing this line (best match = smallest range)
        best_match: Optional[Dict[str, Any]] = None
        best_range_size = float("inf")

        for symbol in symbols:
            sym_range = symbol.get("range", {})
            start = sym_range.get("start", {})
            end = sym_range.get("end", {})

            # LSP ranges are 0-based, our line is 1-based
            start_line = start.get("line", 0) + 1
            end_line = end.get("line", 0) + 1

            if start_line <= line <= end_line:
                range_size = end_line - start_line
                if range_size < best_range_size:
                    best_match = symbol
                    best_range_size = range_size

        return best_match

    async def _location_to_node(
        self,
        location: Location,
        lsp_bridge: LspBridge,
    ) -> Optional[CodeSymbolNode]:
        """Convert LSP location to CodeSymbolNode.

        Uses cached document symbols instead of individual hover queries
        for better performance.

        Args:
            location: LSP location to convert.
            lsp_bridge: LSP bridge for additional queries.

        Returns:
            CodeSymbolNode or None if conversion fails.
        """
        try:
            file_path = location.file_path
            start_line = location.line

            # Try to find symbol info from cached document symbols (fast)
            symbol_info = None
            if self.resolve_symbols:
                symbol_info = await self._get_symbol_at_location(
                    file_path, start_line, lsp_bridge
                )

            if symbol_info:
                name = symbol_info.get("name", f"symbol_L{start_line}")
                kind = symbol_info.get("kind", "unknown")

                # Extract range from symbol if available
                sym_range = symbol_info.get("range", {})
                start = sym_range.get("start", {})
                end = sym_range.get("end", {})

                location_range = Range(
                    start_line=start.get("line", start_line - 1) + 1,
                    start_character=start.get("character", location.character - 1) + 1,
                    end_line=end.get("line", start_line - 1) + 1,
                    end_character=end.get("character", location.character - 1) + 1,
                )
            else:
                # Fallback to basic node without symbol info
                name = f"symbol_L{start_line}"
                kind = "unknown"
                location_range = Range(
                    start_line=location.line,
                    start_character=location.character,
                    end_line=location.line,
                    end_character=location.character,
                )

            node_id = self._create_node_id(file_path, name, start_line)

            return CodeSymbolNode(
                id=node_id,
                name=name,
                kind=kind,
                file_path=file_path,
                range=location_range,
                docstring="",  # Skip hover for performance
            )

        except Exception as e:
            logger.debug("Failed to convert location to node: %s", e)
            return None

    async def _call_hierarchy_to_node(
        self,
        call_item: CallHierarchyItem,
        lsp_bridge: LspBridge,
    ) -> Optional[CodeSymbolNode]:
        """Convert CallHierarchyItem to CodeSymbolNode.

        Args:
            call_item: Call hierarchy item to convert.
            lsp_bridge: LSP bridge (unused, kept for API consistency).

        Returns:
            CodeSymbolNode or None if conversion fails.
        """
        try:
            file_path = call_item.file_path
            name = call_item.name
            start_line = call_item.range.start_line
            # CallHierarchyItem.kind is already a string
            kind = call_item.kind

            node_id = self._create_node_id(file_path, name, start_line)

            return CodeSymbolNode(
                id=node_id,
                name=name,
                kind=kind,
                file_path=file_path,
                range=call_item.range,
                docstring=call_item.detail or "",
            )

        except Exception as e:
            logger.debug(
                "Failed to convert call hierarchy item to node: %s", e
            )
            return None

    def _create_node_id(
        self, file_path: str, name: str, line: int
    ) -> str:
        """Create unique node ID.

        Args:
            file_path: Path to the file.
            name: Symbol name.
            line: Line number (0-based).

        Returns:
            Unique node ID string.
        """
        return f"{file_path}:{name}:{line}"
