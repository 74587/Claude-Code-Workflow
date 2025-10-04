---
name: test-context-gather
description: Collect test coverage context and identify files requiring test generation
usage: /workflow:tools:test-context-gather --session <test_session_id>
argument-hint: "--session WFS-test-session-id"
examples:
  - /workflow:tools:test-context-gather --session WFS-test-auth
  - /workflow:tools:test-context-gather --session WFS-test-payment
---

# Test Context Gather Command

## Overview
Specialized context collector for test generation workflows that analyzes test coverage, identifies missing tests, and packages implementation context from source sessions.

## Core Philosophy
- **Coverage-First**: Analyze existing test coverage before planning
- **Gap Identification**: Locate implementation files without corresponding tests
- **Source Context Loading**: Import implementation summaries from source session
- **Framework Detection**: Auto-detect test framework and patterns
- **MCP-Powered**: Leverage code-index tools for precise analysis

## Core Responsibilities
- Load source session implementation context
- Analyze current test coverage using MCP tools
- Identify files requiring test generation
- Detect test framework and conventions
- Package test context for analysis phase

## Execution Lifecycle

### Phase 1: Session Validation & Source Loading

1. **Test Session Validation**
   - Load `.workflow/{test_session_id}/workflow-session.json`
   - Extract `meta.source_session` reference
   - Validate test session type is "test-gen"

2. **Source Session Context Loading**
   - Read `.workflow/{source_session_id}/workflow-session.json`
   - Load implementation summaries from `.workflow/{source_session_id}/.summaries/`
   - Extract changed files and implementation scope
   - Identify implementation patterns and tech stack

### Phase 2: Test Coverage Analysis (MCP Tools)

1. **Existing Test Discovery**
   ```bash
   # Find all test files
   mcp__code-index__find_files(pattern="*.test.*")
   mcp__code-index__find_files(pattern="*.spec.*")
   mcp__code-index__find_files(pattern="*test_*.py")

   # Search for test patterns
   mcp__code-index__search_code_advanced(
     pattern="describe|it|test|@Test",
     file_pattern="*.test.*",
     context_lines=0
   )
   ```

2. **Coverage Gap Analysis**
   ```bash
   # For each implementation file from source session
   # Check if corresponding test file exists

   # Example: src/auth/AuthService.ts -> tests/auth/AuthService.test.ts
   #          src/utils/validator.py -> tests/test_validator.py

   # Output: List of files without tests
   ```

3. **Test Statistics**
   - Count total test files
   - Count implementation files from source session
   - Calculate coverage percentage
   - Identify coverage gaps by module

### Phase 3: Test Framework Detection

1. **Framework Identification**
   ```bash
   # Check package.json or requirements.txt
   mcp__code-index__search_code_advanced(
     pattern="jest|mocha|jasmine|pytest|unittest|rspec",
     file_pattern="package.json|requirements.txt|Gemfile",
     context_lines=2
   )

   # Analyze existing test patterns
   mcp__code-index__search_code_advanced(
     pattern="describe\\(|it\\(|test\\(|def test_",
     file_pattern="*.test.*",
     context_lines=3
   )
   ```

2. **Convention Analysis**
   - Test file naming patterns (*.test.ts vs *.spec.ts)
   - Test directory structure (tests/ vs __tests__ vs src/**/*.test.*)
   - Assertion library (expect, assert, should)
   - Mocking framework (jest.fn, sinon, unittest.mock)

### Phase 4: Context Packaging

Generate `test-context-package.json`:

```json
{
  "metadata": {
    "test_session_id": "WFS-test-auth",
    "source_session_id": "WFS-auth",
    "timestamp": "2025-10-04T10:30:00Z",
    "task_type": "test-generation",
    "complexity": "medium"
  },
  "source_context": {
    "implementation_summaries": [
      {
        "task_id": "IMPL-001",
        "summary_path": ".workflow/WFS-auth/.summaries/IMPL-001-summary.md",
        "changed_files": [
          "src/auth/AuthService.ts",
          "src/auth/TokenValidator.ts",
          "src/middleware/auth.ts"
        ],
        "implementation_type": "feature"
      }
    ],
    "tech_stack": ["typescript", "express", "jsonwebtoken"],
    "project_patterns": {
      "architecture": "layered",
      "error_handling": "try-catch with custom errors",
      "async_pattern": "async/await"
    }
  },
  "test_coverage": {
    "existing_tests": [
      "tests/auth/AuthService.test.ts",
      "tests/middleware/auth.test.ts"
    ],
    "missing_tests": [
      {
        "implementation_file": "src/auth/TokenValidator.ts",
        "suggested_test_file": "tests/auth/TokenValidator.test.ts",
        "priority": "high",
        "reason": "New implementation without tests"
      }
    ],
    "coverage_stats": {
      "total_implementation_files": 3,
      "files_with_tests": 2,
      "files_without_tests": 1,
      "coverage_percentage": 66.7
    }
  },
  "test_framework": {
    "framework": "jest",
    "version": "^29.0.0",
    "test_pattern": "**/*.test.ts",
    "test_directory": "tests/",
    "assertion_library": "expect",
    "mocking_framework": "jest",
    "conventions": {
      "file_naming": "*.test.ts",
      "test_structure": "describe/it blocks",
      "setup_teardown": "beforeEach/afterEach"
    }
  },
  "assets": [
    {
      "type": "implementation_summary",
      "path": ".workflow/WFS-auth/.summaries/IMPL-001-summary.md",
      "relevance": "Source implementation context",
      "priority": "highest"
    },
    {
      "type": "existing_test",
      "path": "tests/auth/AuthService.test.ts",
      "relevance": "Test pattern reference",
      "priority": "high"
    },
    {
      "type": "source_code",
      "path": "src/auth/TokenValidator.ts",
      "relevance": "Implementation requiring tests",
      "priority": "high"
    },
    {
      "type": "documentation",
      "path": "CLAUDE.md",
      "relevance": "Project conventions",
      "priority": "medium"
    }
  ],
  "focus_areas": [
    "Generate comprehensive tests for TokenValidator",
    "Follow existing Jest patterns from AuthService tests",
    "Cover happy path, error cases, and edge cases",
    "Include integration tests for middleware"
  ]
}
```

## Output Location

```
.workflow/{test_session_id}/.process/test-context-package.json
```

## MCP Tools Usage

### File Discovery
```bash
# Test files
mcp__code-index__find_files(pattern="*.test.*")
mcp__code-index__find_files(pattern="*.spec.*")

# Implementation files
mcp__code-index__find_files(pattern="*.ts")
mcp__code-index__find_files(pattern="*.js")
```

### Content Search
```bash
# Test framework detection
mcp__code-index__search_code_advanced(
  pattern="jest|mocha|pytest",
  file_pattern="package.json|requirements.txt"
)

# Test pattern analysis
mcp__code-index__search_code_advanced(
  pattern="describe|it|test",
  file_pattern="*.test.*",
  context_lines=2
)
```

### Coverage Analysis
```bash
# For each implementation file
# Check if test exists
implementation_file="src/auth/AuthService.ts"
test_file_patterns=(
  "tests/auth/AuthService.test.ts"
  "src/auth/AuthService.test.ts"
  "src/auth/__tests__/AuthService.test.ts"
)

# Search for test file
for pattern in "${test_file_patterns[@]}"; do
  if mcp__code-index__find_files(pattern="$pattern") | grep -q .; then
    echo "✅ Test exists: $pattern"
    break
  fi
done
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Source session not found | Invalid source_session reference | Verify test session metadata |
| No implementation summaries | Source session incomplete | Complete source session first |
| MCP tools unavailable | MCP not configured | Fallback to bash find/grep |
| No test framework detected | Missing test dependencies | Request user to specify framework |

## Fallback Strategy (No MCP)

```bash
# File discovery
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules

# Framework detection
grep -r "jest\|mocha\|pytest" package.json requirements.txt 2>/dev/null

# Coverage analysis
for impl_file in $(cat changed_files.txt); do
  test_file=$(echo $impl_file | sed 's/src/tests/' | sed 's/\(.*\)\.\(ts\|js\|py\)$/\1.test.\2/')
  [ ! -f "$test_file" ] && echo "$impl_file → MISSING TEST"
done
```

## Integration

### Called By
- `/workflow:test-gen` (Phase 3: Context Gathering)

### Calls
- MCP code-index tools for analysis
- Bash file operations for fallback

### Followed By
- `/workflow:tools:test-concept-enhanced` - Analyzes context and plans test generation

## Success Criteria

- ✅ Source session context loaded successfully
- ✅ Test coverage gaps identified with MCP tools
- ✅ Test framework detected and documented
- ✅ Valid test-context-package.json generated
- ✅ All missing tests catalogued with priority
- ✅ Execution time < 20 seconds

## Related Commands

- `/workflow:test-gen` - Main test generation workflow
- `/workflow:tools:test-concept-enhanced` - Test generation analysis
- `/workflow:tools:test-task-generate` - Test task JSON generation
