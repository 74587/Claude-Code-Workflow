# CCW VSCode Bridge

This extension provides a bridge between the CCW MCP server and VSCode's live Language Server Protocol (LSP) features.

## Features

- Exposes VSCode LSP features via HTTP API on `http://127.0.0.1:3457`
- Supports:
  - Go to Definition
  - Find References
  - Hover Information
  - Document Symbols

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile the extension:
   ```bash
   npm run compile
   ```

3. Press F5 in VSCode to launch the extension in debug mode, or:
   - Run `vsce package` to create a VSIX file
   - Install the VSIX file in VSCode

## API Endpoints

All endpoints accept POST requests with JSON body:

### `/get_definition`
```json
{
  "file_path": "/absolute/path/to/file.ts",
  "line": 10,
  "character": 5
}
```

### `/get_references`
```json
{
  "file_path": "/absolute/path/to/file.ts",
  "line": 10,
  "character": 5
}
```

### `/get_hover`
```json
{
  "file_path": "/absolute/path/to/file.ts",
  "line": 10,
  "character": 5
}
```

### `/get_document_symbols`
```json
{
  "file_path": "/absolute/path/to/file.ts"
}
```

## Usage with CCW MCP

The CCW MCP server includes a `vscode_lsp` tool that communicates with this extension automatically.
