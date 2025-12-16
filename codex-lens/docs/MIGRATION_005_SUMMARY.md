# Migration 005: Database Schema Cleanup

## Overview

Migration 005 removes four unused and redundant database fields identified through Gemini analysis. This cleanup improves database efficiency, reduces schema complexity, and eliminates potential data consistency issues.

## Schema Version

- **Previous Version**: 4
- **New Version**: 5

## Changes Summary

### 1. Removed `semantic_metadata.keywords` Column

**Reason**: Deprecated - replaced by normalized `file_keywords` table in migration 001.

**Impact**:
- Keywords are now exclusively read from the normalized `file_keywords` table
- Prevents data sync issues between JSON column and normalized tables
- No data loss - migration 001 already populated `file_keywords` table

**Modified Code**:
- `get_semantic_metadata()`: Now reads keywords from `file_keywords` JOIN
- `list_semantic_metadata()`: Updated to query `file_keywords` for each result
- `add_semantic_metadata()`: Stopped writing to `keywords` column (only writes to `file_keywords`)

### 2. Removed `symbols.token_count` Column

**Reason**: Unused - always NULL, never populated.

**Impact**:
- No data loss (column was never used)
- Reduces symbols table size
- Simplifies symbol insertion logic

**Modified Code**:
- `add_file()`: Removed `token_count` from INSERT statements
- `update_file_symbols()`: Removed `token_count` from INSERT statements
- Schema creation: No longer creates `token_count` column

### 3. Removed `symbols.symbol_type` Column

**Reason**: Redundant - duplicates `symbols.kind` field.

**Impact**:
- No data loss (information preserved in `kind` column)
- Reduces symbols table size
- Eliminates redundant data storage

**Modified Code**:
- `add_file()`: Removed `symbol_type` from INSERT statements
- `update_file_symbols()`: Removed `symbol_type` from INSERT statements
- Schema creation: No longer creates `symbol_type` column
- Removed `idx_symbols_type` index

### 4. Removed `subdirs.direct_files` Column

**Reason**: Unused - never displayed or queried in application logic.

**Impact**:
- No data loss (column was never used)
- Reduces subdirs table size
- Simplifies subdirectory registration

**Modified Code**:
- `register_subdir()`: Parameter kept for backward compatibility but ignored
- `update_subdir_stats()`: Parameter kept for backward compatibility but ignored
- `get_subdirs()`: No longer retrieves `direct_files`
- `get_subdir()`: No longer retrieves `direct_files`
- `SubdirLink` dataclass: Removed `direct_files` field

## Migration Process

### Automatic Migration (v4 → v5)

When an existing database (version 4) is opened:

1. **Transaction begins**
2. **Step 1**: Recreate `semantic_metadata` table without `keywords` column
   - Data copied from old table (excluding `keywords`)
   - Old table dropped, new table renamed
3. **Step 2**: Recreate `symbols` table without `token_count` and `symbol_type`
   - Data copied from old table (excluding removed columns)
   - Old table dropped, new table renamed
   - Indexes recreated (excluding `idx_symbols_type`)
4. **Step 3**: Recreate `subdirs` table without `direct_files`
   - Data copied from old table (excluding `direct_files`)
   - Old table dropped, new table renamed
5. **Transaction committed**
6. **VACUUM** runs to reclaim space (non-critical, continues if fails)

### New Database Creation (v5)

New databases are created directly with the clean schema (no migration needed).

## Benefits

1. **Reduced Database Size**: Removed 4 unused columns across 3 tables
2. **Improved Data Consistency**: Single source of truth for keywords (normalized tables)
3. **Simpler Code**: Less maintenance burden for unused fields
4. **Better Performance**: Smaller table sizes, fewer indexes to maintain
5. **Cleaner Schema**: Easier to understand and maintain

## Backward Compatibility

### API Compatibility

All public APIs remain backward compatible:

- `register_subdir()` and `update_subdir_stats()` still accept `direct_files` parameter (ignored)
- `SubdirLink` dataclass no longer has `direct_files` attribute (breaking change for direct dataclass access)

### Database Compatibility

- **v4 databases**: Automatically migrated to v5 on first access
- **v5 databases**: No migration needed
- **Older databases (v0-v3)**: Migrate through chain (v0→v2→v4→v5)

## Testing

Comprehensive test suite added: `tests/test_schema_cleanup_migration.py`

**Test Coverage**:
- ✅ Migration from v4 to v5
- ✅ New database creation with clean schema
- ✅ Semantic metadata keywords read from normalized table
- ✅ Symbols insert without deprecated fields
- ✅ Subdir operations without `direct_files`

**Test Results**: All 5 tests passing

## Verification

To verify migration success:

```python
from codexlens.storage.dir_index import DirIndexStore

store = DirIndexStore("path/to/_index.db")
store.initialize()

# Check schema version
conn = store._get_connection()
version = conn.execute("PRAGMA user_version").fetchone()[0]
assert version == 5

# Check columns removed
cursor = conn.execute("PRAGMA table_info(semantic_metadata)")
columns = {row[1] for row in cursor.fetchall()}
assert "keywords" not in columns

cursor = conn.execute("PRAGMA table_info(symbols)")
columns = {row[1] for row in cursor.fetchall()}
assert "token_count" not in columns
assert "symbol_type" not in columns

cursor = conn.execute("PRAGMA table_info(subdirs)")
columns = {row[1] for row in cursor.fetchall()}
assert "direct_files" not in columns

store.close()
```

## Performance Impact

**Expected Improvements**:
- Database size reduction: ~10-15% (varies by data)
- VACUUM reclaims space immediately after migration
- Slightly faster queries (smaller tables, fewer indexes)

## Rollback

Migration 005 is **one-way** (no downgrade function). Removed fields contain:
- `keywords`: Already migrated to normalized tables (migration 001)
- `token_count`: Always NULL (no data)
- `symbol_type`: Duplicate of `kind` (no data loss)
- `direct_files`: Never used (no data)

If rollback is needed, restore from backup before running migration.

## Files Modified

1. **Migration File**:
   - `src/codexlens/storage/migrations/migration_005_cleanup_unused_fields.py` (NEW)

2. **Core Storage**:
   - `src/codexlens/storage/dir_index.py`:
     - Updated `SCHEMA_VERSION` to 5
     - Added migration 005 to `_apply_migrations()`
     - Updated `get_semantic_metadata()` to read from `file_keywords`
     - Updated `list_semantic_metadata()` to read from `file_keywords`
     - Updated `add_semantic_metadata()` to not write `keywords` column
     - Updated `add_file()` to not write `token_count`/`symbol_type`
     - Updated `update_file_symbols()` to not write `token_count`/`symbol_type`
     - Updated `register_subdir()` to not write `direct_files`
     - Updated `update_subdir_stats()` to not write `direct_files`
     - Updated `get_subdirs()` to not read `direct_files`
     - Updated `get_subdir()` to not read `direct_files`
     - Updated `SubdirLink` dataclass to remove `direct_files`
     - Updated `_create_schema()` to create v5 schema directly

3. **Tests**:
   - `tests/test_schema_cleanup_migration.py` (NEW)

## Deployment Checklist

- [x] Migration script created and tested
- [x] Schema version updated to 5
- [x] All code updated to use new schema
- [x] Comprehensive tests added
- [x] Existing tests pass
- [x] Documentation updated
- [x] Backward compatibility verified

## References

- Original Analysis: Gemini code review identified unused/redundant fields
- Migration Pattern: Follows SQLite best practices (table recreation)
- Previous Migrations: 001 (keywords normalization), 004 (dual FTS)
