# Test: Rules CLI Generation Feature

## Overview
This document demonstrates the CLI generation feature for Rules Manager.

## API Usage

### Endpoint
```
POST /api/rules/create
```

### Mode: CLI Generation
Set `mode: 'cli-generate'` in the request body.

## Generation Types

### 1. From Description
Generate rule from natural language description:

```json
{
  "mode": "cli-generate",
  "generationType": "description",
  "description": "Always use TypeScript strict mode and proper type annotations",
  "fileName": "typescript-strict.md",
  "location": "project",
  "subdirectory": "",
  "projectPath": "D:/Claude_dms3"
}
```

### 2. From Template
Generate rule from template type:

```json
{
  "mode": "cli-generate",
  "generationType": "template",
  "templateType": "error-handling",
  "fileName": "error-handling-rules.md",
  "location": "project",
  "subdirectory": "",
  "projectPath": "D:/Claude_dms3"
}
```

### 3. From Code Extraction
Extract rules from existing codebase:

```json
{
  "mode": "cli-generate",
  "generationType": "extract",
  "extractScope": "ccw/src/**/*.ts",
  "extractFocus": "error handling, async patterns, type safety",
  "fileName": "extracted-patterns.md",
  "location": "project",
  "subdirectory": "",
  "projectPath": "D:/Claude_dms3"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "fileName": "typescript-strict.md",
  "location": "project",
  "path": "D:/Claude_dms3/.claude/rules/typescript-strict.md",
  "subdirectory": null,
  "generatedContent": "# TypeScript Strict Mode\n\n...",
  "executionId": "1734168000000-gemini"
}
```

### Error Response
```json
{
  "error": "CLI execution failed: ...",
  "stderr": "..."
}
```

## Implementation Details

### Function: `generateRuleViaCLI()`

**Parameters:**
- `generationType`: 'description' | 'template' | 'extract'
- `description`: Rule description (for 'description' mode)
- `templateType`: Template type (for 'template' mode)
- `extractScope`: File pattern like 'src/**/*.ts' (for 'extract' mode)
- `extractFocus`: Focus areas like 'error handling, naming' (for 'extract' mode)
- `fileName`: Target file name (must end with .md)
- `location`: 'project' or 'user'
- `subdirectory`: Optional subdirectory within rules folder
- `projectPath`: Project root path

**Process:**
1. Build CLI prompt based on generation type
2. Execute Gemini CLI with 10-minute timeout
3. Extract generated content from stdout
4. Create rule file using `createRule()`
5. Return result with execution ID

### Prompt Templates

#### Description Mode
```
PURPOSE: Generate Claude Code memory rule from description
MODE: write
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/universal/00-universal-rigorous-style.txt)
```

#### Extract Mode
```
PURPOSE: Extract coding rules from codebase
MODE: analysis
CONTEXT: @{extractScope}
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt)
```

## Error Handling

- CLI execution timeout: 10 minutes (600000ms)
- Empty content validation
- File existence checking
- Generation type validation

## Integration

The feature integrates with:
- **cli-executor.ts**: For Gemini CLI execution
- **createRule()**: For file creation
- **Rules Manager UI**: For user interface (to be implemented)
