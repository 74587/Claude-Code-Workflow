# Workflow File Structure Standards

## Overview

This document defines directory layouts, file naming conventions, and progressive complexity structures for workflow sessions.

## Progressive Structure System
**Complexity → Structure Level**

File structure scales with task complexity to minimize overhead for simple tasks while providing comprehensive organization for complex workflows.

### Level 0: Minimal Structure (<5 tasks)
**Target**: Simple workflows with clear, limited scope

```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]           # Optional brainstorming phase
├── [.chat/]                    # Gemini CLI interaction sessions
│   └── chat-*.md              # Saved chat sessions with timestamps
├── IMPL_PLAN.md                # Combined planning document
├── .summaries/                 # Task completion summaries
│   └── IMPL-*.md              # Individual task summaries
└── .task/
    └── impl-*.json             # Task definitions
```

### Level 1: Enhanced Structure (5-15 tasks)
**Target**: Medium complexity workflows with multiple phases

```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]          # Optional brainstorming phase
├── [.chat/]                   # Gemini CLI interaction sessions
│   └── chat-*.md             # Saved chat sessions with timestamps
├── IMPL_PLAN.md               # Combined planning document
├── TODO_LIST.md               # Auto-triggered progress tracking
├── .summaries/                # Task completion summaries
│   ├── IMPL-*.md             # Main task summaries
│   └── IMPL-*.*.md           # Subtask summaries
└── .task/
    ├── impl-*.json            # Main task definitions
    └── impl-*.*.json          # Subtask definitions (up to 3 levels)
```

### Level 2: Complete Structure (>15 tasks)
**Target**: Complex workflows with extensive documentation needs

```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]          # Optional brainstorming phase  
├── [.chat/]                   # Gemini CLI interaction sessions
│   ├── chat-*.md             # Saved chat sessions with timestamps
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

## File Naming Conventions

### Session Identifiers
**Format**: `WFS-[topic-slug]`
- Convert topic to lowercase with hyphens (e.g., "User Auth System" → `WFS-user-auth-system`)
- Add `-NNN` suffix only if conflicts exist (e.g., `WFS-payment-integration-002`)

### Task File Naming
**Hierarchical ID Format**:
```
impl-1              # Main task
impl-1.1            # Subtask of impl-1
impl-1.1.1          # Detailed subtask of impl-1.1
impl-1.2            # Another subtask of impl-1
impl-2              # Another main task
```

**Maximum Depth**: 3 levels (impl-N.M.P)

### Document Naming
- `workflow-session.json` - Session state (required)
- `IMPL_PLAN.md` - Planning document (required)
- `TODO_LIST.md` - Progress tracking (auto-generated when needed)
- Chat sessions: `chat-YYYYMMDD-HHMMSS.md`
- Analysis results: `analysis-[topic].md`
- Task summaries: `IMPL-[task-id]-summary.md`

## Directory Structure Rules

### Required Directories
- `.task/` - Always present, contains JSON task definitions
- `.summaries/` - Always present, contains task completion documentation

### Optional Directories
- `.brainstorming/` - Present when brainstorming phase was used
- `.chat/` - Present when Gemini CLI sessions were saved

### Directory Permissions and Access
- All workflow directories are project-local
- Active session marked by `.workflow/.active-[session-name]` marker file (global)
- Individual sessions in `.workflow/WFS-[topic-slug]/` (session-specific)

## Document Generation Triggers

### Automatic Document Creation
**Based on complexity assessment**:

| **Complexity** | **IMPL_PLAN.md** | **TODO_LIST.md** | **Task Files** |
|----------------|------------------|------------------|----------------|
| Simple (<5 tasks) | Always | No | impl-*.json |
| Medium (5-15 tasks) | Always | Auto-trigger* | impl-*.*.json |
| Complex (>15 tasks) | Always | Always | impl-*.*.*.json |

**Auto-trigger conditions (*):**
- Tasks > 5 OR modules > 3 OR estimated effort > 4h OR complex dependencies

### Document Template Standards

#### IMPL_PLAN.md Structure

Two formats available based on task complexity:

##### Stage-Based Format (Simple Tasks)
Use for tasks with clear, linear progression:

```markdown
# Implementation Plan: [Task Name]

## Overview
[Brief description of the overall goal and approach]

## Requirements  
[Functional and non-functional requirements]

## [Brainstorming Integration]
[If .brainstorming/ exists - reference analysis results]

## Stage 1: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: 
- [Testable outcome 1]
- [Testable outcome 2]
**Tests**: 
- [Specific test case 1]
- [Specific test case 2]
**Dependencies**: [Previous stages or external requirements]
**Estimated Effort**: [Small/Medium/Large]
**Review Status**: [Not Started]
**Status**: [Not Started]

## Stage 2: [Name]
[Repeat stage structure]

## Stage 3: [Name]
[Repeat stage structure]

## Risk Mitigation
[Identified risks and mitigation strategies]

## Rollback Strategy
[How to revert if issues arise]
```

##### Hierarchical Format (Complex Tasks)
Use for tasks requiring >5 subtasks or spanning >3 modules:

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
**Estimated Effort**: [Time estimate]
**Dependencies**: [External dependencies]
**Status**: [Not Started]

#### Subtask: [IMPL-001.1] [Subtask Name]
**Description**: [Specific deliverable]
**Assigned Agent**: [code-developer/code-review-agent/general-purpose]
**Dependencies**: [Parent/peer task dependencies]
**Acceptance Criteria**: 
- [Testable criteria 1]
- [Testable criteria 2]
**Estimated Effort**: [Time estimate]
**Assigned Module**: [Component/file location]
**Status**: [Not Started]
**Links**: [Related documentation/requirements]

##### Action Item: [IMPL-001.1.1] [Specific Action]
**Type**: [Code/Test/Documentation/Review]
**Recommended Agent**: [code-developer/code-review-agent/general-purpose]
**Description**: [Concrete action]
**Files Affected**: [List of files]
**Verification**: [How to verify completion]
**Status**: [Not Started]

[Repeat structure for all tasks/subtasks/actions]

### Main Task: [IMPL-002] [Secondary Goal]
[Repeat task structure]

## Dependency Graph
[Visual or text representation of task dependencies]

## Resource Requirements
[Tools, libraries, external dependencies needed]

## Risk Assessment
[Task-specific risks and mitigation strategies]

## Rollback Strategy
[System-wide rollback procedures]
```

#### TODO_LIST.md Structure

**Keep simple and focused on task tracking:**

```markdown
# Task Progress List: [Session Topic]

## Implementation Tasks

### Main Tasks
- [ ] **IMPL-001**: [Task Description] → [📋 Details](./.task/impl-001.json)
- [x] **IMPL-002**: [Completed Task] → [📋 Details](./.task/impl-002.json) | [✅ Summary](./.summaries/IMPL-002-summary.md)

### Subtasks (Auto-expanded when active)
- [ ] **IMPL-001.1**: [Subtask Description] → [📋 Details](./.task/impl-001.1.json)
  - [ ] **IMPL-001.1.1**: [Action Item] → [📋 Details](./.task/impl-001.1.1.json)
- [ ] **IMPL-001.2**: [Subtask Description] → [📋 Details](./.task/impl-001.2.json)

## Notes
[Quick notes and reminders for the project]
```

**Format Notes**:
- Main tasks use bold formatting: `**IMPL-XXX**`
- Subtasks indent under parent tasks
- Links to task JSON files for details
- Links to summaries when completed
- Keep format simple and scannable

## Chat Session Management

### Chat Directory Structure
```
.chat/
├── chat-YYYYMMDD-HHMMSS.md      # Individual chat sessions with timestamps
├── analysis-[topic].md          # Comprehensive analysis results
└── context-[phase].md           # Phase-specific context gathering
```

### Chat Session Template
```markdown
# Chat Session: [Timestamp] - [Topic]

## Query
[Original user inquiry]

## Template Used
[Auto-selected template name and rationale]

## Context
[Files and patterns included in analysis]

## Gemini Response
[Complete response from Gemini CLI]

## Key Insights
- [Important findings]
- [Architectural insights]
- [Implementation recommendations]

## Links
- [🔙 Back to Workflow](../workflow-session.json)
- [📋 Implementation Plan](../IMPL_PLAN.md)
```

## Summary Management

### Summary Directory Structure
```
.summaries/
├── IMPL-001-summary.md         # Main task summaries  
├── IMPL-001.1-summary.md       # Subtask summaries
└── IMPL-001.1.1-summary.md     # Detailed subtask summaries
```

### Summary Template
```markdown
# Task Summary: [Task-ID] [Task Name]

## What Was Done
- [Files modified/created]
- [Functionality implemented]
- [Key changes made]

## Issues Resolved
- [Problems solved]
- [Bugs fixed]

## Links
- [🔙 Back to Task List](../TODO_LIST.md#[Task-ID])
- [📋 Implementation Plan](../IMPL_PLAN.md#[Task-ID])
```

## Brainstorming Integration

When `.brainstorming/` directory exists, documents MUST reference brainstorming results:

### In IMPL_PLAN.md
```markdown
## Brainstorming Integration
Based on multi-role analysis from `.brainstorming/`:
- **Architecture Insights**: [Reference system-architect/analysis.md]
- **User Experience Considerations**: [Reference ui-designer/analysis.md] 
- **Technical Requirements**: [Reference relevant role analyses]
- **Implementation Priorities**: [Reference synthesis-analysis.md]
```

### In JSON Task Context
```json
{
  "context": {
    "brainstorming_refs": [
      ".workflow/WFS-[topic-slug]/.brainstorming/system-architect/technical-specifications.md",
      ".workflow/WFS-[topic-slug]/.brainstorming/ui-designer/user-experience-plan.md"
    ],
    "requirements": ["derived from brainstorming analysis"]
  }
}
```

## Quality Control

### File System Validation
- Verify directory structure matches complexity level
- Validate file naming conventions
- Check for required vs optional directories
- Ensure proper file permissions

### Cross-Reference Validation
- All document links point to existing files
- Task IDs consistent across JSON files and TODO_LIST.md
- Brainstorming references are valid when .brainstorming/ exists
- Summary links properly reference parent tasks

### Performance Considerations
- Lazy directory creation (create only when needed)
- Efficient file structure scanning
- Minimal overhead for simple workflows
- Scalable organization for complex projects

## Error Recovery

### Missing File Scenarios
- **workflow-session.json missing**: Recreate from available documents
- **Required directories missing**: Auto-create with proper structure
- **Template files corrupted**: Regenerate from templates
- **Naming convention violations**: Auto-correct or flag for manual resolution

### Structure Consistency
- Validate structure level matches task complexity
- Auto-upgrade structure when complexity increases
- Maintain backward compatibility during transitions
- Preserve existing content during structure changes

---

**System ensures**: Consistent, scalable file organization with minimal overhead for simple tasks → comprehensive structure for complex projects

