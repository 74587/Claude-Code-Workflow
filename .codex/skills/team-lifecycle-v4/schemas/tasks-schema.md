# Tasks Schema (JSON)

## 1. Overview

Codex uses `tasks.json` as the single source of truth for task state management, replacing Claude Code's `TaskCreate`/`TaskUpdate` API calls and CSV-based state tracking. Each session has one `tasks.json` file and multiple `discoveries/{task_id}.json` files.

## 2. tasks.json Top-Level Structure

```json
{
  "session_id": "string — unique session identifier (e.g., tlv4-auth-system-20260324)",
  "pipeline": "string — one of: spec-only | impl-only | full-lifecycle | fe-only | fullstack | full-lifecycle-fe",
  "requirement": "string — original user requirement text",
  "created_at": "string — ISO 8601 timestamp with timezone",
  "supervision": "boolean — whether CHECKPOINT tasks are active (default: true)",
  "completed_waves": "number[] — list of completed wave numbers",
  "active_agents": "object — map of task_id -> agent_id for currently running agents",
  "tasks": "object — map of task_id -> TaskEntry"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique session identifier, format: `tlv4-<topic>-<YYYYMMDD>` |
| `pipeline` | string | Selected pipeline name from pipelines.md |
| `requirement` | string | Original user requirement, verbatim |
| `created_at` | string | ISO 8601 creation timestamp |
| `supervision` | boolean | Enable/disable CHECKPOINT tasks |
| `completed_waves` | number[] | Waves that have finished execution |
| `active_agents` | object | Runtime tracking: `{ "TASK-ID": "agent-id" }` |
| `tasks` | object | Task registry: `{ "TASK-ID": TaskEntry }` |

## 3. TaskEntry Schema

```json
{
  "title": "string — short task title",
  "description": "string — detailed task description",
  "role": "string — role name matching roles/<role>/role.md",
  "pipeline_phase": "string — phase from pipelines.md Task Metadata Registry",
  "deps": "string[] — task IDs that must complete before this task starts",
  "context_from": "string[] — task IDs whose discoveries to load as upstream context",
  "wave": "number — execution wave (1-based, determines parallel grouping)",
  "status": "string — one of: pending | in_progress | completed | failed | skipped",
  "findings": "string | null — summary of task output (max 500 chars)",
  "quality_score": "number | null — 0-100, set by reviewer roles only",
  "supervision_verdict": "string | null — pass | warn | block, set by CHECKPOINT tasks only",
  "error": "string | null — error description if status is failed or skipped"
}
```

### Field Definitions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | Yes | - | Human-readable task name |
| `description` | string | Yes | - | What the task should accomplish |
| `role` | string | Yes | - | One of: analyst, writer, planner, implementer, tester, reviewer, supervisor, orchestrator, architect, security-expert, performance-optimizer, data-engineer, devops-engineer, ml-engineer |
| `pipeline_phase` | string | Yes | - | One of: research, product-brief, requirements, architecture, epics, readiness, checkpoint, planning, arch-detail, orchestration, implementation, validation, review |
| `deps` | string[] | Yes | `[]` | Task IDs that block execution. All must be `completed` before this task starts |
| `context_from` | string[] | Yes | `[]` | Task IDs whose `discoveries/{id}.json` files are loaded as upstream context |
| `wave` | number | Yes | - | Execution wave number. Tasks in the same wave run in parallel |
| `status` | string | Yes | `"pending"` | Current task state |
| `findings` | string\|null | No | `null` | Populated on completion. Summary of key output |
| `quality_score` | number\|null | No | `null` | Only set by QUALITY-* and REVIEW-* tasks |
| `supervision_verdict` | string\|null | No | `null` | Only set by CHECKPOINT-* tasks |
| `error` | string\|null | No | `null` | Set when status is `failed` or `skipped` |

### Status Lifecycle

```
pending -> in_progress -> completed
                       -> failed
pending -> skipped (when upstream dependency failed/skipped)
```

## 4. discoveries/{task_id}.json Schema

Each task writes a discovery file on completion. This replaces Claude Code's `team_msg(type="state_update")`.

```json
{
  "task_id": "string — matches the task key in tasks.json",
  "worker": "string — same as task_id (identifies the producing agent)",
  "timestamp": "string — ISO 8601 completion timestamp",
  "type": "string — same as pipeline_phase",
  "status": "string — completed | failed",
  "findings": "string — summary (max 500 chars)",
  "quality_score": "number | null",
  "supervision_verdict": "string | null — pass | warn | block",
  "error": "string | null",
  "data": {
    "key_findings": "string[] — max 5 items, each under 100 chars",
    "decisions": "string[] — include rationale, not just choice",
    "files_modified": "string[] — only for implementation tasks",
    "verification": "string — self-validated | peer-reviewed | tested",
    "risks_logged": "number — CHECKPOINT only: count of risks",
    "blocks_detected": "number — CHECKPOINT only: count of blocking issues"
  },
  "artifacts_produced": "string[] — paths to generated artifact files"
}
```

## 5. Validation Rules

### Structural Validation

| Rule | Description |
|------|-------------|
| Unique IDs | Every key in `tasks` must be unique |
| Valid deps | Every entry in `deps` must reference an existing task ID |
| Valid context_from | Every entry in `context_from` must reference an existing task ID |
| No cycles | Dependency graph must be a DAG (no circular dependencies) |
| Wave ordering | If task A depends on task B, then A.wave > B.wave |
| Role exists | `role` must match a directory in `.codex/skills/team-lifecycle-v4/roles/` |
| Pipeline phase valid | `pipeline_phase` must be one of the defined phases |

### Runtime Validation

| Rule | Description |
|------|-------------|
| Status transitions | Only valid transitions: pending->in_progress, in_progress->completed/failed, pending->skipped |
| Dependency check | A task can only move to `in_progress` if all `deps` are `completed` |
| Skip propagation | If any dep is `failed` or `skipped`, task is automatically `skipped` |
| Discovery required | A `completed` task MUST have a corresponding `discoveries/{task_id}.json` file |
| Findings required | A `completed` task MUST have non-null `findings` |
| Error required | A `failed` or `skipped` task MUST have non-null `error` |
| Supervision fields | CHECKPOINT tasks MUST set `supervision_verdict` on completion |
| Quality fields | QUALITY-*/REVIEW-* tasks SHOULD set `quality_score` on completion |

## 6. Semantic Mapping: Claude Code <-> Codex

### TaskCreate Mapping

| Claude Code `TaskCreate` Field | Codex `tasks.json` Equivalent |
|-------------------------------|-------------------------------|
| `title` | `tasks[id].title` |
| `description` | `tasks[id].description` |
| `assignee` (role) | `tasks[id].role` |
| `status: "open"` | `tasks[id].status: "pending"` |
| `metadata.pipeline_phase` | `tasks[id].pipeline_phase` |
| `metadata.deps` | `tasks[id].deps` |
| `metadata.context_from` | `tasks[id].context_from` |
| `metadata.wave` | `tasks[id].wave` |

### TaskUpdate Mapping

| Claude Code `TaskUpdate` Operation | Codex Equivalent |
|------------------------------------|------------------|
| `status: "in_progress"` | Write `tasks[id].status = "in_progress"` in tasks.json |
| `status: "completed"` + findings | Write `tasks[id].status = "completed"` + Write `discoveries/{id}.json` |
| `status: "failed"` + error | Write `tasks[id].status = "failed"` + `tasks[id].error` |
| Attach result metadata | Write `discoveries/{id}.json` with full data payload |

### team_msg Mapping

| Claude Code `team_msg` Operation | Codex Equivalent |
|---------------------------------|------------------|
| `team_msg(operation="get_state", role=<upstream>)` | Read `tasks.json` + Read `discoveries/{upstream_id}.json` |
| `team_msg(type="state_update", payload={...})` | Write `discoveries/{task_id}.json` |
| `team_msg(type="broadcast", ...)` | Write to `wisdom/*.md` (session-wide visibility) |

## 7. Column Lifecycle Correspondence

Maps the conceptual "columns" from Claude Code's task board to tasks.json status values.

| Claude Code Column | tasks.json Status | Transition Trigger |
|-------------------|-------------------|-------------------|
| Backlog | `pending` | Task created in tasks.json |
| In Progress | `in_progress` | `spawn_agent` called for task |
| Blocked | `pending` (deps not met) | Implicit: deps not all `completed` |
| Done | `completed` | Agent writes discovery + coordinator updates status |
| Failed | `failed` | Agent reports error or timeout |
| Skipped | `skipped` | Upstream dependency failed/skipped |

## 8. Example: Full tasks.json

```json
{
  "session_id": "tlv4-auth-system-20260324",
  "pipeline": "full-lifecycle",
  "requirement": "Design and implement user authentication system with OAuth2 and RBAC",
  "created_at": "2026-03-24T10:00:00+08:00",
  "supervision": true,
  "completed_waves": [1],
  "active_agents": {
    "DRAFT-001": "agent-abc123"
  },
  "tasks": {
    "RESEARCH-001": {
      "title": "Domain research",
      "description": "Explore auth domain: OAuth2 flows, RBAC patterns, competitor analysis, integration constraints",
      "role": "analyst",
      "pipeline_phase": "research",
      "deps": [],
      "context_from": [],
      "wave": 1,
      "status": "completed",
      "findings": "Identified OAuth2+RBAC pattern, 5 integration points, SSO requirement from enterprise customers",
      "quality_score": null,
      "supervision_verdict": null,
      "error": null
    },
    "DRAFT-001": {
      "title": "Product brief",
      "description": "Generate product brief from research context, define vision, problem, users, success metrics",
      "role": "writer",
      "pipeline_phase": "product-brief",
      "deps": ["RESEARCH-001"],
      "context_from": ["RESEARCH-001"],
      "wave": 2,
      "status": "in_progress",
      "findings": null,
      "quality_score": null,
      "supervision_verdict": null,
      "error": null
    },
    "DRAFT-002": {
      "title": "Requirements PRD",
      "description": "Write requirements document with functional/non-functional reqs, user stories, acceptance criteria",
      "role": "writer",
      "pipeline_phase": "requirements",
      "deps": ["DRAFT-001"],
      "context_from": ["DRAFT-001"],
      "wave": 3,
      "status": "pending",
      "findings": null,
      "quality_score": null,
      "supervision_verdict": null,
      "error": null
    }
  }
}
```
