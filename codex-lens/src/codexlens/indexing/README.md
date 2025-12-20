# Symbol Extraction and Indexing

This module provides symbol extraction and relationship tracking for code graph enrichment.

## Overview

The `SymbolExtractor` class extracts code symbols (functions, classes) and their relationships (calls, imports) from source files using regex-based pattern matching.

## Supported Languages

- Python (.py)
- TypeScript (.ts, .tsx)
- JavaScript (.js, .jsx)

## Database Schema

### Symbols Table
Stores code symbols with their location information:
- `id`: Primary key
- `qualified_name`: Fully qualified name (e.g., "module.ClassName")
- `name`: Symbol name
- `kind`: Symbol type (function, class)
- `file_path`: Path to source file
- `start_line`: Starting line number
- `end_line`: Ending line number

### Symbol Relationships Table
Stores relationships between symbols:
- `id`: Primary key
- `source_symbol_id`: Foreign key to symbols table
- `target_symbol_fqn`: Fully qualified name of target symbol
- `relationship_type`: Type of relationship (calls, imports)
- `file_path`: Path to source file
- `line`: Line number where relationship occurs

## Usage Example

```python
from pathlib import Path
from codexlens.indexing.symbol_extractor import SymbolExtractor

# Initialize extractor
db_path = Path("./code_index.db")
extractor = SymbolExtractor(db_path)
extractor.connect()

# Extract from file
file_path = Path("src/my_module.py")
with open(file_path) as f:
    content = f.read()

symbols, relationships = extractor.extract_from_file(file_path, content)

# Save to database
name_to_id = extractor.save_symbols(symbols)
extractor.save_relationships(relationships, name_to_id)

# Clean up
extractor.close()
```

## Pattern Matching

The extractor uses regex patterns to identify:

- **Functions**: Function definitions (including async, export keywords)
- **Classes**: Class definitions (including export keyword)
- **Imports**: Import/require statements
- **Calls**: Function/method invocations

## Future Enhancements

- Tree-sitter integration for more accurate parsing
- Support for additional languages
- Method and variable extraction
- Enhanced scope tracking
- Relationship type expansion (inherits, implements, etc.)
