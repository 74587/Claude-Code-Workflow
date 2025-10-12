---
name: gather
description: Intelligently collect project context based on task description and package into standardized JSON
argument-hint: "--session WFS-session-id \"task description\""
examples:
  - /workflow:tools:context-gather --session WFS-user-auth "Implement user authentication system"
  - /workflow:tools:context-gather --session WFS-payment "Refactor payment module API"
  - /workflow:tools:context-gather --session WFS-bugfix "Fix login validation error"
---

# Context Gather Command (/workflow:tools:context-gather)

## Overview
Intelligent context collector that gathers relevant information from project codebase, documentation, and dependencies based on task descriptions, generating standardized context packages.

## Core Philosophy
- **Intelligent Collection**: Auto-identify relevant resources based on keyword analysis
- **Comprehensive Coverage**: Collect code, documentation, configurations, and dependencies
- **Standardized Output**: Generate unified format context-package.json
- **Efficient Execution**: Optimize collection strategies to avoid irrelevant information

## Core Responsibilities
- **Keyword Extraction**: Extract core keywords from task descriptions
- **Smart Documentation Loading**: Load relevant project documentation based on keywords
- **Code Structure Analysis**: Analyze project structure to locate relevant code files
- **Dependency Discovery**: Identify tech stack and dependency relationships
- **MCP Tools Integration**: Leverage code-index tools for enhanced collection
- **Context Packaging**: Generate standardized JSON context packages

## Execution Process

### Phase 1: Task Analysis
1. **Keyword Extraction**
   - Parse task description to extract core keywords
   - Identify technical domain (auth, API, frontend, backend, etc.)
   - Determine complexity level (simple, medium, complex)

2. **Scope Determination**
   - Define collection scope based on keywords
   - Identify potentially involved modules and components
   - Set file type filters

### Phase 2: Project Structure Exploration
1. **Architecture Analysis**
   - Use `~/.claude/scripts/get_modules_by_depth.sh` for comprehensive project structure
   - Analyze project layout and module organization
   - Identify key directories and components

2. **Code File Location**
   - Use MCP tools for precise search: `mcp__code-index__find_files()` and `mcp__code-index__search_code_advanced()`
   - Search for relevant source code files based on keywords
   - Locate implementation files, interfaces, and modules

3. **Documentation Collection**
   - Load CLAUDE.md and README.md
   - Load relevant documentation from .workflow/docs/ based on keywords
   - Collect configuration files (package.json, requirements.txt, etc.)

### Phase 3: Intelligent Filtering & Association
1. **Relevance Scoring**
   - Score based on keyword match degree
   - Score based on file path relevance
   - Score based on code content relevance

2. **Dependency Analysis**
   - Analyze import/require statements
   - Identify inter-module dependencies
   - Determine core and optional dependencies

### Phase 4: Context Packaging
1. **Standardized Output**
   - Generate context-package.json
   - Organize resources by type and importance
   - Add relevance descriptions and usage recommendations

## Context Package Format

Generated context package format:

```json
{
  "metadata": {
    "task_description": "Implement user authentication system",
    "timestamp": "2025-09-29T10:30:00Z",
    "keywords": ["user", "authentication", "JWT", "login"],
    "complexity": "medium",
    "tech_stack": ["typescript", "node.js", "express"],
    "session_id": "WFS-user-auth"
  },
  "assets": [
    {
      "type": "documentation",
      "path": "CLAUDE.md",
      "relevance": "Project development standards and conventions",
      "priority": "high"
    },
    {
      "type": "documentation",
      "path": ".workflow/docs/architecture/security.md",
      "relevance": "Security architecture design guidance",
      "priority": "high"
    },
    {
      "type": "source_code",
      "path": "src/auth/AuthService.ts",
      "relevance": "Existing authentication service implementation",
      "priority": "high"
    },
    {
      "type": "source_code",
      "path": "src/models/User.ts",
      "relevance": "User data model definition",
      "priority": "medium"
    },
    {
      "type": "config",
      "path": "package.json",
      "relevance": "Project dependencies and tech stack",
      "priority": "medium"
    },
    {
      "type": "test",
      "path": "tests/auth/*.test.ts",
      "relevance": "Authentication related test cases",
      "priority": "medium"
    }
  ],
  "tech_stack": {
    "frameworks": ["express", "typescript"],
    "libraries": ["jsonwebtoken", "bcrypt"],
    "testing": ["jest", "supertest"]
  },
  "statistics": {
    "total_files": 15,
    "source_files": 8,
    "docs_files": 4,
    "config_files": 2,
    "test_files": 1
  }
}
```

## MCP Tools Integration

### Code Index Integration
```bash
# Set project path
mcp__code-index__set_project_path(path="{current_project_path}")

# Refresh index to ensure latest
mcp__code-index__refresh_index()

# Search relevant files
mcp__code-index__find_files(pattern="*{keyword}*")

# Search code content
mcp__code-index__search_code_advanced(
  pattern="{keyword_patterns}",
  file_pattern="*.{ts,js,py,go,md}",
  context_lines=3
)
```


## Session ID Integration

### Session ID Usage
- **Required Parameter**: `--session WFS-session-id`
- **Session Context Loading**: Load existing session state and task summaries
- **Session Continuity**: Maintain context across pipeline phases

### Session State Management
```bash
# Validate session exists
if [ ! -d ".workflow/${session_id}" ]; then
  echo "❌ Session ${session_id} not found"
  exit 1
fi

# Load session metadata
session_metadata=".workflow/${session_id}/workflow-session.json"
```

## Output Location

Context package output location:
```
.workflow/{session_id}/.process/context-package.json
```

## Error Handling

### Common Error Handling
1. **No Active Session**: Create temporary session directory
2. **MCP Tools Unavailable**: Fallback to traditional bash commands
3. **Permission Errors**: Prompt user to check file permissions
4. **Large Project Optimization**: Limit file count, prioritize high-relevance files

### Graceful Degradation Strategy
```bash
# Fallback when MCP unavailable
if ! command -v mcp__code-index__find_files; then
  # Use find command for file discovery
  find . -name "*{keyword}*" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"

  # Alternative pattern matching
  find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" \) -exec grep -l "{keyword}" {} \;
fi

# Use ripgrep instead of MCP search
rg "{keywords}" --type-add 'source:*.{ts,js,py,go}' -t source --max-count 30

# Content-based search with context
rg -A 3 -B 3 "{keywords}" --type-add 'source:*.{ts,js,py,go}' -t source

# Quick relevance check
grep -r --include="*.{ts,js,py,go}" -l "{keywords}" . | head -15

# Test files discovery
find . -name "*test*" -o -name "*spec*" | grep -E "\.(ts|js|py|go)$" | head -10

# Import/dependency analysis
rg "^(import|from|require|#include)" --type-add 'source:*.{ts,js,py,go}' -t source | head -20
```

## Performance Optimization

### Large Project Optimization Strategy
- **File Count Limit**: Maximum 50 files per type
- **Size Filtering**: Skip oversized files (>10MB)
- **Depth Limit**: Maximum search depth of 3 levels
- **Caching Strategy**: Cache project structure analysis results

### Parallel Processing
- Documentation collection and code search in parallel
- MCP tool calls and traditional commands in parallel
- Reduce I/O wait time

## Essential Bash Commands (Max 10)

### 1. Project Structure Analysis
```bash
~/.claude/scripts/get_modules_by_depth.sh
```

### 2. File Discovery by Keywords
```bash
find . -name "*{keyword}*" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"
```

### 3. Content Search in Code Files
```bash
rg "{keyword}" --type-add 'source:*.{ts,js,py,go}' -t source --max-count 20
```

### 4. Configuration Files Discovery
```bash
find . -maxdepth 3 \( -name "*.json" -o -name "package.json" -o -name "requirements.txt" -o -name "Cargo.toml" \) -not -path "*/node_modules/*"
```

### 5. Documentation Files Collection
```bash
find . -name "*.md" -o -name "README*" -o -name "CLAUDE.md" | grep -v node_modules | head -10
```

### 6. Test Files Location
```bash
find . \( -name "*test*" -o -name "*spec*" \) -type f | grep -E "\.(js|ts|py|go)$" | head -10
```

### 7. Function/Class Definitions Search
```bash
rg "^(function|def|func|class|interface)" --type-add 'source:*.{ts,js,py,go}' -t source -n --max-count 15
```

### 8. Import/Dependency Analysis
```bash
rg "^(import|from|require|#include)" --type-add 'source:*.{ts,js,py,go}' -t source | head -15
```

### 9. Workflow Session Information
```bash
find .workflow/ -name "*.json" -path "*/${session_id}/*" -o -name "workflow-session.json" | head -5
```

### 10. Context-Aware Content Search
```bash
rg -A 2 -B 2 "{keywords}" --type-add 'source:*.{ts,js,py,go}' -t source --max-count 10
```

## Success Criteria
- Generate valid context-package.json file
- Contains sufficient relevant information for subsequent analysis
- Execution time controlled within 30 seconds
- File relevance accuracy rate >80%

## Related Commands
- `/workflow:tools:concept-enhanced` - Consumes output of this command for analysis
- `/workflow:plan` - Calls this command to gather context
- `/workflow:status` - Can display context collection status