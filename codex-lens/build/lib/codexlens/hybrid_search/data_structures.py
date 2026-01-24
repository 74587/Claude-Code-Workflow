"""Core data structures for the hybrid search system.

This module defines the fundamental data structures used throughout the
hybrid search pipeline, including code symbol representations, association
graphs, and clustered search results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    import networkx as nx


@dataclass
class Range:
    """Position range within a source file.

    Attributes:
        start_line: Starting line number (0-based).
        start_character: Starting character offset within the line.
        end_line: Ending line number (0-based).
        end_character: Ending character offset within the line.
    """

    start_line: int
    start_character: int
    end_line: int
    end_character: int

    def __post_init__(self) -> None:
        """Validate range values."""
        if self.start_line < 0:
            raise ValueError("start_line must be >= 0")
        if self.start_character < 0:
            raise ValueError("start_character must be >= 0")
        if self.end_line < 0:
            raise ValueError("end_line must be >= 0")
        if self.end_character < 0:
            raise ValueError("end_character must be >= 0")
        if self.end_line < self.start_line:
            raise ValueError("end_line must be >= start_line")
        if self.end_line == self.start_line and self.end_character < self.start_character:
            raise ValueError("end_character must be >= start_character on the same line")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "start": {"line": self.start_line, "character": self.start_character},
            "end": {"line": self.end_line, "character": self.end_character},
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Range:
        """Create Range from dictionary representation."""
        return cls(
            start_line=data["start"]["line"],
            start_character=data["start"]["character"],
            end_line=data["end"]["line"],
            end_character=data["end"]["character"],
        )

    @classmethod
    def from_lsp_range(cls, lsp_range: Dict[str, Any]) -> Range:
        """Create Range from LSP Range object.

        LSP Range format:
            {"start": {"line": int, "character": int},
             "end": {"line": int, "character": int}}
        """
        return cls(
            start_line=lsp_range["start"]["line"],
            start_character=lsp_range["start"]["character"],
            end_line=lsp_range["end"]["line"],
            end_character=lsp_range["end"]["character"],
        )


@dataclass
class CallHierarchyItem:
    """LSP CallHierarchyItem for representing callers/callees.

    Attributes:
        name: Symbol name (function, method, class name).
        kind: Symbol kind (function, method, class, etc.).
        file_path: Absolute file path where the symbol is defined.
        range: Position range in the source file.
        detail: Optional additional detail about the symbol.
    """

    name: str
    kind: str
    file_path: str
    range: Range
    detail: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: Dict[str, Any] = {
            "name": self.name,
            "kind": self.kind,
            "file_path": self.file_path,
            "range": self.range.to_dict(),
        }
        if self.detail:
            result["detail"] = self.detail
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CallHierarchyItem":
        """Create CallHierarchyItem from dictionary representation."""
        return cls(
            name=data["name"],
            kind=data["kind"],
            file_path=data["file_path"],
            range=Range.from_dict(data["range"]),
            detail=data.get("detail"),
        )


@dataclass
class CodeSymbolNode:
    """Graph node representing a code symbol.

    Attributes:
        id: Unique identifier in format 'file_path:name:line'.
        name: Symbol name (function, class, variable name).
        kind: Symbol kind (function, class, method, variable, etc.).
        file_path: Absolute file path where symbol is defined.
        range: Start/end position in the source file.
        embedding: Optional vector embedding for semantic search.
        raw_code: Raw source code of the symbol.
        docstring: Documentation string (if available).
        score: Ranking score (used during reranking).
    """

    id: str
    name: str
    kind: str
    file_path: str
    range: Range
    embedding: Optional[List[float]] = None
    raw_code: str = ""
    docstring: str = ""
    score: float = 0.0

    def __post_init__(self) -> None:
        """Validate required fields."""
        if not self.id:
            raise ValueError("id cannot be empty")
        if not self.name:
            raise ValueError("name cannot be empty")
        if not self.kind:
            raise ValueError("kind cannot be empty")
        if not self.file_path:
            raise ValueError("file_path cannot be empty")

    def __hash__(self) -> int:
        """Hash based on unique ID."""
        return hash(self.id)

    def __eq__(self, other: object) -> bool:
        """Equality based on unique ID."""
        if not isinstance(other, CodeSymbolNode):
            return False
        return self.id == other.id

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: Dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "file_path": self.file_path,
            "range": self.range.to_dict(),
            "score": self.score,
        }
        if self.raw_code:
            result["raw_code"] = self.raw_code
        if self.docstring:
            result["docstring"] = self.docstring
        # Exclude embedding from serialization (too large for JSON responses)
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CodeSymbolNode:
        """Create CodeSymbolNode from dictionary representation."""
        return cls(
            id=data["id"],
            name=data["name"],
            kind=data["kind"],
            file_path=data["file_path"],
            range=Range.from_dict(data["range"]),
            embedding=data.get("embedding"),
            raw_code=data.get("raw_code", ""),
            docstring=data.get("docstring", ""),
            score=data.get("score", 0.0),
        )

    @classmethod
    def from_lsp_location(
        cls,
        uri: str,
        name: str,
        kind: str,
        lsp_range: Dict[str, Any],
        raw_code: str = "",
        docstring: str = "",
    ) -> CodeSymbolNode:
        """Create CodeSymbolNode from LSP location data.

        Args:
            uri: File URI (file:// prefix will be stripped).
            name: Symbol name.
            kind: Symbol kind.
            lsp_range: LSP Range object.
            raw_code: Optional raw source code.
            docstring: Optional documentation string.

        Returns:
            New CodeSymbolNode instance.
        """
        # Strip file:// prefix if present
        file_path = uri
        if file_path.startswith("file://"):
            file_path = file_path[7:]
            # Handle Windows paths (file:///C:/...)
            if len(file_path) > 2 and file_path[0] == "/" and file_path[2] == ":":
                file_path = file_path[1:]

        range_obj = Range.from_lsp_range(lsp_range)
        symbol_id = f"{file_path}:{name}:{range_obj.start_line}"

        return cls(
            id=symbol_id,
            name=name,
            kind=kind,
            file_path=file_path,
            range=range_obj,
            raw_code=raw_code,
            docstring=docstring,
        )

    @classmethod
    def create_id(cls, file_path: str, name: str, line: int) -> str:
        """Generate a unique symbol ID.

        Args:
            file_path: Absolute file path.
            name: Symbol name.
            line: Start line number.

        Returns:
            Unique ID string in format 'file_path:name:line'.
        """
        return f"{file_path}:{name}:{line}"


@dataclass
class CodeAssociationGraph:
    """Graph of code relationships between symbols.

    This graph represents the association between code symbols discovered
    through LSP queries (references, call hierarchy, etc.).

    Attributes:
        nodes: Dictionary mapping symbol IDs to CodeSymbolNode objects.
        edges: List of (from_id, to_id, relationship_type) tuples.
            relationship_type: 'calls', 'references', 'inherits', 'imports'.
    """

    nodes: Dict[str, CodeSymbolNode] = field(default_factory=dict)
    edges: List[Tuple[str, str, str]] = field(default_factory=list)

    def add_node(self, node: CodeSymbolNode) -> None:
        """Add a node to the graph.

        Args:
            node: CodeSymbolNode to add. If a node with the same ID exists,
                it will be replaced.
        """
        self.nodes[node.id] = node

    def add_edge(self, from_id: str, to_id: str, rel_type: str) -> None:
        """Add an edge to the graph.

        Args:
            from_id: Source node ID.
            to_id: Target node ID.
            rel_type: Relationship type ('calls', 'references', 'inherits', 'imports').

        Raises:
            ValueError: If from_id or to_id not in graph nodes.
        """
        if from_id not in self.nodes:
            raise ValueError(f"Source node '{from_id}' not found in graph")
        if to_id not in self.nodes:
            raise ValueError(f"Target node '{to_id}' not found in graph")

        edge = (from_id, to_id, rel_type)
        if edge not in self.edges:
            self.edges.append(edge)

    def add_edge_unchecked(self, from_id: str, to_id: str, rel_type: str) -> None:
        """Add an edge without validating node existence.

        Use this method during bulk graph construction where nodes may be
        added after edges, or when performance is critical.

        Args:
            from_id: Source node ID.
            to_id: Target node ID.
            rel_type: Relationship type.
        """
        edge = (from_id, to_id, rel_type)
        if edge not in self.edges:
            self.edges.append(edge)

    def get_node(self, node_id: str) -> Optional[CodeSymbolNode]:
        """Get a node by ID.

        Args:
            node_id: Node ID to look up.

        Returns:
            CodeSymbolNode if found, None otherwise.
        """
        return self.nodes.get(node_id)

    def get_neighbors(self, node_id: str, rel_type: Optional[str] = None) -> List[CodeSymbolNode]:
        """Get neighboring nodes connected by outgoing edges.

        Args:
            node_id: Node ID to find neighbors for.
            rel_type: Optional filter by relationship type.

        Returns:
            List of neighboring CodeSymbolNode objects.
        """
        neighbors = []
        for from_id, to_id, edge_rel in self.edges:
            if from_id == node_id:
                if rel_type is None or edge_rel == rel_type:
                    node = self.nodes.get(to_id)
                    if node:
                        neighbors.append(node)
        return neighbors

    def get_incoming(self, node_id: str, rel_type: Optional[str] = None) -> List[CodeSymbolNode]:
        """Get nodes connected by incoming edges.

        Args:
            node_id: Node ID to find incoming connections for.
            rel_type: Optional filter by relationship type.

        Returns:
            List of CodeSymbolNode objects with edges pointing to node_id.
        """
        incoming = []
        for from_id, to_id, edge_rel in self.edges:
            if to_id == node_id:
                if rel_type is None or edge_rel == rel_type:
                    node = self.nodes.get(from_id)
                    if node:
                        incoming.append(node)
        return incoming

    def to_networkx(self) -> "nx.DiGraph":
        """Convert to NetworkX DiGraph for graph algorithms.

        Returns:
            NetworkX directed graph with nodes and edges.

        Raises:
            ImportError: If networkx is not installed.
        """
        try:
            import networkx as nx
        except ImportError:
            raise ImportError(
                "networkx is required for graph algorithms. "
                "Install with: pip install networkx"
            )

        graph = nx.DiGraph()

        # Add nodes with attributes
        for node_id, node in self.nodes.items():
            graph.add_node(
                node_id,
                name=node.name,
                kind=node.kind,
                file_path=node.file_path,
                score=node.score,
            )

        # Add edges with relationship type
        for from_id, to_id, rel_type in self.edges:
            graph.add_edge(from_id, to_id, relationship=rel_type)

        return graph

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dictionary with 'nodes' and 'edges' keys.
        """
        return {
            "nodes": {node_id: node.to_dict() for node_id, node in self.nodes.items()},
            "edges": [
                {"from": from_id, "to": to_id, "relationship": rel_type}
                for from_id, to_id, rel_type in self.edges
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CodeAssociationGraph:
        """Create CodeAssociationGraph from dictionary representation.

        Args:
            data: Dictionary with 'nodes' and 'edges' keys.

        Returns:
            New CodeAssociationGraph instance.
        """
        graph = cls()

        # Load nodes
        for node_id, node_data in data.get("nodes", {}).items():
            graph.nodes[node_id] = CodeSymbolNode.from_dict(node_data)

        # Load edges
        for edge_data in data.get("edges", []):
            graph.edges.append((
                edge_data["from"],
                edge_data["to"],
                edge_data["relationship"],
            ))

        return graph

    def __len__(self) -> int:
        """Return the number of nodes in the graph."""
        return len(self.nodes)


@dataclass
class SearchResultCluster:
    """Clustered search result containing related code symbols.

    Search results are grouped into clusters based on graph community
    detection or embedding similarity. Each cluster represents a
    conceptually related group of code symbols.

    Attributes:
        cluster_id: Unique cluster identifier.
        score: Cluster relevance score (max of symbol scores).
        title: Human-readable cluster title/summary.
        symbols: List of CodeSymbolNode in this cluster.
        metadata: Additional cluster metadata.
    """

    cluster_id: str
    score: float
    title: str
    symbols: List[CodeSymbolNode] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validate cluster fields."""
        if not self.cluster_id:
            raise ValueError("cluster_id cannot be empty")
        if self.score < 0:
            raise ValueError("score must be >= 0")

    def add_symbol(self, symbol: CodeSymbolNode) -> None:
        """Add a symbol to the cluster.

        Args:
            symbol: CodeSymbolNode to add.
        """
        self.symbols.append(symbol)

    def get_top_symbols(self, n: int = 5) -> List[CodeSymbolNode]:
        """Get top N symbols by score.

        Args:
            n: Number of symbols to return.

        Returns:
            List of top N CodeSymbolNode objects sorted by score descending.
        """
        sorted_symbols = sorted(self.symbols, key=lambda s: s.score, reverse=True)
        return sorted_symbols[:n]

    def update_score(self) -> None:
        """Update cluster score to max of symbol scores."""
        if self.symbols:
            self.score = max(s.score for s in self.symbols)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dictionary representation of the cluster.
        """
        return {
            "cluster_id": self.cluster_id,
            "score": self.score,
            "title": self.title,
            "symbols": [s.to_dict() for s in self.symbols],
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SearchResultCluster:
        """Create SearchResultCluster from dictionary representation.

        Args:
            data: Dictionary with cluster data.

        Returns:
            New SearchResultCluster instance.
        """
        return cls(
            cluster_id=data["cluster_id"],
            score=data["score"],
            title=data["title"],
            symbols=[CodeSymbolNode.from_dict(s) for s in data.get("symbols", [])],
            metadata=data.get("metadata", {}),
        )

    def __len__(self) -> int:
        """Return the number of symbols in the cluster."""
        return len(self.symbols)


@dataclass
class CallHierarchyItem:
    """LSP CallHierarchyItem for representing callers/callees.

    Attributes:
        name: Symbol name (function, method, etc.).
        kind: Symbol kind (function, method, etc.).
        file_path: Absolute file path.
        range: Position range in the file.
        detail: Optional additional detail (e.g., signature).
    """

    name: str
    kind: str
    file_path: str
    range: Range
    detail: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: Dict[str, Any] = {
            "name": self.name,
            "kind": self.kind,
            "file_path": self.file_path,
            "range": self.range.to_dict(),
        }
        if self.detail:
            result["detail"] = self.detail
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CallHierarchyItem":
        """Create CallHierarchyItem from dictionary representation."""
        return cls(
            name=data.get("name", "unknown"),
            kind=data.get("kind", "unknown"),
            file_path=data.get("file_path", data.get("uri", "")),
            range=Range.from_dict(data.get("range", {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}})),
            detail=data.get("detail"),
        )

    @classmethod
    def from_lsp(cls, data: Dict[str, Any]) -> "CallHierarchyItem":
        """Create CallHierarchyItem from LSP response format.

        LSP uses 0-based line numbers and 'character' instead of 'char'.
        """
        uri = data.get("uri", data.get("file_path", ""))
        # Strip file:// prefix
        file_path = uri
        if file_path.startswith("file://"):
            file_path = file_path[7:]
            if len(file_path) > 2 and file_path[0] == "/" and file_path[2] == ":":
                file_path = file_path[1:]

        return cls(
            name=data.get("name", "unknown"),
            kind=str(data.get("kind", "unknown")),
            file_path=file_path,
            range=Range.from_lsp_range(data.get("range", {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}})),
            detail=data.get("detail"),
        )
