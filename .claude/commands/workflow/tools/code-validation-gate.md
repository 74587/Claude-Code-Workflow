---
name: code-validation-gate
description: Validate AI-generated code for common errors (imports, variables, types) before test execution
argument-hint: "--session WFS-test-session-id [--fix] [--strict]"
examples:
  - /workflow:tools:code-validation-gate --session WFS-test-auth
  - /workflow:tools:code-validation-gate --session WFS-test-auth --fix
  - /workflow:tools:code-validation-gate --session WFS-test-auth --strict
---

# Code Validation Gate Command

## Overview

Pre-test validation gate that checks AI-generated code for common errors before test execution. This prevents wasted test cycles on code with fundamental issues like import errors, variable conflicts, and type mismatches.

## Core Philosophy

- **Fail Fast**: Catch fundamental errors before expensive test execution
- **AI-Aware**: Specifically targets common AI code generation mistakes
- **Auto-Remediation**: Attempt safe fixes before failing
- **Clear Feedback**: Provide actionable fix suggestions for manual intervention

## Target Error Categories

### L0.1: Compilation Errors
- TypeScript compilation failures
- Syntax errors
- Module resolution failures

### L0.2: Import Errors
- Unresolved module imports (hallucinated packages)
- Circular dependencies
- Duplicate imports
- Unused imports

### L0.3: Variable Errors
- Variable redeclaration
- Scope conflicts (shadowing)
- Undefined variable usage
- Unused variables

### L0.4: Type Errors (TypeScript)
- Type mismatches
- Missing type definitions
- Excessive `any` usage
- Implicit `any` types

### L0.5: AI-Specific Patterns
- Placeholder code (`// TODO: implement`)
- Hallucinated package imports
- Mock code in production files
- Inconsistent naming patterns

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session (required), --fix, --strict
   └─ Load test-quality-config.json

Phase 1: Context Loading
   ├─ Load session metadata
   ├─ Identify target files (from IMPL-001 output or context-package)
   └─ Detect project configuration (tsconfig, eslint, etc.)

Phase 2: Validation Execution
   ├─ L0.1: Run TypeScript compilation check
   ├─ L0.2: Run import validation
   ├─ L0.3: Run variable validation
   ├─ L0.4: Run type validation
   └─ L0.5: Run AI-specific checks

Phase 3: Result Analysis
   ├─ Aggregate all findings by severity
   ├─ Calculate pass/fail status
   └─ Generate fix suggestions

Phase 4: Auto-Fix (if --fix enabled)
   ├─ Apply safe auto-fixes (imports, formatting)
   ├─ Re-run validation
   └─ Report remaining issues

Phase 5: Gate Decision
   ├─ PASS: Proceed to IMPL-001.5
   ├─ SOFT_FAIL: Auto-fix applied, needs re-validation
   └─ HARD_FAIL: Block with detailed report
```

## Execution Lifecycle

### Phase 1: Context Loading

**Load session and identify validation targets.**

```javascript
// Load session metadata
Read(".workflow/active/{session_id}/workflow-session.json")

// Load context package for target files
Read(".workflow/active/{session_id}/.process/context-package.json")
// OR
Read(".workflow/active/{session_id}/.process/test-context-package.json")

// Identify files to validate:
// 1. Source files from context.implementation_files
// 2. Test files from IMPL-001 output (if exists)
// 3. All modified files since session start
```

**Target File Discovery**:
- Source files: `context.focus_paths` from context-package
- Generated tests: `.workflow/active/{session_id}/.task/IMPL-001-output/`
- All TypeScript/JavaScript in target directories

### Phase 2: Validation Execution

**Execute validation checks in order of dependency.**

#### L0.1: TypeScript Compilation

```bash
# Primary check - catches most fundamental errors
npx tsc --noEmit --skipLibCheck --project tsconfig.json 2>&1

# Parse output for errors
# Critical: Any compilation error blocks further validation
```

**Error Patterns**:
```
error TS2307: Cannot find module 'xxx'
error TS2451: Cannot redeclare block-scoped variable 'xxx'
error TS2322: Type 'xxx' is not assignable to type 'yyy'
```

#### L0.2: Import Validation

```bash
# Check for circular dependencies
npx madge --circular --extensions ts,tsx,js,jsx {target_dirs}

# ESLint import rules
npx eslint --rule 'import/no-duplicates: error' --rule 'import/no-unresolved: error' {files}
```

**Hallucinated Package Check**:
```javascript
// Extract all imports from files
// Verify each package exists in package.json or node_modules
// Flag any unresolvable imports as "hallucinated"
```

#### L0.3: Variable Validation

```bash
# ESLint variable rules
npx eslint --rule 'no-shadow: error' --rule 'no-undef: error' --rule 'no-redeclare: error' {files}
```

#### L0.4: Type Validation

```bash
# TypeScript strict checks
npx tsc --noEmit --strict {files}

# Check for any abuse
npx eslint --rule '@typescript-eslint/no-explicit-any: warn' {files}
```

#### L0.5: AI-Specific Checks

```bash
# Check for placeholder code
grep -rn "// TODO: implement\|// Add your code here\|throw new Error.*Not implemented" {files}

# Check for mock code in production files
grep -rn "jest\.mock\|sinon\.\|vi\.mock" {source_files_only}
```

### Phase 3: Result Analysis

**Aggregate and categorize findings.**

```javascript
const findings = {
  critical: [],   // Blocks all progress
  error: [],      // Blocks with threshold
  warning: []     // Advisory only
};

// Apply thresholds from config
const config = loadConfig("test-quality-config.json");
const thresholds = config.code_validation.severity_thresholds;

// Gate decision
if (findings.critical.length > thresholds.critical) {
  decision = "HARD_FAIL";
} else if (findings.error.length > thresholds.error) {
  decision = "SOFT_FAIL";  // Try auto-fix
} else {
  decision = "PASS";
}
```

### Phase 4: Auto-Fix (Optional)

**Apply safe automatic fixes when --fix flag provided.**

```bash
# Safe fixes only
npx eslint --fix --rule 'import/no-duplicates: error' --rule 'unused-imports/no-unused-imports: error' {files}

# Re-run validation after fixes
# Report what was fixed vs what remains
```

**Safe Fix Categories**:
- Remove unused imports
- Remove duplicate imports
- Fix import ordering
- Remove unused variables (with caution)
- Formatting fixes

**Unsafe (Manual Only)**:
- Missing imports (need to determine correct package)
- Type errors (need to understand intent)
- Variable shadowing (need to understand scope intent)

### Phase 5: Gate Decision

**Determine next action based on results.**

| Decision | Condition | Action |
|----------|-----------|--------|
| **PASS** | critical=0, error<=3, warning<=10 | Proceed to IMPL-001.5 |
| **SOFT_FAIL** | critical=0, error>3 OR fixable issues | Auto-fix and retry (max 2) |
| **HARD_FAIL** | critical>0 OR max retries exceeded | Block with report |

## Output Artifacts

### Validation Report

**File**: `.workflow/active/{session_id}/.process/code-validation-report.md`

```markdown
# Code Validation Report

**Session**: {session_id}
**Timestamp**: {timestamp}
**Status**: PASS | SOFT_FAIL | HARD_FAIL

## Summary
- Files Validated: {count}
- Critical Issues: {count}
- Errors: {count}
- Warnings: {count}

## Critical Issues (Must Fix)
### Import Errors
- `src/auth/service.ts:5` - Cannot find module 'non-existent-package'
  - **Suggestion**: Check if package exists, may be hallucinated by AI

### Variable Conflicts
- `src/utils/helper.ts:12` - Cannot redeclare block-scoped variable 'config'
  - **Suggestion**: Rename one of the variables or merge declarations

## Errors (Should Fix)
...

## Warnings (Consider Fixing)
...

## Auto-Fix Applied
- Removed 3 unused imports in `src/auth/service.ts`
- Fixed import ordering in `src/utils/index.ts`

## Remaining Issues Requiring Manual Fix
...

## Next Steps
- [ ] Fix critical issues before proceeding
- [ ] Review error suggestions
- [ ] Re-run validation: `/workflow:tools:code-validation-gate --session {session_id}`
```

### JSON Report (Machine-Readable)

**File**: `.workflow/active/{session_id}/.process/code-validation-report.json`

```json
{
  "session_id": "WFS-test-xxx",
  "timestamp": "2025-01-30T10:00:00Z",
  "status": "HARD_FAIL",
  "summary": {
    "files_validated": 15,
    "critical": 2,
    "error": 5,
    "warning": 8
  },
  "findings": {
    "critical": [
      {
        "category": "import",
        "file": "src/auth/service.ts",
        "line": 5,
        "message": "Cannot find module 'non-existent-package'",
        "suggestion": "Check if package exists in package.json",
        "auto_fixable": false
      }
    ],
    "error": [...],
    "warning": [...]
  },
  "auto_fixes_applied": [...],
  "gate_decision": "HARD_FAIL",
  "retry_count": 0,
  "max_retries": 2
}
```

## Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--session` | Test session ID (required) | - |
| `--fix` | Enable auto-fix for safe issues | false |
| `--strict` | Use strict thresholds (0 errors allowed) | false |
| `--files` | Specific files to validate (comma-separated) | All target files |
| `--skip-types` | Skip TypeScript type checks | false |

## Integration

### Command Chain

- **Called By**: `/workflow:test-fix-gen` (after IMPL-001)
- **Requires**: IMPL-001 output OR context-package.json
- **Followed By**: IMPL-001.5 (Test Quality Gate) on PASS

### Task JSON Integration

When used in test-fix workflow, generates task:

```json
{
  "id": "IMPL-001.3-validation",
  "meta": {
    "type": "code-validation",
    "agent": "@test-fix-agent"
  },
  "context": {
    "depends_on": ["IMPL-001"],
    "requirements": "Validate generated code for AI common errors"
  },
  "flow_control": {
    "validation_config": "~/.ccw/workflows/test-quality-config.json",
    "max_retries": 2,
    "auto_fix_enabled": true
  },
  "acceptance_criteria": [
    "Zero critical issues",
    "Maximum 3 error issues",
    "All imports resolvable",
    "No variable redeclarations"
  ]
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| tsconfig.json not found | Use default compiler options |
| ESLint not installed | Skip ESLint checks, use tsc only |
| madge not installed | Skip circular dependency check |
| No files to validate | Return PASS (nothing to check) |

## Best Practices

1. **Run Early**: Execute validation immediately after code generation
2. **Use --fix First**: Let auto-fix resolve trivial issues
3. **Review Suggestions**: AI fix suggestions may need human judgment
4. **Don't Skip Critical**: Never proceed with critical errors
5. **Track Patterns**: Common failures indicate prompt improvement opportunities

## Related Commands

- `/workflow:test-fix-gen` - Parent workflow that invokes this command
- `/workflow:tools:test-quality-gate` - Next phase (IMPL-001.5) for test quality
- `/workflow:test-cycle-execute` - Execute tests after validation passes
