# 多层次分词器设计方案

## 1. 背景与目标

### 1.1 当前问题

当前 `chunker.py` 的两种分词策略存在明显缺陷：

**symbol-based 策略**：
- ✅ 优点：保持代码逻辑完整性，每个chunk是完整的函数/类
- ❌ 缺点：粒度不均，超大函数可能达到数百行，影响LLM处理和搜索精度

**sliding-window 策略**：
- ✅ 优点：chunk大小均匀，覆盖全面
- ❌ 缺点：破坏逻辑结构，可能将完整的循环/条件块切断

### 1.2 设计目标

实现多层次分词器，同时满足：
1. **语义完整性**：保持代码逻辑边界的完整性
2. **粒度可控**：支持从粗粒度（函数级）到细粒度（逻辑块级）的灵活划分
3. **层级关系**：保留chunk之间的父子关系，支持上下文检索
4. **高效索引**：优化向量化和检索性能

## 2. 技术架构

### 2.1 两层分词架构

```
Source Code
    ↓
[Layer 1: Symbol-Level Chunking]  ← 使用 tree-sitter AST
    ↓
MacroChunks (Functions/Classes)
    ↓
[Layer 2: Logic-Block Chunking]   ← AST深度遍历
    ↓
MicroChunks (Loops/Conditionals/Blocks)
    ↓
Vector Embedding + Indexing
```

### 2.2 核心组件

```python
# 新增数据结构
@dataclass
class ChunkMetadata:
    """Chunk元数据"""
    chunk_id: str
    parent_id: Optional[str]  # 父chunk ID
    level: int                 # 层级：1=macro, 2=micro
    chunk_type: str           # function/class/loop/conditional/try_except
    file_path: str
    start_line: int
    end_line: int
    symbol_name: Optional[str]
    context_summary: Optional[str]  # 继承自父chunk的上下文

@dataclass
class HierarchicalChunk:
    """层级化的代码块"""
    metadata: ChunkMetadata
    content: str
    embedding: Optional[List[float]] = None
    children: List['HierarchicalChunk'] = field(default_factory=list)
```

## 3. 详细实现步骤

### 3.1 第一层：符号级分词（Macro-Chunking）

**实现思路**：复用现有 `code_extractor.py` 逻辑，增强元数据提取。

```python
class MacroChunker:
    """第一层分词器：提取顶层符号"""

    def __init__(self):
        self.parser = Parser()
        # 加载语言grammar

    def chunk_by_symbols(
        self,
        content: str,
        file_path: str,
        language: str
    ) -> List[HierarchicalChunk]:
        """提取顶层函数和类定义"""
        tree = self.parser.parse(bytes(content, 'utf-8'))
        root_node = tree.root_node

        chunks = []
        for node in root_node.children:
            if node.type in ['function_definition', 'class_definition',
                           'method_definition']:
                chunk = self._create_macro_chunk(node, content, file_path)
                chunks.append(chunk)

        return chunks

    def _create_macro_chunk(
        self,
        node,
        content: str,
        file_path: str
    ) -> HierarchicalChunk:
        """从AST节点创建macro chunk"""
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1

        # 提取符号名称
        name_node = node.child_by_field_name('name')
        symbol_name = content[name_node.start_byte:name_node.end_byte]

        # 提取完整代码（包含docstring和装饰器）
        chunk_content = self._extract_with_context(node, content)

        metadata = ChunkMetadata(
            chunk_id=f"{file_path}:{start_line}",
            parent_id=None,
            level=1,
            chunk_type=node.type,
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            symbol_name=symbol_name,
        )

        return HierarchicalChunk(
            metadata=metadata,
            content=chunk_content,
        )

    def _extract_with_context(self, node, content: str) -> str:
        """提取代码，包含装饰器和docstring"""
        # 向上查找装饰器
        start_byte = node.start_byte
        prev_sibling = node.prev_sibling
        while prev_sibling and prev_sibling.type == 'decorator':
            start_byte = prev_sibling.start_byte
            prev_sibling = prev_sibling.prev_sibling

        return content[start_byte:node.end_byte]
```

### 3.2 第二层：逻辑块分词（Micro-Chunking）

**实现思路**：在每个macro chunk内部，按逻辑结构进一步划分。

```python
class MicroChunker:
    """第二层分词器：提取逻辑块"""

    # 需要划分的逻辑块类型
    LOGIC_BLOCK_TYPES = {
        'for_statement',
        'while_statement',
        'if_statement',
        'try_statement',
        'with_statement',
    }

    def chunk_logic_blocks(
        self,
        macro_chunk: HierarchicalChunk,
        content: str,
        max_lines: int = 50  # 大于此行数的macro chunk才进行二次划分
    ) -> List[HierarchicalChunk]:
        """在macro chunk内部提取逻辑块"""

        # 小函数不需要二次划分
        total_lines = macro_chunk.metadata.end_line - macro_chunk.metadata.start_line
        if total_lines <= max_lines:
            return []

        tree = self.parser.parse(bytes(macro_chunk.content, 'utf-8'))
        root_node = tree.root_node

        micro_chunks = []
        self._traverse_logic_blocks(
            root_node,
            macro_chunk,
            content,
            micro_chunks
        )

        return micro_chunks

    def _traverse_logic_blocks(
        self,
        node,
        parent_chunk: HierarchicalChunk,
        content: str,
        result: List[HierarchicalChunk]
    ):
        """递归遍历AST，提取逻辑块"""

        if node.type in self.LOGIC_BLOCK_TYPES:
            micro_chunk = self._create_micro_chunk(
                node,
                parent_chunk,
                content
            )
            result.append(micro_chunk)
            parent_chunk.children.append(micro_chunk)

        # 继续遍历子节点
        for child in node.children:
            self._traverse_logic_blocks(child, parent_chunk, content, result)

    def _create_micro_chunk(
        self,
        node,
        parent_chunk: HierarchicalChunk,
        content: str
    ) -> HierarchicalChunk:
        """创建micro chunk"""

        # 计算相对于文件的行号
        start_line = parent_chunk.metadata.start_line + node.start_point[0]
        end_line = parent_chunk.metadata.start_line + node.end_point[0]

        chunk_content = content[node.start_byte:node.end_byte]

        metadata = ChunkMetadata(
            chunk_id=f"{parent_chunk.metadata.chunk_id}:L{start_line}",
            parent_id=parent_chunk.metadata.chunk_id,
            level=2,
            chunk_type=node.type,
            file_path=parent_chunk.metadata.file_path,
            start_line=start_line,
            end_line=end_line,
            symbol_name=parent_chunk.metadata.symbol_name,  # 继承父符号名
            context_summary=None,  # 后续由LLM填充
        )

        return HierarchicalChunk(
            metadata=metadata,
            content=chunk_content,
        )
```

### 3.3 统一接口：多层次分词器

```python
class HierarchicalChunker:
    """多层次分词器统一接口"""

    def __init__(self, config: ChunkConfig = None):
        self.config = config or ChunkConfig()
        self.macro_chunker = MacroChunker()
        self.micro_chunker = MicroChunker()

    def chunk_file(
        self,
        content: str,
        file_path: str,
        language: str
    ) -> List[HierarchicalChunk]:
        """对文件进行多层次分词"""

        # 第一层：符号级分词
        macro_chunks = self.macro_chunker.chunk_by_symbols(
            content, file_path, language
        )

        # 第二层：逻辑块分词
        all_chunks = []
        for macro_chunk in macro_chunks:
            all_chunks.append(macro_chunk)

            # 对大函数进行二次划分
            micro_chunks = self.micro_chunker.chunk_logic_blocks(
                macro_chunk, content
            )
            all_chunks.extend(micro_chunks)

        return all_chunks

    def chunk_file_with_fallback(
        self,
        content: str,
        file_path: str,
        language: str
    ) -> List[HierarchicalChunk]:
        """带降级策略的分词"""

        try:
            return self.chunk_file(content, file_path, language)
        except Exception as e:
            logger.warning(f"Hierarchical chunking failed: {e}, falling back to sliding window")
            # 降级到滑动窗口策略
            return self._fallback_sliding_window(content, file_path, language)
```

## 4. 数据存储设计

### 4.1 数据库Schema

```sql
-- chunk表：存储所有层级的chunk
CREATE TABLE chunks (
    chunk_id TEXT PRIMARY KEY,
    parent_id TEXT,           -- 父chunk ID，NULL表示顶层
    level INTEGER NOT NULL,   -- 1=macro, 2=micro
    chunk_type TEXT NOT NULL, -- function/class/loop/if/try等
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    symbol_name TEXT,
    content TEXT NOT NULL,
    content_hash TEXT,        -- 用于检测内容变化

    -- 语义元数据（由LLM生成）
    summary TEXT,
    keywords TEXT,            -- JSON数组
    purpose TEXT,

    -- 向量嵌入
    embedding BLOB,           -- 存储向量

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX idx_chunks_file_path ON chunks(file_path);
CREATE INDEX idx_chunks_parent_id ON chunks(parent_id);
CREATE INDEX idx_chunks_level ON chunks(level);
CREATE INDEX idx_chunks_symbol_name ON chunks(symbol_name);
```

### 4.2 向量索引

使用分层索引策略：

```python
class HierarchicalVectorStore:
    """层级化向量存储"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)

    def add_chunk(self, chunk: HierarchicalChunk):
        """添加chunk及其向量"""

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO chunks (
                chunk_id, parent_id, level, chunk_type,
                file_path, start_line, end_line, symbol_name,
                content, embedding
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            chunk.metadata.chunk_id,
            chunk.metadata.parent_id,
            chunk.metadata.level,
            chunk.metadata.chunk_type,
            chunk.metadata.file_path,
            chunk.metadata.start_line,
            chunk.metadata.end_line,
            chunk.metadata.symbol_name,
            chunk.content,
            self._serialize_embedding(chunk.embedding),
        ))

        self.conn.commit()

    def search_hierarchical(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        level_weights: Dict[int, float] = None
    ) -> List[Tuple[HierarchicalChunk, float]]:
        """层级化检索"""

        # 默认权重：macro chunk权重更高
        if level_weights is None:
            level_weights = {1: 1.0, 2: 0.8}

        # 检索所有chunk
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM chunks WHERE embedding IS NOT NULL")

        results = []
        for row in cursor.fetchall():
            chunk = self._row_to_chunk(row)
            similarity = self._cosine_similarity(
                query_embedding,
                chunk.embedding
            )

            # 根据层级应用权重
            weighted_score = similarity * level_weights.get(chunk.metadata.level, 1.0)
            results.append((chunk, weighted_score))

        # 按分数排序
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def get_chunk_with_context(
        self,
        chunk_id: str
    ) -> Tuple[HierarchicalChunk, Optional[HierarchicalChunk]]:
        """获取chunk及其父chunk（提供上下文）"""

        cursor = self.conn.cursor()

        # 获取chunk本身
        cursor.execute("SELECT * FROM chunks WHERE chunk_id = ?", (chunk_id,))
        chunk_row = cursor.fetchone()
        chunk = self._row_to_chunk(chunk_row)

        # 获取父chunk
        parent = None
        if chunk.metadata.parent_id:
            cursor.execute(
                "SELECT * FROM chunks WHERE chunk_id = ?",
                (chunk.metadata.parent_id,)
            )
            parent_row = cursor.fetchone()
            if parent_row:
                parent = self._row_to_chunk(parent_row)

        return chunk, parent
```

## 5. LLM集成策略

### 5.1 分层生成语义元数据

```python
class HierarchicalLLMEnhancer:
    """为层级chunk生成语义元数据"""

    def enhance_hierarchical_chunks(
        self,
        chunks: List[HierarchicalChunk]
    ) -> Dict[str, SemanticMetadata]:
        """
        分层处理策略：
        1. 先处理所有level=1的macro chunks，生成详细摘要
        2. 再处理level=2的micro chunks，使用父chunk摘要作为上下文
        """

        results = {}

        # 第一轮：处理macro chunks
        macro_chunks = [c for c in chunks if c.metadata.level == 1]
        macro_metadata = self.llm_enhancer.enhance_files([
            FileData(
                path=c.metadata.chunk_id,
                content=c.content,
                language=self._detect_language(c.metadata.file_path)
            )
            for c in macro_chunks
        ])
        results.update(macro_metadata)

        # 第二轮：处理micro chunks（带父上下文）
        micro_chunks = [c for c in chunks if c.metadata.level == 2]
        for micro_chunk in micro_chunks:
            parent_id = micro_chunk.metadata.parent_id
            parent_summary = macro_metadata.get(parent_id, {}).get('summary', '')

            # 构建带上下文的prompt
            enhanced_prompt = f"""
Parent Function: {micro_chunk.metadata.symbol_name}
Parent Summary: {parent_summary}

Code Block ({micro_chunk.metadata.chunk_type}):
```
{micro_chunk.content}
```

Generate a concise summary (1 sentence) and keywords for this specific code block.
"""

            metadata = self._call_llm_with_context(enhanced_prompt)
            results[micro_chunk.metadata.chunk_id] = metadata

        return results
```

### 5.2 Prompt优化

针对不同层级使用不同的prompt模板：

**Macro Chunk Prompt (Level 1)**:
```
PURPOSE: Generate comprehensive semantic metadata for a complete function/class
TASK:
- Provide a detailed summary (2-3 sentences) covering what the code does and why
- Extract 8-12 relevant keywords including technical terms and domain concepts
- Identify the primary purpose/category
MODE: analysis

CODE:
```{language}
{content}
```

OUTPUT: JSON with summary, keywords, purpose
```

**Micro Chunk Prompt (Level 2)**:
```
PURPOSE: Summarize a specific logic block within a larger function
CONTEXT:
- Parent Function: {symbol_name}
- Parent Purpose: {parent_summary}

TASK:
- Provide a brief summary (1 sentence) of this specific block's role in the parent function
- Extract 3-5 keywords specific to this block's logic
MODE: analysis

CODE BLOCK ({chunk_type}):
```{language}
{content}
```

OUTPUT: JSON with summary, keywords
```

## 6. 检索增强

### 6.1 上下文扩展检索

```python
class ContextualSearchEngine:
    """支持上下文扩展的检索引擎"""

    def search_with_context(
        self,
        query: str,
        top_k: int = 10,
        expand_context: bool = True
    ) -> List[SearchResult]:
        """
        检索并自动扩展上下文

        如果匹配到micro chunk，自动返回其父macro chunk作为上下文
        """

        # 生成查询向量
        query_embedding = self.embedder.embed_single(query)

        # 层级化检索
        raw_results = self.vector_store.search_hierarchical(
            query_embedding,
            top_k=top_k
        )

        # 扩展上下文
        enriched_results = []
        for chunk, score in raw_results:
            result = SearchResult(
                path=chunk.metadata.file_path,
                score=score,
                content=chunk.content,
                start_line=chunk.metadata.start_line,
                end_line=chunk.metadata.end_line,
                symbol_name=chunk.metadata.symbol_name,
            )

            # 如果是micro chunk，获取父chunk作为上下文
            if expand_context and chunk.metadata.level == 2:
                parent_chunk, _ = self.vector_store.get_chunk_with_context(
                    chunk.metadata.chunk_id
                )
                if parent_chunk:
                    result.metadata['parent_context'] = {
                        'summary': parent_chunk.metadata.context_summary,
                        'symbol_name': parent_chunk.metadata.symbol_name,
                        'content': parent_chunk.content,
                    }

            enriched_results.append(result)

        return enriched_results
```

## 7. 测试策略

### 7.1 单元测试

```python
import pytest
from codexlens.semantic.hierarchical_chunker import (
    HierarchicalChunker, MacroChunker, MicroChunker
)

class TestMacroChunker:
    """测试第一层分词"""

    def test_extract_functions(self):
        """测试提取函数定义"""
        code = '''
def calculate_total(items):
    """Calculate total price."""
    total = 0
    for item in items:
        total += item.price
    return total

def apply_discount(total, discount):
    """Apply discount to total."""
    return total * (1 - discount)
'''
        chunker = MacroChunker()
        chunks = chunker.chunk_by_symbols(code, 'test.py', 'python')

        assert len(chunks) == 2
        assert chunks[0].metadata.symbol_name == 'calculate_total'
        assert chunks[1].metadata.symbol_name == 'apply_discount'
        assert chunks[0].metadata.level == 1

    def test_extract_with_decorators(self):
        """测试提取带装饰器的函数"""
        code = '''
@app.route('/api/users')
@auth_required
def get_users():
    return User.query.all()
'''
        chunker = MacroChunker()
        chunks = chunker.chunk_by_symbols(code, 'test.py', 'python')

        assert len(chunks) == 1
        assert '@app.route' in chunks[0].content
        assert '@auth_required' in chunks[0].content

class TestMicroChunker:
    """测试第二层分词"""

    def test_extract_loop_blocks(self):
        """测试提取循环块"""
        code = '''
def process_items(items):
    results = []
    for item in items:
        if item.active:
            results.append(process(item))
    return results
'''
        macro_chunker = MacroChunker()
        macro_chunks = macro_chunker.chunk_by_symbols(code, 'test.py', 'python')

        micro_chunker = MicroChunker()
        micro_chunks = micro_chunker.chunk_logic_blocks(
            macro_chunks[0], code
        )

        # 应该提取出for循环和if条件块
        assert len(micro_chunks) >= 1
        assert any(c.metadata.chunk_type == 'for_statement' for c in micro_chunks)

    def test_skip_small_functions(self):
        """测试小函数跳过二次划分"""
        code = '''
def small_func(x):
    return x * 2
'''
        macro_chunker = MacroChunker()
        macro_chunks = macro_chunker.chunk_by_symbols(code, 'test.py', 'python')

        micro_chunker = MicroChunker()
        micro_chunks = micro_chunker.chunk_logic_blocks(
            macro_chunks[0], code, max_lines=10
        )

        # 小函数不应该被二次划分
        assert len(micro_chunks) == 0

class TestHierarchicalChunker:
    """测试完整的多层次分词"""

    def test_full_hierarchical_chunking(self):
        """测试完整的层级分词流程"""
        code = '''
def complex_function(data):
    """A complex function with multiple logic blocks."""

    # Validation
    if not data:
        raise ValueError("Data is empty")

    # Processing
    results = []
    for item in data:
        try:
            processed = process_item(item)
            results.append(processed)
        except Exception as e:
            logger.error(f"Failed to process: {e}")
            continue

    # Aggregation
    total = sum(r.value for r in results)
    return total
'''
        chunker = HierarchicalChunker()
        chunks = chunker.chunk_file(code, 'test.py', 'python')

        # 应该有1个macro chunk和多个micro chunks
        macro_chunks = [c for c in chunks if c.metadata.level == 1]
        micro_chunks = [c for c in chunks if c.metadata.level == 2]

        assert len(macro_chunks) == 1
        assert len(micro_chunks) > 0

        # 验证父子关系
        for micro in micro_chunks:
            assert micro.metadata.parent_id == macro_chunks[0].metadata.chunk_id
```

### 7.2 集成测试

```python
class TestHierarchicalIndexing:
    """测试完整的索引流程"""

    def test_index_and_search(self):
        """测试分层索引和检索"""

        # 1. 分词
        chunker = HierarchicalChunker()
        chunks = chunker.chunk_file(sample_code, 'sample.py', 'python')

        # 2. LLM增强
        enhancer = HierarchicalLLMEnhancer()
        metadata = enhancer.enhance_hierarchical_chunks(chunks)

        # 3. 向量化
        embedder = Embedder()
        for chunk in chunks:
            text = metadata[chunk.metadata.chunk_id].summary
            chunk.embedding = embedder.embed_single(text)

        # 4. 存储
        vector_store = HierarchicalVectorStore(Path('/tmp/test.db'))
        for chunk in chunks:
            vector_store.add_chunk(chunk)

        # 5. 检索
        search_engine = ContextualSearchEngine(vector_store, embedder)
        results = search_engine.search_with_context(
            "find loop that processes items",
            top_k=5
        )

        # 验证结果
        assert len(results) > 0
        assert any(r.metadata.get('parent_context') for r in results)
```

## 8. 性能优化

### 8.1 批量处理

```python
class BatchHierarchicalProcessor:
    """批量处理多个文件的层级分词"""

    def process_files_batch(
        self,
        file_paths: List[Path],
        batch_size: int = 10
    ):
        """批量处理，优化LLM调用"""

        all_chunks = []

        # 1. 批量分词
        for file_path in file_paths:
            content = file_path.read_text()
            chunks = self.chunker.chunk_file(
                content, str(file_path), self._detect_language(file_path)
            )
            all_chunks.extend(chunks)

        # 2. 批量LLM增强（减少API调用）
        macro_chunks = [c for c in all_chunks if c.metadata.level == 1]
        for i in range(0, len(macro_chunks), batch_size):
            batch = macro_chunks[i:i+batch_size]
            self.enhancer.enhance_batch(batch)

        # 3. 批量向量化
        all_texts = [c.content for c in all_chunks]
        embeddings = self.embedder.embed_batch(all_texts)
        for chunk, embedding in zip(all_chunks, embeddings):
            chunk.embedding = embedding

        # 4. 批量存储
        self.vector_store.add_chunks_batch(all_chunks)
```

### 8.2 增量更新

```python
class IncrementalIndexer:
    """增量索引器：只处理变化的文件"""

    def update_file(self, file_path: Path):
        """增量更新单个文件"""

        content = file_path.read_text()
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # 检查文件是否变化
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT content_hash FROM chunks
            WHERE file_path = ? AND level = 1
            LIMIT 1
        """, (str(file_path),))

        row = cursor.fetchone()
        if row and row[0] == content_hash:
            logger.info(f"File {file_path} unchanged, skipping")
            return

        # 删除旧chunk
        cursor.execute("DELETE FROM chunks WHERE file_path = ?", (str(file_path),))

        # 重新索引
        chunks = self.chunker.chunk_file(content, str(file_path), 'python')
        # ... 继续处理
```

## 9. 潜在问题与解决方案

### 9.1 问题：超大函数的micro chunk过多

**现象**：某些遗留代码函数超过1000行，可能产生几十个micro chunks。

**解决方案**：
```python
class AdaptiveMicroChunker:
    """自适应micro分词：根据函数大小调整策略"""

    def chunk_logic_blocks(self, macro_chunk, content):
        total_lines = macro_chunk.metadata.end_line - macro_chunk.metadata.start_line

        if total_lines > 500:
            # 超大函数：只提取顶层逻辑块，不递归
            return self._extract_top_level_blocks(macro_chunk, content)
        elif total_lines > 100:
            # 大函数：递归深度限制为2层
            return self._extract_blocks_with_depth_limit(macro_chunk, content, max_depth=2)
        else:
            # 正常函数：完全跳过micro chunking
            return []
```

### 9.2 问题：tree-sitter解析失败

**现象**：对于语法错误的代码，tree-sitter解析可能失败。

**解决方案**：
```python
def chunk_file_with_fallback(self, content, file_path, language):
    """带降级策略的分词"""

    try:
        # 尝试层级分词
        return self.chunk_file(content, file_path, language)
    except TreeSitterError as e:
        logger.warning(f"Tree-sitter parsing failed: {e}")

        # 降级到基于正则的简单symbol提取
        return self._fallback_regex_chunking(content, file_path)
    except Exception as e:
        logger.error(f"Chunking failed completely: {e}")

        # 最终降级到滑动窗口
        return self._fallback_sliding_window(content, file_path, language)
```

### 9.3 问题：向量存储空间占用

**现象**：每个chunk都存储向量，空间占用可能很大。

**解决方案**：
- **选择性向量化**：只对macro chunks和重要的micro chunks生成向量
- **向量压缩**：使用PCA或量化技术减少向量维度
- **分离存储**：向量存储在专门的向量数据库（如Faiss），SQLite只存元数据

```python
class SelectiveVectorization:
    """选择性向量化：减少存储开销"""

    VECTORIZE_CHUNK_TYPES = {
        'function_definition',   # 总是向量化
        'class_definition',      # 总是向量化
        'for_statement',         # 循环块
        'try_statement',         # 异常处理
        # 'if_statement' 通常不单独向量化，依赖父chunk
    }

    def should_vectorize(self, chunk: HierarchicalChunk) -> bool:
        """判断是否需要为chunk生成向量"""

        # Level 1总是向量化
        if chunk.metadata.level == 1:
            return True

        # Level 2根据类型和大小决定
        if chunk.metadata.chunk_type not in self.VECTORIZE_CHUNK_TYPES:
            return False

        # 太小的块（<5行）不向量化
        lines = chunk.metadata.end_line - chunk.metadata.start_line
        if lines < 5:
            return False

        return True
```

## 10. 实施路线图

### Phase 1: 基础架构（2-3周）
- [x] 设计数据结构（HierarchicalChunk, ChunkMetadata）
- [ ] 实现MacroChunker（复用现有code_extractor）
- [ ] 实现基础的MicroChunker
- [ ] 数据库schema设计和migration
- [ ] 单元测试

### Phase 2: LLM集成（1-2周）
- [ ] 实现HierarchicalLLMEnhancer
- [ ] 设计分层prompt模板
- [ ] 批量处理优化
- [ ] 集成测试

### Phase 3: 向量化与检索（1-2周）
- [ ] 实现HierarchicalVectorStore
- [ ] 实现ContextualSearchEngine
- [ ] 上下文扩展逻辑
- [ ] 检索性能测试

### Phase 4: 优化与完善（2周）
- [ ] 性能优化（批量处理、增量更新）
- [ ] 降级策略完善
- [ ] 选择性向量化
- [ ] 全面测试和文档

### Phase 5: 生产部署（1周）
- [ ] CLI集成
- [ ] 配置选项暴露
- [ ] 生产环境测试
- [ ] 发布

**总计预估时间**：7-10周

## 11. 成功指标

1. **覆盖率**：95%以上的代码能被正确分词
2. **准确率**：层级关系准确率>98%
3. **检索质量**：相比单层分词，检索相关性提升30%+
4. **性能**：单文件分词<100ms，批量处理>100文件/分钟
5. **存储效率**：相比全向量化，空间占用减少40%+

## 12. 参考资料

- [Tree-sitter Documentation](https://tree-sitter.github.io/)
- [AST-based Code Analysis](https://en.wikipedia.org/wiki/Abstract_syntax_tree)
- [Hierarchical Text Segmentation](https://arxiv.org/abs/2104.08836)
- 现有代码：`src/codexlens/semantic/chunker.py`
