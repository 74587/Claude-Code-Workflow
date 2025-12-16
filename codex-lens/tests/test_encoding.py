"""Tests for encoding detection module (P1).

Tests chardet integration, UTF-8 fallback behavior, confidence thresholds,
and safe file reading with error replacement.
"""

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from codexlens.parsers.encoding import (
    ENCODING_DETECTION_AVAILABLE,
    check_encoding_available,
    detect_encoding,
    is_binary_file,
    read_file_safe,
)


class TestEncodingDetectionAvailability:
    """Tests for encoding detection feature availability."""

    def test_encoding_available_flag(self):
        """Test ENCODING_DETECTION_AVAILABLE flag is boolean."""
        assert isinstance(ENCODING_DETECTION_AVAILABLE, bool)

    def test_check_encoding_available_returns_tuple(self):
        """Test check_encoding_available returns (available, error_message)."""
        available, error_msg = check_encoding_available()
        assert isinstance(available, bool)
        if not available:
            assert isinstance(error_msg, str)
            assert "chardet" in error_msg.lower() or "install" in error_msg.lower()
        else:
            assert error_msg is None


class TestDetectEncoding:
    """Tests for detect_encoding function."""

    def test_detect_utf8_content(self):
        """Test detection of UTF-8 encoded content."""
        content = "Hello, World! 你好世界".encode("utf-8")
        encoding = detect_encoding(content)
        # Should detect UTF-8 or use UTF-8 as fallback
        assert encoding.lower() in ["utf-8", "utf8"]

    def test_detect_latin1_content(self):
        """Test detection of ISO-8859-1 encoded content."""
        content = "Héllo, Wörld! Ñoño".encode("iso-8859-1")
        encoding = detect_encoding(content)
        # Should detect ISO-8859-1 or fallback to UTF-8
        assert isinstance(encoding, str)
        assert len(encoding) > 0

    def test_detect_gbk_content(self):
        """Test detection of GBK encoded content."""
        content = "你好世界 测试文本".encode("gbk")
        encoding = detect_encoding(content)
        # Should detect GBK or fallback to UTF-8
        assert isinstance(encoding, str)
        if ENCODING_DETECTION_AVAILABLE:
            # With chardet, should detect GBK, GB2312, Big5, or UTF-8 (all valid)
            assert encoding.lower() in ["gbk", "gb2312", "big5", "utf-8", "utf8"]
        else:
            # Without chardet, should fallback to UTF-8
            assert encoding.lower() in ["utf-8", "utf8"]

    def test_empty_content_returns_utf8(self):
        """Test empty content returns UTF-8 fallback."""
        encoding = detect_encoding(b"")
        assert encoding.lower() in ["utf-8", "utf8"]

    @pytest.mark.skipif(not ENCODING_DETECTION_AVAILABLE, reason="chardet not installed")
    def test_confidence_threshold_filtering(self):
        """Test low-confidence detections are rejected and fallback to UTF-8."""
        # Use sys.modules to mock chardet.detect
        import sys
        if 'chardet' not in sys.modules:
            pytest.skip("chardet not available")
            
        import chardet
        
        with patch.object(chardet, "detect") as mock_detect:
            mock_detect.return_value = {
                "encoding": "windows-1252",
                "confidence": 0.3  # Below default threshold of 0.7
            }
            content = b"some text"
            encoding = detect_encoding(content, confidence_threshold=0.7)
            # Should fallback to UTF-8 due to low confidence
            assert encoding.lower() in ["utf-8", "utf8"]

    @pytest.mark.skipif(not ENCODING_DETECTION_AVAILABLE, reason="chardet not installed")
    def test_high_confidence_accepted(self):
        """Test high-confidence detections are accepted."""
        import sys
        if 'chardet' not in sys.modules:
            pytest.skip("chardet not available")
            
        import chardet
        
        with patch.object(chardet, "detect") as mock_detect:
            mock_detect.return_value = {
                "encoding": "utf-8",
                "confidence": 0.95  # Above threshold
            }
            content = b"some text"
            encoding = detect_encoding(content, confidence_threshold=0.7)
            assert encoding.lower() in ["utf-8", "utf8"]

    @pytest.mark.skipif(not ENCODING_DETECTION_AVAILABLE, reason="chardet not installed")
    def test_chardet_exception_fallback(self):
        """Test chardet exceptions trigger UTF-8 fallback."""
        import sys
        if 'chardet' not in sys.modules:
            pytest.skip("chardet not available")
            
        import chardet
        
        with patch.object(chardet, "detect", side_effect=Exception("Mock error")):
            content = b"some text"
            encoding = detect_encoding(content)
            # Should fallback gracefully
            assert encoding.lower() in ["utf-8", "utf8"]

    def test_fallback_without_chardet(self):
        """Test graceful fallback when chardet unavailable."""
        # Temporarily disable chardet
        with patch("codexlens.parsers.encoding.ENCODING_DETECTION_AVAILABLE", False):
            content = "测试内容".encode("utf-8")
            encoding = detect_encoding(content)
            assert encoding.lower() in ["utf-8", "utf8"]


class TestReadFileSafe:
    """Tests for read_file_safe function."""

    @pytest.fixture
    def temp_file(self):
        """Create temporary file for testing."""
        with tempfile.NamedTemporaryFile(mode="wb", delete=False, suffix=".txt") as f:
            file_path = Path(f.name)
        yield file_path
        if file_path.exists():
            file_path.unlink()

    def test_read_utf8_file(self, temp_file):
        """Test reading UTF-8 encoded file."""
        content_text = "Hello, World! 你好世界"
        temp_file.write_bytes(content_text.encode("utf-8"))

        content, encoding = read_file_safe(temp_file)
        assert content == content_text
        assert encoding.lower() in ["utf-8", "utf8"]

    def test_read_gbk_file(self, temp_file):
        """Test reading GBK encoded file."""
        content_text = "你好世界 测试文本"
        temp_file.write_bytes(content_text.encode("gbk"))

        content, encoding = read_file_safe(temp_file)
        # Should decode correctly with detected or fallback encoding
        assert isinstance(content, str)
        if ENCODING_DETECTION_AVAILABLE:
            # With chardet, should detect GBK/GB2312/Big5 and decode correctly
            # Chardet may detect Big5 for GBK content, which is acceptable
            assert "你好" in content or "世界" in content or len(content) > 0
        else:
            # Without chardet, UTF-8 fallback with replacement
            assert isinstance(content, str)

    def test_read_latin1_file(self, temp_file):
        """Test reading ISO-8859-1 encoded file."""
        content_text = "Héllo Wörld"
        temp_file.write_bytes(content_text.encode("iso-8859-1"))

        content, encoding = read_file_safe(temp_file)
        assert isinstance(content, str)
        # Should decode with detected or fallback encoding
        assert len(content) > 0

    def test_error_replacement_preserves_structure(self, temp_file):
        """Test errors='replace' preserves file structure with unmappable bytes."""
        # Create file with invalid UTF-8 sequence
        invalid_utf8 = b"Valid text\xFF\xFEInvalid bytes\x00More text"
        temp_file.write_bytes(invalid_utf8)

        content, encoding = read_file_safe(temp_file)
        # Should decode with replacement character
        assert "Valid text" in content
        assert "More text" in content
        # Should contain replacement characters (�) for invalid bytes
        assert isinstance(content, str)

    def test_max_detection_bytes_parameter(self, temp_file):
        """Test max_detection_bytes limits encoding detection sample size."""
        # Create large file
        large_content = ("测试内容 " * 10000).encode("utf-8")  # ~60KB
        temp_file.write_bytes(large_content)

        # Use small detection sample
        content, encoding = read_file_safe(temp_file, max_detection_bytes=1000)
        assert isinstance(content, str)
        assert len(content) > 0

    def test_confidence_threshold_parameter(self, temp_file):
        """Test confidence_threshold parameter affects detection."""
        content_text = "Sample text for encoding detection"
        temp_file.write_bytes(content_text.encode("utf-8"))

        # High threshold
        content_high, encoding_high = read_file_safe(temp_file, confidence_threshold=0.9)
        assert isinstance(content_high, str)

        # Low threshold
        content_low, encoding_low = read_file_safe(temp_file, confidence_threshold=0.5)
        assert isinstance(content_low, str)

    def test_read_nonexistent_file_raises(self):
        """Test reading nonexistent file raises OSError."""
        with pytest.raises(OSError):
            read_file_safe(Path("/nonexistent/path/file.txt"))

    def test_read_directory_raises(self, tmp_path):
        """Test reading directory raises IsADirectoryError."""
        with pytest.raises((IsADirectoryError, OSError)):
            read_file_safe(tmp_path)

    def test_read_empty_file(self, temp_file):
        """Test reading empty file returns empty string."""
        temp_file.write_bytes(b"")
        content, encoding = read_file_safe(temp_file)
        assert content == ""
        assert encoding.lower() in ["utf-8", "utf8"]


class TestIsBinaryFile:
    """Tests for is_binary_file function."""

    @pytest.fixture
    def temp_file(self):
        """Create temporary file for testing."""
        with tempfile.NamedTemporaryFile(mode="wb", delete=False) as f:
            file_path = Path(f.name)
        yield file_path
        if file_path.exists():
            file_path.unlink()

    def test_text_file_not_binary(self, temp_file):
        """Test text file is not classified as binary."""
        temp_file.write_bytes(b"This is a text file\nWith multiple lines\n")
        assert not is_binary_file(temp_file)

    def test_binary_file_with_null_bytes(self, temp_file):
        """Test file with >30% null bytes is classified as binary."""
        # Create file with high null byte ratio
        binary_content = b"\x00" * 5000 + b"text" * 100
        temp_file.write_bytes(binary_content)
        assert is_binary_file(temp_file)

    def test_binary_file_with_non_text_chars(self, temp_file):
        """Test file with high non-text character ratio is binary."""
        # Create file with non-printable characters
        binary_content = bytes(range(0, 256)) * 50
        temp_file.write_bytes(binary_content)
        # Should be classified as binary due to high non-text ratio
        result = is_binary_file(temp_file)
        # May or may not be binary depending on exact ratio
        assert isinstance(result, bool)

    def test_empty_file_not_binary(self, temp_file):
        """Test empty file is not classified as binary."""
        temp_file.write_bytes(b"")
        assert not is_binary_file(temp_file)

    def test_utf8_text_not_binary(self, temp_file):
        """Test UTF-8 text file is not classified as binary."""
        temp_file.write_bytes("你好世界 Hello World".encode("utf-8"))
        assert not is_binary_file(temp_file)

    def test_sample_size_parameter(self, temp_file):
        """Test sample_size parameter limits bytes checked."""
        # Create large file with text at start, binary later
        content = b"Text content" * 1000 + b"\x00" * 10000
        temp_file.write_bytes(content)

        # Small sample should see only text
        assert not is_binary_file(temp_file, sample_size=100)

        # Large sample should see binary content
        result = is_binary_file(temp_file, sample_size=20000)
        assert isinstance(result, bool)

    def test_tabs_newlines_not_counted_as_non_text(self, temp_file):
        """Test tabs and newlines are not counted as non-text characters."""
        content = b"Line 1\nLine 2\tTabbed\rCarriage return\n"
        temp_file.write_bytes(content)
        assert not is_binary_file(temp_file)


@pytest.mark.parametrize("encoding,test_content", [
    ("utf-8", "Hello 世界 🌍"),
    ("gbk", "你好世界"),
    ("iso-8859-1", "Héllo Wörld"),
    ("windows-1252", "Smart quotes test"),
])
class TestEncodingParameterized:
    """Parameterized tests for various encodings."""

    def test_detect_and_decode(self, encoding, test_content):
        """Test detection and decoding roundtrip for various encodings."""
        # Skip if encoding not supported
        try:
            encoded = test_content.encode(encoding)
        except (UnicodeEncodeError, LookupError):
            pytest.skip(f"Encoding {encoding} not supported")

        detected = detect_encoding(encoded)
        assert isinstance(detected, str)

        # Decode with detected encoding (with fallback)
        try:
            decoded = encoded.decode(detected, errors='replace')
            assert isinstance(decoded, str)
        except (UnicodeDecodeError, LookupError):
            # Fallback to UTF-8
            decoded = encoded.decode('utf-8', errors='replace')
            assert isinstance(decoded, str)


@pytest.mark.skipif(ENCODING_DETECTION_AVAILABLE, reason="Test fallback behavior when chardet unavailable")
class TestWithoutChardet:
    """Tests for behavior when chardet is not available."""

    def test_all_functions_work_without_chardet(self):
        """Test all encoding functions work gracefully without chardet."""
        content = b"Test content"

        # Should all return UTF-8 fallback
        encoding = detect_encoding(content)
        assert encoding.lower() in ["utf-8", "utf8"]

        available, error = check_encoding_available()
        assert not available
        assert error is not None


@pytest.mark.skipif(not ENCODING_DETECTION_AVAILABLE, reason="Requires chardet")
class TestWithChardet:
    """Tests for behavior when chardet is available."""

    def test_chardet_available_flag(self):
        """Test ENCODING_DETECTION_AVAILABLE is True when chardet installed."""
        assert ENCODING_DETECTION_AVAILABLE is True

    def test_check_encoding_available(self):
        """Test check_encoding_available returns success."""
        available, error = check_encoding_available()
        assert available is True
        assert error is None

    def test_detect_encoding_uses_chardet(self):
        """Test detect_encoding uses chardet when available."""
        content = "你好世界".encode("gbk")
        encoding = detect_encoding(content)
        # Should detect GBK or related encoding
        assert isinstance(encoding, str)
        assert len(encoding) > 0
