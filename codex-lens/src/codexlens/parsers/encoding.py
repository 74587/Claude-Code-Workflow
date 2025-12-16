"""Optional encoding detection module for CodexLens.

Provides automatic encoding detection with graceful fallback to UTF-8.
Install with: pip install codexlens[encoding]
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple, Optional

log = logging.getLogger(__name__)

# Feature flag for encoding detection availability
ENCODING_DETECTION_AVAILABLE = False
_import_error: Optional[str] = None


def _detect_chardet_backend() -> Tuple[bool, Optional[str]]:
    """Detect if chardet or charset-normalizer is available."""
    try:
        import chardet
        return True, None
    except ImportError:
        pass

    try:
        from charset_normalizer import from_bytes
        return True, None
    except ImportError:
        pass

    return False, "chardet not available. Install with: pip install codexlens[encoding]"


# Initialize on module load
ENCODING_DETECTION_AVAILABLE, _import_error = _detect_chardet_backend()


def check_encoding_available() -> Tuple[bool, Optional[str]]:
    """Check if encoding detection dependencies are available.

    Returns:
        Tuple of (available, error_message)
    """
    return ENCODING_DETECTION_AVAILABLE, _import_error


def detect_encoding(content_bytes: bytes, confidence_threshold: float = 0.7) -> str:
    """Detect encoding from file content bytes.

    Uses chardet or charset-normalizer with configurable confidence threshold.
    Falls back to UTF-8 if confidence is too low or detection unavailable.

    Args:
        content_bytes: Raw file content as bytes
        confidence_threshold: Minimum confidence (0.0-1.0) to accept detection

    Returns:
        Detected encoding name (e.g., 'utf-8', 'iso-8859-1', 'gbk')
        Returns 'utf-8' as fallback if detection fails or confidence too low
    """
    if not ENCODING_DETECTION_AVAILABLE:
        log.debug("Encoding detection not available, using UTF-8 fallback")
        return "utf-8"

    if not content_bytes:
        return "utf-8"

    try:
        # Try chardet first
        try:
            import chardet
            result = chardet.detect(content_bytes)
            encoding = result.get("encoding")
            confidence = result.get("confidence", 0.0)

            if encoding and confidence >= confidence_threshold:
                log.debug(f"Detected encoding: {encoding} (confidence: {confidence:.2f})")
                # Normalize encoding name: replace underscores with hyphens
                return encoding.lower().replace('_', '-')
            else:
                log.debug(
                    f"Low confidence encoding detection: {encoding} "
                    f"(confidence: {confidence:.2f}), using UTF-8 fallback"
                )
                return "utf-8"
        except ImportError:
            pass

        # Fallback to charset-normalizer
        try:
            from charset_normalizer import from_bytes
            results = from_bytes(content_bytes)
            if results:
                best = results.best()
                if best and best.encoding:
                    log.debug(f"Detected encoding via charset-normalizer: {best.encoding}")
                    # Normalize encoding name: replace underscores with hyphens
                    return best.encoding.lower().replace('_', '-')
        except ImportError:
            pass

    except Exception as e:
        log.warning(f"Encoding detection failed: {e}, using UTF-8 fallback")

    return "utf-8"


def read_file_safe(
    path: Path | str,
    confidence_threshold: float = 0.7,
    max_detection_bytes: int = 100_000
) -> Tuple[str, str]:
    """Read file with automatic encoding detection and safe decoding.

    Reads file bytes, detects encoding, and decodes with error replacement
    to preserve file structure even with encoding issues.

    Args:
        path: Path to file to read
        confidence_threshold: Minimum confidence for encoding detection
        max_detection_bytes: Maximum bytes to use for encoding detection (default 100KB)

    Returns:
        Tuple of (content, detected_encoding)
        - content: Decoded file content (with � for unmappable bytes)
        - detected_encoding: Detected encoding name

    Raises:
        OSError: If file cannot be read
        IsADirectoryError: If path is a directory
    """
    file_path = Path(path) if isinstance(path, str) else path

    # Read file bytes
    try:
        content_bytes = file_path.read_bytes()
    except Exception as e:
        log.error(f"Failed to read file {file_path}: {e}")
        raise

    # Detect encoding from first N bytes for performance
    detection_sample = content_bytes[:max_detection_bytes] if len(content_bytes) > max_detection_bytes else content_bytes
    encoding = detect_encoding(detection_sample, confidence_threshold)

    # Decode with error replacement to preserve structure
    try:
        content = content_bytes.decode(encoding, errors='replace')
        log.debug(f"Successfully decoded {file_path} using {encoding}")
        return content, encoding
    except Exception as e:
        # Final fallback to UTF-8 with replacement
        log.warning(f"Failed to decode {file_path} with {encoding}, using UTF-8: {e}")
        content = content_bytes.decode('utf-8', errors='replace')
        return content, 'utf-8'


def is_binary_file(path: Path | str, sample_size: int = 8192) -> bool:
    """Check if file is likely binary by sampling first bytes.

    Uses heuristic: if >30% of sample bytes are null or non-text, consider binary.

    Args:
        path: Path to file to check
        sample_size: Number of bytes to sample (default 8KB)

    Returns:
        True if file appears to be binary, False otherwise
    """
    file_path = Path(path) if isinstance(path, str) else path

    try:
        with file_path.open('rb') as f:
            sample = f.read(sample_size)

        if not sample:
            return False

        # Count null bytes and non-printable characters
        null_count = sample.count(b'\x00')
        non_text_count = sum(1 for byte in sample if byte < 0x20 and byte not in (0x09, 0x0a, 0x0d))

        # If >30% null bytes or >50% non-text, consider binary
        null_ratio = null_count / len(sample)
        non_text_ratio = non_text_count / len(sample)

        return null_ratio > 0.3 or non_text_ratio > 0.5

    except Exception as e:
        log.debug(f"Binary check failed for {file_path}: {e}, assuming text")
        return False


__all__ = [
    "ENCODING_DETECTION_AVAILABLE",
    "check_encoding_available",
    "detect_encoding",
    "read_file_safe",
    "is_binary_file",
]
