"""Unit tests for staged cascade Stage 2 realtime LSP graph expansion.

These tests mock out the live LSP components (LspBridge + LspGraphBuilder)
so they can run without external language servers installed.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.hybrid_search.data_structures import CodeAssociationGraph, CodeSymbolNode, Range
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


class _DummyBridge:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def get_document_symbols(self, file_path: str):
        _ = file_path
        return []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


def test_stage2_realtime_mode_expands_and_combines(tmp_path: Path) -> None:
    registry = RegistryStore(db_path=tmp_path / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=tmp_path / "indexes")

    config = Config(
        data_dir=tmp_path / "data",
        staged_stage2_mode="realtime",
        staged_lsp_depth=1,
        staged_realtime_lsp_timeout_s=1.0,
        staged_realtime_lsp_max_nodes=10,
        staged_realtime_lsp_warmup_s=0.0,
    )

    engine = ChainSearchEngine(registry, mapper, config=config)
    try:
        coarse = [
            SearchResult(
                path=str(tmp_path / "a.py"),
                score=1.0,
                excerpt="def a(): pass",
                content="def a():\n    pass\n",
                symbol_name="a",
                symbol_kind="function",
                start_line=1,
                end_line=2,
            )
        ]

        graph = CodeAssociationGraph()
        seed_id = f"{coarse[0].path}:a:1"
        graph.nodes[seed_id] = CodeSymbolNode(
            id=seed_id,
            name="a",
            kind="function",
            file_path=coarse[0].path,
            range=Range(start_line=1, start_character=1, end_line=2, end_character=1),
        )
        related_id = f"{str(tmp_path / 'b.py')}:b:1"
        graph.nodes[related_id] = CodeSymbolNode(
            id=related_id,
            name="b",
            kind="function",
            file_path=str(tmp_path / "b.py"),
            range=Range(start_line=1, start_character=1, end_line=1, end_character=1),
            raw_code="def b():\n    return 1\n",
        )

        dummy_builder = MagicMock()
        dummy_builder.build_from_seeds = AsyncMock(return_value=graph)

        with patch("codexlens.lsp.LspBridge", _DummyBridge):
            with patch("codexlens.lsp.LspGraphBuilder", return_value=dummy_builder) as mock_builder:
                # Avoid needing a real index_to_source mapping
                engine.mapper.index_to_source = MagicMock(return_value=tmp_path)
                expanded = engine._stage2_lsp_expand(coarse, index_root=tmp_path / "fake_index_root")

        assert mock_builder.call_args is not None
        assert mock_builder.call_args.kwargs.get("resolve_symbols") is False
        names = {r.symbol_name for r in expanded if r.symbol_name}
        assert "a" in names
        assert "b" in names
    finally:
        engine.close()
