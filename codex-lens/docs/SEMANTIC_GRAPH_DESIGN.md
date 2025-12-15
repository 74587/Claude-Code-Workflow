# 静态分析语义图谱设计方案

## 1. 背景与目标

### 1.1 当前问题

现有的 `llm_enhancer.py` 对代码的分析是**孤立的、原子化的**：
- 每个函数/类被视为独立单元
- 无法识别函数调用关系
- 无法追踪数据流
- 无法理解模块依赖

这导致无法回答以下类型的问题：
- "修改这个函数会影响哪些模块？"
- "这个API的完整数据流路径是什么？"
- "找出所有操作User实体的写入方法"
- "哪些函数依赖这个配置参数？"

### 1.2 设计目标

构建**代码语义图谱**（Code Semantic Graph），实现：

1. **调用关系分析**：函数/方法调用图（Call Graph）
2. **数据流追踪**：变量定义、使用、传递路径
3. **依赖关系管理**：模块/类/包之间的依赖
4. **实体关系映射**：识别数据模型及其操作方法
5. **LLM增强的语义理解**：结合静态分析和LLM，理解调用的"意图"

## 2. 技术架构

### 2.1 整体架构

```
Source Code Files
      ↓
[Static Analysis Layer]
   ├─ AST Parsing (tree-sitter)
   ├─ Call Graph Extraction
   ├─ Data Flow Analysis
   └─ Dependency Resolution
      ↓
[Graph Construction Layer]
   ├─ Node Creation (Functions/Classes/Modules)
   ├─ Edge Creation (Calls/Imports/DataFlow)
   └─ Graph Storage (SQLite/Neo4j)
      ↓
[LLM Enhancement Layer]
   ├─ Relationship Semantics
   ├─ Intent Analysis
   └─ Pattern Recognition
      ↓
[Query & Reasoning Layer]
   ├─ Graph Traversal
   ├─ Impact Analysis
   └─ Semantic Search Integration
```

### 2.2 核心组件

#### 2.2.1 图节点类型（Nodes）

```python
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional, Set

class NodeType(Enum):
    """节点类型"""
    MODULE = "module"           # 模块/文件
    CLASS = "class"             # 类
    FUNCTION = "function"       # 函数
    METHOD = "method"           # 方法
    VARIABLE = "variable"       # 变量
    PARAMETER = "parameter"     # 参数
    DATA_MODEL = "data_model"   # 数据模型（识别出的实体类）

@dataclass
class CodeNode:
    """代码图节点"""
    node_id: str                # 唯一标识：file:line:name
    node_type: NodeType
    name: str
    qualified_name: str         # 完全限定名：module.class.method
    file_path: str
    start_line: int
    end_line: int

    # 静态分析元数据
    signature: Optional[str] = None      # 函数/方法签名
    docstring: Optional[str] = None
    modifiers: Set[str] = None          # public/private/static等

    # LLM生成的语义元数据
    summary: Optional[str] = None
    purpose: Optional[str] = None
    tags: List[str] = None              # 如：crud, validation, auth
```

#### 2.2.2 图边类型（Edges）

```python
class EdgeType(Enum):
    """边类型"""
    CALLS = "calls"                     # A调用B
    IMPORTS = "imports"                 # A导入B
    INHERITS = "inherits"               # A继承B
    IMPLEMENTS = "implements"           # A实现B（接口）
    USES_VARIABLE = "uses_variable"     # A使用变量B
    DEFINES_VARIABLE = "defines_variable"  # A定义变量B
    PASSES_DATA = "passes_data"         # A向B传递数据
    MODIFIES = "modifies"               # A修改B（如数据库写入）
    READS = "reads"                     # A读取B（如数据库查询）

@dataclass
class CodeEdge:
    """代码图边"""
    edge_id: str
    source_id: str              # 源节点ID
    target_id: str              # 目标节点ID
    edge_type: EdgeType

    # 边的上下文信息
    context: Optional[str] = None       # 调用发生的代码片段
    line_number: Optional[int] = None   # 调用所在行号

    # LLM生成的语义
    semantic_intent: Optional[str] = None  # 如"验证用户权限"
    confidence: float = 1.0              # 置信度
```

## 3. 详细实现步骤

### 3.1 静态分析引擎

#### 3.1.1 AST解析与符号提取

```python
from tree_sitter import Language, Parser
from pathlib import Path
from typing import Dict, List

class ASTAnalyzer:
    """基于tree-sitter的AST分析器"""

    def __init__(self, language: str):
        self.language = language
        self.parser = Parser()
        # 加载语言grammar

    def extract_symbols(self, content: str, file_path: str) -> List[CodeNode]:
        """提取所有符号定义"""

        tree = self.parser.parse(bytes(content, 'utf-8'))
        root = tree.root_node

        symbols = []
        self._traverse_definitions(root, content, file_path, symbols)
        return symbols

    def _traverse_definitions(
        self,
        node,
        content: str,
        file_path: str,
        result: List[CodeNode],
        parent_class: str = None
    ):
        """递归遍历提取定义"""

        if node.type == 'function_definition':
            func_node = self._create_function_node(node, content, file_path)
            result.append(func_node)

        elif node.type == 'class_definition':
            class_node = self._create_class_node(node, content, file_path)
            result.append(class_node)

            # 遍历类内部的方法
            for child in node.children:
                if child.type == 'block':
                    for method in child.children:
                        if method.type == 'function_definition':
                            method_node = self._create_method_node(
                                method, content, file_path, class_node.name
                            )
                            result.append(method_node)

        # 递归遍历子节点
        for child in node.children:
            self._traverse_definitions(
                child, content, file_path, result, parent_class
            )

    def _create_function_node(self, node, content: str, file_path: str) -> CodeNode:
        """创建函数节点"""

        name_node = node.child_by_field_name('name')
        func_name = content[name_node.start_byte:name_node.end_byte]

        # 提取参数列表
        params_node = node.child_by_field_name('parameters')
        signature = content[params_node.start_byte:params_node.end_byte]

        # 提取docstring
        docstring = self._extract_docstring(node, content)

        return CodeNode(
            node_id=f"{file_path}:{node.start_point[0]}:{func_name}",
            node_type=NodeType.FUNCTION,
            name=func_name,
            qualified_name=f"{Path(file_path).stem}.{func_name}",
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            signature=f"{func_name}{signature}",
            docstring=docstring,
        )

    def _extract_docstring(self, node, content: str) -> Optional[str]:
        """提取docstring"""

        # 查找函数体的第一个表达式语句
        body = node.child_by_field_name('body')
        if not body:
            return None

        for child in body.children:
            if child.type == 'expression_statement':
                expr = child.children[0]
                if expr.type == 'string':
                    # 提取字符串内容（去掉引号）
                    doc = content[expr.start_byte:expr.end_byte]
                    return doc.strip('"""').strip("'''").strip()

        return None
```

#### 3.1.2 调用图提取

```python
class CallGraphExtractor:
    """调用图提取器"""

    def __init__(self, ast_analyzer: ASTAnalyzer):
        self.ast_analyzer = ast_analyzer

    def extract_calls(
        self,
        content: str,
        file_path: str,
        symbols: List[CodeNode]
    ) -> List[CodeEdge]:
        """提取函数调用关系"""

        tree = self.ast_analyzer.parser.parse(bytes(content, 'utf-8'))
        calls = []

        # 为每个函数/方法提取其内部的调用
        for symbol in symbols:
            if symbol.node_type in [NodeType.FUNCTION, NodeType.METHOD]:
                symbol_calls = self._extract_calls_in_function(
                    tree, symbol, content, file_path
                )
                calls.extend(symbol_calls)

        return calls

    def _extract_calls_in_function(
        self,
        tree,
        caller: CodeNode,
        content: str,
        file_path: str
    ) -> List[CodeEdge]:
        """提取单个函数内的所有调用"""

        # 定位到函数的AST节点
        func_node = self._find_node_by_line(tree.root_node, caller.start_line)
        if not func_node:
            return []

        calls = []
        self._traverse_calls(func_node, caller, content, file_path, calls)
        return calls

    def _traverse_calls(
        self,
        node,
        caller: CodeNode,
        content: str,
        file_path: str,
        result: List[CodeEdge]
    ):
        """递归遍历查找call表达式"""

        if node.type == 'call':
            # 提取被调用的函数名
            function_node = node.child_by_field_name('function')
            callee_name = content[function_node.start_byte:function_node.end_byte]

            # 提取调用的上下文（所在行）
            call_line = node.start_point[0] + 1
            line_content = content.splitlines()[node.start_point[0]]

            edge = CodeEdge(
                edge_id=f"{caller.node_id}→{callee_name}:{call_line}",
                source_id=caller.node_id,
                target_id=callee_name,  # 暂时用名称，后续需要解析
                edge_type=EdgeType.CALLS,
                context=line_content.strip(),
                line_number=call_line,
            )
            result.append(edge)

        # 递归遍历
        for child in node.children:
            self._traverse_calls(child, caller, content, file_path, result)

    def _find_node_by_line(self, node, target_line: int):
        """根据行号查找AST节点"""

        if node.start_point[0] + 1 == target_line:
            return node

        for child in node.children:
            result = self._find_node_by_line(child, target_line)
            if result:
                return result

        return None
```

#### 3.1.3 名称解析（Name Resolution）

```python
class NameResolver:
    """将函数调用的名称解析为具体的符号定义"""

    def __init__(self, symbol_table: Dict[str, CodeNode]):
        """
        symbol_table: 符号表，映射 qualified_name -> CodeNode
        """
        self.symbol_table = symbol_table

    def resolve_call_target(
        self,
        call_edge: CodeEdge,
        caller_context: CodeNode
    ) -> Optional[str]:
        """
        解析调用目标的完整node_id

        策略：
        1. 检查是否是本地函数调用（同文件）
        2. 检查是否是导入的模块函数
        3. 检查是否是方法调用（self.method）
        """

        callee_name = call_edge.target_id

        # 策略1: 本地调用（同文件）
        local_qualified = f"{Path(caller_context.file_path).stem}.{callee_name}"
        if local_qualified in self.symbol_table:
            return self.symbol_table[local_qualified].node_id

        # 策略2: 方法调用（提取对象名）
        if '.' in callee_name:
            parts = callee_name.split('.')
            if parts[0] == 'self':
                # self.method_name -> 在当前类中查找
                method_name = parts[1]
                # 需要找到caller所属的类
                class_name = self._find_containing_class(caller_context)
                if class_name:
                    class_qualified = f"{Path(caller_context.file_path).stem}.{class_name}.{method_name}"
                    if class_qualified in self.symbol_table:
                        return self.symbol_table[class_qualified].node_id

        # 策略3: 导入的函数（需要扫描import语句）
        # TODO: 实现跨文件的导入解析

        return None

    def _find_containing_class(self, node: CodeNode) -> Optional[str]:
        """找到函数/方法所属的类"""
        # 通过qualified_name推断
        parts = node.qualified_name.split('.')
        if len(parts) > 2:  # module.class.method
            return parts[-2]
        return None
```

### 3.2 图存储与索引

#### 3.2.1 数据库Schema（SQLite版本）

```sql
-- 节点表
CREATE TABLE code_nodes (
    node_id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,  -- module/class/function/method/variable
    name TEXT NOT NULL,
    qualified_name TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,

    -- 静态分析元数据
    signature TEXT,
    docstring TEXT,
    modifiers TEXT,  -- JSON数组

    -- LLM语义元数据
    summary TEXT,
    purpose TEXT,
    tags TEXT,  -- JSON数组

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 边表
CREATE TABLE code_edges (
    edge_id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,  -- calls/imports/inherits/uses_variable等

    -- 上下文
    context TEXT,
    line_number INTEGER,

    -- LLM语义
    semantic_intent TEXT,
    confidence REAL DEFAULT 1.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_id) REFERENCES code_nodes(node_id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES code_nodes(node_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_nodes_type ON code_nodes(node_type);
CREATE INDEX idx_nodes_file ON code_nodes(file_path);
CREATE INDEX idx_nodes_qualified ON code_nodes(qualified_name);

CREATE INDEX idx_edges_source ON code_edges(source_id);
CREATE INDEX idx_edges_target ON code_edges(target_id);
CREATE INDEX idx_edges_type ON code_edges(edge_type);

-- 用于快速查找调用关系
CREATE INDEX idx_edges_source_type ON code_edges(source_id, edge_type);
CREATE INDEX idx_edges_target_type ON code_edges(target_id, edge_type);
```

#### 3.2.2 图存储接口

```python
import sqlite3
from typing import List, Optional, Set

class CodeGraphStore:
    """代码图谱存储"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self._create_tables()

    def add_node(self, node: CodeNode):
        """添加节点"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO code_nodes (
                node_id, node_type, name, qualified_name,
                file_path, start_line, end_line,
                signature, docstring, summary, purpose
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            node.node_id, node.node_type.value, node.name,
            node.qualified_name, node.file_path,
            node.start_line, node.end_line,
            node.signature, node.docstring,
            node.summary, node.purpose
        ))
        self.conn.commit()

    def add_edge(self, edge: CodeEdge):
        """添加边"""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO code_edges (
                edge_id, source_id, target_id, edge_type,
                context, line_number, semantic_intent, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            edge.edge_id, edge.source_id, edge.target_id,
            edge.edge_type.value, edge.context, edge.line_number,
            edge.semantic_intent, edge.confidence
        ))
        self.conn.commit()

    def get_node(self, node_id: str) -> Optional[CodeNode]:
        """获取节点"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM code_nodes WHERE node_id = ?", (node_id,))
        row = cursor.fetchone()
        return self._row_to_node(row) if row else None

    def get_callers(self, node_id: str) -> List[CodeNode]:
        """获取所有调用该节点的节点（反向查询）"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT n.* FROM code_nodes n
            JOIN code_edges e ON n.node_id = e.source_id
            WHERE e.target_id = ? AND e.edge_type = 'calls'
        """, (node_id,))

        return [self._row_to_node(row) for row in cursor.fetchall()]

    def get_callees(self, node_id: str) -> List[CodeNode]:
        """获取该节点调用的所有节点（正向查询）"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT n.* FROM code_nodes n
            JOIN code_edges e ON n.node_id = e.target_id
            WHERE e.source_id = ? AND e.edge_type = 'calls'
        """, (node_id,))

        return [self._row_to_node(row) for row in cursor.fetchall()]

    def get_call_chain(
        self,
        start_node_id: str,
        max_depth: int = 5
    ) -> List[List[CodeNode]]:
        """获取调用链（DFS遍历）"""

        visited = set()
        chains = []

        def dfs(node_id: str, path: List[CodeNode], depth: int):
            if depth > max_depth or node_id in visited:
                return

            visited.add(node_id)
            node = self.get_node(node_id)
            if not node:
                return

            current_path = path + [node]
            callees = self.get_callees(node_id)

            if not callees:
                # 叶子节点，记录完整路径
                chains.append(current_path)
            else:
                for callee in callees:
                    dfs(callee.node_id, current_path, depth + 1)

            visited.remove(node_id)

        dfs(start_node_id, [], 0)
        return chains
```

### 3.3 LLM语义增强

#### 3.3.1 关系语义分析

```python
class RelationshipSemanticAnalyzer:
    """为代码关系生成语义描述"""

    def __init__(self, llm_enhancer: LLMEnhancer):
        self.llm_enhancer = llm_enhancer

    def analyze_call_intent(
        self,
        edge: CodeEdge,
        caller: CodeNode,
        callee: CodeNode
    ) -> str:
        """分析函数调用的意图"""

        # 构建提示词
        prompt = f"""
PURPOSE: Analyze the intent of a function call relationship
TASK: Describe in 1 sentence WHY function A calls function B and what purpose it serves

CONTEXT:
Caller Function: {caller.name}
Caller Summary: {caller.summary or 'N/A'}
Caller Code Snippet:
```
{edge.context}
```

Callee Function: {callee.name}
Callee Summary: {callee.summary or 'N/A'}
Callee Signature: {callee.signature or 'N/A'}

OUTPUT: A concise semantic description of the call intent.
Example: "validates user credentials before granting access"
"""

        response = self.llm_enhancer._invoke_ccw_cli(prompt, tool='gemini')
        if response['success']:
            intent = response['stdout'].strip()
            return intent

        return "unknown intent"

    def batch_analyze_calls(
        self,
        edges: List[CodeEdge],
        nodes_map: Dict[str, CodeNode]
    ) -> Dict[str, str]:
        """批量分析调用意图（优化LLM调用）"""

        # 构建批量prompt
        call_descriptions = []
        for edge in edges:
            caller = nodes_map.get(edge.source_id)
            callee = nodes_map.get(edge.target_id)
            if not caller or not callee:
                continue

            desc = f"""
[CALL {edge.edge_id}]
From: {caller.name} ({caller.summary or 'no summary'})
To: {callee.name} ({callee.summary or 'no summary'})
Context: {edge.context}
"""
            call_descriptions.append(desc)

        prompt = f"""
PURPOSE: Analyze multiple function call relationships and describe their intents
TASK: For each call, provide a 1-sentence semantic description

{chr(10).join(call_descriptions)}

OUTPUT FORMAT (JSON):
{{
    "edge_id_1": "intent description",
    "edge_id_2": "intent description",
    ...
}}
"""

        response = self.llm_enhancer._invoke_ccw_cli(prompt, tool='gemini')
        if response['success']:
            import json
            intents = json.loads(self.llm_enhancer._extract_json(response['stdout']))
            return intents

        return {}
```

#### 3.3.2 数据模型识别

```python
class DataModelRecognizer:
    """识别代码中的数据模型（实体类）"""

    def identify_data_models(
        self,
        class_nodes: List[CodeNode]
    ) -> List[CodeNode]:
        """识别哪些类是数据模型"""

        data_models = []

        for class_node in class_nodes:
            # 启发式规则
            is_model = False

            # 规则1: 类名包含Model/Entity/Schema
            if any(keyword in class_node.name for keyword in ['Model', 'Entity', 'Schema']):
                is_model = True

            # 规则2: 继承自ORM基类（需要分析继承关系）
            # TODO: 检查是否继承 db.Model, BaseModel等

            # 规则3: 让LLM判断
            if not is_model:
                is_model = self._ask_llm_if_data_model(class_node)

            if is_model:
                class_node.tags = class_node.tags or []
                class_node.tags.append('data_model')
                data_models.append(class_node)

        return data_models

    def _ask_llm_if_data_model(self, class_node: CodeNode) -> bool:
        """让LLM判断是否为数据模型"""

        prompt = f"""
Is this Python class a data model (entity class representing database table or data structure)?

Class Definition:
```python
{class_node.docstring or ''}
class {class_node.name}:
    # ... (signature: {class_node.signature})
```

Answer with: YES or NO
"""

        # 调用LLM...
        # 简化实现
        return False
```

### 3.4 图查询与推理

#### 3.4.1 影响分析（Impact Analysis）

```python
class ImpactAnalyzer:
    """代码变更影响分析"""

    def __init__(self, graph_store: CodeGraphStore):
        self.graph_store = graph_store

    def analyze_function_impact(
        self,
        function_id: str,
        max_depth: int = 10
    ) -> Dict[str, any]:
        """分析修改某个函数的影响范围"""

        # 找到所有直接和间接调用者
        affected_functions = set()
        self._traverse_callers(function_id, affected_functions, 0, max_depth)

        # 找到所有受影响的文件
        affected_files = set()
        for func_id in affected_functions:
            node = self.graph_store.get_node(func_id)
            if node:
                affected_files.add(node.file_path)

        return {
            'modified_function': function_id,
            'affected_functions': list(affected_functions),
            'affected_files': list(affected_files),
            'impact_scope': len(affected_functions),
        }

    def _traverse_callers(
        self,
        node_id: str,
        result: Set[str],
        current_depth: int,
        max_depth: int
    ):
        """递归遍历调用者"""

        if current_depth >= max_depth or node_id in result:
            return

        callers = self.graph_store.get_callers(node_id)
        for caller in callers:
            result.add(caller.node_id)
            self._traverse_callers(caller.node_id, result, current_depth + 1, max_depth)
```

#### 3.4.2 数据流追踪

```python
class DataFlowTracer:
    """数据流路径追踪"""

    def __init__(self, graph_store: CodeGraphStore):
        self.graph_store = graph_store

    def trace_variable_flow(
        self,
        variable_name: str,
        start_function_id: str
    ) -> List[Dict]:
        """追踪变量的数据流"""

        # 查找所有使用该变量的边
        cursor = self.graph_store.conn.cursor()
        cursor.execute("""
            SELECT * FROM code_edges
            WHERE edge_type IN ('uses_variable', 'defines_variable', 'passes_data')
            AND (source_id = ? OR target_id LIKE ?)
        """, (start_function_id, f"%{variable_name}%"))

        flow_path = []
        for row in cursor.fetchall():
            edge = self._row_to_edge(row)
            source = self.graph_store.get_node(edge.source_id)
            target = self.graph_store.get_node(edge.target_id)

            flow_path.append({
                'from': source.name if source else 'unknown',
                'to': target.name if target else 'unknown',
                'action': edge.edge_type.value,
                'context': edge.context,
            })

        return flow_path

    def find_crud_operations(
        self,
        entity_name: str
    ) -> Dict[str, List[CodeNode]]:
        """找到对某个实体的所有CRUD操作"""

        cursor = self.graph_store.conn.cursor()

        # 查找所有修改该实体的函数
        cursor.execute("""
            SELECT DISTINCT n.* FROM code_nodes n
            JOIN code_edges e ON n.node_id = e.source_id
            WHERE e.edge_type = 'modifies'
            AND e.target_id LIKE ?
        """, (f"%{entity_name}%",))

        writers = [self._row_to_node(row) for row in cursor.fetchall()]

        # 查找所有读取该实体的函数
        cursor.execute("""
            SELECT DISTINCT n.* FROM code_nodes n
            JOIN code_edges e ON n.node_id = e.source_id
            WHERE e.edge_type = 'reads'
            AND e.target_id LIKE ?
        """, (f"%{entity_name}%",))

        readers = [self._row_to_node(row) for row in cursor.fetchall()]

        return {
            'create': [w for w in writers if 'create' in w.name.lower()],
            'read': readers,
            'update': [w for w in writers if 'update' in w.name.lower()],
            'delete': [w for w in writers if 'delete' in w.name.lower()],
        }
```

### 3.5 与语义搜索集成

#### 3.5.1 增强的搜索结果

```python
class GraphEnhancedSearchEngine:
    """结合图谱的增强搜索"""

    def __init__(
        self,
        vector_search: VectorStore,
        graph_store: CodeGraphStore
    ):
        self.vector_search = vector_search
        self.graph_store = graph_store

    def search_with_graph_context(
        self,
        query: str,
        top_k: int = 10
    ) -> List[EnhancedSearchResult]:
        """带图谱上下文的搜索"""

        # 1. 向量搜索
        vector_results = self.vector_search.search(query, top_k=top_k)

        # 2. 为每个结果添加图谱信息
        enhanced_results = []
        for result in vector_results:
            # 找到对应的图节点
            node = self.graph_store.get_node(result.path)
            if not node:
                continue

            # 获取调用关系
            callers = self.graph_store.get_callers(node.node_id)
            callees = self.graph_store.get_callees(node.node_id)

            enhanced = EnhancedSearchResult(
                **result.dict(),
                callers=[c.name for c in callers[:5]],
                callees=[c.name for c in callees[:5]],
                call_count_in=len(callers),
                call_count_out=len(callees),
            )
            enhanced_results.append(enhanced)

        return enhanced_results

    def search_by_relationship(
        self,
        query: str,
        relationship_type: str  # "calls", "called_by", "uses", etc.
    ) -> List[CodeNode]:
        """基于关系的搜索"""

        # 先找到查询匹配的节点
        vector_results = self.vector_search.search(query, top_k=5)
        if not vector_results:
            return []

        target_node_id = vector_results[0].path

        # 根据关系类型查找相关节点
        if relationship_type == "calls":
            return self.graph_store.get_callees(target_node_id)
        elif relationship_type == "called_by":
            return self.graph_store.get_callers(target_node_id)
        # 其他关系类型...

        return []
```

## 4. 实施路线图

### Phase 1: 基础静态分析（3-4周）
- [ ] 实现ASTAnalyzer（符号提取）
- [ ] 实现CallGraphExtractor（调用图提取）
- [ ] 实现NameResolver（名称解析）
- [ ] 设计图数据库schema
- [ ] 实现CodeGraphStore（基础CRUD）
- [ ] 单元测试

### Phase 2: 多语言支持（2周）
- [ ] Python完整支持
- [ ] JavaScript/TypeScript支持
- [ ] Java支持（可选）
- [ ] 跨语言测试

### Phase 3: LLM语义增强（2-3周）
- [ ] 实现RelationshipSemanticAnalyzer
- [ ] 实现DataModelRecognizer
- [ ] 批量处理优化
- [ ] 集成测试

### Phase 4: 高级查询（2周）
- [ ] 实现ImpactAnalyzer
- [ ] 实现DataFlowTracer
- [ ] 实现GraphEnhancedSearchEngine
- [ ] 性能优化

### Phase 5: 可视化与工具（2周）
- [ ] 调用图可视化（Graphviz/D3.js）
- [ ] CLI命令集成
- [ ] Web UI（可选）

### Phase 6: 生产化（1-2周）
- [ ] 增量更新机制
- [ ] 大规模项目优化
- [ ] 文档和示例
- [ ] 发布

**总计预估时间**：12-15周

## 5. 技术挑战与解决方案

### 5.1 挑战：跨文件名称解析

**问题**：函数调用的目标可能在不同文件/模块中，需要解析import语句。

**解决方案**：
```python
class ImportResolver:
    """导入语句解析器"""

    def extract_imports(self, tree, content: str) -> Dict[str, str]:
        """
        提取所有import语句，构建别名映射

        返回: {别名 -> 实际模块路径}
        """
        imports = {}

        for node in tree.root_node.children:
            if node.type == 'import_statement':
                # from module import func
                # import module as alias
                pass  # 解析逻辑

        return imports

    def resolve_imported_symbol(
        self,
        symbol_name: str,
        imports: Dict[str, str],
        project_root: Path
    ) -> Optional[str]:
        """解析导入符号的实际位置"""

        if symbol_name in imports:
            module_path = imports[symbol_name]
            # 查找该模块的文件路径
            # 在图谱中查找对应的节点
            pass

        return None
```

### 5.2 挑战：动态调用识别

**问题**：反射、getattr、动态导入等运行时行为无法通过静态分析完全捕获。

**解决方案**：
- 使用LLM推断可能的调用目标
- 标记为"动态调用"，降低置信度
- 结合运行时日志补充

```python
def handle_dynamic_call(edge: CodeEdge) -> CodeEdge:
    """处理动态调用"""

    if 'getattr' in edge.context or 'eval' in edge.context:
        edge.confidence = 0.5
        edge.semantic_intent = "dynamic call (runtime resolution required)"

    return edge
```

### 5.3 挑战：大型代码库性能

**问题**：对百万行级别的代码库构建图谱可能耗时很长。

**解决方案**：
- **并行处理**：多进程分析不同文件
- **增量更新**：只重新分析变更的文件
- **延迟LLM**：初次构建只做静态分析，LLM增强按需触发

```python
from multiprocessing import Pool

class ParallelGraphBuilder:
    """并行图谱构建"""

    def build_graph_parallel(
        self,
        file_paths: List[Path],
        workers: int = 8
    ):
        """并行分析多个文件"""

        with Pool(workers) as pool:
            results = pool.map(self._analyze_single_file, file_paths)

        # 合并结果到图谱
        for nodes, edges in results:
            for node in nodes:
                self.graph_store.add_node(node)
            for edge in edges:
                self.graph_store.add_edge(edge)
```

## 6. 成功指标

1. **覆盖率**：90%以上的函数调用关系被正确识别
2. **准确率**：名称解析准确率>85%
3. **性能**：10万行代码的项目，图谱构建<5分钟
4. **查询速度**：影响分析查询<100ms
5. **LLM增强价值**：关系语义描述的有用性评分>4/5

## 7. 应用场景示例

### 场景1：代码审查助手
```python
# 审查一个PR，分析影响范围
analyzer = ImpactAnalyzer(graph_store)
impact = analyzer.analyze_function_impact('auth.py:45:validate_token')

print(f"修改此函数将影响 {impact['impact_scope']} 个其他函数")
print(f"涉及文件: {', '.join(impact['affected_files'])}")
```

### 场景2：重构规划
```python
# 计划重构User类，查看所有相关操作
tracer = DataFlowTracer(graph_store)
crud = tracer.find_crud_operations('User')

print(f"创建User的方法: {[f.name for f in crud['create']]}")
print(f"读取User的方法: {[f.name for f in crud['read']]}")
```

### 场景3：知识图谱问答
```python
# "修改登录逻辑会影响哪些API端点？"
search_engine = GraphEnhancedSearchEngine(vector_store, graph_store)

# 先找到登录函数
login_func = search_engine.search("user login authentication")[0]

# 追踪调用链
analyzer = ImpactAnalyzer(graph_store)
impact = analyzer.analyze_function_impact(login_func.node_id)

# 筛选出API端点
api_endpoints = [
    f for f in impact['affected_functions']
    if '@app.route' in graph_store.get_node(f).modifiers
]
```

## 8. 参考资料

- [LLVM Call Graph](https://llvm.org/docs/CallGraph.html)
- [Sourcegraph - Code Intelligence](https://about.sourcegraph.com/)
- [CodeQL - Semantic Code Analysis](https://codeql.github.com/)
- [Neo4j Graph Database](https://neo4j.com/)
- Tree-sitter AST Queries
