"""Keep-alive wrapper for Standalone LSP servers in synchronous workflows.

The staged realtime pipeline calls into LSP from synchronous code paths.
Creating a fresh asyncio loop per query (via asyncio.run) forces language
servers to start/stop every time, which is slow and can trigger shutdown
timeouts on Windows.

This module runs an asyncio event loop in a background thread and keeps a
single LspBridge (and its StandaloneLspManager + subprocesses) alive across
multiple queries. Callers submit coroutines that operate on the shared bridge.
"""

from __future__ import annotations

import atexit
import asyncio
import threading
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional, TypeVar

from codexlens.lsp.lsp_bridge import LspBridge

T = TypeVar("T")


@dataclass(frozen=True)
class KeepAliveKey:
    workspace_root: str
    config_file: Optional[str]
    timeout: float


class KeepAliveLspBridge:
    """Runs a shared LspBridge on a dedicated event loop thread."""

    def __init__(self, *, workspace_root: str, config_file: Optional[str], timeout: float) -> None:
        self._key = KeepAliveKey(workspace_root=workspace_root, config_file=config_file, timeout=float(timeout))
        self._lock = threading.RLock()
        self._call_lock = threading.RLock()
        self._ready = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._bridge: Optional[LspBridge] = None
        self._stopped = False

        atexit.register(self.stop)

    @property
    def key(self) -> KeepAliveKey:
        return self._key

    def start(self) -> None:
        with self._lock:
            if self._stopped:
                raise RuntimeError("KeepAliveLspBridge is stopped")
            if self._thread is not None and self._thread.is_alive():
                return

            self._ready.clear()
            thread = threading.Thread(target=self._run, name="codexlens-lsp-keepalive", daemon=True)
            self._thread = thread
            thread.start()

        if not self._ready.wait(timeout=10.0):
            raise RuntimeError("Timed out starting LSP keep-alive loop")

    def stop(self) -> None:
        with self._lock:
            if self._stopped:
                return
            self._stopped = True
            loop = self._loop
            bridge = self._bridge
            thread = self._thread

        if loop is not None and bridge is not None:
            try:
                fut = asyncio.run_coroutine_threadsafe(bridge.close(), loop)
                fut.result(timeout=5.0)
            except Exception:
                pass
            try:
                loop.call_soon_threadsafe(loop.stop)
            except Exception:
                pass

        if thread is not None:
            try:
                thread.join(timeout=5.0)
            except Exception:
                pass

    def run(self, fn: Callable[[LspBridge], Awaitable[T]], *, timeout: Optional[float] = None) -> T:
        """Run an async function against the shared LspBridge and return its result."""
        self.start()
        loop = self._loop
        bridge = self._bridge
        if loop is None or bridge is None:
            raise RuntimeError("Keep-alive loop not initialized")

        async def _call() -> T:
            return await fn(bridge)

        # Serialize bridge usage to avoid overlapping LSP request storms.
        with self._call_lock:
            fut = asyncio.run_coroutine_threadsafe(_call(), loop)
            return fut.result(timeout=float(timeout or self._key.timeout) + 1.0)

    def _run(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        bridge = LspBridge(
            workspace_root=self._key.workspace_root,
            config_file=self._key.config_file,
            timeout=self._key.timeout,
        )

        with self._lock:
            self._loop = loop
            self._bridge = bridge
            self._ready.set()

        try:
            loop.run_forever()
        finally:
            try:
                if self._bridge is not None:
                    loop.run_until_complete(self._bridge.close())
            except Exception:
                pass
            try:
                loop.close()
            except Exception:
                pass

