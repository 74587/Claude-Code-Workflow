---
name: create
description: Create a new issue or change request
usage: /workflow:issue:create "issue description"

examples:
  - /workflow:issue:create "Add OAuth2 social login support"
  - /workflow:issue:create "Fix user avatar security vulnerability"
---

# Create Workflow Issue (/workflow:issue:create)

## Purpose
Create a new issue or change request within the current workflow session.

## Usage
```bash
/workflow:issue:create "issue description"
```

## Automatic Behavior

### Issue ID Generation
- Generates unique ID: ISS-001, ISS-002, etc.
- Sequential numbering within session
- Stored in session's .issues/ directory

### Type Detection
Automatically detects issue type from description:
- **Bug**: Contains words like "fix", "error", "bug", "broken"
- **Feature**: Contains words like "add", "implement", "create", "new"
- **Optimization**: Contains words like "improve", "optimize", "performance"
- **Documentation**: Contains words like "document", "readme", "docs"
- **Refactor**: Contains words like "refactor", "cleanup", "restructure"

### Priority Assessment
Auto-assigns priority based on keywords:
- **Critical**: "critical", "urgent", "blocker", "security"
- **High**: "important", "major", "significant"
- **Medium**: Default for most issues
- **Low**: "minor", "enhancement", "nice-to-have"

## Issue Storage

### File Structure
```
.workflow/WFS-[session]/.issues/
├── ISS-001.json          # Issue metadata
├── ISS-002.json          # Another issue
└── issue-registry.json   # Issue index
```

### Issue Metadata
Each issue stores:
```json
{
  "id": "ISS-001",
  "title": "Add OAuth2 social login support",
  "type": "feature",
  "priority": "high",
  "status": "open",
  "created_at": "2025-09-08T10:00:00Z",
  "category": "authentication",
  "estimated_impact": "medium",
  "blocking": false,
  "session_id": "WFS-oauth-integration"
}
```

## Session Integration

### Active Session Check
- Uses current active session (marker file)
- Creates .issues/ directory if needed
- Updates session's issue tracking

### TodoWrite Integration
Optionally adds to task list:
- Creates todo for issue investigation
- Links issue to implementation tasks
- Updates progress tracking

## Output
Displays:
- Generated issue ID
- Detected type and priority
- Storage location
- Integration status
- Quick actions available

## Quick Actions
After creation:
- **View**: `/workflow:issue:list`
- **Update**: `/workflow:issue:update ISS-001`
- **Integrate**: Link to workflow tasks
- **Close**: `/workflow:issue:close ISS-001`

## Error Handling
- **No active session**: Prompts to start session first
- **Directory creation**: Handles permission issues
- **Duplicate description**: Warns about similar issues
- **Invalid description**: Prompts for meaningful description

---

**Result**: New issue created and ready for management within workflow