"""
Core modules for the Python script analyzer.
Provides unified interfaces for file indexing, context analysis, and path matching.
"""

from .config import Config
from .file_indexer import FileIndexer, FileInfo, IndexStats
from .context_analyzer import ContextAnalyzer, AnalysisResult
from .path_matcher import PathMatcher, MatchResult, PathMatchingResult
from .embedding_manager import EmbeddingManager
from .gitignore_parser import GitignoreParser

__all__ = [
    'Config',
    'FileIndexer',
    'FileInfo',
    'IndexStats',
    'ContextAnalyzer',
    'AnalysisResult',
    'PathMatcher',
    'MatchResult',
    'PathMatchingResult',
    'EmbeddingManager',
    'GitignoreParser'
]