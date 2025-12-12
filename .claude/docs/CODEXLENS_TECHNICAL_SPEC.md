# CodexLens 技术方案

> 融合 code-index-mcp 与 codanna 最佳特性的代码智能分析平台
>
> 目标：接入 CCW (Claude Code Workflow) 工具端点

---

## 目录

1. [项目概览](#1-项目概览)
2. [架构设计](#2-架构设计)
3. [目录结构](#3-目录结构)
4. [核心模块设计](#4-核心模块设计)
5. [CCW 集成设计](#5-ccw-集成设计)
6. [数据存储设计](#6-数据存储设计)
7. [语义搜索架构](#7-语义搜索架构)
8. [CLI 命令设计](#8-cli-命令设计)
9. [开发路线图](#9-开发路线图)
10. [技术依赖](#10-技术依赖)
11. [npm 分发策略](#11-npm-分发策略)

---

## 1. 项目概览

### 1.1 项目信息

| 属性 | 值 |
|------|-----|
| **项目名称** | CodexLens |
| **包名** | `codex_lens` |
| **语言** | Python 3.10+ |
| **定位** | 多模态代码分析平台 |
| **集成目标** | CCW 工具端点 (`D:\Claude_dms3\ccw`) |

### 1.2 核心能力

```
┌─────────────────────────────────────────────────────────────┐
│                      CodexLens 能力矩阵                      │
├─────────────────────────────────────────────────────────────┤
│  🔍 结构索引     │ AST 解析、符号提取、调用关系图            │
│  🧠 语义搜索     │ 自然语言查询、向量嵌入、相似度匹配        │
│  📊 代码分析     │ 复杂度计算、影响分析、依赖追踪            │
│  🔗 CCW 集成     │ JSON 协议、工具注册、命令行接口           │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 设计原则

- **CLI-First**: 无服务器依赖，通过命令行调用
- **JSON 协议**: 标准化输入输出，便于 CCW 解析
- **增量索引**: 仅处理变更文件，提升性能
- **可选语义**: 语义搜索作为可选功能，保持核心轻量

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                           CCW 层                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ccw/src/tools/codex-lens.js (CCW Tool Wrapper)         │    │
│  │  - 注册 CodexLens 工具到 CCW                             │    │
│  │  - 参数验证与转换                                        │    │
│  │  - 调用 Python CLI                                       │    │
│  │  - 解析 JSON 输出                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ spawn / exec
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CodexLens CLI                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  codexlens <command> [options] --json                    │    │
│  │                                                          │    │
│  │  Commands:                                               │    │
│  │  - init          初始化项目索引                          │    │
│  │  - search        文本/正则搜索                           │    │
│  │  - find          文件查找 (glob)                         │    │
│  │  - symbol        符号查找                                │    │
│  │  - inspect       文件/符号详情                           │    │
│  │  - graph         调用关系图                              │    │
│  │  - semantic      语义搜索 (可选)                         │    │
│  │  - status        索引状态                                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Engine                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Indexer    │  │   Searcher   │  │   Analyzer   │          │
│  │  (索引引擎)   │  │  (搜索引擎)   │  │  (分析引擎)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Storage Layer                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │   SQLite    │  │  ChromaDB   │  │  FileCache  │      │    │
│  │  │ (符号索引)   │  │ (向量存储)   │  │ (文件缓存)   │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户/CCW 请求
      │
      ▼
┌─────────────┐
│  CLI 解析   │ ──→ 验证参数 ──→ 加载配置
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 命令路由器  │ ──→ 选择处理器
└──────┬──────┘
       │
       ├──→ SearchHandler ──→ ripgrep/SQLite
       ├──→ SymbolHandler ──→ SQLite 符号表
       ├──→ GraphHandler  ──→ NetworkX 图
       └──→ SemanticHandler ──→ ChromaDB 向量
              │
              ▼
┌─────────────┐
│ JSON 输出   │ ──→ stdout
└─────────────┘
```

---

## 3. 目录结构

### 3.1 Python 项目结构

```
codex-lens/
├── .codexlens/                   # 项目级配置目录 (git ignored)
│   ├── config.toml               # 项目配置
│   ├── index.db                  # SQLite 索引
│   └── vectors/                  # ChromaDB 向量存储
│
├── src/
│   └── codex_lens/
│       ├── __init__.py
│       ├── __main__.py           # python -m codex_lens 入口
│       │
│       ├── cli/                  # CLI 层
│       │   ├── __init__.py
│       │   ├── main.py           # Typer 应用主入口
│       │   ├── commands/         # 命令实现
│       │   │   ├── __init__.py
│       │   │   ├── init.py       # codexlens init
│       │   │   ├── search.py     # codexlens search
│       │   │   ├── find.py       # codexlens find
│       │   │   ├── symbol.py     # codexlens symbol
│       │   │   ├── inspect.py    # codexlens inspect
│       │   │   ├── graph.py      # codexlens graph
│       │   │   ├── semantic.py   # codexlens semantic
│       │   │   └── status.py     # codexlens status
│       │   └── output.py         # JSON 输出格式化
│       │
│       ├── core/                 # 核心领域层
│       │   ├── __init__.py
│       │   ├── entities.py       # 数据实体: Symbol, File, Relation
│       │   ├── interfaces.py     # 抽象接口: Indexer, Searcher
│       │   ├── config.py         # Pydantic 配置模型
│       │   └── errors.py         # 自定义异常
│       │
│       ├── engine/               # 引擎层
│       │   ├── __init__.py
│       │   ├── indexer.py        # 索引编排器
│       │   ├── searcher.py       # 搜索编排器
│       │   ├── analyzer.py       # 分析编排器
│       │   └── watcher.py        # 文件监控 (可选)
│       │
│       ├── parsing/              # 解析层
│       │   ├── __init__.py
│       │   ├── base.py           # ParsingStrategy ABC
│       │   ├── factory.py        # 策略工厂
│       │   ├── python_parser.py  # Python AST 解析
│       │   ├── js_parser.py      # JavaScript/TS 解析
│       │   ├── rust_parser.py    # Rust 解析
│       │   └── fallback.py       # 通用回退解析
│       │
│       ├── semantic/             # 语义搜索层 (可选)
│       │   ├── __init__.py
│       │   ├── embedder.py       # 嵌入生成器
│       │   ├── chunker.py        # 代码分块
│       │   └── search.py         # 向量搜索
│       │
│       ├── storage/              # 存储层
│       │   ├── __init__.py
│       │   ├── sqlite_store.py   # SQLite 存储
│       │   ├── vector_store.py   # ChromaDB 适配
│       │   └── file_cache.py     # 文件哈希缓存
│       │
│       └── utils/                # 工具层
│           ├── __init__.py
│           ├── git.py            # Git 集成
│           ├── ripgrep.py        # ripgrep 包装
│           └── logging.py        # 日志配置
│
├── tests/                        # 测试
│   ├── __init__.py
│   ├── test_indexer.py
│   ├── test_search.py
│   └── fixtures/
│
├── pyproject.toml                # 项目配置
├── codexlens.spec                # PyInstaller 配置
└── README.md
```

### 3.2 CCW 集成文件

```
D:\Claude_dms3\ccw\src\tools\
└── codex-lens.js                 # CCW 工具包装器
```

---

## 4. 核心模块设计

### 4.1 核心实体 (`core/entities.py`)

```python
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum

class SymbolType(Enum):
    FUNCTION = "function"
    CLASS = "class"
    METHOD = "method"
    VARIABLE = "variable"
    INTERFACE = "interface"
    MODULE = "module"
    IMPORT = "import"

class RelationType(Enum):
    CALLS = "calls"
    CALLED_BY = "called_by"
    IMPORTS = "imports"
    IMPORTED_BY = "imported_by"
    EXTENDS = "extends"
    IMPLEMENTS = "implements"

@dataclass
class Location:
    """代码位置"""
    file_path: str
    line_start: int
    line_end: int
    column_start: int = 0
    column_end: int = 0

@dataclass
class Symbol:
    """代码符号"""
    id: str                           # 唯一标识: file_path::name
    name: str                         # 符号名称
    short_name: str                   # 短名称 (用于模糊匹配)
    type: SymbolType                  # 符号类型
    location: Location                # 位置信息
    signature: Optional[str] = None   # 函数签名
    docstring: Optional[str] = None   # 文档字符串
    language: str = "unknown"         # 语言
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class FileInfo:
    """文件信息"""
    path: str                         # 相对路径
    language: str                     # 语言
    line_count: int                   # 行数
    hash: str                         # 内容哈希 (用于增量索引)
    imports: List[str] = field(default_factory=list)
    exports: List[str] = field(default_factory=list)
    symbols: List[str] = field(default_factory=list)  # symbol_ids

@dataclass
class Relation:
    """符号关系"""
    source_id: str                    # 源符号 ID
    target_id: str                    # 目标符号 ID
    relation_type: RelationType       # 关系类型
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SearchResult:
    """搜索结果"""
    file_path: str
    line: int
    column: int
    content: str
    context_before: List[str] = field(default_factory=list)
    context_after: List[str] = field(default_factory=list)
    score: float = 1.0                # 相关性得分
```

### 4.2 配置模型 (`core/config.py`)

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path

class IndexConfig(BaseModel):
    """索引配置"""
    include_patterns: List[str] = Field(
        default=["**/*.py", "**/*.js", "**/*.ts", "**/*.rs"],
        description="包含的文件模式"
    )
    exclude_patterns: List[str] = Field(
        default=["**/node_modules/**", "**/.git/**", "**/dist/**", "**/__pycache__/**"],
        description="排除的文件模式"
    )
    max_file_size: int = Field(
        default=1024 * 1024,  # 1MB
        description="最大文件大小 (bytes)"
    )
    enable_semantic: bool = Field(
        default=False,
        description="启用语义搜索"
    )

class SemanticConfig(BaseModel):
    """语义搜索配置"""
    model_name: str = Field(
        default="all-MiniLM-L6-v2",
        description="嵌入模型名称"
    )
    chunk_size: int = Field(
        default=512,
        description="代码块大小 (tokens)"
    )
    chunk_overlap: int = Field(
        default=50,
        description="块重叠大小"
    )

class ProjectConfig(BaseModel):
    """项目配置"""
    project_root: Path
    index: IndexConfig = Field(default_factory=IndexConfig)
    semantic: SemanticConfig = Field(default_factory=SemanticConfig)

    @classmethod
    def load(cls, config_path: Path) -> "ProjectConfig":
        """从配置文件加载"""
        import tomli
        with open(config_path, "rb") as f:
            data = tomli.load(f)
        return cls(**data)

    def save(self, config_path: Path):
        """保存到配置文件"""
        import tomli_w
        with open(config_path, "wb") as f:
            tomli_w.dump(self.model_dump(), f)
```

### 4.3 解析策略接口 (`parsing/base.py`)

```python
from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any
from ..core.entities import Symbol, FileInfo

class ParsingStrategy(ABC):
    """语言解析策略基类"""

    @abstractmethod
    def get_language_name(self) -> str:
        """返回语言名称"""
        pass

    @abstractmethod
    def get_supported_extensions(self) -> List[str]:
        """返回支持的文件扩展名"""
        pass

    @abstractmethod
    def parse_file(
        self,
        file_path: str,
        content: str
    ) -> Tuple[List[Symbol], FileInfo, List[Dict[str, Any]]]:
        """
        解析文件

        Returns:
            - symbols: 提取的符号列表
            - file_info: 文件信息
            - pending_calls: 待解析的调用关系
        """
        pass

    def supports_file(self, file_path: str) -> bool:
        """检查是否支持该文件"""
        ext = file_path.rsplit(".", 1)[-1] if "." in file_path else ""
        return f".{ext}" in self.get_supported_extensions()
```

### 4.4 索引引擎 (`engine/indexer.py`)

```python
import hashlib
from pathlib import Path
from typing import List, Optional, Generator
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..core.config import ProjectConfig
from ..core.entities import Symbol, FileInfo, Relation
from ..parsing.factory import ParserFactory
from ..storage.sqlite_store import SQLiteStore
from ..storage.file_cache import FileCache
from ..utils.git import get_git_files

class Indexer:
    """索引引擎"""

    def __init__(self, config: ProjectConfig):
        self.config = config
        self.store = SQLiteStore(config.project_root / ".codexlens" / "index.db")
        self.cache = FileCache(config.project_root / ".codexlens" / "cache.json")
        self.parser_factory = ParserFactory()

    def build_index(self, incremental: bool = True) -> dict:
        """
        构建索引

        Args:
            incremental: 是否增量索引

        Returns:
            索引统计信息
        """
        stats = {
            "files_scanned": 0,
            "files_indexed": 0,
            "files_skipped": 0,
            "symbols_extracted": 0,
            "relations_resolved": 0,
            "errors": []
        }

        # 1. 发现文件
        files = list(self._discover_files())
        stats["files_scanned"] = len(files)

        # 2. 过滤需要重新索引的文件
        if incremental:
            files = self._filter_changed_files(files)

        # 3. 并行解析
        pending_calls = []
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {
                executor.submit(self._parse_file, f): f
                for f in files
            }

            for future in as_completed(futures):
                file_path = futures[future]
                try:
                    symbols, file_info, calls = future.result()

                    # 存储文件信息
                    self.store.upsert_file(file_info)

                    # 存储符号
                    for symbol in symbols:
                        self.store.upsert_symbol(symbol)
                        stats["symbols_extracted"] += 1

                    # 收集待解析调用
                    pending_calls.extend(calls)

                    # 更新缓存
                    self.cache.update(file_path, file_info.hash)
                    stats["files_indexed"] += 1

                except Exception as e:
                    stats["errors"].append({
                        "file": file_path,
                        "error": str(e)
                    })

        # 4. 解析调用关系
        stats["relations_resolved"] = self._resolve_calls(pending_calls)

        # 5. 保存缓存
        self.cache.save()

        return stats

    def _discover_files(self) -> Generator[str, None, None]:
        """发现项目文件"""
        # 优先使用 git ls-files
        git_files = get_git_files(self.config.project_root)
        if git_files:
            for f in git_files:
                if self._should_include(f):
                    yield f
        else:
            # 回退到 glob
            for pattern in self.config.index.include_patterns:
                for f in self.config.project_root.glob(pattern):
                    if self._should_include(str(f)):
                        yield str(f.relative_to(self.config.project_root))

    def _should_include(self, file_path: str) -> bool:
        """检查文件是否应该被索引"""
        from fnmatch import fnmatch
        for pattern in self.config.index.exclude_patterns:
            if fnmatch(file_path, pattern):
                return False
        return True

    def _filter_changed_files(self, files: List[str]) -> List[str]:
        """过滤出变更的文件"""
        changed = []
        for f in files:
            full_path = self.config.project_root / f
            current_hash = self._compute_hash(full_path)
            cached_hash = self.cache.get(f)
            if current_hash != cached_hash:
                changed.append(f)
        return changed

    def _compute_hash(self, file_path: Path) -> str:
        """计算文件哈希"""
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()

    def _parse_file(self, file_path: str):
        """解析单个文件"""
        full_path = self.config.project_root / file_path
        content = full_path.read_text(encoding="utf-8", errors="ignore")

        parser = self.parser_factory.get_parser(file_path)
        return parser.parse_file(file_path, content)

    def _resolve_calls(self, pending_calls: List[dict]) -> int:
        """解析调用关系"""
        resolved = 0
        for call in pending_calls:
            caller_id = call["caller_id"]
            callee_name = call["callee_name"]

            # 查找被调用符号
            callee = self.store.find_symbol_by_name(callee_name)
            if callee:
                relation = Relation(
                    source_id=caller_id,
                    target_id=callee.id,
                    relation_type="calls"
                )
                self.store.upsert_relation(relation)
                resolved += 1

        return resolved
```

---

## 5. CCW 集成设计

### 5.1 JSON 输出协议

所有 CLI 命令使用 `--json` 标志输出标准化 JSON。

**成功响应**:
```json
{
  "success": true,
  "data": {
    "results": [...],
    "metadata": {
      "count": 10,
      "elapsed_ms": 45,
      "mode": "exact"
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "INDEX_NOT_FOUND",
    "message": "Project not initialized. Run 'codexlens init' first.",
    "suggestion": "codexlens init /path/to/project"
  }
}
```

### 5.2 CCW 工具包装器 (`ccw/src/tools/codex-lens.js`)

```javascript
/**
 * CodexLens Tool - Code Intelligence Integration for CCW
 *
 * Provides:
 * - Symbol search and navigation
 * - Semantic code search
 * - Dependency graph analysis
 * - File inspection
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

// CodexLens binary path (configurable)
const CODEXLENS_BIN = process.env.CODEXLENS_BIN || 'codexlens';

/**
 * Execute CodexLens CLI command
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<Object>} - Parsed JSON result
 */
async function execCodexLens(args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEXLENS_BIN, [...args, '--json'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse CodexLens output: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to execute CodexLens: ${err.message}`));
    });
  });
}

/**
 * Main execute function
 */
async function execute(params) {
  const {
    command,
    query,
    path,
    mode = 'auto',
    limit = 50,
    contextLines = 2,
    includeRelations = false,
    projectPath = process.cwd()
  } = params;

  // Validate command
  const validCommands = ['search', 'find', 'symbol', 'inspect', 'graph', 'semantic', 'status', 'init'];
  if (!validCommands.includes(command)) {
    throw new Error(`Invalid command: ${command}. Valid: ${validCommands.join(', ')}`);
  }

  // Build arguments based on command
  const args = [command];

  switch (command) {
    case 'init':
      args.push(projectPath);
      break;

    case 'search':
      if (!query) throw new Error('Parameter "query" required for search');
      args.push(query);
      if (path) args.push('--path', path);
      args.push('--context', contextLines.toString());
      args.push('--limit', limit.toString());
      break;

    case 'find':
      if (!query) throw new Error('Parameter "query" (glob pattern) required for find');
      args.push(query);
      args.push('--limit', limit.toString());
      break;

    case 'symbol':
      if (!query) throw new Error('Parameter "query" (symbol name) required');
      args.push(query);
      args.push('--mode', mode);  // exact, fuzzy
      args.push('--limit', limit.toString());
      if (includeRelations) args.push('--relations');
      break;

    case 'inspect':
      if (!path) throw new Error('Parameter "path" required for inspect');
      args.push(path);
      break;

    case 'graph':
      if (!query) throw new Error('Parameter "query" (symbol name) required for graph');
      args.push(query);
      args.push('--depth', (params.depth || 2).toString());
      args.push('--direction', params.direction || 'both');  // callers, callees, both
      break;

    case 'semantic':
      if (!query) throw new Error('Parameter "query" required for semantic search');
      args.push(query);
      args.push('--limit', limit.toString());
      break;

    case 'status':
      // No additional args
      break;
  }

  // Execute command
  const result = await execCodexLens(args, projectPath);

  // Transform result for CCW consumption
  return {
    command,
    ...result,
    metadata: {
      ...result.metadata,
      tool: 'codex_lens',
      projectPath
    }
  };
}

/**
 * Tool Definition for CCW Registry
 */
export const codexLensTool = {
  name: 'codex_lens',
  description: `Code intelligence tool for symbol search, semantic search, and dependency analysis.

Commands:
- init: Initialize project index
- search: Text/regex code search (ripgrep backend)
- find: File path search (glob patterns)
- symbol: Symbol name lookup with optional relations
- inspect: Get file/symbol details
- graph: Dependency graph traversal
- semantic: Natural language code search
- status: Index status and statistics

Examples:
- Search for function: codex_lens symbol "handleRequest"
- Find files: codex_lens find "**/*.test.ts"
- Semantic search: codex_lens semantic "authentication middleware"
- Get callers: codex_lens graph "UserService.login" --direction callers`,

  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['init', 'search', 'find', 'symbol', 'inspect', 'graph', 'semantic', 'status'],
        description: 'CodexLens command to execute'
      },
      query: {
        type: 'string',
        description: 'Search query (text, pattern, or natural language)'
      },
      path: {
        type: 'string',
        description: 'File path or glob pattern'
      },
      mode: {
        type: 'string',
        enum: ['exact', 'fuzzy', 'regex'],
        description: 'Search mode (default: exact)',
        default: 'exact'
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 50)',
        default: 50
      },
      contextLines: {
        type: 'number',
        description: 'Context lines around matches (default: 2)',
        default: 2
      },
      depth: {
        type: 'number',
        description: 'Graph traversal depth (default: 2)',
        default: 2
      },
      direction: {
        type: 'string',
        enum: ['callers', 'callees', 'both'],
        description: 'Graph direction (default: both)',
        default: 'both'
      },
      includeRelations: {
        type: 'boolean',
        description: 'Include symbol relations in results',
        default: false
      },
      projectPath: {
        type: 'string',
        description: 'Project root path (default: cwd)'
      }
    },
    required: ['command']
  },
  execute
};
```

### 5.3 注册到 CCW

在 `ccw/src/tools/index.js` 中添加:

```javascript
import { codexLensTool } from './codex-lens.js';

// ... 现有 imports ...

// Register CodexLens tool
registerTool(codexLensTool);
```

---

## 6. 数据存储设计

### 6.1 SQLite Schema

```sql
-- 版本控制
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文件表
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    language TEXT NOT NULL,
    line_count INTEGER DEFAULT 0,
    hash TEXT NOT NULL,
    imports TEXT DEFAULT '[]',      -- JSON array
    exports TEXT DEFAULT '[]',      -- JSON array
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_files_language (language),
    INDEX idx_files_hash (hash)
);

-- 符号表
CREATE TABLE IF NOT EXISTS symbols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id TEXT UNIQUE NOT NULL,      -- file_path::name
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,            -- 用于模糊搜索
    type TEXT NOT NULL,                  -- function, class, method, etc.
    line_start INTEGER NOT NULL,
    line_end INTEGER NOT NULL,
    column_start INTEGER DEFAULT 0,
    column_end INTEGER DEFAULT 0,
    signature TEXT,
    docstring TEXT,
    language TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',          -- JSON object

    INDEX idx_symbols_name (name),
    INDEX idx_symbols_short_name (short_name),
    INDEX idx_symbols_type (type),
    INDEX idx_symbols_file_id (file_id)
);

-- 关系表
CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,             -- symbol_id
    target_id TEXT NOT NULL,             -- symbol_id
    relation_type TEXT NOT NULL,         -- calls, imports, extends, etc.
    metadata TEXT DEFAULT '{}',          -- JSON object

    UNIQUE(source_id, target_id, relation_type),
    INDEX idx_relations_source (source_id),
    INDEX idx_relations_target (target_id),
    INDEX idx_relations_type (relation_type)
);

-- FTS5 全文搜索索引
CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
    symbol_id,
    name,
    short_name,
    signature,
    docstring,
    content='symbols',
    content_rowid='id'
);

-- 触发器：保持 FTS 索引同步
CREATE TRIGGER symbols_ai AFTER INSERT ON symbols BEGIN
    INSERT INTO symbols_fts(rowid, symbol_id, name, short_name, signature, docstring)
    VALUES (new.id, new.symbol_id, new.name, new.short_name, new.signature, new.docstring);
END;

CREATE TRIGGER symbols_ad AFTER DELETE ON symbols BEGIN
    INSERT INTO symbols_fts(symbols_fts, rowid, symbol_id, name, short_name, signature, docstring)
    VALUES('delete', old.id, old.symbol_id, old.name, old.short_name, old.signature, old.docstring);
END;

CREATE TRIGGER symbols_au AFTER UPDATE ON symbols BEGIN
    INSERT INTO symbols_fts(symbols_fts, rowid, symbol_id, name, short_name, signature, docstring)
    VALUES('delete', old.id, old.symbol_id, old.name, old.short_name, old.signature, old.docstring);
    INSERT INTO symbols_fts(rowid, symbol_id, name, short_name, signature, docstring)
    VALUES (new.id, new.symbol_id, new.name, new.short_name, new.signature, new.docstring);
END;
```

### 6.2 SQLite Store 实现 (`storage/sqlite_store.py`)

```python
import sqlite3
import json
from pathlib import Path
from typing import List, Optional
from contextlib import contextmanager

from ..core.entities import Symbol, FileInfo, Relation, SymbolType

SCHEMA_VERSION = 1

class SQLiteStore:
    """SQLite 存储管理器"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_schema(self):
        """初始化数据库 schema"""
        with self._connection() as conn:
            # 检查版本
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            """)

            row = conn.execute("SELECT version FROM schema_version").fetchone()
            current_version = row["version"] if row else 0

            if current_version < SCHEMA_VERSION:
                self._apply_schema(conn)
                conn.execute(
                    "INSERT OR REPLACE INTO schema_version (version) VALUES (?)",
                    (SCHEMA_VERSION,)
                )

    def _apply_schema(self, conn):
        """应用 schema"""
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                language TEXT NOT NULL,
                line_count INTEGER DEFAULT 0,
                hash TEXT NOT NULL,
                imports TEXT DEFAULT '[]',
                exports TEXT DEFAULT '[]',
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol_id TEXT UNIQUE NOT NULL,
                file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                short_name TEXT NOT NULL,
                type TEXT NOT NULL,
                line_start INTEGER NOT NULL,
                line_end INTEGER NOT NULL,
                column_start INTEGER DEFAULT 0,
                column_end INTEGER DEFAULT 0,
                signature TEXT,
                docstring TEXT,
                language TEXT NOT NULL,
                metadata TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                UNIQUE(source_id, target_id, relation_type)
            );

            CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
            CREATE INDEX IF NOT EXISTS idx_symbols_short_name ON symbols(short_name);
            CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type);
            CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
            CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
        """)

    def upsert_file(self, file_info: FileInfo) -> int:
        """插入或更新文件"""
        with self._connection() as conn:
            cursor = conn.execute("""
                INSERT INTO files (path, language, line_count, hash, imports, exports)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    language = excluded.language,
                    line_count = excluded.line_count,
                    hash = excluded.hash,
                    imports = excluded.imports,
                    exports = excluded.exports,
                    indexed_at = CURRENT_TIMESTAMP
                RETURNING id
            """, (
                file_info.path,
                file_info.language,
                file_info.line_count,
                file_info.hash,
                json.dumps(file_info.imports),
                json.dumps(file_info.exports)
            ))
            return cursor.fetchone()["id"]

    def upsert_symbol(self, symbol: Symbol) -> int:
        """插入或更新符号"""
        with self._connection() as conn:
            # 获取 file_id
            file_row = conn.execute(
                "SELECT id FROM files WHERE path = ?",
                (symbol.location.file_path,)
            ).fetchone()

            if not file_row:
                raise ValueError(f"File not found: {symbol.location.file_path}")

            cursor = conn.execute("""
                INSERT INTO symbols (
                    symbol_id, file_id, name, short_name, type,
                    line_start, line_end, column_start, column_end,
                    signature, docstring, language, metadata
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol_id) DO UPDATE SET
                    name = excluded.name,
                    short_name = excluded.short_name,
                    type = excluded.type,
                    line_start = excluded.line_start,
                    line_end = excluded.line_end,
                    signature = excluded.signature,
                    docstring = excluded.docstring,
                    metadata = excluded.metadata
                RETURNING id
            """, (
                symbol.id,
                file_row["id"],
                symbol.name,
                symbol.short_name,
                symbol.type.value,
                symbol.location.line_start,
                symbol.location.line_end,
                symbol.location.column_start,
                symbol.location.column_end,
                symbol.signature,
                symbol.docstring,
                symbol.language,
                json.dumps(symbol.metadata)
            ))
            return cursor.fetchone()["id"]

    def find_symbol_by_name(
        self,
        name: str,
        exact: bool = False
    ) -> Optional[Symbol]:
        """按名称查找符号"""
        with self._connection() as conn:
            if exact:
                row = conn.execute(
                    "SELECT * FROM symbols WHERE name = ?",
                    (name,)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM symbols WHERE short_name LIKE ?",
                    (f"%{name}%",)
                ).fetchone()

            return self._row_to_symbol(row) if row else None

    def search_symbols(
        self,
        query: str,
        limit: int = 50
    ) -> List[Symbol]:
        """搜索符号"""
        with self._connection() as conn:
            rows = conn.execute("""
                SELECT * FROM symbols
                WHERE name LIKE ? OR short_name LIKE ? OR signature LIKE ?
                LIMIT ?
            """, (f"%{query}%", f"%{query}%", f"%{query}%", limit)).fetchall()

            return [self._row_to_symbol(row) for row in rows]

    def get_relations(
        self,
        symbol_id: str,
        direction: str = "both"
    ) -> List[Relation]:
        """获取符号关系"""
        with self._connection() as conn:
            relations = []

            if direction in ("both", "outgoing"):
                rows = conn.execute(
                    "SELECT * FROM relations WHERE source_id = ?",
                    (symbol_id,)
                ).fetchall()
                relations.extend([self._row_to_relation(r) for r in rows])

            if direction in ("both", "incoming"):
                rows = conn.execute(
                    "SELECT * FROM relations WHERE target_id = ?",
                    (symbol_id,)
                ).fetchall()
                relations.extend([self._row_to_relation(r) for r in rows])

            return relations

    def get_stats(self) -> dict:
        """获取索引统计"""
        with self._connection() as conn:
            file_count = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
            symbol_count = conn.execute("SELECT COUNT(*) FROM symbols").fetchone()[0]
            relation_count = conn.execute("SELECT COUNT(*) FROM relations").fetchone()[0]

            languages = conn.execute("""
                SELECT language, COUNT(*) as count
                FROM files GROUP BY language
            """).fetchall()

            return {
                "files": file_count,
                "symbols": symbol_count,
                "relations": relation_count,
                "languages": {r["language"]: r["count"] for r in languages}
            }

    def _row_to_symbol(self, row) -> Symbol:
        """将数据库行转换为 Symbol"""
        return Symbol(
            id=row["symbol_id"],
            name=row["name"],
            short_name=row["short_name"],
            type=SymbolType(row["type"]),
            location=Location(
                file_path=row["path"] if "path" in row.keys() else "",
                line_start=row["line_start"],
                line_end=row["line_end"],
                column_start=row["column_start"],
                column_end=row["column_end"]
            ),
            signature=row["signature"],
            docstring=row["docstring"],
            language=row["language"],
            metadata=json.loads(row["metadata"])
        )

    def _row_to_relation(self, row) -> Relation:
        """将数据库行转换为 Relation"""
        return Relation(
            source_id=row["source_id"],
            target_id=row["target_id"],
            relation_type=row["relation_type"],
            metadata=json.loads(row["metadata"])
        )
```

---

## 7. 语义搜索架构

### 7.1 嵌入生成器 (`semantic/embedder.py`)

```python
from typing import List, Optional
from functools import lru_cache

class SemanticEmbedder:
    """语义嵌入生成器 (懒加载)"""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None

    @property
    def model(self):
        """懒加载模型"""
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def embed(self, text: str) -> List[float]:
        """生成单个文本的嵌入"""
        return self.model.encode(text).tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """批量生成嵌入"""
        return self.model.encode(texts).tolist()

    def embed_symbol(self, symbol) -> List[float]:
        """为符号生成嵌入"""
        text = self._build_semantic_text(symbol)
        return self.embed(text)

    def _build_semantic_text(self, symbol) -> str:
        """构建符号的语义文本"""
        parts = [
            f"[{symbol.type.value}] {symbol.name}",
        ]

        if symbol.signature:
            parts.append(f"Signature: {symbol.signature}")

        if symbol.docstring:
            parts.append(f"Description: {symbol.docstring}")

        return "\n".join(parts)
```

### 7.2 向量存储 (`semantic/vector_store.py`)

```python
from typing import List, Dict, Any, Optional
from pathlib import Path

class VectorStore:
    """ChromaDB 向量存储适配器"""

    def __init__(self, persist_dir: Path):
        self.persist_dir = persist_dir
        self._client = None
        self._collection = None

    @property
    def client(self):
        """懒加载 ChromaDB 客户端"""
        if self._client is None:
            import chromadb
            self._client = chromadb.PersistentClient(
                path=str(self.persist_dir)
            )
        return self._client

    @property
    def collection(self):
        """获取或创建集合"""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name="codexlens_symbols",
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    def upsert(
        self,
        id: str,
        embedding: List[float],
        metadata: Dict[str, Any],
        document: str = ""
    ):
        """插入或更新向量"""
        self.collection.upsert(
            ids=[id],
            embeddings=[embedding],
            metadatas=[metadata],
            documents=[document]
        )

    def upsert_batch(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        documents: List[str] = None
    ):
        """批量插入"""
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents or [""] * len(ids)
        )

    def search(
        self,
        query_embedding: List[float],
        limit: int = 10,
        where: Optional[Dict] = None
    ) -> List[Dict]:
        """向量相似度搜索"""
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=limit,
            where=where,
            include=["metadatas", "distances", "documents"]
        )

        # 转换为统一格式
        items = []
        for i in range(len(results["ids"][0])):
            items.append({
                "id": results["ids"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
                "document": results["documents"][0][i] if results["documents"] else ""
            })

        return items

    def delete(self, ids: List[str]):
        """删除向量"""
        self.collection.delete(ids=ids)

    def count(self) -> int:
        """获取向量数量"""
        return self.collection.count()
```

---

## 8. CLI 命令设计

### 8.1 主入口 (`cli/main.py`)

```python
import typer
from typing import Optional
from pathlib import Path

from .commands import init, search, find, symbol, inspect, graph, semantic, status
from .output import JSONOutput

app = typer.Typer(
    name="codexlens",
    help="Code intelligence tool for symbol search, semantic search, and dependency analysis.",
    add_completion=False
)

# 全局选项
json_option = typer.Option(False, "--json", "-j", help="Output as JSON")
project_option = typer.Option(None, "--project", "-p", help="Project root path")

# 注册子命令
app.command()(init.command)
app.command()(search.command)
app.command()(find.command)
app.command()(symbol.command)
app.command()(inspect.command)
app.command()(graph.command)
app.command()(semantic.command)
app.command()(status.command)

def main():
    app()

if __name__ == "__main__":
    main()
```

### 8.2 输出格式化 (`cli/output.py`)

```python
import json
import sys
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class CLIResponse:
    """CLI 响应结构"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, str]] = None

    def to_json(self) -> str:
        """转换为 JSON 字符串"""
        result = {"success": self.success}
        if self.data:
            result["data"] = self.data
        if self.error:
            result["error"] = self.error
        return json.dumps(result, indent=2, ensure_ascii=False)

    def print(self, as_json: bool = False):
        """输出结果"""
        if as_json:
            print(self.to_json())
        else:
            self._print_human_readable()

    def _print_human_readable(self):
        """人类可读格式输出"""
        if not self.success:
            print(f"Error: {self.error.get('message', 'Unknown error')}", file=sys.stderr)
            if suggestion := self.error.get('suggestion'):
                print(f"Suggestion: {suggestion}", file=sys.stderr)
            return

        if not self.data:
            print("No results")
            return

        # 根据数据类型格式化输出
        if "results" in self.data:
            for item in self.data["results"]:
                self._print_result_item(item)
        elif "stats" in self.data:
            self._print_stats(self.data["stats"])
        else:
            print(json.dumps(self.data, indent=2))

    def _print_result_item(self, item: Dict):
        """打印单个结果项"""
        if "file_path" in item and "line" in item:
            # 搜索结果
            print(f"{item['file_path']}:{item['line']}")
            if "content" in item:
                print(f"  {item['content']}")
        elif "symbol_id" in item:
            # 符号结果
            print(f"{item['type']}: {item['name']}")
            print(f"  Location: {item['file_path']}:{item['line_start']}")
            if item.get("signature"):
                print(f"  Signature: {item['signature']}")
        print()

    def _print_stats(self, stats: Dict):
        """打印统计信息"""
        print("Index Statistics:")
        print(f"  Files: {stats.get('files', 0)}")
        print(f"  Symbols: {stats.get('symbols', 0)}")
        print(f"  Relations: {stats.get('relations', 0)}")
        if languages := stats.get("languages"):
            print("  Languages:")
            for lang, count in languages.items():
                print(f"    {lang}: {count}")


def success(data: Dict[str, Any]) -> CLIResponse:
    """创建成功响应"""
    return CLIResponse(success=True, data=data)


def error(code: str, message: str, suggestion: str = None) -> CLIResponse:
    """创建错误响应"""
    err = {"code": code, "message": message}
    if suggestion:
        err["suggestion"] = suggestion
    return CLIResponse(success=False, error=err)
```

### 8.3 命令示例: search (`cli/commands/search.py`)

```python
import typer
from typing import Optional, List
from pathlib import Path
import time

from ..output import success, error, CLIResponse
from ...engine.searcher import Searcher
from ...core.config import ProjectConfig
from ...utils.ripgrep import ripgrep_search

def command(
    query: str = typer.Argument(..., help="Search query (text or regex)"),
    path: Optional[str] = typer.Option(None, "--path", "-p", help="Path filter (glob)"),
    regex: bool = typer.Option(False, "--regex", "-r", help="Treat query as regex"),
    context: int = typer.Option(2, "--context", "-C", help="Context lines"),
    limit: int = typer.Option(50, "--limit", "-l", help="Max results"),
    json_output: bool = typer.Option(False, "--json", "-j", help="JSON output"),
    project: Optional[Path] = typer.Option(None, "--project", help="Project root")
):
    """
    Search code content using text or regex patterns.

    Uses ripgrep for fast searching with optional context lines.

    Examples:
        codexlens search "handleRequest"
        codexlens search "def.*test" --regex
        codexlens search "TODO" --path "**/*.py"
    """
    start_time = time.time()

    try:
        # 确定项目根目录
        project_root = project or Path.cwd()

        # 检查项目是否已初始化
        config_path = project_root / ".codexlens" / "config.toml"
        if not config_path.exists():
            response = error(
                "PROJECT_NOT_INITIALIZED",
                "Project not initialized",
                f"Run: codexlens init {project_root}"
            )
            response.print(json_output)
            raise typer.Exit(1)

        # 执行搜索
        results = ripgrep_search(
            query=query,
            path=project_root,
            pattern_filter=path,
            is_regex=regex,
            context_lines=context,
            max_results=limit
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        response = success({
            "results": results,
            "metadata": {
                "query": query,
                "mode": "regex" if regex else "literal",
                "count": len(results),
                "elapsed_ms": elapsed_ms
            }
        })
        response.print(json_output)

    except Exception as e:
        response = error("SEARCH_FAILED", str(e))
        response.print(json_output)
        raise typer.Exit(1)
```

### 8.4 命令示例: symbol (`cli/commands/symbol.py`)

```python
import typer
from typing import Optional
from pathlib import Path
import time

from ..output import success, error
from ...storage.sqlite_store import SQLiteStore
from ...core.config import ProjectConfig

def command(
    query: str = typer.Argument(..., help="Symbol name to search"),
    mode: str = typer.Option("fuzzy", "--mode", "-m", help="Search mode: exact, fuzzy"),
    type_filter: Optional[str] = typer.Option(None, "--type", "-t", help="Filter by type: function, class, method"),
    limit: int = typer.Option(50, "--limit", "-l", help="Max results"),
    relations: bool = typer.Option(False, "--relations", "-r", help="Include relations"),
    json_output: bool = typer.Option(False, "--json", "-j", help="JSON output"),
    project: Optional[Path] = typer.Option(None, "--project", help="Project root")
):
    """
    Search for code symbols (functions, classes, methods).

    Examples:
        codexlens symbol "UserService"
        codexlens symbol "handle" --mode fuzzy
        codexlens symbol "test_" --type function
    """
    start_time = time.time()

    try:
        project_root = project or Path.cwd()
        db_path = project_root / ".codexlens" / "index.db"

        if not db_path.exists():
            response = error(
                "INDEX_NOT_FOUND",
                "Index not found",
                f"Run: codexlens init {project_root}"
            )
            response.print(json_output)
            raise typer.Exit(1)

        store = SQLiteStore(db_path)

        # 搜索符号
        if mode == "exact":
            symbol = store.find_symbol_by_name(query, exact=True)
            symbols = [symbol] if symbol else []
        else:
            symbols = store.search_symbols(query, limit=limit)

        # 类型过滤
        if type_filter:
            symbols = [s for s in symbols if s.type.value == type_filter]

        # 构建结果
        results = []
        for sym in symbols[:limit]:
            item = {
                "symbol_id": sym.id,
                "name": sym.name,
                "type": sym.type.value,
                "file_path": sym.location.file_path,
                "line_start": sym.location.line_start,
                "line_end": sym.location.line_end,
                "signature": sym.signature,
                "docstring": sym.docstring,
                "language": sym.language
            }

            # 包含关系
            if relations:
                rels = store.get_relations(sym.id)
                item["relations"] = {
                    "callers": [r.source_id for r in rels if r.relation_type == "calls" and r.target_id == sym.id],
                    "callees": [r.target_id for r in rels if r.relation_type == "calls" and r.source_id == sym.id]
                }

            results.append(item)

        elapsed_ms = int((time.time() - start_time) * 1000)

        response = success({
            "results": results,
            "metadata": {
                "query": query,
                "mode": mode,
                "count": len(results),
                "elapsed_ms": elapsed_ms
            }
        })
        response.print(json_output)

    except Exception as e:
        response = error("SYMBOL_SEARCH_FAILED", str(e))
        response.print(json_output)
        raise typer.Exit(1)
```

---

## 9. 开发路线图

### Phase 1: 基础框架 (Week 1-2)

**目标**: 可运行的 CLI 骨架 + 基础搜索

**任务清单**:
- [ ] 项目骨架搭建 (pyproject.toml, 目录结构)
- [ ] 核心实体定义 (entities.py, config.py)
- [ ] CLI 框架 (Typer 集成)
- [ ] JSON 输出协议实现
- [ ] ripgrep 包装器
- [ ] `init` 命令实现
- [ ] `search` 命令实现 (ripgrep 后端)
- [ ] `find` 命令实现 (glob)
- [ ] `status` 命令实现

**里程碑**: `codexlens search "pattern" --json` 可工作

**交付物**:
```bash
codexlens init /path/to/project
codexlens search "function" --json
codexlens find "**/*.py" --json
codexlens status --json
```

---

### Phase 2: 深度索引 (Week 3-4)

**目标**: AST 解析 + 符号提取 + SQLite 存储

**任务清单**:
- [ ] SQLite 存储层实现
- [ ] 文件哈希缓存 (增量索引)
- [ ] Python 解析器 (ast 模块)
- [ ] JavaScript/TypeScript 解析器 (tree-sitter)
- [ ] Rust 解析器 (tree-sitter)
- [ ] 通用回退解析器
- [ ] 解析器工厂
- [ ] 索引引擎编排器
- [ ] `symbol` 命令实现
- [ ] `inspect` 命令实现

**里程碑**: `codexlens symbol "ClassName"` 返回符号详情

**交付物**:
```bash
codexlens symbol "handleRequest" --json
codexlens inspect src/main.py --json
```

---

### Phase 3: 关系图谱 (Week 5)

**目标**: 调用关系解析 + 图查询

**任务清单**:
- [ ] 调用关系提取 (pending_calls 解析)
- [ ] 关系存储 (relations 表)
- [ ] NetworkX 图构建
- [ ] 图遍历算法 (BFS/DFS)
- [ ] `graph` 命令实现
- [ ] 影响分析功能

**里程碑**: `codexlens graph "Symbol" --direction callers` 返回调用链

**交付物**:
```bash
codexlens graph "UserService.login" --depth 3 --json
codexlens graph "handleError" --direction callees --json
```

---

### Phase 4: CCW 集成 (Week 6)

**目标**: CCW 工具包装器 + 端到端测试

**任务清单**:
- [ ] CCW 工具包装器 (codex-lens.js)
- [ ] 注册到 CCW 工具系统
- [ ] 参数验证与转换
- [ ] 错误处理与重试
- [ ] 集成测试
- [ ] 文档更新

**里程碑**: `ccw tool exec codex_lens '{"command": "search", "query": "test"}'` 可工作

**交付物**:
```bash
ccw tool exec codex_lens '{"command": "symbol", "query": "handleRequest"}'
ccw tool list | grep codex_lens
```

---

### Phase 5: 语义搜索 (Week 7-8) [可选]

**目标**: 自然语言代码搜索

**任务清单**:
- [ ] sentence-transformers 集成
- [ ] ChromaDB 向量存储
- [ ] 代码分块策略
- [ ] 嵌入生成管道
- [ ] 向量索引构建
- [ ] `semantic` 命令实现
- [ ] 混合搜索 (关键词 + 语义)

**里程碑**: `codexlens semantic "authentication logic"` 返回相关代码

**交付物**:
```bash
codexlens semantic "user authentication middleware" --json
codexlens semantic "error handling" --limit 10 --json
```

---

### Phase 6: npm 分发 (Week 9)

**目标**: npm 包装与分发

**任务清单**:
- [ ] PyInstaller 配置
- [ ] 多平台构建 (Windows, macOS, Linux)
- [ ] GitHub Actions CI/CD
- [ ] npm 包装器
- [ ] 安装脚本
- [ ] 文档与示例

**里程碑**: `npm install -g codexlens` 可工作

---

## 10. 技术依赖

### 10.1 核心依赖

```toml
[project]
name = "codex-lens"
version = "0.1.0"
requires-python = ">=3.10"

dependencies = [
    # CLI 框架
    "typer>=0.9.0",
    "rich>=13.0.0",

    # 配置
    "pydantic>=2.0.0",
    "tomli>=2.0.0",
    "tomli-w>=1.0.0",

    # 代码解析
    "tree-sitter>=0.20.0",
    "tree-sitter-python>=0.20.0",
    "tree-sitter-javascript>=0.20.0",
    "tree-sitter-typescript>=0.20.0",
    "tree-sitter-rust>=0.20.0",

    # 图分析
    "networkx>=3.0",
]

[project.optional-dependencies]
semantic = [
    "sentence-transformers>=2.2.0",
    "chromadb>=0.4.0",
]

dev = [
    "pytest>=7.0.0",
    "pytest-cov>=4.0.0",
    "mypy>=1.0.0",
    "ruff>=0.1.0",
]

[project.scripts]
codexlens = "codex_lens.cli.main:main"
```

### 10.2 外部工具依赖

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| ripgrep (rg) | 快速文本搜索 | `scoop install ripgrep` / `brew install ripgrep` |
| git | 文件发现 | 系统自带 |

---

## 11. npm 分发策略

### 11.1 PyInstaller 配置 (`codexlens.spec`)

```python
# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

block_cipher = None

# 收集 tree-sitter 语言绑定
datas = []
binaries = []
hiddenimports = [
    'tree_sitter_python',
    'tree_sitter_javascript',
    'tree_sitter_typescript',
    'tree_sitter_rust',
]

for pkg in hiddenimports:
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
    except Exception:
        pass

a = Analysis(
    ['src/codex_lens/__main__.py'],
    pathex=['src'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='codexlens',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

### 11.2 GitHub Actions 构建

```yaml
# .github/workflows/build.yml
name: Build Binaries

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            artifact: codexlens-linux-x64
          - os: windows-latest
            artifact: codexlens-win-x64.exe
          - os: macos-latest
            artifact: codexlens-macos-x64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -e ".[dev]"
          pip install pyinstaller

      - name: Build binary
        run: pyinstaller codexlens.spec

      - name: Rename artifact
        shell: bash
        run: |
          cd dist
          if [ "${{ runner.os }}" == "Windows" ]; then
            mv codexlens.exe ../${{ matrix.artifact }}
          else
            mv codexlens ../${{ matrix.artifact }}
          fi

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: ${{ matrix.artifact }}

  release:
    needs: build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/download-artifact@v4

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            codexlens-linux-x64/codexlens-linux-x64
            codexlens-win-x64.exe/codexlens-win-x64.exe
            codexlens-macos-x64/codexlens-macos-x64
```

### 11.3 npm 包结构

```
npm-codexlens/
├── package.json
├── bin/
│   └── cli.js
└── scripts/
    └── install.js
```

**package.json**:
```json
{
  "name": "codexlens",
  "version": "0.1.0",
  "description": "Code intelligence tool for symbol search and dependency analysis",
  "bin": {
    "codexlens": "bin/cli.js"
  },
  "scripts": {
    "postinstall": "node scripts/install.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/user/codex-lens.git"
  },
  "os": ["darwin", "linux", "win32"],
  "cpu": ["x64", "arm64"]
}
```

---

## 附录 A: 命令速查表

| 命令 | 描述 | 示例 |
|------|------|------|
| `init` | 初始化项目索引 | `codexlens init .` |
| `search` | 文本/正则搜索 | `codexlens search "TODO" --path "**/*.py"` |
| `find` | 文件查找 | `codexlens find "**/*.test.ts"` |
| `symbol` | 符号查找 | `codexlens symbol "handleRequest" --relations` |
| `inspect` | 文件/符号详情 | `codexlens inspect src/main.py` |
| `graph` | 调用关系图 | `codexlens graph "UserService" --depth 3` |
| `semantic` | 语义搜索 | `codexlens semantic "authentication logic"` |
| `status` | 索引状态 | `codexlens status` |

---

## 附录 B: CCW 调用示例

```bash
# 初始化项目
ccw tool exec codex_lens '{"command": "init", "projectPath": "/path/to/project"}'

# 搜索代码
ccw tool exec codex_lens '{"command": "search", "query": "handleRequest", "limit": 20}'

# 查找符号
ccw tool exec codex_lens '{"command": "symbol", "query": "UserService", "includeRelations": true}'

# 获取调用图
ccw tool exec codex_lens '{"command": "graph", "query": "login", "depth": 2, "direction": "callers"}'

# 语义搜索
ccw tool exec codex_lens '{"command": "semantic", "query": "user authentication middleware"}'
```

---

*文档版本: 1.0.0*
*最后更新: 2024-12*
