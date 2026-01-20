#!/usr/bin/env python
"""Debug exactly what's happening with reads after initialized."""

import asyncio
import json
from pathlib import Path


async def main():
    workspace = Path(__file__).parent.parent.parent
    print(f"Workspace: {workspace}")

    # Start pyright
    process = await asyncio.create_subprocess_exec(
        "pyright-langserver", "--stdio",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(workspace),
    )

    # Helper to encode message
    def encode(content):
        body = json.dumps(content).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n"
        return header.encode("ascii") + body

    # Helper to send
    async def send(msg):
        encoded = encode(msg)
        process.stdin.write(encoded)
        await process.stdin.drain()
        method = msg.get("method") or f"response-{msg.get('id')}"
        print(f"SENT: {method}")

    # Helper to read one message
    async def read_one(timeout=3.0):
        content_length = 0
        while True:
            try:
                print(f"  readline(timeout={timeout})...")
                line = await asyncio.wait_for(process.stdout.readline(), timeout=timeout)
                print(f"  got line: {repr(line[:50] if len(line) > 50 else line)}")
            except asyncio.TimeoutError:
                print(f"  TIMEOUT on readline")
                return None

            if not line:
                print(f"  EOF")
                return None

            line_str = line.decode("ascii").strip()
            if not line_str:
                break  # End of headers

            if line_str.lower().startswith("content-length:"):
                content_length = int(line_str.split(":")[1].strip())

        if content_length == 0:
            return None

        body = await process.stdout.readexactly(content_length)
        return json.loads(body.decode("utf-8"))

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
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {
            "processId": None,
            "rootUri": workspace.as_uri(),
            "capabilities": {"workspace": {"configuration": True}},
            "workspaceFolders": [{"uri": workspace.as_uri(), "name": workspace.name}],
        },
    })

    # Read until initialize response
    print("\n=== READING UNTIL INITIALIZE RESPONSE ===")
    while True:
        msg = await read_one()
        if msg and msg.get("id") == 1 and "method" not in msg:
            print(f"Got initialize response")
            break
        elif msg:
            print(f"Got notification: {msg.get('method')}")

    print("\n=== SEND INITIALIZED ===")
    await send({"jsonrpc": "2.0", "method": "initialized", "params": {}})

    print("\n=== NOW TRY TO READ WORKSPACE/CONFIGURATION ===")
    print("Attempting reads with 2s timeout each...")

    for i in range(3):
        print(f"\n--- Read attempt {i+1} ---")
        msg = await read_one(timeout=2.0)
        if msg:
            method = msg.get("method", "")
            msg_id = msg.get("id")
            print(f"SUCCESS: method={method}, id={msg_id}")
            if method and msg_id is not None:
                # Respond to server request
                print(f"Responding to {method}")
                await send({"jsonrpc": "2.0", "id": msg_id, "result": [{}]})
        else:
            print(f"No message (timeout or EOF)")
            break

    print("\n=== CLEANUP ===")
    process.terminate()
    await process.wait()
    print("Done")


if __name__ == "__main__":
    asyncio.run(main())
