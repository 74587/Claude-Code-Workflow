# codex-lens/src/codexlens/search/enrichment.py
"""Relationship enrichment for search results."""
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional


class RelationshipEnricher:
    """Enriches search results with code graph relationships."""

    def __init__(self, index_path: Path):
        """Initialize with path to index database.

        Args:
            index_path: Path to _index.db SQLite database
        """
        self.index_path = index_path
        self.db_conn: Optional[sqlite3.Connection] = None
        self._connect()

    def _connect(self) -> None:
        """Establish read-only database connection."""
        if self.index_path.exists():
            self.db_conn = sqlite3.connect(
                f"file:{self.index_path}?mode=ro",
                uri=True,
                check_same_thread=False
            )
            self.db_conn.row_factory = sqlite3.Row

    def enrich(self, results: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
        """Add relationship data to search results.

        Args:
            results: List of search result dictionaries
            limit: Maximum number of results to enrich

        Returns:
            Results with relationships field added
        """
        if not self.db_conn:
            return results

        for result in results[:limit]:
            file_path = result.get('file') or result.get('path')
            symbol_name = result.get('symbol')
            result['relationships'] = self._find_relationships(file_path, symbol_name)
        return results

    def _find_relationships(self, file_path: Optional[str], symbol_name: Optional[str]) -> List[Dict[str, Any]]:
        """Query relationships for a symbol.

        Args:
            file_path: Path to file containing the symbol
            symbol_name: Name of the symbol

        Returns:
            List of relationship dictionaries with type, direction, target/source, file, line
        """
        if not self.db_conn or not symbol_name:
            return []

        relationships = []
        cursor = self.db_conn.cursor()

        try:
            # Find symbol ID(s) by name and optionally file
            if file_path:
                cursor.execute(
                    'SELECT id FROM symbols WHERE name = ? AND file_path = ?',
                    (symbol_name, file_path)
                )
            else:
                cursor.execute('SELECT id FROM symbols WHERE name = ?', (symbol_name,))

            symbol_ids = [row[0] for row in cursor.fetchall()]

            if not symbol_ids:
                return []

            # Query outgoing relationships (symbol is source)
            placeholders = ','.join('?' * len(symbol_ids))
            cursor.execute(f'''
                SELECT sr.relationship_type, sr.target_symbol_fqn, sr.file_path, sr.line
                FROM symbol_relationships sr
                WHERE sr.source_symbol_id IN ({placeholders})
            ''', symbol_ids)

            for row in cursor.fetchall():
                relationships.append({
                    'type': row[0],
                    'direction': 'outgoing',
                    'target': row[1],
                    'file': row[2],
                    'line': row[3],
                })

            # Query incoming relationships (symbol is target)
            # Match against symbol name or qualified name patterns
            cursor.execute('''
                SELECT sr.relationship_type, s.name AS source_name, sr.file_path, sr.line
                FROM symbol_relationships sr
                JOIN symbols s ON sr.source_symbol_id = s.id
                WHERE sr.target_symbol_fqn = ? OR sr.target_symbol_fqn LIKE ?
            ''', (symbol_name, f'%.{symbol_name}'))

            for row in cursor.fetchall():
                rel_type = row[0]
                # Convert to incoming type
                incoming_type = self._to_incoming_type(rel_type)
                relationships.append({
                    'type': incoming_type,
                    'direction': 'incoming',
                    'source': row[1],
                    'file': row[2],
                    'line': row[3],
                })

        except sqlite3.Error:
            return []

        return relationships

    def _to_incoming_type(self, outgoing_type: str) -> str:
        """Convert outgoing relationship type to incoming type.

        Args:
            outgoing_type: The outgoing relationship type (e.g., 'calls', 'imports')

        Returns:
            Corresponding incoming type (e.g., 'called_by', 'imported_by')
        """
        type_map = {
            'calls': 'called_by',
            'imports': 'imported_by',
            'extends': 'extended_by',
        }
        return type_map.get(outgoing_type, f'{outgoing_type}_by')

    def close(self) -> None:
        """Close database connection."""
        if self.db_conn:
            self.db_conn.close()
            self.db_conn = None

    def __enter__(self) -> 'RelationshipEnricher':
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
