#!/usr/bin/env python
"""Compare manager read behavior vs direct read."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from codexlens.lsp.standalone_manager import StandaloneLspManager


async def direct_test():
    """Direct communication - this works."""
    workspace = Path(__file__).parent.parent.parent
    print("\n=== DIRECT TEST ===")

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
        msg_desc = message.get('method') or f"response id={message.get('id')}"
        print(f"  SENT: {msg_desc}")

    async def read_one():
        content_length = 0
        while True:
            line = await asyncio.wait_for(process.stdout.readline(), timeout=3.0)
            if not line:
                return None
            line_str = line.decode("ascii").strip()
            if not line_str:
                break
            if line_str.lower().startswith("content-length:"):
                content_length = int(line_str.split(":")[1].strip())
        if content_length == 0:
            return None
        body = await process.stdout.readexactly(content_length)
        return json.loads(body.decode("utf-8"))

    # Initialize
    print("  Sending initialize...")
    await send({
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {
            "processId": None,
            "rootUri": workspace.as_uri(),
            "capabilities": {"workspace": {"configuration": True}},
            "workspaceFolders": [{"uri": workspace.as_uri(), "name": workspace.name}],
        },
    })

    # Read until response
    while True:
        msg = await read_one()
        if msg and msg.get("id") == 1:
            print(f"  Initialize response OK")
            break
        elif msg:
            print(f"  Notification: {msg.get('method')}")

    # Send initialized
    print("  Sending initialized...")
    await send({"jsonrpc": "2.0", "method": "initialized", "params": {}})

    # Check for workspace/configuration
    print("  Checking for workspace/configuration (3s timeout)...")
    try:
        for i in range(10):
            msg = await read_one()
            if msg:
                method = msg.get("method")
                msg_id = msg.get("id")
                print(f"  RECV: {method or 'response'} (id={msg_id})")
                if method == "workspace/configuration":
                    print("  SUCCESS: workspace/configuration received!")
                    break
    except asyncio.TimeoutError:
        print("  TIMEOUT: No more messages")

    process.terminate()
    await process.wait()


async def manager_test():
    """Manager communication - investigating why this doesn't work."""
    workspace = Path(__file__).parent.parent.parent
    print("\n=== MANAGER TEST ===")

    manager = StandaloneLspManager(
        workspace_root=str(workspace),
        timeout=60.0
    )
    await manager.start()

    # Just check if server initialized
    state = manager._servers.get("python")
    if state:
        print(f"  Server initialized: {state.initialized}")
        print(f"  Capabilities: {len(state.capabilities)} keys")
    else:
        # Force initialization by getting server for a Python file
        print("  Getting server for Python file...")
        test_file = workspace / "tests" / "real" / "debug_compare.py"
        state = await manager._get_server(str(test_file))
        if state:
            print(f"  Server initialized: {state.initialized}")

    # Try to read directly from state.reader
    if state:
        print("\n  Direct read test from state.reader:")
        print(f"  state.reader is: {type(state.reader)}")
        print(f"  state.reader at_eof: {state.reader.at_eof()}")

        # Check if there's data available
        try:
            line = await asyncio.wait_for(state.reader.readline(), timeout=1.0)
            if line:
                print(f"  Got line: {line[:50]}...")
            else:
                print(f"  readline returned empty (EOF)")
        except asyncio.TimeoutError:
            print(f"  readline timed out (no data)")

    await manager.stop()


async def main():
    await direct_test()
    await manager_test()
    print("\n=== DONE ===")


if __name__ == "__main__":
    asyncio.run(main())
