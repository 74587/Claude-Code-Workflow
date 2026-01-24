"""Symbol and relationship extraction from source code."""
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser
except Exception:  # pragma: no cover - optional dependency / platform variance
    TreeSitterSymbolParser = None  # type: ignore[assignment]


class SymbolExtractor:
    """Extract symbols and relationships from source code using regex patterns."""

    # Pattern definitions for different languages
    PATTERNS = {
        'python': {
            'function': r'^(?:async\s+)?def\s+(\w+)\s*\(',
            'class': r'^class\s+(\w+)\s*[:\(]',
            'import': r'^(?:from\s+([\w.]+)\s+)?import\s+([\w.,\s]+)',
            'call': r'(?<![.\w])(\w+)\s*\(',
        },
        'typescript': {
            'function': r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[<\(]',
            'class': r'(?:export\s+)?class\s+(\w+)',
            'import': r"import\s+.*\s+from\s+['\"]([^'\"]+)['\"]",
            'call': r'(?<![.\w])(\w+)\s*[<\(]',
        },
        'javascript': {
            'function': r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(',
            'class': r'(?:export\s+)?class\s+(\w+)',
            'import': r"(?:import|require)\s*\(?['\"]([^'\"]+)['\"]",
            'call': r'(?<![.\w])(\w+)\s*\(',
        }
    }

    LANGUAGE_MAP = {
        '.py': 'python',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
    }

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_conn: Optional[sqlite3.Connection] = None

    def connect(self) -> None:
        """Connect to database and ensure schema exists."""
        self.db_conn = sqlite3.connect(str(self.db_path))
        self._ensure_tables()

    def __enter__(self) -> "SymbolExtractor":
        """Context manager entry: connect to database."""
        self.connect()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Context manager exit: close database connection."""
        self.close()

    def _ensure_tables(self) -> None:
        """Create symbols and relationships tables if they don't exist."""
        if not self.db_conn:
            return
        cursor = self.db_conn.cursor()

        # Create symbols table with qualified_name
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                qualified_name TEXT NOT NULL,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                file_path TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                UNIQUE(file_path, name, start_line)
            )
        ''')

        # Create relationships table with target_symbol_fqn
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS symbol_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_symbol_id INTEGER NOT NULL,
                target_symbol_fqn TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                line INTEGER,
                FOREIGN KEY (source_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
            )
        ''')

        # Create performance indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_rel_source ON symbol_relationships(source_symbol_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_rel_target ON symbol_relationships(target_symbol_fqn)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_rel_type ON symbol_relationships(relationship_type)')

        self.db_conn.commit()

    def extract_from_file(self, file_path: Path, content: str) -> Tuple[List[Dict], List[Dict]]:
        """Extract symbols and relationships from file content.

        Args:
            file_path: Path to the source file
            content: File content as string

        Returns:
            Tuple of (symbols, relationships) where:
            - symbols: List of symbol dicts with qualified_name, name, kind, file_path, start_line, end_line
            - relationships: List of relationship dicts with source_scope, target, type, file_path, line
        """
        ext = file_path.suffix.lower()
        lang = self.LANGUAGE_MAP.get(ext)

        if not lang or lang not in self.PATTERNS:
            return [], []

        patterns = self.PATTERNS[lang]
        symbols = []
        relationships: List[Dict] = []
        lines = content.split('\n')

        current_scope = None

        for line_num, line in enumerate(lines, 1):
            # Extract function/class definitions
            for kind in ['function', 'class']:
                if kind in patterns:
                    match = re.search(patterns[kind], line)
                    if match:
                        name = match.group(1)
                        qualified_name = f"{file_path.stem}.{name}"
                        symbols.append({
                            'qualified_name': qualified_name,
                            'name': name,
                            'kind': kind,
                            'file_path': str(file_path),
                            'start_line': line_num,
                            'end_line': line_num,  # Simplified - would need proper parsing for actual end
                        })
                        current_scope = name

        if TreeSitterSymbolParser is not None:
            try:
                ts_parser = TreeSitterSymbolParser(lang, file_path)
                if ts_parser.is_available():
                    indexed = ts_parser.parse(content, file_path)
                    if indexed is not None and indexed.relationships:
                        relationships = [
                            {
                                "source_scope": r.source_symbol,
                                "target": r.target_symbol,
                                "type": r.relationship_type.value,
                                "file_path": str(file_path),
                                "line": r.source_line,
                            }
                            for r in indexed.relationships
                        ]
            except Exception:
                relationships = []

        # Regex fallback for relationships (when tree-sitter is unavailable)
        if not relationships:
            current_scope = None
            for line_num, line in enumerate(lines, 1):
                for kind in ['function', 'class']:
                    if kind in patterns:
                        match = re.search(patterns[kind], line)
                        if match:
                            current_scope = match.group(1)

                # Extract imports
                if 'import' in patterns:
                    match = re.search(patterns['import'], line)
                    if match:
                        import_target = match.group(1) or match.group(2) if match.lastindex >= 2 else match.group(1)
                        if import_target and current_scope:
                            relationships.append({
                                'source_scope': current_scope,
                                'target': import_target.strip(),
                                'type': 'imports',
                                'file_path': str(file_path),
                                'line': line_num,
                            })

                # Extract function calls (simplified)
                if 'call' in patterns and current_scope:
                    for match in re.finditer(patterns['call'], line):
                        call_name = match.group(1)
                        # Skip common keywords and the current function
                        if call_name not in ['if', 'for', 'while', 'return', 'print', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', current_scope]:
                            relationships.append({
                                'source_scope': current_scope,
                                'target': call_name,
                                'type': 'calls',
                                'file_path': str(file_path),
                                'line': line_num,
                            })

        return symbols, relationships

    def save_symbols(self, symbols: List[Dict]) -> Dict[str, int]:
        """Save symbols to database and return name->id mapping.

        Args:
            symbols: List of symbol dicts with qualified_name, name, kind, file_path, start_line, end_line

        Returns:
            Dictionary mapping symbol name to database id
        """
        if not self.db_conn or not symbols:
            return {}

        cursor = self.db_conn.cursor()
        name_to_id = {}

        for sym in symbols:
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO symbols
                    (qualified_name, name, kind, file_path, start_line, end_line)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (sym['qualified_name'], sym['name'], sym['kind'],
                      sym['file_path'], sym['start_line'], sym['end_line']))

                # Get the id
                cursor.execute('''
                    SELECT id FROM symbols
                    WHERE file_path = ? AND name = ? AND start_line = ?
                ''', (sym['file_path'], sym['name'], sym['start_line']))

                row = cursor.fetchone()
                if row:
                    name_to_id[sym['name']] = row[0]
            except sqlite3.Error:
                continue

        self.db_conn.commit()
        return name_to_id

    def save_relationships(self, relationships: List[Dict], name_to_id: Dict[str, int]) -> None:
        """Save relationships to database.

        Args:
            relationships: List of relationship dicts with source_scope, target, type, file_path, line
            name_to_id: Dictionary mapping symbol names to database ids
        """
        if not self.db_conn or not relationships:
            return

        cursor = self.db_conn.cursor()

        for rel in relationships:
            source_id = name_to_id.get(rel['source_scope'])
            if source_id:
                try:
                    cursor.execute('''
                        INSERT INTO symbol_relationships
                        (source_symbol_id, target_symbol_fqn, relationship_type, file_path, line)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (source_id, rel['target'], rel['type'], rel['file_path'], rel['line']))
                except sqlite3.Error:
                    continue

        self.db_conn.commit()

    def close(self) -> None:
        """Close database connection."""
        if self.db_conn:
            self.db_conn.close()
            self.db_conn = None
