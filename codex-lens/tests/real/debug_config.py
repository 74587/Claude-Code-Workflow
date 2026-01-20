#!/usr/bin/env python
"""Test if pyright sends workspace/configuration after initialized."""

import asyncio
import json
import sys
from pathlib import Path

# Add source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))


async def read_message_direct(reader):
    """Read a JSON-RPC message - direct blocking read, no timeout."""
    content_length = 0
    while True:
        line = await reader.readline()
        if not line:
            return None
        line_str = line.decode("ascii").strip()
        if not line_str:
            break
        if line_str.lower().startswith("content-length:"):
            content_length = int(line_str.split(":")[1].strip())

    if content_length == 0:
        return None

    body = await reader.readexactly(content_length)
    return json.loads(body.decode("utf-8"))


async def main():
    workspace = Path(__file__).parent.parent.parent
    print(f"Workspace: {workspace}")

    # Start pyright - exactly like in direct test
    process = await asyncio.create_subprocess_exec(
        "pyright-langserver", "--stdio",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(workspace),
    )

    def encode_message(content):
        body = json.dumps(content).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n"
        return header.encode("ascii") + body

    async def send(message):
        encoded = encode_message(message)
        process.stdin.write(encoded)
        await process.stdin.drain()
        method_or_resp = message.get('method') or f"response id={message.get('id')}"
        print(f"SENT: {method_or_resp} ({len(encoded)} bytes)")

    # Start stderr reader
    async def read_stderr():
        while True:
            line = await process.stderr.readline()
            if not line:
                break
            print(f"[stderr] {line.decode('utf-8', errors='replace').rstrip()}")
    asyncio.create_task(read_stderr())

    print("\n=== INITIALIZE ===")
    await send({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "processId": None,
            "rootUri": workspace.as_uri(),
            "rootPath": str(workspace),
            "capabilities": {
                "workspace": {"configuration": True},
            },
            "workspaceFolders": [{"uri": workspace.as_uri(), "name": workspace.name}],
        },
    })

    # Read until we get initialize response
    print("Reading initialize response...")
    while True:
        msg = await asyncio.wait_for(read_message_direct(process.stdout), timeout=10)
        if msg is None:
            break
        method = msg.get("method")
        msg_id = msg.get("id")
        if method:
            print(f"RECV: {method} (notification)")
        else:
            print(f"RECV: response id={msg_id}")
            if msg_id == 1:
                print("Initialize OK!")
                break

    print("\n=== SEND INITIALIZED ===")
    await send({
        "jsonrpc": "2.0",
        "method": "initialized",
        "params": {},
    })

    # Now, here's the key test - will we receive workspace/configuration?
    print("\n=== WAIT FOR workspace/configuration ===")
    print("Reading with 5 second timeout...")

    try:
        for i in range(10):
            msg = await asyncio.wait_for(read_message_direct(process.stdout), timeout=2)
            if msg is None:
                print("EOF")
                break
            method = msg.get("method")
            msg_id = msg.get("id")
            print(f"RECV: method={method}, id={msg_id}")

            # Respond to server requests
            if msg_id is not None and method:
                if method == "workspace/configuration":
                    print("  -> Got workspace/configuration! Responding...")
                    await send({
                        "jsonrpc": "2.0",
                        "id": msg_id,
                        "result": [{} for _ in msg.get("params", {}).get("items", [])],
                    })
                else:
                    print(f"  -> Responding to {method}")
                    await send({"jsonrpc": "2.0", "id": msg_id, "result": None})
    except asyncio.TimeoutError:
        print("No more messages (timeout)")

    print("\n=== Now start background read task like manager does ===")

    # Store references like manager does
    reader = process.stdout  # This is how manager does it
    writer = process.stdin

    # Start background read task
    async def bg_read_loop():
        print("[BG] Read loop started")
        try:
            while True:
                await asyncio.sleep(0)
                try:
                    msg = await asyncio.wait_for(read_message_direct(reader), timeout=1.0)
                    if msg is None:
                        print("[BG] Stream closed")
                        break
                    bg_method = msg.get('method') or f"response id={msg.get('id')}"
                    print(f"[BG] RECV: {bg_method}")

                    # Handle server requests
                    method = msg.get("method")
                    msg_id = msg.get("id")
                    if msg_id is not None and method:
                        print(f"[BG] Responding to {method}")
                        await send({"jsonrpc": "2.0", "id": msg_id, "result": None})
                except asyncio.TimeoutError:
                    print("[BG] timeout")
        except asyncio.CancelledError:
            print("[BG] Cancelled")

    read_task = asyncio.create_task(bg_read_loop())

    # Wait a moment
    await asyncio.sleep(0.5)

    # Now send didOpen and documentSymbol like manager does
    print("\n=== SEND didOpen ===")
    test_file = workspace / "tests" / "real" / "debug_config.py"
    await send({
        "jsonrpc": "2.0",
        "method": "textDocument/didOpen",
        "params": {
            "textDocument": {
                "uri": test_file.as_uri(),
                "languageId": "python",
                "version": 1,
                "text": test_file.read_text(),
            },
        },
    })

    # Wait for processing
    await asyncio.sleep(2)

    print("\n=== SEND documentSymbol ===")
    await send({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "textDocument/documentSymbol",
        "params": {"textDocument": {"uri": test_file.as_uri()}},
    })

    # Wait for response
    print("Waiting for documentSymbol response (max 30s)...")
    deadline = asyncio.get_event_loop().time() + 30
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(0.5)
        # The background task will print when it receives the response

    read_task.cancel()
    try:
        await read_task
    except asyncio.CancelledError:
        pass

    process.terminate()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
