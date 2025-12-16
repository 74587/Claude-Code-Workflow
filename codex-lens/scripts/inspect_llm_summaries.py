#!/usr/bin/env python3
"""Inspect LLM-generated summaries in semantic_chunks table."""

import sqlite3
import sys
from pathlib import Path

def inspect_summaries(db_path: Path):
    """Show LLM-generated summaries from database."""
    if not db_path.exists():
        print(f"Error: Database not found: {db_path}")
        return

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row

        # Check if semantic_chunks table exists
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
        )
        if not cursor.fetchone():
            print("No semantic_chunks table found")
            return

        # Get all chunks with metadata
        cursor = conn.execute("""
            SELECT file_path, chunk_index, content,
                   json_extract(metadata, '$.llm_summary') as summary,
                   json_extract(metadata, '$.llm_keywords') as keywords,
                   json_extract(metadata, '$.llm_purpose') as purpose,
                   json_extract(metadata, '$.strategy') as strategy
            FROM semantic_chunks
            ORDER BY file_path, chunk_index
        """)

        chunks = cursor.fetchall()

        if not chunks:
            print("No chunks found in database")
            return

        print("="*80)
        print("LLM-GENERATED SUMMARIES INSPECTION")
        print("="*80)

        current_file = None
        for chunk in chunks:
            file_path = chunk['file_path']

            if file_path != current_file:
                print(f"\n{'='*80}")
                print(f"FILE: {file_path}")
                print(f"{'='*80}")
                current_file = file_path

            print(f"\n[Chunk {chunk['chunk_index']}]")
            print(f"Strategy: {chunk['strategy']}")

            if chunk['summary']:
                print(f"\nLLM Summary:")
                print(f"  {chunk['summary']}")

            if chunk['keywords']:
                print(f"\nKeywords:")
                print(f"  {chunk['keywords']}")

            if chunk['purpose']:
                print(f"\nPurpose:")
                print(f"  {chunk['purpose']}")

            # Show first 200 chars of content
            content = chunk['content']
            if len(content) > 200:
                content = content[:200] + "..."
            print(f"\nOriginal Content (first 200 chars):")
            print(f"  {content}")
            print("-" * 80)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_llm_summaries.py <path_to_index.db>")
        print("\nExample:")
        print("  python inspect_llm_summaries.py ~/.codexlens/indexes/myproject/_index.db")
        sys.exit(1)

    db_path = Path(sys.argv[1])
    inspect_summaries(db_path)
