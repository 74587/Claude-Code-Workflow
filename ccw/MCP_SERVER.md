# CCW MCP Server

The CCW MCP Server exposes CCW tools through the Model Context Protocol, allowing Claude Desktop and other MCP clients to access CCW functionality.

## Installation

1. Install CCW globally or link it locally:
```bash
npm install -g ccw
# or
npm link
```

2. The MCP server executable is available as `ccw-mcp`.

## Configuration

### Claude Desktop Configuration

Add this to your Claude Desktop MCP settings file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

If CCW is not installed globally, use the full path:

```json
{
  "mcpServers": {
    "ccw-tools": {
      "command": "node",
      "args": ["/full/path/to/ccw/bin/ccw-mcp.js"]
    }
  }
}
```

### Restart Claude Desktop

After updating the configuration, restart Claude Desktop for the changes to take effect.

## Available Tools

The MCP server exposes the following CCW tools:

### File Operations
- **edit_file** - Edit files with update or line mode
- **write_file** - Create or overwrite files

### Code Analysis
- **codex_lens** - Analyze code execution flow
- **get_modules_by_depth** - Get module hierarchy by depth
- **classify_folders** - Classify project folders
- **detect_changed_modules** - Detect modules with git changes
- **smart_search** - Intelligent code search

### Session Management
- **session_manager** - Manage workflow sessions

### UI/Design Tools
- **discover_design_files** - Find design-related files
- **ui_generate_preview** - Generate UI previews
- **ui_instantiate_prototypes** - Create UI prototypes
- **convert_tokens_to_css** - Convert design tokens to CSS

### Documentation
- **generate_module_docs** - Generate module documentation
- **update_module_claude** - Update CLAUDE.md files

### CLI Execution
- **cli_executor** - Execute CLI commands through CCW

## Usage in Claude Desktop

Once configured, you can use CCW tools directly in Claude Desktop conversations:

```
Can you use edit_file to update the header in README.md?

Use codex_lens to analyze the authentication flow in src/auth/login.js

Get the module structure with get_modules_by_depth
```

## Testing the Server

You can test the MCP server is working by checking the logs in Claude Desktop:

1. Open Claude Desktop
2. Check Developer Tools (Help → Developer Tools)
3. Look for `ccw-tools v6.1.4 started` message
4. Check Console for any errors

## Troubleshooting

### Server not starting
- Verify `ccw-mcp` is in your PATH or use full path in config
- Check Node.js version (requires >= 16.0.0)
- Look for errors in Claude Desktop Developer Tools

### Tools not appearing
- Restart Claude Desktop after configuration changes
- Verify JSON syntax in configuration file
- Check server logs for initialization errors

### Tool execution errors
- Ensure you have proper file permissions
- Check tool parameters match expected schema
- Review error messages in tool responses

## Development

To modify or extend the MCP server:

1. Edit `ccw/src/mcp-server/index.js` for server logic
2. Add/modify tools in `ccw/src/tools/`
3. Register new tools in `ccw/src/tools/index.js`
4. Restart the server (restart Claude Desktop)

## Architecture

The MCP server follows this structure:

```
ccw/
├── bin/
│   └── ccw-mcp.js          # Executable entry point
├── src/
│   ├── mcp-server/
│   │   └── index.js        # MCP server implementation
│   └── tools/
│       ├── index.js        # Tool registry
│       ├── edit-file.js    # Individual tool implementations
│       ├── write-file.js
│       └── ...
```

The server uses the `@modelcontextprotocol/sdk` to implement the MCP protocol over stdio transport.
