# Context Search Command Reference

Complete reference for all context search tools and commands.

## Tool Overview

### codebase-retrieval (Semantic Discovery)

**Purpose**: Intelligent file discovery based on task/feature context using Gemini CLI

**Command Syntax**:
```bash
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: [description]"
```

**Parameters**:
- `--all-files`: Enable all-files mode for semantic discovery
- `-p "prompt"`: Provide task/feature description

**Use When**:
- Need to find files related to a concept or feature
- Don't know exact file names
- Want AI-powered file discovery
- Exploring unfamiliar codebase

**Best Practices**:
- Be specific in description
- Include technology stack terms (e.g., "JWT authentication", "React components")
- Mention file types if relevant (e.g., "TypeScript interfaces")

---

### rg (ripgrep)

**Purpose**: Fast content search with regex support

**Command Syntax**:
```bash
rg [OPTIONS] PATTERN [PATH...]
```

**Common Options**:

| Option | Description | Example |
|--------|-------------|---------|
| `-i, --ignore-case` | Case-insensitive search | `rg -i "pattern"` |
| `-n, --line-number` | Show line numbers | `rg -n "pattern"` |
| `-A NUM` | Show NUM lines after match | `rg -A 3 "pattern"` |
| `-B NUM` | Show NUM lines before match | `rg -B 3 "pattern"` |
| `-C NUM` | Show NUM lines before and after | `rg -C 3 "pattern"` |
| `--type TYPE` | Search only TYPE files | `rg --type ts "pattern"` |
| `--glob PATTERN` | Include/exclude files by glob | `rg --glob '!*.test.js'` |
| `-F, --fixed-strings` | Treat pattern as literal string | `rg -F "exact.match"` |
| `-l, --files-with-matches` | Show only filenames | `rg -l "pattern"` |
| `-c, --count` | Show count of matches per file | `rg -c "pattern"` |
| `-w, --word-regexp` | Match whole words only | `rg -w "pattern"` |
| `--no-ignore` | Don't respect .gitignore | `rg --no-ignore "pattern"` |

**File Type Filters**:
```bash
rg --type-list           # List all available types

# Common types
rg --type js "pattern"   # JavaScript
rg --type ts "pattern"   # TypeScript
rg --type py "pattern"   # Python
rg --type rust "pattern" # Rust
rg --type go "pattern"   # Go
rg --type java "pattern" # Java
rg --type cpp "pattern"  # C++
rg --type html "pattern" # HTML
rg --type css "pattern"  # CSS
rg --type json "pattern" # JSON
rg --type yaml "pattern" # YAML
```

**Glob Patterns**:
```bash
# Include patterns
rg "pattern" --glob '*.ts'        # Only TypeScript files
rg "pattern" --glob 'src/**/*.js' # JS files in src/

# Exclude patterns
rg "pattern" --glob '!*.test.js'    # Exclude test files
rg "pattern" --glob '!node_modules' # Exclude node_modules
rg "pattern" --glob '!dist'         # Exclude dist directory

# Multiple globs
rg "pattern" --glob '*.ts' --glob '*.tsx' --glob '!*.test.*'
```

**Performance Tips**:
- Use `--type` instead of `--glob` when possible (faster)
- Use `-F` for literal strings (no regex overhead)
- Exclude large directories with `--glob '!node_modules'`
- Limit search to specific paths: `rg "pattern" src/`

---

### find

**Purpose**: Locate files and directories by name patterns

**Command Syntax**:
```bash
find [PATH...] [OPTIONS] [EXPRESSION]
```

**Common Options**:

| Option | Description | Example |
|--------|-------------|---------|
| `-name PATTERN` | Match filename pattern | `find . -name "*.ts"` |
| `-iname PATTERN` | Case-insensitive name match | `find . -iname "*.TXT"` |
| `-type TYPE` | Match file type (f=file, d=dir) | `find . -type f` |
| `-path PATTERN` | Match full path pattern | `find . -path "*/src/*"` |
| `-prune` | Don't descend into directory | `find . -path "*/node_modules" -prune` |
| `-maxdepth N` | Descend at most N levels | `find . -maxdepth 2` |
| `-mindepth N` | Start at least N levels deep | `find . -mindepth 1` |
| `-exec CMD {} \;` | Execute command on results | `find . -name "*.js" -exec wc -l {} \;` |

**Common Patterns**:

```bash
# Find files by extension
find . -name "*.ts" -type f
find . -name "*.js" -o -name "*.jsx"

# Find files excluding directories
find . -path "*/node_modules" -prune -o -name "*.js" -print
find . -path "*/dist" -prune -o -path "*/.git" -prune -o -type f -print

# Find files and execute command
find . -name "*.test.js" -exec grep -l "describe" {} \;
find . -name "*.ts" -type f -exec wc -l {} \; | sort -n

# Find by depth
find . -maxdepth 2 -name "*.json"
find . -mindepth 2 -maxdepth 3 -name "package.json"

# Find directories
find . -type d -name "*test*"

# Find empty files
find . -type f -empty

# Find files modified recently
find . -name "*.js" -mtime -7  # Modified in last 7 days
```

---

### grep

**Purpose**: Built-in pattern matching (fallback when rg unavailable)

**Command Syntax**:
```bash
grep [OPTIONS] PATTERN [FILE...]
```

**Common Options**:

| Option | Description | Example |
|--------|-------------|---------|
| `-r, --recursive` | Search recursively | `grep -r "pattern" .` |
| `-i, --ignore-case` | Case-insensitive | `grep -i "pattern" file` |
| `-n, --line-number` | Show line numbers | `grep -n "pattern" file` |
| `-A NUM` | Show NUM lines after | `grep -A 3 "pattern" file` |
| `-B NUM` | Show NUM lines before | `grep -B 3 "pattern" file` |
| `-C NUM` | Show NUM lines context | `grep -C 3 "pattern" file` |
| `-l, --files-with-matches` | Show only filenames | `grep -l "pattern" *.js` |
| `-c, --count` | Count matches per file | `grep -c "pattern" *.js` |
| `-v, --invert-match` | Show non-matching lines | `grep -v "pattern" file` |
| `-w, --word-regexp` | Match whole words | `grep -w "word" file` |
| `-E, --extended-regexp` | Extended regex | `grep -E "pat1|pat2" file` |
| `--include=PATTERN` | Include files matching | `grep -r "pattern" --include="*.js"` |
| `--exclude=PATTERN` | Exclude files matching | `grep -r "pattern" --exclude="*.test.js"` |
| `--exclude-dir=PATTERN` | Exclude directories | `grep -r "pattern" --exclude-dir="node_modules"` |

**Common Patterns**:

```bash
# Recursive search
grep -r "pattern" .
grep -r "pattern" --include="*.ts" --exclude-dir="node_modules" .

# Case-insensitive with line numbers
grep -i -n "pattern" file.txt

# Show context
grep -A 3 -B 3 "pattern" file.txt
grep -C 5 "pattern" file.txt

# Multiple patterns
grep -E "pattern1|pattern2" file.txt
grep "pattern1" file.txt | grep "pattern2"

# Invert match (exclude lines)
grep -v "exclude" file.txt

# Count matches
grep -c "pattern" *.js

# Find files containing pattern
grep -l "pattern" *.js
grep -r -l "pattern" --include="*.ts" .
```

**Note**: Prefer `rg` over `grep` for better performance and features.

---

### get_modules_by_depth.sh

**Purpose**: Program architecture analysis and structural discovery

**Command Syntax**:
```bash
~/.claude/scripts/get_modules_by_depth.sh
```

**No Options**: Script runs automatically and analyzes current directory structure

**Use When**:
- Starting a new planning task (MANDATORY)
- Need to understand program architecture
- Exploring project structure
- Before making structural changes

**Output**: Hierarchical view of program modules and their relationships

**Best Practices**:
- Run before any planning or architecture work
- Run from project root directory
- Use output to inform file organization decisions
- Reference output when discussing architecture

---

## MCP Code Index Tools

### mcp__code-index__search_code_advanced

**Purpose**: Advanced code pattern search with fuzzy matching

**Parameters**:
```typescript
{
  pattern: string,              // Search pattern (regex or literal)
  case_sensitive?: boolean,     // Default: true
  context_lines?: number,       // Default: 0
  file_pattern?: string,        // Glob pattern (e.g., "*.ts")
  fuzzy?: boolean,              // Default: false
  max_line_length?: number,     // Default: none
  regex?: boolean               // Default: null (auto-detect)
}
```

**Examples**:
```bash
# Basic search
mcp__code-index__search_code_advanced(pattern="function.*auth")

# With file filter
mcp__code-index__search_code_advanced(pattern="interface.*Props", file_pattern="*.tsx")

# Case-insensitive with context
mcp__code-index__search_code_advanced(pattern="error", case_sensitive=false, context_lines=3)

# Fuzzy search
mcp__code-index__search_code_advanced(pattern="auhtenticate", fuzzy=true)
```

---

### mcp__code-index__find_files

**Purpose**: Find files by glob pattern using pre-built index

**Parameters**:
```typescript
{
  pattern: string  // Glob pattern (e.g., "*.ts", "*auth*")
}
```

**Pattern Types**:
- Full path matching: `src/**/*.ts`
- Filename only: `README.md` (finds all README files)
- Wildcard: `*auth*` (files containing "auth")

**Examples**:
```bash
# Find all Markdown files
mcp__code-index__find_files(pattern="*.md")

# Find files with wildcard
mcp__code-index__find_files(pattern="*auth*")

# Find test files
mcp__code-index__find_files(pattern="*.test.ts")

# Find specific file
mcp__code-index__find_files(pattern="package.json")
```

**Note**: Use wildcard patterns for better results than exact matches.

---

### mcp__code-index__refresh_index

**Purpose**: Manually refresh project file index

**Parameters**: None

**Use When**:
- After major git operations (pull, merge, checkout)
- File watcher is disabled or unavailable
- Index seems outdated
- Large-scale file operations completed

**Example**:
```bash
mcp__code-index__refresh_index()
```

---

### mcp__code-index__get_file_summary

**Purpose**: Get structural summary of a file

**Parameters**:
```typescript
{
  file_path: string  // Path to file
}
```

**Returns**:
- Line count
- Function/class definitions
- Import statements
- Basic complexity metrics

**Example**:
```bash
mcp__code-index__get_file_summary(file_path="src/auth/index.ts")
```

---

## Performance Comparison

### Speed Rankings (Fastest to Slowest)

1. **rg (ripgrep)** - Fastest for content search
2. **find** - Fast for file location
3. **MCP Code Index** - Fast for indexed searches
4. **grep** - Slower than rg
5. **codebase-retrieval** - Slower (AI-powered)

### Recommended Tool by Task

| Task | Fastest Tool | Alternative |
|------|-------------|-------------|
| Content search | rg | grep |
| File location | find | MCP find_files |
| Pattern search | rg | MCP search_code_advanced |
| Semantic discovery | codebase-retrieval | - |
| Architecture analysis | get_modules_by_depth.sh | - |

---

## Optimization Strategies

### General Tips

1. **Use type filters** - Always specify file types when possible
2. **Exclude directories** - Skip node_modules, dist, .git
3. **Literal search** - Use `-F` flag when pattern has no regex
4. **Limit scope** - Search specific directories instead of entire project
5. **Use indexes** - MCP Code Index is fast for indexed operations

### Pattern Optimization

```bash
# ❌ Slow: Complex regex
rg ".*complex.*nested.*pattern.*"

# ✅ Fast: Simple patterns
rg "complex" | rg "nested" | rg "pattern"

# ❌ Slow: No type filter
rg "pattern"

# ✅ Fast: With type filter
rg "pattern" --type ts

# ❌ Slow: Searches everything
rg "pattern" .

# ✅ Fast: Limited scope
rg "pattern" src/
```

### Exclusion Patterns

```bash
# Standard exclusions for most projects
rg "pattern" \
  --glob '!node_modules' \
  --glob '!dist' \
  --glob '!build' \
  --glob '!.git' \
  --glob '!coverage' \
  --glob '!*.min.js'

# With find
find . \
  -path "*/node_modules" -prune -o \
  -path "*/dist" -prune -o \
  -path "*/.git" -prune -o \
  -name "*.ts" -print
```

---

## Environment-Specific Notes

### Git Bash on Windows

- All commands work in Git Bash environment
- Use forward slashes (`/`) in paths
- Use POSIX-style paths (`/c/Users` instead of `C:\Users`)
- ❌ No Windows commands: `findstr`, `dir`, `where`, `type`
- ✅ Use Bash equivalents: `grep`, `find`, `which`, `cat`

### Path Handling

```bash
# ✅ Correct (Bash)
find . -name "*.ts"
rg "pattern" src/

# ❌ Wrong (Windows)
dir /s /b *.ts
findstr /s "pattern" src\
```

---

## Troubleshooting

### Command Not Found

```bash
# Check if rg is installed
which rg

# Fallback to grep if rg unavailable
if ! command -v rg &> /dev/null; then
  grep -r "pattern" .
else
  rg "pattern"
fi
```

### Too Many Results

```bash
# Add more specific patterns
rg "very.specific.pattern" --type ts

# Limit to directory
rg "pattern" src/auth/

# Show only filenames
rg "pattern" -l

# Count matches
rg "pattern" -c
```

### Too Slow

```bash
# Use literal search
rg -F "literal" --type ts

# Exclude large directories
rg "pattern" --glob '!node_modules' --glob '!dist'

# Limit depth
find . -maxdepth 3 -name "*.ts"

# Use type filters
rg "pattern" --type ts
```

### No Matches Found

```bash
# Try case-insensitive
rg -i "pattern"

# Try fuzzy search (MCP)
mcp__code-index__search_code_advanced(pattern="patern", fuzzy=true)

# Check if file type is correct
rg "pattern" --type-list

# Try without filters
rg "pattern" .
```

---

## Advanced Usage

### Combining Tools

```bash
# Use find to get files, rg to search within
find . -name "*.ts" -type f | xargs rg "pattern"

# Use rg to find files, then process
rg -l "pattern" --type ts | xargs wc -l

# Semantic discovery → content search
FILES=$(~/.claude/scripts/gemini-wrapper --all-files -p "List files for: auth")
echo "$FILES" | xargs rg "jwt"
```

### Piping Results

```bash
# Chain searches
rg "pattern1" --type ts | rg "pattern2"

# Count results
rg "pattern" -l | wc -l

# Sort by frequency
rg "pattern" -c | sort -t: -k2 -n

# Get unique matches
rg "pattern" -o | sort | uniq -c | sort -n
```

### Custom Scripts

```bash
# Create custom search function
search_feature() {
  local feature=$1
  echo "Searching for: $feature"

  # Semantic discovery
  ~/.claude/scripts/gemini-wrapper --all-files -p "List files for: $feature"

  # Content search
  rg "$feature" --type ts -C 2
}

# Use it
search_feature "authentication"
```

---

## Quick Reference Card

### Most Common Commands

```bash
# Semantic file discovery
~/.claude/scripts/gemini-wrapper --all-files -p "List files for: [task]"

# Architecture analysis
~/.claude/scripts/get_modules_by_depth.sh

# Content search
rg "pattern" --type ts

# File search
find . -name "*.ts" -type f

# MCP search
mcp__code-index__search_code_advanced(pattern="pattern", file_pattern="*.ts")

# MCP find
mcp__code-index__find_files(pattern="*pattern*")
```

### Common Options

```bash
# Case-insensitive
rg -i "pattern"

# Show context
rg -C 3 "pattern"

# Exclude directory
rg "pattern" --glob '!node_modules'

# Literal search
rg -F "exact.match"

# Type filter
rg "pattern" --type ts
```

---

## See Also

- [SKILL.md](SKILL.md) - Core decision framework
- [examples.md](examples.md) - Practical usage examples
- ripgrep documentation: https://github.com/BurntSushi/ripgrep
- find man page: `man find`
- grep man page: `man grep`
