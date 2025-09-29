---
name: start
description: Discover existing sessions or start a new workflow session with intelligent session management
usage: /workflow:session:start [task_description]
argument-hint: [optional: task description for new session]
examples:
  - /workflow:session:start "implement OAuth2 authentication"
  - /workflow:session:start "fix login bug"
  - /workflow:session:start
---

# Start Workflow Session (/workflow:session:start)

## Overview
Manages workflow sessions - discovers existing active sessions or creates new ones.

## Usage
```bash
/workflow:session:start                    # Discover/select existing sessions
/workflow:session:start "task description" # Create new session
```

## Implementation Flow

### Step 1: Check for Active Sessions
```bash
ls .workflow/.active-* 2>/dev/null
```

### Step 2: List Existing Sessions
```bash
ls -1 .workflow/WFS-* 2>/dev/null | head -5
```

### Step 3: Create New Session (if needed)
```bash
mkdir -p .workflow
echo "auth-system" | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]'
```

### Step 4: Create Session Directory Structure
```bash
mkdir -p .workflow/WFS-auth-system/.process
mkdir -p .workflow/WFS-auth-system/.task
mkdir -p .workflow/WFS-auth-system/.summaries
```

### Step 5: Create Session Metadata
```bash
echo '{"session_id":"WFS-auth-system","project":"authentication system","status":"planning"}' > .workflow/WFS-auth-system/workflow-session.json
```

### Step 6: Mark Session as Active
```bash
touch .workflow/.active-WFS-auth-system
```

### Step 7: Clean Old Active Markers (if creating new)
```bash
rm .workflow/.active-WFS-* 2>/dev/null
```

## Simple Bash Commands

### Basic Operations
- **Check sessions**: `ls .workflow/.active-*`
- **List sessions**: `ls .workflow/WFS-*`
- **Create directory**: `mkdir -p .workflow/WFS-session-name/.process`
- **Create file**: `echo 'content' > .workflow/session/file.json`
- **Mark active**: `touch .workflow/.active-WFS-session-name`
- **Clean markers**: `rm .workflow/.active-*`

### No Complex Logic
- No variables or functions
- No conditional statements
- No loops or pipes
- Direct bash commands only

## Related Commands
- `/workflow:plan` - Uses this for session management
- `/workflow:execute` - Uses this for session discovery
- `/workflow:session:status` - Shows session information