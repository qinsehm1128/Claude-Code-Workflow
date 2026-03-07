"""DeepWiki document generation tools.

This module provides tools for generating documentation from source code.
"""

from __future__ import annotations

import hashlib
import logging
import shlex
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Optional, Protocol, Any, Tuple, Set

from codexlens.storage.deepwiki_store import DeepWikiStore
from codexlens.storage.deepwiki_models import DeepWikiSymbol, DeepWikiFile, DeepWikiDoc

logger = logging.getLogger(__name__)

# HTML metadata markers for documentation
SYMBOL_START_TEMPLATE = '<!-- deepwiki-symbol-start name="{name}" type="{type}" -->'
SYMBOL_END_MARKER = "<!-- deepwiki-symbol-end -->"


class MarkdownGenerator(Protocol):
    """Protocol for generating Markdown documentation."""

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate Markdown documentation for a symbol."""
        ...


class MockMarkdownGenerator:
    """Mock Markdown generator for testing."""

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate mock Markdown documentation."""
        start_line, end_line = symbol.line_range
        return f"""{SYMBOL_START_TEMPLATE.format(name=symbol.name, type=symbol.type)}

## `{symbol.name}`

**Type**: {symbol.type}
**Location**: `{symbol.source_file}:{start_line}-{end_line}`

```{symbol.source_file.split('.')[-1] if '.' in symbol.source_file else 'text'}
{source_code}
```

{SYMBOL_END_MARKER}
"""


class DeepWikiGenerator:
    """Main generator for DeepWiki documentation.

    Scans source code, generates documentation with incremental updates
    using SHA256 hashes for change detection.
    """

    SUPPORTED_EXTENSIONS = [".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs", ".swift"]

    def __init__(
        self,
        store: DeepWikiStore | None = None,
        markdown_generator: MarkdownGenerator | None = None,
    ) -> None:
        """Initialize the generator.

        Args:
            store: DeepWiki storage instance
            markdown_generator: Markdown generator for documentation
        """
        self.store = store or DeepWikiStore()
        self.markdown_generator = markdown_generator or MockMarkdownGenerator()

    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of a file.

        Args:
            file_path: Path to the source file

        Returns:
            SHA256 hash string
        """
        content = file_path.read_bytes()
        return hashlib.sha256(content).hexdigest()

    def _should_process_file(self, file_path: Path) -> bool:
        """Check if a file should be processed based on extension."""
        return file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS

    def _extract_symbols_simple(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract symbols from a file using simple regex patterns.

        Args:
            file_path: Path to the source file

        Returns:
            List of symbol dictionaries
        """
        import re

        content = file_path.read_text(encoding="utf-8", errors="ignore")
        lines = content.split("\n")
        symbols = []

        # Python patterns
        py_patterns = [
            (r"^(\s*)def\s+(\w+)\s*\(", "function"),
            (r"^(\s*)async\s+def\s+(\w+)\s*\(", "async_function"),
            (r"^(\s*)class\s+(\w+)", "class"),
        ]

        # TypeScript/JavaScript patterns
        ts_patterns = [
            (r"^(\s*)function\s+(\w+)\s*\(", "function"),
            (r"^(\s*)const\s+(\w+)\s*=\s*(?:async\s*)?\(", "function"),
            (r"^(\s*)export\s+(?:async\s+)?function\s+(\w+)", "function"),
            (r"^(\s*)class\s+(\w+)", "class"),
            (r"^(\s*)interface\s+(\w+)", "interface"),
        ]

        all_patterns = py_patterns + ts_patterns

        for i, line in enumerate(lines, 1):
            for pattern, symbol_type in all_patterns:
                match = re.match(pattern, line)
                if match:
                    name = match.group(2)
                    # Find end line (simple heuristic: next def/class or EOF)
                    end_line = i
                    for j in range(i, min(i + 50, len(lines) + 1)):
                        if j > i:
                            for p, _ in all_patterns:
                                if re.match(p, lines[j - 1]) and not lines[j - 1].startswith(match.group(1)):
                                    end_line = j - 1
                                    break
                            else:
                                continue
                            break
                    else:
                        end_line = min(i + 30, len(lines))

                    symbols.append({
                        "name": name,
                        "type": symbol_type,
                        "line_start": i,
                        "line_end": end_line,
                        "source": "\n".join(lines[i - 1:end_line]),
                    })
                    break

        return symbols

    def generate_for_file(self, file_path: Path) -> Dict[str, Any]:
        """Generate documentation for a single file.

        Args:
            file_path: Path to the source file

        Returns:
            Generation result dictionary
        """
        if not self._should_process_file(file_path):
            return {"skipped": True, "reason": "unsupported_extension"}

        # Calculate hash and check for changes
        current_hash = self.calculate_file_hash(file_path)
        existing_file = self.store.get_file(str(file_path))

        if existing_file and existing_file.content_hash == current_hash:
            logger.debug(f"File unchanged: {file_path}")
            return {"skipped": True, "reason": "unchanged", "hash": current_hash}

        # Extract symbols
        raw_symbols = self._extract_symbols_simple(file_path)

        if not raw_symbols:
            logger.debug(f"No symbols found in: {file_path}")
            return {"skipped": True, "reason": "no_symbols", "hash": current_hash}

        # Generate documentation for each symbol
        docs_generated = 0
        for sym in raw_symbols:
            # Create symbol record
            symbol = DeepWikiSymbol(
                name=sym["name"],
                type=sym["type"],
                source_file=str(file_path),
                doc_file=f".deepwiki/{file_path.stem}.md",
                anchor=f"#{sym['name'].lower()}",
                line_range=(sym["line_start"], sym["line_end"]),
            )

            # Generate markdown
            markdown = self.markdown_generator.generate(symbol, sym["source"])

            # Save to store
            self.store.add_symbol(symbol)
            docs_generated += 1

        # Track file hash + metadata for incremental updates and staleness checks.
        self.store.add_file(
            file_path=str(file_path),
            content_hash=current_hash,
            symbols_count=len(raw_symbols),
            docs_generated=docs_generated > 0,
        )

        logger.info(f"Generated docs for {docs_generated} symbols in {file_path}")
        return {
            "symbols": len(raw_symbols),
            "docs_generated": docs_generated,
            "hash": current_hash,
        }

    def run(self, path: Path) -> Dict[str, Any]:
        """Run documentation generation for a path.

        Args:
            path: File or directory path to process

        Returns:
            Generation summary
        """
        path = Path(path)

        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = []
            for ext in self.SUPPORTED_EXTENSIONS:
                files.extend(path.rglob(f"*{ext}"))
        else:
            raise ValueError(f"Path not found: {path}")

        results = {
            "total_files": 0,
            "processed_files": 0,
            "skipped_files": 0,
            "total_symbols": 0,
            "docs_generated": 0,
        }

        for file_path in files:
            results["total_files"] += 1
            result = self.generate_for_file(file_path)

            if result.get("skipped"):
                results["skipped_files"] += 1
            else:
                results["processed_files"] += 1
                results["total_symbols"] += result.get("symbols", 0)
                results["docs_generated"] += result.get("docs_generated", 0)

        logger.info(
            f"DeepWiki generation complete: "
            f"{results['processed_files']}/{results['total_files']} files, "
            f"{results['docs_generated']} docs generated"
        )

        return results


# =============================================================================
# TASK-002: LLMMarkdownGenerator Core Class
# =============================================================================

@dataclass
class GenerationResult:
    """Result of a documentation generation attempt."""
    success: bool
    content: Optional[str] = None
    tool: Optional[str] = None
    attempts: int = 0
    error: Optional[str] = None
    symbol: Optional[DeepWikiSymbol] = None


@dataclass
class GeneratorConfig:
    """Configuration for LLM generator."""
    max_concurrent: int = 4
    batch_size: int = 4
    graceful_shutdown: bool = True


# Tool fallback chains: primary -> secondary -> tertiary
TOOL_CHAIN: Dict[str, List[str]] = {
    "gemini": ["gemini", "qwen", "codex"],
    "qwen": ["qwen", "gemini", "codex"],
    "codex": ["codex", "gemini", "qwen"],
}

# Layer-based timeout settings (seconds)
TOOL_TIMEOUTS: Dict[str, Dict[str, int]] = {
    "gemini": {"layer3": 120, "layer2": 60, "layer1": 30},
    "qwen": {"layer3": 90, "layer2": 45, "layer1": 20},
    "codex": {"layer3": 180, "layer2": 90, "layer1": 45},
}

# Required sections per layer for validation
REQUIRED_SECTIONS: Dict[int, List[str]] = {
    3: ["Description", "Parameters", "Returns", "Example"],
    2: ["Description", "Returns"],
    1: ["Description"],
}


class LLMMarkdownGenerator:
    """LLM-powered Markdown generator with tool fallback and retry logic.

    Implements the MarkdownGenerator protocol with:
    - Tool fallback chain (gemini -> qwen -> codex)
    - Layer-based timeouts
    - SHA256 incremental updates
    - Structure validation
    """

    def __init__(
        self,
        primary_tool: str = "gemini",
        db: DeepWikiStore | None = None,
        force_mode: bool = False,
        progress_tracker: Optional[Any] = None,
    ) -> None:
        """Initialize LLM generator.

        Args:
            primary_tool: Primary LLM tool to use (gemini/qwen/codex).
            db: DeepWikiStore instance for progress tracking.
            force_mode: If True, regenerate all docs regardless of hash.
            progress_tracker: Optional ProgressTracker for timeout alerts.
        """
        self.primary_tool = primary_tool
        self.db = db or DeepWikiStore()
        self.force_mode = force_mode
        self.progress_tracker = progress_tracker
        self._ensure_db_initialized()

    def _ensure_db_initialized(self) -> None:
        """Ensure database is initialized."""
        try:
            self.db.initialize()
        except Exception:
            pass  # Already initialized

    def _classify_layer(self, symbol: DeepWikiSymbol) -> int:
        """Classify symbol into layer (1, 2, or 3).

        Layer 3: class, function, async_function, interface (detailed docs)
        Layer 2: method, property (compact docs)
        Layer 1: variable, constant (minimal docs)
        """
        symbol_type = symbol.type.lower()
        if symbol_type in ("class", "function", "async_function", "interface"):
            return 3
        elif symbol_type in ("method", "property"):
            return 2
        else:
            return 1

    def _build_prompt(self, symbol: DeepWikiSymbol, source_code: str, layer: int) -> str:
        """Build LLM prompt based on symbol layer.

        Args:
            symbol: Symbol to document.
            source_code: Source code of the symbol.
            layer: Layer (1, 2, or 3) determining prompt template.

        Returns:
            Prompt string for the LLM.
        """
        file_ext = Path(symbol.source_file).suffix.lstrip(".")

        if layer == 3:
            # Full documentation template
            return f"""Generate comprehensive Markdown documentation for this code symbol.

## Symbol Information
- Name: {symbol.name}
- Type: {symbol.type}
- File: {symbol.source_file}
- Lines: {symbol.line_range[0]}-{symbol.line_range[1]}

## Source Code
```{file_ext}
{source_code}
```

## Required Sections
Generate a Markdown document with these sections:
1. **Description** - Clear description of what this symbol does
2. **Parameters** - List all parameters with types and descriptions
3. **Returns** - What this symbol returns (if applicable)
4. **Example** - Code example showing usage

Format the output as clean Markdown. Use code fences for code blocks."""

        elif layer == 2:
            # Compact documentation template
            return f"""Generate compact Markdown documentation for this code symbol.

## Symbol Information
- Name: {symbol.name}
- Type: {symbol.type}
- File: {symbol.source_file}

## Source Code
```{file_ext}
{source_code}
```

## Required Sections
Generate a Markdown document with these sections:
1. **Description** - Brief description of this symbol's purpose
2. **Returns** - Return value description (if applicable)

Keep it concise. Format as clean Markdown."""

        else:
            # Minimal documentation template (layer 1)
            return f"""Generate minimal Markdown documentation for this code symbol.

## Symbol Information
- Name: {symbol.name}
- Type: {symbol.type}

## Source Code
```{file_ext}
{source_code}
```

## Required Sections
Generate a Markdown document with:
1. **Description** - One-line description of this symbol

Keep it minimal. Format as clean Markdown."""

    def _call_cli_with_timeout(
        self, tool: str, prompt: str, timeout: int
    ) -> str:
        """Call LLM CLI tool with timeout.

        Args:
            tool: CLI tool name (gemini/qwen/codex).
            prompt: Prompt to send to the LLM.
            timeout: Timeout in seconds.

        Returns:
            Generated content string.

        Raises:
            TimeoutError: If command times out.
            RuntimeError: If command fails.
        """
        # Build ccw cli command
        escaped_prompt = prompt.replace('"', '\\"')
        cmd = [
            "ccw", "cli", "-p", prompt,
            "--tool", tool,
            "--mode", "write",
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(Path.cwd()),
            )

            if result.returncode != 0:
                raise RuntimeError(f"CLI failed: {result.stderr}")

            return result.stdout.strip()

        except subprocess.TimeoutExpired as exc:
            raise TimeoutError(
                f"Timeout after {timeout}s with {tool}"
            ) from exc

    def _emit_timeout_alert(
        self, symbol: DeepWikiSymbol, tool: str, timeout: int
    ) -> None:
        """Emit timeout alert to progress tracker and logs.

        Args:
            symbol: Symbol that timed out.
            tool: Tool that timed out.
            timeout: Timeout duration in seconds.
        """
        alert_msg = f"TIMEOUT: {symbol.name} ({symbol.source_file}) with {tool} after {timeout}s"
        logger.warning(alert_msg)

        # Output to progress tracker if available
        if self.progress_tracker:
            self.progress_tracker.write_above(f"[WARNING] {alert_msg}")

    def validate_structure(self, content: str, layer: int) -> bool:
        """Validate generated content has required structure.

        Args:
            content: Generated markdown content.
            layer: Layer (1, 2, or 3).

        Returns:
            True if content passes validation, False otherwise.
        """
        import re

        if not content or len(content.strip()) < 20:
            return False

        required = REQUIRED_SECTIONS.get(layer, ["Description"])

        for section in required:
            # Match markdown headers (##, ###, **Bold**) or standalone section names
            pattern = rf"^\s*(?:#{1,6}\s+|\*\*){re.escape(section)}"
            if not re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
                return False

        return True

    def generate_with_retry(
        self, symbol: DeepWikiSymbol, source_code: str
    ) -> GenerationResult:
        """Generate documentation with tool fallback chain.

        Strategy: Immediate tool fallback
        - Tool A fails -> Immediately try Tool B
        - All 3 tools fail -> Mark as failed

        Args:
            symbol: Symbol to document.
            source_code: Source code of the symbol.

        Returns:
            GenerationResult with success status and content.
        """
        tool_chain = TOOL_CHAIN.get(self.primary_tool, ["gemini", "qwen", "codex"])
        layer = self._classify_layer(symbol)
        prompt = self._build_prompt(symbol, source_code, layer)

        symbol_key = f"{symbol.source_file}:{symbol.name}:{symbol.line_range[0]}"
        last_error = None

        for attempt, tool in enumerate(tool_chain, 1):
            timeout = TOOL_TIMEOUTS.get(tool, {}).get(f"layer{layer}", 60)

            try:
                # Update progress
                if self.db:
                    self.db.update_progress(
                        symbol_key,
                        {
                            "file_path": symbol.source_file,
                            "symbol_name": symbol.name,
                            "symbol_type": symbol.type,
                            "layer": layer,
                            "source_hash": hashlib.sha256(source_code.encode()).hexdigest(),
                            "status": "processing",
                            "attempts": attempt,
                            "last_tool": tool,
                        },
                    )

                result = self._call_cli_with_timeout(tool, prompt, timeout)

                if result and self.validate_structure(result, layer):
                    # Success
                    if self.db:
                        self.db.mark_completed(symbol_key, tool)

                    return GenerationResult(
                        success=True,
                        content=result,
                        tool=tool,
                        attempts=attempt,
                        symbol=symbol,
                    )

                # Invalid structure
                last_error = f"Invalid structure from {tool}"
                continue

            except TimeoutError:
                self._emit_timeout_alert(symbol, tool, timeout)
                last_error = f"Timeout after {timeout}s with {tool}"
                continue

            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                continue

        # All tools failed
        if self.db:
            self.db.mark_failed(symbol_key, last_error or "All tools failed")

        return GenerationResult(
            success=False,
            content=None,
            tool=None,
            attempts=len(tool_chain),
            error=last_error,
            symbol=symbol,
        )

    def should_regenerate(
        self,
        symbol: DeepWikiSymbol,
        source_code: str,
        staleness_threshold: float = 0.7,
    ) -> bool:
        """Check if symbol needs regeneration.

        Conditions for regeneration:
        1. --force mode is enabled
        2. Symbol not in database (new)
        3. Source code hash changed
        4. Previous generation failed
        5. Staleness score exceeds threshold

        Args:
            symbol: Symbol to check.
            source_code: Source code of the symbol.
            staleness_threshold: Score above which regeneration is triggered.

        Returns:
            True if regeneration needed, False otherwise.
        """
        if self.force_mode:
            return True

        current_hash = hashlib.sha256(source_code.encode()).hexdigest()
        symbol_key = f"{symbol.source_file}:{symbol.name}:{symbol.line_range[0]}"

        if self.db:
            progress = self.db.get_progress(symbol_key)

            if not progress:
                return True  # New symbol

            if progress.get("source_hash") != current_hash:
                return True  # Code changed

            if progress.get("status") == "failed":
                return True  # Retry failed

            # Check staleness score from DeepWiki index
            db_symbol = self.db.get_symbol(symbol.name, symbol.source_file)
            if db_symbol and db_symbol.staleness_score >= staleness_threshold:
                return True  # Stale documentation

        return False  # Skip

    def _fallback_generate(
        self, symbol: DeepWikiSymbol, source_code: str
    ) -> str:
        """Fallback to Mock generation when all LLM tools fail.

        Args:
            symbol: Symbol to document.
            source_code: Source code of the symbol.

        Returns:
            Mock-generated markdown content.
        """
        mock = MockMarkdownGenerator()
        return mock.generate(symbol, source_code)

    def generate(self, symbol: DeepWikiSymbol, source_code: str) -> str:
        """Generate Markdown documentation (implements MarkdownGenerator protocol).

        Args:
            symbol: Symbol to document.
            source_code: Source code of the symbol.

        Returns:
            Generated markdown content.
        """
        result = self.generate_with_retry(symbol, source_code)

        if result.success and result.content:
            return result.content

        # Fallback to mock on failure
        return self._fallback_generate(symbol, source_code)


# =============================================================================
# TASK-003: BatchProcessor + Graceful Interrupt
# TASK-004: ProgressTracker (rich progress bar)
# =============================================================================

class ProgressTracker:
    """Progress tracker using rich progress bar.

    Shows real-time progress with:
    - Progress bar: [=====>  ] 120/500 (24%) eta: 5min
    - Timeout alerts above progress bar
    - Failure summary at completion
    """

    def __init__(self, total: int) -> None:
        """Initialize progress tracker.

        Args:
            total: Total number of symbols to process.
        """
        self.total = total
        self.completed = 0
        self.failed_symbols: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._started = False

        # Lazy import rich to avoid dependency issues
        try:
            from rich.console import Console
            from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeRemainingColumn
            self._console = Console()
            self._progress = Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TextColumn("({task.completed}/{task.total})"),
                TimeRemainingColumn(),
                console=self._console,
            )
            self._task_id = None
            self._rich_available = True
        except ImportError:
            self._rich_available = False
            self._console = None

    def start(self) -> None:
        """Start the progress bar."""
        if self._rich_available and self._progress:
            self._progress.start()
            self._task_id = self._progress.add_task(
                "Generating docs", total=self.total
            )
        self._started = True

    def update(self, symbol: DeepWikiSymbol, result: GenerationResult) -> None:
        """Update progress after a symbol is processed.

        Args:
            symbol: Processed symbol.
            result: Generation result.
        """
        with self._lock:
            self.completed += 1

            if self._rich_available and self._progress and self._task_id is not None:
                self._progress.advance(self._task_id)

            if not result.success:
                self.failed_symbols.append({
                    "symbol": symbol.name,
                    "file": symbol.source_file,
                    "error": result.error or "Unknown error",
                })

    def write_above(self, message: str) -> None:
        """Write message above the progress bar.

        Args:
            message: Message to display.
        """
        if self._rich_available and self._console:
            self._console.print(message)
        else:
            print(message)

    def print_summary(self) -> None:
        """Print final summary after all processing completes."""
        self.stop()

        success = self.completed - len(self.failed_symbols)
        failed = len(self.failed_symbols)

        if self._rich_available and self._console:
            self._console.print(
                f"\n[bold]Generation complete:[/bold] "
                f"[green]{success}/{self.completed}[/green] successful"
            )

            if self.failed_symbols:
                self._console.print(
                    f"\n[bold red]Failed symbols ({failed}):[/bold red]"
                )
                for item in self.failed_symbols:
                    self._console.print(
                        f"  - [yellow]{item['symbol']}[/yellow] "
                        f"({item['file']}): {item['error']}"
                    )
        else:
            print(f"\nGeneration complete: {success}/{self.completed} successful")

            if self.failed_symbols:
                print(f"\nFailed symbols ({failed}):")
                for item in self.failed_symbols:
                    print(f"  - {item['symbol']} ({item['file']}): {item['error']}")

    def stop(self) -> None:
        """Stop the progress bar."""
        if self._rich_available and self._progress and self._started:
            self._progress.stop()
        self._started = False


class BatchProcessor:
    """Batch processor with concurrent execution and graceful interrupt.

    Features:
    - ThreadPoolExecutor with configurable concurrency (default: 4)
    - Signal handlers for Ctrl+C graceful interrupt
    - Orphaned document cleanup
    - Integration with ProgressTracker
    """

    def __init__(
        self,
        generator: LLMMarkdownGenerator,
        config: GeneratorConfig | None = None,
    ) -> None:
        """Initialize batch processor.

        Args:
            generator: LLM generator instance.
            config: Generator configuration.
        """
        self.generator = generator
        self.config = config or GeneratorConfig()
        self.shutdown_event = threading.Event()
        self._executor = None
        self._progress: Optional[ProgressTracker] = None

    def setup_signal_handlers(self) -> None:
        """Set up signal handlers for graceful Ctrl+C interrupt."""
        def handle_sigint(signum: int, frame) -> None:
            if self.shutdown_event.is_set():
                # Second Ctrl+C: force exit
                print("\n[WARNING] Forced exit, progress may be lost")
                sys.exit(1)

            # First Ctrl+C: graceful interrupt
            print("\n[INFO] Completing current batch...")
            self.shutdown_event.set()

        signal.signal(signal.SIGINT, handle_sigint)

    def process_batch(
        self, symbols: List[Tuple[DeepWikiSymbol, str]]
    ) -> List[GenerationResult]:
        """Process a batch of symbols concurrently.

        Args:
            symbols: List of (symbol, source_code) tuples.

        Returns:
            List of GenerationResult for each symbol.
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        results: List[GenerationResult] = []
        futures = []

        with ThreadPoolExecutor(max_workers=self.config.max_concurrent) as executor:
            self._executor = executor

            for symbol, source_code in symbols:
                if self.shutdown_event.is_set():
                    break

                future = executor.submit(
                    self.generator.generate_with_retry,
                    symbol,
                    source_code,
                )
                futures.append((symbol, future))

            # Wait for all submitted tasks
            for symbol, future in futures:
                try:
                    result = future.result(timeout=300)  # 5 min total timeout
                    results.append(result)

                    if self._progress:
                        self._progress.update(symbol, result)

                except Exception as exc:
                    error_result = GenerationResult(
                        success=False,
                        error=str(exc),
                        symbol=symbol,
                    )
                    results.append(error_result)

                    if self._progress:
                        self._progress.update(symbol, error_result)

        return results

    def cleanup_orphaned_docs(
        self, current_symbols: List[DeepWikiSymbol]
    ) -> int:
        """Clean up documents for symbols that no longer exist in source.

        Args:
            current_symbols: List of current symbols in source code.

        Returns:
            Number of orphaned documents removed.
        """
        if not self.generator.db:
            return 0

        current_keys = {
            f"{s.source_file}:{s.name}:{s.line_range[0]}"
            for s in current_symbols
        }

        stored_keys = self.generator.db.get_completed_symbol_keys()
        orphaned_keys = list(stored_keys - current_keys)

        if orphaned_keys:
            deleted = self.generator.db.delete_progress(orphaned_keys)
            logger.info(f"Cleaned up {deleted} orphaned documents")
            return deleted

        return 0

    def run(
        self,
        path: Path,
        tool: str = "gemini",
        force: bool = False,
        resume: bool = False,
    ) -> Dict[str, Any]:
        """Main entry point for batch processing.

        Flow:
        1. Scan source files
        2. Extract symbols
        3. SHA256 filter
        4. Layer sort (3 -> 2 -> 1)
        5. Batch process with concurrency

        Args:
            path: File or directory path to process.
            tool: Primary LLM tool to use.
            force: Force regenerate all docs.
            resume: Resume from previous interrupted run.

        Returns:
            Processing summary dictionary.
        """
        # Update generator settings
        self.generator.primary_tool = tool
        self.generator.force_mode = force

        # Setup signal handlers
        if self.config.graceful_shutdown:
            self.setup_signal_handlers()

        # Initialize database
        self.generator._ensure_db_initialized()

        # Phase 1: Scan files
        path = Path(path)
        if path.is_file():
            files = [path]
        elif path.is_dir():
            files = []
            for ext in DeepWikiGenerator.SUPPORTED_EXTENSIONS:
                files.extend(path.rglob(f"*{ext}"))
        else:
            raise ValueError(f"Path not found: {path}")

        # Phase 2: Extract symbols
        all_symbols: List[Tuple[DeepWikiSymbol, str]] = []
        temp_gen = DeepWikiGenerator(store=self.generator.db)

        for file_path in files:
            raw_symbols = temp_gen._extract_symbols_simple(file_path)

            for sym in raw_symbols:
                symbol = DeepWikiSymbol(
                    name=sym["name"],
                    symbol_type=sym["type"],
                    source_file=str(file_path),
                    doc_file=f".deepwiki/{file_path.stem}.md",
                    anchor=f"#{sym['name'].lower()}",
                    line_start=sym["line_start"],
                    line_end=sym["line_end"],
                )
                all_symbols.append((symbol, sym["source"]))

        # Phase 3: SHA256 filter
        symbols_to_process = [
            (s, c) for s, c in all_symbols
            if self.generator.should_regenerate(s, c)
        ]

        if not symbols_to_process:
            logger.info("All symbols up to date, nothing to process")
            return {
                "total_symbols": len(all_symbols),
                "processed": 0,
                "skipped": len(all_symbols),
                "success": 0,
                "failed": 0,
            }

        # Phase 4: Cleanup orphaned docs
        current_symbols = [s for s, _ in all_symbols]
        orphaned = self.cleanup_orphaned_docs(current_symbols)

        # Phase 5: Sort by layer (3 -> 2 -> 1)
        symbols_to_process.sort(
            key=lambda x: self.generator._classify_layer(x[0]),
            reverse=True
        )

        # Phase 6: Initialize progress tracker
        self._progress = ProgressTracker(total=len(symbols_to_process))
        self.generator.progress_tracker = self._progress
        self._progress.start()

        # Phase 7: Batch process
        all_results: List[GenerationResult] = []
        batch_size = self.config.batch_size

        for i in range(0, len(symbols_to_process), batch_size):
            if self.shutdown_event.is_set():
                break

            batch = symbols_to_process[i:i + batch_size]
            results = self.process_batch(batch)
            all_results.extend(results)

        # Phase 8: Print summary
        if self._progress:
            self._progress.print_summary()

        # Calculate statistics
        success_count = sum(1 for r in all_results if r.success)
        failed_count = len(all_results) - success_count

        return {
            "total_symbols": len(all_symbols),
            "processed": len(all_results),
            "skipped": len(all_symbols) - len(symbols_to_process),
            "success": success_count,
            "failed": failed_count,
            "orphaned_cleaned": orphaned,
        }
