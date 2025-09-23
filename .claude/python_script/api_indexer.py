#!/usr/bin/env python3
"""
API Documentation Indexer
Parses Markdown documentation to create a searchable index of classes and methods.
"""

import os
import re
import json
import logging
from pathlib import Path
from typing import Dict, Any

from core.file_indexer import FileIndexer

class ApiIndexer:
    def __init__(self, config: Dict, root_path: str = "."):
        self.config = config
        self.root_path = Path(root_path).resolve()
        self.file_indexer = FileIndexer(config, root_path)
        self.api_index_file = self.file_indexer.cache_dir / "api_index.json"
        self.logger = logging.getLogger(__name__)

    def build_index(self):
        """Builds the API index from Markdown files."""
        self.logger.info("Building API index...")
        file_index = self.file_indexer.load_index()
        if not file_index:
            self.logger.info("File index not found, building it first.")
            self.file_indexer.build_index()
            file_index = self.file_indexer.load_index()

        api_index = {}
        for file_info in file_index.values():
            if file_info.extension == ".md":
                self.logger.debug(f"Parsing {file_info.path}")
                try:
                    with open(file_info.path, "r", encoding="utf-8") as f:
                        content = f.read()
                        self._parse_markdown(content, file_info.relative_path, api_index)
                except Exception as e:
                    self.logger.error(f"Error parsing {file_info.path}: {e}")

        self._save_index(api_index)
        self.logger.info(f"API index built with {len(api_index)} classes.")

    def _parse_markdown(self, content: str, file_path: str, api_index: Dict):
        """Parses a single Markdown file for class and method info."""
        class_name_match = re.search(r"^#\s+([A-Za-z0-9_]+)", content)
        if not class_name_match:
            return

        class_name = class_name_match.group(1)
        api_index[class_name] = {
            "file_path": file_path,
            "description": "",
            "methods": {}
        }

        # Simple description extraction
        desc_match = re.search(r"\*\*Description:\*\*\s*(.+)", content)
        if desc_match:
            api_index[class_name]["description"] = desc_match.group(1).strip()

        # Method extraction
        method_sections = re.split(r"###\s+", content)[1:]
        for i, section in enumerate(method_sections):
            method_signature_match = re.search(r"`(.+?)`", section)
            if not method_signature_match:
                continue
            
            signature = method_signature_match.group(1)
            method_name_match = re.search(r"([A-Za-z0-9_]+)\(“, signature)
            if not method_name_match:
                continue
            
            method_name = method_name_match.group(1)
            
            method_description = ""
            method_desc_match = re.search(r"\*\*Description:\*\*\s*(.+)", section)
            if method_desc_match:
                method_description = method_desc_match.group(1).strip()

            # A simple way to get a line number approximation
            line_number = content.count("\n", 0, content.find(f"### `{signature}`")) + 1

            api_index[class_name]["methods"Показать больше] = {
                "signature": signature,
                "description": method_description,
                "line_number": line_number
            }

    def _save_index(self, api_index: Dict):
        """Saves the API index to a file."""
        try:
            with open(self.api_index_file, "w", encoding="utf-8") as f:
                json.dump(api_index, f, indent=2)
        except IOError as e:
            self.logger.error(f"Could not save API index: {e}")

    def search(self, class_name: str, method_name: str = None) -> Any:
        """Searches the API index for a class or method."""
        if not self.api_index_file.exists():
            self.build_index()

        with open(self.api_index_file, "r", encoding="utf-8") as f:
            api_index = json.load(f)

        if class_name not in api_index:
            return None

        if method_name:
            return api_index[class_name]["methods"].get(method_name)
        else:
            return api_index[class_name]

if __name__ == "__main__":
    from core.config import get_config
    import argparse

    logging.basicConfig(level=logging.INFO)
    
    parser = argparse.ArgumentParser(description="API Documentation Indexer.")
    parser.add_argument("--build", action="store_true", help="Build the API index.")
    parser.add_argument("--search_class", help="Search for a class.")
    parser.add_argument("--search_method", help="Search for a method within a class (requires --search_class).")
    
    args = parser.parse_args()

    config = get_config()
    api_indexer = ApiIndexer(config.to_dict())

    if args.build:
        api_indexer.build_index()
    
    if args.search_class:
        result = api_indexer.search(args.search_class, args.search_method)
        if result:
            print(json.dumps(result, indent=2))
        else:
            print("Not found.")
