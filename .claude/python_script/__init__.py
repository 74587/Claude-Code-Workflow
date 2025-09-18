"""
Refactored Python Script Analyzer
Modular, reusable architecture for intelligent file analysis and workflow automation.
"""

__version__ = "2.0.0"
__author__ = "Claude Development Team"
__email__ = "dev@example.com"

from .analyzer import Analyzer
from .indexer import ProjectIndexer
from .cli import AnalysisCLI
from .core import (
    Config, FileIndexer, FileInfo, IndexStats,
    ContextAnalyzer, AnalysisResult,
    PathMatcher, MatchResult, PathMatchingResult,
    EmbeddingManager, GitignoreParser
)
from .tools import ModuleAnalyzer, ModuleInfo, TechStackLoader
from .utils import Colors, CacheManager, IOHelpers

__all__ = [
    'Analyzer', 'ProjectIndexer', 'AnalysisCLI',
    # Core modules
    'Config',
    'FileIndexer', 'FileInfo', 'IndexStats',
    'ContextAnalyzer', 'AnalysisResult',
    'PathMatcher', 'MatchResult', 'PathMatchingResult',
    'EmbeddingManager', 'GitignoreParser',
    # Tools
    'ModuleAnalyzer', 'ModuleInfo',
    'TechStackLoader',
    # Utils
    'Colors', 'CacheManager', 'IOHelpers'
]