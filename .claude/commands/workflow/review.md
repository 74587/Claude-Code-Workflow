---
name: review
description: Execute review phase for quality validation
usage: /workflow:review
argument-hint: none
examples:
  - /workflow:review
---

# Workflow Review Command (/workflow:review)

## Overview
Final phase for quality validation, testing, and completion.

## Core Principles
**Session Management:** @~/.claude/workflows/workflow-architecture.md

## Review Process

1. **Validation Checks**
   - All tasks completed
   - Tests passing
   - Code quality metrics
   - Documentation complete

2. **Generate Review Report**
   ```markdown
   # Review Report
   
   ## Task Completion
   - Total: 10
   - Completed: 10
   - Success Rate: 100%
   
   ## Quality Metrics
   - Test Coverage: 85%
   - Code Quality: A
   - Documentation: Complete
   
   ## Issues Found
   - Minor: 2
   - Major: 0
   - Critical: 0
   ```

3. **Update Session**
   ```json
   {
     "current_phase": "REVIEW",
     "phases": {
       "REVIEW": {
         "status": "completed",
         "output": "REVIEW.md",
         "test_results": {
           "passed": 45,
           "failed": 0,
           "coverage": 85
         }
       }
     }
   }
   ```

## Auto-fix (Default)
Auto-fix is enabled by default:
- Automatically fixes minor issues
- Runs formatters and linters
- Updates documentation
- Re-runs tests

## Completion Criteria
- All tasks marked complete
- Tests passing (configurable threshold)
- No critical issues
- Documentation updated

## Output Files
- `REVIEW.md` - Review report
- `workflow-session.json` - Updated with results
- `test-results.json` - Detailed test output

## Related Commands
- `/workflow:execute` - Must complete first
- `/task:status` - Check task completion
- `/workflow:status` - View overall status