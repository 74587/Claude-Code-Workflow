"""Test to see raw LSP response."""

import asyncio
import json
import logging
from pathlib import Path

# Patch the _process_messages to log the full response
async def patched_process_messages(self, language_id: str):
    """Patched version that logs full response."""
    from codexlens.lsp.standalone_manager import logger

    state = self._servers.get(language_id)
    if not state:
        return

    try:
        while True:
            message = await state.message_queue.get()
            msg_id = message.get("id")
            method = message.get("method", "")

            # Log FULL message for debugging
            if msg_id is not None and not method:
                print(f"\n>>> FULL RESPONSE (id={msg_id}):")
                print(json.dumps(message, indent=2))

            # Response handling
            if msg_id is not None and not method:
                if msg_id in state.pending_requests:
                    future = state.pending_requests.pop(msg_id)
                    if "error" in message:
                        print(f">>> ERROR in response: {message['error']}")
                        future.set_exception(
                            Exception(message["error"].get("message", "Unknown error"))
                        )
                    else:
                        print(f">>> Result: {message.get('result')}")
                        future.set_result(message.get("result"))
                else:
                    print(f">>> No pending request for id={msg_id}")

            elif msg_id is not None and method:
                await self._handle_server_request(state, message)

            elif method:
                pass  # Skip notifications

            state.message_queue.task_done()

    except asyncio.CancelledError:
        pass

async def test_raw():
    from codexlens.lsp.standalone_manager import StandaloneLspManager

    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = workspace_root / "test_simple_function.py"

    manager = StandaloneLspManager(workspace_root=str(workspace_root), timeout=30.0)

    # Monkey-patch the method
    import types
    manager._process_messages = types.MethodType(patched_process_messages, manager)

    try:
        print("Starting LSP...")
        await manager.start()

        state = await manager._get_server(str(test_file))
        await manager._open_document(state, str(test_file))
        await asyncio.sleep(2)

        print("\nSending prepareCallHierarchy request...")
        uri = test_file.resolve().as_uri()
        params = {
            "textDocument": {"uri": uri},
            "position": {"line": 11, "character": 4}
        }

        # Need to restart the message processor with our patched version
        # Actually, the original is already running. Let's just send and see logs.

        result = await manager._send_request(
            state,
            "textDocument/prepareCallHierarchy",
            params
        )

        print(f"\nFinal result: {result}")

    finally:
        await manager.stop()

if __name__ == "__main__":
    asyncio.run(test_raw())
