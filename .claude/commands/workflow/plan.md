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

**Dependency Context Rules:**
- **For tasks with dependencies**: MUST read previous task summary documents before planning
- **Context inheritance**: Use dependency summaries to maintain consistency and avoid duplicate work

## Usage
```bash
/workflow:plan [--AM gemini|codex] <input>
```

### Analysis Method Flag (--AM)
Optional flag to specify which CLI tool to use for context analysis:
- **gemini** (default): Uses Gemini CLI for pattern-based analysis, architectural understanding, and broader context acquisition
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

### Pre-Planning Analysis
⚠️ **CRITICAL**: Determine decomposition strategy BEFORE generating any plan documents

**Required Pre-Analysis Steps**:
1. **Complexity Assessment**: Analyze requirements to determine total saturated task count
2. **Decomposition Strategy**: Based on complexity, decide:
   - Task structure (flat vs hierarchical)
   - Re-scoping necessity (>10 tasks triggers re-scoping)
   - Task saturation level (merged vs separated)
   - File grouping strategy (cohesive files together)
3. **Quantity Prediction**: Calculate expected:
   - Total main tasks (IMPL-XXX)
   - Subtasks per main task (IMPL-N.M)
   - Container vs leaf task ratio

**Pre-Planning Outputs**:
- Complexity level: Simple (≤5) | Medium (6-10) | Over-scoped (>10, requires re-scoping)
- Decomposition approach: Flat | Two-level hierarchy | Re-scope required
- Estimated task count: [number] main tasks, [number] total leaf tasks (max 10)
- Document set: Which documents will be generated (IMPL_PLAN.md, TODO_LIST.md, .task/*.json)
- **Re-scoping recommendation**: If >10 tasks, provide guidance for breaking into iterations

**Only after completing pre-planning analysis**: Proceed to generate actual plan documents

### Complexity Detection with Saturation
*Based on Pre-Planning Analysis results:*
- **Simple**: ≤5 saturated tasks → Direct IMPL_PLAN.md
- **Medium**: 6-10 saturated tasks → IMPL_PLAN.md + TODO_LIST.md
- **Complex**: Exceeding 10 tasks requires re-scoping (maximum enforced)

**10-Task Hard Limit**: Projects exceeding 10 tasks must be re-scoped into smaller iterations
**Note**: 1 complex preparation task = 0.5 saturated task for counting

### Task Granularity Principles
- **Decompose by function, not by file**: Each task should complete a whole functional unit
- **Maintain functional integrity**: Each task produces independently runnable or testable functionality
- **Group related files together**: Keep related files (UI, logic, tests, config) in same task
- **File cohesion rule**: Files that work together should be modified in the same task
- **Avoid technical step decomposition**: Don't make "create file" or "add function" as separate tasks
- **Maximum 10 tasks**: Hard limit enforced; re-scope if exceeded

### Task Decomposition Anti-patterns

❌ **Wrong Example - File/Step-based Decomposition**:
- IMPL-001: Create database model
- IMPL-002: Create API endpoint
- IMPL-003: Create frontend component
- IMPL-004: Add routing configuration
- IMPL-005: Write unit tests

❌ **Wrong Example - Same File Split Across Tasks**:
- IMPL-001: Add authentication routes to routes/auth.js
- IMPL-002: Add user validation to routes/auth.js
- IMPL-003: Add session handling to routes/auth.js

✅ **Correct Example - Function-based with File Cohesion**:
- IMPL-001: Implement user authentication (includes models/User.js, routes/auth.js, components/LoginForm.jsx, middleware/auth.js, tests/auth.test.js)
- IMPL-002: Implement data export functionality (includes services/export.js, routes/export.js, components/ExportButton.jsx, utils/fileGenerator.js, tests/export.test.js)

✅ **Correct Example - Related Files Grouped**:
- IMPL-001: User management system (includes User model, UserController, UserService, user routes, user tests)
- IMPL-002: Product catalog system (includes Product model, ProductController, catalog components, product tests)

### Task Generation with Saturation Control
*Using decomposition strategy determined in Pre-Planning Analysis:*
- **Task Saturation Assessment**: Evaluates whether to merge preparation and execution
- **Default merge mode**: "Analyze and implement X" instead of "Analyze X" + "Implement X"
- **Smart splitting**: Only separate when preparation complexity > threshold
- Automatically creates .task/ files when complexity warrants
- Generates hierarchical task structure (max 2 levels)
- Main tasks with subtasks become container tasks (not directly executable)
- Updates session state with task references
- Runs project structure analysis to populate paths field

### Project Analysis Options

Three analysis levels available:

```bash
# Quick - Structure only (5 seconds)
/workflow:plan "requirements"

# Standard - Structure + Gemini analysis (30 seconds)
/workflow:plan --analyze "requirements"

# Deep - Structure + Parallel comprehensive analysis (1-2 minutes)
/workflow:plan --deep "requirements"
```

**Analysis Selection**:
- Default: Auto-selects based on project complexity
- Manual: Use flags to override automatic selection
- Strategy: See @~/.claude/workflows/intelligent-tools-strategy.md for tool selection principles

**Execution**:
1. Always runs `get_modules_by_depth.sh` for structure
2. Applies selected analysis level
3. Populates task paths automatically

### Task Saturation Assessment
Evaluates whether to merge preparation and execution within 10-task limit:

**Default Merge Principles** (Saturated Tasks):
- All components of the same functional module
- Related files that work together (UI, logic, tests, config)
- Features with their corresponding tests and documentation
- Configuration with its usage code
- Multiple small interdependent functions
- Files that share common interfaces or data structures

**Only Separate Tasks When**:
- Completely independent functional modules (no shared code or interfaces)
- Independent services with different tech stacks (e.g., separate deployment units)
- Modules requiring different expertise (e.g., ML model training vs Web development)
- Large features with clear sequential dependencies
- **Critical**: Would exceed 10-task limit otherwise

**File Cohesion Examples**:
- **Merged**: "IMPL-001: Implement user authentication (includes models/User.js, routes/auth.js, components/LoginForm.jsx, tests/auth.test.js)"
- **Separated**: "IMPL-001: User service authentication" + "IMPL-002: Admin dashboard authentication" (different user contexts)

**10-Task Compliance**: Always prioritize related file grouping to stay within limit

### Task Breakdown Process
- **Automatic decomposition**: Only when task count >10 triggers re-scoping (not decomposition)
- **Function-based decomposition**: Split by independent functional boundaries, not by technical layers
- **Container tasks**: Parent tasks with subtasks become containers (marked with ▸ in TODO_LIST)
- **Smart decomposition**: AI analyzes task title to suggest logical functional subtask structure
- **Complete unit principle**: Each subtask must still represent a complete functional unit
- **Context inheritance**: Subtasks inherit parent's requirements and scope, refined for specific needs
- **Agent assignment**: Automatic agent mapping based on subtask type (planning/code/test/review)
- **Maximum depth**: 2 levels (IMPL-N.M) to maintain manageable hierarchy
- **10-task enforcement**: Exceeding 10 tasks requires project re-scoping

### Flow Control Field Requirements
- **flow_control**: Universal process manager containing:
  - `pre_analysis`: Array of sequential process steps with:
    - `step`: Unique identifier for the step
    - `action`: Human-readable description
    - `command`: Executable command with embedded context variables (e.g., `${variable_name}`)
    - `output_to`: Variable name to store step results (optional for final steps)
    - `on_error`: Error handling strategy
  - `implementation_approach`: Brief one-line strategy description
  - `target_files`: Array of "file:function:lines" format strings
- **Auto-generation**: Creates flow based on task type and complexity
- **Required fields**: meta (type, agent), context (requirements, focus_paths, acceptance, depends_on), flow_control
- **Focus paths format**: Array of strings (e.g., ["src/auth", "tests/auth", "config/auth.json"])

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

- **Task Definitions**: `.workflow/WFS-[topic-slug]/.task/IMPL-*.json`
  - Used by: Agents for implementation context
  - Contains: Complete task details with 7-field structure including flow_control process manager

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
Created when complexity > simple or task count > 3

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
"Implement user management system" - includes all related files: models/User.js, controllers/UserController.js, routes/users.js, components/UserList.jsx, services/UserService.js, tests/user.test.js

#### End-to-End Features
"Add Excel export functionality" - includes cohesive file set: services/ExportService.js, utils/excelGenerator.js, routes/export.js, components/ExportButton.jsx, middleware/downloadHandler.js, tests/export.test.js

#### System Integration
"Integrate payment gateway" - includes integration files: services/PaymentService.js, controllers/PaymentController.js, models/Payment.js, components/PaymentForm.jsx, webhooks/paymentWebhook.js, tests/payment.test.js

#### Problem Resolution
"Fix and optimize search functionality" - includes related files: services/SearchService.js, utils/searchOptimizer.js, components/SearchBar.jsx, controllers/SearchController.js, tests/search.test.js

#### Module Development
"Create notification system" - includes module files: services/NotificationService.js, models/Notification.js, templates/emailTemplates.js, components/NotificationCenter.jsx, workers/notificationQueue.js, tests/notification.test.js

**File Cohesion Principle**: Each task includes ALL files that work together to deliver the complete functionality

**System ensures**: Unified planning interface with intelligent input detection, function-based task granularity, file cohesion enforcement, and 10-task maximum limit