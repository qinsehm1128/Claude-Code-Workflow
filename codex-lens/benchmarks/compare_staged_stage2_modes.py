#!/usr/bin/env python
"""Compare staged cascade Stage-2 modes (precomputed vs realtime vs static graph).

This benchmark compares the *same* staged cascade strategy with different Stage-2
expansion sources:

1) precomputed: per-dir `graph_neighbors` expansion (fast, index-local)
2) realtime: live LSP graph expansion (contextual, requires LSP availability)
3) static_global_graph: global_relationships expansion (project-wide, requires static graph indexing)

Because most repos do not have ground-truth labels, this script reports:
- latency statistics per mode
- top-k overlap metrics (Jaccard + RBO) between modes
- diversity proxies (unique files/dirs)
- staged pipeline stage stats (when present)

Usage:
  python benchmarks/compare_staged_stage2_modes.py --source ./src
  python benchmarks/compare_staged_stage2_modes.py --queries-file benchmarks/queries.txt
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import re
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Add src to path (match other benchmark scripts)
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.config import Config
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


DEFAULT_QUERIES = [
    "class Config",
    "def search",
    "LspBridge",
    "graph expansion",
    "static graph relationships",
    "clustering strategy",
    "error handling",
]


VALID_STAGE2_MODES = ("precomputed", "realtime", "static_global_graph")


def _now_ms() -> float:
    return time.perf_counter() * 1000.0


def _normalize_path_key(path: str) -> str:
    """Normalize file paths for overlap/dedup metrics (Windows-safe)."""
    try:
        p = Path(path)
        if str(p) and (p.is_absolute() or re.match(r"^[A-Za-z]:", str(p))):
            norm = str(p.resolve())
        else:
            norm = str(p)
    except Exception:
        norm = path
    norm = norm.replace("/", "\\")
    if os.name == "nt":
        norm = norm.lower()
    return norm


def _extract_stage_stats(errors: List[str]) -> Optional[Dict[str, Any]]:
    """Extract STAGE_STATS JSON blob from SearchStats.errors."""
    for item in errors or []:
        if not isinstance(item, str):
            continue
        if not item.startswith("STAGE_STATS:"):
            continue
        payload = item[len("STAGE_STATS:") :]
        try:
            return json.loads(payload)
        except Exception:
            return None
    return None


def jaccard_topk(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def rbo(a: List[str], b: List[str], p: float = 0.9) -> float:
    """Rank-biased overlap for two ranked lists."""
    if p <= 0.0 or p >= 1.0:
        raise ValueError("p must be in (0, 1)")
    if not a and not b:
        return 1.0

    depth = max(len(a), len(b))
    seen_a: set[str] = set()
    seen_b: set[str] = set()

    score = 0.0
    for d in range(1, depth + 1):
        if d <= len(a):
            seen_a.add(a[d - 1])
        if d <= len(b):
            seen_b.add(b[d - 1])
        overlap = len(seen_a & seen_b)
        score += (overlap / d) * ((1.0 - p) * (p ** (d - 1)))
    return score


def _unique_parent_dirs(paths: Iterable[str]) -> int:
    dirs = set()
    for p in paths:
        try:
            dirs.add(str(Path(p).parent))
        except Exception:
            continue
    return len(dirs)


def _load_queries(path: Optional[Path], inline: Optional[List[str]]) -> List[str]:
    if inline:
        return [q.strip() for q in inline if isinstance(q, str) and q.strip()]
    if path:
        if not path.exists():
            raise SystemExit(f"Queries file does not exist: {path}")
        raw = path.read_text(encoding="utf-8", errors="ignore")
        queries = [line.strip() for line in raw.splitlines() if line.strip() and not line.strip().startswith("#")]
        return queries
    return list(DEFAULT_QUERIES)


@dataclass
class RunDetail:
    stage2_mode: str
    query: str
    latency_ms: float
    num_results: int
    topk_paths: List[str]
    stage_stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class PairwiseCompare:
    query: str
    mode_a: str
    mode_b: str
    jaccard_topk: float
    rbo_topk: float
    a_unique_files_topk: int
    b_unique_files_topk: int
    a_unique_dirs_topk: int
    b_unique_dirs_topk: int


def _run_once(
    engine: ChainSearchEngine,
    config: Config,
    query: str,
    source_path: Path,
    *,
    stage2_mode: str,
    k: int,
    coarse_k: int,
) -> RunDetail:
    if stage2_mode not in VALID_STAGE2_MODES:
        raise ValueError(f"Invalid stage2_mode: {stage2_mode}")

    # Mutate config for this run; ChainSearchEngine reads config fields per-call.
    config.staged_stage2_mode = stage2_mode

    gc.collect()
    start_ms = _now_ms()
    try:
        result = engine.cascade_search(
            query=query,
            source_path=source_path,
            k=k,
            coarse_k=coarse_k,
            strategy="staged",
        )
        latency_ms = _now_ms() - start_ms
        paths_raw = [r.path for r in (result.results or []) if getattr(r, "path", None)]
        paths = [_normalize_path_key(p) for p in paths_raw]

        topk: List[str] = []
        seen: set[str] = set()
        for p in paths:
            if p in seen:
                continue
            seen.add(p)
            topk.append(p)
            if len(topk) >= k:
                break

        stage_stats = None
        try:
            stage_stats = _extract_stage_stats(getattr(result.stats, "errors", []) or [])
        except Exception:
            stage_stats = None

        return RunDetail(
            stage2_mode=stage2_mode,
            query=query,
            latency_ms=latency_ms,
            num_results=len(result.results or []),
            topk_paths=topk,
            stage_stats=stage_stats,
            error=None,
        )
    except Exception as exc:
        return RunDetail(
            stage2_mode=stage2_mode,
            query=query,
            latency_ms=_now_ms() - start_ms,
            num_results=0,
            topk_paths=[],
            stage_stats=None,
            error=str(exc),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare staged Stage-2 expansion modes.")
    parser.add_argument("--source", type=Path, default=Path.cwd(), help="Project path to search")
    parser.add_argument("--queries-file", type=Path, default=None, help="Optional newline-delimited queries file")
    parser.add_argument("--queries", nargs="*", default=None, help="Inline queries (overrides queries-file)")
    parser.add_argument("--k", type=int, default=20, help="Top-k to evaluate")
    parser.add_argument("--coarse-k", type=int, default=100, help="Stage-1 coarse_k")
    parser.add_argument(
        "--stage2-modes",
        nargs="*",
        default=list(VALID_STAGE2_MODES),
        help="Stage-2 modes to compare",
    )
    parser.add_argument("--warmup", type=int, default=0, help="Warmup iterations per mode")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "results" / "staged_stage2_modes.json",
        help="Output JSON path",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Source path does not exist: {args.source}")

    stage2_modes = [str(m).strip().lower() for m in (args.stage2_modes or []) if str(m).strip()]
    for m in stage2_modes:
        if m not in VALID_STAGE2_MODES:
            raise SystemExit(f"Invalid --stage2-modes entry: {m} (valid: {', '.join(VALID_STAGE2_MODES)})")

    queries = _load_queries(args.queries_file, args.queries)
    if not queries:
        raise SystemExit("No queries to run")

    # Match CLI behavior: load settings + apply global/workspace .env overrides.
    config = Config.load()
    config.cascade_strategy = "staged"
    config.enable_staged_rerank = True
    config.embedding_use_gpu = False  # stability on some Windows setups

    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()
    engine = ChainSearchEngine(registry=registry, mapper=mapper, config=config)

    try:
        # Warmup
        if args.warmup > 0:
            warm_query = queries[0]
            for mode in stage2_modes:
                for _ in range(args.warmup):
                    try:
                        _run_once(
                            engine,
                            config,
                            warm_query,
                            args.source,
                            stage2_mode=mode,
                            k=min(args.k, 5),
                            coarse_k=min(args.coarse_k, 50),
                        )
                    except Exception:
                        pass

        per_query: Dict[str, Dict[str, RunDetail]] = {}
        runs: List[RunDetail] = []
        comparisons: List[PairwiseCompare] = []

        for i, query in enumerate(queries, start=1):
            print(f"[{i}/{len(queries)}] {query}")
            per_query[query] = {}

            for mode in stage2_modes:
                detail = _run_once(
                    engine,
                    config,
                    query,
                    args.source,
                    stage2_mode=mode,
                    k=args.k,
                    coarse_k=args.coarse_k,
                )
                per_query[query][mode] = detail
                runs.append(detail)

            # Pairwise overlaps for this query
            for a_idx in range(len(stage2_modes)):
                for b_idx in range(a_idx + 1, len(stage2_modes)):
                    mode_a = stage2_modes[a_idx]
                    mode_b = stage2_modes[b_idx]
                    a = per_query[query][mode_a]
                    b = per_query[query][mode_b]
                    comparisons.append(
                        PairwiseCompare(
                            query=query,
                            mode_a=mode_a,
                            mode_b=mode_b,
                            jaccard_topk=jaccard_topk(a.topk_paths, b.topk_paths),
                            rbo_topk=rbo(a.topk_paths, b.topk_paths, p=0.9),
                            a_unique_files_topk=len(set(a.topk_paths)),
                            b_unique_files_topk=len(set(b.topk_paths)),
                            a_unique_dirs_topk=_unique_parent_dirs(a.topk_paths),
                            b_unique_dirs_topk=_unique_parent_dirs(b.topk_paths),
                        )
                    )

        def _latencies(details: List[RunDetail]) -> List[float]:
            return [d.latency_ms for d in details if not d.error]

        mode_summaries: Dict[str, Dict[str, Any]] = {}
        for mode in stage2_modes:
            mode_runs = [r for r in runs if r.stage2_mode == mode]
            lat = _latencies(mode_runs)
            mode_summaries[mode] = {
                "success": sum(1 for r in mode_runs if not r.error),
                "avg_latency_ms": statistics.mean(lat) if lat else 0.0,
                "p50_latency_ms": statistics.median(lat) if lat else 0.0,
                "p95_latency_ms": statistics.quantiles(lat, n=20)[18] if len(lat) >= 2 else (lat[0] if lat else 0.0),
            }

        summary = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source": str(args.source),
            "k": args.k,
            "coarse_k": args.coarse_k,
            "query_count": len(queries),
            "stage2_modes": stage2_modes,
            "modes": mode_summaries,
            "avg_pairwise_jaccard_topk": statistics.mean([c.jaccard_topk for c in comparisons]) if comparisons else 0.0,
            "avg_pairwise_rbo_topk": statistics.mean([c.rbo_topk for c in comparisons]) if comparisons else 0.0,
        }

        args.output.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "summary": summary,
            "runs": [asdict(r) for r in runs],
            "comparisons": [asdict(c) for c in comparisons],
        }
        args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"\nSaved: {args.output}")
    finally:
        try:
            engine.close()
        except Exception as exc:
            print(f"WARNING engine.close() failed: {exc!r}", file=sys.stderr)
        try:
            registry.close()
        except Exception as exc:
            print(f"WARNING registry.close() failed: {exc!r}", file=sys.stderr)


if __name__ == "__main__":
    main()

