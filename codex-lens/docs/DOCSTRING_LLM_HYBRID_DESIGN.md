# Docstring与LLM混合策略设计方案

## 1. 背景与目标

### 1.1 当前问题

现有 `llm_enhancer.py` 的实现存在以下问题：

1. **忽略已有文档**：对所有代码无差别调用LLM，即使已有高质量的docstring
2. **成本浪费**：重复生成已有信息，增加API调用费用和时间
3. **信息质量不一致**：LLM生成的内容可能不如作者编写的docstring准确
4. **缺少作者意图**：丢失了docstring中的设计决策、使用示例等关键信息

### 1.2 设计目标

实现**智能混合策略**，结合docstring和LLM的优势：

1. **优先使用docstring**：作为最权威的信息源
2. **LLM作为补充**：填补docstring缺失或质量不足的部分
3. **智能质量评估**：自动判断docstring质量，决定是否需要LLM增强
4. **成本优化**：减少不必要的LLM调用，降低API费用
5. **信息融合**：将docstring和LLM生成的内容有机结合

## 2. 技术架构

### 2.1 整体流程

```
Code Symbol
    ↓
[Docstring Extractor] ← 提取docstring
    ↓
[Quality Evaluator]   ← 评估docstring质量
    ↓
    ├─ High Quality → Use Docstring Directly
    │                 + LLM Generate Keywords Only
    │
    ├─ Medium Quality → LLM Refine & Enhance
    │                   (docstring作为base)
    │
    └─ Low/No Docstring → LLM Full Generation
                          (现有流程)
    ↓
[Metadata Merger]     ← 合并docstring和LLM内容
    ↓
Final SemanticMetadata
```

### 2.2 核心组件

```python
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class DocstringQuality(Enum):
    """Docstring质量等级"""
    MISSING = "missing"           # 无docstring
    LOW = "low"                   # 质量低：<10字符或纯占位符
    MEDIUM = "medium"             # 质量中：有基本描述但不完整
    HIGH = "high"                 # 质量高：详细且结构化

@dataclass
class DocstringMetadata:
    """从docstring提取的元数据"""
    raw_text: str
    quality: DocstringQuality
    summary: Optional[str] = None       # 提取的摘要
    parameters: Optional[dict] = None   # 参数说明
    returns: Optional[str] = None       # 返回值说明
    examples: Optional[str] = None      # 使用示例
    notes: Optional[str] = None         # 注意事项
```

## 3. 详细实现步骤

### 3.1 Docstring提取与解析

```python
import re
from typing import Optional

class DocstringExtractor:
    """Docstring提取器"""

    # Docstring风格正则
    GOOGLE_STYLE_PATTERN = re.compile(
        r'Args:|Returns:|Raises:|Examples:|Note:',
        re.MULTILINE
    )

    NUMPY_STYLE_PATTERN = re.compile(
        r'Parameters\n-+|Returns\n-+|Examples\n-+',
        re.MULTILINE
    )

    def extract_from_code(self, content: str, symbol: Symbol) -> Optional[str]:
        """从代码中提取docstring"""

        lines = content.splitlines()
        start_line = symbol.range[0] - 1  # 0-indexed

        # 查找函数定义后的第一个字符串字面量
        # 通常在函数定义的下一行或几行内
        for i in range(start_line + 1, min(start_line + 10, len(lines))):
            line = lines[i].strip()

            # Python triple-quoted string
            if line.startswith('"""') or line.startswith("'''"):
                return self._extract_multiline_docstring(lines, i)

        return None

    def _extract_multiline_docstring(
        self,
        lines: List[str],
        start_idx: int
    ) -> str:
        """提取多行docstring"""

        quote_char = '"""' if lines[start_idx].strip().startswith('"""') else "'''"
        docstring_lines = []

        # 检查是否单行docstring
        first_line = lines[start_idx].strip()
        if first_line.count(quote_char) == 2:
            # 单行: """This is a docstring."""
            return first_line.strip(quote_char).strip()

        # 多行docstring
        in_docstring = True
        for i in range(start_idx, len(lines)):
            line = lines[i]

            if i == start_idx:
                # 第一行：移除开始的引号
                docstring_lines.append(line.strip().lstrip(quote_char))
            elif quote_char in line:
                # 结束行：移除结束的引号
                docstring_lines.append(line.strip().rstrip(quote_char))
                break
            else:
                docstring_lines.append(line.strip())

        return '\n'.join(docstring_lines).strip()

    def parse_docstring(self, raw_docstring: str) -> DocstringMetadata:
        """解析docstring，提取结构化信息"""

        if not raw_docstring:
            return DocstringMetadata(
                raw_text="",
                quality=DocstringQuality.MISSING
            )

        # 评估质量
        quality = self._evaluate_quality(raw_docstring)

        # 提取各个部分
        metadata = DocstringMetadata(
            raw_text=raw_docstring,
            quality=quality,
        )

        # 提取摘要（第一行或第一段）
        metadata.summary = self._extract_summary(raw_docstring)

        # 如果是Google或NumPy风格，提取结构化内容
        if self.GOOGLE_STYLE_PATTERN.search(raw_docstring):
            self._parse_google_style(raw_docstring, metadata)
        elif self.NUMPY_STYLE_PATTERN.search(raw_docstring):
            self._parse_numpy_style(raw_docstring, metadata)

        return metadata

    def _evaluate_quality(self, docstring: str) -> DocstringQuality:
        """评估docstring质量"""

        if not docstring or len(docstring.strip()) == 0:
            return DocstringQuality.MISSING

        # 检查是否是占位符
        placeholders = ['todo', 'fixme', 'tbd', 'placeholder', '...']
        if any(p in docstring.lower() for p in placeholders):
            return DocstringQuality.LOW

        # 长度检查
        if len(docstring.strip()) < 10:
            return DocstringQuality.LOW

        # 检查是否有结构化内容
        has_structure = (
            self.GOOGLE_STYLE_PATTERN.search(docstring) or
            self.NUMPY_STYLE_PATTERN.search(docstring)
        )

        # 检查是否有足够的描述性文本
        word_count = len(docstring.split())

        if has_structure and word_count >= 20:
            return DocstringQuality.HIGH
        elif word_count >= 10:
            return DocstringQuality.MEDIUM
        else:
            return DocstringQuality.LOW

    def _extract_summary(self, docstring: str) -> str:
        """提取摘要（第一行或第一段）"""

        lines = docstring.split('\n')
        # 第一行非空行作为摘要
        for line in lines:
            if line.strip():
                return line.strip()

        return ""

    def _parse_google_style(self, docstring: str, metadata: DocstringMetadata):
        """解析Google风格docstring"""

        # 提取Args
        args_match = re.search(r'Args:(.*?)(?=Returns:|Raises:|Examples:|Note:|\Z)', docstring, re.DOTALL)
        if args_match:
            metadata.parameters = self._parse_args_section(args_match.group(1))

        # 提取Returns
        returns_match = re.search(r'Returns:(.*?)(?=Raises:|Examples:|Note:|\Z)', docstring, re.DOTALL)
        if returns_match:
            metadata.returns = returns_match.group(1).strip()

        # 提取Examples
        examples_match = re.search(r'Examples:(.*?)(?=Note:|\Z)', docstring, re.DOTALL)
        if examples_match:
            metadata.examples = examples_match.group(1).strip()

    def _parse_args_section(self, args_text: str) -> dict:
        """解析参数列表"""

        params = {}
        # 匹配 "param_name (type): description" 或 "param_name: description"
        pattern = re.compile(r'(\w+)\s*(?:\(([^)]+)\))?\s*:\s*(.+)')

        for line in args_text.split('\n'):
            match = pattern.search(line.strip())
            if match:
                param_name, param_type, description = match.groups()
                params[param_name] = {
                    'type': param_type,
                    'description': description.strip()
                }

        return params
```

### 3.2 智能混合策略引擎

```python
class HybridEnhancer:
    """Docstring与LLM混合增强器"""

    def __init__(
        self,
        llm_enhancer: LLMEnhancer,
        docstring_extractor: DocstringExtractor
    ):
        self.llm_enhancer = llm_enhancer
        self.docstring_extractor = docstring_extractor

    def enhance_with_strategy(
        self,
        file_data: FileData,
        symbols: List[Symbol]
    ) -> Dict[str, SemanticMetadata]:
        """根据docstring质量选择增强策略"""

        results = {}

        for symbol in symbols:
            # 1. 提取并解析docstring
            raw_docstring = self.docstring_extractor.extract_from_code(
                file_data.content, symbol
            )
            doc_metadata = self.docstring_extractor.parse_docstring(raw_docstring or "")

            # 2. 根据质量选择策略
            semantic_metadata = self._apply_strategy(
                file_data, symbol, doc_metadata
            )

            results[symbol.name] = semantic_metadata

        return results

    def _apply_strategy(
        self,
        file_data: FileData,
        symbol: Symbol,
        doc_metadata: DocstringMetadata
    ) -> SemanticMetadata:
        """应用混合策略"""

        quality = doc_metadata.quality

        if quality == DocstringQuality.HIGH:
            # 高质量：直接使用docstring，只用LLM生成keywords
            return self._use_docstring_with_llm_keywords(symbol, doc_metadata)

        elif quality == DocstringQuality.MEDIUM:
            # 中等质量：让LLM精炼和增强
            return self._refine_with_llm(file_data, symbol, doc_metadata)

        else:  # LOW or MISSING
            # 低质量或无：完全由LLM生成
            return self._full_llm_generation(file_data, symbol)

    def _use_docstring_with_llm_keywords(
        self,
        symbol: Symbol,
        doc_metadata: DocstringMetadata
    ) -> SemanticMetadata:
        """策略1：使用docstring，LLM只生成keywords"""

        # 直接使用docstring的摘要
        summary = doc_metadata.summary or doc_metadata.raw_text[:200]

        # 使用LLM生成keywords
        keywords = self._generate_keywords_only(summary, symbol.name)

        # 从docstring推断purpose
        purpose = self._infer_purpose_from_docstring(doc_metadata)

        return SemanticMetadata(
            summary=summary,
            keywords=keywords,
            purpose=purpose,
            file_path=symbol.file_path if hasattr(symbol, 'file_path') else None,
            symbol_name=symbol.name,
            llm_tool="hybrid_docstring_primary",
        )

    def _refine_with_llm(
        self,
        file_data: FileData,
        symbol: Symbol,
        doc_metadata: DocstringMetadata
    ) -> SemanticMetadata:
        """策略2：让LLM精炼和增强docstring"""

        prompt = f"""
PURPOSE: Refine and enhance an existing docstring for better semantic search
TASK:
- Review the existing docstring
- Generate a concise summary (1-2 sentences) that captures the core purpose
- Extract 8-12 relevant keywords for search
- Identify the functional category/purpose

EXISTING DOCSTRING:
{doc_metadata.raw_text}

CODE CONTEXT:
Function: {symbol.name}
```{file_data.language}
{self._get_symbol_code(file_data.content, symbol)}
```

OUTPUT: JSON format
{{
    "summary": "refined summary based on docstring and code",
    "keywords": ["keyword1", "keyword2", ...],
    "purpose": "category"
}}
"""

        response = self.llm_enhancer._invoke_ccw_cli(prompt, tool='gemini')
        if response['success']:
            data = json.loads(self.llm_enhancer._extract_json(response['stdout']))
            return SemanticMetadata(
                summary=data.get('summary', doc_metadata.summary),
                keywords=data.get('keywords', []),
                purpose=data.get('purpose', 'unknown'),
                file_path=file_data.path,
                symbol_name=symbol.name,
                llm_tool="hybrid_llm_refined",
            )

        # Fallback: 使用docstring
        return self._use_docstring_with_llm_keywords(symbol, doc_metadata)

    def _full_llm_generation(
        self,
        file_data: FileData,
        symbol: Symbol
    ) -> SemanticMetadata:
        """策略3：完全由LLM生成（原有流程）"""

        # 复用现有的LLM enhancer
        code_snippet = self._get_symbol_code(file_data.content, symbol)

        results = self.llm_enhancer.enhance_files([
            FileData(
                path=f"{file_data.path}:{symbol.name}",
                content=code_snippet,
                language=file_data.language
            )
        ])

        return results.get(f"{file_data.path}:{symbol.name}", SemanticMetadata(
            summary="",
            keywords=[],
            purpose="unknown",
            file_path=file_data.path,
            symbol_name=symbol.name,
            llm_tool="hybrid_llm_full",
        ))

    def _generate_keywords_only(self, summary: str, symbol_name: str) -> List[str]:
        """仅生成keywords（快速LLM调用）"""

        prompt = f"""
PURPOSE: Generate search keywords for a code function
TASK: Extract 5-8 relevant keywords from the summary

Summary: {summary}
Function Name: {symbol_name}

OUTPUT: Comma-separated keywords
"""

        response = self.llm_enhancer._invoke_ccw_cli(prompt, tool='gemini')
        if response['success']:
            keywords_str = response['stdout'].strip()
            return [k.strip() for k in keywords_str.split(',')]

        # Fallback: 从摘要提取关键词
        return self._extract_keywords_heuristic(summary)

    def _extract_keywords_heuristic(self, text: str) -> List[str]:
        """启发式关键词提取（无需LLM）"""

        # 简单实现：提取名词性词组
        import re
        words = re.findall(r'\b[a-z]{4,}\b', text.lower())

        # 过滤常见词
        stopwords = {'this', 'that', 'with', 'from', 'have', 'will', 'your', 'their'}
        keywords = [w for w in words if w not in stopwords]

        return list(set(keywords))[:8]

    def _infer_purpose_from_docstring(self, doc_metadata: DocstringMetadata) -> str:
        """从docstring推断purpose（无需LLM）"""

        summary = doc_metadata.summary.lower()

        # 简单规则匹配
        if 'authenticate' in summary or 'login' in summary:
            return 'auth'
        elif 'validate' in summary or 'check' in summary:
            return 'validation'
        elif 'parse' in summary or 'format' in summary:
            return 'data_processing'
        elif 'api' in summary or 'endpoint' in summary:
            return 'api'
        elif 'database' in summary or 'query' in summary:
            return 'data'
        elif 'test' in summary:
            return 'test'

        return 'util'

    def _get_symbol_code(self, content: str, symbol: Symbol) -> str:
        """提取符号的代码"""

        lines = content.splitlines()
        start, end = symbol.range
        return '\n'.join(lines[start-1:end])
```

### 3.3 成本优化统计

```python
@dataclass
class EnhancementStats:
    """增强统计"""
    total_symbols: int = 0
    used_docstring_only: int = 0      # 只使用docstring
    llm_keywords_only: int = 0        # LLM只生成keywords
    llm_refined: int = 0              # LLM精炼docstring
    llm_full_generation: int = 0      # LLM完全生成
    total_llm_calls: int = 0
    estimated_cost_savings: float = 0.0  # 相比全用LLM节省的成本

class CostOptimizedEnhancer(HybridEnhancer):
    """带成本统计的增强器"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stats = EnhancementStats()

    def enhance_with_strategy(
        self,
        file_data: FileData,
        symbols: List[Symbol]
    ) -> Dict[str, SemanticMetadata]:
        """增强并统计成本"""

        self.stats.total_symbols += len(symbols)
        results = super().enhance_with_strategy(file_data, symbols)

        # 统计各策略使用情况
        for metadata in results.values():
            if metadata.llm_tool == "hybrid_docstring_primary":
                self.stats.used_docstring_only += 1
                self.stats.llm_keywords_only += 1
                self.stats.total_llm_calls += 1
            elif metadata.llm_tool == "hybrid_llm_refined":
                self.stats.llm_refined += 1
                self.stats.total_llm_calls += 1
            elif metadata.llm_tool == "hybrid_llm_full":
                self.stats.llm_full_generation += 1
                self.stats.total_llm_calls += 1

        # 计算成本节省（假设：keywords-only调用成本为full的20%）
        keywords_only_savings = self.stats.llm_keywords_only * 0.8  # 节省80%
        full_generation_count = self.stats.total_symbols - self.stats.llm_keywords_only
        self.stats.estimated_cost_savings = keywords_only_savings / full_generation_count if full_generation_count > 0 else 0

        return results

    def print_stats(self):
        """打印统计信息"""

        print("=== Enhancement Statistics ===")
        print(f"Total Symbols: {self.stats.total_symbols}")
        print(f"Used Docstring (with LLM keywords): {self.stats.used_docstring_only} ({self.stats.used_docstring_only/self.stats.total_symbols*100:.1f}%)")
        print(f"LLM Refined Docstring: {self.stats.llm_refined} ({self.stats.llm_refined/self.stats.total_symbols*100:.1f}%)")
        print(f"LLM Full Generation: {self.stats.llm_full_generation} ({self.stats.llm_full_generation/self.stats.total_symbols*100:.1f}%)")
        print(f"Total LLM Calls: {self.stats.total_llm_calls}")
        print(f"Estimated Cost Savings: {self.stats.estimated_cost_savings*100:.1f}%")
```

## 4. 配置选项

```python
@dataclass
class HybridEnhancementConfig:
    """混合增强配置"""

    # 是否启用混合策略（False则回退到全LLM模式）
    enable_hybrid: bool = True

    # 质量阈值配置
    use_docstring_threshold: DocstringQuality = DocstringQuality.HIGH
    refine_docstring_threshold: DocstringQuality = DocstringQuality.MEDIUM

    # 是否为高质量docstring生成keywords
    generate_keywords_for_docstring: bool = True

    # LLM配置
    llm_tool: str = "gemini"
    llm_timeout: int = 300000

    # 成本优化
    batch_size: int = 5              # 批量处理大小
    skip_test_files: bool = True     # 跳过测试文件（通常docstring较少）

    # 调试选项
    log_strategy_decisions: bool = False  # 记录策略决策日志
```

## 5. 测试策略

### 5.1 单元测试

```python
import pytest

class TestDocstringExtractor:
    """测试docstring提取"""

    def test_extract_google_style(self):
        """测试Google风格docstring提取"""
        code = '''
def calculate_total(items, discount=0):
    """Calculate total price with optional discount.

    This function processes a list of items and applies
    a discount if specified.

    Args:
        items (list): List of item objects with price attribute.
        discount (float): Discount percentage (0-1). Defaults to 0.

    Returns:
        float: Total price after discount.

    Examples:
        >>> calculate_total([item1, item2], discount=0.1)
        90.0
    """
    total = sum(item.price for item in items)
    return total * (1 - discount)
'''
        extractor = DocstringExtractor()
        symbol = Symbol(name='calculate_total', kind='function', range=(1, 18))
        docstring = extractor.extract_from_code(code, symbol)

        assert docstring is not None
        metadata = extractor.parse_docstring(docstring)

        assert metadata.quality == DocstringQuality.HIGH
        assert 'Calculate total price' in metadata.summary
        assert metadata.parameters is not None
        assert 'items' in metadata.parameters
        assert metadata.returns is not None
        assert metadata.examples is not None

    def test_extract_low_quality_docstring(self):
        """测试低质量docstring识别"""
        code = '''
def process():
    """TODO"""
    pass
'''
        extractor = DocstringExtractor()
        symbol = Symbol(name='process', kind='function', range=(1, 3))
        docstring = extractor.extract_from_code(code, symbol)

        metadata = extractor.parse_docstring(docstring)
        assert metadata.quality == DocstringQuality.LOW

class TestHybridEnhancer:
    """测试混合增强器"""

    def test_high_quality_docstring_strategy(self):
        """测试高质量docstring使用策略"""

        extractor = DocstringExtractor()
        llm_enhancer = LLMEnhancer(LLMConfig(enabled=True))
        hybrid = HybridEnhancer(llm_enhancer, extractor)

        # 模拟高质量docstring
        doc_metadata = DocstringMetadata(
            raw_text="Validate user credentials against database.",
            quality=DocstringQuality.HIGH,
            summary="Validate user credentials against database."
        )

        symbol = Symbol(name='validate_user', kind='function', range=(1, 10))

        result = hybrid._use_docstring_with_llm_keywords(symbol, doc_metadata)

        # 应该使用docstring的摘要
        assert result.summary == doc_metadata.summary
        # 应该有keywords（可能由LLM或启发式生成）
        assert len(result.keywords) > 0

    def test_cost_optimization(self):
        """测试成本优化效果"""

        enhancer = CostOptimizedEnhancer(
            llm_enhancer=LLMEnhancer(LLMConfig(enabled=False)),  # Mock
            docstring_extractor=DocstringExtractor()
        )

        # 模拟处理10个symbol，其中5个有高质量docstring
        # 预期：5个只调用keywords生成，5个完整LLM
        # 总调用10次，但成本降低（keywords调用更便宜）

        # 实际测试需要mock LLM调用
        pass
```

### 5.2 集成测试

```python
class TestHybridEnhancementPipeline:
    """测试完整的混合增强流程"""

    def test_full_pipeline(self):
        """测试完整流程：代码 -> docstring提取 -> 质量评估 -> 策略选择 -> 增强"""

        code = '''
def authenticate_user(username, password):
    """Authenticate user with username and password.

    Args:
        username (str): User's username
        password (str): User's password

    Returns:
        bool: True if authenticated, False otherwise
    """
    # ... implementation
    pass

def helper_func(x):
    # No docstring
    return x * 2
'''

        file_data = FileData(path='auth.py', content=code, language='python')
        symbols = [
            Symbol(name='authenticate_user', kind='function', range=(1, 11)),
            Symbol(name='helper_func', kind='function', range=(13, 15)),
        ]

        extractor = DocstringExtractor()
        llm_enhancer = LLMEnhancer(LLMConfig(enabled=True))
        hybrid = CostOptimizedEnhancer(llm_enhancer, extractor)

        results = hybrid.enhance_with_strategy(file_data, symbols)

        # authenticate_user 应该使用docstring
        assert results['authenticate_user'].llm_tool == "hybrid_docstring_primary"

        # helper_func 应该完全LLM生成
        assert results['helper_func'].llm_tool == "hybrid_llm_full"

        # 统计
        assert hybrid.stats.total_symbols == 2
        assert hybrid.stats.used_docstring_only >= 1
        assert hybrid.stats.llm_full_generation >= 1
```

## 6. 实施路线图

### Phase 1: 基础设施（1周）
- [x] 设计数据结构（DocstringMetadata, DocstringQuality）
- [ ] 实现DocstringExtractor（提取和解析）
- [ ] 支持Python docstring（Google/NumPy/reStructuredText风格）
- [ ] 单元测试

### Phase 2: 质量评估（1周）
- [ ] 实现质量评估算法
- [ ] 启发式规则优化
- [ ] 测试不同质量的docstring
- [ ] 调整阈值参数

### Phase 3: 混合策略（1-2周）
- [ ] 实现HybridEnhancer
- [ ] 三种策略实现（docstring-only, refine, full-llm）
- [ ] 策略选择逻辑
- [ ] 集成测试

### Phase 4: 成本优化（1周）
- [ ] 实现CostOptimizedEnhancer
- [ ] 统计和监控
- [ ] 批量处理优化
- [ ] 性能测试

### Phase 5: 多语言支持（1-2周）
- [ ] JavaScript/TypeScript JSDoc
- [ ] Java Javadoc
- [ ] 其他语言docstring格式

### Phase 6: 集成与部署（1周）
- [ ] 集成到现有llm_enhancer
- [ ] CLI选项暴露
- [ ] 配置文件支持
- [ ] 文档和示例

**总计预估时间**：6-8周

## 7. 性能与成本分析

### 7.1 预期成本节省

假设场景：分析1000个函数

| Docstring质量分布 | 占比 | LLM调用策略 | 相对成本 |
|------------------|------|------------|---------|
| High (有详细docstring) | 30% | 只生成keywords | 20% |
| Medium (有基本docstring) | 40% | 精炼增强 | 60% |
| Low/Missing | 30% | 完全生成 | 100% |

**总成本计算**：
- 纯LLM模式：1000 * 100% = 1000 units
- 混合模式：300*20% + 400*60% + 300*100% = 60 + 240 + 300 = 600 units
- **节省**：40%

### 7.2 质量对比

| 指标 | 纯LLM模式 | 混合模式 |
|------|----------|---------|
| 准确性 | 中（可能有幻觉） | **高**（docstring权威） |
| 一致性 | 中（依赖prompt） | **高**（保留作者风格） |
| 覆盖率 | **高**（全覆盖） | 高（98%+） |
| 成本 | 高 | **低**（节省40%） |
| 速度 | 慢（所有文件） | **快**（减少LLM调用） |

## 8. 潜在问题与解决方案

### 8.1 问题：Docstring过时

**现象**：代码已修改，但docstring未更新，导致信息不准确。

**解决方案**：
```python
class DocstringFreshnessChecker:
    """检查docstring与代码的一致性"""

    def check_freshness(
        self,
        symbol: Symbol,
        code: str,
        doc_metadata: DocstringMetadata
    ) -> bool:
        """检查docstring是否与代码匹配"""

        # 检查1: 参数列表是否匹配
        if doc_metadata.parameters:
            actual_params = self._extract_actual_parameters(code)
            documented_params = set(doc_metadata.parameters.keys())

            if actual_params != documented_params:
                logger.warning(
                    f"Parameter mismatch in {symbol.name}: "
                    f"code has {actual_params}, doc has {documented_params}"
                )
                return False

        # 检查2: 使用LLM验证一致性
        # TODO: 构建验证prompt

        return True
```

### 8.2 问题：不同docstring风格混用

**现象**：同一项目中使用多种docstring风格（Google, NumPy, 自定义）。

**解决方案**：
```python
class MultiStyleDocstringParser:
    """支持多种docstring风格的解析器"""

    def parse(self, docstring: str) -> DocstringMetadata:
        """自动检测并解析不同风格"""

        # 尝试各种解析器
        for parser in [
            GoogleStyleParser(),
            NumpyStyleParser(),
            ReStructuredTextParser(),
            SimpleParser(),  # Fallback
        ]:
            try:
                metadata = parser.parse(docstring)
                if metadata.quality != DocstringQuality.LOW:
                    return metadata
            except Exception:
                continue

        # 如果所有解析器都失败，返回简单解析结果
        return SimpleParser().parse(docstring)
```

### 8.3 问题：多语言docstring提取差异

**现象**：不同语言的docstring格式和位置不同。

**解决方案**：
```python
class LanguageSpecificExtractor:
    """语言特定的docstring提取器"""

    def extract(self, language: str, code: str, symbol: Symbol) -> Optional[str]:
        """根据语言选择合适的提取器"""

        extractors = {
            'python': PythonDocstringExtractor(),
            'javascript': JSDocExtractor(),
            'typescript': TSDocExtractor(),
            'java': JavadocExtractor(),
        }

        extractor = extractors.get(language, GenericExtractor())
        return extractor.extract(code, symbol)

class JSDocExtractor:
    """JavaScript/TypeScript JSDoc提取器"""

    def extract(self, code: str, symbol: Symbol) -> Optional[str]:
        """提取JSDoc注释"""

        lines = code.splitlines()
        start_line = symbol.range[0] - 1

        # 向上查找 /** ... */ 注释
        for i in range(start_line - 1, max(0, start_line - 20), -1):
            if '*/' in lines[i]:
                # 找到结束标记，向上提取
                return self._extract_jsdoc_block(lines, i)

        return None
```

## 9. 配置示例

### 9.1 配置文件

```yaml
# .codexlens/hybrid_enhancement.yaml

hybrid_enhancement:
  enabled: true

  # 质量阈值
  quality_thresholds:
    use_docstring: high      # high/medium/low
    refine_docstring: medium

  # LLM选项
  llm:
    tool: gemini
    fallback: qwen
    timeout_ms: 300000
    batch_size: 5

  # 成本优化
  cost_optimization:
    generate_keywords_for_docstring: true
    skip_test_files: true
    skip_private_methods: false

  # 语言支持
  languages:
    python:
      styles: [google, numpy, sphinx]
    javascript:
      styles: [jsdoc]
    java:
      styles: [javadoc]

  # 监控
  logging:
    log_strategy_decisions: false
    log_cost_savings: true
```

### 9.2 CLI使用

```bash
# 使用混合策略增强
codex-lens enhance . --hybrid --tool gemini

# 查看成本统计
codex-lens enhance . --hybrid --show-stats

# 仅对高质量docstring生成keywords
codex-lens enhance . --hybrid --keywords-only

# 禁用混合模式，回退到纯LLM
codex-lens enhance . --no-hybrid --tool gemini
```

## 10. 成功指标

1. **成本节省**：相比纯LLM模式，降低API调用成本40%+
2. **准确性提升**：使用docstring的符号，元数据准确率>95%
3. **覆盖率**：98%+的符号有语义元数据（docstring或LLM生成）
4. **速度提升**：整体处理速度提升30%+（减少LLM调用）
5. **用户满意度**：保留docstring信息，开发者认可度高

## 11. 参考资料

- [PEP 257 - Docstring Conventions](https://peps.python.org/pep-0257/)
- [Google Python Style Guide - Docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- [NumPy Docstring Standard](https://numpydoc.readthedocs.io/en/latest/format.html)
- [JSDoc Documentation](https://jsdoc.app/)
- [Javadoc Tool](https://docs.oracle.com/javase/8/docs/technotes/tools/windows/javadoc.html)
