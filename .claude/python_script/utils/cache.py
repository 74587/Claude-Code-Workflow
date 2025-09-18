#!/usr/bin/env python3
"""
Cache Management Utility
Provides unified caching functionality for the analyzer system.
"""

import os
import json
import time
import hashlib
import pickle
import logging
from pathlib import Path
from typing import Any, Optional, Dict, Union
from dataclasses import dataclass, asdict


@dataclass
class CacheEntry:
    """Cache entry with metadata."""
    value: Any
    timestamp: float
    ttl: Optional[float] = None
    key_hash: Optional[str] = None

    def is_expired(self) -> bool:
        """Check if cache entry is expired."""
        if self.ttl is None:
            return False
        return time.time() - self.timestamp > self.ttl

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'value': self.value,
            'timestamp': self.timestamp,
            'ttl': self.ttl,
            'key_hash': self.key_hash
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'CacheEntry':
        """Create from dictionary."""
        return cls(**data)


class CacheManager:
    """Unified cache manager with multiple storage backends."""

    def __init__(self, cache_dir: str = "cache", default_ttl: int = 3600):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.default_ttl = default_ttl
        self.logger = logging.getLogger(__name__)

        # In-memory cache for fast access
        self._memory_cache: Dict[str, CacheEntry] = {}

        # Cache subdirectories
        self.json_cache_dir = self.cache_dir / "json"
        self.pickle_cache_dir = self.cache_dir / "pickle"
        self.temp_cache_dir = self.cache_dir / "temp"

        for cache_subdir in [self.json_cache_dir, self.pickle_cache_dir, self.temp_cache_dir]:
            cache_subdir.mkdir(exist_ok=True)

    def _generate_key_hash(self, key: str) -> str:
        """Generate a hash for the cache key."""
        return hashlib.md5(key.encode('utf-8')).hexdigest()

    def _get_cache_path(self, key: str, cache_type: str = "json") -> Path:
        """Get cache file path for a key."""
        key_hash = self._generate_key_hash(key)

        if cache_type == "json":
            return self.json_cache_dir / f"{key_hash}.json"
        elif cache_type == "pickle":
            return self.pickle_cache_dir / f"{key_hash}.pkl"
        elif cache_type == "temp":
            return self.temp_cache_dir / f"{key_hash}.tmp"
        else:
            raise ValueError(f"Unsupported cache type: {cache_type}")

    def set(self, key: str, value: Any, ttl: Optional[int] = None,
            storage: str = "memory") -> bool:
        """Set a cache value."""
        if ttl is None:
            ttl = self.default_ttl

        entry = CacheEntry(
            value=value,
            timestamp=time.time(),
            ttl=ttl,
            key_hash=self._generate_key_hash(key)
        )

        try:
            if storage == "memory":
                self._memory_cache[key] = entry
                return True

            elif storage == "json":
                cache_path = self._get_cache_path(key, "json")
                with open(cache_path, 'w', encoding='utf-8') as f:
                    json.dump(entry.to_dict(), f, indent=2, default=str)
                return True

            elif storage == "pickle":
                cache_path = self._get_cache_path(key, "pickle")
                with open(cache_path, 'wb') as f:
                    pickle.dump(entry, f)
                return True

            else:
                self.logger.warning(f"Unsupported storage type: {storage}")
                return False

        except Exception as e:
            self.logger.error(f"Failed to set cache for key '{key}': {e}")
            return False

    def get(self, key: str, storage: str = "memory",
            default: Any = None) -> Any:
        """Get a cache value."""
        try:
            entry = None

            if storage == "memory":
                entry = self._memory_cache.get(key)

            elif storage == "json":
                cache_path = self._get_cache_path(key, "json")
                if cache_path.exists():
                    with open(cache_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        entry = CacheEntry.from_dict(data)

            elif storage == "pickle":
                cache_path = self._get_cache_path(key, "pickle")
                if cache_path.exists():
                    with open(cache_path, 'rb') as f:
                        entry = pickle.load(f)

            else:
                self.logger.warning(f"Unsupported storage type: {storage}")
                return default

            if entry is None:
                return default

            # Check if entry is expired
            if entry.is_expired():
                self.delete(key, storage)
                return default

            return entry.value

        except Exception as e:
            self.logger.error(f"Failed to get cache for key '{key}': {e}")
            return default

    def delete(self, key: str, storage: str = "memory") -> bool:
        """Delete a cache entry."""
        try:
            if storage == "memory":
                if key in self._memory_cache:
                    del self._memory_cache[key]
                return True

            elif storage in ["json", "pickle", "temp"]:
                cache_path = self._get_cache_path(key, storage)
                if cache_path.exists():
                    cache_path.unlink()
                return True

            else:
                self.logger.warning(f"Unsupported storage type: {storage}")
                return False

        except Exception as e:
            self.logger.error(f"Failed to delete cache for key '{key}': {e}")
            return False

    def exists(self, key: str, storage: str = "memory") -> bool:
        """Check if a cache entry exists and is not expired."""
        return self.get(key, storage) is not None

    def clear(self, storage: Optional[str] = None) -> bool:
        """Clear cache entries."""
        try:
            if storage is None or storage == "memory":
                self._memory_cache.clear()

            if storage is None or storage == "json":
                for cache_file in self.json_cache_dir.glob("*.json"):
                    cache_file.unlink()

            if storage is None or storage == "pickle":
                for cache_file in self.pickle_cache_dir.glob("*.pkl"):
                    cache_file.unlink()

            if storage is None or storage == "temp":
                for cache_file in self.temp_cache_dir.glob("*.tmp"):
                    cache_file.unlink()

            return True

        except Exception as e:
            self.logger.error(f"Failed to clear cache: {e}")
            return False

    def cleanup_expired(self) -> int:
        """Clean up expired cache entries."""
        cleaned_count = 0

        try:
            # Clean memory cache
            expired_keys = []
            for key, entry in self._memory_cache.items():
                if entry.is_expired():
                    expired_keys.append(key)

            for key in expired_keys:
                del self._memory_cache[key]
                cleaned_count += 1

            # Clean file caches
            for cache_type in ["json", "pickle"]:
                cache_dir = self.json_cache_dir if cache_type == "json" else self.pickle_cache_dir
                extension = f".{cache_type}" if cache_type == "json" else ".pkl"

                for cache_file in cache_dir.glob(f"*{extension}"):
                    try:
                        if cache_type == "json":
                            with open(cache_file, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                entry = CacheEntry.from_dict(data)
                        else:
                            with open(cache_file, 'rb') as f:
                                entry = pickle.load(f)

                        if entry.is_expired():
                            cache_file.unlink()
                            cleaned_count += 1

                    except Exception:
                        # If we can't read the cache file, delete it
                        cache_file.unlink()
                        cleaned_count += 1

            self.logger.info(f"Cleaned up {cleaned_count} expired cache entries")
            return cleaned_count

        except Exception as e:
            self.logger.error(f"Failed to cleanup expired cache entries: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = {
            'memory_entries': len(self._memory_cache),
            'json_files': len(list(self.json_cache_dir.glob("*.json"))),
            'pickle_files': len(list(self.pickle_cache_dir.glob("*.pkl"))),
            'temp_files': len(list(self.temp_cache_dir.glob("*.tmp"))),
            'cache_dir_size': 0
        }

        # Calculate total cache directory size
        try:
            for cache_file in self.cache_dir.rglob("*"):
                if cache_file.is_file():
                    stats['cache_dir_size'] += cache_file.stat().st_size
        except Exception:
            pass

        return stats

    def set_file_cache(self, key: str, file_path: Union[str, Path],
                      ttl: Optional[int] = None) -> bool:
        """Cache a file by copying it to the cache directory."""
        try:
            source_path = Path(file_path)
            if not source_path.exists():
                return False

            cache_path = self.temp_cache_dir / f"{self._generate_key_hash(key)}.cached"

            # Copy file to cache
            import shutil
            shutil.copy2(source_path, cache_path)

            # Store metadata
            metadata = {
                'original_path': str(source_path),
                'cached_path': str(cache_path),
                'size': source_path.stat().st_size,
                'timestamp': time.time(),
                'ttl': ttl or self.default_ttl
            }

            return self.set(f"{key}_metadata", metadata, ttl, "json")

        except Exception as e:
            self.logger.error(f"Failed to cache file '{file_path}': {e}")
            return False

    def get_file_cache(self, key: str) -> Optional[Path]:
        """Get cached file path."""
        metadata = self.get(f"{key}_metadata", "json")
        if metadata is None:
            return None

        cached_path = Path(metadata['cached_path'])
        if not cached_path.exists():
            # Cache file missing, clean up metadata
            self.delete(f"{key}_metadata", "json")
            return None

        return cached_path


# Global cache manager instance
_global_cache = None


def get_cache_manager(cache_dir: str = "cache", default_ttl: int = 3600) -> CacheManager:
    """Get global cache manager instance."""
    global _global_cache
    if _global_cache is None:
        _global_cache = CacheManager(cache_dir, default_ttl)
    return _global_cache


if __name__ == "__main__":
    # Test cache functionality
    cache = CacheManager("test_cache")

    # Test memory cache
    cache.set("test_key", {"data": "test_value"}, ttl=60)
    print(f"Memory cache: {cache.get('test_key')}")

    # Test JSON cache
    cache.set("json_key", {"complex": {"data": [1, 2, 3]}}, ttl=60, storage="json")
    print(f"JSON cache: {cache.get('json_key', storage='json')}")

    # Test stats
    print(f"Cache stats: {cache.get_stats()}")

    # Clean up
    cache.clear()