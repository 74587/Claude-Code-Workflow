# Codexlens LSP API 规范

**版本**: 1.1
**状态**: ✅ APPROVED (Gemini Review)
**架构**: codexlens 提供 Python API，CCW 实现 MCP 端点
**分析来源**: Gemini (架构评审) + Codex (实现评审)
**最后更新**: 2025-01-17

---

## 一、概述

### 1.1 背景

基于 cclsp MCP 服务器实现的分析，设计 codexlens 的 LSP 搜索方法接口，为 AI 提供代码智能能力。

### 1.2 架构决策

**MCP 端点由 CCW 实现，codexlens 只提供 Python API**

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   MCP Client                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    CCW MCP Server                     │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  MCP Tool Handlers                              │  │  │
│  │  │  • codexlens_file_context                       │  │  │
│  │  │  • codexlens_find_definition                    │  │  │
│  │  │  • codexlens_find_references                    │  │  │
│  │  │  • codexlens_semantic_search                    │  │  │
│  │  └──────────────────────┬──────────────────────────┘  │  │
│  └─────────────────────────┼─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │ Python API 调用
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      codexlens                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Public API Layer                          │  │
│  │  codexlens.api.file_context()                         │  │
│  │  codexlens.api.find_definition()                      │  │
│  │  codexlens.api.find_references()                      │  │
│  │  codexlens.api.semantic_search()                      │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              Core Components                           │  │
│  │  GlobalSymbolIndex | ChainSearchEngine | HoverProvider │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              SQLite Index Databases                    │  │
│  │  global_symbols.db | *.index.db (per-directory)       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 职责分离

| 组件 | 职责 |
|------|------|
| **codexlens** | Python API、索引查询、搜索算法、结果聚合、降级处理 |
| **CCW** | MCP 协议、参数校验、结果序列化、错误处理、project_root 推断 |

### 1.4 codexlens vs cclsp 对比

| 特性 | cclsp | codexlens |
|------|-------|-----------|
| 数据源 | 实时 LSP 服务器 | 预建 SQLite 索引 |
| 启动时间 | 200-3000ms | <50ms |
| 响应时间 | 50-500ms | <5ms |
| 跨语言 | 每语言需要 LSP 服务器 | 统一 Python/TS/JS/Go 索引 |
| 依赖 | 需要语言服务器 | 无外部依赖 |
| 准确度 | 100% (编译器级) | 95%+ (tree-sitter) |
| 重命名支持 | 是 | 否 (只读索引) |
| 实时诊断 | 是 | 通过 IDE MCP |

**推荐**: codexlens 用于快速搜索，cclsp 用于精确重构

---

## 二、cclsp 设计模式 (参考)

### 2.1 MCP 工具接口设计

| 模式 | 说明 | 代码位置 |
|------|------|----------|
| **基于名称** | 接受 `symbol_name` 而非文件坐标 | `index.ts:70` |
| **安全消歧义** | `rename_symbol` → `rename_symbol_strict` 两步 | `index.ts:133, 172` |
| **复杂性抽象** | 隐藏 LSP 协议细节 | `index.ts:211` |
| **优雅失败** | 返回有用的文本响应 | 全局 |

### 2.2 符号解析算法

```
1. getDocumentSymbols (lsp-client.ts:1406)
   └─ 获取文件所有符号

2. 处理两种格式:
   ├─ DocumentSymbol[] → 扁平化
   └─ SymbolInformation[] → 二次定位

3. 过滤: symbol.name === symbolName && symbol.kind

4. 回退: 无结果时移除 kind 约束重试

5. 聚合: 遍历所有匹配，聚合定义位置
```

---

## 三、需求规格

### 需求 1: 文件上下文查询 (`file_context`)

**用途**: 读取代码文件，返回文件中所有方法的调用关系摘要

**输出示例**:
```markdown
## src/auth/login.py (3 methods)

### login_user (line 15-45)
- Calls: validate_password (auth/utils.py:23), create_session (session/manager.py:89)
- Called by: handle_login_request (api/routes.py:156), test_login (tests/test_auth.py:34)

### validate_token (line 47-62)
- Calls: decode_jwt (auth/jwt.py:12)
- Called by: auth_middleware (middleware/auth.py:28)
```

### 需求 2: 通用 LSP 搜索 (cclsp 兼容)

| 端点 | 用途 |
|------|------|
| `find_definition` | 根据符号名查找定义位置 |
| `find_references` | 查找符号的所有引用 |
| `workspace_symbols` | 工作区符号搜索 |
| `get_hover` | 获取符号悬停信息 |

### 需求 3: 向量 + LSP 融合搜索

**用途**: 结合向量语义搜索和结构化 LSP 搜索

**融合策略**:
- **RRF** (首选): 简单、不需要分数归一化、鲁棒
- **Cascade**: 特定场景，先向量后 LSP
- **Adaptive**: 长期目标，按查询类型自动选择

---

## 四、API 规范

### 4.1 模块结构

```
src/codexlens/
├─ api/                         [新增] 公开 API 层
│   ├─ __init__.py              导出所有 API
│   ├─ file_context.py          文件上下文
│   ├─ definition.py            定义查找
│   ├─ references.py            引用查找
│   ├─ symbols.py               符号搜索
│   ├─ hover.py                 悬停信息
│   └─ semantic.py              语义搜索
│
├─ storage/
│   ├─ global_index.py          [扩展] get_file_symbols()
│   └─ relationship_query.py    [新增] 有向调用查询
│
└─ search/
    └─ chain_search.py          [修复] schema 兼容
```

### 4.2 `codexlens.api.file_context()`

```python
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple

@dataclass
class CallInfo:
    """调用关系信息"""
    symbol_name: str
    file_path: Optional[str]      # 目标文件 (可能为 None)
    line: int
    relationship: str             # call | import | inheritance

@dataclass
class MethodContext:
    """方法上下文"""
    name: str
    kind: str                     # function | method | class
    line_range: Tuple[int, int]
    signature: Optional[str]
    calls: List[CallInfo]         # 出向调用
    callers: List[CallInfo]       # 入向调用

@dataclass
class FileContextResult:
    """文件上下文结果"""
    file_path: str
    language: str
    methods: List[MethodContext]
    summary: str                  # 人类可读摘要
    discovery_status: Dict[str, bool] = field(default_factory=lambda: {
        "outgoing_resolved": False,
        "incoming_resolved": True,
        "targets_resolved": False
    })

def file_context(
    project_root: str,
    file_path: str,
    include_calls: bool = True,
    include_callers: bool = True,
    max_depth: int = 1,
    format: str = "brief"         # brief | detailed | tree
) -> FileContextResult:
    """
    获取代码文件的方法调用上下文。

    Args:
        project_root: 项目根目录 (用于定位索引)
        file_path: 代码文件路径
        include_calls: 是否包含出向调用
        include_callers: 是否包含入向调用
        max_depth: 调用链深度 (1=直接调用)
            ⚠️ V1 限制: 当前版本仅支持 max_depth=1
            深度调用链分析将在 V2 实现
        format: 输出格式

    Returns:
        FileContextResult

    Raises:
        IndexNotFoundError: 项目未索引
        FileNotFoundError: 文件不存在

    Note:
        V1 实现限制:
        - max_depth 仅支持 1 (直接调用)
        - 出向调用目标文件可能为 None (未解析)
        - 深度调用链分析作为 V2 特性规划
    """
```

### 4.3 `codexlens.api.find_definition()`

```python
@dataclass
class DefinitionResult:
    """定义查找结果"""
    name: str
    kind: str
    file_path: str
    line: int
    end_line: int
    signature: Optional[str]
    container: Optional[str]      # 所属类/模块
    score: float

def find_definition(
    project_root: str,
    symbol_name: str,
    symbol_kind: Optional[str] = None,
    file_context: Optional[str] = None,
    limit: int = 10
) -> List[DefinitionResult]:
    """
    根据符号名称查找定义位置。

    Fallback 策略:
        1. 精确匹配 + kind 过滤
        2. 精确匹配 (移除 kind)
        3. 前缀匹配
    """
```

### 4.4 `codexlens.api.find_references()`

```python
@dataclass
class ReferenceResult:
    """引用结果"""
    file_path: str
    line: int
    column: int
    context_line: str
    relationship: str             # call | import | type_annotation | inheritance

@dataclass
class GroupedReferences:
    """按定义分组的引用"""
    definition: DefinitionResult
    references: List[ReferenceResult]

def find_references(
    project_root: str,
    symbol_name: str,
    symbol_kind: Optional[str] = None,
    include_definition: bool = True,
    group_by_definition: bool = True,
    limit: int = 100
) -> List[GroupedReferences]:
    """
    查找符号的所有引用位置。

    多定义时分组返回，解决引用混淆问题。
    """
```

### 4.5 `codexlens.api.workspace_symbols()`

```python
@dataclass
class SymbolInfo:
    """符号信息"""
    name: str
    kind: str
    file_path: str
    line: int
    container: Optional[str]
    score: float

def workspace_symbols(
    project_root: str,
    query: str,
    kind_filter: Optional[List[str]] = None,
    file_pattern: Optional[str] = None,
    limit: int = 50
) -> List[SymbolInfo]:
    """在整个工作区搜索符号 (前缀匹配)。"""
```

### 4.6 `codexlens.api.get_hover()`

```python
@dataclass
class HoverInfo:
    """悬停信息"""
    name: str
    kind: str
    signature: str
    documentation: Optional[str]
    file_path: str
    line_range: Tuple[int, int]
    type_info: Optional[str]

def get_hover(
    project_root: str,
    symbol_name: str,
    file_path: Optional[str] = None
) -> Optional[HoverInfo]:
    """获取符号的详细悬停信息。"""
```

### 4.7 `codexlens.api.semantic_search()`

```python
@dataclass
class SemanticResult:
    """语义搜索结果"""
    symbol_name: str
    kind: str
    file_path: str
    line: int
    vector_score: Optional[float]
    structural_score: Optional[float]
    fusion_score: float
    snippet: str
    match_reason: Optional[str]

def semantic_search(
    project_root: str,
    query: str,
    mode: str = "fusion",         # vector | structural | fusion
    vector_weight: float = 0.5,
    structural_weight: float = 0.3,
    keyword_weight: float = 0.2,
    fusion_strategy: str = "rrf", # rrf | staged | binary | hybrid
    kind_filter: Optional[List[str]] = None,
    limit: int = 20,
    include_match_reason: bool = False
) -> List[SemanticResult]:
    """
    语义搜索 - 结合向量和结构化搜索。

    Args:
        project_root: 项目根目录
        query: 自然语言查询
        mode: 搜索模式
            - vector: 仅向量搜索
            - structural: 仅结构搜索 (符号 + 关系)
            - fusion: 融合搜索 (默认)
        vector_weight: 向量搜索权重 [0, 1]
        structural_weight: 结构搜索权重 [0, 1]
        keyword_weight: 关键词搜索权重 [0, 1]
        fusion_strategy: 融合策略 (映射到 chain_search.py)
            - rrf: Reciprocal Rank Fusion (推荐，默认)
            - staged: 分阶段级联 → staged_cascade_search
            - binary: 二分重排级联 → binary_rerank_cascade_search
            - hybrid: 混合级联 → hybrid_cascade_search
        kind_filter: 符号类型过滤
        limit: 最大返回数量
        include_match_reason: 是否生成匹配原因 (启发式，非 LLM)

    Returns:
        按 fusion_score 排序的结果列表

    降级行为:
        - 无向量索引: vector_score=None, 使用 FTS + 结构搜索
        - 无关系数据: structural_score=None, 仅向量搜索
    """
```

---

## 五、已知问题与解决方案

### 5.1 P0 阻塞项

| 问题 | 位置 | 解决方案 |
|------|------|----------|
| **索引 Schema 不匹配** | `chain_search.py:313-324` vs `dir_index.py:304-312` | 兼容 `full_path` 和 `path` |
| **文件符号查询缺失** | `global_index.py:214-260` | 新增 `get_file_symbols()` |
| **出向调用查询缺失** | `dir_index.py:333-342` | 新增 `RelationshipQuery` |
| **关系类型不一致** | `entities.py:74-79` | 规范化 `calls` → `call` |

### 5.2 设计缺陷 (Gemini 发现)

| 缺陷 | 影响 | 解决方案 |
|------|------|----------|
| **调用图不完整** | `file_context` 缺少出向调用 | 新增有向调用 API |
| **消歧义未定义** | 多定义时无法区分 | 实现 `rank_by_proximity()` |
| **AI 特性成本过高** | `explanation` 需要 LLM | 设为可选，默认关闭 |
| **融合参数不一致** | 3 分支但只有 2 权重 | 补充 `keyword_weight` |

### 5.3 消歧义算法

**V1 实现** (基于文件路径接近度):

```python
def rank_by_proximity(
    results: List[DefinitionResult],
    file_context: str
) -> List[DefinitionResult]:
    """按文件接近度排序 (V1: 路径接近度)"""
    def proximity_score(result):
        # 1. 同目录最高分
        if os.path.dirname(result.file_path) == os.path.dirname(file_context):
            return 100
        # 2. 共同路径前缀长度
        common = os.path.commonpath([result.file_path, file_context])
        return len(common)

    return sorted(results, key=proximity_score, reverse=True)
```

**V2 增强计划** (基于 import graph 距离):

```python
def rank_by_import_distance(
    results: List[DefinitionResult],
    file_context: str,
    import_graph: Dict[str, Set[str]]
) -> List[DefinitionResult]:
    """按 import graph 距离排序 (V2)"""
    def import_distance(result):
        # BFS 计算最短 import 路径
        return bfs_shortest_path(
            import_graph,
            file_context,
            result.file_path
        )

    # 组合: 0.6 * import_distance + 0.4 * path_proximity
    return sorted(results, key=lambda r: (
        0.6 * import_distance(r) +
        0.4 * (100 - proximity_score(r))
    ))
```

### 5.4 参考实现: `get_file_symbols()`

**位置**: `src/codexlens/storage/global_index.py`

```python
def get_file_symbols(self, file_path: str | Path) -> List[Symbol]:
    """
    获取指定文件中定义的所有符号。

    Args:
        file_path: 文件路径 (相对或绝对)

    Returns:
        按行号排序的符号列表
    """
    file_path_str = str(Path(file_path).resolve())
    with self._lock:
        conn = self._get_connection()
        rows = conn.execute(
            """
            SELECT symbol_name, symbol_kind, file_path, start_line, end_line
            FROM global_symbols
            WHERE project_id = ? AND file_path = ?
            ORDER BY start_line
            """,
            (self.project_id, file_path_str),
        ).fetchall()

        return [
            Symbol(
                name=row["symbol_name"],
                kind=row["symbol_kind"],
                range=(row["start_line"], row["end_line"]),
                file=row["file_path"],
            )
            for row in rows
        ]
```

---

## 六、实现计划

### Phase 0: 基础设施 (16h)

| 任务 | 工时 | 说明 |
|------|------|------|
| 修复 `search_references` schema | 4h | 兼容两种 schema |
| 新增 `GlobalSymbolIndex.get_file_symbols()` | 4h | 文件符号查询 (见 5.4) |
| 新增 `RelationshipQuery` 类 | 6h | 有向调用查询 |
| 关系类型规范化层 | 2h | `calls` → `call` |

### Phase 1: API 层 (48h)

| 任务 | 工时 | 复杂度 |
|------|------|--------|
| `find_definition()` | 4h | S |
| `find_references()` | 8h | M |
| `workspace_symbols()` | 4h | S |
| `get_hover()` | 4h | S |
| `file_context()` | 16h | L |
| `semantic_search()` | 12h | M |

### Phase 2: 测试与文档 (16h)

| 任务 | 工时 |
|------|------|
| 单元测试 (≥80%) | 8h |
| API 文档 | 4h |
| 示例代码 | 4h |

### 关键路径

```
Phase 0.1 (schema fix)
    ↓
Phase 0.2 (file symbols) → Phase 1.5 (file_context)
    ↓
Phase 1 (其他 API)
    ↓
Phase 2 (测试)
```

---

## 七、测试策略

### 7.1 单元测试

```python
# test_global_index.py
def test_get_file_symbols():
    index = GlobalSymbolIndex(":memory:")
    index.update_file_symbols(project_id=1, file_path="test.py", symbols=[...])
    results = index.get_file_symbols("test.py")
    assert len(results) == 3

# test_relationship_query.py
def test_outgoing_calls():
    store = DirIndexStore(":memory:")
    calls = store.get_outgoing_calls("src/auth.py", "login")
    assert calls[0].relationship == "call"  # 已规范化
```

### 7.2 Schema 兼容性测试

```python
def test_search_references_both_schemas():
    """测试两种 schema 的引用搜索"""
    # 旧 schema: files(path, ...)
    # 新 schema: files(full_path, ...)
```

### 7.3 降级测试

```python
def test_semantic_search_without_vectors():
    result = semantic_search(query="auth", mode="fusion")
    assert result.vector_score is None
    assert result.fusion_score > 0
```

---

## 八、使用示例

```python
from codexlens.api import (
    file_context,
    find_definition,
    find_references,
    semantic_search
)

# 1. 获取文件上下文
result = file_context(
    project_root="/path/to/project",
    file_path="src/auth/login.py",
    format="brief"
)
print(result.summary)

# 2. 查找定义
definitions = find_definition(
    project_root="/path/to/project",
    symbol_name="UserService",
    symbol_kind="class"
)

# 3. 语义搜索
results = semantic_search(
    project_root="/path/to/project",
    query="处理用户登录验证的函数",
    mode="fusion"
)
```

---

## 九、CCW 集成

| codexlens API | CCW MCP Tool |
|---------------|--------------|
| `file_context()` | `codexlens_file_context` |
| `find_definition()` | `codexlens_find_definition` |
| `find_references()` | `codexlens_find_references` |
| `workspace_symbols()` | `codexlens_workspace_symbol` |
| `get_hover()` | `codexlens_get_hover` |
| `semantic_search()` | `codexlens_semantic_search` |

---

## 十、分析来源

| 工具 | Session ID | 贡献 |
|------|------------|------|
| Gemini | `1768618654438-gemini` | 架构评审、设计缺陷、融合策略 |
| Codex | `1768618658183-codex` | 组件复用、复杂度估算、任务分解 |
| Gemini | `1768620615744-gemini` | 最终评审、改进建议、APPROVED |

---

## 十一、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2025-01-17 | 初始版本，合并多文档 |
| 1.1 | 2025-01-17 | 应用 Gemini 评审改进: V1 限制说明、策略映射、消歧义增强、参考实现 |
