#!/usr/bin/env python
"""Minimal direct test of pyright LSP communication."""

import asyncio
import json
import sys
from pathlib import Path


async def send_message(writer, message):
    """Send a JSON-RPC message."""
    body = json.dumps(message).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    writer.write(header + body)
    await writer.drain()
    print(f"SENT: {message.get('method', 'response')} (id={message.get('id', 'N/A')})")


async def read_message(reader):
    """Read a JSON-RPC message."""
    # Read headers
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

    # Read body
    body = await reader.readexactly(content_length)
    return json.loads(body.decode("utf-8"))


async def main():
    workspace = Path(__file__).parent.parent.parent
    test_file = workspace / "tests" / "real" / "debug_direct.py"

    print(f"Workspace: {workspace}")
    print(f"Test file: {test_file}")
    print()

    # Start pyright
    print("Starting pyright-langserver...")
    process = await asyncio.create_subprocess_exec(
        "pyright-langserver", "--stdio",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(workspace),
    )

    # Start stderr reader
    async def read_stderr():
        while True:
            line = await process.stderr.readline()
            if not line:
                break
            print(f"[stderr] {line.decode('utf-8', errors='replace').rstrip()}")

    stderr_task = asyncio.create_task(read_stderr())

    try:
        # 1. Send initialize
        print("\n=== INITIALIZE ===")
        await send_message(process.stdin, {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "processId": None,
                "rootUri": workspace.as_uri(),
                "rootPath": str(workspace),
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
                "workspaceFolders": [{"uri": workspace.as_uri(), "name": workspace.name}],
            },
        })

        # Read all messages until we get initialize response
        print("\n=== READING RESPONSES ===")
        init_done = False
        for i in range(20):
            try:
                msg = await asyncio.wait_for(read_message(process.stdout), timeout=5.0)
                if msg is None:
                    print("EOF")
                    break

                method = msg.get("method", "")
                msg_id = msg.get("id", "N/A")

                if method:
                    print(f"RECV: {method} (id={msg_id})")

                    # Handle server requests
                    if msg_id != "N/A":
                        if method == "workspace/configuration":
                            print("  -> Responding to workspace/configuration")
                            items = msg.get("params", {}).get("items", [])
                            await send_message(process.stdin, {
                                "jsonrpc": "2.0",
                                "id": msg_id,
                                "result": [{"pythonPath": "python"} for _ in items],
                            })
                        elif method == "client/registerCapability":
                            print("  -> Responding to client/registerCapability")
                            await send_message(process.stdin, {
                                "jsonrpc": "2.0",
                                "id": msg_id,
                                "result": None,
                            })
                        elif method == "window/workDoneProgress/create":
                            print("  -> Responding to window/workDoneProgress/create")
                            await send_message(process.stdin, {
                                "jsonrpc": "2.0",
                                "id": msg_id,
                                "result": None,
                            })
                else:
                    print(f"RECV: response (id={msg_id})")
                    if msg_id == 1:
                        print("  -> Initialize response received!")
                        caps = list(msg.get("result", {}).get("capabilities", {}).keys())
                        print(f"  -> Capabilities: {caps[:5]}...")
                        init_done = True
                        break

            except asyncio.TimeoutError:
                print(f"  Timeout waiting for message {i+1}")
                break

        if not init_done:
            print("ERROR: Initialize failed")
            return

        # 2. Send initialized notification
        print("\n=== INITIALIZED ===")
        await send_message(process.stdin, {
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {},
        })

        # Read any messages pyright sends after initialized
        print("\n=== READING POST-INITIALIZED MESSAGES ===")
        for i in range(10):
            try:
                msg = await asyncio.wait_for(read_message(process.stdout), timeout=2.0)
                if msg is None:
                    break

                method = msg.get("method", "")
                msg_id = msg.get("id", "N/A")

                print(f"RECV: {method or 'response'} (id={msg_id})")

                # Handle server requests
                if msg_id != "N/A" and method:
                    if method == "workspace/configuration":
                        print("  -> Responding to workspace/configuration")
                        items = msg.get("params", {}).get("items", [])
                        await send_message(process.stdin, {
                            "jsonrpc": "2.0",
                            "id": msg_id,
                            "result": [{"pythonPath": "python"} for _ in items],
                        })
                    elif method == "client/registerCapability":
                        print("  -> Responding to client/registerCapability")
                        await send_message(process.stdin, {
                            "jsonrpc": "2.0",
                            "id": msg_id,
                            "result": None,
                        })
                    elif method == "window/workDoneProgress/create":
                        print("  -> Responding to window/workDoneProgress/create")
                        await send_message(process.stdin, {
                            "jsonrpc": "2.0",
                            "id": msg_id,
                            "result": None,
                        })

            except asyncio.TimeoutError:
                print(f"  No more messages (timeout)")
                break

        # 3. Send didOpen
        print("\n=== DIDOPEN ===")
        content = test_file.read_text(encoding="utf-8")
        await send_message(process.stdin, {
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": test_file.as_uri(),
                    "languageId": "python",
                    "version": 1,
                    "text": content,
                },
            },
        })

        # Read any messages
        print("\n=== READING POST-DIDOPEN MESSAGES ===")
        for i in range(10):
            try:
                msg = await asyncio.wait_for(read_message(process.stdout), timeout=2.0)
                if msg is None:
                    break

                method = msg.get("method", "")
                msg_id = msg.get("id", "N/A")

                print(f"RECV: {method or 'response'} (id={msg_id})")

                # Handle server requests
                if msg_id != "N/A" and method:
                    if method == "workspace/configuration":
                        print("  -> Responding to workspace/configuration")
                        items = msg.get("params", {}).get("items", [])
                        await send_message(process.stdin, {
                            "jsonrpc": "2.0",
                            "id": msg_id,
                            "result": [{"pythonPath": "python"} for _ in items],
                        })
                    else:
                        print(f"  -> Responding with null to {method}")
                        await send_message(process.stdin, {
                            "jsonrpc": "2.0",
                            "id": msg_id,
                            "result": None,
                        })

            except asyncio.TimeoutError:
                print(f"  No more messages (timeout)")
                break

        # 4. Send documentSymbol request
        print("\n=== DOCUMENTSYMBOL ===")
        await send_message(process.stdin, {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "textDocument/documentSymbol",
            "params": {
                "textDocument": {"uri": test_file.as_uri()},
            },
        })

        # Wait for response
        print("\n=== READING DOCUMENTSYMBOL RESPONSE ===")
        for i in range(20):
            try:
                msg = await asyncio.wait_for(read_message(process.stdout), timeout=5.0)
                if msg is None:
                    break

                method = msg.get("method", "")
                msg_id = msg.get("id", "N/A")

                if method:
                    print(f"RECV: {method} (id={msg_id})")

                    # Handle server requests
                    if msg_id != "N/A":
                        if method == "workspace/configuration":
                            print("  -> Responding to workspace/configuration")
                            items = msg.get("params", {}).get("items", [])
                            await send_message(process.stdin, {
                                "jsonrpc": "2.0",
                                "id": msg_id,
                                "result": [{"pythonPath": "python"} for _ in items],
                            })
                        else:
                            print(f"  -> Responding with null to {method}")
                            await send_message(process.stdin, {
                                "jsonrpc": "2.0",
                                "id": msg_id,
                                "result": None,
                            })
                else:
                    print(f"RECV: response (id={msg_id})")
                    if msg_id == 2:
                        result = msg.get("result", [])
                        print(f"  -> DocumentSymbol response: {len(result)} symbols")
                        for sym in result[:5]:
                            print(f"     - {sym.get('name')} ({sym.get('kind')})")
                        break

            except asyncio.TimeoutError:
                print(f"  Timeout {i+1}")
                if i >= 5:
                    break

        print("\n=== DONE ===")

    finally:
        stderr_task.cancel()
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            process.kill()


if __name__ == "__main__":
    asyncio.run(main())
