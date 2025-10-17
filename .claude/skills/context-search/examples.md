# Context Search Examples

This document provides practical examples of using context search tools in different scenarios.

## Quick Command Examples

### Semantic File Discovery

```bash
# Find files relevant to authentication
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: user authentication and JWT"

# Find files related to database schema
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: database schema and migrations"

# In Bash tool (with timeout)
bash(~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: API endpoints")
```

### Program Architecture Analysis

```bash
# Analyze program structure (run before planning)
~/.claude/scripts/get_modules_by_depth.sh

# In Bash tool
bash(~/.claude/scripts/get_modules_by_depth.sh)
```

### Content Search with ripgrep

```bash
# Search in specific file types
rg "pattern" --type js          # Search in JavaScript files
rg "pattern" --type ts          # Search in TypeScript files
rg "pattern" --type py          # Search in Python files

# Case-insensitive search
rg -i "case-insensitive"

# Show line numbers
rg -n "show-line-numbers"

# Show context lines
rg -A 3 -B 3 "context-lines"    # Show 3 lines before and after

# Exclude directories
rg "pattern" --glob '!node_modules'
rg "pattern" --glob '!*.test.js'

# Literal string search (no regex)
rg -F "exact.string.match"

# Multiple file types
rg "pattern" --type-add 'web:*.{html,css,js}' --type web
```

### File Search with find

```bash
# Find TypeScript files
find . -name "*.ts" -type f

# Find files excluding node_modules
find . -path "*/node_modules" -prune -o -name "*.js" -print

# Find files by multiple patterns
find . \( -name "*.ts" -o -name "*.tsx" \) -type f

# Find and execute command on results
find . -name "*.test.js" -exec grep -l "describe" {} \;
```

### grep Alternatives (when rg unavailable)

```bash
# Recursive search
grep -r "pattern" .

# Case-insensitive with line numbers
grep -n -i "pattern" file.txt

# Show context
grep -A 3 -B 3 "pattern" file.txt

# Search multiple files
grep "pattern" *.js
```

## Workflow Integration Patterns

### Pattern 1: Semantic Discovery → Content Search → Analysis

```bash
# Step 1: Discover relevant files
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: authentication system"

# Step 2: Search within discovered files
rg "jwt|token|auth" --type ts

# Step 3: Read specific files for analysis
# Use Read tool on identified files
```

### Pattern 2: Architecture Analysis for Planning

```bash
# MANDATORY before any planning task
~/.claude/scripts/get_modules_by_depth.sh

# Then proceed with planning based on structure
```

### Pattern 3: Workflow System Exploration

```bash
# Search for task definitions
rg "IMPL-\d+" .workflow/ --type json

# Locate task files
find .workflow/ -name "*.json" -path "*/.task/*"

# Analyze workflow structure
rg "status.*pending" .workflow/.task/

# Show task dependencies
rg "depends_on" .workflow/.task/ -A 2

# Find active sessions
find .workflow/ -name ".active-*"

# Search for session references
rg "WFS-" .workflow/ --type json
```

### Pattern 4: Code Pattern Analysis

```bash
# Find flow control patterns with context
rg "flow_control" .workflow/ -B 2 -A 5

# Find implementation plans
find . -name "IMPL_PLAN.md" -exec grep -l "requirements" {} \;

# Search for specific implementation patterns
rg "async.*function" --type ts -A 5

# Find error handling patterns
rg "try.*catch|throw new Error" --type js -B 2 -A 3
```

### Pattern 5: Test Discovery

```bash
# Find all test files
find . -name "*.test.ts" -o -name "*.spec.ts"

# Search for specific test patterns
rg "describe\(|it\(|test\(" --type ts

# Find tests for specific functionality
rg "test.*authentication|describe.*auth" --type ts

# Find test files with specific assertions
rg "expect\(.*\)\.toBe" --type ts
```

### Pattern 6: API Endpoint Discovery

```bash
# Find API route definitions
rg "app\.(get|post|put|delete|patch)" --type js

# Find Express router usage
rg "Router\(\)|express\.Router" --type ts

# Find API endpoint handlers
rg "@(Get|Post|Put|Delete|Patch)\(" --type ts
```

### Pattern 7: Configuration File Discovery

```bash
# Find configuration files
find . -name "*.config.js" -o -name "*.config.ts" -o -name ".env*"

# Search for environment variables
rg "process\.env\." --type ts

# Find configuration patterns
rg "config\.|configuration" --type ts
```

## Common Scenarios

### Scenario 1: Understanding Authentication System

```bash
# 1. Find auth-related files
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: authentication, JWT, sessions"

# 2. Search for auth implementations
rg "authenticate|authorization" --type ts

# 3. Find middleware usage
rg "middleware.*auth|auth.*middleware" --type ts

# 4. Locate test files
rg "auth.*test|describe.*auth" --type ts
```

### Scenario 2: Database Schema Analysis

```bash
# 1. Find database files
find . -name "*schema*" -o -name "*migration*" -o -name "*model*"

# 2. Search for schema definitions
rg "Schema|model\.define|createTable" --type ts

# 3. Find database queries
rg "SELECT|INSERT|UPDATE|DELETE" --type sql

# 4. Find ORM usage
rg "findOne|findAll|create|update|destroy" --type ts
```

### Scenario 3: Component Structure Exploration

```bash
# 1. Analyze architecture
~/.claude/scripts/get_modules_by_depth.sh

# 2. Find component files
find . -name "*.tsx" -o -name "*.jsx"

# 3. Search for component patterns
rg "export (default )?(function|const).*Component" --type tsx

# 4. Find component imports
rg "import.*from.*components" --type tsx
```

### Scenario 4: Error Handling Audit

```bash
# 1. Find error handling patterns
rg "try.*catch|throw new" --type ts -B 1 -A 3

# 2. Find error classes
rg "class.*Error extends|extends Error" --type ts

# 3. Find error middleware
rg "errorHandler|error.*middleware" --type ts

# 4. Find error logging
rg "console\.error|logger\.error|log\.error" --type ts
```

### Scenario 5: Dependency Analysis

```bash
# 1. Find package.json files
find . -name "package.json"

# 2. Search for specific package usage
rg "from ['\"]express['\"]|require\(['\"]express['\"]\)" --type ts

# 3. Find import patterns
rg "^import.*from" --type ts | head -50

# 4. Find dynamic imports
rg "import\(|require\(" --type ts
```

## MCP Tool Integration Examples

### Using Code Index Tools

```bash
# Search code patterns
mcp__code-index__search_code_advanced(pattern="function.*auth", file_pattern="*.ts")

# Find files by pattern
mcp__code-index__find_files(pattern="*.test.js")

# Find files with wildcard
mcp__code-index__find_files(pattern="*async*")

# Refresh index after git operations
mcp__code-index__refresh_index()

# Get file summary
mcp__code-index__get_file_summary(file_path="src/auth/index.ts")
```

### Combined MCP and CLI Workflow

```bash
# 1. Find files with MCP
mcp__code-index__find_files(pattern="*auth*")

# 2. Search content with ripgrep
rg "jwt|token" --type ts

# 3. Get file summaries
mcp__code-index__get_file_summary(file_path="src/auth/jwt.ts")

# 4. Semantic discovery with Gemini
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: authentication"
```

## Performance Optimization Examples

### Optimized Searches

```bash
# Fast: Use type filters
rg "pattern" --type ts

# Faster: Exclude directories
rg "pattern" --glob '!node_modules' --glob '!dist'

# Fastest: Literal search (no regex)
rg -F "exact.match" --type ts

# Very fast: Limit to specific directory
rg "pattern" src/ --type ts
```

### Avoiding Slow Searches

```bash
# ❌ Slow: No type filter, includes node_modules
grep -r "pattern" .

# ✅ Fast: Type filter and exclusions
rg "pattern" --type ts --glob '!node_modules'

# ❌ Slow: Complex regex on large files
rg ".*complex.*regex.*pattern.*" .

# ✅ Fast: Simple patterns, literal when possible
rg -F "simple" --type ts
```

## Troubleshooting Examples

### When rg is not available

```bash
# Fall back to grep
grep -r "pattern" --include="*.ts" --exclude-dir="node_modules" .

# Or use find + grep
find . -name "*.ts" -not -path "*/node_modules/*" -exec grep -l "pattern" {} \;
```

### When searching produces too many results

```bash
# Add more specific patterns
rg "function authenticate" --type ts

# Limit to specific directories
rg "pattern" src/auth/ --type ts

# Use word boundaries
rg "\bpattern\b" --type ts

# Show only filenames
rg "pattern" --type ts -l
```

### When searching is too slow

```bash
# Use literal search
rg -F "literal.string" --type ts

# Limit search depth
find . -maxdepth 3 -name "*.ts"

# Search specific directory
rg "pattern" src/ --type ts

# Use file type filters
rg "pattern" --type-list  # List available types
rg "pattern" --type ts --type js
```
