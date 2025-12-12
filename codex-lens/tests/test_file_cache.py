"""Tests for CodexLens file cache."""

import tempfile
from pathlib import Path

import pytest

from codexlens.storage.file_cache import FileCache


class TestFileCache:
    """Tests for FileCache class."""

    def test_create_cache(self):
        """Test creating a FileCache instance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            assert cache.cache_path == Path(tmpdir)

    def test_store_and_load_mtime(self):
        """Test storing and loading mtime."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            file_path = Path("/test/file.py")
            mtime = 1234567890.123

            cache.store_mtime(file_path, mtime)
            loaded = cache.load_mtime(file_path)

            assert loaded == mtime

    def test_load_nonexistent_mtime(self):
        """Test loading mtime for uncached file returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            file_path = Path("/nonexistent/file.py")

            loaded = cache.load_mtime(file_path)

            assert loaded is None

    def test_update_mtime(self):
        """Test updating existing mtime."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            file_path = Path("/test/file.py")

            cache.store_mtime(file_path, 1000.0)
            cache.store_mtime(file_path, 2000.0)
            loaded = cache.load_mtime(file_path)

            assert loaded == 2000.0

    def test_multiple_files(self):
        """Test caching multiple files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))

            files = {
                Path("/test/a.py"): 1000.0,
                Path("/test/b.py"): 2000.0,
                Path("/test/c.py"): 3000.0,
            }

            for path, mtime in files.items():
                cache.store_mtime(path, mtime)

            for path, expected_mtime in files.items():
                loaded = cache.load_mtime(path)
                assert loaded == expected_mtime


class TestFileCacheKeyGeneration:
    """Tests for cache key generation."""

    def test_key_for_simple_path(self):
        """Test key generation for simple path."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            key = cache._key_for(Path("test.py"))
            assert key.endswith(".mtime")

    def test_key_for_path_with_slashes(self):
        """Test key generation for path with slashes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            key = cache._key_for(Path("/path/to/file.py"))
            assert "/" not in key
            assert key.endswith(".mtime")

    def test_key_for_windows_path(self):
        """Test key generation for Windows-style path."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            key = cache._key_for(Path("C:\\Users\\test\\file.py"))
            assert "\\" not in key
            assert ":" not in key
            assert key.endswith(".mtime")

    def test_different_paths_different_keys(self):
        """Test that different paths produce different keys."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            key1 = cache._key_for(Path("/test/a.py"))
            key2 = cache._key_for(Path("/test/b.py"))
            assert key1 != key2


class TestFileCacheDirectoryCreation:
    """Tests for cache directory creation."""

    def test_creates_cache_directory(self):
        """Test that cache directory is created when storing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "new_cache_dir"
            cache = FileCache(cache_path=cache_path)

            assert not cache_path.exists()

            cache.store_mtime(Path("/test.py"), 1000.0)

            assert cache_path.exists()

    def test_nested_cache_directory(self):
        """Test creating nested cache directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir) / "a" / "b" / "c" / "cache"
            cache = FileCache(cache_path=cache_path)

            cache.store_mtime(Path("/test.py"), 1000.0)

            assert cache_path.exists()


class TestFileCacheEdgeCases:
    """Edge case tests for FileCache."""

    def test_mtime_precision(self):
        """Test that mtime precision is preserved."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            precise_mtime = 1234567890.123456789

            cache.store_mtime(Path("/test.py"), precise_mtime)
            loaded = cache.load_mtime(Path("/test.py"))

            # Should preserve reasonable precision
            assert abs(loaded - precise_mtime) < 0.0001

    def test_zero_mtime(self):
        """Test storing zero mtime."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))

            cache.store_mtime(Path("/test.py"), 0.0)
            loaded = cache.load_mtime(Path("/test.py"))

            assert loaded == 0.0

    def test_negative_mtime(self):
        """Test storing negative mtime (edge case)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))

            cache.store_mtime(Path("/test.py"), -1000.0)
            loaded = cache.load_mtime(Path("/test.py"))

            assert loaded == -1000.0

    def test_large_mtime(self):
        """Test storing large mtime value."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            large_mtime = 9999999999.999

            cache.store_mtime(Path("/test.py"), large_mtime)
            loaded = cache.load_mtime(Path("/test.py"))

            assert loaded == large_mtime

    def test_unicode_path(self):
        """Test path with unicode characters."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            unicode_path = Path("/测试/文件.py")

            cache.store_mtime(unicode_path, 1000.0)
            loaded = cache.load_mtime(unicode_path)

            assert loaded == 1000.0

    def test_load_corrupted_cache_file(self):
        """Test loading corrupted cache file returns None."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache = FileCache(cache_path=Path(tmpdir))
            file_path = Path("/test.py")

            # Create a corrupted cache file
            cache.store_mtime(file_path, 1000.0)
            key = cache._key_for(file_path)
            (Path(tmpdir) / key).write_text("not a number")

            # Should return None for corrupted data
            loaded = cache.load_mtime(file_path)
            assert loaded is None


class TestFileCachePersistence:
    """Tests for cache persistence across instances."""

    def test_cache_persists_across_instances(self):
        """Test that cache data persists when creating new instance."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = Path(tmpdir)

            # Store with first instance
            cache1 = FileCache(cache_path=cache_path)
            cache1.store_mtime(Path("/test.py"), 1234.0)

            # Load with second instance
            cache2 = FileCache(cache_path=cache_path)
            loaded = cache2.load_mtime(Path("/test.py"))

            assert loaded == 1234.0
