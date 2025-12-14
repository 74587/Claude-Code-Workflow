"""LLM-based semantic enhancement using CCW CLI.

This module provides LLM-generated descriptions that are then embedded
by fastembed for improved semantic search. The flow is:

    Code → LLM Summary → fastembed embedding → VectorStore → semantic search

LLM-generated summaries match natural language queries better than raw code.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from codexlens.entities import SemanticChunk, Symbol

if TYPE_CHECKING:
    from .embedder import Embedder
    from .vector_store import VectorStore


logger = logging.getLogger(__name__)


@dataclass
class SemanticMetadata:
    """LLM-generated semantic metadata for a file or symbol."""

    summary: str
    keywords: List[str]
    purpose: str
    file_path: Optional[str] = None
    symbol_name: Optional[str] = None
    llm_tool: Optional[str] = None


@dataclass
class FileData:
    """File data for LLM processing."""

    path: str
    content: str
    language: str
    symbols: List[Symbol] = field(default_factory=list)


@dataclass
class LLMConfig:
    """Configuration for LLM enhancement.

    Tool selection can be overridden via environment variables:
    - CCW_CLI_SECONDARY_TOOL: Primary tool for LLM calls (default: gemini)
    - CCW_CLI_FALLBACK_TOOL: Fallback tool if primary fails (default: qwen)
    """

    tool: str = field(default_factory=lambda: os.environ.get("CCW_CLI_SECONDARY_TOOL", "gemini"))
    fallback_tool: str = field(default_factory=lambda: os.environ.get("CCW_CLI_FALLBACK_TOOL", "qwen"))
    timeout_ms: int = 300000
    batch_size: int = 5
    max_content_chars: int = 8000  # Max chars per file in batch prompt
    enabled: bool = True


class LLMEnhancer:
    """LLM-based semantic enhancement using CCW CLI.

    Generates code summaries and search keywords by calling
    external LLM tools (gemini, qwen) via CCW CLI subprocess.
    """

    PROMPT_TEMPLATE = '''PURPOSE: Generate semantic summaries and search keywords for code files
TASK:
- For each code block, generate a concise summary (1-2 sentences)
- Extract 5-10 relevant search keywords
- Identify the functional purpose/category
MODE: analysis
EXPECTED: JSON format output

=== CODE BLOCKS ===
{code_blocks}

=== OUTPUT FORMAT ===
Return ONLY valid JSON (no markdown, no explanation):
{{
  "files": {{
    "<file_path>": {{
      "summary": "Brief description of what this code does",
      "keywords": ["keyword1", "keyword2", ...],
      "purpose": "category like: auth, api, util, ui, data, config, test"
    }}
  }}
}}'''

    def __init__(self, config: LLMConfig | None = None) -> None:
        """Initialize LLM enhancer.

        Args:
            config: LLM configuration, uses defaults if None
        """
        self.config = config or LLMConfig()
        self._ccw_available: Optional[bool] = None

    def check_available(self) -> bool:
        """Check if CCW CLI tool is available."""
        if self._ccw_available is not None:
            return self._ccw_available

        self._ccw_available = shutil.which("ccw") is not None
        if not self._ccw_available:
            logger.warning("CCW CLI not found in PATH, LLM enhancement disabled")
        return self._ccw_available

    def enhance_files(
        self,
        files: List[FileData],
        working_dir: Optional[Path] = None,
    ) -> Dict[str, SemanticMetadata]:
        """Enhance multiple files with LLM-generated semantic metadata.

        Processes files in batches to manage token limits and API costs.

        Args:
            files: List of file data to process
            working_dir: Optional working directory for CCW CLI

        Returns:
            Dict mapping file paths to SemanticMetadata
        """
        if not self.config.enabled:
            logger.debug("LLM enhancement disabled by config")
            return {}

        if not self.check_available():
            return {}

        if not files:
            return {}

        results: Dict[str, SemanticMetadata] = {}
        batch_size = self.config.batch_size

        for i in range(0, len(files), batch_size):
            batch = files[i:i + batch_size]
            try:
                batch_results = self._process_batch(batch, working_dir)
                results.update(batch_results)
                logger.debug(
                    "Processed batch %d/%d: %d files enhanced",
                    i // batch_size + 1,
                    (len(files) + batch_size - 1) // batch_size,
                    len(batch_results),
                )
            except Exception as e:
                logger.warning(
                    "Batch %d failed, continuing: %s",
                    i // batch_size + 1,
                    e,
                )
                continue

        return results

    def enhance_file(
        self,
        path: str,
        content: str,
        language: str,
        working_dir: Optional[Path] = None,
    ) -> SemanticMetadata:
        """Enhance a single file with LLM-generated semantic metadata.

        Convenience method that wraps enhance_files for single file processing.

        Args:
            path: File path
            content: File content
            language: Programming language
            working_dir: Optional working directory for CCW CLI

        Returns:
            SemanticMetadata for the file

        Raises:
            ValueError: If enhancement fails
        """
        file_data = FileData(path=path, content=content, language=language)
        results = self.enhance_files([file_data], working_dir)

        if path not in results:
            # Return default metadata if enhancement failed
            return SemanticMetadata(
                summary=f"Code file written in {language}",
                keywords=[language, "code"],
                purpose="unknown",
                file_path=path,
                llm_tool=self.config.tool,
            )

        return results[path]


    def _process_batch(
        self,
        files: List[FileData],
        working_dir: Optional[Path] = None,
    ) -> Dict[str, SemanticMetadata]:
        """Process a single batch of files."""
        prompt = self._build_batch_prompt(files)

        # Try primary tool first
        result = self._invoke_ccw_cli(
            prompt,
            tool=self.config.tool,
            working_dir=working_dir,
        )

        # Fallback to secondary tool if primary fails
        if not result["success"] and self.config.fallback_tool:
            logger.debug(
                "Primary tool %s failed, trying fallback %s",
                self.config.tool,
                self.config.fallback_tool,
            )
            result = self._invoke_ccw_cli(
                prompt,
                tool=self.config.fallback_tool,
                working_dir=working_dir,
            )

        if not result["success"]:
            logger.warning("LLM call failed: %s", result.get("stderr", "unknown error"))
            return {}

        return self._parse_response(result["stdout"], self.config.tool)

    def _build_batch_prompt(self, files: List[FileData]) -> str:
        """Build prompt for batch processing."""
        code_blocks_parts: List[str] = []

        for file_data in files:
            # Truncate content if too long
            content = file_data.content
            if len(content) > self.config.max_content_chars:
                content = content[:self.config.max_content_chars] + "\n... [truncated]"

            # Format code block
            lang_hint = file_data.language or "text"
            code_block = f'''[FILE: {file_data.path}]
```{lang_hint}
{content}
```'''
            code_blocks_parts.append(code_block)

        code_blocks = "\n\n".join(code_blocks_parts)
        return self.PROMPT_TEMPLATE.format(code_blocks=code_blocks)

    def _invoke_ccw_cli(
        self,
        prompt: str,
        tool: str = "gemini",
        working_dir: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """Invoke CCW CLI tool via subprocess.

        Args:
            prompt: The prompt to send to LLM
            tool: Tool name (gemini, qwen, codex)
            working_dir: Optional working directory

        Returns:
            Dict with success, stdout, stderr, exit_code
        """
        import sys
        import os

        timeout_seconds = (self.config.timeout_ms / 1000) + 30

        # Build base arguments
        base_args = [
            "cli", "exec",
            prompt,  # Direct string argument
            "--tool", tool,
            "--mode", "analysis",
            "--timeout", str(self.config.timeout_ms),
        ]
        if working_dir:
            base_args.extend(["--cd", str(working_dir)])

        try:
            if sys.platform == "win32":
                # On Windows, ccw is a .CMD wrapper that requires shell
                # Instead, directly invoke node with the ccw.js script
                ccw_path = shutil.which("ccw")
                if ccw_path and ccw_path.lower().endswith(".cmd"):
                    # Find the ccw.js script location
                    npm_dir = Path(ccw_path).parent
                    ccw_js = npm_dir / "node_modules" / "ccw" / "bin" / "ccw.js"
                    if ccw_js.exists():
                        cmd = ["node", str(ccw_js)] + base_args
                    else:
                        # Fallback to shell execution
                        cmd_str = "ccw " + " ".join(f'"{a}"' if " " in a else a for a in base_args)
                        result = subprocess.run(
                            cmd_str, shell=True, capture_output=True, text=True,
                            timeout=timeout_seconds, cwd=working_dir,
                            encoding="utf-8", errors="replace",
                        )
                        return {
                            "success": result.returncode == 0,
                            "stdout": result.stdout,
                            "stderr": result.stderr,
                            "exit_code": result.returncode,
                        }
                else:
                    cmd = ["ccw"] + base_args
            else:
                cmd = ["ccw"] + base_args

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                cwd=working_dir,
                encoding="utf-8",
                errors="replace",
            )

            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
            }

        except subprocess.TimeoutExpired:
            logger.warning("CCW CLI timeout after %ds", self.config.timeout_ms / 1000)
            return {
                "success": False,
                "stdout": "",
                "stderr": "timeout",
                "exit_code": -1,
            }
        except FileNotFoundError:
            logger.warning("CCW CLI not found - ensure 'ccw' is in PATH")
            return {
                "success": False,
                "stdout": "",
                "stderr": "ccw command not found",
                "exit_code": -1,
            }
        except Exception as e:
            logger.warning("CCW CLI invocation failed: %s", e)
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "exit_code": -1,
            }

    def _parse_response(
        self,
        stdout: str,
        tool: str,
    ) -> Dict[str, SemanticMetadata]:
        """Parse LLM response into SemanticMetadata objects.

        Args:
            stdout: Raw stdout from CCW CLI
            tool: Tool name used for generation

        Returns:
            Dict mapping file paths to SemanticMetadata
        """
        results: Dict[str, SemanticMetadata] = {}

        # Extract JSON from response (may be wrapped in markdown or other text)
        json_str = self._extract_json(stdout)
        if not json_str:
            logger.warning("No JSON found in LLM response")
            return results

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse LLM response JSON: %s", e)
            return results

        # Handle expected format: {"files": {"path": {...}}}
        files_data = data.get("files", data)
        if not isinstance(files_data, dict):
            logger.warning("Unexpected response format: expected dict")
            return results

        for file_path, metadata in files_data.items():
            if not isinstance(metadata, dict):
                continue

            try:
                results[file_path] = SemanticMetadata(
                    summary=metadata.get("summary", ""),
                    keywords=metadata.get("keywords", []),
                    purpose=metadata.get("purpose", ""),
                    file_path=file_path,
                    llm_tool=tool,
                )
            except Exception as e:
                logger.debug("Failed to parse metadata for %s: %s", file_path, e)
                continue

        return results

    def _extract_json(self, text: str) -> Optional[str]:
        """Extract JSON object from text that may contain markdown or other content."""
        # Try to find JSON object boundaries
        text = text.strip()

        # Remove markdown code blocks if present
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first line (```json or ```)
            lines = lines[1:]
            # Find closing ```
            for i, line in enumerate(lines):
                if line.strip() == "```":
                    lines = lines[:i]
                    break
            text = "\n".join(lines)

        # Find JSON object
        start = text.find("{")
        if start == -1:
            return None

        # Find matching closing brace
        depth = 0
        end = start
        for i, char in enumerate(text[start:], start):
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        if depth != 0:
            return None

        return text[start:end]


def create_enhancer(
    tool: str = "gemini",
    timeout_ms: int = 300000,
    batch_size: int = 5,
    enabled: bool = True,
) -> LLMEnhancer:
    """Factory function to create LLM enhancer with custom config."""
    config = LLMConfig(
        tool=tool,
        timeout_ms=timeout_ms,
        batch_size=batch_size,
        enabled=enabled,
    )
    return LLMEnhancer(config)


class EnhancedSemanticIndexer:
    """Integrates LLM enhancement with fastembed vector search.

    Flow:
        1. Code files → LLM generates summaries/keywords
        2. Summaries → fastembed generates embeddings
        3. Embeddings → VectorStore for similarity search

    This produces better semantic search because:
    - LLM summaries are natural language descriptions
    - Natural language queries match summaries better than raw code
    - Keywords expand search coverage
    """

    def __init__(
        self,
        enhancer: LLMEnhancer,
        embedder: "Embedder",
        vector_store: "VectorStore",
    ) -> None:
        """Initialize enhanced semantic indexer.

        Args:
            enhancer: LLM enhancer for generating summaries
            embedder: Fastembed embedder for vector generation
            vector_store: Vector storage for similarity search
        """
        self.enhancer = enhancer
        self.embedder = embedder
        self.vector_store = vector_store

    def index_files(
        self,
        files: List[FileData],
        working_dir: Optional[Path] = None,
    ) -> int:
        """Index files with LLM-enhanced semantic search.

        Args:
            files: List of file data to index
            working_dir: Optional working directory for LLM calls

        Returns:
            Number of files successfully indexed
        """
        if not files:
            return 0

        # Step 1: Generate LLM summaries
        logger.info("Generating LLM summaries for %d files...", len(files))
        metadata_map = self.enhancer.enhance_files(files, working_dir)

        if not metadata_map:
            logger.warning("No LLM metadata generated, falling back to raw code")
            return self._index_raw_code(files)

        # Step 2: Create semantic chunks from LLM summaries
        chunks_to_embed: List[SemanticChunk] = []
        file_paths: List[str] = []

        for file_data in files:
            metadata = metadata_map.get(file_data.path)
            if metadata:
                # Use LLM-generated summary + keywords for embedding
                embeddable_text = self._create_embeddable_text(metadata, file_data)
                chunk = SemanticChunk(
                    content=embeddable_text,
                    embedding=None,
                    metadata={
                        "file": file_data.path,
                        "language": file_data.language,
                        "summary": metadata.summary,
                        "keywords": metadata.keywords,
                        "purpose": metadata.purpose,
                        "llm_tool": metadata.llm_tool,
                        "strategy": "llm_enhanced",
                    },
                )
            else:
                # Fallback: use truncated raw code
                chunk = SemanticChunk(
                    content=file_data.content[:2000],
                    embedding=None,
                    metadata={
                        "file": file_data.path,
                        "language": file_data.language,
                        "strategy": "raw_code",
                    },
                )

            chunks_to_embed.append(chunk)
            file_paths.append(file_data.path)

        # Step 3: Generate embeddings
        logger.info("Generating embeddings for %d chunks...", len(chunks_to_embed))
        texts = [chunk.content for chunk in chunks_to_embed]
        embeddings = self.embedder.embed(texts)

        # Step 4: Store in vector store
        indexed_count = 0
        for chunk, embedding, file_path in zip(chunks_to_embed, embeddings, file_paths):
            chunk.embedding = embedding
            try:
                self.vector_store.add_chunk(chunk, file_path)
                indexed_count += 1
            except Exception as e:
                logger.debug("Failed to store chunk for %s: %s", file_path, e)

        logger.info("Successfully indexed %d/%d files", indexed_count, len(files))
        return indexed_count

    def _create_embeddable_text(
        self,
        metadata: SemanticMetadata,
        file_data: FileData,
    ) -> str:
        """Create text optimized for embedding from LLM metadata.

        Combines summary, keywords, and purpose into a single string
        that will produce good semantic matches for natural language queries.
        """
        parts = []

        # Summary is the primary content
        if metadata.summary:
            parts.append(metadata.summary)

        # Purpose adds categorical context
        if metadata.purpose:
            parts.append(f"Category: {metadata.purpose}")

        # Keywords expand search coverage
        if metadata.keywords:
            parts.append(f"Keywords: {', '.join(metadata.keywords)}")

        # Add file name for context
        parts.append(f"File: {Path(file_data.path).name}")

        return "\n".join(parts)

    def _index_raw_code(self, files: List[FileData]) -> int:
        """Fallback: index raw code without LLM enhancement."""
        indexed_count = 0

        for file_data in files:
            # Truncate to reasonable size
            content = file_data.content[:2000]

            chunk = SemanticChunk(
                content=content,
                embedding=None,
                metadata={
                    "file": file_data.path,
                    "language": file_data.language,
                    "strategy": "raw_code",
                },
            )

            try:
                embedding = self.embedder.embed_single(content)
                chunk.embedding = embedding
                self.vector_store.add_chunk(chunk, file_data.path)
                indexed_count += 1
            except Exception as e:
                logger.debug("Failed to index %s: %s", file_data.path, e)

        return indexed_count


def create_enhanced_indexer(
    vector_store_path: Path,
    llm_tool: str = "gemini",
    llm_enabled: bool = True,
) -> EnhancedSemanticIndexer:
    """Factory function to create an enhanced semantic indexer.

    Args:
        vector_store_path: Path for the vector store database
        llm_tool: LLM tool to use (gemini, qwen)
        llm_enabled: Whether to enable LLM enhancement

    Returns:
        Configured EnhancedSemanticIndexer instance
    """
    from .embedder import Embedder
    from .vector_store import VectorStore

    enhancer = create_enhancer(tool=llm_tool, enabled=llm_enabled)
    embedder = Embedder()
    vector_store = VectorStore(vector_store_path)

    return EnhancedSemanticIndexer(enhancer, embedder, vector_store)
