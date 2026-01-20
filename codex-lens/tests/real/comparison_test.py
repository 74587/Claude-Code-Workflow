#!/usr/bin/env python
"""Direct comparison: standalone manager vs direct subprocess."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

async def test_direct():
    """Direct subprocess test that WORKS."""
    print("\n=== DIRECT SUBPROCESS TEST ===")
    
    process = await asyncio.create_subprocess_exec(
        'pyright-langserver', '--stdio',
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(Path(__file__).parent.parent.parent),
    )

    def encode(msg):
        body = json.dumps(msg).encode('utf-8')
        header = f'Content-Length: {len(body)}\r\n\r\n'.encode('ascii')
        return header + body

    async def read_message(timeout=5.0):
        content_length = 0
        while True:
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=timeout)
            except asyncio.TimeoutError:
                return None
            if not line:
                return None
            line_str = line.decode('ascii').strip()
            if not line_str:
                break
            if line_str.lower().startswith('content-length:'):
                content_length = int(line_str.split(':')[1].strip())
        if content_length == 0:
            return None
        body = await process.stdout.readexactly(content_length)
        return json.loads(body.decode('utf-8'))

    # Initialize
    init = {
        'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
        'params': {
            'processId': 12345,
            'rootUri': 'file:///D:/Claude_dms3/codex-lens',
            'rootPath': 'D:/Claude_dms3/codex-lens',
            'capabilities': {
                'textDocument': {
                    'synchronization': {'dynamicRegistration': False},
                    'documentSymbol': {'hierarchicalDocumentSymbolSupport': True},
                },
                'workspace': {'configuration': True, 'workspaceFolders': True},
            },
            'workspaceFolders': [{'uri': 'file:///D:/Claude_dms3/codex-lens', 'name': 'codex-lens'}],
            'initializationOptions': {},
        }
    }
    process.stdin.write(encode(init))
    await process.stdin.drain()

    while True:
        msg = await read_message(5.0)
        if msg is None or msg.get('id') == 1:
            print(f"  Got initialize response")
            break

    # Initialized
    process.stdin.write(encode({'jsonrpc': '2.0', 'method': 'initialized', 'params': {}}))
    await process.stdin.drain()
    print("  Sent initialized")

    # didOpen with simple content
    did_open = {
        'jsonrpc': '2.0', 'method': 'textDocument/didOpen',
        'params': {
            'textDocument': {
                'uri': 'file:///D:/Claude_dms3/codex-lens/simple.py',
                'languageId': 'python',
                'version': 1,
                'text': 'def hello():\n    pass\n'
            }
        }
    }
    process.stdin.write(encode(did_open))
    await process.stdin.drain()
    print("  Sent didOpen")

    # Read and respond to configuration requests
    print("  Waiting for messages...")
    for i in range(15):
        msg = await read_message(2.0)
        if msg is None:
            continue
        method = msg.get('method')
        print(f"    RECV: id={msg.get('id')}, method={method}")
        if method == 'workspace/configuration':
            process.stdin.write(encode({'jsonrpc': '2.0', 'id': msg['id'], 'result': [{}]}))
            await process.stdin.drain()
        if method == 'textDocument/publishDiagnostics':
            break

    # documentSymbol
    doc_sym = {
        'jsonrpc': '2.0', 'id': 2, 'method': 'textDocument/documentSymbol',
        'params': {'textDocument': {'uri': 'file:///D:/Claude_dms3/codex-lens/simple.py'}}
    }
    process.stdin.write(encode(doc_sym))
    await process.stdin.drain()
    print("  Sent documentSymbol")

    for i in range(5):
        msg = await read_message(3.0)
        if msg is None:
            continue
        if msg.get('id') == 2:
            result = msg.get('result', [])
            print(f"  GOT {len(result)} SYMBOLS!")
            break

    process.terminate()
    await process.wait()


async def test_manager():
    """Standalone manager test that FAILS."""
    print("\n=== STANDALONE MANAGER TEST ===")
    
    from codexlens.lsp.standalone_manager import StandaloneLspManager

    workspace = Path(__file__).parent.parent.parent
    manager = StandaloneLspManager(
        workspace_root=str(workspace),
        timeout=30.0
    )

    await manager.start()

    simple_file = workspace / "simple.py"
    simple_file.write_text('def hello():\n    pass\n')

    try:
        symbols = await manager.get_document_symbols(str(simple_file))
        print(f"  GOT {len(symbols)} SYMBOLS!")
    finally:
        simple_file.unlink(missing_ok=True)
        await manager.stop()


async def main():
    await test_direct()
    await test_manager()


if __name__ == "__main__":
    asyncio.run(main())
