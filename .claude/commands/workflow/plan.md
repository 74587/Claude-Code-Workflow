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
/workflow:plan [--AM gemini|codex] <input>
```

### Analysis Method Flag (--AM)
Optional flag to specify which CLI tool to use for context analysis:
- **gemini** (default): Uses Gemini CLI for pattern-based analysis and architectural understanding
- **codex**: Uses Codex CLI for autonomous development context gathering with intelligent file discovery

**Examples**:
```bash
/workflow:plan --AM codex "Build authentication system"
/workflow:plan --AM gemini requirements.md
/workflow:plan ISS-001  # Uses default (gemini)
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
- Main tasks with subtasks become container tasks (not directly executable)
- Updates session state with task references
- Runs project structure analysis to populate paths field

### Implementation Field Requirements
⚠️ **CRITICAL**: All generated tasks must include detailed implementation guidance

**analysis_source Assignment Rules**:
- **"manual"**: User provides complete implementation details (including specific files and code snippets)
- **"gemini"**: Insufficient information, requires Gemini analysis (missing file paths or code context)  
- **"codex"**: Insufficient information, requires Codex autonomous development analysis (complex refactoring or intelligent file discovery)
- **"auto-detected"**: System automatically infers implementation details (based on pattern recognition)

**Decision Flow**:
1. **IF** user provides file paths + code snippets → "manual"
2. **ELIF** system can infer implementation location → "auto-detected"
3. **ELIF** --AM codex specified → "codex" (requires autonomous development analysis)
4. **ELSE** → "gemini" (requires deep analysis, default method)

**Auto-fill Strategy**:
1. **Sufficient Information**: Auto-fill implementation field based on user input and project context
2. **Insufficient Information**: Mark analysis_source appropriately and prompt:
   
   **For Gemini Analysis (default)**:
   ```
   ⚠️ Implementation details incomplete, recommend using gemini analysis:
   gemini --all-files -p "@{relevant-file-patterns} @{CLAUDE.md} 
   Analyze task: [task description]
   Extract: 1) File locations and code snippets 2) Modification logic and data flow 3) Risks and dependencies"
   ```
   
   **For Codex Analysis (when --AM codex specified)**:
   ```
   ⚠️ Implementation details incomplete, recommend using codex analysis:
   codex --full-auto exec "Analyze and implement: [task description]
   Context: Autonomous analysis and implementation guidance needed
   Extract: 1) Intelligent file discovery 2) Implementation strategy 3) Autonomous development approach"
   ```

**Required Implementation Sub-fields**:
- **files**: Must contain at least 1 file with detailed info (path, location, original_code, modifications)
- **context_notes**: Dependencies, risks, performance considerations
- **analysis_source**: manual|gemini|codex|auto-detected

**Paths Field Population Process**:
1. **Project Structure Analysis**: Run `get_modules_by_depth.sh` to discover project structure
2. **Relevance Filtering**: Match discovered modules to task requirements
3. **Path Selection**: Choose concrete directories/files (avoid wildcards)
4. **Format**: Semicolon-separated list (e.g., `"src/auth;tests/auth;config/auth.json"`)

**Path Selection Strategy**:
```pseudo
# Step 1: Analyze project structure
modules = Bash(.claude/scripts/get_modules_by_depth.sh list)

# Step 2: Extract relevant modules based on task scope
relevant_paths = []
for module in modules:
    if matches_task_scope(module.path, task_requirements):
        relevant_paths.append(module.path)

# Step 3: Add specific files mentioned in requirements
specific_files = extract_file_mentions(task_requirements)
relevant_paths.extend(specific_files)

# Step 4: Format as semicolon-separated string
task.paths = join(relevant_paths, ";")
```

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

**TODO_LIST Structure**: Uses unified hierarchical list format
- Container tasks (with subtasks) marked with `▸` symbol
- Leaf tasks use standard `- [ ]` / `- [x]` checkboxes
- Indentation shows hierarchy (2 spaces per level)
- Container tasks represent logical grouping, not executable items

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