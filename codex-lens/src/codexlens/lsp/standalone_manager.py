"""Standalone Language Server Manager for direct LSP communication.

This module provides direct communication with language servers via JSON-RPC over stdio,
eliminating the need for VSCode Bridge. Similar to cclsp architecture.

Features:
- Direct subprocess spawning of language servers
- JSON-RPC 2.0 communication over stdin/stdout
- Multi-language support via configuration file (lsp-servers.json)
- Process lifecycle management with auto-restart
- Compatible interface with existing LspBridge
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse

logger = logging.getLogger(__name__)


@dataclass
class ServerConfig:
    """Configuration for a language server."""
    
    language_id: str
    display_name: str
    extensions: List[str]
    command: List[str]
    enabled: bool = True
    initialization_options: Dict[str, Any] = field(default_factory=dict)
    settings: Dict[str, Any] = field(default_factory=dict)
    root_dir: str = "."
    timeout: int = 30000  # ms
    restart_interval: int = 5000  # ms
    max_restarts: int = 3


@dataclass
class ServerState:
    """State of a running language server."""

    config: ServerConfig
    process: asyncio.subprocess.Process
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    request_id: int = 0
    initialized: bool = False
    capabilities: Dict[str, Any] = field(default_factory=dict)
    pending_requests: Dict[int, asyncio.Future] = field(default_factory=dict)
    restart_count: int = 0
    # Queue for producer-consumer pattern - continuous reading puts messages here
    message_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    # Track opened documents to avoid redundant didOpen spam (and unnecessary delays).
    # Key: document URI -> (version, file_mtime)
    opened_documents: Dict[str, Tuple[int, float]] = field(default_factory=dict)
    opened_documents_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class StandaloneLspManager:
    """Manager for direct language server communication.
    
    Spawns language servers as subprocesses and communicates via JSON-RPC
    over stdin/stdout. No VSCode or GUI dependency required.
    
    Example:
        manager = StandaloneLspManager(workspace_root="/path/to/project")
        await manager.start()
        
        definition = await manager.get_definition(
            file_path="src/main.py",
            line=10,
            character=5
        )
        
        await manager.stop()
    """
    
    DEFAULT_CONFIG_FILE = "lsp-servers.json"
    
    def __init__(
        self,
        workspace_root: Optional[str] = None,
        config_file: Optional[str] = None,
        timeout: float = 30.0,
    ):
        """Initialize StandaloneLspManager.
        
        Args:
            workspace_root: Root directory of the workspace (used for rootUri)
            config_file: Path to lsp-servers.json configuration file
            timeout: Default timeout for LSP requests in seconds
        """
        self.workspace_root = Path(workspace_root or os.getcwd()).resolve()
        self.config_file = config_file
        self.timeout = timeout
        
        self._servers: Dict[str, ServerState] = {}  # language_id -> ServerState
        self._extension_map: Dict[str, str] = {}  # extension -> language_id
        self._configs: Dict[str, ServerConfig] = {}  # language_id -> ServerConfig
        self._read_tasks: Dict[str, asyncio.Task] = {}  # language_id -> read task
        self._stderr_tasks: Dict[str, asyncio.Task] = {}  # language_id -> stderr read task
        self._processor_tasks: Dict[str, asyncio.Task] = {}  # language_id -> message processor task
        self._lock = asyncio.Lock()
        
    def _find_config_file(self) -> Optional[Path]:
        """Find the lsp-servers.json configuration file.
        
        Search order:
        1. Explicit config_file parameter
        2. {workspace_root}/lsp-servers.json
        3. {workspace_root}/.codexlens/lsp-servers.json
        4. Package default (codexlens/lsp-servers.json)
        """
        search_paths = []
        
        if self.config_file:
            search_paths.append(Path(self.config_file))
        
        search_paths.extend([
            self.workspace_root / self.DEFAULT_CONFIG_FILE,
            self.workspace_root / ".codexlens" / self.DEFAULT_CONFIG_FILE,
            Path(__file__).parent.parent.parent.parent / self.DEFAULT_CONFIG_FILE,  # package root
        ])
        
        for path in search_paths:
            if path.exists():
                return path
        
        return None
    
    def _load_config(self) -> None:
        """Load language server configuration from JSON file."""
        config_path = self._find_config_file()
        
        if not config_path:
            logger.warning(f"No {self.DEFAULT_CONFIG_FILE} found, using empty config")
            return
        
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config from {config_path}: {e}")
            return
        
        # Parse defaults
        defaults = data.get("defaults", {})
        default_timeout = defaults.get("timeout", 30000)
        default_restart_interval = defaults.get("restartInterval", 5000)
        default_max_restarts = defaults.get("maxRestarts", 3)
        
        # Parse servers
        for server_data in data.get("servers", []):
            if not server_data.get("enabled", True):
                continue
            
            language_id = server_data.get("languageId", "")
            if not language_id:
                continue
            
            config = ServerConfig(
                language_id=language_id,
                display_name=server_data.get("displayName", language_id),
                extensions=server_data.get("extensions", []),
                command=server_data.get("command", []),
                enabled=server_data.get("enabled", True),
                initialization_options=server_data.get("initializationOptions", {}),
                settings=server_data.get("settings", {}),
                root_dir=server_data.get("rootDir", defaults.get("rootDir", ".")),
                timeout=server_data.get("timeout", default_timeout),
                restart_interval=server_data.get("restartInterval", default_restart_interval),
                max_restarts=server_data.get("maxRestarts", default_max_restarts),
            )
            
            self._configs[language_id] = config
            
            # Build extension map
            for ext in config.extensions:
                self._extension_map[ext.lower()] = language_id
        
        logger.info(f"Loaded {len(self._configs)} language server configs from {config_path}")
    
    def get_language_id(self, file_path: str) -> Optional[str]:
        """Get language ID for a file based on extension.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Language ID (e.g., "python", "typescript") or None if unknown
        """
        ext = Path(file_path).suffix.lstrip(".").lower()
        return self._extension_map.get(ext)
    
    async def start(self) -> None:
        """Initialize the manager and load configuration.
        
        This does NOT start any language servers yet - they are started
        on-demand when first needed for a file type.
        """
        self._load_config()
        logger.info(f"StandaloneLspManager started for workspace: {self.workspace_root}")
    
    async def stop(self) -> None:
        """Stop all running language servers and cleanup."""
        async with self._lock:
            for language_id in list(self._servers.keys()):
                await self._stop_server(language_id)
        
        logger.info("StandaloneLspManager stopped")
    
    async def _start_server(self, language_id: str) -> Optional[ServerState]:
        """Start a language server for the given language.
        
        Args:
            language_id: The language ID (e.g., "python")
            
        Returns:
            ServerState if successful, None on failure
        """
        config = self._configs.get(language_id)
        if not config:
            logger.error(f"No configuration for language: {language_id}")
            return None
        
        if not config.command:
            logger.error(f"No command specified for {language_id}")
            return None
        
        try:
            logger.info(f"Starting {config.display_name}: {' '.join(config.command)}")
            
            # Spawn the language server process
            process = await asyncio.create_subprocess_exec(
                *config.command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.workspace_root),
            )
            
            if process.stdin is None or process.stdout is None:
                logger.error(f"Failed to get stdin/stdout for {language_id}")
                process.terminate()
                return None
            
            state = ServerState(
                config=config,
                process=process,
                reader=process.stdout,
                writer=process.stdin,
            )
            
            self._servers[language_id] = state

            # Start reading stderr in background (prevents pipe buffer from filling up)
            if process.stderr:
                self._stderr_tasks[language_id] = asyncio.create_task(
                    self._read_stderr(language_id, process.stderr)
                )

            # CRITICAL: Start the continuous reader task IMMEDIATELY before any communication
            # This ensures no messages are lost during initialization handshake
            self._read_tasks[language_id] = asyncio.create_task(
                self._continuous_reader(language_id)
            )

            # Start the message processor task to handle queued messages
            self._processor_tasks[language_id] = asyncio.create_task(self._process_messages(language_id))

            # Initialize the server - now uses queue for reading responses
            await self._initialize_server(state)

            logger.info(f"{config.display_name} started and initialized")
            return state
            
        except FileNotFoundError:
            logger.error(
                f"Language server not found: {config.command[0]}. "
                f"Install it with the appropriate package manager."
            )
            return None
        except Exception as e:
            logger.error(f"Failed to start {language_id}: {e}")
            return None
    
    async def _stop_server(self, language_id: str) -> None:
        """Stop a language server."""
        state = self._servers.pop(language_id, None)
        if not state:
            return

        # Cancel read task
        task = self._read_tasks.pop(language_id, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Cancel stderr task
        stderr_task = self._stderr_tasks.pop(language_id, None)
        if stderr_task:
            stderr_task.cancel()
            try:
                await stderr_task
            except asyncio.CancelledError:
                pass

        # Cancel message processor task
        processor_task = self._processor_tasks.pop(language_id, None)
        if processor_task:
            processor_task.cancel()
            try:
                await processor_task
            except asyncio.CancelledError:
                pass

        # Send shutdown request
        try:
            await self._send_request(state, "shutdown", None, timeout=5.0)
        except Exception:
            pass
        
        # Send exit notification
        try:
            await self._send_notification(state, "exit", None)
        except Exception:
            pass
        
        # Terminate process
        if state.process.returncode is None:
            state.process.terminate()
            try:
                await asyncio.wait_for(state.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                state.process.kill()
        
        logger.info(f"Stopped {state.config.display_name}")
    
    async def _get_server(self, file_path: str) -> Optional[ServerState]:
        """Get or start the appropriate language server for a file.
        
        Args:
            file_path: Path to the file being operated on
            
        Returns:
            ServerState for the appropriate language server, or None
        """
        file_path = self._normalize_file_path(file_path)
        language_id = self.get_language_id(file_path)
        if not language_id:
            logger.debug(f"No language server configured for: {file_path}")
            return None
        
        async with self._lock:
            if language_id in self._servers:
                state = self._servers[language_id]
                # Check if process is still running
                if state.process.returncode is None:
                    return state
                # Process died, remove it
                del self._servers[language_id]
            
            # Start new server
            return await self._start_server(language_id)

    def _normalize_file_path(self, file_path_or_uri: str) -> str:
        """Normalize a file path that may be an LSP file URI or URI-path.

        LSP responses often contain `file://` URIs with percent-encoding
        (e.g. `file:///d%3A/...`). Some code paths may forward the parsed
        URI path (`/d%3A/...`) without the scheme. On Windows, `Path(...)`
        would interpret that as a root path on the current drive, producing
        invalid paths like `D:\\d%3A\\...`.
        """
        if not file_path_or_uri:
            return file_path_or_uri

        raw = str(file_path_or_uri).strip()

        if raw.startswith("file:"):
            try:
                parsed = urlparse(raw)
                if parsed.scheme == "file":
                    raw = unquote(parsed.path)
                else:
                    raw = raw.replace("file:///", "").replace("file://", "")
            except Exception:
                raw = raw.replace("file:///", "").replace("file://", "")

        # Decode percent-encoded segments (e.g. d%3A -> d:)
        if "%3a" in raw.lower():
            try:
                raw = unquote(raw)
            except Exception:
                pass

        # Windows: file URI paths frequently look like "/C:/path"; strip the extra slash.
        if raw.startswith("/") and len(raw) > 2 and raw[2] == ":":
            raw = raw[1:]

        return raw
    
    async def _initialize_server(self, state: ServerState) -> None:
        """Send initialize request and wait for response via the message queue.

        The continuous reader and message processor are already running, so we just
        send the request and wait for the response via pending_requests.
        """
        root_uri = self.workspace_root.as_uri()

        # Simplified params matching direct test that works
        params = {
            "processId": None,  # Use None like direct test
            "rootUri": root_uri,
            "rootPath": str(self.workspace_root),
            "capabilities": {
                "textDocument": {
                    "documentSymbol": {
                        "hierarchicalDocumentSymbolSupport": True,
                    },
                },
                "workspace": {
                    "configuration": True,
                },
            },
            "workspaceFolders": [
                {
                    "uri": root_uri,
                    "name": self.workspace_root.name,
                }
            ],
        }

        # Send initialize request and wait for response via queue
        state.request_id += 1
        init_request_id = state.request_id

        # Create future for the response
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        state.pending_requests[init_request_id] = future

        # Send the request
        init_message = {
            "jsonrpc": "2.0",
            "id": init_request_id,
            "method": "initialize",
            "params": params,
        }
        encoded = self._encode_message(init_message)
        logger.debug(f"Sending initialize request id={init_request_id}")
        state.writer.write(encoded)
        await state.writer.drain()

        # Wait for response (will be routed by _process_messages)
        try:
            init_result = await asyncio.wait_for(future, timeout=30.0)
        except asyncio.TimeoutError:
            state.pending_requests.pop(init_request_id, None)
            raise RuntimeError("Initialize request timed out")

        if init_result is None:
            init_result = {}

        # Store capabilities
        state.capabilities = init_result.get("capabilities", {})
        state.initialized = True
        logger.debug(f"Initialize response received, capabilities: {len(state.capabilities)} keys")

        # Send initialized notification
        await self._send_notification(state, "initialized", {})

        # Give time for server to process initialized and send any requests
        # The message processor will handle workspace/configuration automatically
        await asyncio.sleep(0.5)
    
    def _encode_message(self, content: Dict[str, Any]) -> bytes:
        """Encode a JSON-RPC message with LSP headers."""
        body = json.dumps(content).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n"
        return header.encode("ascii") + body
    
    async def _read_message(self, reader: asyncio.StreamReader) -> Tuple[Optional[Dict[str, Any]], bool]:
        """Read a JSON-RPC message from the stream.

        Returns:
            Tuple of (message, stream_closed). If stream_closed is True, the reader loop
            should exit. If False and message is None, it was just a timeout.
        """
        try:
            # Read headers
            content_length = 0
            while True:
                try:
                    line = await asyncio.wait_for(reader.readline(), timeout=1.0)
                except asyncio.TimeoutError:
                    # Timeout is not an error - just no message available yet
                    return None, False

                if not line:
                    # Empty read means stream closed
                    return None, True

                line_str = line.decode("ascii").strip()
                if line_str:  # Only log non-empty lines
                    logger.debug(f"Read header line: {repr(line_str[:80])}")
                if not line_str:
                    break  # Empty line = end of headers

                if line_str.lower().startswith("content-length:"):
                    content_length = int(line_str.split(":")[1].strip())

            if content_length == 0:
                return None, False

            # Read body
            body = await reader.readexactly(content_length)
            return json.loads(body.decode("utf-8")), False

        except asyncio.IncompleteReadError:
            return None, True
        except Exception as e:
            logger.error(f"Error reading message: {e}")
            return None, True

    async def _continuous_reader(self, language_id: str) -> None:
        """Continuously read messages from language server and put them in the queue.

        This is the PRODUCER in the producer-consumer pattern. It starts IMMEDIATELY
        after subprocess creation and runs continuously until shutdown. This ensures
        no messages are ever lost, even during initialization handshake.
        """
        state = self._servers.get(language_id)
        if not state:
            return

        logger.debug(f"Continuous reader started for {language_id}")

        try:
            while True:
                try:
                    # Read headers with timeout
                    content_length = 0
                    while True:
                        try:
                            line = await asyncio.wait_for(state.reader.readline(), timeout=5.0)
                        except asyncio.TimeoutError:
                            continue  # Keep waiting for data

                        if not line:
                            logger.debug(f"Continuous reader for {language_id}: EOF")
                            return

                        line_str = line.decode("ascii").strip()
                        if not line_str:
                            break  # End of headers

                        if line_str.lower().startswith("content-length:"):
                            content_length = int(line_str.split(":")[1].strip())

                    if content_length == 0:
                        continue

                    # Read body
                    body = await state.reader.readexactly(content_length)
                    message = json.loads(body.decode("utf-8"))

                    # Put message in queue for processing
                    await state.message_queue.put(message)

                    msg_id = message.get("id", "none")
                    msg_method = message.get("method", "none")
                    logger.debug(f"Queued message: id={msg_id}, method={msg_method}")

                except asyncio.IncompleteReadError:
                    logger.debug(f"Continuous reader for {language_id}: IncompleteReadError")
                    return
                except Exception as e:
                    logger.error(f"Error in continuous reader for {language_id}: {e}")
                    await asyncio.sleep(0.1)

        except asyncio.CancelledError:
            logger.debug(f"Continuous reader cancelled for {language_id}")
        except Exception as e:
            logger.error(f"Fatal error in continuous reader for {language_id}: {e}")

    async def _process_messages(self, language_id: str) -> None:
        """Process messages from the queue and route them appropriately.

        This is the CONSUMER in the producer-consumer pattern. It handles:
        - Server requests (workspace/configuration, etc.) - responds immediately
        - Notifications (window/logMessage, etc.) - logs them
        - Responses to our requests are NOT handled here - they're consumed by _wait_for_response
        """
        state = self._servers.get(language_id)
        if not state:
            return

        logger.debug(f"Message processor started for {language_id}")

        try:
            while True:
                # Get message from queue (blocks until available)
                message = await state.message_queue.get()

                msg_id = message.get("id")
                method = message.get("method", "")

                # Response (has id but no method) - put back for _wait_for_response to consume
                if msg_id is not None and not method:
                    # This is a response to one of our requests
                    if msg_id in state.pending_requests:
                        future = state.pending_requests.pop(msg_id)
                        if "error" in message:
                            future.set_exception(
                                Exception(message["error"].get("message", "Unknown error"))
                            )
                        else:
                            future.set_result(message.get("result"))
                        logger.debug(f"Response routed to pending request id={msg_id}")
                    else:
                        logger.debug(f"No pending request for response id={msg_id}")

                # Server request (has both id and method) - needs response
                elif msg_id is not None and method:
                    logger.info(f"Server request: {method} (id={msg_id})")
                    await self._handle_server_request(state, message)

                # Notification (has method but no id)
                elif method:
                    self._handle_server_message(language_id, message)

                state.message_queue.task_done()

        except asyncio.CancelledError:
            logger.debug(f"Message processor cancelled for {language_id}")
        except Exception as e:
            logger.error(f"Error in message processor for {language_id}: {e}")
    
    async def _read_stderr(self, language_id: str, stderr: asyncio.StreamReader) -> None:
        """Background task to read stderr from a language server.

        This prevents the stderr pipe buffer from filling up, which would
        cause the language server process to block and stop responding.
        """
        try:
            while True:
                line = await stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").rstrip()
                if text:
                    # Log stderr output at warning level for visibility
                    logger.warning(f"[{language_id}] {text}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug(f"Error reading stderr for {language_id}: {e}")

    def _handle_server_message(self, language_id: str, message: Dict[str, Any]) -> None:
        """Handle notifications from the language server."""
        method = message.get("method", "")
        params = message.get("params", {})

        if method == "window/logMessage":
            level = params.get("type", 4)  # 1=error, 2=warn, 3=info, 4=log
            text = params.get("message", "")
            if level == 1:
                logger.error(f"[{language_id}] {text}")
            elif level == 2:
                logger.warning(f"[{language_id}] {text}")
            else:
                logger.debug(f"[{language_id}] {text}")

        elif method == "window/showMessage":
            text = params.get("message", "")
            logger.info(f"[{language_id}] {text}")

    async def _handle_server_request(self, state: ServerState, message: Dict[str, Any]) -> None:
        """Handle requests from the language server that need a response."""
        request_id = message["id"]
        method = message.get("method", "")
        params = message.get("params", {})

        logger.info(f"SERVER REQUEST: {method} (id={request_id}) params={params}")

        result = None

        if method == "workspace/configuration":
            # Return configuration items for each requested scope
            items = params.get("items", [])
            result = []
            for item in items:
                section = item.get("section", "")
                # Provide Python-specific settings for pyright
                if section == "python":
                    result.append({
                        "pythonPath": "python",
                        "analysis": {
                            "autoSearchPaths": True,
                            "useLibraryCodeForTypes": True,
                            "diagnosticMode": "workspace",
                        }
                    })
                elif section == "python.analysis":
                    result.append({
                        "autoSearchPaths": True,
                        "useLibraryCodeForTypes": True,
                        "diagnosticMode": "workspace",
                        "typeCheckingMode": "basic",
                    })
                else:
                    # Return empty object for unknown sections
                    result.append({})
            sections = [item.get("section", "") for item in items]
            logger.info(f"Responding to workspace/configuration with {len(result)} items for sections: {sections}")

        elif method == "client/registerCapability":
            # Accept capability registration
            result = None

        elif method == "window/workDoneProgress/create":
            # Accept progress token creation
            result = None

        else:
            logger.debug(f"Unhandled server request: {method}")

        # Send response
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result,
        }
        try:
            encoded = self._encode_message(response)
            state.writer.write(encoded)
            await state.writer.drain()
            logger.debug(f"Sent response to server request {method} (id={request_id})")
        except Exception as e:
            logger.error(f"Failed to respond to server request {method}: {e}")
    
    async def _send_request(
        self,
        state: ServerState,
        method: str,
        params: Optional[Dict[str, Any]],
        timeout: Optional[float] = None,
    ) -> Any:
        """Send a request to the language server and wait for response.
        
        Args:
            state: Server state
            method: LSP method name (e.g., "textDocument/definition")
            params: Request parameters
            timeout: Request timeout in seconds
            
        Returns:
            Response result
        """
        state.request_id += 1
        request_id = state.request_id
        
        message = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        }
        
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        state.pending_requests[request_id] = future

        try:
            encoded = self._encode_message(message)
            logger.debug(f"Sending request id={request_id}, method={method}")
            state.writer.write(encoded)
            await state.writer.drain()

            return await asyncio.wait_for(
                future,
                timeout=timeout or self.timeout
            )
        except asyncio.TimeoutError:
            state.pending_requests.pop(request_id, None)
            logger.warning(f"Request timed out: {method}")
            return None
        except Exception as e:
            state.pending_requests.pop(request_id, None)
            logger.error(f"Request failed: {method} - {e}")
            return None
    
    async def _send_notification(
        self,
        state: ServerState,
        method: str,
        params: Optional[Dict[str, Any]],
    ) -> None:
        """Send a notification to the language server (no response expected)."""
        message = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }

        try:
            encoded = self._encode_message(message)
            logger.debug(f"Sending notification: {method} ({len(encoded)} bytes)")
            state.writer.write(encoded)
            await state.writer.drain()
            logger.debug(f"Notification sent: {method}")
        except Exception as e:
            logger.error(f"Failed to send notification {method}: {e}")
    
    def _to_text_document_identifier(self, file_path: str) -> Dict[str, str]:
        """Create TextDocumentIdentifier from file path."""
        file_path = self._normalize_file_path(file_path)
        uri = Path(file_path).resolve().as_uri()
        return {"uri": uri}
    
    def _to_position(self, line: int, character: int) -> Dict[str, int]:
        """Create LSP Position (0-indexed) from 1-indexed line/character."""
        return {
            "line": max(0, line - 1),  # Convert 1-indexed to 0-indexed
            "character": max(0, character - 1),
        }
    
    async def _open_document(self, state: ServerState, file_path: str) -> None:
        """Send textDocument/didOpen notification."""
        file_path = self._normalize_file_path(file_path)
        resolved_path = Path(file_path).resolve()

        # Fast path: already opened and unchanged (per-server cache).
        try:
            uri = resolved_path.as_uri()
        except Exception:
            uri = ""

        try:
            file_mtime = float(resolved_path.stat().st_mtime)
        except Exception:
            file_mtime = 0.0

        # Serialize open/change notifications per server to avoid races when
        # multiple concurrent LSP requests target the same file.
        async with state.opened_documents_lock:
            existing = state.opened_documents.get(uri) if uri else None
            if existing is not None and existing[1] == file_mtime:
                return

            try:
                content = resolved_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.error(f"Failed to read file {file_path}: {e}")
                return

            # Detect language ID from extension
            language_id = self.get_language_id(file_path) or "plaintext"

            # Send didOpen only once per document; subsequent changes use didChange.
            if existing is None:
                version = 1
                logger.debug(f"Opening document: {resolved_path.name} ({len(content)} chars)")
                await self._send_notification(
                    state,
                    "textDocument/didOpen",
                    {
                        "textDocument": {
                            "uri": uri or resolved_path.as_uri(),
                            "languageId": language_id,
                            "version": version,
                            "text": content,
                        }
                    },
                )
            else:
                version = int(existing[0]) + 1
                logger.debug(f"Updating document: {resolved_path.name} ({len(content)} chars)")
                await self._send_notification(
                    state,
                    "textDocument/didChange",
                    {
                        "textDocument": {
                            "uri": uri or resolved_path.as_uri(),
                            "version": version,
                        },
                        "contentChanges": [{"text": content}],
                    },
                )

            if uri:
                state.opened_documents[uri] = (version, file_mtime)
    
    # ========== Public LSP Methods ==========
    
    async def get_definition(
        self,
        file_path: str,
        line: int,
        character: int,
    ) -> Optional[Dict[str, Any]]:
        """Get definition location for symbol at position.
        
        Args:
            file_path: Path to the source file
            line: Line number (1-indexed)
            character: Character position (1-indexed)
            
        Returns:
            Location dict with uri, line, character, or None
        """
        state = await self._get_server(file_path)
        if not state:
            return None
        
        # Open document first
        await self._open_document(state, file_path)
        
        result = await self._send_request(state, "textDocument/definition", {
            "textDocument": self._to_text_document_identifier(file_path),
            "position": self._to_position(line, character),
        })
        
        if not result:
            return None
        
        # Handle single location or array
        if isinstance(result, list):
            if len(result) == 0:
                return None
            result = result[0]
        
        # Handle LocationLink vs Location
        if "targetUri" in result:
            # LocationLink format
            return {
                "uri": result["targetUri"],
                "range": result.get("targetRange", result.get("targetSelectionRange", {})),
            }
        else:
            # Location format
            return result
    
    async def get_references(
        self,
        file_path: str,
        line: int,
        character: int,
        include_declaration: bool = True,
    ) -> List[Dict[str, Any]]:
        """Get all references to symbol at position.
        
        Args:
            file_path: Path to the source file
            line: Line number (1-indexed)
            character: Character position (1-indexed)
            include_declaration: Whether to include the declaration
            
        Returns:
            List of Location dicts with uri and range
        """
        state = await self._get_server(file_path)
        if not state:
            return []
        
        # Open document first
        await self._open_document(state, file_path)
        
        result = await self._send_request(state, "textDocument/references", {
            "textDocument": self._to_text_document_identifier(file_path),
            "position": self._to_position(line, character),
            "context": {
                "includeDeclaration": include_declaration,
            },
        })
        
        if not result or not isinstance(result, list):
            return []
        
        return result
    
    async def get_hover(
        self,
        file_path: str,
        line: int,
        character: int,
    ) -> Optional[str]:
        """Get hover documentation for symbol at position.
        
        Args:
            file_path: Path to the source file
            line: Line number (1-indexed)
            character: Character position (1-indexed)
            
        Returns:
            Hover content as string, or None
        """
        state = await self._get_server(file_path)
        if not state:
            return None
        
        # Open document first
        await self._open_document(state, file_path)
        
        result = await self._send_request(state, "textDocument/hover", {
            "textDocument": self._to_text_document_identifier(file_path),
            "position": self._to_position(line, character),
        })
        
        if not result:
            return None
        
        contents = result.get("contents")
        if not contents:
            return None
        
        # Parse contents (can be string, MarkedString, MarkupContent, or array)
        return self._parse_hover_contents(contents)
    
    def _parse_hover_contents(self, contents: Any) -> Optional[str]:
        """Parse hover contents into string."""
        if isinstance(contents, str):
            return contents
        
        if isinstance(contents, dict):
            # MarkupContent or MarkedString
            return contents.get("value", contents.get("contents", ""))
        
        if isinstance(contents, list):
            parts = []
            for item in contents:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    parts.append(item.get("value", ""))
            return "\n\n".join(p for p in parts if p)
        
        return None
    
    async def get_document_symbols(
        self,
        file_path: str,
    ) -> List[Dict[str, Any]]:
        """Get all symbols in a document.
        
        Args:
            file_path: Path to the source file
            
        Returns:
            List of DocumentSymbol or SymbolInformation dicts
        """
        state = await self._get_server(file_path)
        if not state:
            return []
        
        # Open document first
        await self._open_document(state, file_path)
        
        result = await self._send_request(state, "textDocument/documentSymbol", {
            "textDocument": self._to_text_document_identifier(file_path),
        })
        
        if not result or not isinstance(result, list):
            return []
        
        return result
    
    async def get_call_hierarchy_items(
        self,
        file_path: str,
        line: int,
        character: int,
        wait_for_analysis: float = 2.0,
    ) -> List[Dict[str, Any]]:
        """Prepare call hierarchy items for a position.

        Args:
            file_path: Path to the source file
            line: Line number (1-indexed)
            character: Character position (1-indexed)
            wait_for_analysis: Time to wait for server analysis (seconds)

        Returns:
            List of CallHierarchyItem dicts
        """
        state = await self._get_server(file_path)
        if not state:
            return []

        # Check if call hierarchy is supported
        if not state.capabilities.get("callHierarchyProvider"):
            return []

        # Open document first
        await self._open_document(state, file_path)

        # Wait for language server to complete analysis
        # This is critical for Pyright to return valid call hierarchy items
        if wait_for_analysis > 0:
            await asyncio.sleep(wait_for_analysis)

        result = await self._send_request(
            state,
            "textDocument/prepareCallHierarchy",
            {
                "textDocument": self._to_text_document_identifier(file_path),
                "position": self._to_position(line, character),
            },
        )

        if not result or not isinstance(result, list):
            return []

        return result
    
    async def get_incoming_calls(
        self,
        item: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Get incoming calls for a call hierarchy item.
        
        Args:
            item: CallHierarchyItem from get_call_hierarchy_items
            
        Returns:
            List of CallHierarchyIncomingCall dicts
        """
        # Determine language from item's uri
        uri = item.get("uri", "")
        file_path = self._normalize_file_path(uri)
        
        state = await self._get_server(file_path)
        if not state:
            return []
        
        result = await self._send_request(
            state,
            "callHierarchy/incomingCalls",
            {"item": item},
        )
        
        if not result or not isinstance(result, list):
            return []
        
        return result

    async def get_outgoing_calls(
        self,
        item: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Get outgoing calls for a call hierarchy item.

        Args:
            item: CallHierarchyItem from get_call_hierarchy_items

        Returns:
            List of CallHierarchyOutgoingCall dicts
        """
        # Determine language from item's uri
        uri = item.get("uri", "")
        file_path = self._normalize_file_path(uri)

        state = await self._get_server(file_path)
        if not state:
            return []

        result = await self._send_request(
            state,
            "callHierarchy/outgoingCalls",
            {"item": item},
        )

        if not result or not isinstance(result, list):
            return []

        return result

    async def __aenter__(self) -> "StandaloneLspManager":
        """Async context manager entry."""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit - stop all servers."""
        await self.stop()


# Simple test
if __name__ == "__main__":
    async def test_standalone_manager():
        """Test StandaloneLspManager functionality."""
        print("Testing StandaloneLspManager...")
        print()
        
        # Find a Python file to test with
        test_file = Path(__file__).resolve()
        print(f"Test file: {test_file}")
        print()
        
        async with StandaloneLspManager(
            workspace_root=str(test_file.parent.parent.parent.parent),  # codex-lens root
            timeout=30.0,
        ) as manager:
            print("1. Testing get_document_symbols...")
            symbols = await manager.get_document_symbols(str(test_file))
            print(f"   Found {len(symbols)} symbols")
            for sym in symbols[:5]:
                name = sym.get("name", "?")
                kind = sym.get("kind", "?")
                print(f"   - {name} (kind={kind})")
            print()
            
            print("2. Testing get_definition...")
            # Test definition for 'asyncio' import (line 11)
            definition = await manager.get_definition(str(test_file), 11, 8)
            if definition:
                print(f"   Definition: {definition}")
            else:
                print("   No definition found")
            print()
            
            print("3. Testing get_hover...")
            hover = await manager.get_hover(str(test_file), 11, 8)
            if hover:
                print(f"   Hover: {hover[:200]}...")
            else:
                print("   No hover info")
            print()
            
            print("4. Testing get_references...")
            refs = await manager.get_references(str(test_file), 50, 10)
            print(f"   Found {len(refs)} references")
            for ref in refs[:3]:
                print(f"   - {ref}")
        
        print()
        print("Test complete!")

    # Run the test
    # Note: On Windows, use default ProactorEventLoop (supports subprocess creation)

    asyncio.run(test_standalone_manager())
