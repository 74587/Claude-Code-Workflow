# MCP Server Quick Start

This is a quick reference for using CCW as an MCP server with Claude Desktop.

## Quick Setup

1. Ensure CCW is installed:
```bash
npm install -g ccw
```

2. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "ccw-tools": {
      "command": "ccw-mcp",
      "args": []
    }
  }
}
```

3. Restart Claude Desktop

## Available Tools

Once configured, Claude Desktop can use these CCW tools:

- **File Operations**: `edit_file`, `write_file`
- **Code Analysis**: `codex_lens`, `smart_search`, `get_modules_by_depth`, `classify_folders`
- **Git Integration**: `detect_changed_modules`
- **Session Management**: `session_manager`
- **UI/Design**: `discover_design_files`, `ui_generate_preview`, `convert_tokens_to_css`
- **Documentation**: `generate_module_docs`, `update_module_claude`

## Example Usage in Claude Desktop

```
"Use edit_file to update the version in package.json"

"Use codex_lens to analyze the authentication flow"

"Use get_modules_by_depth to show me the project structure"
```

## Full Documentation

See [MCP_SERVER.md](./MCP_SERVER.md) for complete documentation including:
- Detailed tool descriptions
- Configuration options
- Troubleshooting guide
- Development guidelines

## Testing

Run MCP server tests:
```bash
npm run test:mcp
```
