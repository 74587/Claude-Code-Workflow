# codex-lens LSP Integration - Complete Execution Plan

> Version: 1.0
> Created: 2026-01-15
> Based on: Gemini Multi-Round Deep Analysis
> Status: Ready for Execution

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Claude Code LSP Implementation Reference](#2-claude-code-lsp-implementation-reference)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1: LSP Server Foundation](#4-phase-1-lsp-server-foundation)
5. [Phase 2: Find References](#5-phase-2-find-references)
6. [Phase 3: Hover Information](#6-phase-3-hover-information)
7. [Phase 4: MCP Bridge](#7-phase-4-mcp-bridge)
8. [Phase 5: Advanced Features](#8-phase-5-advanced-features)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Guide](#10-deployment-guide)
11. [Risk Mitigation](#11-risk-mitigation)

---

## 1. Executive Summary

### 1.1 Project Goal

将 codex-lens 的代码索引和搜索能力通过 LSP (Language Server Protocol) 暴露，使其能够：
- 为 IDE/编辑器提供代码导航功能
- 与 Claude Code 的 hook 系统集成
- 通过 MCP (Model Context Protocol) 为 LLM 提供结构化代码上下文

### 1.2 Value Proposition

| Capability | Before | After |
|------------|--------|-------|
| Code Navigation | CLI only | IDE integration via LSP |
| Context for LLM | Manual copy-paste | Automated MCP injection |
| Real-time Updates | Batch re-index | Incremental on save |
| Cross-project Search | Per-directory | Unified global index |

### 1.3 Success Criteria

- [ ] All 5 core LSP methods implemented and tested
- [ ] Query latency < 100ms for 95th percentile
- [ ] MCP context generation working with Claude Code hooks
- [ ] Documentation and examples complete

---

## 2. Claude Code LSP Implementation Reference

> 本章节记录 Claude Code 当前 LSP 实现方式，作为 codex-lens 集成的技术参考。

### 2.1 Claude Code LSP 实现方式概览

Claude Code 实现 LSP 功能有 **三种方式**：

| 方式 | 描述 | 适用场景 |
|------|------|----------|
| **内置 LSP 工具** | v2.0.74+ 原生支持 | 快速启用，基础功能 |
| **MCP Server (cclsp)** | 第三方 MCP 桥接 | 高级功能，位置容错 |
| **Plugin Marketplace** | 插件市场安装 | 多语言扩展支持 |

### 2.2 方式一：内置 LSP 工具 (v2.0.74+)

Claude Code 从 v2.0.74 版本开始内置 LSP 支持。

#### 启用方式

```bash
# 设置环境变量启用 LSP
export ENABLE_LSP_TOOL=1
claude

# 永久启用 (添加到 shell 配置)
echo 'export ENABLE_LSP_TOOL=1' >> ~/.bashrc
```

#### 内置 LSP 工具清单

| 工具名 | 功能 | 对应 LSP 方法 | 性能 |
|--------|------|---------------|------|
| `goToDefinition` | 跳转到符号定义 | `textDocument/definition` | ~50ms |
| `findReferences` | 查找所有引用 | `textDocument/references` | ~100ms |
| `documentSymbol` | 获取文件符号结构 | `textDocument/documentSymbol` | ~30ms |
| `hover` | 显示类型签名和文档 | `textDocument/hover` | ~50ms |
| `getDiagnostics` | 获取诊断信息 | `textDocument/diagnostic` | ~100ms |

#### 性能对比

```
传统文本搜索: ~45,000ms (45秒)
LSP 语义搜索: ~50ms
性能提升: 约 900 倍
```

#### 当前限制

- 部分语言返回 "No LSP server available"
- 需要额外安装语言服务器插件
- 不支持重命名等高级操作

### 2.3 方式二：MCP Server 方式 (cclsp)

[cclsp](https://github.com/ktnyt/cclsp) 是一个 MCP Server，将 LSP 能力暴露给 Claude Code。

#### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                              │
│                    (MCP Client)                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ MCP Protocol (JSON-RPC over stdio)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                         cclsp                                   │
│                    (MCP Server)                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Position Tolerance Layer                    │   │
│  │   (自动尝试多个位置组合，解决 AI 行号不精确问题)           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         │                  │                  │                │
│         ▼                  ▼                  ▼                │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │   pylsp     │   │   gopls     │   │rust-analyzer│          │
│  │  (Python)   │   │    (Go)     │   │   (Rust)    │          │
│  └─────────────┘   └─────────────┘   └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

#### 安装与配置

```bash
# 一次性运行 (无需安装)
npx cclsp@latest setup

# 用户级配置
npx cclsp@latest setup --user
```

#### 配置文件格式

**位置**: `.claude/cclsp.json` 或 `~/.config/claude/cclsp.json`

```json
{
  "servers": [
    {
      "extensions": ["py", "pyi"],
      "command": ["pylsp"],
      "rootDir": ".",
      "restartInterval": 5,
      "initializationOptions": {}
    },
    {
      "extensions": ["ts", "tsx", "js", "jsx"],
      "command": ["typescript-language-server", "--stdio"],
      "rootDir": "."
    },
    {
      "extensions": ["go"],
      "command": ["gopls"],
      "rootDir": "."
    },
    {
      "extensions": ["rs"],
      "command": ["rust-analyzer"],
      "rootDir": "."
    }
  ]
}
```

#### cclsp 暴露的 MCP 工具

| MCP 工具 | 功能 | 特性 |
|----------|------|------|
| `find_definition` | 按名称和类型查找定义 | 支持模糊匹配 |
| `find_references` | 查找所有引用位置 | 跨文件搜索 |
| `rename_symbol` | 重命名符号 | 创建 .bak 备份 |
| `rename_symbol_strict` | 精确位置重命名 | 处理同名歧义 |
| `get_diagnostics` | 获取诊断信息 | 错误/警告/提示 |
| `restart_server` | 重启 LSP 服务器 | 解决内存泄漏 |

#### 核心特性：位置容错

```python
# AI 生成的代码位置常有偏差
# cclsp 自动尝试多个位置组合

positions_to_try = [
    (line, column),           # 原始位置
    (line - 1, column),       # 上一行
    (line + 1, column),       # 下一行
    (line, 0),                # 行首
    (line, len(line_content)) # 行尾
]

for pos in positions_to_try:
    result = lsp_server.definition(pos)
    if result:
        return result
```

#### 支持的语言服务器

| 语言 | 服务器 | 安装命令 |
|------|--------|----------|
| Python | pylsp | `pip install python-lsp-server` |
| TypeScript | typescript-language-server | `npm i -g typescript-language-server` |
| Go | gopls | `go install golang.org/x/tools/gopls@latest` |
| Rust | rust-analyzer | `rustup component add rust-analyzer` |
| C/C++ | clangd | `apt install clangd` |
| Ruby | solargraph | `gem install solargraph` |
| PHP | intelephense | `npm i -g intelephense` |
| Java | jdtls | Eclipse JDT Language Server |

### 2.4 方式三：Plugin Marketplace 插件

Claude Code 官方插件市场提供语言支持扩展。

#### 添加插件市场

```bash
/plugin marketplace add boostvolt/claude-code-lsps
```

#### 安装语言支持

```bash
# Python (Pyright)
/plugin install pyright@claude-code-lsps

# TypeScript/JavaScript
/plugin install vtsls@claude-code-lsps

# Go
/plugin install gopls@claude-code-lsps

# Rust
/plugin install rust-analyzer@claude-code-lsps

# Java
/plugin install jdtls@claude-code-lsps

# C/C++
/plugin install clangd@claude-code-lsps

# C#
/plugin install omnisharp@claude-code-lsps

# PHP
/plugin install intelephense@claude-code-lsps

# Kotlin
/plugin install kotlin-language-server@claude-code-lsps

# Ruby
/plugin install solargraph@claude-code-lsps
```

#### 支持的 11 种语言

Python, TypeScript, Go, Rust, Java, C/C++, C#, PHP, Kotlin, Ruby, HTML/CSS

### 2.5 三种方式对比

| 特性 | 内置 LSP | cclsp (MCP) | Plugin Marketplace |
|------|----------|-------------|-------------------|
| 安装复杂度 | 低 (环境变量) | 中 (npx) | 低 (/plugin) |
| 功能完整性 | 基础 5 个操作 | 完整 + 重命名 | 完整 |
| 位置容错 | 无 | 有 | 无 |
| 重命名支持 | 无 | 有 | 有 |
| 自定义配置 | 无 | 完整 JSON | 有限 |
| 多语言支持 | 需插件 | 任意 LSP | 11 种 |
| 生产稳定性 | 高 | 中 | 高 |

### 2.6 codex-lens 集成策略

基于 Claude Code LSP 实现方式分析，推荐以下集成策略：

#### 策略 A：作为 MCP Server (推荐)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │ MCP Protocol
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    codex-lens MCP Server                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MCP Tools                             │   │
│  │  • find_definition  → GlobalSymbolIndex.search()         │   │
│  │  • find_references  → ChainSearchEngine.search_refs()    │   │
│  │  • get_context      → MCPProvider.build_context()        │   │
│  │  • hybrid_search    → HybridSearchEngine.search()        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                 codex-lens Core                          │   │
│  │   GlobalSymbolIndex │ SQLiteStore │ WatcherManager       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**优势**：
- 直接复用 codex-lens 索引
- 无需启动额外 LSP 进程
- 支持 MCP 上下文注入

**实现文件**: `src/codexlens/mcp/server.py`

```python
"""codex-lens MCP Server for Claude Code integration."""

import json
import sys
from typing import Any, Dict

from codexlens.mcp.provider import MCPProvider
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.global_index import GlobalSymbolIndex


class CodexLensMCPServer:
    """MCP Server exposing codex-lens capabilities."""

    def __init__(self, workspace_path: str):
        self.global_index = GlobalSymbolIndex(workspace_path)
        self.search_engine = ChainSearchEngine(...)
        self.mcp_provider = MCPProvider(...)

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle MCP tool call."""
        method = request.get("method")
        params = request.get("params", {})

        handlers = {
            "find_definition": self._find_definition,
            "find_references": self._find_references,
            "get_context": self._get_context,
            "hybrid_search": self._hybrid_search,
        }

        handler = handlers.get(method)
        if handler:
            return handler(params)
        return {"error": f"Unknown method: {method}"}

    def _find_definition(self, params: Dict) -> Dict:
        """Find symbol definition."""
        symbol_name = params.get("symbol")
        symbols = self.global_index.search(symbol_name, exact=True, limit=1)
        if symbols:
            s = symbols[0]
            return {
                "file": s.file_path,
                "line": s.range[0],
                "column": 0,
                "kind": s.kind,
            }
        return {"error": "Symbol not found"}

    def _find_references(self, params: Dict) -> Dict:
        """Find all references."""
        symbol_name = params.get("symbol")
        refs = self.search_engine.search_references(symbol_name)
        return {
            "references": [
                {"file": r.file_path, "line": r.line, "context": r.context}
                for r in refs
            ]
        }

    def _get_context(self, params: Dict) -> Dict:
        """Get MCP context for LLM."""
        symbol_name = params.get("symbol")
        context = self.mcp_provider.build_context(symbol_name)
        return context.to_dict() if context else {"error": "Context not found"}

    def _hybrid_search(self, params: Dict) -> Dict:
        """Execute hybrid search."""
        query = params.get("query")
        # ... implementation
```

#### 策略 B：作为独立 LSP Server

通过 cclsp 配置接入 codex-lens LSP Server。

**cclsp 配置** (`.claude/cclsp.json`)：

```json
{
  "servers": [
    {
      "extensions": ["py", "ts", "go", "rs", "java"],
      "command": ["codexlens-lsp", "--stdio"],
      "rootDir": ".",
      "restartInterval": 0
    }
  ]
}
```

**优势**：
- 兼容标准 LSP 协议
- 可被任意 LSP 客户端使用
- cclsp 提供位置容错

#### 策略 C：混合模式 (最佳实践)

```
┌───────────────────────────────────────────────────────────────────┐
│                         Claude Code                               │
│  ┌──────────────────┐            ┌──────────────────────────┐    │
│  │  内置 LSP 工具   │            │     MCP Client           │    │
│  │  (基础导航)      │            │   (上下文注入)            │    │
│  └────────┬─────────┘            └────────────┬─────────────┘    │
└───────────┼───────────────────────────────────┼──────────────────┘
            │                                   │
            │ LSP Protocol                      │ MCP Protocol
            │                                   │
┌───────────▼───────────────────────────────────▼──────────────────┐
│                    codex-lens Unified Server                      │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │     LSP Handlers        │  │      MCP Handlers           │   │
│  │  • definition           │  │  • get_context              │   │
│  │  • references           │  │  • enrich_prompt            │   │
│  │  • hover                │  │  • hybrid_search            │   │
│  │  • completion           │  │  • semantic_query           │   │
│  └────────────┬────────────┘  └──────────────┬──────────────┘   │
│               │                               │                  │
│               └───────────────┬───────────────┘                  │
│                               ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    codex-lens Core                          │ │
│  │  GlobalSymbolIndex │ HybridSearch │ VectorStore │ Watcher  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**优势**：
- LSP 提供标准代码导航
- MCP 提供 LLM 上下文增强
- 统一索引，避免重复计算

### 2.7 参考资源

| 资源 | 链接 |
|------|------|
| Claude Code LSP 设置指南 | https://www.aifreeapi.com/en/posts/claude-code-lsp |
| cclsp GitHub | https://github.com/ktnyt/cclsp |
| Claude Code Plugins | https://code.claude.com/docs/en/plugins-reference |
| claude-code-lsps 市场 | https://github.com/Piebald-AI/claude-code-lsps |
| LSP 规范 | https://microsoft.github.io/language-server-protocol/ |
| MCP 规范 | https://modelcontextprotocol.io/ |

---

## 3. Architecture Overview

### 3.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   VS Code   │  │   Neovim    │  │   Sublime   │  │    Claude Code      │ │
│  │  (LSP Client)│  │ (LSP Client)│  │ (LSP Client)│  │ (Hook + MCP Client) │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                     │           │
└─────────┼────────────────┼────────────────┼─────────────────────┼───────────┘
          │                │                │                     │
          └────────────────┴────────────────┴──────────┬──────────┘
                                                       │
                                              (JSON-RPC / stdio)
                                                       │
┌──────────────────────────────────────────────────────┴──────────────────────┐
│                         codex-lens LSP Server                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        LSP Layer (NEW)                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   Handlers   │  │   Providers  │  │   Protocol   │              │   │
│  │  │  definition  │  │    hover     │  │   messages   │              │   │
│  │  │  references  │  │  completion  │  │   lifecycle  │              │   │
│  │  │   symbols    │  │              │  │              │              │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────────────┘   │
│            │                 │                 │                           │
│  ┌─────────┴─────────────────┴─────────────────┴───────────────────────┐   │
│  │                        MCP Layer (NEW)                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │    Schema    │  │   Provider   │  │    Hooks     │              │   │
│  │  │  MCPContext  │  │ buildContext │  │  pre-tool    │              │   │
│  │  │  SymbolInfo  │  │ enrichPrompt │  │  post-tool   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│  ┌─────────────────────────────────┴───────────────────────────────────┐   │
│  │                     Existing codex-lens Core                        │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │   Search    │  │   Storage   │  │   Watcher   │  │   Parser   │ │   │
│  │  │ ChainSearch │  │ GlobalIndex │  │   Manager   │  │ TreeSitter │ │   │
│  │  │ HybridSearch│  │ SQLiteStore │  │ Incremental │  │  Symbols   │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
                           LSP Request Flow
                           ================

[Client] ─── textDocument/definition ───> [LSP Server]
                                              │
                                              v
                                    ┌─────────────────┐
                                    │  Parse Request  │
                                    │  Extract symbol │
                                    └────────┬────────┘
                                              │
                                              v
                                    ┌─────────────────┐
                                    │ GlobalSymbolIdx │
                                    │    .search()    │
                                    └────────┬────────┘
                                              │
                                              v
                                    ┌─────────────────┐
                                    │  Format Result  │
                                    │   as Location   │
                                    └────────┬────────┘
                                              │
[Client] <─── Location Response ────────────────┘


                           MCP Context Flow
                           ================

[Claude Code] ─── pre-tool hook ───> [MCP Provider]
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    v                     v                     v
            ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
            │  Definition │       │  References │       │   Related   │
            │   Lookup    │       │   Lookup    │       │   Symbols   │
            └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
                    │                     │                     │
                    └─────────────────────┴─────────────────────┘
                                          │
                                          v
                                  ┌───────────────┐
                                  │  MCPContext   │
                                  │    Object     │
                                  └───────┬───────┘
                                          │
[Claude Code] <─── JSON Context ──────────┘
                                          │
                                          v
                              ┌───────────────────────┐
                              │ Inject into LLM Prompt│
                              └───────────────────────┘
```

### 3.3 Module Dependencies

```
                    ┌─────────────────────┐
                    │   lsp/server.py     │
                    │   (Entry Point)     │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           v                   v                   v
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │lsp/handlers │    │lsp/providers│    │ mcp/provider│
    │  .py        │    │  .py        │    │  .py        │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               v
                    ┌─────────────────────┐
                    │ search/chain_search │
                    │        .py          │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           v                   v                   v
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │storage/     │    │storage/     │    │watcher/     │
    │global_index │    │sqlite_store │    │manager.py   │
    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 4. Phase 1: LSP Server Foundation

### 4.1 Overview

| Attribute | Value |
|-----------|-------|
| Priority | HIGH |
| Complexity | Medium |
| Dependencies | pygls library |
| Deliverables | Working LSP server with 3 core handlers |

### 4.2 Task Breakdown

#### Task 1.1: Project Setup

**File**: `pyproject.toml` (MODIFY)

```toml
[project.optional-dependencies]
lsp = [
    "pygls>=1.3.0",
]

[project.scripts]
codexlens-lsp = "codexlens.lsp:main"
```

**Acceptance Criteria**:
- [ ] `pip install -e ".[lsp]"` succeeds
- [ ] `codexlens-lsp --help` shows usage

---

#### Task 1.2: LSP Server Core

**File**: `src/codexlens/lsp/__init__.py` (NEW)

```python
"""codex-lens Language Server Protocol implementation."""

from codexlens.lsp.server import CodexLensLanguageServer, main

__all__ = ["CodexLensLanguageServer", "main"]
```

**File**: `src/codexlens/lsp/server.py` (NEW)

```python
"""Main LSP server implementation using pygls."""

import logging
from pathlib import Path
from typing import Optional

from lsprotocol import types as lsp
from pygls.server import LanguageServer

from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
from codexlens.watcher.manager import WatcherManager

logger = logging.getLogger(__name__)


class CodexLensLanguageServer(LanguageServer):
    """Language Server powered by codex-lens indexing."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace_path: Optional[Path] = None
        self.registry: Optional[RegistryStore] = None
        self.search_engine: Optional[ChainSearchEngine] = None
        self.global_index: Optional[GlobalSymbolIndex] = None
        self.watcher: Optional[WatcherManager] = None

    def initialize_codexlens(self, workspace_path: Path) -> None:
        """Initialize codex-lens components for the workspace."""
        self.workspace_path = workspace_path

        # Initialize registry and search engine
        self.registry = RegistryStore()
        self.registry.initialize()

        mapper = PathMapper()
        self.search_engine = ChainSearchEngine(self.registry, mapper)

        # Initialize global symbol index
        self.global_index = GlobalSymbolIndex(workspace_path)

        # Start file watcher for incremental updates
        self.watcher = WatcherManager(
            root_path=workspace_path,
            on_indexed=self._on_file_indexed
        )
        self.watcher.start()

        logger.info(f"Initialized codex-lens for workspace: {workspace_path}")

    def _on_file_indexed(self, file_path: Path) -> None:
        """Callback when a file is indexed."""
        logger.debug(f"File indexed: {file_path}")

    def shutdown_codexlens(self) -> None:
        """Cleanup codex-lens components."""
        if self.watcher:
            self.watcher.stop()
            self.watcher = None
        logger.info("codex-lens shutdown complete")


# Create server instance
server = CodexLensLanguageServer(
    name="codex-lens",
    version="0.1.0"
)


@server.feature(lsp.INITIALIZE)
def on_initialize(params: lsp.InitializeParams) -> lsp.InitializeResult:
    """Handle LSP initialize request."""
    if params.root_uri:
        workspace_path = Path(params.root_uri.replace("file://", ""))
        server.initialize_codexlens(workspace_path)

    return lsp.InitializeResult(
        capabilities=lsp.ServerCapabilities(
            text_document_sync=lsp.TextDocumentSyncOptions(
                open_close=True,
                change=lsp.TextDocumentSyncKind.Incremental,
                save=lsp.SaveOptions(include_text=False),
            ),
            definition_provider=True,
            references_provider=True,
            completion_provider=lsp.CompletionOptions(
                trigger_characters=[".", "_"],
            ),
            hover_provider=True,
            workspace_symbol_provider=True,
        ),
        server_info=lsp.ServerInfo(
            name="codex-lens",
            version="0.1.0",
        ),
    )


@server.feature(lsp.SHUTDOWN)
def on_shutdown(params: None) -> None:
    """Handle LSP shutdown request."""
    server.shutdown_codexlens()


def main():
    """Entry point for the LSP server."""
    import argparse

    parser = argparse.ArgumentParser(description="codex-lens Language Server")
    parser.add_argument("--stdio", action="store_true", help="Use stdio transport")
    parser.add_argument("--tcp", action="store_true", help="Use TCP transport")
    parser.add_argument("--host", default="127.0.0.1", help="TCP host")
    parser.add_argument("--port", type=int, default=2087, help="TCP port")

    args = parser.parse_args()

    if args.tcp:
        server.start_tcp(args.host, args.port)
    else:
        server.start_io()


if __name__ == "__main__":
    main()
```

**Acceptance Criteria**:
- [ ] Server starts without errors
- [ ] Handles initialize/shutdown lifecycle
- [ ] WatcherManager starts on workspace open

---

#### Task 1.3: Definition Handler

**File**: `src/codexlens/lsp/handlers.py` (NEW)

```python
"""LSP request handlers."""

import logging
from pathlib import Path
from typing import List, Optional, Union

from lsprotocol import types as lsp

from codexlens.lsp.server import server
from codexlens.entities import Symbol

logger = logging.getLogger(__name__)


def symbol_to_location(symbol: Symbol) -> lsp.Location:
    """Convert codex-lens Symbol to LSP Location."""
    return lsp.Location(
        uri=f"file://{symbol.file_path}",
        range=lsp.Range(
            start=lsp.Position(
                line=symbol.range[0] - 1,  # LSP is 0-indexed
                character=0,
            ),
            end=lsp.Position(
                line=symbol.range[1] - 1,
                character=0,
            ),
        ),
    )


@server.feature(lsp.TEXT_DOCUMENT_DEFINITION)
def on_definition(
    params: lsp.DefinitionParams,
) -> Optional[Union[lsp.Location, List[lsp.Location]]]:
    """Handle textDocument/definition request."""
    if not server.global_index:
        return None

    # Get the word at cursor position
    document = server.workspace.get_text_document(params.text_document.uri)
    word = _get_word_at_position(document, params.position)

    if not word:
        return None

    logger.debug(f"Definition lookup for: {word}")

    # Search in global symbol index
    symbols = server.global_index.search(word, exact=True, limit=10)

    if not symbols:
        return None

    if len(symbols) == 1:
        return symbol_to_location(symbols[0])

    return [symbol_to_location(s) for s in symbols]


def _get_word_at_position(document, position: lsp.Position) -> Optional[str]:
    """Extract the word at the given position."""
    try:
        lines = document.source.split("\n")
        if position.line >= len(lines):
            return None

        line = lines[position.line]

        # Find word boundaries
        start = position.character
        end = position.character

        # Expand left
        while start > 0 and _is_identifier_char(line[start - 1]):
            start -= 1

        # Expand right
        while end < len(line) and _is_identifier_char(line[end]):
            end += 1

        word = line[start:end]
        return word if word else None
    except Exception as e:
        logger.error(f"Error extracting word: {e}")
        return None


def _is_identifier_char(char: str) -> bool:
    """Check if character is valid in an identifier."""
    return char.isalnum() or char == "_"
```

**Acceptance Criteria**:
- [ ] Returns Location for known symbols
- [ ] Returns None for unknown symbols
- [ ] Handles multiple definitions (overloads)

---

#### Task 1.4: Completion Handler

**File**: `src/codexlens/lsp/handlers.py` (APPEND)

```python
@server.feature(lsp.TEXT_DOCUMENT_COMPLETION)
def on_completion(
    params: lsp.CompletionParams,
) -> Optional[lsp.CompletionList]:
    """Handle textDocument/completion request."""
    if not server.global_index:
        return None

    # Get partial word at cursor
    document = server.workspace.get_text_document(params.text_document.uri)
    prefix = _get_prefix_at_position(document, params.position)

    if not prefix or len(prefix) < 2:
        return None

    logger.debug(f"Completion lookup for prefix: {prefix}")

    # Search with prefix mode
    symbols = server.global_index.search(prefix, prefix_mode=True, limit=50)

    if not symbols:
        return None

    items = []
    for symbol in symbols:
        kind = _symbol_kind_to_completion_kind(symbol.kind)
        items.append(
            lsp.CompletionItem(
                label=symbol.name,
                kind=kind,
                detail=f"{symbol.kind} in {Path(symbol.file_path).name}",
                documentation=lsp.MarkupContent(
                    kind=lsp.MarkupKind.Markdown,
                    value=f"Defined at line {symbol.range[0]}",
                ),
            )
        )

    return lsp.CompletionList(is_incomplete=len(items) >= 50, items=items)


def _get_prefix_at_position(document, position: lsp.Position) -> Optional[str]:
    """Extract the incomplete word prefix at position."""
    try:
        lines = document.source.split("\n")
        if position.line >= len(lines):
            return None

        line = lines[position.line]

        # Find prefix start
        start = position.character
        while start > 0 and _is_identifier_char(line[start - 1]):
            start -= 1

        return line[start:position.character] if start < position.character else None
    except Exception:
        return None


def _symbol_kind_to_completion_kind(kind: str) -> lsp.CompletionItemKind:
    """Map symbol kind to LSP completion kind."""
    mapping = {
        "function": lsp.CompletionItemKind.Function,
        "method": lsp.CompletionItemKind.Method,
        "class": lsp.CompletionItemKind.Class,
        "variable": lsp.CompletionItemKind.Variable,
        "constant": lsp.CompletionItemKind.Constant,
        "module": lsp.CompletionItemKind.Module,
        "property": lsp.CompletionItemKind.Property,
        "interface": lsp.CompletionItemKind.Interface,
        "enum": lsp.CompletionItemKind.Enum,
    }
    return mapping.get(kind.lower(), lsp.CompletionItemKind.Text)
```

**Acceptance Criteria**:
- [ ] Returns completion items for valid prefixes
- [ ] Respects minimum prefix length (2 chars)
- [ ] Maps symbol kinds correctly

---

#### Task 1.5: Workspace Symbol Handler

**File**: `src/codexlens/lsp/handlers.py` (APPEND)

```python
@server.feature(lsp.WORKSPACE_SYMBOL)
def on_workspace_symbol(
    params: lsp.WorkspaceSymbolParams,
) -> Optional[List[lsp.SymbolInformation]]:
    """Handle workspace/symbol request."""
    if not server.search_engine or not server.workspace_path:
        return None

    query = params.query
    if not query or len(query) < 2:
        return None

    logger.debug(f"Workspace symbol search: {query}")

    # Use chain search engine's symbol search
    result = server.search_engine.search_symbols(
        query=query,
        source_path=server.workspace_path,
        limit=100,
    )

    if not result:
        return None

    items = []
    for symbol in result:
        kind = _symbol_kind_to_symbol_kind(symbol.kind)
        items.append(
            lsp.SymbolInformation(
                name=symbol.name,
                kind=kind,
                location=symbol_to_location(symbol),
                container_name=Path(symbol.file_path).parent.name,
            )
        )

    return items


def _symbol_kind_to_symbol_kind(kind: str) -> lsp.SymbolKind:
    """Map symbol kind string to LSP SymbolKind."""
    mapping = {
        "function": lsp.SymbolKind.Function,
        "method": lsp.SymbolKind.Method,
        "class": lsp.SymbolKind.Class,
        "variable": lsp.SymbolKind.Variable,
        "constant": lsp.SymbolKind.Constant,
        "module": lsp.SymbolKind.Module,
        "property": lsp.SymbolKind.Property,
        "interface": lsp.SymbolKind.Interface,
        "enum": lsp.SymbolKind.Enum,
        "struct": lsp.SymbolKind.Struct,
        "namespace": lsp.SymbolKind.Namespace,
    }
    return mapping.get(kind.lower(), lsp.SymbolKind.Variable)
```

**Acceptance Criteria**:
- [ ] Returns symbols matching query
- [ ] Respects result limit
- [ ] Includes container information

---

#### Task 1.6: File Watcher Integration

**File**: `src/codexlens/lsp/handlers.py` (APPEND)

```python
@server.feature(lsp.TEXT_DOCUMENT_DID_SAVE)
def on_did_save(params: lsp.DidSaveTextDocumentParams) -> None:
    """Handle textDocument/didSave notification."""
    if not server.watcher:
        return

    file_path = Path(params.text_document.uri.replace("file://", ""))
    logger.debug(f"File saved: {file_path}")

    # Trigger incremental indexing
    server.watcher.trigger_index(file_path)


@server.feature(lsp.TEXT_DOCUMENT_DID_OPEN)
def on_did_open(params: lsp.DidOpenTextDocumentParams) -> None:
    """Handle textDocument/didOpen notification."""
    logger.debug(f"File opened: {params.text_document.uri}")


@server.feature(lsp.TEXT_DOCUMENT_DID_CLOSE)
def on_did_close(params: lsp.DidCloseTextDocumentParams) -> None:
    """Handle textDocument/didClose notification."""
    logger.debug(f"File closed: {params.text_document.uri}")
```

**Acceptance Criteria**:
- [ ] didSave triggers incremental index
- [ ] No blocking on save
- [ ] Proper logging

---

### 4.3 Phase 1 Test Plan

**File**: `tests/lsp/test_server.py` (NEW)

```python
"""Tests for LSP server."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch

from lsprotocol import types as lsp

from codexlens.lsp.server import CodexLensLanguageServer, on_initialize


class TestServerInitialization:
    """Test server lifecycle."""

    def test_initialize_creates_components(self, tmp_path):
        """Server creates all components on initialize."""
        server = CodexLensLanguageServer("test", "0.1.0")

        params = lsp.InitializeParams(
            root_uri=f"file://{tmp_path}",
            capabilities=lsp.ClientCapabilities(),
        )

        result = on_initialize(params)

        assert result.capabilities.definition_provider
        assert result.capabilities.completion_provider
        assert result.capabilities.workspace_symbol_provider


class TestDefinitionHandler:
    """Test textDocument/definition handler."""

    def test_definition_returns_location(self):
        """Definition returns valid Location."""
        # Setup mock global index
        mock_symbol = Mock()
        mock_symbol.file_path = "/test/file.py"
        mock_symbol.range = (10, 15)

        with patch.object(server, 'global_index') as mock_index:
            mock_index.search.return_value = [mock_symbol]

            # Call handler
            result = on_definition(Mock(
                text_document=Mock(uri="file:///test/file.py"),
                position=lsp.Position(line=5, character=10),
            ))

            assert isinstance(result, lsp.Location)
            assert result.uri == "file:///test/file.py"


class TestCompletionHandler:
    """Test textDocument/completion handler."""

    def test_completion_returns_items(self):
        """Completion returns CompletionList."""
        # Test implementation
        pass
```

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Coverage > 80% for LSP module
- [ ] Integration test with real workspace

---

## 5. Phase 2: Find References

### 5.1 Overview

| Attribute | Value |
|-----------|-------|
| Priority | MEDIUM |
| Complexity | High |
| Dependencies | Phase 1 complete |
| Deliverables | `search_references()` method + LSP handler |

### 5.2 Task Breakdown

#### Task 2.1: Add `search_references` to ChainSearchEngine

**File**: `src/codexlens/search/chain_search.py` (MODIFY)

```python
# Add to ChainSearchEngine class

from dataclasses import dataclass
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed


@dataclass
class ReferenceResult:
    """Result from reference search."""
    file_path: str
    line: int
    column: int
    context: str  # Surrounding code snippet
    relationship_type: str  # "call", "import", "inheritance", etc.


def search_references(
    self,
    symbol_name: str,
    source_path: Optional[Path] = None,
    depth: int = -1,
    limit: int = 100,
) -> List[ReferenceResult]:
    """Find all references to a symbol across the project.

    Args:
        symbol_name: Fully qualified or simple name of the symbol
        source_path: Starting path for search (default: workspace root)
        depth: Search depth (-1 = unlimited)
        limit: Maximum results to return

    Returns:
        List of ReferenceResult objects sorted by file path and line
    """
    source = source_path or self._workspace_path

    # Collect all index paths
    index_paths = self._collect_index_paths(source, depth)

    if not index_paths:
        logger.warning(f"No indexes found for reference search: {source}")
        return []

    # Parallel query across all indexes
    all_results: List[ReferenceResult] = []

    with ThreadPoolExecutor(max_workers=self._options.max_workers) as executor:
        futures = {
            executor.submit(
                self._search_references_single,
                idx_path,
                symbol_name,
            ): idx_path
            for idx_path in index_paths
        }

        for future in as_completed(futures):
            try:
                results = future.result(timeout=10)
                all_results.extend(results)
            except Exception as e:
                logger.error(f"Reference search failed: {e}")

    # Sort and limit
    all_results.sort(key=lambda r: (r.file_path, r.line))
    return all_results[:limit]


def _search_references_single(
    self,
    index_path: Path,
    symbol_name: str,
) -> List[ReferenceResult]:
    """Search for references in a single index."""
    results = []

    try:
        store = DirIndexStore(index_path.parent)

        # Query code_relationships table
        query = """
            SELECT
                cr.source_file,
                cr.source_line,
                cr.source_column,
                cr.relationship_type,
                f.content
            FROM code_relationships cr
            JOIN files f ON f.full_path = cr.source_file
            WHERE cr.target_qualified_name LIKE ?
               OR cr.target_name = ?
            ORDER BY cr.source_file, cr.source_line
        """

        rows = store.execute_query(
            query,
            (f"%{symbol_name}", symbol_name),
        )

        for row in rows:
            # Extract context (3 lines around reference)
            content_lines = row["content"].split("\n")
            line_idx = row["source_line"] - 1
            start = max(0, line_idx - 1)
            end = min(len(content_lines), line_idx + 2)
            context = "\n".join(content_lines[start:end])

            results.append(ReferenceResult(
                file_path=row["source_file"],
                line=row["source_line"],
                column=row["source_column"] or 0,
                context=context,
                relationship_type=row["relationship_type"],
            ))
    except Exception as e:
        logger.error(f"Failed to search references in {index_path}: {e}")

    return results
```

**Acceptance Criteria**:
- [ ] Searches all index files in parallel
- [ ] Returns properly formatted ReferenceResult
- [ ] Handles missing indexes gracefully

---

#### Task 2.2: LSP References Handler

**File**: `src/codexlens/lsp/handlers.py` (APPEND)

```python
@server.feature(lsp.TEXT_DOCUMENT_REFERENCES)
def on_references(
    params: lsp.ReferenceParams,
) -> Optional[List[lsp.Location]]:
    """Handle textDocument/references request."""
    if not server.search_engine or not server.workspace_path:
        return None

    # Get the word at cursor
    document = server.workspace.get_text_document(params.text_document.uri)
    word = _get_word_at_position(document, params.position)

    if not word:
        return None

    logger.debug(f"References lookup for: {word}")

    # Search for references
    references = server.search_engine.search_references(
        symbol_name=word,
        source_path=server.workspace_path,
        limit=200,
    )

    if not references:
        return None

    # Convert to LSP Locations
    locations = []
    for ref in references:
        locations.append(
            lsp.Location(
                uri=f"file://{ref.file_path}",
                range=lsp.Range(
                    start=lsp.Position(line=ref.line - 1, character=ref.column),
                    end=lsp.Position(line=ref.line - 1, character=ref.column + len(word)),
                ),
            )
        )

    return locations
```

**Acceptance Criteria**:
- [ ] Returns all references across project
- [ ] Includes definition if `params.context.include_declaration`
- [ ] Performance < 200ms for typical project

---

### 5.3 Phase 2 Test Plan

```python
class TestReferencesSearch:
    """Test reference search functionality."""

    def test_finds_function_calls(self, indexed_project):
        """Finds all calls to a function."""
        results = search_engine.search_references("my_function")
        assert len(results) > 0
        assert all(r.relationship_type == "call" for r in results)

    def test_finds_imports(self, indexed_project):
        """Finds all imports of a module."""
        results = search_engine.search_references("my_module")
        assert any(r.relationship_type == "import" for r in results)

    def test_parallel_search_performance(self, large_project):
        """Parallel search completes within time limit."""
        import time
        start = time.time()
        results = search_engine.search_references("common_symbol")
        elapsed = time.time() - start
        assert elapsed < 0.2  # 200ms
```

---

## 6. Phase 3: Hover Information

### 6.1 Overview

| Attribute | Value |
|-----------|-------|
| Priority | MEDIUM |
| Complexity | Low |
| Dependencies | Phase 1 complete |
| Deliverables | Hover provider + LSP handler |

### 6.2 Task Breakdown

#### Task 3.1: Hover Provider

**File**: `src/codexlens/lsp/providers.py` (NEW)

```python
"""LSP feature providers."""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from codexlens.entities import Symbol
from codexlens.storage.sqlite_store import SQLiteStore

logger = logging.getLogger(__name__)


@dataclass
class HoverInfo:
    """Hover information for a symbol."""
    name: str
    kind: str
    signature: str
    documentation: Optional[str]
    file_path: str
    line_range: tuple


class HoverProvider:
    """Provides hover information for symbols."""

    def __init__(self, global_index, registry):
        self.global_index = global_index
        self.registry = registry

    def get_hover_info(self, symbol_name: str) -> Optional[HoverInfo]:
        """Get hover information for a symbol.

        Args:
            symbol_name: Name of the symbol to look up

        Returns:
            HoverInfo or None if symbol not found
        """
        # Look up symbol in global index
        symbols = self.global_index.search(symbol_name, exact=True, limit=1)

        if not symbols:
            return None

        symbol = symbols[0]

        # Extract signature from source
        signature = self._extract_signature(symbol)

        return HoverInfo(
            name=symbol.name,
            kind=symbol.kind,
            signature=signature,
            documentation=symbol.docstring,
            file_path=symbol.file_path,
            line_range=symbol.range,
        )

    def _extract_signature(self, symbol: Symbol) -> str:
        """Extract function/class signature from source."""
        try:
            # Find the index for this file
            index_path = self.registry.find_index_path(
                Path(symbol.file_path).parent
            )

            if not index_path:
                return f"{symbol.kind} {symbol.name}"

            store = SQLiteStore(index_path.parent)

            # Get file content
            rows = store.execute_query(
                "SELECT content FROM files WHERE full_path = ?",
                (symbol.file_path,),
            )

            if not rows:
                return f"{symbol.kind} {symbol.name}"

            content = rows[0]["content"]
            lines = content.split("\n")

            # Extract signature lines
            start_line = symbol.range[0] - 1
            signature_lines = []

            # Get first line (def/class declaration)
            if start_line < len(lines):
                first_line = lines[start_line]
                signature_lines.append(first_line)

                # Continue if line ends with backslash or doesn't have closing paren
                i = start_line + 1
                while i < len(lines) and i < start_line + 5:
                    if "):" in signature_lines[-1] or ":" in signature_lines[-1]:
                        break
                    signature_lines.append(lines[i])
                    i += 1

            return "\n".join(signature_lines)
        except Exception as e:
            logger.error(f"Failed to extract signature: {e}")
            return f"{symbol.kind} {symbol.name}"

    def format_hover_markdown(self, info: HoverInfo) -> str:
        """Format hover info as Markdown."""
        parts = []

        # Code block with signature
        parts.append(f"```python\n{info.signature}\n```")

        # Documentation if available
        if info.documentation:
            parts.append(f"\n---\n\n{info.documentation}")

        # Location info
        parts.append(
            f"\n---\n\n*{info.kind}* defined in "
            f"`{Path(info.file_path).name}` "
            f"(line {info.line_range[0]})"
        )

        return "\n".join(parts)
```

---

#### Task 3.2: LSP Hover Handler

**File**: `src/codexlens/lsp/handlers.py` (APPEND)

```python
from codexlens.lsp.providers import HoverProvider


@server.feature(lsp.TEXT_DOCUMENT_HOVER)
def on_hover(params: lsp.HoverParams) -> Optional[lsp.Hover]:
    """Handle textDocument/hover request."""
    if not server.global_index or not server.registry:
        return None

    # Get word at cursor
    document = server.workspace.get_text_document(params.text_document.uri)
    word = _get_word_at_position(document, params.position)

    if not word:
        return None

    logger.debug(f"Hover lookup for: {word}")

    # Get hover info
    provider = HoverProvider(server.global_index, server.registry)
    info = provider.get_hover_info(word)

    if not info:
        return None

    # Format as markdown
    content = provider.format_hover_markdown(info)

    return lsp.Hover(
        contents=lsp.MarkupContent(
            kind=lsp.MarkupKind.Markdown,
            value=content,
        ),
    )
```

**Acceptance Criteria**:
- [ ] Shows function signature
- [ ] Shows documentation if available
- [ ] Shows file location

---

## 7. Phase 4: MCP Bridge

### 7.1 Overview

| Attribute | Value |
|-----------|-------|
| Priority | HIGH VALUE |
| Complexity | Medium |
| Dependencies | Phase 1-2 complete |
| Deliverables | MCP schema + provider + hook interfaces |

### 7.2 Task Breakdown

#### Task 4.1: MCP Schema Definition

**File**: `src/codexlens/mcp/__init__.py` (NEW)

```python
"""Model Context Protocol implementation for Claude Code integration."""

from codexlens.mcp.schema import (
    MCPContext,
    SymbolInfo,
    ReferenceInfo,
    RelatedSymbol,
)
from codexlens.mcp.provider import MCPProvider

__all__ = [
    "MCPContext",
    "SymbolInfo",
    "ReferenceInfo",
    "RelatedSymbol",
    "MCPProvider",
]
```

**File**: `src/codexlens/mcp/schema.py` (NEW)

```python
"""MCP data models."""

from dataclasses import dataclass, field, asdict
from typing import List, Optional
import json


@dataclass
class SymbolInfo:
    """Information about a code symbol."""
    name: str
    kind: str
    file_path: str
    line_start: int
    line_end: int
    signature: Optional[str] = None
    documentation: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ReferenceInfo:
    """Information about a symbol reference."""
    file_path: str
    line: int
    column: int
    context: str
    relationship_type: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RelatedSymbol:
    """Related symbol (import, call target, etc.)."""
    name: str
    kind: str
    relationship: str  # "imports", "calls", "inherits", "uses"
    file_path: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class MCPContext:
    """Model Context Protocol context object.

    This is the structured context that gets injected into
    LLM prompts to provide code understanding.
    """
    version: str = "1.0"
    context_type: str = "code_context"
    symbol: Optional[SymbolInfo] = None
    definition: Optional[str] = None
    references: List[ReferenceInfo] = field(default_factory=list)
    related_symbols: List[RelatedSymbol] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "version": self.version,
            "context_type": self.context_type,
            "metadata": self.metadata,
        }

        if self.symbol:
            result["symbol"] = self.symbol.to_dict()

        if self.definition:
            result["definition"] = self.definition

        if self.references:
            result["references"] = [r.to_dict() for r in self.references]

        if self.related_symbols:
            result["related_symbols"] = [s.to_dict() for s in self.related_symbols]

        return result

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def to_prompt_injection(self) -> str:
        """Format for injection into LLM prompt."""
        parts = ["<code_context>"]

        if self.symbol:
            parts.append(f"## Symbol: {self.symbol.name}")
            parts.append(f"Type: {self.symbol.kind}")
            parts.append(f"Location: {self.symbol.file_path}:{self.symbol.line_start}")

        if self.definition:
            parts.append("\n## Definition")
            parts.append(f"```\n{self.definition}\n```")

        if self.references:
            parts.append(f"\n## References ({len(self.references)} found)")
            for i, ref in enumerate(self.references[:5]):  # Limit to 5
                parts.append(f"- {ref.file_path}:{ref.line} ({ref.relationship_type})")
                parts.append(f"  ```\n  {ref.context}\n  ```")

        if self.related_symbols:
            parts.append("\n## Related Symbols")
            for sym in self.related_symbols[:10]:  # Limit to 10
                parts.append(f"- {sym.name} ({sym.relationship})")

        parts.append("</code_context>")

        return "\n".join(parts)
```

---

#### Task 4.2: MCP Provider

**File**: `src/codexlens/mcp/provider.py` (NEW)

```python
"""MCP context provider."""

import logging
from pathlib import Path
from typing import Optional, List

from codexlens.mcp.schema import (
    MCPContext,
    SymbolInfo,
    ReferenceInfo,
    RelatedSymbol,
)
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.storage.registry import RegistryStore

logger = logging.getLogger(__name__)


class MCPProvider:
    """Builds MCP context objects from codex-lens data."""

    def __init__(
        self,
        global_index: GlobalSymbolIndex,
        search_engine: ChainSearchEngine,
        registry: RegistryStore,
    ):
        self.global_index = global_index
        self.search_engine = search_engine
        self.registry = registry

    def build_context(
        self,
        symbol_name: str,
        context_type: str = "symbol_explanation",
        include_references: bool = True,
        include_related: bool = True,
        max_references: int = 10,
    ) -> Optional[MCPContext]:
        """Build comprehensive context for a symbol.

        Args:
            symbol_name: Name of the symbol to contextualize
            context_type: Type of context being requested
            include_references: Whether to include reference locations
            include_related: Whether to include related symbols
            max_references: Maximum number of references to include

        Returns:
            MCPContext object or None if symbol not found
        """
        # Look up symbol
        symbols = self.global_index.search(symbol_name, exact=True, limit=1)

        if not symbols:
            logger.warning(f"Symbol not found for MCP context: {symbol_name}")
            return None

        symbol = symbols[0]

        # Build SymbolInfo
        symbol_info = SymbolInfo(
            name=symbol.name,
            kind=symbol.kind,
            file_path=symbol.file_path,
            line_start=symbol.range[0],
            line_end=symbol.range[1],
            signature=getattr(symbol, 'signature', None),
            documentation=getattr(symbol, 'docstring', None),
        )

        # Extract definition source code
        definition = self._extract_definition(symbol)

        # Get references
        references = []
        if include_references:
            refs = self.search_engine.search_references(
                symbol_name,
                limit=max_references,
            )
            references = [
                ReferenceInfo(
                    file_path=r.file_path,
                    line=r.line,
                    column=r.column,
                    context=r.context,
                    relationship_type=r.relationship_type,
                )
                for r in refs
            ]

        # Get related symbols
        related_symbols = []
        if include_related:
            related_symbols = self._get_related_symbols(symbol)

        return MCPContext(
            context_type=context_type,
            symbol=symbol_info,
            definition=definition,
            references=references,
            related_symbols=related_symbols,
            metadata={
                "source": "codex-lens",
                "indexed_at": symbol.indexed_at if hasattr(symbol, 'indexed_at') else None,
            },
        )

    def _extract_definition(self, symbol) -> Optional[str]:
        """Extract source code for symbol definition."""
        try:
            index_path = self.registry.find_index_path(
                Path(symbol.file_path).parent
            )

            if not index_path:
                return None

            store = SQLiteStore(index_path.parent)
            rows = store.execute_query(
                "SELECT content FROM files WHERE full_path = ?",
                (symbol.file_path,),
            )

            if not rows:
                return None

            content = rows[0]["content"]
            lines = content.split("\n")

            # Extract symbol lines
            start = symbol.range[0] - 1
            end = symbol.range[1]

            return "\n".join(lines[start:end])
        except Exception as e:
            logger.error(f"Failed to extract definition: {e}")
            return None

    def _get_related_symbols(self, symbol) -> List[RelatedSymbol]:
        """Get symbols related to the given symbol."""
        related = []

        try:
            index_path = self.registry.find_index_path(
                Path(symbol.file_path).parent
            )

            if not index_path:
                return related

            store = SQLiteStore(index_path.parent)

            # Query relationships where this symbol is the source
            rows = store.execute_query(
                """
                SELECT target_name, target_qualified_name, relationship_type
                FROM code_relationships
                WHERE source_qualified_name LIKE ?
                LIMIT 20
                """,
                (f"%{symbol.name}%",),
            )

            for row in rows:
                related.append(RelatedSymbol(
                    name=row["target_name"],
                    kind="unknown",  # Would need another lookup
                    relationship=row["relationship_type"],
                ))
        except Exception as e:
            logger.error(f"Failed to get related symbols: {e}")

        return related

    def build_context_for_file(
        self,
        file_path: Path,
        context_type: str = "file_overview",
    ) -> MCPContext:
        """Build context for an entire file."""
        # Get all symbols in file
        symbols = self.global_index.search_by_file(str(file_path))

        related = [
            RelatedSymbol(
                name=s.name,
                kind=s.kind,
                relationship="defines",
            )
            for s in symbols
        ]

        return MCPContext(
            context_type=context_type,
            related_symbols=related,
            metadata={
                "file_path": str(file_path),
                "symbol_count": len(symbols),
            },
        )
```

---

#### Task 4.3: Hook Interfaces

**File**: `src/codexlens/mcp/hooks.py` (NEW)

```python
"""Hook interfaces for Claude Code integration."""

import logging
from pathlib import Path
from typing import Any, Dict, Optional, Callable

from codexlens.mcp.provider import MCPProvider
from codexlens.mcp.schema import MCPContext

logger = logging.getLogger(__name__)


class HookManager:
    """Manages hook registration and execution."""

    def __init__(self, mcp_provider: MCPProvider):
        self.mcp_provider = mcp_provider
        self._pre_hooks: Dict[str, Callable] = {}
        self._post_hooks: Dict[str, Callable] = {}

        # Register default hooks
        self._register_default_hooks()

    def _register_default_hooks(self):
        """Register built-in hooks."""
        self._pre_hooks["explain"] = self._pre_explain_hook
        self._pre_hooks["refactor"] = self._pre_refactor_hook
        self._pre_hooks["document"] = self._pre_document_hook

    def execute_pre_hook(
        self,
        action: str,
        params: Dict[str, Any],
    ) -> Optional[MCPContext]:
        """Execute pre-tool hook to gather context.

        Args:
            action: The action being performed (e.g., "explain", "refactor")
            params: Parameters for the action

        Returns:
            MCPContext to inject into prompt, or None
        """
        hook = self._pre_hooks.get(action)

        if not hook:
            logger.debug(f"No pre-hook for action: {action}")
            return None

        try:
            return hook(params)
        except Exception as e:
            logger.error(f"Pre-hook failed for {action}: {e}")
            return None

    def execute_post_hook(
        self,
        action: str,
        result: Any,
    ) -> None:
        """Execute post-tool hook for proactive caching.

        Args:
            action: The action that was performed
            result: Result of the action
        """
        hook = self._post_hooks.get(action)

        if not hook:
            return

        try:
            hook(result)
        except Exception as e:
            logger.error(f"Post-hook failed for {action}: {e}")

    def _pre_explain_hook(self, params: Dict[str, Any]) -> Optional[MCPContext]:
        """Pre-hook for 'explain' action."""
        symbol_name = params.get("symbol")

        if not symbol_name:
            return None

        return self.mcp_provider.build_context(
            symbol_name=symbol_name,
            context_type="symbol_explanation",
            include_references=True,
            include_related=True,
        )

    def _pre_refactor_hook(self, params: Dict[str, Any]) -> Optional[MCPContext]:
        """Pre-hook for 'refactor' action."""
        symbol_name = params.get("symbol")

        if not symbol_name:
            return None

        return self.mcp_provider.build_context(
            symbol_name=symbol_name,
            context_type="refactor_context",
            include_references=True,  # Important for refactoring
            include_related=True,
            max_references=20,  # More references for refactoring
        )

    def _pre_document_hook(self, params: Dict[str, Any]) -> Optional[MCPContext]:
        """Pre-hook for 'document' action."""
        symbol_name = params.get("symbol")
        file_path = params.get("file_path")

        if symbol_name:
            return self.mcp_provider.build_context(
                symbol_name=symbol_name,
                context_type="documentation_context",
                include_references=False,
                include_related=True,
            )
        elif file_path:
            return self.mcp_provider.build_context_for_file(
                Path(file_path),
                context_type="file_documentation",
            )

        return None

    def register_pre_hook(
        self,
        action: str,
        hook: Callable[[Dict[str, Any]], Optional[MCPContext]],
    ) -> None:
        """Register a custom pre-tool hook."""
        self._pre_hooks[action] = hook

    def register_post_hook(
        self,
        action: str,
        hook: Callable[[Any], None],
    ) -> None:
        """Register a custom post-tool hook."""
        self._post_hooks[action] = hook


# Convenience function for Claude Code integration
def create_context_for_prompt(
    mcp_provider: MCPProvider,
    action: str,
    params: Dict[str, Any],
) -> str:
    """Create context string for prompt injection.

    This is the main entry point for Claude Code hook integration.

    Args:
        mcp_provider: The MCP provider instance
        action: Action being performed
        params: Action parameters

    Returns:
        Formatted context string for prompt injection
    """
    manager = HookManager(mcp_provider)
    context = manager.execute_pre_hook(action, params)

    if context:
        return context.to_prompt_injection()

    return ""
```

---

## 8. Phase 5: Advanced Features

### 8.1 Custom LSP Commands

**File**: `src/codexlens/lsp/handlers.py` (APPEND)

```python
# Custom commands for advanced features

@server.command("codexlens.hybridSearch")
def cmd_hybrid_search(params: List[Any]) -> dict:
    """Execute hybrid search combining FTS and semantic."""
    if len(params) < 1:
        return {"error": "Query required"}

    query = params[0]
    limit = params[1] if len(params) > 1 else 20

    from codexlens.search.hybrid_search import HybridSearchEngine

    engine = HybridSearchEngine(server.search_engine.store)
    results = engine.search(query, limit=limit)

    return {
        "results": [
            {
                "path": r.path,
                "score": r.score,
                "excerpt": r.excerpt,
            }
            for r in results
        ]
    }


@server.command("codexlens.getMCPContext")
def cmd_get_mcp_context(params: List[Any]) -> dict:
    """Get MCP context for a symbol."""
    if len(params) < 1:
        return {"error": "Symbol name required"}

    symbol_name = params[0]
    context_type = params[1] if len(params) > 1 else "symbol_explanation"

    from codexlens.mcp.provider import MCPProvider

    provider = MCPProvider(
        server.global_index,
        server.search_engine,
        server.registry,
    )

    context = provider.build_context(symbol_name, context_type)

    if context:
        return context.to_dict()

    return {"error": "Symbol not found"}
```

### 8.2 Performance Optimizations

**File**: `src/codexlens/lsp/cache.py` (NEW)

```python
"""Caching layer for LSP performance."""

import time
from functools import lru_cache
from typing import Any, Dict, Optional
from threading import Lock


class LRUCacheWithTTL:
    """LRU cache with time-to-live expiration."""

    def __init__(self, maxsize: int = 1000, ttl_seconds: int = 300):
        self.maxsize = maxsize
        self.ttl = ttl_seconds
        self._cache: Dict[str, tuple] = {}  # key -> (value, timestamp)
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        with self._lock:
            if key not in self._cache:
                return None

            value, timestamp = self._cache[key]

            if time.time() - timestamp > self.ttl:
                del self._cache[key]
                return None

            return value

    def set(self, key: str, value: Any) -> None:
        """Set value in cache."""
        with self._lock:
            # Evict oldest if at capacity
            if len(self._cache) >= self.maxsize:
                oldest_key = min(
                    self._cache.keys(),
                    key=lambda k: self._cache[k][1],
                )
                del self._cache[oldest_key]

            self._cache[key] = (value, time.time())

    def invalidate(self, key: str) -> None:
        """Remove key from cache."""
        with self._lock:
            self._cache.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all keys with given prefix."""
        with self._lock:
            keys_to_remove = [
                k for k in self._cache.keys()
                if k.startswith(prefix)
            ]
            for key in keys_to_remove:
                del self._cache[key]

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()


# Global cache instances
definition_cache = LRUCacheWithTTL(maxsize=500, ttl_seconds=300)
references_cache = LRUCacheWithTTL(maxsize=200, ttl_seconds=60)
completion_cache = LRUCacheWithTTL(maxsize=100, ttl_seconds=30)
```

---

## 9. Testing Strategy

### 9.1 Test Structure

```
tests/
├── lsp/
│   ├── __init__.py
│   ├── conftest.py              # Fixtures
│   ├── test_server.py           # Server lifecycle
│   ├── test_definition.py       # Definition handler
│   ├── test_references.py       # References handler
│   ├── test_completion.py       # Completion handler
│   ├── test_hover.py            # Hover handler
│   └── test_workspace_symbol.py # Workspace symbol
│
├── mcp/
│   ├── __init__.py
│   ├── test_schema.py           # MCP schema validation
│   ├── test_provider.py         # Context building
│   └── test_hooks.py            # Hook execution
│
└── integration/
    ├── __init__.py
    ├── test_lsp_client.py       # Full LSP handshake
    └── test_mcp_flow.py         # End-to-end MCP flow
```

### 9.2 Fixtures

**File**: `tests/lsp/conftest.py`

```python
"""Test fixtures for LSP tests."""

import pytest
from pathlib import Path
import tempfile
import shutil

from codexlens.lsp.server import CodexLensLanguageServer


@pytest.fixture
def temp_workspace():
    """Create temporary workspace with sample files."""
    tmpdir = Path(tempfile.mkdtemp())

    # Create sample Python files
    (tmpdir / "main.py").write_text("""
def main():
    result = helper_function(42)
    print(result)

def helper_function(x):
    return x * 2
""")

    (tmpdir / "utils.py").write_text("""
from main import helper_function

class Calculator:
    def add(self, a, b):
        return a + b

    def multiply(self, a, b):
        return helper_function(a) * b
""")

    yield tmpdir

    shutil.rmtree(tmpdir)


@pytest.fixture
def indexed_workspace(temp_workspace):
    """Workspace with built indexes."""
    from codexlens.cli.commands import index_directory

    index_directory(temp_workspace)

    return temp_workspace


@pytest.fixture
def lsp_server(indexed_workspace):
    """Initialized LSP server."""
    server = CodexLensLanguageServer("test", "0.1.0")
    server.initialize_codexlens(indexed_workspace)

    yield server

    server.shutdown_codexlens()
```

### 9.3 Performance Benchmarks

**File**: `tests/benchmarks/test_performance.py`

```python
"""Performance benchmarks for LSP operations."""

import pytest
import time


class TestPerformance:
    """Performance benchmark tests."""

    @pytest.mark.benchmark
    def test_definition_latency(self, lsp_server, benchmark):
        """Definition lookup should be < 50ms."""
        def lookup():
            return lsp_server.global_index.search("helper_function", exact=True)

        result = benchmark(lookup)
        assert benchmark.stats.stats.mean < 0.05  # 50ms

    @pytest.mark.benchmark
    def test_completion_latency(self, lsp_server, benchmark):
        """Completion should be < 100ms."""
        def complete():
            return lsp_server.global_index.search("help", prefix_mode=True, limit=50)

        result = benchmark(complete)
        assert benchmark.stats.stats.mean < 0.1  # 100ms

    @pytest.mark.benchmark
    def test_references_latency(self, lsp_server, benchmark):
        """References should be < 200ms."""
        def find_refs():
            return lsp_server.search_engine.search_references("helper_function")

        result = benchmark(find_refs)
        assert benchmark.stats.stats.mean < 0.2  # 200ms
```

---

## 10. Deployment Guide

### 10.1 Installation

```bash
# Install with LSP support
pip install codex-lens[lsp]

# Or from source
git clone https://github.com/your-org/codex-lens.git
cd codex-lens
pip install -e ".[lsp]"
```

### 10.2 VS Code Configuration

**File**: `.vscode/settings.json`

```json
{
    "codexlens.enable": true,
    "codexlens.serverPath": "codexlens-lsp",
    "codexlens.serverArgs": ["--stdio"],
    "codexlens.trace.server": "verbose"
}
```

### 10.3 Neovim Configuration

**File**: `~/.config/nvim/lua/lsp/codexlens.lua`

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

configs.codexlens = {
    default_config = {
        cmd = { 'codexlens-lsp', '--stdio' },
        filetypes = { 'python', 'javascript', 'typescript' },
        root_dir = lspconfig.util.root_pattern('.git', 'pyproject.toml'),
        settings = {},
    },
}

lspconfig.codexlens.setup{}
```

### 10.4 Claude Code Integration

**File**: `~/.claude/hooks/pre-tool.sh`

```bash
#!/bin/bash
# Pre-tool hook for Claude Code

ACTION="$1"
PARAMS="$2"

# Call codex-lens MCP provider
python -c "
from codexlens.mcp.hooks import create_context_for_prompt
from codexlens.mcp.provider import MCPProvider
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
import json

# Initialize components
registry = RegistryStore()
registry.initialize()
mapper = PathMapper()
search = ChainSearchEngine(registry, mapper)
global_idx = GlobalSymbolIndex(Path.cwd())

provider = MCPProvider(global_idx, search, registry)

params = json.loads('$PARAMS')
context = create_context_for_prompt(provider, '$ACTION', params)
print(context)
"
```

---

## 11. Risk Mitigation

### 11.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| pygls compatibility issues | Low | High | Pin version, test on multiple platforms |
| Performance degradation | Medium | Medium | Implement caching, benchmark tests |
| Index corruption | Low | High | Use WAL mode, implement recovery |
| Memory leaks in long sessions | Medium | Medium | Implement connection pooling, periodic cleanup |
| Hook execution timeout | Medium | Low | Implement timeout limits, async execution |

### 11.2 Fallback Strategies

1. **Index not available**: Return empty results, don't block LSP
2. **Search timeout**: Return partial results with warning
3. **WatcherManager crash**: Auto-restart with exponential backoff
4. **MCP generation failure**: Return minimal context, log error

### 11.3 Monitoring

```python
# Add to server.py

import prometheus_client

# Metrics
DEFINITION_LATENCY = prometheus_client.Histogram(
    'codexlens_definition_latency_seconds',
    'Time to process definition request',
)
REFERENCES_LATENCY = prometheus_client.Histogram(
    'codexlens_references_latency_seconds',
    'Time to process references request',
)
INDEX_SIZE = prometheus_client.Gauge(
    'codexlens_index_symbols_total',
    'Total symbols in index',
)
```

---

## Appendix: Quick Reference

### File Creation Summary

| Phase | File | Type |
|-------|------|------|
| 1 | `src/codexlens/lsp/__init__.py` | NEW |
| 1 | `src/codexlens/lsp/server.py` | NEW |
| 1 | `src/codexlens/lsp/handlers.py` | NEW |
| 2 | `src/codexlens/search/chain_search.py` | MODIFY |
| 3 | `src/codexlens/lsp/providers.py` | NEW |
| 4 | `src/codexlens/mcp/__init__.py` | NEW |
| 4 | `src/codexlens/mcp/schema.py` | NEW |
| 4 | `src/codexlens/mcp/provider.py` | NEW |
| 4 | `src/codexlens/mcp/hooks.py` | NEW |
| 5 | `src/codexlens/lsp/cache.py` | NEW |

### Command Reference

```bash
# Start LSP server
codexlens-lsp --stdio

# Start with TCP (for debugging)
codexlens-lsp --tcp --port 2087

# Run tests
pytest tests/lsp/ -v

# Run benchmarks
pytest tests/benchmarks/ --benchmark-only

# Check coverage
pytest tests/lsp/ --cov=codexlens.lsp --cov-report=html
```

---

**Document End**
