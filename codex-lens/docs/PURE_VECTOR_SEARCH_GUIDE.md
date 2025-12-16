# Pure Vector Search 使用指南

## 概述

CodexLens 现在支持纯向量语义搜索！这是一个重要的新功能，允许您使用自然语言查询代码。

### 新增搜索模式

| 模式 | 描述 | 最佳用途 | 需要嵌入 |
|------|------|----------|---------|
| `exact` | 精确FTS匹配 | 代码标识符搜索 | ✗ |
| `fuzzy` | 模糊FTS匹配 | 容错搜索 | ✗ |
| `vector` | 向量 + FTS后备 | 语义 + 关键词混合 | ✓ |
| **`pure-vector`** | **纯向量搜索** | **纯自然语言查询** | **✓** |
| `hybrid` | 全部融合(RRF) | 最佳召回率 | ✓ |

### 关键变化

**之前**：
```bash
# "vector"模式实际上总是包含exact FTS搜索
codexlens search "authentication" --mode vector
# 即使没有嵌入，也会返回FTS结果
```

**现在**：
```bash
# "vector"模式仍保持向量+FTS混合（向后兼容）
codexlens search "authentication" --mode vector

# 新的"pure-vector"模式：仅使用向量搜索
codexlens search "how to authenticate users" --mode pure-vector
# 没有嵌入时返回空列表（明确行为）
```

## 快速开始

### 步骤1：安装语义搜索依赖

```bash
# 方式1：使用可选依赖
pip install codexlens[semantic]

# 方式2：手动安装
pip install fastembed numpy
```

### 步骤2：创建索引（如果还没有）

```bash
# 为项目创建索引
codexlens init ~/projects/your-project
```

### 步骤3：生成向量嵌入

```bash
# 为项目生成嵌入（自动查找索引）
codexlens embeddings-generate ~/projects/your-project

# 为特定索引生成嵌入
codexlens embeddings-generate ~/.codexlens/indexes/your-project/_index.db

# 使用特定模型
codexlens embeddings-generate ~/projects/your-project --model fast

# 强制重新生成
codexlens embeddings-generate ~/projects/your-project --force

# 检查嵌入状态
codexlens embeddings-status                           # 检查所有索引
codexlens embeddings-status ~/projects/your-project   # 检查特定项目
```

**可用模型**：
- `fast`: BAAI/bge-small-en-v1.5 (384维, ~80MB) - 快速，轻量级
- `code`: jinaai/jina-embeddings-v2-base-code (768维, ~150MB) - **代码优化**（推荐，默认）
- `multilingual`: intfloat/multilingual-e5-large (1024维, ~1GB) - 多语言
- `balanced`: mixedbread-ai/mxbai-embed-large-v1 (1024维, ~600MB) - 高精度

### 步骤4：使用纯向量搜索

```bash
# 纯向量搜索（自然语言）
codexlens search "how to verify user credentials" --mode pure-vector

# 向量搜索（带FTS后备）
codexlens search "authentication logic" --mode vector

# 混合搜索（最佳效果）
codexlens search "user login" --mode hybrid

# 精确代码搜索
codexlens search "authenticate_user" --mode exact
```

## 使用场景

### 场景1：查找实现特定功能的代码

**问题**："我如何在这个项目中处理用户身份验证？"

```bash
codexlens search "verify user credentials and authenticate" --mode pure-vector
```

**优势**：理解查询意图，找到语义相关的代码，而不仅仅是关键词匹配。

### 场景2：查找类似的代码模式

**问题**："项目中哪些地方使用了密码哈希？"

```bash
codexlens search "password hashing with salt" --mode pure-vector
```

**优势**：找到即使没有包含"hash"或"password"关键词的相关代码。

### 场景3：探索性搜索

**问题**："如何在这个项目中连接数据库？"

```bash
codexlens search "database connection and initialization" --mode pure-vector
```

**优势**：发现相关代码，即使使用了不同的术语（如"DB"、"connection pool"、"session"）。

### 场景4：混合搜索获得最佳效果

**问题**：既要关键词匹配，又要语义理解

```bash
# 最佳实践：使用hybrid模式
codexlens search "authentication" --mode hybrid
```

**优势**：结合FTS的精确性和向量搜索的语义理解。

## 故障排除

### 问题1：纯向量搜索返回空结果

**原因**：未生成向量嵌入

**解决方案**：
```bash
# 检查嵌入状态
codexlens embeddings-status ~/projects/your-project

# 生成嵌入
codexlens embeddings-generate ~/projects/your-project

# 或者对特定索引
codexlens embeddings-generate ~/.codexlens/indexes/your-project/_index.db
```

### 问题2：ImportError: fastembed not found

**原因**：未安装语义搜索依赖

**解决方案**：
```bash
pip install codexlens[semantic]
```

### 问题3：嵌入生成失败

**原因**：模型下载失败或磁盘空间不足

**解决方案**：
```bash
# 使用更小的模型
codexlens embeddings-generate ~/projects/your-project --model fast

# 检查磁盘空间（模型需要~100MB）
df -h ~/.cache/fastembed
```

### 问题4：搜索速度慢

**原因**：向量搜索比FTS慢（需要计算余弦相似度）

**优化**：
- 使用`--limit`限制结果数量
- 考虑使用`vector`模式（带FTS后备）而不是`pure-vector`
- 对于精确标识符搜索，使用`exact`模式

## 性能对比

基于测试数据（100个文件，~500个代码块）：

| 模式 | 平均延迟 | 召回率 | 精确率 |
|------|---------|--------|--------|
| exact | 5.6ms | 中 | 高 |
| fuzzy | 7.7ms | 高 | 中 |
| vector | 7.4ms | 高 | 中 |
| **pure-vector** | **7.0ms** | **最高** | **中** |
| hybrid | 9.0ms | 最高 | 高 |

**结论**：
- `exact`: 最快，适合代码标识符
- `pure-vector`: 与vector类似速度，更明确的语义搜索
- `hybrid`: 轻微开销，但召回率和精确率最佳

## 最佳实践

### 1. 选择合适的搜索模式

```bash
# 查找函数名/类名/变量名 → exact
codexlens search "UserAuthentication" --mode exact

# 自然语言问题 → pure-vector
codexlens search "how to hash passwords securely" --mode pure-vector

# 不确定用哪个 → hybrid
codexlens search "password security" --mode hybrid
```

### 2. 优化查询

**不好的查询**（对向量搜索）：
```bash
codexlens search "auth" --mode pure-vector  # 太模糊
```

**好的查询**：
```bash
codexlens search "authenticate user with username and password" --mode pure-vector
```

**原则**：
- 使用完整句子描述意图
- 包含关键动词和名词
- 避免过于简短或模糊的查询

### 3. 定期更新嵌入

```bash
# 当代码更新后，重新生成嵌入
codexlens embeddings-generate ~/projects/your-project --force
```

### 4. 监控嵌入存储空间

```bash
# 检查嵌入数据大小
du -sh ~/.codexlens/indexes/*/

# 嵌入通常占用索引大小的2-3倍
# 100个文件 → ~500个chunks → ~1.5MB (768维向量)
```

## API 使用示例

### Python API

```python
from pathlib import Path
from codexlens.search.hybrid_search import HybridSearchEngine

# 初始化引擎
engine = HybridSearchEngine()

# 纯向量搜索
results = engine.search(
    index_path=Path("~/.codexlens/indexes/project/_index.db"),
    query="how to authenticate users",
    limit=10,
    enable_vector=True,
    pure_vector=True,  # 纯向量模式
)

for result in results:
    print(f"{result.path}: {result.score:.3f}")
    print(f"  {result.excerpt}")

# 向量搜索（带FTS后备）
results = engine.search(
    index_path=Path("~/.codexlens/indexes/project/_index.db"),
    query="authentication",
    limit=10,
    enable_vector=True,
    pure_vector=False,  # 允许FTS后备
)
```

### 链式搜索API

```python
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper

# 初始化
registry = RegistryStore()
registry.initialize()
mapper = PathMapper()
engine = ChainSearchEngine(registry, mapper)

# 配置搜索选项
options = SearchOptions(
    depth=-1,  # 无限深度
    total_limit=20,
    hybrid_mode=True,
    enable_vector=True,
    pure_vector=True,  # 纯向量搜索
)

# 执行搜索
result = engine.search(
    query="verify user credentials",
    source_path=Path("~/projects/my-app"),
    options=options
)

print(f"Found {len(result.results)} results in {result.stats.time_ms:.1f}ms")
```

## 技术细节

### 向量存储架构

```
_index.db (SQLite)
├── files                  # 文件索引表
├── files_fts              # FTS5全文索引
├── files_fts_fuzzy        # 模糊搜索索引
└── semantic_chunks        # 向量嵌入表 ✓ 新增
    ├── id
    ├── file_path
    ├── content            # 代码块内容
    ├── embedding          # 向量嵌入(BLOB, float32)
    ├── metadata           # JSON元数据
    └── created_at
```

### 向量搜索流程

```
1. 查询嵌入化
   └─ query → Embedder → query_embedding (768维向量)

2. 相似度计算
   └─ VectorStore.search_similar()
      ├─ 加载embedding matrix到内存
      ├─ NumPy向量化余弦相似度计算
      └─ Top-K选择

3. 结果返回
   └─ SearchResult对象列表
      ├─ path: 文件路径
      ├─ score: 相似度分数
      ├─ excerpt: 代码片段
      └─ metadata: 元数据
```

### RRF融合算法

混合模式使用Reciprocal Rank Fusion (RRF)：

```python
# 默认权重
weights = {
    "exact": 0.4,   # 40% 精确FTS
    "fuzzy": 0.3,   # 30% 模糊FTS
    "vector": 0.3,  # 30% 向量搜索
}

# RRF公式
score(doc) = Σ weight[source] / (k + rank[source])
k = 60  # RRF常数
```

## 未来改进

- [ ] 增量嵌入更新（当前需要完全重新生成）
- [ ] 混合分块策略（symbol-based + sliding window）
- [ ] FAISS加速（100x+速度提升）
- [ ] 向量压缩（减少50%存储空间）
- [ ] 查询扩展（同义词、相关术语）
- [ ] 多模态搜索（代码 + 文档 + 注释）

## 相关资源

- **实现文件**：
  - `codexlens/search/hybrid_search.py` - 混合搜索引擎
  - `codexlens/semantic/embedder.py` - 嵌入生成
  - `codexlens/semantic/vector_store.py` - 向量存储
  - `codexlens/semantic/chunker.py` - 代码分块

- **测试文件**：
  - `tests/test_pure_vector_search.py` - 纯向量搜索测试
  - `tests/test_search_comparison.py` - 搜索模式对比

- **文档**：
  - `SEARCH_COMPARISON_ANALYSIS.md` - 详细技术分析
  - `SEARCH_ANALYSIS_SUMMARY.md` - 快速总结

## 反馈和贡献

如果您发现问题或有改进建议，请提交issue或PR：
- GitHub: https://github.com/your-org/codexlens

## 更新日志

### v0.5.0 (2025-12-16)
- ✨ 新增 `pure-vector` 搜索模式
- ✨ 添加向量嵌入生成脚本
- 🔧 修复"vector"模式总是包含exact FTS的问题
- 📚 更新文档和使用指南
- ✅ 添加纯向量搜索测试套件

---

**问题？** 查看 [故障排除](#故障排除) 章节或提交issue。
