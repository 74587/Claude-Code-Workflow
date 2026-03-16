"""Ranking algorithms for hybrid search result fusion.

Implements Reciprocal Rank Fusion (RRF) and score normalization utilities
for combining results from heterogeneous search backends (exact FTS, fuzzy FTS, vector search).
"""

from __future__ import annotations

import logging
import re
import math
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from codexlens.entities import SearchResult, AdditionalLocation

logger = logging.getLogger(__name__)


# Default RRF weights for hybrid search
DEFAULT_WEIGHTS = {
    "exact": 0.25,
    "fuzzy": 0.1,
    "vector": 0.5,
    "lsp_graph": 0.15,
}


class QueryIntent(str, Enum):
    """Query intent for adaptive RRF weights (Python/TypeScript parity)."""

    KEYWORD = "keyword"
    SEMANTIC = "semantic"
    MIXED = "mixed"


_TEST_QUERY_RE = re.compile(
    r"\b(test|tests|spec|specs|fixture|fixtures|benchmark|benchmarks)\b",
    flags=re.IGNORECASE,
)
_AUXILIARY_QUERY_RE = re.compile(
    r"\b(example|examples|demo|demos|sample|samples|debug|benchmark|benchmarks|profile|profiling)\b",
    flags=re.IGNORECASE,
)
_ARTIFACT_QUERY_RE = re.compile(
    r"(?<!\w)(dist|build|out|coverage|htmlcov|generated|bundle|compiled|artifact|artifacts|\.workflow)(?!\w)",
    flags=re.IGNORECASE,
)
_ENV_STYLE_QUERY_RE = re.compile(r"\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b")
_AUXILIARY_DIR_NAMES = frozenset(
    {
        "example",
        "examples",
        "demo",
        "demos",
        "sample",
        "samples",
        "benchmark",
        "benchmarks",
        "profile",
        "profiles",
    }
)
_GENERATED_DIR_NAMES = frozenset(
    {
        "dist",
        "build",
        "out",
        "coverage",
        "htmlcov",
        ".cache",
        ".workflow",
        ".next",
        ".nuxt",
        ".parcel-cache",
        ".turbo",
        "tmp",
        "temp",
        "generated",
    }
)
_GENERATED_FILE_SUFFIXES = (
    ".generated.ts",
    ".generated.tsx",
    ".generated.js",
    ".generated.jsx",
    ".generated.py",
    ".gen.ts",
    ".gen.tsx",
    ".gen.js",
    ".gen.jsx",
    ".min.js",
    ".min.css",
    ".bundle.js",
    ".bundle.css",
)
_SOURCE_DIR_NAMES = frozenset(
    {
        "src",
        "lib",
        "core",
        "app",
        "server",
        "client",
        "services",
    }
)
_IDENTIFIER_QUERY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_TOPIC_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9]*")
_EXPLICIT_PATH_HINT_MARKER_RE = re.compile(r"[_\-/\\.]")
_SEMANTIC_QUERY_STOPWORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "can",
        "to",
        "of",
        "in",
        "for",
        "on",
        "with",
        "at",
        "by",
        "from",
        "as",
        "into",
        "through",
        "and",
        "but",
        "if",
        "or",
        "not",
        "this",
        "that",
        "these",
        "those",
        "it",
        "its",
        "how",
        "what",
        "where",
        "when",
        "why",
        "which",
        "who",
        "whom",
    }
)
_PATH_TOPIC_STOPWORDS = frozenset(
    {
        *_SOURCE_DIR_NAMES,
        *_AUXILIARY_DIR_NAMES,
        *_GENERATED_DIR_NAMES,
        "tool",
        "tools",
        "util",
        "utils",
        "test",
        "tests",
        "spec",
        "specs",
        "fixture",
        "fixtures",
        "index",
        "main",
        "ts",
        "tsx",
        "js",
        "jsx",
        "mjs",
        "cjs",
        "py",
        "java",
        "go",
        "rs",
        "rb",
        "php",
        "cs",
        "cpp",
        "cc",
        "c",
        "h",
    }
)
_LEXICAL_PRIORITY_SURFACE_TOKENS = frozenset(
    {
        "config",
        "configs",
        "configuration",
        "configurations",
        "setting",
        "settings",
        "backend",
        "backends",
        "environment",
        "env",
        "variable",
        "variables",
        "factory",
        "factories",
        "override",
        "overrides",
        "option",
        "options",
        "flag",
        "flags",
        "mode",
        "modes",
    }
)
_LEXICAL_PRIORITY_FOCUS_TOKENS = frozenset(
    {
        "embedding",
        "embeddings",
        "reranker",
        "rerankers",
        "onnx",
        "api",
        "litellm",
        "fastembed",
        "local",
        "legacy",
        "stage",
        "stage2",
        "stage3",
        "stage4",
        "precomputed",
        "realtime",
        "static",
        "global",
        "graph",
        "selection",
        "model",
        "models",
    }
)


def normalize_weights(weights: Dict[str, float | None]) -> Dict[str, float | None]:
    """Normalize weights to sum to 1.0 (best-effort)."""
    total = sum(float(v) for v in weights.values() if v is not None)

    # NaN total: do not attempt to normalize (division would propagate NaNs).
    if math.isnan(total):
        return dict(weights)

    # Infinite total: do not attempt to normalize (division yields 0 or NaN).
    if not math.isfinite(total):
        return dict(weights)

    # Zero/negative total: do not attempt to normalize (invalid denominator).
    if total <= 0:
        return dict(weights)

    return {k: (float(v) / total if v is not None else None) for k, v in weights.items()}


def detect_query_intent(query: str) -> QueryIntent:
    """Detect whether a query is code-like, natural-language, or mixed.

    Heuristic signals kept aligned with `ccw/src/tools/smart-search.ts`.
    """
    trimmed = (query or "").strip()
    if not trimmed:
        return QueryIntent.MIXED

    lower = trimmed.lower()
    word_count = len([w for w in re.split(r"\s+", trimmed) if w])

    has_code_signals = bool(
        re.search(r"(::|->|\.)", trimmed)
        or re.search(r"[A-Z][a-z]+[A-Z]", trimmed)
        or re.search(r"\b[a-z]+[A-Z][A-Za-z0-9_]*\b", trimmed)
        or re.search(r"\b\w+_\w+\b", trimmed)
        or re.search(
            r"\b(def|class|function|const|let|var|import|from|return|async|await|interface|type)\b",
            lower,
            flags=re.IGNORECASE,
        )
    )
    has_natural_signals = bool(
        word_count > 5
        or "?" in trimmed
        or re.search(r"\b(how|what|why|when|where)\b", trimmed, flags=re.IGNORECASE)
        or re.search(
            r"\b(handle|explain|fix|implement|create|build|use|find|search|convert|parse|generate|support)\b",
            trimmed,
            flags=re.IGNORECASE,
        )
    )

    if has_code_signals and has_natural_signals:
        return QueryIntent.MIXED
    if has_code_signals:
        return QueryIntent.KEYWORD
    if has_natural_signals:
        return QueryIntent.SEMANTIC
    return QueryIntent.MIXED


def adjust_weights_by_intent(
    intent: QueryIntent,
    base_weights: Dict[str, float],
) -> Dict[str, float]:
    """Adjust RRF weights based on query intent."""
    if intent == QueryIntent.KEYWORD:
        target = {"exact": 0.5, "fuzzy": 0.1, "vector": 0.4}
    elif intent == QueryIntent.SEMANTIC:
        target = {"exact": 0.2, "fuzzy": 0.1, "vector": 0.7}
    else:
        target = dict(base_weights)

    # Filter to active backends
    keys = list(base_weights.keys())
    filtered = {k: float(target.get(k, 0.0)) for k in keys}
    return normalize_weights(filtered)


def get_rrf_weights(
    query: str,
    base_weights: Dict[str, float],
) -> Dict[str, float]:
    """Compute adaptive RRF weights from query intent."""
    return adjust_weights_by_intent(detect_query_intent(query), base_weights)


def query_targets_test_files(query: str) -> bool:
    """Return True when the query explicitly targets tests/spec fixtures."""
    return bool(_TEST_QUERY_RE.search((query or "").strip()))


def query_targets_generated_files(query: str) -> bool:
    """Return True when the query explicitly targets generated/build artifacts."""
    return bool(_ARTIFACT_QUERY_RE.search((query or "").strip()))


def query_targets_auxiliary_files(query: str) -> bool:
    """Return True when the query explicitly targets examples, benchmarks, or debug files."""
    return bool(_AUXILIARY_QUERY_RE.search((query or "").strip()))


def query_prefers_lexical_search(query: str) -> bool:
    """Return True when config/env/factory style queries are safer with lexical-first search."""
    trimmed = (query or "").strip()
    if not trimmed:
        return False

    if _ENV_STYLE_QUERY_RE.search(trimmed):
        return True

    query_tokens = set(_semantic_query_topic_tokens(trimmed))
    if not query_tokens:
        return False

    if query_tokens.intersection({"factory", "factories"}):
        return True

    if query_tokens.intersection({"environment", "env"}) and query_tokens.intersection({"variable", "variables"}):
        return True

    if "backend" in query_tokens and query_tokens.intersection(
        {"embedding", "embeddings", "reranker", "rerankers", "onnx", "api", "litellm", "fastembed", "local", "legacy"}
    ):
        return True

    surface_hits = query_tokens.intersection(_LEXICAL_PRIORITY_SURFACE_TOKENS)
    focus_hits = query_tokens.intersection(_LEXICAL_PRIORITY_FOCUS_TOKENS)
    return bool(surface_hits and focus_hits)


def _normalized_path_parts(path: str) -> List[str]:
    """Normalize a path string into casefolded components for heuristics."""
    normalized = (path or "").replace("\\", "/")
    return [part.casefold() for part in normalized.split("/") if part and part != "."]


# File extensions to category mapping for fast lookup
_EXT_TO_CATEGORY: Dict[str, str] = {
    # Code extensions
    ".py": "code", ".js": "code", ".jsx": "code", ".ts": "code", ".tsx": "code",
    ".java": "code", ".go": "code", ".zig": "code", ".m": "code", ".mm": "code",
    ".c": "code", ".h": "code", ".cc": "code", ".cpp": "code", ".hpp": "code", ".cxx": "code",
    ".rs": "code",
    # Doc extensions
    ".md": "doc", ".mdx": "doc", ".txt": "doc", ".rst": "doc",
}


def get_file_category(path: str) -> Optional[str]:
    """Get file category ('code' or 'doc') from path extension.

    Args:
        path: File path string

    Returns:
        'code', 'doc', or None if unknown
    """
    ext = Path(path).suffix.lower()
    return _EXT_TO_CATEGORY.get(ext)


def filter_results_by_category(
    results: List[SearchResult],
    intent: QueryIntent,
    allow_mixed: bool = True,
) -> List[SearchResult]:
    """Filter results by category based on query intent.

    Strategy:
    - KEYWORD (code intent): Only return code files
    - SEMANTIC (doc intent): Prefer docs, but allow code if allow_mixed=True
    - MIXED: Return all results

    Args:
        results: List of SearchResult objects
        intent: Query intent from detect_query_intent()
        allow_mixed: If True, SEMANTIC intent includes code files with lower priority

    Returns:
        Filtered and re-ranked list of SearchResult objects
    """
    if not results or intent == QueryIntent.MIXED:
        return results

    code_results = []
    doc_results = []
    unknown_results = []

    for r in results:
        category = get_file_category(r.path)
        if category == "code":
            code_results.append(r)
        elif category == "doc":
            doc_results.append(r)
        else:
            unknown_results.append(r)

    if intent == QueryIntent.KEYWORD:
        # Code intent: return only code files + unknown (might be code)
        filtered = code_results + unknown_results
    elif intent == QueryIntent.SEMANTIC:
        if allow_mixed:
            # Semantic intent with mixed: docs first, then code
            filtered = doc_results + code_results + unknown_results
        else:
            # Semantic intent strict: only docs
            filtered = doc_results + unknown_results
    else:
        filtered = results

    return filtered


def is_test_file(path: str) -> bool:
    """Return True when a path clearly refers to a test/spec file."""
    parts = _normalized_path_parts(path)
    if not parts:
        return False
    basename = parts[-1]
    return (
        basename.startswith("test_")
        or basename.endswith("_test.py")
        or basename.endswith(".test.ts")
        or basename.endswith(".test.tsx")
        or basename.endswith(".test.js")
        or basename.endswith(".test.jsx")
        or basename.endswith(".spec.ts")
        or basename.endswith(".spec.tsx")
        or basename.endswith(".spec.js")
        or basename.endswith(".spec.jsx")
        or "tests" in parts[:-1]
        or "test" in parts[:-1]
        or "__fixtures__" in parts[:-1]
        or "fixtures" in parts[:-1]
    )


def is_generated_artifact_path(path: str) -> bool:
    """Return True when a path clearly points at generated/build artifacts."""
    parts = _normalized_path_parts(path)
    if not parts:
        return False
    basename = parts[-1]
    return any(part in _GENERATED_DIR_NAMES for part in parts[:-1]) or basename.endswith(
        _GENERATED_FILE_SUFFIXES
    )


def is_auxiliary_reference_path(path: str) -> bool:
    """Return True for examples, benchmarks, demos, and debug helper files."""
    parts = _normalized_path_parts(path)
    if not parts:
        return False
    basename = parts[-1]
    if any(part in _AUXILIARY_DIR_NAMES for part in parts[:-1]):
        return True
    return (
        basename.startswith("debug_")
        or basename.startswith("benchmark")
        or basename.startswith("profile_")
        or "_benchmark" in basename
        or "_profile" in basename
    )


def _extract_identifier_query(query: str) -> Optional[str]:
    """Return a single-token identifier query when definition boosting is safe."""
    trimmed = (query or "").strip()
    if not trimmed or " " in trimmed:
        return None
    if not _IDENTIFIER_QUERY_RE.fullmatch(trimmed):
        return None
    return trimmed


def extract_explicit_path_hints(query: str) -> List[List[str]]:
    """Extract explicit path/file hints from separator-style query tokens.

    Natural-language queries often contain one or two high-signal feature/file
    hints such as ``smart_search`` or ``smart-search.ts`` alongside broader
    platform words like ``CodexLens``. These hints should be treated as more
    specific than the surrounding prose.
    """
    hints: List[List[str]] = []
    seen: set[tuple[str, ...]] = set()
    for raw_part in re.split(r"\s+", query or ""):
        candidate = raw_part.strip().strip("\"'`()[]{}<>:,;")
        if not candidate or not _EXPLICIT_PATH_HINT_MARKER_RE.search(candidate):
            continue
        tokens = [
            token
            for token in _split_identifier_like_tokens(candidate)
            if token not in _PATH_TOPIC_STOPWORDS
        ]
        if len(tokens) < 2:
            continue
        key = tuple(tokens)
        if key in seen:
            continue
        seen.add(key)
        hints.append(list(key))
    return hints


def _is_source_implementation_path(path: str) -> bool:
    """Return True when a path looks like an implementation file under a source dir."""
    parts = _normalized_path_parts(path)
    if not parts:
        return False
    return any(part in _SOURCE_DIR_NAMES for part in parts[:-1])


def _result_text_candidates(result: SearchResult) -> List[str]:
    """Collect short text snippets that may contain a symbol definition."""
    candidates: List[str] = []
    for text in (result.excerpt, result.content):
        if not isinstance(text, str) or not text.strip():
            continue
        for line in text.splitlines():
            stripped = line.strip()
            if stripped:
                candidates.append(stripped)
            if len(candidates) >= 6:
                break
        if len(candidates) >= 6:
            break

    symbol_name = result.symbol_name
    if not symbol_name and result.symbol is not None:
        symbol_name = getattr(result.symbol, "name", None)
    if isinstance(symbol_name, str) and symbol_name.strip():
        candidates.append(symbol_name.strip())
    return candidates


def _result_defines_identifier(result: SearchResult, symbol: str) -> bool:
    """Best-effort check for whether a result snippet looks like a symbol definition."""
    escaped_symbol = re.escape(symbol)
    definition_patterns = (
        rf"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?def\s+{escaped_symbol}\b",
        rf"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+{escaped_symbol}\b",
        rf"^\s*(?:export\s+)?(?:default\s+)?class\s+{escaped_symbol}\b",
        rf"^\s*(?:export\s+)?(?:default\s+)?interface\s+{escaped_symbol}\b",
        rf"^\s*(?:export\s+)?(?:default\s+)?type\s+{escaped_symbol}\b",
        rf"^\s*(?:export\s+)?(?:default\s+)?(?:const|let|var)\s+{escaped_symbol}\b",
        rf"^\s*{escaped_symbol}\s*=\s*(?:async\s+)?\(",
        rf"^\s*{escaped_symbol}\s*=\s*(?:async\s+)?[^=]*=>",
    )
    for candidate in _result_text_candidates(result):
        if any(re.search(pattern, candidate) for pattern in definition_patterns):
            return True
    return False


def _split_identifier_like_tokens(text: str) -> List[str]:
    """Split identifier-like text into normalized word tokens."""
    if not text:
        return []

    tokens: List[str] = []
    for raw_token in _TOPIC_TOKEN_RE.findall(text):
        expanded = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", raw_token)
        expanded = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", expanded)
        for token in expanded.split():
            normalized = _normalize_topic_token(token)
            if normalized:
                tokens.append(normalized)
    return tokens


def _normalize_topic_token(token: str) -> Optional[str]:
    """Normalize lightweight topic tokens for query/path overlap heuristics."""
    normalized = (token or "").casefold()
    if len(normalized) < 2 or normalized.isdigit():
        return None
    if len(normalized) > 4 and normalized.endswith("ies"):
        normalized = f"{normalized[:-3]}y"
    elif len(normalized) > 3 and normalized.endswith("s") and not normalized.endswith("ss"):
        normalized = normalized[:-1]
    return normalized or None


def _dedupe_preserve_order(tokens: List[str]) -> List[str]:
    """Deduplicate tokens while preserving the first-seen order."""
    deduped: List[str] = []
    seen: set[str] = set()
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        deduped.append(token)
    return deduped


def _semantic_query_topic_tokens(query: str) -> List[str]:
    """Extract salient natural-language tokens for lightweight topic matching."""
    tokens = [
        token
        for token in _split_identifier_like_tokens(query)
        if token not in _SEMANTIC_QUERY_STOPWORDS
    ]
    return _dedupe_preserve_order(tokens)


def _path_topic_tokens(path: str) -> tuple[List[str], List[str]]:
    """Extract normalized topic tokens from a path and its basename."""
    parts = _normalized_path_parts(path)
    if not parts:
        return [], []

    path_tokens: List[str] = []
    basename_tokens: List[str] = []
    last_index = len(parts) - 1
    for index, part in enumerate(parts):
        target = basename_tokens if index == last_index else path_tokens
        for token in _split_identifier_like_tokens(part):
            if token in _PATH_TOPIC_STOPWORDS:
                continue
            target.append(token)
    return _dedupe_preserve_order(path_tokens), _dedupe_preserve_order(basename_tokens)


def _source_path_topic_boost(
    query: str,
    path: str,
    query_intent: QueryIntent,
) -> tuple[float, List[str]]:
    """Return a path/topic boost when a query strongly overlaps a source path."""
    query_tokens = _semantic_query_topic_tokens(query)
    if len(query_tokens) < 2:
        return 1.0, []

    path_tokens, basename_tokens = _path_topic_tokens(path)
    if not path_tokens and not basename_tokens:
        return 1.0, []

    path_token_set = set(path_tokens) | set(basename_tokens)
    basename_overlap = [token for token in query_tokens if token in basename_tokens]
    all_overlap = [token for token in query_tokens if token in path_token_set]
    explicit_hint_tokens = extract_explicit_path_hints(query)

    for hint_tokens in explicit_hint_tokens:
        if basename_tokens == hint_tokens:
            if query_intent == QueryIntent.KEYWORD:
                return 4.5, hint_tokens[:3]
            return 2.4, hint_tokens[:3]
        if all(token in basename_tokens for token in hint_tokens):
            if query_intent == QueryIntent.KEYWORD:
                return 4.5, hint_tokens[:3]
            return 1.6, hint_tokens[:3]

    if query_prefers_lexical_search(query):
        lexical_surface_overlap = [
            token for token in basename_tokens if token in query_tokens and token in _LEXICAL_PRIORITY_SURFACE_TOKENS
        ]
        if lexical_surface_overlap:
            lexical_overlap = lexical_surface_overlap[:3]
            if query_intent == QueryIntent.KEYWORD:
                return 5.5, lexical_overlap
            return 5.0, lexical_overlap

    if query_intent == QueryIntent.KEYWORD:
        if len(basename_overlap) >= 2:
            # Multi-token identifier-style queries often name the feature/file directly.
            # Give basename matches a stronger lift so they can survive workspace fan-out.
            multiplier = min(4.5, 2.0 + 1.25 * float(len(basename_overlap)))
            return multiplier, basename_overlap[:3]
        if len(all_overlap) >= 3:
            multiplier = min(2.0, 1.1 + 0.2 * len(all_overlap))
            return multiplier, all_overlap[:3]
        return 1.0, []

    if len(basename_overlap) >= 2:
        multiplier = min(1.45, 1.15 + 0.1 * len(basename_overlap))
        return multiplier, basename_overlap[:3]
    if len(all_overlap) >= 3:
        multiplier = min(1.3, 1.05 + 0.05 * len(all_overlap))
        return multiplier, all_overlap[:3]
    return 1.0, []


def apply_path_penalties(
    results: List[SearchResult],
    query: str,
    *,
    test_file_penalty: float = 0.15,
    generated_file_penalty: float = 0.35,
) -> List[SearchResult]:
    """Apply lightweight path-based penalties to reduce noisy rankings."""
    if not results or (test_file_penalty <= 0 and generated_file_penalty <= 0):
        return results

    query_intent = detect_query_intent(query)
    skip_test_penalty = query_targets_test_files(query)
    skip_auxiliary_penalty = query_targets_auxiliary_files(query)
    skip_generated_penalty = query_targets_generated_files(query)
    query_topic_tokens = _semantic_query_topic_tokens(query)
    keyword_path_query = query_intent == QueryIntent.KEYWORD and len(query_topic_tokens) >= 2
    explicit_feature_query = bool(extract_explicit_path_hints(query))
    source_oriented_query = (
        explicit_feature_query
        or keyword_path_query
        or (
            query_intent in {QueryIntent.SEMANTIC, QueryIntent.MIXED}
            and len(query_topic_tokens) >= 2
        )
    )
    identifier_query = None
    if query_intent == QueryIntent.KEYWORD:
        identifier_query = _extract_identifier_query(query)
    effective_test_penalty = float(test_file_penalty)
    if effective_test_penalty > 0 and not skip_test_penalty:
        if query_intent == QueryIntent.KEYWORD:
            # Identifier-style queries should prefer implementation files over test references.
            effective_test_penalty = max(effective_test_penalty, 0.35)
        elif query_intent in {QueryIntent.SEMANTIC, QueryIntent.MIXED}:
            # Natural-language code queries should still prefer implementation files over references.
            effective_test_penalty = max(effective_test_penalty, 0.25)
        if explicit_feature_query:
            # Explicit feature/file hints should be even more biased toward source implementations.
            effective_test_penalty = max(effective_test_penalty, 0.45)
    effective_auxiliary_penalty = effective_test_penalty
    if effective_auxiliary_penalty > 0 and not skip_auxiliary_penalty and explicit_feature_query:
        # Examples/benchmarks are usually descriptive noise for feature-targeted implementation queries.
        effective_auxiliary_penalty = max(effective_auxiliary_penalty, 0.5)
    effective_generated_penalty = float(generated_file_penalty)
    if effective_generated_penalty > 0 and not skip_generated_penalty:
        if source_oriented_query:
            effective_generated_penalty = max(effective_generated_penalty, 0.45)
        if explicit_feature_query:
            effective_generated_penalty = max(effective_generated_penalty, 0.6)

    penalized: List[SearchResult] = []
    for result in results:
        multiplier = 1.0
        penalty_multiplier = 1.0
        boost_multiplier = 1.0
        penalty_reasons: List[str] = []
        boost_reasons: List[str] = []

        if effective_test_penalty > 0 and not skip_test_penalty and is_test_file(result.path):
            penalty_multiplier *= max(0.0, 1.0 - effective_test_penalty)
            penalty_reasons.append("test_file")

        if (
            effective_auxiliary_penalty > 0
            and not skip_auxiliary_penalty
            and not is_test_file(result.path)
            and is_auxiliary_reference_path(result.path)
        ):
            penalty_multiplier *= max(0.0, 1.0 - effective_auxiliary_penalty)
            penalty_reasons.append("auxiliary_file")

        if (
            effective_generated_penalty > 0
            and not skip_generated_penalty
            and is_generated_artifact_path(result.path)
        ):
            penalty_multiplier *= max(0.0, 1.0 - effective_generated_penalty)
            penalty_reasons.append("generated_artifact")

        if (
            identifier_query
            and not is_test_file(result.path)
            and not is_generated_artifact_path(result.path)
            and _result_defines_identifier(result, identifier_query)
        ):
            if _is_source_implementation_path(result.path):
                boost_multiplier *= 2.0
                boost_reasons.append("source_definition")
            else:
                boost_multiplier *= 1.35
                boost_reasons.append("symbol_definition")

        if (
            (query_intent in {QueryIntent.SEMANTIC, QueryIntent.MIXED} or keyword_path_query)
            and not skip_test_penalty
            and not skip_auxiliary_penalty
            and not skip_generated_penalty
            and not is_test_file(result.path)
            and not is_generated_artifact_path(result.path)
            and not is_auxiliary_reference_path(result.path)
            and _is_source_implementation_path(result.path)
        ):
                semantic_path_boost, overlap_tokens = _source_path_topic_boost(
                    query,
                    result.path,
                    query_intent,
                )
                if semantic_path_boost > 1.0:
                    boost_multiplier *= semantic_path_boost
                    boost_reasons.append("source_path_topic_overlap")

        multiplier = penalty_multiplier * boost_multiplier
        if penalty_reasons or boost_reasons:
            metadata = {
                **result.metadata,
                "path_rank_multiplier": multiplier,
            }
            if penalty_reasons:
                metadata["path_penalty_reasons"] = penalty_reasons
                metadata["path_penalty_multiplier"] = penalty_multiplier
            if boost_reasons:
                metadata["path_boost_reasons"] = boost_reasons
                metadata["path_boost_multiplier"] = boost_multiplier
            if "source_path_topic_overlap" in boost_reasons and overlap_tokens:
                metadata["path_boost_overlap_tokens"] = overlap_tokens
            penalized.append(
                result.model_copy(
                    deep=True,
                    update={
                        "score": max(0.0, float(result.score) * multiplier),
                        "metadata": metadata,
                    },
                )
            )
        else:
            penalized.append(result)

    penalized.sort(key=lambda r: r.score, reverse=True)
    return penalized


def rebalance_noisy_results(
    results: List[SearchResult],
    query: str,
) -> List[SearchResult]:
    """Move noisy test/generated/auxiliary results behind implementation hits when safe."""
    if not results:
        return []

    query_intent = detect_query_intent(query)
    skip_test_penalty = query_targets_test_files(query)
    skip_auxiliary_penalty = query_targets_auxiliary_files(query)
    skip_generated_penalty = query_targets_generated_files(query)
    query_topic_tokens = _semantic_query_topic_tokens(query)
    keyword_path_query = query_intent == QueryIntent.KEYWORD and len(query_topic_tokens) >= 2
    explicit_feature_query = bool(extract_explicit_path_hints(query))
    source_oriented_query = (
        explicit_feature_query
        or keyword_path_query
        or (
            query_intent in {QueryIntent.SEMANTIC, QueryIntent.MIXED}
            and len(query_topic_tokens) >= 2
        )
    )
    if not source_oriented_query:
        return results

    max_generated_results = len(results) if skip_generated_penalty else 0
    max_test_results = len(results) if skip_test_penalty else (0 if explicit_feature_query else 1)
    max_auxiliary_results = len(results) if skip_auxiliary_penalty else (0 if explicit_feature_query else 1)

    selected: List[SearchResult] = []
    deferred: List[SearchResult] = []
    generated_count = 0
    test_count = 0
    auxiliary_count = 0

    for result in results:
        if not skip_generated_penalty and is_generated_artifact_path(result.path):
            if generated_count >= max_generated_results:
                deferred.append(result)
                continue
            generated_count += 1
            selected.append(result)
            continue

        if not skip_test_penalty and is_test_file(result.path):
            if test_count >= max_test_results:
                deferred.append(result)
                continue
            test_count += 1
            selected.append(result)
            continue

        if not skip_auxiliary_penalty and is_auxiliary_reference_path(result.path):
            if auxiliary_count >= max_auxiliary_results:
                deferred.append(result)
                continue
            auxiliary_count += 1
            selected.append(result)
            continue

        selected.append(result)

    return selected + deferred


def simple_weighted_fusion(
    results_map: Dict[str, List[SearchResult]],
    weights: Dict[str, float] = None,
) -> List[SearchResult]:
    """Combine search results using simple weighted sum of normalized scores.

    This is an alternative to RRF that preserves score magnitude information.
    Scores are min-max normalized per source before weighted combination.

    Formula: score(d) = Σ weight_source * normalized_score_source(d)

    Args:
        results_map: Dictionary mapping source name to list of SearchResult objects
                     Sources: 'exact', 'fuzzy', 'vector'
        weights: Dictionary mapping source name to weight (default: equal weights)
                 Example: {'exact': 0.3, 'fuzzy': 0.1, 'vector': 0.6}

    Returns:
        List of SearchResult objects sorted by fused score (descending)

    Examples:
        >>> fts_results = [SearchResult(path="a.py", score=10.0, excerpt="...")]
        >>> vector_results = [SearchResult(path="b.py", score=0.85, excerpt="...")]
        >>> results_map = {'exact': fts_results, 'vector': vector_results}
        >>> fused = simple_weighted_fusion(results_map)
    """
    if not results_map:
        return []

    # Default equal weights if not provided
    if weights is None:
        num_sources = len(results_map)
        weights = {source: 1.0 / num_sources for source in results_map}

    # Normalize weights to sum to 1.0
    weight_sum = sum(weights.values())
    if not math.isclose(weight_sum, 1.0, abs_tol=0.01) and weight_sum > 0:
        weights = {source: w / weight_sum for source, w in weights.items()}

    # Compute min-max normalization parameters per source
    source_stats: Dict[str, tuple] = {}
    for source_name, results in results_map.items():
        if not results:
            continue
        scores = [r.score for r in results]
        min_s, max_s = min(scores), max(scores)
        source_stats[source_name] = (min_s, max_s)

    def normalize_score(score: float, source: str) -> float:
        """Normalize score to [0, 1] range using min-max scaling."""
        if source not in source_stats:
            return 0.0
        min_s, max_s = source_stats[source]
        if max_s == min_s:
            return 1.0 if score >= min_s else 0.0
        return (score - min_s) / (max_s - min_s)

    # Build unified result set with weighted scores
    path_to_result: Dict[str, SearchResult] = {}
    path_to_fusion_score: Dict[str, float] = {}
    path_to_source_scores: Dict[str, Dict[str, float]] = {}

    for source_name, results in results_map.items():
        weight = weights.get(source_name, 0.0)
        if weight == 0:
            continue

        for result in results:
            path = result.path
            normalized = normalize_score(result.score, source_name)
            contribution = weight * normalized

            if path not in path_to_fusion_score:
                path_to_fusion_score[path] = 0.0
                path_to_result[path] = result
                path_to_source_scores[path] = {}

            path_to_fusion_score[path] += contribution
            path_to_source_scores[path][source_name] = normalized

    # Create final results with fusion scores
    fused_results = []
    for path, base_result in path_to_result.items():
        fusion_score = path_to_fusion_score[path]

        fused_result = SearchResult(
            path=base_result.path,
            score=fusion_score,
            excerpt=base_result.excerpt,
            content=base_result.content,
            symbol=base_result.symbol,
            chunk=base_result.chunk,
            metadata={
                **base_result.metadata,
                "fusion_method": "simple_weighted",
                "fusion_score": fusion_score,
                "original_score": base_result.score,
                "source_scores": path_to_source_scores[path],
            },
            start_line=base_result.start_line,
            end_line=base_result.end_line,
            symbol_name=base_result.symbol_name,
            symbol_kind=base_result.symbol_kind,
        )
        fused_results.append(fused_result)

    fused_results.sort(key=lambda r: r.score, reverse=True)
    return fused_results


def reciprocal_rank_fusion(
    results_map: Dict[str, List[SearchResult]],
    weights: Dict[str, float] = None,
    k: int = 60,
) -> List[SearchResult]:
    """Combine search results from multiple sources using Reciprocal Rank Fusion.

    RRF formula: score(d) = Σ weight_source / (k + rank_source(d))

    Args:
        results_map: Dictionary mapping source name to list of SearchResult objects
                     Sources: 'exact', 'fuzzy', 'vector'
        weights: Dictionary mapping source name to weight (default: equal weights)
                 Example: {'exact': 0.3, 'fuzzy': 0.1, 'vector': 0.6}
        k: Constant to avoid division by zero and control rank influence (default 60)

    Returns:
        List of SearchResult objects sorted by fused score (descending)

    Examples:
        >>> exact_results = [SearchResult(path="a.py", score=10.0, excerpt="...")]
        >>> fuzzy_results = [SearchResult(path="b.py", score=8.0, excerpt="...")]
        >>> results_map = {'exact': exact_results, 'fuzzy': fuzzy_results}
        >>> fused = reciprocal_rank_fusion(results_map)
    """
    if not results_map:
        return []

    # Default equal weights if not provided
    if weights is None:
        num_sources = len(results_map)
        weights = {source: 1.0 / num_sources for source in results_map}

    # Validate weights sum to 1.0
    weight_sum = sum(weights.values())
    if not math.isclose(weight_sum, 1.0, abs_tol=0.01):
        # Normalize weights to sum to 1.0
        weights = {source: w / weight_sum for source, w in weights.items()}

    # Build unified result set with RRF scores
    path_to_result: Dict[str, SearchResult] = {}
    path_to_fusion_score: Dict[str, float] = {}
    path_to_source_ranks: Dict[str, Dict[str, int]] = {}

    for source_name, results in results_map.items():
        weight = weights.get(source_name, 0.0)
        if weight == 0:
            continue

        for rank, result in enumerate(results, start=1):
            path = result.path
            rrf_contribution = weight / (k + rank)

            # Initialize or accumulate fusion score
            if path not in path_to_fusion_score:
                path_to_fusion_score[path] = 0.0
                path_to_result[path] = result
                path_to_source_ranks[path] = {}

            path_to_fusion_score[path] += rrf_contribution
            path_to_source_ranks[path][source_name] = rank

    # Create final results with fusion scores
    fused_results = []
    for path, base_result in path_to_result.items():
        fusion_score = path_to_fusion_score[path]

        # Create new SearchResult with fusion_score in metadata
        fused_result = SearchResult(
            path=base_result.path,
            score=fusion_score,
            excerpt=base_result.excerpt,
            content=base_result.content,
            symbol=base_result.symbol,
            chunk=base_result.chunk,
            metadata={
                **base_result.metadata,
                "fusion_method": "rrf",
                "fusion_score": fusion_score,
                "original_score": base_result.score,
                "rrf_k": k,
                "source_ranks": path_to_source_ranks[path],
            },
            start_line=base_result.start_line,
            end_line=base_result.end_line,
            symbol_name=base_result.symbol_name,
            symbol_kind=base_result.symbol_kind,
        )
        fused_results.append(fused_result)

    # Sort by fusion score descending
    fused_results.sort(key=lambda r: r.score, reverse=True)

    return fused_results


def apply_symbol_boost(
    results: List[SearchResult],
    boost_factor: float = 1.5,
) -> List[SearchResult]:
    """Boost fused scores for results that include an explicit symbol match.

    The boost is multiplicative on the current result.score (typically the RRF fusion score).
    When boosted, the original score is preserved in metadata["original_fusion_score"] and
    metadata["boosted"] is set to True.
    """
    if not results:
        return []

    if boost_factor <= 1.0:
        # Still return new objects to follow immutable transformation pattern.
        return [
            SearchResult(
                path=r.path,
                score=r.score,
                excerpt=r.excerpt,
                content=r.content,
                symbol=r.symbol,
                chunk=r.chunk,
                metadata={**r.metadata},
                start_line=r.start_line,
                end_line=r.end_line,
                symbol_name=r.symbol_name,
                symbol_kind=r.symbol_kind,
                additional_locations=list(r.additional_locations),
            )
            for r in results
        ]

    boosted_results: List[SearchResult] = []
    for result in results:
        has_symbol = bool(result.symbol_name)
        original_score = float(result.score)
        boosted_score = original_score * boost_factor if has_symbol else original_score

        metadata = {**result.metadata}
        if has_symbol:
            metadata.setdefault("original_fusion_score", metadata.get("fusion_score", original_score))
            metadata["boosted"] = True
            metadata["symbol_boost_factor"] = boost_factor

        boosted_results.append(
            SearchResult(
                path=result.path,
                score=boosted_score,
                excerpt=result.excerpt,
                content=result.content,
                symbol=result.symbol,
                chunk=result.chunk,
                metadata=metadata,
                start_line=result.start_line,
                end_line=result.end_line,
                symbol_name=result.symbol_name,
                symbol_kind=result.symbol_kind,
                additional_locations=list(result.additional_locations),
            )
        )

    boosted_results.sort(key=lambda r: r.score, reverse=True)
    return boosted_results


def rerank_results(
    query: str,
    results: List[SearchResult],
    embedder: Any,
    top_k: int = 50,
) -> List[SearchResult]:
    """Re-rank results with embedding cosine similarity, combined with current score.

    Combined score formula:
        0.5 * rrf_score + 0.5 * cosine_similarity

    If embedder is None or embedding fails, returns results as-is.
    """
    if not results:
        return []

    if embedder is None or top_k <= 0:
        return results

    rerank_count = min(int(top_k), len(results))

    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        # Defensive: handle mismatched lengths and zero vectors.
        n = min(len(vec_a), len(vec_b))
        if n == 0:
            return 0.0
        dot = 0.0
        norm_a = 0.0
        norm_b = 0.0
        for i in range(n):
            a = float(vec_a[i])
            b = float(vec_b[i])
            dot += a * b
            norm_a += a * a
            norm_b += b * b
        if norm_a <= 0.0 or norm_b <= 0.0:
            return 0.0
        sim = dot / (math.sqrt(norm_a) * math.sqrt(norm_b))
        # SearchResult.score requires non-negative scores; clamp cosine similarity to [0, 1].
        return max(0.0, min(1.0, sim))

    def text_for_embedding(r: SearchResult) -> str:
        if r.excerpt and r.excerpt.strip():
            return r.excerpt
        if r.content and r.content.strip():
            return r.content
        if r.chunk and r.chunk.content and r.chunk.content.strip():
            return r.chunk.content
        # Fallback: stable, non-empty text.
        return r.symbol_name or r.path

    try:
        if hasattr(embedder, "embed_single"):
            query_vec = embedder.embed_single(query)
        else:
            query_vec = embedder.embed(query)[0]

        doc_texts = [text_for_embedding(r) for r in results[:rerank_count]]
        doc_vecs = embedder.embed(doc_texts)
    except Exception:
        return results

    reranked_results: List[SearchResult] = []

    for idx, result in enumerate(results):
        if idx < rerank_count:
            rrf_score = float(result.score)
            sim = cosine_similarity(query_vec, doc_vecs[idx])
            combined_score = 0.5 * rrf_score + 0.5 * sim

            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=combined_score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={
                        **result.metadata,
                        "rrf_score": rrf_score,
                        "cosine_similarity": sim,
                        "reranked": True,
                    },
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )
        else:
            # Preserve remaining results without re-ranking, but keep immutability.
            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=result.score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={**result.metadata},
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )

    reranked_results.sort(key=lambda r: r.score, reverse=True)
    return reranked_results


def cross_encoder_rerank(
    query: str,
    results: List[SearchResult],
    reranker: Any,
    top_k: int = 50,
    batch_size: int = 32,
    chunk_type_weights: Optional[Dict[str, float]] = None,
    test_file_penalty: float = 0.0,
) -> List[SearchResult]:
    """Second-stage reranking using a cross-encoder model.

    This function is dependency-agnostic: callers can pass any object that exposes
    a compatible `score_pairs(pairs, batch_size=...)` method.

    Args:
        query: Search query string
        results: List of search results to rerank
        reranker: Cross-encoder model with score_pairs or predict method
        top_k: Number of top results to rerank
        batch_size: Batch size for reranking
        chunk_type_weights: Optional weights for different chunk types.
            Example: {"code": 1.0, "docstring": 0.7} - reduce docstring influence
        test_file_penalty: Penalty applied to test files (0.0-1.0).
            Example: 0.2 means test files get 20% score reduction
    """
    if not results:
        return []

    if reranker is None or top_k <= 0:
        return results

    rerank_count = min(int(top_k), len(results))

    def text_for_pair(r: SearchResult) -> str:
        if r.excerpt and r.excerpt.strip():
            return r.excerpt
        if r.content and r.content.strip():
            return r.content
        if r.chunk and r.chunk.content and r.chunk.content.strip():
            return r.chunk.content
        return r.symbol_name or r.path

    pairs = [(query, text_for_pair(r)) for r in results[:rerank_count]]

    try:
        if hasattr(reranker, "score_pairs"):
            raw_scores = reranker.score_pairs(pairs, batch_size=int(batch_size))
        elif hasattr(reranker, "predict"):
            raw_scores = reranker.predict(pairs, batch_size=int(batch_size))
        else:
            return results
    except Exception as exc:
        logger.debug("Cross-encoder rerank failed; returning original ranking: %s", exc)
        return results

    if not raw_scores or len(raw_scores) != rerank_count:
        logger.debug(
            "Cross-encoder rerank returned %d scores for %d candidates; returning original ranking",
            len(raw_scores) if raw_scores else 0,
            rerank_count,
        )
        return results

    scores = [float(s) for s in raw_scores]
    min_s = min(scores)
    max_s = max(scores)

    def sigmoid(x: float) -> float:
        # Clamp to keep exp() stable.
        x = max(-50.0, min(50.0, x))
        return 1.0 / (1.0 + math.exp(-x))

    if 0.0 <= min_s and max_s <= 1.0:
        probs = scores
    else:
        probs = [sigmoid(s) for s in scores]

    query_intent = detect_query_intent(query)
    skip_test_penalty = query_targets_test_files(query)
    skip_auxiliary_penalty = query_targets_auxiliary_files(query)
    skip_generated_penalty = query_targets_generated_files(query)
    keyword_path_query = query_intent == QueryIntent.KEYWORD and len(_semantic_query_topic_tokens(query)) >= 2
    reranked_results: List[SearchResult] = []

    for idx, result in enumerate(results):
        if idx < rerank_count:
            prev_score = float(result.score)
            ce_score = scores[idx]
            ce_prob = probs[idx]

            # Base combined score
            combined_score = 0.5 * prev_score + 0.5 * ce_prob

            # Apply chunk_type weight adjustment
            if chunk_type_weights:
                chunk_type = None
                if result.chunk and hasattr(result.chunk, "metadata"):
                    chunk_type = result.chunk.metadata.get("chunk_type")
                elif result.metadata:
                    chunk_type = result.metadata.get("chunk_type")

                if chunk_type and chunk_type in chunk_type_weights:
                    weight = chunk_type_weights[chunk_type]
                    # Apply weight to CE contribution only
                    combined_score = 0.5 * prev_score + 0.5 * ce_prob * weight

            # Apply test file penalty
            if test_file_penalty > 0 and is_test_file(result.path):
                combined_score = combined_score * (1.0 - test_file_penalty)

            cross_encoder_floor_reason = None
            cross_encoder_floor_score = None
            cross_encoder_floor_overlap_tokens: List[str] = []
            if (
                (query_intent in {QueryIntent.SEMANTIC, QueryIntent.MIXED} or keyword_path_query)
                and not skip_test_penalty
                and not skip_auxiliary_penalty
                and not skip_generated_penalty
                and not is_test_file(result.path)
                and not is_generated_artifact_path(result.path)
                and not is_auxiliary_reference_path(result.path)
                and _is_source_implementation_path(result.path)
            ):
                semantic_path_boost, overlap_tokens = _source_path_topic_boost(
                    query,
                    result.path,
                    query_intent,
                )
                if semantic_path_boost > 1.0:
                    floor_ratio = 0.8 if semantic_path_boost >= 1.35 else 0.75
                    candidate_floor = prev_score * floor_ratio
                    if candidate_floor > combined_score:
                        combined_score = candidate_floor
                        cross_encoder_floor_reason = (
                            "keyword_source_path_overlap"
                            if query_intent == QueryIntent.KEYWORD
                            else "semantic_source_path_overlap"
                        )
                        cross_encoder_floor_score = candidate_floor
                        cross_encoder_floor_overlap_tokens = overlap_tokens

            metadata = {
                **result.metadata,
                "pre_cross_encoder_score": prev_score,
                "cross_encoder_score": ce_score,
                "cross_encoder_prob": ce_prob,
                "cross_encoder_reranked": True,
            }
            if cross_encoder_floor_reason is not None:
                metadata["cross_encoder_floor_reason"] = cross_encoder_floor_reason
                metadata["cross_encoder_floor_score"] = cross_encoder_floor_score
                if cross_encoder_floor_overlap_tokens:
                    metadata["cross_encoder_floor_overlap_tokens"] = (
                        cross_encoder_floor_overlap_tokens
                    )

            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=combined_score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata=metadata,
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )
        else:
            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=result.score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={**result.metadata},
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )

    reranked_results.sort(key=lambda r: r.score, reverse=True)
    return reranked_results


def normalize_bm25_score(score: float) -> float:
    """Normalize BM25 scores from SQLite FTS5 to 0-1 range.

    SQLite FTS5 returns negative BM25 scores (more negative = better match).
    Uses sigmoid transformation for normalization.

    Args:
        score: Raw BM25 score from SQLite (typically negative)

    Returns:
        Normalized score in range [0, 1]

    Examples:
        >>> normalize_bm25_score(-10.5)  # Good match
        0.85
        >>> normalize_bm25_score(-1.2)   # Weak match
        0.62
    """
    # Take absolute value (BM25 is negative in SQLite)
    abs_score = abs(score)

    # Sigmoid transformation: 1 / (1 + e^(-x))
    # Scale factor of 0.1 maps typical BM25 range (-20 to 0) to (0, 1)
    normalized = 1.0 / (1.0 + math.exp(-abs_score * 0.1))

    return normalized


def tag_search_source(results: List[SearchResult], source: str) -> List[SearchResult]:
    """Tag search results with their source for RRF tracking.

    Args:
        results: List of SearchResult objects
        source: Source identifier ('exact', 'fuzzy', 'vector')

    Returns:
        List of SearchResult objects with 'search_source' in metadata
    """
    tagged_results = []
    for result in results:
        tagged_result = SearchResult(
            path=result.path,
            score=result.score,
            excerpt=result.excerpt,
            content=result.content,
            symbol=result.symbol,
            chunk=result.chunk,
            metadata={**result.metadata, "search_source": source},
            start_line=result.start_line,
            end_line=result.end_line,
            symbol_name=result.symbol_name,
            symbol_kind=result.symbol_kind,
        )
        tagged_results.append(tagged_result)

    return tagged_results


def group_similar_results(
    results: List[SearchResult],
    score_threshold_abs: float = 0.01,
    content_field: str = "excerpt"
) -> List[SearchResult]:
    """Group search results by content and score similarity.

    Groups results that have similar content and similar scores into a single
    representative result, with other locations stored in additional_locations.

    Algorithm:
    1. Group results by content (using excerpt or content field)
    2. Within each content group, create subgroups based on score similarity
    3. Select highest-scoring result as representative for each subgroup
    4. Store other results in subgroup as additional_locations

    Args:
        results: A list of SearchResult objects (typically sorted by score)
        score_threshold_abs: Absolute score difference to consider results similar.
                            Results with |score_a - score_b| <= threshold are grouped.
                            Default 0.01 is suitable for RRF fusion scores.
        content_field: The field to use for content grouping ('excerpt' or 'content')

    Returns:
        A new list of SearchResult objects where similar items are grouped.
        The list is sorted by score descending.

    Examples:
        >>> results = [SearchResult(path="a.py", score=0.5, excerpt="def foo()"),
        ...            SearchResult(path="b.py", score=0.5, excerpt="def foo()")]
        >>> grouped = group_similar_results(results)
        >>> len(grouped)  # Two results merged into one
        1
        >>> len(grouped[0].additional_locations)  # One additional location
        1
    """
    if not results:
        return []

    # Group results by content
    content_map: Dict[str, List[SearchResult]] = {}
    unidentifiable_results: List[SearchResult] = []

    for r in results:
        key = getattr(r, content_field, None)
        if key and key.strip():
            content_map.setdefault(key, []).append(r)
        else:
            # Results without content can't be grouped by content
            unidentifiable_results.append(r)

    final_results: List[SearchResult] = []

    # Process each content group
    for content_group in content_map.values():
        # Sort by score descending within group
        content_group.sort(key=lambda r: r.score, reverse=True)

        while content_group:
            # Take highest scoring as representative
            representative = content_group.pop(0)
            others_in_group = []
            remaining_for_next_pass = []

            # Find results with similar scores
            for item in content_group:
                if abs(representative.score - item.score) <= score_threshold_abs:
                    others_in_group.append(item)
                else:
                    remaining_for_next_pass.append(item)

            # Create grouped result with additional locations
            if others_in_group:
                # Build new result with additional_locations populated
                grouped_result = SearchResult(
                    path=representative.path,
                    score=representative.score,
                    excerpt=representative.excerpt,
                    content=representative.content,
                    symbol=representative.symbol,
                    chunk=representative.chunk,
                    metadata={
                        **representative.metadata,
                        "grouped_count": len(others_in_group) + 1,
                    },
                    start_line=representative.start_line,
                    end_line=representative.end_line,
                    symbol_name=representative.symbol_name,
                    symbol_kind=representative.symbol_kind,
                    additional_locations=[
                        AdditionalLocation(
                            path=other.path,
                            score=other.score,
                            start_line=other.start_line,
                            end_line=other.end_line,
                            symbol_name=other.symbol_name,
                        ) for other in others_in_group
                    ],
                )
                final_results.append(grouped_result)
            else:
                final_results.append(representative)

            content_group = remaining_for_next_pass

    # Add ungroupable results
    final_results.extend(unidentifiable_results)

    # Sort final results by score descending
    final_results.sort(key=lambda r: r.score, reverse=True)

    return final_results
