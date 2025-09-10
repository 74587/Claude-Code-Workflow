# Workflow Architecture

## Overview

This document defines the complete workflow system architecture using a **JSON-only data model**, **marker-based session management**, and **progressive file structures** that scale with task complexity.

## Core Architecture Principles

### Key Design Decisions
- **JSON files are the single source of truth** - All markdown documents are read-only generated views
- **Marker files for session tracking** - Ultra-simple active session management
- **Progressive complexity structure** - File organization scales from simple to complex workflows
- **Agent-agnostic task definitions** - Complete context preserved for autonomous execution

## Session Management

### Active Session Marker System
**Ultra-Simple Active Tracking**: `.workflow/.active-[session-name]`

```bash
.workflow/
├── WFS-oauth-integration/         # Session directory (paused)
├── WFS-user-profile/             # Session directory (paused)
├── WFS-bug-fix-123/              # Session directory (completed)
└── .active-WFS-user-profile      # Marker file (indicates active session)
```

**Marker File Benefits**:
- **Zero Parsing**: File existence check is atomic and instant
- **Atomic Operations**: File creation/deletion is naturally atomic  
- **Visual Discovery**: `ls .workflow/.active-*` shows active session immediately
- **Simple Switching**: Delete old marker + create new marker = session switch

### Session Operations

#### Detect Active Session
```bash
active_session=$(ls .workflow/.active-* 2>/dev/null | head -1)
if [ -n "$active_session" ]; then
  session_name=$(basename "$active_session" | sed 's/^\.active-//')
  echo "Active session: $session_name"
fi
```

#### Switch Session
```bash
rm .workflow/.active-* 2>/dev/null && touch .workflow/.active-WFS-new-feature
```

### Individual Session Tracking
Each session directory contains `workflow-session.json`:

```json
{
  "session_id": "WFS-[topic-slug]",
  "project": "feature description",
  "type": "simple|medium|complex", 
  "current_phase": "PLAN|IMPLEMENT|REVIEW",
  "status": "active|paused|completed",
  "progress": {
    "completed_phases": ["PLAN"],
    "current_tasks": ["impl-1", "impl-2"]
  }
}
```

## Data Model

### JSON-Only Architecture
**JSON files (.task/impl-*.json) are the only authoritative source of task state. All markdown documents are read-only generated views.**

- **Task State**: Stored exclusively in JSON files
- **Documents**: Generated on-demand from JSON data
- **No Synchronization**: Eliminates bidirectional sync complexity
- **Performance**: Direct JSON access without parsing overhead

### Task JSON Schema
All task files use this 9-field schema:

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "pending|active|completed|blocked|container",
  "type": "feature|bugfix|refactor|test|docs", 
  "agent": "code-developer|planning-agent|code-review-test-agent",
  
  "context": {
    "requirements": ["JWT authentication", "OAuth2 support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented"],
    "inherited_from": "WFS-user-auth"
  },
  
  "relations": {
    "parent": null,
    "subtasks": ["impl-1.1", "impl-1.2"],
    "dependencies": ["impl-0"]
  },
  
  "execution": {
    "attempts": 0,
    "last_attempt": null
  },
  
  "implementation": {
    "files": [
      {
        "path": "src/auth/login.ts",
        "location": {
          "function": "handleLogin",
          "lines": "75-120",
          "description": "Core logic of login handler function"
        },
        "original_code": "// Related code not provided, requires gemini analysis",
        "modifications": {
          "current_state": "Currently using simple password validation",
          "proposed_changes": [
            "Add JWT token generation logic",
            "Integrate OAuth2 authentication flow", 
            "Enhance error handling mechanisms"
          ],
          "logic_flow": [
            "validateInput() ───► checkCredentials()",
            "◊─── if valid ───► generateJWT() ───► return token",
            "◊─── if OAuth ───► redirectToProvider() ───► handleCallback()",
            "◊─── if error ───► logError() ───► return errorResponse"
          ],
          "reason": "Meet JWT and OAuth2 authentication requirements, enhance security",
          "expected_outcome": "Flexible login system supporting multiple authentication methods"
        }
      }
    ],
    "context_notes": {
      "dependencies": ["jsonwebtoken", "passport-oauth2"],
      "affected_modules": ["user-profile", "session-manager"],
      "risks": [
        "Need to update authentication middleware for all API endpoints",
        "May affect existing user sessions",
        "Require database migration to add token storage table"
      ],
      "performance_considerations": "JWT validation will add approximately 5ms latency",
      "error_handling": "Ensure sensitive information is not leaked in error responses"
    },
    "analysis_source": "manual|gemini|auto-detected"
  }
}
```

### Implementation Field Details

The **implementation** field provides detailed code implementation guidance with 4 core components:

#### files Array - Detailed File Information
- **path**: File path or filename
- **location**: Specific code location (function name, class name, line range)
- **original_code**: Original code snippet to be modified (mark as "requires gemini analysis" if not obtained)
- **modifications**: Modification details
  - **current_state**: Brief description of current code state
  - **proposed_changes**: Step-by-step list of modification points
  - **logic_flow**: Data flow and call relationship diagram
  - **reason**: Modification rationale and objectives
  - **expected_outcome**: Expected results

#### context_notes - Implementation Context Information
- **dependencies**: Required dependency packages or modules
- **affected_modules**: Other modules that will be affected
- **risks**: Potential risk points and cascading effects
- **performance_considerations**: Performance impact assessment
- **error_handling**: Error handling requirements

#### analysis_source - Information Source Identifier
- **manual**: Detailed information manually provided by user
- **gemini**: Automatically obtained through Gemini CLI analysis
- **auto-detected**: Auto-detected based on task type and context

### Hierarchical Task System
**Maximum Depth**: 3 levels (impl-N.M.P format)

```
impl-1              # Main task
impl-1.1            # Subtask of impl-1
impl-1.1.1          # Detailed subtask of impl-1.1
impl-1.2            # Another subtask of impl-1
impl-2              # Another main task
```

**Task Status Rules**:
- **Container tasks**: Parent tasks with subtasks (cannot be directly executed)
- **Leaf tasks**: Only these can be executed directly
- **Status inheritance**: Parent status derived from subtask completion

## File Structure

### Progressive Structure System
File structure scales with task complexity to minimize overhead for simple tasks while providing comprehensive organization for complex workflows.

#### Level 0: Minimal Structure (<5 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]           # Optional brainstorming phase
├── [.chat/]                    # Gemini CLI interaction sessions
├── IMPL_PLAN.md                # Combined planning document
├── .summaries/                 # Task completion summaries
│   └── IMPL-*.md              # Individual task summaries
└── .task/
    └── impl-*.json             # Task definitions
```

#### Level 1: Enhanced Structure (5-15 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]          # Optional brainstorming phase
├── [.chat/]                   # Gemini CLI interaction sessions
├── IMPL_PLAN.md               # Combined planning document
├── TODO_LIST.md               # Auto-triggered progress tracking
├── .summaries/                # Task completion summaries
│   ├── IMPL-*.md             # Main task summaries
│   └── IMPL-*.*.md           # Subtask summaries
└── .task/
    ├── impl-*.json            # Main task definitions
    └── impl-*.*.json          # Subtask definitions (up to 3 levels)
```

#### Level 2: Complete Structure (>15 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]          # Optional brainstorming phase  
├── [.chat/]                   # Gemini CLI interaction sessions
│   ├── chat-*.md             # Saved chat sessions
│   └── analysis-*.md         # Comprehensive analysis results
├── IMPL_PLAN.md               # Comprehensive planning document
├── TODO_LIST.md               # Progress tracking and monitoring
├── .summaries/                # Task completion summaries
│   ├── IMPL-*.md             # Main task summaries
│   ├── IMPL-*.*.md           # Subtask summaries
│   └── IMPL-*.*.*.md         # Detailed subtask summaries
└── .task/
    ├── impl-*.json            # Task hierarchy (max 3 levels deep)
    ├── impl-*.*.json          # Subtasks
    └── impl-*.*.*.json        # Detailed subtasks
```

### File Naming Conventions

#### Session Identifiers
**Format**: `WFS-[topic-slug]`
- Convert topic to lowercase with hyphens (e.g., "User Auth System" → `WFS-user-auth-system`)
- Add `-NNN` suffix only if conflicts exist (e.g., `WFS-payment-integration-002`)

#### Document Naming
- `workflow-session.json` - Session state (required)
- `IMPL_PLAN.md` - Planning document (required)
- `TODO_LIST.md` - Progress tracking (auto-generated when needed)
- Chat sessions: `chat-analysis-*.md`
- Task summaries: `IMPL-[task-id]-summary.md`

## Complexity Classification

### Unified Classification Rules
**Consistent thresholds across all workflow components:**

| Complexity | Task Count | Hierarchy Depth | Structure Level | Behavior |
|------------|------------|----------------|-----------------|----------|
| **Simple** | <5 tasks | 1 level (impl-N) | Level 0 - Minimal | Direct execution, basic docs |
| **Medium** | 5-15 tasks | 2 levels (impl-N.M) | Level 1 - Enhanced | Context coordination, TODO tracking |
| **Complex** | >15 tasks | 3 levels (impl-N.M.P) | Level 2 - Complete | Multi-agent orchestration, full docs |

### Simple Workflows
**Characteristics**: Direct implementation tasks with clear, limited scope
- **Examples**: Bug fixes, small feature additions, configuration changes
- **System Behavior**: Minimal structure, single-level tasks, basic planning only
- **Agent Coordination**: Direct execution without complex orchestration

### Medium Workflows  
**Characteristics**: Feature implementation requiring task breakdown
- **Examples**: New features, API endpoints with integration, database schema changes
- **System Behavior**: Enhanced structure, two-level hierarchy, auto-triggered TODO_LIST.md
- **Auto-trigger Conditions**: Tasks >5 OR modules >3 OR effort >4h OR complex dependencies

### Complex Workflows
**Characteristics**: System-wide changes requiring detailed decomposition
- **Examples**: Major features, architecture refactoring, security implementations, multi-service deployments
- **System Behavior**: Complete structure, three-level hierarchy, comprehensive documentation
- **Agent Coordination**: Multi-agent orchestration with deep context analysis

### Automatic Assessment & Upgrades
- **During Creation**: System evaluates requirements and assigns complexity
- **During Execution**: Can upgrade (Simple→Medium→Complex) but never downgrade
- **Override Allowed**: Users can specify higher complexity manually

## Document Templates

### IMPL_PLAN.md Templates

#### Stage-Based Format (Simple Tasks)
```markdown
# Implementation Plan: [Task Name]

## Overview
[Brief description of the overall goal and approach]

## Requirements  
[Functional and non-functional requirements]

## Stage 1: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: 
- [Testable outcome 1]
**Tests**: 
- [Specific test case 1]
**Dependencies**: [Previous stages or external requirements]
**Status**: [Not Started]

## Risk Mitigation
[Identified risks and mitigation strategies]
```

#### Hierarchical Format (Complex Tasks)
```markdown
# Implementation Plan: [Project Name]

## Overview
[Brief description and strategic approach]

## Requirements
[Functional and non-functional requirements]

## Task Hierarchy

### Main Task: [IMPL-001] [Primary Goal]
**Description**: [Detailed description]
**Complexity**: [High/Medium/Low]
**Status**: [Not Started]

#### Subtask: [IMPL-001.1] [Subtask Name]
**Description**: [Specific deliverable]
**Assigned Agent**: [code-developer/code-review-agent/general-purpose]
**Acceptance Criteria**: 
- [Testable criteria 1]
**Status**: [Not Started]

##### Action Item: [IMPL-001.1.1] [Specific Action]
**Type**: [Code/Test/Documentation/Review]
**Description**: [Concrete action]
**Files Affected**: [List of files]
**Status**: [Not Started]
```

### TODO_LIST.md Template
```markdown
# Tasks: [Session Topic]

## Main Tasks
- [ ] **IMPL-001**: [Task Description] → [📋](./.task/impl-001.json)
- [x] **IMPL-002**: [Completed Task] → [📋](./.task/impl-002.json) | [✅](./.summaries/IMPL-002.md)
- [ ] **IMPL-003**: [Task Description] → [📋](./.task/impl-003.json)

## Subtasks  
- [ ] **IMPL-001.1**: [Subtask] → [📋](./.task/impl-001.1.json)
- [ ] **IMPL-001.2**: [Subtask] → [📋](./.task/impl-001.2.json)

## Notes
[可选备注]
```

## Agent Integration

### Agent Assignment
Based on task type and title keywords:
- **Planning tasks** → planning-agent
- **Implementation** → code-developer  
- **Testing** → code-review-test-agent
- **Review** → review-agent

### Execution Context
Agents receive complete task JSON plus workflow context:
```json
{
  "task": { /* complete task JSON */ },
  "workflow": {
    "session": "WFS-user-auth",
    "phase": "IMPLEMENT"
  }
}
```

## Gemini Analysis Integration

### Implementation Field Population Strategy

When task creation encounters insufficient implementation details, the system integrates with Gemini CLI for automated code analysis:

#### Trigger Conditions
- **Missing File Paths**: No specific files identified in task scope
- **Vague Code Locations**: Generic descriptions without function/class names
- **Empty Risk Assessment**: No specific risks or dependencies identified
- **analysis_source**: Marked as "gemini" during task creation

#### Gemini Analysis Command Template
```bash
gemini --all-files -p "@{scope-patterns} @{CLAUDE.md} 
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

## Task-Specific Analysis:
Task: [task title and description]
Target Files: [scope patterns or 'auto-detect']

## Required Extraction:
1. **File Locations**: Identify specific files, functions, classes, line ranges
2. **Original Code**: Extract relevant code snippets that need modification  
3. **Data Flow**: Map current logic flow and identify integration points
4. **Risk Assessment**: Analyze dependencies, performance impact, error scenarios
5. **Implementation Context**: Document required libraries, affected modules

## Output Format:
- File references with :line format
- Code snippets in markdown blocks
- Flow diagrams using ───►, ◊───, ◄─── symbols
- Risk list with specific impact descriptions"
```

#### Analysis Result Processing
1. **Parse Gemini Output**: Extract file paths, code snippets, and analysis insights
2. **Structure Mapping**: Convert analysis results into implementation JSON structure
3. **Validation**: Ensure all required fields are populated with meaningful content
4. **Quality Check**: Verify logic_flow uses proper symbols and risks are specific

#### Integration Points
- **Task Creation**: `/workflow:plan` and `/task:create` commands
- **Task Refinement**: `/task:replan` for updating incomplete implementation details
- **Manual Trigger**: Direct gemini analysis when implementation details are missing

### Implementation Field Validation

**Required Quality Standards**:
- Each file must have specific `location.function` or `location.lines`
- `original_code` cannot be empty placeholder text
- `logic_flow` must use standard symbols: `───►` (flow), `◊───` (condition), `◄───` (return)
- `risks` array must contain at least one specific, actionable risk
- `dependencies` must list actual package names, not generic terms

**Auto-Correction**:
- Missing line numbers → Trigger gemini re-analysis with specific file focus
- Generic risk descriptions → Request detailed impact analysis
- Empty original_code → Flag for manual code review or gemini extraction

## Data Operations

### Task Creation
```bash
echo '{"id":"impl-1","title":"New task",...}' > .task/impl-1.json
```

### Task Updates
```bash
jq '.status = "active"' .task/impl-1.json > temp && mv temp .task/impl-1.json
```

### Document Generation
```bash
# Generate TODO_LIST.md from current JSON state
generate_todo_list_from_json .task/
```

## Validation and Error Handling

### Task Integrity Rules
1. **ID Uniqueness**: All task IDs must be unique
2. **Hierarchical Format**: Must follow impl-N[.M[.P]] pattern
3. **Parent References**: All parent IDs must exist as JSON files
4. **Depth Limits**: Maximum 3 levels deep
5. **Status Consistency**: Status values from defined enumeration
6. **Required Fields**: All 9 core fields must be present
7. **Implementation Structure**: implementation.files array must contain valid file paths
8. **Analysis Source**: analysis_source must be one of: manual|gemini|auto-detected

### Session Consistency Checks
```bash
# Validate active session integrity
active_marker=$(ls .workflow/.active-* 2>/dev/null | head -1)
if [ -n "$active_marker" ]; then
  session_name=$(basename "$active_marker" | sed 's/^\.active-//')
  session_dir=".workflow/$session_name"
  
  if [ ! -d "$session_dir" ]; then
    echo "⚠️ Orphaned active marker, removing..."
    rm "$active_marker"
  fi
fi
```

### Recovery Strategies
- **Missing Session Directory**: Remove orphaned active marker
- **Multiple Active Markers**: Keep newest, remove others
- **Corrupted Session File**: Recreate from template
- **Broken Task Hierarchy**: Reconstruct parent-child relationships

## Performance Benefits

### Marker File System
- **Session Detection**: Single `ls` command (< 1ms)
- **Session Switching**: Two file operations (delete + create)
- **Status Check**: File existence test (instant)
- **No Parsing Overhead**: Zero JSON/text processing

### JSON-Only Architecture
- **Direct Access**: No document parsing overhead
- **Atomic Updates**: Single file operations
- **No Sync Conflicts**: Eliminates coordination complexity
- **Fast Queries**: Direct JSON traversal
- **Scalability**: Handles hundreds of tasks efficiently

### On-Demand Generation
- **Memory Efficient**: Documents created only when needed
- **Always Fresh**: Generated views reflect current state
- **No Stale Data**: Eliminates sync lag issues

---

**System ensures**: Unified workflow architecture with ultra-fast session management, JSON-only data model, and progressive file structures that scale from simple tasks to complex system-wide implementations.