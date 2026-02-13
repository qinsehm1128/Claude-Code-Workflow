from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.chain_search import ChainSearchEngine, ChainSearchResult, SearchOptions


def _extract_stage_stats(result: ChainSearchResult) -> dict:
    for item in result.stats.errors or []:
        if isinstance(item, str) and item.startswith("STAGE_STATS:"):
            return json.loads(item[len("STAGE_STATS:") :])
    raise AssertionError("missing STAGE_STATS payload")


def test_staged_pipeline_seeds_from_fts_when_stage1_empty(monkeypatch) -> None:
    cfg = Config.load()
    cfg.enable_staged_rerank = False
    cfg.staged_stage2_mode = "realtime"  # ensure we pass through stage2 wrapper
    cfg.staged_clustering_strategy = "score"

    engine = ChainSearchEngine(registry=MagicMock(), mapper=MagicMock(), config=cfg)

    # Avoid touching registry/mapper/index stores.
    monkeypatch.setattr(engine, "_find_start_index", lambda *_a, **_k: Path("X:/fake/_index.db"))
    monkeypatch.setattr(engine, "_collect_index_paths", lambda *_a, **_k: [Path("X:/fake/_index.db")])

    # Force Stage 1 to return empty so the FTS seeding path is exercised.
    monkeypatch.setattr(engine, "_stage1_binary_search", lambda *_a, **_k: ([], Path("X:/fake")))

    seed_results = [SearchResult(path="D:/p/a.py", score=1.0), SearchResult(path="D:/p/b.py", score=0.9)]

    # Provide a stable SearchStats instance for the fallback search call.
    from codexlens.search.chain_search import SearchStats

    monkeypatch.setattr(engine, "search", lambda *_a, **_k: ChainSearchResult(query="q", results=seed_results, symbols=[], stats=SearchStats()))

    # Make later stages no-ops so we only validate plumbing.
    monkeypatch.setattr(engine, "_stage2_lsp_expand", lambda results, *_a, **_k: results)
    monkeypatch.setattr(engine, "_stage3_cluster_prune", lambda results, *_a, **_k: results)

    result = engine.staged_cascade_search("q", Path("."), k=2, coarse_k=5, options=SearchOptions())
    stage_stats = _extract_stage_stats(result)

    assert stage_stats["stage_counts"].get("stage1_fallback_used") == 1
    assert result.results and [r.path for r in result.results] == ["D:/p/a.py", "D:/p/b.py"]
