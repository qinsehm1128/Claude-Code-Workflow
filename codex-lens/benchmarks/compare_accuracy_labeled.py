#!/usr/bin/env python
"""Compare labeled accuracy: staged(realtime LSP graph) vs dense_rerank.

This script measures retrieval "accuracy" against a labeled query set.
Each query must provide a list of relevant file paths (relative to --source
or absolute). We report:
  - Hit@K (any relevant file appears in top-K)
  - MRR@K (reciprocal rank of first relevant file within top-K)
  - Recall@K (fraction of relevant files present in top-K)

Example:
  python benchmarks/compare_accuracy_labeled.py --source ./src
  python benchmarks/compare_accuracy_labeled.py --queries-file benchmarks/accuracy_queries_codexlens.jsonl
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
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# Add src to path (match other benchmark scripts)
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.config import Config
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


DEFAULT_QUERIES_FILE = Path(__file__).parent / "accuracy_queries_codexlens.jsonl"


def _now_ms() -> float:
    return time.perf_counter() * 1000.0


def _normalize_path_key(path: str) -> str:
    """Normalize file paths for overlap/dedup metrics (Windows-safe)."""
    try:
        p = Path(path)
        # Don't explode on non-files like "<memory>".
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


def _load_labeled_queries(path: Path, limit: Optional[int]) -> List[Dict[str, Any]]:
    if not path.is_file():
        raise SystemExit(f"Queries file does not exist: {path}")

    out: List[Dict[str, Any]] = []
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            item = json.loads(line)
        except Exception as exc:
            raise SystemExit(f"Invalid JSONL line in {path}: {raw_line!r} ({exc})") from exc
        if not isinstance(item, dict) or "query" not in item:
            raise SystemExit(f"Invalid query item (expected object with 'query'): {item!r}")
        out.append(item)
        if limit is not None and len(out) >= limit:
            break
    return out


def _dedup_topk(paths: Iterable[str], k: int) -> List[str]:
    out: List[str] = []
    seen: set[str] = set()
    for p in paths:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
        if len(out) >= k:
            break
    return out


def _first_hit_rank(topk_paths: Sequence[str], relevant: set[str]) -> Optional[int]:
    for i, p in enumerate(topk_paths, start=1):
        if p in relevant:
            return i
    return None


@dataclass
class StrategyRun:
    strategy: str
    latency_ms: float
    topk_paths: List[str]
    first_hit_rank: Optional[int]
    hit_at_k: bool
    recall_at_k: float
    error: Optional[str] = None


@dataclass
class QueryEval:
    query: str
    relevant_paths: List[str]
    staged: StrategyRun
    dense_rerank: StrategyRun


def _run_strategy(
    engine: ChainSearchEngine,
    *,
    strategy: str,
    query: str,
    source_path: Path,
    k: int,
    coarse_k: int,
    relevant: set[str],
    options: Optional[SearchOptions] = None,
) -> StrategyRun:
    gc.collect()
    start_ms = _now_ms()
    try:
        result = engine.cascade_search(
            query=query,
            source_path=source_path,
            k=k,
            coarse_k=coarse_k,
            options=options,
            strategy=strategy,
        )
        latency_ms = _now_ms() - start_ms
        paths_raw = [r.path for r in (result.results or []) if getattr(r, "path", None)]
        paths_norm = [_normalize_path_key(p) for p in paths_raw]
        topk = _dedup_topk(paths_norm, k=k)
        rank = _first_hit_rank(topk, relevant)
        hit = rank is not None
        recall = 0.0
        if relevant:
            recall = len(set(topk) & relevant) / float(len(relevant))
        return StrategyRun(
            strategy=strategy,
            latency_ms=latency_ms,
            topk_paths=topk,
            first_hit_rank=rank,
            hit_at_k=hit,
            recall_at_k=recall,
            error=None,
        )
    except Exception as exc:
        latency_ms = _now_ms() - start_ms
        return StrategyRun(
            strategy=strategy,
            latency_ms=latency_ms,
            topk_paths=[],
            first_hit_rank=None,
            hit_at_k=False,
            recall_at_k=0.0,
            error=repr(exc),
        )


def _mrr(ranks: Sequence[Optional[int]]) -> float:
    vals = []
    for r in ranks:
        if r is None or r <= 0:
            vals.append(0.0)
        else:
            vals.append(1.0 / float(r))
    return statistics.mean(vals) if vals else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare labeled retrieval accuracy: staged(realtime) vs dense_rerank"
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).parent.parent / "src",
        help="Source directory to search (default: ./src)",
    )
    parser.add_argument(
        "--queries-file",
        type=Path,
        default=DEFAULT_QUERIES_FILE,
        help="JSONL file with {query, relevant_paths[]} per line",
    )
    parser.add_argument("--queries", type=int, default=None, help="Limit number of queries")
    parser.add_argument("--k", type=int, default=10, help="Top-K for evaluation (default 10)")
    parser.add_argument("--coarse-k", type=int, default=100, help="Coarse candidates (default 100)")
    parser.add_argument(
        "--staged-cluster-strategy",
        type=str,
        default="path",
        help="Config.staged_clustering_strategy override for staged (default: path)",
    )
    parser.add_argument(
        "--stage2-mode",
        type=str,
        default="realtime",
        help="Config.staged_stage2_mode override for staged (default: realtime)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "results" / "accuracy_labeled.json",
        help="Output JSON path",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Source path does not exist: {args.source}")

    labeled = _load_labeled_queries(args.queries_file, args.queries)
    if not labeled:
        raise SystemExit("No queries to run")

    source_root = args.source.expanduser().resolve()

    # Match CLI behavior: load settings + apply global/workspace .env overrides.
    config = Config.load()
    config.cascade_strategy = "staged"
    config.staged_stage2_mode = str(args.stage2_mode or "realtime").strip().lower()
    config.enable_staged_rerank = True
    config.staged_clustering_strategy = str(args.staged_cluster_strategy or "path").strip().lower()
    # Stability: on some Windows setups, DirectML/ONNX can crash under load.
    config.embedding_use_gpu = False

    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()
    engine = ChainSearchEngine(registry=registry, mapper=mapper, config=config)

    def resolve_expected(paths: Sequence[str]) -> set[str]:
        out: set[str] = set()
        for p in paths:
            try:
                cand = Path(p)
                if not cand.is_absolute():
                    cand = (source_root / cand).resolve()
                out.add(_normalize_path_key(str(cand)))
            except Exception:
                out.add(_normalize_path_key(p))
        return out

    evaluations: List[QueryEval] = []

    try:
        for i, item in enumerate(labeled, start=1):
            query = str(item.get("query", "")).strip()
            relevant_raw = item.get("relevant_paths") or []
            if not query:
                continue
            if not isinstance(relevant_raw, list) or not relevant_raw:
                raise SystemExit(f"Query item missing relevant_paths[]: {item!r}")
            relevant = resolve_expected([str(p) for p in relevant_raw])

            print(f"[{i}/{len(labeled)}] {query}")

            staged = _run_strategy(
                engine,
                strategy="staged",
                query=query,
                source_path=source_root,
                k=int(args.k),
                coarse_k=int(args.coarse_k),
                relevant=relevant,
                options=None,
            )
            dense = _run_strategy(
                engine,
                strategy="dense_rerank",
                query=query,
                source_path=source_root,
                k=int(args.k),
                coarse_k=int(args.coarse_k),
                relevant=relevant,
                options=None,
            )

            evaluations.append(
                QueryEval(
                    query=query,
                    relevant_paths=[_normalize_path_key(str((source_root / p).resolve())) if not Path(p).is_absolute() else _normalize_path_key(p) for p in relevant_raw],
                    staged=staged,
                    dense_rerank=dense,
                )
            )
    finally:
        try:
            engine.close()
        except Exception:
            pass
        try:
            registry.close()
        except Exception:
            pass

    staged_runs = [e.staged for e in evaluations]
    dense_runs = [e.dense_rerank for e in evaluations]

    def mean(xs: Sequence[float]) -> float:
        return statistics.mean(xs) if xs else 0.0

    staged_ranks = [r.first_hit_rank for r in staged_runs]
    dense_ranks = [r.first_hit_rank for r in dense_runs]

    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": str(source_root),
        "queries_file": str(args.queries_file),
        "query_count": len(evaluations),
        "k": int(args.k),
        "coarse_k": int(args.coarse_k),
        "staged": {
            "hit_at_k": mean([1.0 if r.hit_at_k else 0.0 for r in staged_runs]),
            "mrr_at_k": _mrr(staged_ranks),
            "avg_recall_at_k": mean([r.recall_at_k for r in staged_runs]),
            "avg_latency_ms": mean([r.latency_ms for r in staged_runs if not r.error]),
            "errors": sum(1 for r in staged_runs if r.error),
        },
        "dense_rerank": {
            "hit_at_k": mean([1.0 if r.hit_at_k else 0.0 for r in dense_runs]),
            "mrr_at_k": _mrr(dense_ranks),
            "avg_recall_at_k": mean([r.recall_at_k for r in dense_runs]),
            "avg_latency_ms": mean([r.latency_ms for r in dense_runs if not r.error]),
            "errors": sum(1 for r in dense_runs if r.error),
        },
        "config": {
            "staged_stage2_mode": config.staged_stage2_mode,
            "staged_clustering_strategy": config.staged_clustering_strategy,
            "enable_staged_rerank": bool(config.enable_staged_rerank),
            "reranker_backend": config.reranker_backend,
            "reranker_model": config.reranker_model,
            "embedding_backend": config.embedding_backend,
            "embedding_model": config.embedding_model,
        },
    }

    payload = {"summary": summary, "evaluations": [asdict(e) for e in evaluations]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2))
    print(f"\nSaved: {args.output}")


if __name__ == "__main__":
    main()

