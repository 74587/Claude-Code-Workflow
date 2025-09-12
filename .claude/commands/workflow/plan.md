---
name: plan
description: Create implementation plans with intelligent input detection
usage: /workflow:plan <input>
argument-hint: "text description"|file.md|ISS-001|template-name
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
  - /workflow:plan web-api
---

# Workflow Plan Command (/workflow:plan)

## Overview
Creates actionable implementation plans with intelligent input source detection. Supports text, files, issues, and templates through automatic recognition.

## Core Principles
**File Structure:** @~/.claude/workflows/workflow-architecture.md

## Usage
```bash
/workflow/plan <input>
```

## Input Detection Logic
The command automatically detects input type:

### File Input (Auto-detected)
```bash
/workflow:plan requirements.md
/workflow:plan PROJECT_SPEC.txt
/workflow:plan config.json
/workflow:plan spec.yaml
```
**Triggers**: Extensions: .md, .txt, .json, .yaml, .yml
**Processing**: Reads file contents and extracts requirements

### Issue Input (Auto-detected)
```bash
/workflow:plan ISS-001
/workflow:plan ISSUE-123
/workflow:plan feature-request-45
```
**Triggers**: Patterns: ISS-*, ISSUE-*, *-request-*
**Processing**: Loads issue data and acceptance criteria

### Template Input (Auto-detected)
```bash
/workflow:plan web-api
/workflow:plan mobile-app
/workflow:plan database-migration
/workflow:plan security-feature
```
**Triggers**: Known template names
**Processing**: Loads template and prompts for customization

### Text Input (Default)
```bash
/workflow:plan "Build user authentication with JWT and OAuth2"
/workflow:plan "Fix performance issues in dashboard"
```
**Triggers**: Everything else
**Processing**: Parse natural language requirements

## Automatic Behaviors

### Session Management
- Creates new session if none exists
- Uses active session if available
- Generates session ID: WFS-[topic-slug]

### Complexity Detection
- **Simple**: <5 tasks → Direct IMPL_PLAN.md
- **Medium**: 5-15 tasks → IMPL_PLAN.md + TODO_LIST.md
- **Complex**: >15 tasks → Full decomposition

### Task Generation
- Automatically creates .task/ files when complexity warrants
- Generates hierarchical task structure (max 3 levels)
- Updates session state with task references

### Implementation Field Requirements
⚠️ **CRITICAL**: All generated tasks must include detailed implementation guidance

**analysis_source 赋值规则**:
- **"manual"**: 用户提供完整实现细节（包含具体文件、代码片段）
- **"gemini"**: 信息不足，需要 Gemini 分析（缺少文件路径或代码上下文）  
- **"auto-detected"**: 系统自动推断实现细节（基于模式识别）

**判断流程**:
1. **IF** 用户提供文件路径 + 代码片段 → "manual"
2. **ELIF** 系统能推断实现位置 → "auto-detected"
3. **ELSE** → "gemini" (需要深度分析)

**Auto-fill Strategy**:
1. **Sufficient Information**: Auto-fill implementation field based on user input and project context
2. **Insufficient Information**: Mark analysis_source as "gemini" and prompt:
   ```
   ⚠️ Implementation details incomplete, recommend using gemini analysis:
   gemini --all-files -p "@{relevant-file-patterns} @{CLAUDE.md} 
   Analyze task: [task description]
   Extract: 1) File locations and code snippets 2) Modification logic and data flow 3) Risks and dependencies"
   ```

**Required Implementation Sub-fields**:
- **files**: Must contain at least 1 file with detailed info (path, location, original_code, modifications)
- **context_notes**: Dependencies, risks, performance considerations
- **analysis_source**: manual|gemini|auto-detected

**Quality Standards**:
- logic_flow must use specified symbols (───►, ◊───, ◄───)
- Each file must have specific location (function name or line range)
- risks array cannot be empty, must contain at least 1 risk assessment

## Session Check Process
⚠️ **CRITICAL**: Check for existing active session before planning

1. **Check Active Session**: Check for `.workflow/.active-*` marker file
2. **Session Selection**: Use existing active session or create new
3. **Context Integration**: Load session state and existing context

## Output Documents

### IMPL_PLAN.md (Always Created)
```markdown
# Implementation Plan - [Project Name]
*Generated from: [input_source]*

## Requirements
[Extracted requirements from input source]

## Task Breakdown
- **IMPL-001**: [Task description]
- **IMPL-002**: [Task description]

## Success Criteria
[Measurable completion conditions]
```

### Optional TODO_LIST.md (Auto-triggered)
Created when complexity > simple or task count > 5

### Task JSON Files (Auto-created)
Generated in .task/ directory when decomposition enabled

## Error Handling

### Input Processing Errors
- **File not found**: Clear error message with suggestions
- **Invalid issue**: Verify issue ID exists
- **Unknown template**: List available templates
- **Empty input**: Prompt for valid input

## Integration Points

### Related Commands
- `/workflow:session:start` - Create new session first
- `/context` - View generated plan
- `/task/execute` - Execute decomposed tasks
- `/workflow:execute` - Run implementation phase

### Template System
Available templates:
- `web-api`: REST API development
- `mobile-app`: Mobile application
- `database-migration`: Database changes
- `security-feature`: Security implementation

---

**System ensures**: Unified planning interface with intelligent input detection and automatic complexity handling