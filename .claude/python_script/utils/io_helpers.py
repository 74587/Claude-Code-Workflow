#!/usr/bin/env python3
"""
I/O Helper Functions
Provides common file and directory operations with error handling.
"""

import os
import json
import yaml
import logging
from pathlib import Path
from typing import Any, Optional, Union, List, Dict
import shutil
import tempfile


class IOHelpers:
    """Collection of I/O helper methods."""

    @staticmethod
    def ensure_directory(path: Union[str, Path], mode: int = 0o755) -> bool:
        """Ensure directory exists, create if necessary."""
        try:
            dir_path = Path(path)
            dir_path.mkdir(parents=True, exist_ok=True, mode=mode)
            return True
        except (PermissionError, OSError) as e:
            logging.error(f"Failed to create directory '{path}': {e}")
            return False

    @staticmethod
    def safe_read_file(file_path: Union[str, Path], encoding: str = 'utf-8',
                      fallback_encoding: str = 'latin-1') -> Optional[str]:
        """Safely read file content with encoding fallback."""
        path = Path(file_path)
        if not path.exists():
            return None

        encodings = [encoding, fallback_encoding] if encoding != fallback_encoding else [encoding]

        for enc in encodings:
            try:
                with open(path, 'r', encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
            except (IOError, OSError) as e:
                logging.error(f"Failed to read file '{file_path}': {e}")
                return None

        logging.warning(f"Failed to decode file '{file_path}' with any encoding")
        return None

    @staticmethod
    def safe_write_file(file_path: Union[str, Path], content: str,
                       encoding: str = 'utf-8', backup: bool = False) -> bool:
        """Safely write content to file with optional backup."""
        path = Path(file_path)

        try:
            # Create backup if requested and file exists
            if backup and path.exists():
                backup_path = path.with_suffix(path.suffix + '.bak')
                shutil.copy2(path, backup_path)

            # Ensure parent directory exists
            if not IOHelpers.ensure_directory(path.parent):
                return False

            # Write to temporary file first, then move to final location
            with tempfile.NamedTemporaryFile(mode='w', encoding=encoding,
                                           dir=path.parent, delete=False) as tmp_file:
                tmp_file.write(content)
                tmp_path = Path(tmp_file.name)

            # Atomic move
            shutil.move(str(tmp_path), str(path))
            return True

        except (IOError, OSError) as e:
            logging.error(f"Failed to write file '{file_path}': {e}")
            return False

    @staticmethod
    def read_json(file_path: Union[str, Path], default: Any = None) -> Any:
        """Read JSON file with error handling."""
        content = IOHelpers.safe_read_file(file_path)
        if content is None:
            return default

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse JSON from '{file_path}': {e}")
            return default

    @staticmethod
    def write_json(file_path: Union[str, Path], data: Any,
                   indent: int = 2, backup: bool = False) -> bool:
        """Write data to JSON file."""
        try:
            content = json.dumps(data, indent=indent, ensure_ascii=False, default=str)
            return IOHelpers.safe_write_file(file_path, content, backup=backup)
        except (TypeError, ValueError) as e:
            logging.error(f"Failed to serialize data to JSON for '{file_path}': {e}")
            return False

    @staticmethod
    def read_yaml(file_path: Union[str, Path], default: Any = None) -> Any:
        """Read YAML file with error handling."""
        content = IOHelpers.safe_read_file(file_path)
        if content is None:
            return default

        try:
            return yaml.safe_load(content)
        except yaml.YAMLError as e:
            logging.error(f"Failed to parse YAML from '{file_path}': {e}")
            return default

    @staticmethod
    def write_yaml(file_path: Union[str, Path], data: Any, backup: bool = False) -> bool:
        """Write data to YAML file."""
        try:
            content = yaml.dump(data, default_flow_style=False, allow_unicode=True)
            return IOHelpers.safe_write_file(file_path, content, backup=backup)
        except yaml.YAMLError as e:
            logging.error(f"Failed to serialize data to YAML for '{file_path}': {e}")
            return False

    @staticmethod
    def find_files(directory: Union[str, Path], pattern: str = "*",
                  recursive: bool = True, max_depth: Optional[int] = None) -> List[Path]:
        """Find files matching pattern in directory."""
        dir_path = Path(directory)
        if not dir_path.exists() or not dir_path.is_dir():
            return []

        files = []
        try:
            if recursive:
                if max_depth is not None:
                    # Implement depth-limited search
                    def search_with_depth(path: Path, current_depth: int = 0):
                        if current_depth > max_depth:
                            return

                        for item in path.iterdir():
                            if item.is_file() and item.match(pattern):
                                files.append(item)
                            elif item.is_dir() and current_depth < max_depth:
                                search_with_depth(item, current_depth + 1)

                    search_with_depth(dir_path)
                else:
                    files = list(dir_path.rglob(pattern))
            else:
                files = list(dir_path.glob(pattern))

            return sorted(files)

        except (PermissionError, OSError) as e:
            logging.error(f"Failed to search files in '{directory}': {e}")
            return []

    @staticmethod
    def get_file_stats(file_path: Union[str, Path]) -> Optional[Dict[str, Any]]:
        """Get file statistics."""
        path = Path(file_path)
        if not path.exists():
            return None

        try:
            stat = path.stat()
            return {
                'size': stat.st_size,
                'modified_time': stat.st_mtime,
                'created_time': stat.st_ctime,
                'is_file': path.is_file(),
                'is_dir': path.is_dir(),
                'permissions': oct(stat.st_mode)[-3:],
                'extension': path.suffix.lower(),
                'name': path.name,
                'parent': str(path.parent)
            }
        except (OSError, PermissionError) as e:
            logging.error(f"Failed to get stats for '{file_path}': {e}")
            return None

    @staticmethod
    def copy_with_backup(source: Union[str, Path], dest: Union[str, Path]) -> bool:
        """Copy file with automatic backup if destination exists."""
        source_path = Path(source)
        dest_path = Path(dest)

        if not source_path.exists():
            logging.error(f"Source file '{source}' does not exist")
            return False

        try:
            # Create backup if destination exists
            if dest_path.exists():
                backup_path = dest_path.with_suffix(dest_path.suffix + '.bak')
                shutil.copy2(dest_path, backup_path)
                logging.info(f"Created backup: {backup_path}")

            # Ensure destination directory exists
            if not IOHelpers.ensure_directory(dest_path.parent):
                return False

            # Copy file
            shutil.copy2(source_path, dest_path)
            return True

        except (IOError, OSError) as e:
            logging.error(f"Failed to copy '{source}' to '{dest}': {e}")
            return False

    @staticmethod
    def move_with_backup(source: Union[str, Path], dest: Union[str, Path]) -> bool:
        """Move file with automatic backup if destination exists."""
        source_path = Path(source)
        dest_path = Path(dest)

        if not source_path.exists():
            logging.error(f"Source file '{source}' does not exist")
            return False

        try:
            # Create backup if destination exists
            if dest_path.exists():
                backup_path = dest_path.with_suffix(dest_path.suffix + '.bak')
                shutil.move(str(dest_path), str(backup_path))
                logging.info(f"Created backup: {backup_path}")

            # Ensure destination directory exists
            if not IOHelpers.ensure_directory(dest_path.parent):
                return False

            # Move file
            shutil.move(str(source_path), str(dest_path))
            return True

        except (IOError, OSError) as e:
            logging.error(f"Failed to move '{source}' to '{dest}': {e}")
            return False

    @staticmethod
    def clean_temp_files(directory: Union[str, Path], extensions: List[str] = None,
                        max_age_hours: int = 24) -> int:
        """Clean temporary files older than specified age."""
        if extensions is None:
            extensions = ['.tmp', '.temp', '.bak', '.swp', '.~']

        dir_path = Path(directory)
        if not dir_path.exists():
            return 0

        import time
        cutoff_time = time.time() - (max_age_hours * 3600)
        cleaned_count = 0

        try:
            for file_path in dir_path.rglob('*'):
                if file_path.is_file():
                    # Check extension
                    if file_path.suffix.lower() in extensions:
                        # Check age
                        if file_path.stat().st_mtime < cutoff_time:
                            try:
                                file_path.unlink()
                                cleaned_count += 1
                            except OSError:
                                continue

            logging.info(f"Cleaned {cleaned_count} temporary files from '{directory}'")
            return cleaned_count

        except (PermissionError, OSError) as e:
            logging.error(f"Failed to clean temp files in '{directory}': {e}")
            return 0

    @staticmethod
    def get_directory_size(directory: Union[str, Path]) -> int:
        """Get total size of directory in bytes."""
        dir_path = Path(directory)
        if not dir_path.exists() or not dir_path.is_dir():
            return 0

        total_size = 0
        try:
            for file_path in dir_path.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except (PermissionError, OSError):
            pass

        return total_size

    @staticmethod
    def make_executable(file_path: Union[str, Path]) -> bool:
        """Make file executable (Unix/Linux/Mac)."""
        if os.name == 'nt':  # Windows
            return True  # Windows doesn't use Unix permissions

        try:
            path = Path(file_path)
            current_mode = path.stat().st_mode
            path.chmod(current_mode | 0o111)  # Add execute permission
            return True
        except (OSError, PermissionError) as e:
            logging.error(f"Failed to make '{file_path}' executable: {e}")
            return False


# Convenience functions
def ensure_directory(path: Union[str, Path]) -> bool:
    """Ensure directory exists."""
    return IOHelpers.ensure_directory(path)


def safe_read_file(file_path: Union[str, Path]) -> Optional[str]:
    """Safely read file content."""
    return IOHelpers.safe_read_file(file_path)


def safe_write_file(file_path: Union[str, Path], content: str) -> bool:
    """Safely write content to file."""
    return IOHelpers.safe_write_file(file_path, content)


def read_json(file_path: Union[str, Path], default: Any = None) -> Any:
    """Read JSON file."""
    return IOHelpers.read_json(file_path, default)


def write_json(file_path: Union[str, Path], data: Any) -> bool:
    """Write data to JSON file."""
    return IOHelpers.write_json(file_path, data)


def read_yaml(file_path: Union[str, Path], default: Any = None) -> Any:
    """Read YAML file."""
    return IOHelpers.read_yaml(file_path, default)


def write_yaml(file_path: Union[str, Path], data: Any) -> bool:
    """Write data to YAML file."""
    return IOHelpers.write_yaml(file_path, data)


if __name__ == "__main__":
    # Test I/O operations
    test_dir = Path("test_io")

    # Test directory creation
    print(f"Create directory: {ensure_directory(test_dir)}")

    # Test file operations
    test_file = test_dir / "test.txt"
    content = "Hello, World!\nThis is a test file."

    print(f"Write file: {safe_write_file(test_file, content)}")
    print(f"Read file: {safe_read_file(test_file)}")

    # Test JSON operations
    json_file = test_dir / "test.json"
    json_data = {"name": "test", "numbers": [1, 2, 3], "nested": {"key": "value"}}

    print(f"Write JSON: {write_json(json_file, json_data)}")
    print(f"Read JSON: {read_json(json_file)}")

    # Test file stats
    stats = IOHelpers.get_file_stats(test_file)
    print(f"File stats: {stats}")

    # Cleanup
    shutil.rmtree(test_dir, ignore_errors=True)