#!/usr/bin/env python3
"""
Test script to verify GraphAnalyzer is working correctly.
Checks if TreeSitter is available and can extract relationships from sample files.
"""
import sys
from pathlib import Path

# Add codex-lens to path
sys.path.insert(0, str(Path(__file__).parent.parent / "codex-lens" / "src"))

from codexlens.semantic.graph_analyzer import GraphAnalyzer
from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser

def test_graph_analyzer_availability():
    """Test if GraphAnalyzer is available for different languages."""
    print("=" * 60)
    print("Testing GraphAnalyzer Availability")
    print("=" * 60)

    languages = ["python", "javascript", "typescript"]
    for lang in languages:
        try:
            analyzer = GraphAnalyzer(lang)
            available = analyzer.is_available()
            parser = TreeSitterSymbolParser(lang)
            parser_available = parser.is_available()

            print(f"\n{lang.upper()}:")
            print(f"  GraphAnalyzer available: {available}")
            print(f"  TreeSitter parser available: {parser_available}")

            if not available:
                print(f"  [X] GraphAnalyzer NOT available for {lang}")
            else:
                print(f"  [OK] GraphAnalyzer ready for {lang}")
        except Exception as e:
            print(f"\n{lang.upper()}:")
            print(f"  [ERROR] Error: {e}")

def test_sample_file_analysis(file_path: Path):
    """Test relationship extraction on a real file."""
    print("\n" + "=" * 60)
    print(f"Testing File: {file_path.name}")
    print("=" * 60)

    if not file_path.exists():
        print(f"[X] File not found: {file_path}")
        return

    # Determine language
    suffix = file_path.suffix
    lang_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript'
    }
    language = lang_map.get(suffix)

    if not language:
        print(f"[X] Unsupported file type: {suffix}")
        return

    print(f"Language: {language}")

    # Read file content
    try:
        content = file_path.read_text(encoding='utf-8')
        print(f"File size: {len(content)} characters")
    except Exception as e:
        print(f"[X] Failed to read file: {e}")
        return

    # Test parser first
    try:
        parser = TreeSitterSymbolParser(language)
        if not parser.is_available():
            print(f"[X] TreeSitter parser not available for {language}")
            return

        indexed_file = parser.parse(content, file_path)
        symbols = indexed_file.symbols if indexed_file else []
        print(f"[OK] Parsed {len(symbols)} symbols")

        if symbols:
            print("\nSample symbols:")
            for i, sym in enumerate(symbols[:5], 1):
                print(f"  {i}. {sym.kind:10s} {sym.name:30s}")
    except Exception as e:
        print(f"[X] Symbol parsing failed: {e}")
        import traceback
        traceback.print_exc()
        return

    # Test relationship extraction
    try:
        analyzer = GraphAnalyzer(language)
        if not analyzer.is_available():
            print(f"[X] GraphAnalyzer not available for {language}")
            return

        relationships = analyzer.analyze_with_symbols(content, file_path, symbols)
        print(f"\n{'[OK]' if relationships else '[WARN]'} Extracted {len(relationships)} relationships")

        if relationships:
            print("\nSample relationships:")
            for i, rel in enumerate(relationships[:10], 1):
                print(f"  {i}. {rel.source_symbol:20s} --[{rel.relationship_type}]--> {rel.target_symbol} (line {rel.source_line})")
        else:
            print("\n[WARN] No relationships found")
            print("   This could be normal if the file has no function calls")
            print("   or if all calls are to external modules")
    except Exception as e:
        print(f"[X] Relationship extraction failed: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Run all tests."""
    # Test availability
    test_graph_analyzer_availability()

    # Test on sample files from project
    project_root = Path(__file__).parent.parent

    sample_files = [
        project_root / "ccw" / "src" / "core" / "routes" / "graph-routes.ts",
        project_root / "codex-lens" / "src" / "codexlens" / "storage" / "dir_index.py",
        project_root / "ccw" / "src" / "templates" / "dashboard-js" / "views" / "graph-explorer.js",
    ]

    for sample_file in sample_files:
        if sample_file.exists():
            test_sample_file_analysis(sample_file)
        else:
            print(f"\nSkipping non-existent file: {sample_file}")

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print("\nIf all tests passed:")
    print("  [OK] GraphAnalyzer is working correctly")
    print("  [OK] TreeSitter parsers are installed")
    print("\nIf relationships were found:")
    print("  [OK] Relationship extraction is functional")
    print("\nNext steps:")
    print("  1. If no relationships found, check if files have function calls")
    print("  2. Re-run 'codex init' to re-index with relationship extraction")
    print("  3. Check database: sqlite3 ~/.codexlens/indexes/.../\\_index.db 'SELECT COUNT(*) FROM code_relationships;'")

if __name__ == "__main__":
    main()
