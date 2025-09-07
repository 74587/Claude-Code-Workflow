---
name: workflow-review
description: Execute review phase for quality validation
usage: /workflow:review [--auto-fix]
argument-hint: [optional: auto-fix identified issues]
examples:
  - /workflow:review
  - /workflow:review --auto-fix
---

# Workflow Review Command (/workflow:review)

## Overview
Final phase for quality validation, testing, and completion.

## Core Principles
**Session Management:** @~/.claude/workflows/session-management-principles.md

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

## Auto-fix Option
```bash
/workflow:review --auto-fix
```
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
- `/workflow:implement` - Must complete first
- `/task:status` - Check task completion
- `/workflow:status` - View overall status