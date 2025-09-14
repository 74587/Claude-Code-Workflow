---
name: plan
description: Create implementation plans with intelligent input detection
usage: /workflow:plan <input>
argument-hint: "text description"|file.md|ISS-001|template-name
examples:
  - /workflow:plan "Build authentication system"
  - /workflow:plan requirements.md
  - /workflow:plan ISS-001
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
```

## Input Detection Logic
The command automatically detects input type:

### File Input (Auto-detected)
```bash
/workflow:plan requirements.md
/workflow:plan config.json
```
**Triggers**: Extensions: .md, .txt, .json, .yaml, .yml
**Processing**: Reads file contents and extracts requirements

### Issue Input (Auto-detected)
```bash
/workflow:plan ISS-001
/workflow:plan ISSUE-123
```
**Triggers**: Patterns: ISS-*, ISSUE-*, *-request-*
**Processing**: Loads issue data and acceptance criteria


### Text Input (Default)
```bash
/workflow:plan "Build user authentication with JWT and OAuth2"
```
**Triggers**: Everything else
**Processing**: Parse natural language requirements

## Automatic Behaviors

### Session Management
- Creates new session if none exists
- Uses active session if available
- Generates session ID: WFS-[topic-slug]

### Complexity Detection with Saturation
- **Simple**: ≤8 saturated tasks → Direct IMPL_PLAN.md
- **Medium**: 9-15 saturated tasks → IMPL_PLAN.md + TODO_LIST.md
- **Complex**: >15 saturated tasks → Full decomposition

**Note**: 1 complex preparation task = 0.5 saturated task for counting

### Task Granularity Principles
- **Decompose by function, not by file**: Each task should complete a whole functional unit
- **Maintain functional integrity**: Each task produces independently runnable or testable functionality
- **Implement related components together**: UI, logic, tests and other related parts in the same task
- **Avoid technical step decomposition**: Don't make "create file" or "add function" as separate tasks

### Task Decomposition Anti-patterns
❌ **Wrong Example - File/Step-based Decomposition**:
- IMPL-001: Create database model
- IMPL-002: Create API endpoint
- IMPL-003: Create frontend component
- IMPL-004: Add routing configuration
- IMPL-005: Write unit tests

✅ **Correct Example - Function-based Decomposition**:
- IMPL-001: Implement user authentication feature (includes model, API, UI, tests)
- IMPL-002: Implement data export functionality (includes processing logic, UI, file generation)

### Task Generation with Saturation Control
- **Task Saturation Assessment**: Evaluates whether to merge preparation and execution
- **Default merge mode**: "Analyze and implement X" instead of "Analyze X" + "Implement X"
- **Smart splitting**: Only separate when preparation complexity > threshold
- Automatically creates .task/ files when complexity warrants
- Generates hierarchical task structure (max 2 levels)
- Main tasks with subtasks become container tasks (not directly executable)
- Updates session state with task references
- Runs project structure analysis to populate paths field

### Task Saturation Assessment
Evaluates whether to merge preparation and execution:

**Default Merge Principles** (Saturated Tasks):
- All components of the same functional module
- Frontend and backend paired implementation
- Features with their corresponding tests
- Configuration with its usage code
- Multiple small interdependent functions

**Only Separate Tasks When**:
- Completely independent functional modules (no shared code)
- Independent services with different tech stacks (e.g., separate frontend/backend deployment)
- Modules requiring different expertise (e.g., ML model training vs Web development)
- Large features with clear sequential dependencies

**Task Examples**:
- **Merged Example**: "IMPL-001: Implement user authentication system (includes JWT management, API endpoints, UI components, and tests)"
- **Separated Example**: "IMPL-001: Design cross-service authentication architecture" + "IMPL-002: Implement frontend authentication module" + "IMPL-003: Implement backend authentication service"

### Task Breakdown Process
- **Automatic decomposition**: Only when task count >15 are tasks broken into subtasks (impl-N.M format)
- **Function-based decomposition**: Split by independent functional boundaries, not by technical layers
- **Container tasks**: Parent tasks with subtasks become containers (marked with ▸ in TODO_LIST)
- **Smart decomposition**: AI analyzes task title to suggest logical functional subtask structure
- **Complete unit principle**: Each subtask must still represent a complete functional unit
- **Context inheritance**: Subtasks inherit parent's requirements and scope, refined for specific needs
- **Agent assignment**: Automatic agent mapping based on subtask type (planning/code/test/review)
- **Maximum depth**: 2 levels (impl-N.M) to maintain manageable hierarchy

### Implementation Field Requirements  
- **analysis_source**: Determines context gathering method (manual|auto-detected|gemini|codex)
- **Auto-assignment**: manual (user provides details) → auto-detected (system infers) → gemini/codex (needs analysis)
- **Required fields**: files (with path/location/modifications), context_notes, analysis_source
- **Paths format**: Semicolon-separated list (e.g., "src/auth;tests/auth;config/auth.json")

## Session Check Process
⚠️ **CRITICAL**: Check for existing active session before planning

1. **Check Active Session**: Check for `.workflow/.active-*` marker file
2. **Session Selection**: Use existing active session or create new
3. **Context Integration**: Load session state and existing context

## Output Documents

### Document References for Execution

#### Primary References
- **Planning Document**: `.workflow/WFS-[topic-slug]/IMPL_PLAN.md`
  - Used by: `/workflow:execute` for context loading
  - Contains: Requirements, task overview, success criteria

- **Task Definitions**: `.workflow/WFS-[topic-slug]/.task/impl-*.json`
  - Used by: Agents for implementation context
  - Contains: Complete task details with implementation field including preparation_complexity

- **Progress Tracking**: `.workflow/WFS-[topic-slug]/TODO_LIST.md`
  - Used by: `/workflow:execute` for status tracking
  - Updated by: Agents after task completion

### IMPL_PLAN.md (Always Created)
```markdown
# Implementation Plan - [Project Name]
*Generated from: [input_source]*

## Requirements
[Extracted requirements from input source]

## Task Breakdown
- **IMPL-001**: [Saturated task description with merged preparation and execution]
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
- **Vague text input**: Auto-reject without guidance
  - Rejected examples: "do something", "fix it", "make it better", "add feature"
  - Response: Direct rejection message, no further assistance

### Recommended Task Patterns

#### Complete Feature Implementation
"Implement user management system" - includes CRUD operations, permissions, UI components, API endpoints, and tests

#### End-to-End Features
"Add Excel export functionality" - includes data processing, file generation, download API, UI buttons, and error handling

#### System Integration
"Integrate payment gateway" - includes API integration, order processing, payment flows, webhook handling, and testing

#### Problem Resolution
"Fix and optimize search functionality" - includes bug fixes, performance optimization, UI improvements, and related tests

#### Module Development
"Create notification system" - includes email/SMS sending, template management, subscription handling, and admin interface

**System ensures**: Unified planning interface with intelligent input detection and function-based task granularity