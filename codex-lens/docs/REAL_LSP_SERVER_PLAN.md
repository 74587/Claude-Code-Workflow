# CodexLens Real LSP Server Implementation Plan

> **Version**: 2.0  
> **Status**: Ready for Implementation  
> **Based on**: Existing LSP_INTEGRATION_PLAN.md + Real Language Server Integration  
> **Goal**: Implement true LSP server functionality (like cclsp), not pre-indexed search

---

## Executive Summary

### Current State vs Target State

| Aspect | Current (Pre-indexed) | Target (Real LSP) |
|--------|----------------------|-------------------|
| **Data Source** | Cached database index | Live language servers |
| **Freshness** | Stale (depends on re-index) | Real-time (LSP protocol) |
| **Accuracy** | Good for indexed content | Perfect (from language server) |
| **Latency** | <50ms (database) | ~50-200ms (LSP) |
| **Language Support** | Limited to parsed symbols | Full LSP support (all languages) |
| **Complexity** | Simple (DB queries) | High (LSP protocol + server mgmt) |

### Why Real LSP vs Index-Based

**Problem with current approach**:
- 符号搜索与smart_search没有本质区别
- 依赖预索引数据，不能实时反映代码变化
- 不支持advanced LSP功能(rename, code actions等)

**Advantages of real LSP**:
- ✅ Real-time code intelligence
- ✅ Supported by all major IDEs (VSCode, Neovim, Sublime, etc.)
- ✅ Standard protocol (Language Server Protocol)
- ✅ Advanced features: rename, code actions, formatting
- ✅ Language-agnostic (TypeScript, Python, Go, Rust, Java, etc.)

---

## Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   VS Code    │  │    Neovim    │  │   Sublime    │  │
│  │ (LSP Client) │  │ (LSP Client) │  │ (LSP Client) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
└─────────┼─────────────────┼─────────────────┼───────────┘
          │ LSP Protocol    │                 │
          │ (JSON-RPC/stdio)│                 │
┌─────────▼─────────────────▼─────────────────▼───────────┐
│            CodexLens LSP Server Bridge                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  LSP Protocol Handler (pygls)                       │ │
│  │  • initialize / shutdown                            │ │
│  │  • textDocument/definition                          │ │
│  │  • textDocument/references                          │ │
│  │  • textDocument/hover                               │ │
│  │  • textDocument/completion                          │ │
│  │  • textDocument/formatting                          │ │
│  │  • workspace/symbol                                 │ │
│  └────────────────────┬────────────────────────────────┘ │
│                       │                                   │
│  ┌────────────────────▼────────────────────────────────┐ │
│  │  Language Server Multiplexer                        │ │
│  │  • File type routing (ts→tsserver, py→pylsp, etc.)  │ │
│  │  • Multi-server management                          │ │
│  │  • Request forwarding & response formatting         │ │
│  └────────────────────┬────────────────────────────────┘ │
│                       │                                   │
│  ┌────────────────────▼────────────────────────────────┐ │
│  │  Language Servers (Spawned)                         │ │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │ │
│  │  │tsserver│  │ pylsp  │  │ gopls  │  │rust-   │   │ │
│  │  │        │  │        │  │        │  │analyzer│   │ │
│  │  └────────┘  └────────┘  └────────┘  └────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Codex-Lens Core (Optional - MCP Layer)             │ │
│  │  • Semantic search                                  │ │
│  │  • Custom MCP tools (enrich_prompt, etc.)           │ │
│  │  • Hook system (pre-tool, post-tool)                │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Differences from Index-Based Approach

1. **Request Flow**
   - Index: Query → Database → Results
   - LSP: Request → Route to LS → LS processes live code → Results

2. **Configuration**
   - Index: Depends on indexing state
   - LSP: Depends on installed language servers

3. **Latency Profile**
   - Index: Consistent (~50ms)
   - LSP: Variable (50-500ms depending on LS performance)

---

## Implementation Phases

### Phase 1: LSP Server Bridge (Foundation)

**Duration**: ~3-5 days  
**Complexity**: Medium  
**Dependencies**: pygls library

#### 1.1 Setup & Dependencies

**File**: `pyproject.toml`

```toml
[project.optional-dependencies]
lsp = [
    "pygls>=1.3.0",
    "lsprotocol>=2023.0.0",
]

[project.scripts]
codexlens-lsp = "codexlens.lsp.server:main"
```

**Installation**:
```bash
pip install -e ".[lsp]"
```

#### 1.2 LSP Server Core

**Files to create**:
1. `src/codexlens/lsp/__init__.py` - Package init
2. `src/codexlens/lsp/server.py` - Server entry point
3. `src/codexlens/lsp/multiplexer.py` - LS routing & management
4. `src/codexlens/lsp/handlers.py` - LSP request handlers

**Key responsibilities**:
- Initialize LSP server via pygls
- Handle client capabilities negotiation
- Route requests to appropriate language servers
- Format language server responses to LSP format

#### 1.3 Acceptance Criteria

- [ ] Server starts with `codexlens-lsp --stdio`
- [ ] Responds to `initialize` request
- [ ] Spawns language servers on demand
- [ ] Handles `shutdown` cleanly
- [ ] No crashes on malformed requests

---

### Phase 2: Language Server Multiplexer

**Duration**: ~5-7 days  
**Complexity**: High  
**Dependencies**: Phase 1 complete

#### 2.1 Multi-Server Management

**File**: `src/codexlens/lsp/multiplexer.py`

**Responsibilities**:
- Spawn language servers based on file extension
- Maintain server process lifecycle
- Route requests by document type
- Handle server crashes & restarts

**Supported Language Servers**:

| Language | Server | Installation |
|----------|--------|--------------|
| TypeScript | `typescript-language-server` | `npm i -g typescript-language-server` |
| Python | `pylsp` | `pip install python-lsp-server` |
| Go | `gopls` | `go install golang.org/x/tools/gopls@latest` |
| Rust | `rust-analyzer` | `rustup component add rust-analyzer` |
| Java | `jdtls` | Download JDTLS |
| C/C++ | `clangd` | `apt install clangd` |

#### 2.2 Configuration

**File**: `codexlens-lsp.json` (user config)

```json
{
  "languageServers": {
    "typescript": {
      "command": ["typescript-language-server", "--stdio"],
      "extensions": ["ts", "tsx", "js", "jsx"],
      "rootDir": "."
    },
    "python": {
      "command": ["pylsp"],
      "extensions": ["py", "pyi"],
      "rootDir": ".",
      "settings": {
        "pylsp": {
          "plugins": {
            "pycodestyle": { "enabled": true },
            "pylint": { "enabled": false }
          }
        }
      }
    },
    "go": {
      "command": ["gopls"],
      "extensions": ["go"],
      "rootDir": "."
    },
    "rust": {
      "command": ["rust-analyzer"],
      "extensions": ["rs"],
      "rootDir": "."
    }
  },
  "debug": false,
  "logLevel": "info"
}
```

#### 2.3 Acceptance Criteria

- [ ] Routes requests to correct LS based on file type
- [ ] Spawns servers on first request
- [ ] Reuses existing server instances
- [ ] Handles server restarts on crash
- [ ] Respects initialization options from config

---

### Phase 3: Core LSP Handlers

**Duration**: ~5-7 days  
**Complexity**: Medium  
**Dependencies**: Phase 1-2 complete

#### 3.1 Essential Handlers

Implement LSP request handlers for core functionality:

**Handler Mapping**:

```python
Handlers = {
    # Navigation
    "textDocument/definition": handle_definition,
    "textDocument/references": handle_references,
    "textDocument/declaration": handle_declaration,
    
    # Hover & Info
    "textDocument/hover": handle_hover,
    "textDocument/signatureHelp": handle_signature_help,
    
    # Completion
    "textDocument/completion": handle_completion,
    "completionItem/resolve": handle_completion_resolve,
    
    # Symbols
    "textDocument/documentSymbol": handle_document_symbols,
    "workspace/symbol": handle_workspace_symbols,
    
    # Editing
    "textDocument/formatting": handle_formatting,
    "textDocument/rangeFormatting": handle_range_formatting,
    "textDocument/rename": handle_rename,
    
    # Diagnostics
    "textDocument/publishDiagnostics": handle_publish_diagnostics,
    
    # Misc
    "textDocument/codeAction": handle_code_action,
    "textDocument/codeLens": handle_code_lens,
}
```

#### 3.2 Request Forwarding Logic

```python
def forward_request_to_lsp(handler_name, params):
    """Forward request to appropriate language server."""
    
    # Extract document info
    document_uri = params.get("textDocument", {}).get("uri")
    file_ext = extract_extension(document_uri)
    
    # Get language server
    ls = multiplexer.get_server(file_ext)
    if not ls:
        return {"error": f"No LS for {file_ext}"}
    
    # Convert position (1-based → 0-based)
    normalized_params = normalize_positions(params)
    
    # Forward to LS
    response = ls.send_request(handler_name, normalized_params)
    
    # Convert response format
    return normalize_response(response)
```

#### 3.3 Acceptance Criteria

- [ ] All handlers implemented and tested
- [ ] Proper position coordinate conversion (LSP is 0-based, user-facing is 1-based)
- [ ] Error handling for missing language servers
- [ ] Response formatting matches LSP spec
- [ ] Latency < 500ms for 95th percentile

---

### Phase 4: Advanced Features

**Duration**: ~3-5 days  
**Complexity**: Medium  
**Dependencies**: Phase 1-3 complete

#### 4.1 Position Tolerance (cclsp-like feature)

Some LSP clients (like Claude Code with fuzzy positions) may send imprecise positions. Implement retry logic:

```python
def find_symbol_with_tolerance(ls, uri, position, max_attempts=5):
    """Try multiple position offsets if exact position fails."""
    
    positions_to_try = [
        position,                              # Original
        (position.line - 1, position.char),   # One line up
        (position.line + 1, position.char),   # One line down
        (position.line, max(0, position.char - 1)),  # One char left
        (position.line, position.char + 1),   # One char right
    ]
    
    for pos in positions_to_try:
        try:
            result = ls.send_request("textDocument/definition", {
                "textDocument": {"uri": uri},
                "position": pos
            })
            if result:
                return result
        except:
            continue
    
    return None
```

#### 4.2 MCP Integration (Optional)

Extend with MCP provider for Claude Code hooks:

```python
class MCPBridgeHandler:
    """Bridge LSP results into MCP context."""
    
    def build_mcp_context_from_lsp(self, symbol_name, lsp_results):
        """Convert LSP responses to MCP context."""
        # Implementation
        pass
```

#### 4.3 Acceptance Criteria

- [ ] Position tolerance working (≥3 positions tried)
- [ ] MCP context generation functional
- [ ] Hook system integration complete
- [ ] All test coverage > 80%

---

### Phase 5: Deployment & Documentation

**Duration**: ~2-3 days  
**Complexity**: Low  
**Dependencies**: Phase 1-4 complete

#### 5.1 Installation & Setup Guide

Create comprehensive documentation:
- Installation instructions for each supported language
- Configuration guide
- Troubleshooting
- Performance tuning

#### 5.2 CLI Tools

```bash
# Start LSP server
codexlens-lsp --stdio

# Check configured language servers
codexlens-lsp --list-servers

# Validate configuration
codexlens-lsp --validate-config

# Show logs
codexlens-lsp --log-level debug
```

#### 5.3 Acceptance Criteria

- [ ] Documentation complete with examples
- [ ] All CLI commands working
- [ ] Integration tested with VS Code, Neovim
- [ ] Performance benchmarks documented

---

## Module Structure

```
src/codexlens/lsp/
├── __init__.py                 # Package exports
├── server.py                   # LSP server entry point
├── multiplexer.py              # Language server manager
├── handlers.py                 # LSP request handlers
├── position_utils.py           # Coordinate conversion utilities
├── process_manager.py          # Language server process lifecycle
├── response_formatter.py        # LSP response formatting
└── config.py                   # Configuration loading

tests/lsp/
├── test_multiplexer.py         # LS routing tests
├── test_handlers.py            # Handler tests
├── test_position_conversion.py  # Coordinate tests
├── test_integration.py         # Full LSP handshake
└── fixtures/
    ├── sample_python.py        # Test files
    └── sample_typescript.ts
```

---

## Dependency Graph

```
Phase 5 (Deployment)
    ↑
Phase 4 (Advanced Features)
    ↑
Phase 3 (Core Handlers)
    ├─ Depends on: Phase 2
    ├─ Depends on: Phase 1
    └─ Deliverable: Full LSP functionality
    
Phase 2 (Multiplexer)
    ├─ Depends on: Phase 1
    └─ Deliverable: Multi-server routing
    
Phase 1 (Server Bridge)
    └─ Deliverable: Basic LSP server
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| LSP Implementation | `pygls` | Mature, well-maintained |
| Protocol | LSP 3.17+ | Latest stable version |
| Process Management | `subprocess` + `psutil` | Standard Python, no external deps |
| Configuration | JSON | Simple, widely understood |
| Logging | `logging` module | Built-in, standard |
| Testing | `pytest` + `pytest-asyncio` | Industry standard |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Language server crashes | Medium | High | Auto-restart with exponential backoff |
| Configuration errors | Medium | Medium | Validation on startup |
| Performance degradation | Low | High | Implement caching + benchmarks |
| Position mismatch issues | Medium | Low | Tolerance layer (try multiple positions) |
| Memory leaks (long sessions) | Low | Medium | Connection pooling + cleanup timers |

---

## Success Metrics

1. **Functionality**: All 7 core LSP handlers working
2. **Performance**: p95 latency < 500ms for typical requests
3. **Reliability**: 99.9% uptime in production
4. **Coverage**: >80% code coverage
5. **Documentation**: Complete with examples
6. **Multi-language**: Support for 5+ languages

---

## Comparison: This Approach vs Alternatives

### Option A: Real LSP Server (This Plan) ✅ RECOMMENDED
**Pros**:
- ✅ True real-time code intelligence
- ✅ Supports all LSP clients (VSCode, Neovim, Sublime, Emacs, etc.)
- ✅ Advanced features (rename, code actions, formatting)
- ✅ Language-agnostic
- ✅ Follows industry standard protocol

**Cons**:
- ❌ More complex implementation
- ❌ Depends on external language servers
- ❌ Higher latency than index-based

**Effort**: ~20-25 days

---

### Option B: Enhanced Index-Based (Current Approach)
**Pros**:
- ✅ Simple implementation
- ✅ Fast (<50ms)
- ✅ No external dependencies

**Cons**:
- ❌ Same as smart_search (user's concern)
- ❌ Stale data between re-indexes
- ❌ Limited to indexed symbols
- ❌ No advanced LSP features

**Effort**: ~5-10 days

---

### Option C: Hybrid (LSP + Index)
**Pros**:
- ✅ Real-time from LSP
- ✅ Fallback to index
- ✅ Best of both worlds

**Cons**:
- ❌ Highest complexity
- ❌ Difficult to debug conflicts
- ❌ Higher maintenance burden

**Effort**: ~30-35 days

---

## Next Steps

1. **Approve Plan**: Confirm this approach matches requirements
2. **Setup Dev Environment**: Install language servers
3. **Phase 1 Implementation**: Start with server bridge
4. **Iterative Testing**: Test each phase with real IDE integration
5. **Documentation**: Maintain docs as implementation progresses

---

---

## Appendix A: VSCode Bridge Implementation

### A.1 Overview

VSCode Bridge 是另一种集成方式，通过VSCode扩展暴露其内置LSP功能给外部工具（如CCW MCP Server）。

**Architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code / CCW                         │
│                     (MCP Client / CLI)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ MCP Tool Call (vscode_lsp)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      CCW MCP Server                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    vscode_lsp Tool                          │ │
│  │   • HTTP client to VSCode Bridge                            │ │
│  │   • Parameter validation (Zod)                              │ │
│  │   • Response formatting                                      │ │
│  └────────────────────────┬────────────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            │ HTTP POST (localhost:3457)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   ccw-vscode-bridge Extension                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   HTTP Server (port 3457)                   │ │
│  │   Endpoints:                                                 │ │
│  │   • POST /get_definition                                     │ │
│  │   • POST /get_references                                     │ │
│  │   • POST /get_hover                                          │ │
│  │   • POST /get_document_symbols                               │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────▼────────────────────────────────────┐ │
│  │                  VSCode API Calls                            │ │
│  │   vscode.commands.executeCommand():                         │ │
│  │   • vscode.executeDefinitionProvider                        │ │
│  │   • vscode.executeReferenceProvider                         │ │
│  │   • vscode.executeHoverProvider                             │ │
│  │   • vscode.executeDocumentSymbolProvider                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ VSCode LSP Integration
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                 VSCode Language Services                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │TypeScript│  │ Python  │  │   Go    │  │  Rust   │            │
│  │  Server  │  │  Server │  │ (gopls) │  │Analyzer │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### A.2 Component Files

**已创建的文件**:

1. `ccw-vscode-bridge/package.json` - VSCode扩展配置
2. `ccw-vscode-bridge/tsconfig.json` - TypeScript配置
3. `ccw-vscode-bridge/src/extension.ts` - 扩展主代码
4. `ccw-vscode-bridge/.vscodeignore` - 打包排除文件
5. `ccw-vscode-bridge/README.md` - 使用文档

**待创建的文件**:

1. `ccw/src/tools/vscode-lsp.ts` - MCP工具实现
2. `ccw/src/tools/index.ts` - 注册新工具

### A.3 VSCode Bridge Extension Implementation

**File**: `ccw-vscode-bridge/src/extension.ts`

```typescript
// 核心功能:
// 1. 启动HTTP服务器监听3457端口
// 2. 接收POST请求，解析JSON body
// 3. 调用VSCode内置LSP命令
// 4. 返回JSON结果

// HTTP Endpoints:
// POST /get_definition    → vscode.executeDefinitionProvider
// POST /get_references    → vscode.executeReferenceProvider
// POST /get_hover         → vscode.executeHoverProvider
// POST /get_document_symbols → vscode.executeDocumentSymbolProvider
```

### A.4 MCP Tool Implementation

**File**: `ccw/src/tools/vscode-lsp.ts`

```typescript
/**
 * MCP tool that communicates with VSCode Bridge extension.
 * 
 * Actions:
 * - get_definition: Find symbol definition
 * - get_references: Find all references
 * - get_hover: Get hover information
 * - get_document_symbols: List symbols in file
 * 
 * Required:
 * - ccw-vscode-bridge extension running in VSCode
 * - File must be open in VSCode for accurate results
 */

const schema: ToolSchema = {
  name: 'vscode_lsp',
  description: `Access live VSCode LSP features...`,
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: [...] },
      file_path: { type: 'string' },
      line: { type: 'number' },
      character: { type: 'number' }
    },
    required: ['action', 'file_path']
  }
};
```

### A.5 Advantages vs Standalone LSP Server

| Feature | VSCode Bridge | Standalone LSP Server |
|---------|--------------|----------------------|
| **Setup Complexity** | Low (VSCode ext) | Medium (multiple LS) |
| **Language Support** | Automatic (VSCode) | Manual config |
| **Maintenance** | Low | Medium |
| **IDE Independence** | VSCode only | Any LSP client |
| **Performance** | Good | Good |
| **Advanced Features** | Full VSCode support | LSP standard |

---

## Appendix B: Complete Integration Architecture

### B.1 Three Integration Paths

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CodexLens Integration Paths                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Path 1: VSCode Bridge (HTTP)          Path 2: Standalone LSP Server        │
│  ────────────────────────              ─────────────────────────────        │
│                                                                              │
│  ┌─────────────┐                       ┌─────────────┐                      │
│  │ CCW MCP     │                       │  Any LSP    │                      │
│  │ vscode_lsp  │                       │   Client    │                      │
│  └──────┬──────┘                       └──────┬──────┘                      │
│         │ HTTP                                │ LSP/stdio                    │
│         ▼                                     ▼                              │
│  ┌─────────────┐                       ┌─────────────┐                      │
│  │ ccw-vscode  │                       │ codexlens-  │                      │
│  │   -bridge   │                       │    lsp      │                      │
│  └──────┬──────┘                       └──────┬──────┘                      │
│         │ VSCode API                          │ Child Process               │
│         ▼                                     ▼                              │
│  ┌─────────────┐                       ┌─────────────┐                      │
│  │   VSCode    │                       │   pylsp     │                      │
│  │     LS      │                       │  tsserver   │                      │
│  └─────────────┘                       │   gopls     │                      │
│                                        └─────────────┘                      │
│                                                                              │
│                       Path 3: Index-Based (Current)                         │
│                       ─────────────────────────────                         │
│                                                                              │
│                       ┌─────────────┐                                       │
│                       │ CCW MCP     │                                       │
│                       │codex_lens_lsp│                                      │
│                       └──────┬──────┘                                       │
│                              │ Python subprocess                            │
│                              ▼                                              │
│                       ┌─────────────┐                                       │
│                       │ CodexLens   │                                       │
│                       │   Index DB  │                                       │
│                       └─────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.2 Recommendation Matrix

| Use Case | Recommended Path | Reason |
|----------|-----------------|--------|
| Claude Code + VSCode | Path 1: VSCode Bridge | Simplest, full VSCode features |
| CLI-only workflows | Path 2: Standalone LSP | No VSCode dependency |
| Quick search across indexed code | Path 3: Index-based | Fastest response |
| Multi-IDE support | Path 2: Standalone LSP | Standard protocol |
| Advanced refactoring | Path 1: VSCode Bridge | Full VSCode capabilities |

### B.3 Hybrid Mode (Recommended)

For maximum flexibility, implement all three paths:

```javascript
// Smart routing in CCW
function selectLSPPath(request) {
  // 1. Try VSCode Bridge first (if available)
  if (await checkVSCodeBridge()) {
    return "vscode_bridge";
  }
  
  // 2. Fall back to Standalone LSP
  if (await checkStandaloneLSP(request.fileType)) {
    return "standalone_lsp";
  }
  
  // 3. Last resort: Index-based
  return "index_based";
}
```

---

## Appendix C: Implementation Tasks Summary

### C.1 VSCode Bridge Tasks

| Task ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| VB-1 | Create ccw-vscode-bridge extension structure | High | ✅ Done |
| VB-2 | Implement HTTP server in extension.ts | High | ✅ Done |
| VB-3 | Create vscode_lsp MCP tool | High | 🔄 Pending |
| VB-4 | Register tool in CCW | High | 🔄 Pending |
| VB-5 | Test with VSCode | Medium | 🔄 Pending |
| VB-6 | Add connection retry logic | Low | 🔄 Pending |

### C.2 Standalone LSP Server Tasks

| Task ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| LSP-1 | Setup pygls project structure | High | 🔄 Pending |
| LSP-2 | Implement multiplexer | High | 🔄 Pending |
| LSP-3 | Core handlers (definition, references) | High | 🔄 Pending |
| LSP-4 | Position tolerance | Medium | 🔄 Pending |
| LSP-5 | Tests and documentation | Medium | 🔄 Pending |

### C.3 Integration Tasks

| Task ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| INT-1 | Smart path routing | Medium | 🔄 Pending |
| INT-2 | Unified error handling | Medium | 🔄 Pending |
| INT-3 | Performance benchmarks | Low | 🔄 Pending |

---

## Questions for Clarification

Before implementation, confirm:

1. **Implementation Priority**: Start with VSCode Bridge (simpler) or Standalone LSP (more general)?
2. **Language Priority**: Which languages are most important? (TypeScript, Python, Go, Rust, etc.)
3. **IDE Focus**: Target VS Code first, then others?
4. **Fallback Strategy**: Should we keep index-based search as fallback if LSP fails?
5. **Caching**: How much should we cache LS responses?
6. **Configuration**: Simple JSON config or more sophisticated format?

