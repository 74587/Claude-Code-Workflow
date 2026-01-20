#!/usr/bin/env python
"""Direct test of pyright-langserver communication."""

import asyncio
import json
import sys

async def test_pyright():
    print("Starting pyright-langserver...")
    
    process = await asyncio.create_subprocess_exec(
        "pyright-langserver", "--stdio",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    # Build initialize request
    init_msg = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "processId": 1234,
            "rootUri": "file:///D:/Claude_dms3/codex-lens",
            "rootPath": "D:/Claude_dms3/codex-lens",
            "capabilities": {
                "textDocument": {
                    "documentSymbol": {"hierarchicalDocumentSymbolSupport": True}
                },
                "workspace": {"configuration": True}
            },
            "workspaceFolders": [
                {"uri": "file:///D:/Claude_dms3/codex-lens", "name": "codex-lens"}
            ]
        }
    }
    
    body = json.dumps(init_msg).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    
    print(f"Sending initialize request ({len(body)} bytes)...")
    process.stdin.write(header + body)
    await process.stdin.drain()
    
    # Read responses
    print("Reading responses...")
    for i in range(20):
        try:
            line = await asyncio.wait_for(process.stdout.readline(), timeout=2.0)
            if not line:
                print("  (empty line - stream closed)")
                break
            line_str = line.decode("ascii").strip()
            print(f"  Header: {line_str}")
            
            if line_str.lower().startswith("content-length:"):
                content_length = int(line_str.split(":")[1].strip())
                # Read empty line
                await process.stdout.readline()
                # Read body
                body_data = await process.stdout.readexactly(content_length)
                msg = json.loads(body_data.decode("utf-8"))
                print(f"  Message: id={msg.get('id', 'none')}, method={msg.get('method', 'none')}")
                if msg.get("id") == 1:
                    print(f"  >>> GOT INITIALIZE RESPONSE!")
                    print(f"  >>> Capabilities: {list(msg.get('result', {}).get('capabilities', {}).keys())[:10]}...")
                    
                    # Send initialized notification
                    print("\nSending 'initialized' notification...")
                    init_notif = {"jsonrpc": "2.0", "method": "initialized", "params": {}}
                    body2 = json.dumps(init_notif).encode("utf-8")
                    header2 = f"Content-Length: {len(body2)}\r\n\r\n".encode("ascii")
                    process.stdin.write(header2 + body2)
                    await process.stdin.drain()
                    
                    # Wait a moment for any server requests
                    print("Waiting for server requests...")
                    await asyncio.sleep(1.0)
                    continue  # Keep reading to see if workspace/configuration comes
                if msg.get("method") == "workspace/configuration":
                    print(f"  >>> GOT workspace/configuration REQUEST!")
                    print(f"  >>> Params: {msg.get('params')}")
        except asyncio.TimeoutError:
            print("  (timeout waiting for more data)")
            break
    
    process.terminate()
    await process.wait()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(test_pyright())
