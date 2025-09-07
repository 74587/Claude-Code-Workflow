---
name: workflow-issue
description: Comprehensive issue and change request management within workflow sessions
usage: /workflow:issue <subcommand> [options]
argument-hint: create|list|update|integrate|close [additional parameters]
examples:
  - /workflow:issue create --type=feature "Add OAuth2 social login support"
  - /workflow:issue create --type=bug --priority=high "User avatar security vulnerability"
  - /workflow:issue list
  - /workflow:issue list --status=open --priority=high
  - /workflow:issue update ISS-001 --status=integrated --priority=medium
  - /workflow:issue integrate ISS-001 --position=after-current
  - /workflow:issue close ISS-002 --reason="Duplicate of ISS-001"
---

### 🚀 Command Overview: `/workflow:issue`

-   **Purpose**: A comprehensive issue and change request management system for use within workflow sessions.
-   **Function**: Enables dynamic creation, tracking, integration, and closure of tasks and changes.

### 🏛️ Subcommand Architecture

-   **`create`**: Creates a new issue or change request.
-   **`list`**: Lists and filters existing issues.
-   **`update`**: Modifies the status, priority, or other attributes of an issue.
-   **`integrate`**: Integrates an issue into the current workflow plan.
-   **`close`**: Closes a completed or obsolete issue.

### 📜 Core Principles

-   **Dynamic Change Management**: @~/.claude/workflows/dynamic-change-management.md
-   **Session State Management**: @~/.claude/workflows/session-management-principles.md
-   **TodoWrite Coordination Rules**: @~/.claude/workflows/todowrite-coordination-rules.md

### (1) Subcommand: `create`

Creates a new issue or change request.

-   **Syntax**: `/workflow:issue create [options] "issue description"`
-   **Options**:
    -   `--type=<type>`: `feature|bug|optimization|refactor|documentation`
    -   `--priority=<priority>`: `critical|high|medium|low`
    -   `--category=<category>`: `frontend|backend|database|testing|deployment`
    -   `--estimated-impact=<impact>`: `high|medium|low`
    -   `--blocking`: Marks the issue as a blocker.
    -   `--parent=<issue-id>`: Specifies a parent issue for creating a sub-task.

### (2) Subcommand: `list`

Lists and filters all issues related to the current workflow.

-   **Syntax**: `/workflow:issue list [options]`
-   **Options**:
    -   `--status=<status>`: Filter by `open|integrated|completed|closed`.
    -   `--type=<type>`: Filter by issue type.
    -   `--priority=<priority>`: Filter by priority level.
    -   `--category=<category>`: Filter by category.
    -   `--blocking-only`: Shows only blocking issues.
    -   `--sort=<field>`: Sort by `priority|created|updated|impact`.
    -   `--detailed`: Displays more detailed information for each issue.

### (3) Subcommand: `update`

Updates attributes of an existing issue.

-   **Syntax**: `/workflow:issue update <issue-id> [options]`
-   **Options**:
    -   `--status=<status>`: Update issue status.
    -   `--priority=<priority>`: Update issue priority.
    -   `--description="<new-desc>"`: Update the description.
    -   `--category=<category>`: Update the category.
    -   `--estimated-impact=<impact>`: Update estimated impact.
    -   `--add-comment="<comment>"`: Add a new comment to the issue history.
    -   `--assign-to=<assignee>`: Assign the issue to a person or team.
    -   `--blocking` / `--non-blocking`: Change the blocking status.

### (4) Subcommand: `integrate`

Integrates a specified issue into the current workflow plan.

-   **Syntax**: `/workflow:issue integrate <issue-id> [options]`
-   **Options**:
    -   `--position=<position>`: `immediate|after-current|next-phase|end-of-workflow`
    -   `--mode=<mode>`: `insert|replace|merge`
    -   `--impact-analysis`: Performs a detailed impact analysis before integration.
    -   `--auto-replan`: Automatically replans the workflow after integration.
    -   `--preserve-dependencies`: Tries to maintain existing task dependencies.
    -   `--dry-run`: Simulates integration without making actual changes.
-   **Execution Logic**:
    ```pseudo
    FUNCTION integrate_issue(issue_id, options):
      // Perform an analysis of how the issue affects the project plan.
      analysis_report = create_impact_analysis(issue_id, options)
      present_report_to_user(analysis_report)
  
      // Require explicit user confirmation before modifying the workflow.
      user_response = get_user_input("Confirm integration? (y/N)")
  
      IF user_response is "y":
        log("Executing integration...")
        // These steps correspond to the "集成步骤" in the example output.
        update_document("IMPL_PLAN.md")
        update_document("TODO_CHECKLIST.md")
        update_tool_state("TodoWrite")
        update_session_file("workflow-session.json")
        log("Integration complete!")
      ELSE:
        log("Integration cancelled by user.")
        HALT_OPERATION()
    END FUNCTION
    ```

### (5) Subcommand: `close`

Closes an issue that is completed or no longer relevant.

-   **Syntax**: `/workflow:issue close <issue-id> [options]`
-   **Options**:
    -   `--reason=<reason>`: `completed|duplicate|wont-fix|invalid`
    -   `--comment="<comment>"`: Provides a final closing comment.
    -   `--reference=<issue-id>`: References a related issue (e.g., a duplicate).
    -   `--auto-cleanup`: Automatically cleans up references to this issue in other documents.

### ✨ Advanced Features

-   **Batch Operations**:
    -   Update multiple issues at once: `/workflow:issue update ISS-001,ISS-002 --priority=high`
    -   Integrate a parent issue with its children: `/workflow:issue integrate ISS-001,ISS-001-1,ISS-001-2`
-   **Smart Analysis**:
    -   Performs conflict detection, dependency analysis, priority suggestions, and effort estimations.
-   **Reporting**:
    -   Generate reports on impact or priority: `/workflow:issue report --type=impact`

### 🤝 Command Integrations

-   **Automatic Triggers**:
    -   `/workflow:context`: Automatically displays the status of relevant issues.
    -   `/workflow:replan`: Can be automatically called by `integrate` to update the plan.
    -   `/workflow:sync`: Ensures issue status is synchronized with project documents.
-   **Shared Data**:
    -   `workflow-session.json`: Stores core issue data and statistics.
    -   `WORKFLOW_ISSUES.md`: Provides a human-readable tracking document.
    -   `CHANGE_LOG.md`: Logs all historical changes related to issues.

### 🗄️ File Generation System

-   **Process Flow**: All issue operations trigger a file system update.
    `Issue Operation` -> `Generate/Update issues/ISS-###.json` -> `Update WORKFLOW_ISSUES.md` -> `Update workflow-session.json`

### 📄 Template: Individual Issue File (`issues/ISS-###.json`)

This file stores all details for a single issue.

```json
{
  "id": "ISS-003",
  "title": "Add OAuth2 social login support",
  "description": "Add OAuth2 social login support (Google, GitHub, Facebook)",
  "type": "feature",
  "priority": "high",
  "category": "backend",
  "status": "open",
  "estimated_impact": "medium",
  "blocking": false,
  "created_at": "2025-01-15T14:30:00Z",
  "created_by": "WFS-2025-001",
  "parent_issue": null,
  "sub_issues": [],
  "integration": {
    "status": "pending",
    "position": "after-current",
    "estimated_effort": "6h",
    "dependencies": []
  },
  "history": [
    {
      "action": "created",
      "timestamp": "2025-01-15T14:30:00Z",
      "details": "Initial issue creation"
    }
  ],
  "metadata": {
    "session_id": "WFS-2025-001",
    "version": "1.0"
  }
}
```

### 📋 Template: Tracking Master File (`WORKFLOW_ISSUES.md`)

This Markdown file provides a human-readable overview of all issues.

```markdown
# Workflow Issues Tracking
*Session: WFS-2025-001 | Updated: 2025-01-15 14:30:00*

## Issue Summary
- **Total Issues**: 3
- **Open**: 2
- **In Progress**: 1
- **Closed**: 0
- **Blocking Issues**: 0

## Open Issues

### 🔥 High Priority
- **[ISS-003](issues/ISS-003.json)** - Add OAuth2 social login support
  - Type: Feature | Category: Backend | Created: 2025-01-15
  - Status: Open | Impact: Medium
  - Integration: Pending (after current phase)

- **[ISS-001](issues/ISS-001.json)** - User avatar security vulnerability
  - Type: Bug | Category: Frontend | Created: 2025-01-14
  - Status: Open | Impact: High | 🚫 **BLOCKING**
  - Integration: Immediate (critical security fix)

### 📊 Medium Priority
- **[ISS-002](issues/ISS-002.json)** - Database performance optimization
  - Type: Optimization | Category: Database | Created: 2025-01-14
  - Status: In Progress | Impact: High
  - Integration: Phase 3 (optimization phase)

## Integration Queue
1. **ISS-001** - Immediate (blocking security issue)
2. **ISS-002** - Phase 3 (performance optimization)
3. **ISS-003** - After current phase (new feature)

## Recent Activity
- **2025-01-15 14:30** - ISS-003 created: Add OAuth2 social login support
- **2025-01-15 10:15** - ISS-002 status updated: In Progress
- **2025-01-14 16:45** - ISS-001 created: User avatar security vulnerability

---
*Generated by /workflow:issue create*
```

### 📁 Template: File Storage Structure

The command organizes all related files within a dedicated workflow directory.

```
.workflow/WFS-[topic-slug]/
├── WORKFLOW_ISSUES.md          # 主问题跟踪文件
├── issues/                     # 个别问题详情目录
│   ├── ISS-001.json           # 问题详细信息
│   ├── ISS-002.json
│   ├── ISS-003.json
│   └── archive/               # 已关闭问题存档
│       └── ISS-###.json
├── issue-reports/             # 问题报告和分析
│   ├── priority-analysis.md
│   ├── integration-impact.md
│   └── resolution-summary.md
└── workflow-session.json      # 会话状态更新
```

### 🔄 Template: Session State Update (`workflow-session.json`)

This file is updated after each issue operation to reflect the new state.

```json
{
  "issues": {
    "total_count": 3,
    "open_count": 2,
    "blocking_count": 1,
    "last_issue_id": "ISS-003",
    "integration_queue": ["ISS-001", "ISS-002", "ISS-003"]
  },
  "documents": {
    "WORKFLOW_ISSUES.md": {
      "status": "updated",
      "path": ".workflow/WFS-[topic-slug]/WORKFLOW_ISSUES.md",
      "last_updated": "2025-01-15T14:30:00Z",
      "type": "issue_tracking"
    },
    "issues": {
      "ISS-003.json": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/issues/ISS-003.json",
        "created_at": "2025-01-15T14:30:00Z",
        "type": "issue_detail",
        "priority": "high",
        "blocking": false
      }
    }
  },
  "recent_activity": [
    {
      "type": "issue_created",
      "issue_id": "ISS-003",
      "timestamp": "2025-01-15T14:30:00Z",
      "description": "Add OAuth2 social login support"
    }
  ]
}
```

### 🧱 Issue Data Structure

The canonical JSON structure for an issue object.

```json
{
  "id": "ISS-001",
  "type": "feature|bug|optimization|refactor|documentation", 
  "status": "open|integrated|in-progress|completed|closed",
  "priority": "critical|high|medium|low",
  "category": "frontend|backend|database|testing|deployment",
  "blocking": false,

  "metadata": {
    "title": "OAuth2 social login support",
    "description": "Add OAuth2 integration for Google, GitHub, Facebook",
    "created_at": "2025-01-15T14:30:00Z",
    "updated_at": "2025-01-15T15:45:00Z",
    "created_by": "workflow-session:WFS-2025-001"
  },

  "estimation": {
    "impact": "high|medium|low",
    "effort": "2-4 hours|1-2 days|3-5 days",
    "complexity": "simple|medium|complex"
  },

  "integration": {
    "integrated_at": "2025-01-15T16:00:00Z",
    "position": "after-current",
    "affected_documents": ["IMPL_PLAN.md"],
    "added_tasks": 5,
    "modified_tasks": 2
  },

  "relationships": {
    "parent": "ISS-000",
    "children": ["ISS-001-1", "ISS-001-2"],
    "blocks": ["ISS-002"],
    "blocked_by": [],
    "relates_to": ["ISS-003"]
  },

  "comments": [
    {
      "timestamp": "2025-01-15T15:30:00Z",
      "content": "需要考虑用户隐私设置集成",
      "type": "note|decision|change"
    }
  ],

  "closure": {
    "closed_at": "2025-01-16T10:30:00Z", 
    "reason": "completed|duplicate|wont-fix|invalid",
    "final_comment": "功能实现完成，测试通过"
  }
}
```