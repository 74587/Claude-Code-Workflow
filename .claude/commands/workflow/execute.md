---
name: execute
description: Coordinate agents for existing workflow tasks with automatic discovery
usage: /workflow:execute
argument-hint: none
examples:
  - /workflow:execute
---

# Workflow Execute Command

## Overview
Coordinates agents for executing workflow tasks through automatic discovery and orchestration. Discovers plans, checks statuses, and executes ready tasks with complete context.

## Execution Philosophy
- **Discovery-first**: Auto-discover existing plans and tasks
- **Status-aware**: Execute only ready tasks
- **Context-rich**: Use complete task JSON data for agents
- **Progress tracking**: Update status after completion

## Flow Control Execution
**[FLOW_CONTROL]** marker indicates sequential step execution required:
- **Auto-trigger**: When `task.flow_control.pre_analysis` exists
- **Process**: Execute steps sequentially BEFORE implementation
  - Load dependency summaries and parent context
  - Execute CLI tools, scripts, and commands as specified
  - Pass context between steps via `${variable_name}`
  - Handle errors per step strategy

## Execution Flow

### 1. Discovery Phase
```
├── Locate workflow folder (current session)
├── Load workflow-session.json and IMPL_PLAN.md
├── Scan .task/ directory for task JSON files
├── Analyze task statuses and dependencies
└── Build execution queue of ready tasks
```

### 2. TodoWrite Coordination
Create comprehensive TodoWrite based on discovered tasks:

```markdown
# Workflow Execute Coordination
*Session: WFS-[topic-slug]*

- [ ] **TASK-001**: [Agent: code-developer] [FLOW_CONTROL] Design auth schema (IMPL-1.1)
- [ ] **TASK-002**: [Agent: code-developer] [FLOW_CONTROL] Implement auth logic (IMPL-1.2)
- [ ] **TASK-003**: [Agent: code-review-agent] Review implementations
- [ ] **TASK-004**: Update task statuses and session state

**Marker Legend**:
- [FLOW_CONTROL] = Agent must execute flow control steps with context accumulation
```

### 3. Agent Context Assignment

**Task JSON Structure**:
```json
{
  "id": "IMPL-1.1",
  "title": "Design auth schema",
  "status": "pending",
  "meta": { "type": "feature", "agent": "code-developer" },
  "context": {
    "requirements": ["JWT authentication", "User model design"],
    "focus_paths": ["src/auth/models", "tests/auth"],
    "acceptance": ["Schema validates JWT tokens"],
    "depends_on": [],
    "inherited": { "from": "IMPL-1", "context": ["..."] }
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "analyze_patterns",
        "action": "Analyze existing auth patterns",
        "command": "~/.claude/scripts/gemini-wrapper -p '@{src/auth/**/*} analyze patterns'",
        "output_to": "pattern_analysis",
        "on_error": "fail"
      }
    ],
    "implementation_approach": "Design flexible user schema",
    "target_files": ["src/auth/models/User.ts:UserSchema:10-50"]
  }
}
```

**Context Assignment Rules**:
- Use complete task JSON including flow_control
- Load dependency summaries from context.depends_on
- Execute flow_control.pre_analysis steps sequentially
- Direct agents to context.focus_paths
- Auto-add [FLOW_CONTROL] marker when pre_analysis exists

### 4. Agent Execution Pattern

```bash
Task(subagent_type="code-developer",
     prompt="[FLOW_CONTROL] Execute IMPL-1.2: Implement JWT authentication system with flow control

     Task Context: IMPL-1.2 - Flow control managed execution

     FLOW CONTROL EXECUTION:
     Execute the following steps sequentially with context accumulation:

     Step 1 (gather_context): Load dependency summaries
     Command: for dep in ${depends_on}; do cat .summaries/$dep-summary.md 2>/dev/null || echo "No summary for $dep"; done
     Output: dependency_context

     Step 2 (analyze_patterns): Analyze existing auth patterns
     Command: ~/.claude/scripts/gemini-wrapper -p '@{src/auth/**/*} analyze authentication patterns with context: [dependency_context]'
     Output: pattern_analysis

     Step 3 (implement): Implement JWT based on analysis
     Command: codex --full-auto exec 'Implement JWT using analysis: [pattern_analysis] and context: [dependency_context]' -s danger-full-access

     Session Context:
     - Workflow Directory: .workflow/WFS-user-auth/
     - TODO_LIST Location: .workflow/WFS-user-auth/TODO_LIST.md
     - Summaries Directory: .workflow/WFS-user-auth/.summaries/
     - Task JSON Location: .workflow/WFS-user-auth/.task/IMPL-1.2.json

     Implementation Guidance:
     - Approach: Design flexible user schema supporting JWT and OAuth authentication
     - Target Files: src/auth/models/User.ts:UserSchema:10-50
     - Focus Paths: src/auth/models, tests/auth
     - Dependencies: From context.depends_on
     - Inherited Context: [context.inherited]

     IMPORTANT:
     1. Execute flow control steps in sequence with error handling
     2. Accumulate context through step chain
     3. Provide detailed completion report for summary generation
     4. Mark task as completed - system will auto-generate summary and update TODO_LIST.md",
     description="Execute task with flow control step processing")
```

**Execution Protocol**:
- Sequential execution respecting dependencies
- Progress tracking through TodoWrite updates
- Status updates after completion
- Cross-agent result coordination

## File Structure & Analysis

### Workflow Structure
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json     # Session state
├── IMPL_PLAN.md             # Requirements
├── .task/                   # Task definitions
│   ├── IMPL-1.json
│   └── IMPL-1.1.json
└── .summaries/             # Completion summaries
```

### Task Status Logic
```
pending + dependencies_met → executable
completed → skip
blocked → skip until dependencies clear
```

### Agent Assignment
- **task.agent field**: Use specified agent
- **task.type fallback**:
  - "feature" → code-developer
  - "test" → code-review-test-agent
  - "review" → code-review-agent

## Status Management & Coordination

### Task Status Updates
```json
// Before execution
{ "id": "IMPL-1.2", "status": "pending", "execution": { "attempts": 0 } }

// After execution
{ "id": "IMPL-1.2", "status": "completed", "execution": { "attempts": 1, "last_attempt": "2025-09-08T14:30:00Z" } }
```

### Coordination Strategies
- **Dependencies**: Execute in dependency order
- **Agent Handoffs**: Pass results between agents
- **Progress Updates**: Update TodoWrite and JSON files
- **Context Distribution**: Complete task JSON + workflow context
- **Focus Areas**: Direct agents to specific paths from task.context.focus_paths

## Error Handling

### Discovery Issues
```bash
❌ No active workflow session → Use: /workflow:session:start "project"
⚠️ All tasks completed/blocked → Check: /context for status
❌ Missing task files → Fix: /task/create or repair references
```

### Execution Recovery
- **Failed Agent**: Retry with adjusted context
- **Blocked Dependencies**: Skip and continue with available tasks
- **Context Issues**: Reload from JSON files and session state

## Integration & Next Steps

### Automatic Behaviors
- Discovery on start - analyze workflow folder structure
- TodoWrite coordination - generate based on discovered tasks
- Agent context preparation - use complete task JSON data
- Status synchronization - update JSON files after completion

### Next Actions
```bash
/context                  # View updated task status
/task:execute IMPL-X      # Execute specific remaining tasks
/workflow:review          # Move to review phase when complete
```

