---
name: resume
description: Intelligent workflow session resumption with automatic progress analysis
usage: /workflow:resume "<session-id>"
argument-hint: "session-id for workflow session to resume"
examples:
  - /workflow:resume "WFS-user-auth"
  - /workflow:resume "WFS-api-integration"
  - /workflow:resume "WFS-database-migration"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Sequential Workflow Resume Command

## Usage
```bash
/workflow:resume "<session-id>"
```

## Purpose
**Sequential command coordination for workflow resumption** by first analyzing current session status, then continuing execution with special resume context. This command orchestrates intelligent session resumption through two-step process.

## Command Coordination Workflow

### Phase 1: Status Analysis
1. **Call status command**: Execute `/workflow:status` to analyze current session state
2. **Verify session information**: Check session ID, progress, and current task status
3. **Identify resume point**: Determine where workflow was interrupted

### Phase 2: Resume Execution
1. **Call execute with resume flag**: Execute `/workflow:execute --resume-session="{session-id}"`
2. **Pass session context**: Provide analyzed session information to execute command
3. **Direct agent execution**: Skip discovery phase, directly enter TodoWrite and agent execution

## Implementation Protocol

### Sequential Command Execution
```bash
# Phase 1: Analyze current session status
SlashCommand(command="/workflow:status")

# Phase 2: Resume execution with special flag
SlashCommand(command="/workflow:execute --resume-session=\"{session-id}\"")
```

### Progress Tracking
```javascript
TodoWrite({
  todos: [
    {
      content: "Analyze current session status and progress",
      status: "in_progress",
      activeForm: "Analyzing session status"
    },
    {
      content: "Resume workflow execution with session context",
      status: "pending",
      activeForm: "Resuming workflow execution"
    }
  ]
});
```

## Resume Information Flow

### Status Analysis Results
The `/workflow:status` command provides:
- **Session ID**: Current active session identifier
- **Current Progress**: Completed, in-progress, and pending tasks
- **Interruption Point**: Last executed task and next pending task
- **Session State**: Overall workflow status

### Execute Command Context
The special `--resume-session` flag tells `/workflow:execute`:
- **Skip Discovery**: Don't search for sessions, use provided session ID
- **Direct Execution**: Go straight to TodoWrite generation and agent launching
- **Context Restoration**: Use existing session state and summaries
- **Resume Point**: Continue from identified interruption point

## Error Handling

### Session Validation Failures
- **Session not found**: Report missing session, suggest available sessions
- **Session inactive**: Recommend activating session first
- **Status command fails**: Retry once, then report analysis failure

### Execute Resumption Failures
- **No pending tasks**: Report workflow completion status
- **Execute command fails**: Report resumption failure, suggest manual intervention

## Success Criteria
1. **Status analysis complete**: Session state properly analyzed and reported
2. **Execute command launched**: Resume execution started with proper context
3. **Agent coordination**: TodoWrite and agent execution initiated successfully
4. **Context preservation**: Session state and progress properly maintained

---
*Sequential command coordination for workflow session resumption*