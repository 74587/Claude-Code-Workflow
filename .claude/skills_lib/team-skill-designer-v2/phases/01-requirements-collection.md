# Phase 1: Requirements Collection (Task-Driven Inference)

Analyze task requirements, infer appropriate roles, and generate team configuration.

## Objective

- Determine team name and display name
- Analyze task description to infer needed roles (coordinator always included)
- For each role: name, responsibility type, task prefix, capabilities
- Build pipeline from inferred roles
- Generate `team-config.json`

## Input

| Source | Description |
|--------|-------------|
| User request | `$ARGUMENTS` or interactive input |
| Specification | `specs/team-design-patterns.md` (read in Phase 0) |

## Execution Steps

### Step 1: Team Name + Task Description

Prompt the user for team name and core task description.

```
AskUserQuestion({
  questions: [
    { question: "Team name (lowercase, used as .claude/skills/team-{name}/)",
      header: "Team Name",
      options: ["custom", "dev", "spec", "security"] },
    { question: "Core task of this team? (system will infer roles automatically)",
      header: "Task Desc",
      options: ["custom", "fullstack dev", "code review + refactor", "doc writing"] }
  ]
})
```

### Step 2: Role Inference (Task-Driven)

Coordinator is **always** included. Scan the task description for intent signals to infer worker roles.

#### Role Signal Detection Table

| Role | Keywords (CN/EN) | Responsibility Type | Task Prefix |
|------|-------------------|---------------------|-------------|
| planner | plan, design, architect, explore, analyze requirements | Orchestration | PLAN |
| executor | implement, develop, build, code, create, refactor, migrate | Code generation | IMPL |
| tester | test, verify, validate, QA, regression, fix, bug | Validation | TEST |
| reviewer | review, audit, inspect, code quality | Read-only analysis | REVIEW |
| analyst | research, analyze, investigate, diagnose | Orchestration | RESEARCH |
| writer | document, write doc, generate report | Code generation | DRAFT |
| debugger | debug, troubleshoot, root cause | Orchestration | DEBUG |
| security | security, vulnerability, OWASP, compliance | Read-only analysis | SEC |

**Inference**: For each role, check if task description matches any keyword. Add matched roles to the inferred list.

#### Implicit Role Completion Table

| Condition | Add Role | Reason |
|-----------|----------|--------|
| Has executor, missing planner | Add planner (before executor) | Code needs planning first |
| Has executor, missing tester | Add tester (after executor) | Code needs validation |
| Has debugger, missing tester | Add tester | Bug fixes need verification |
| Has writer, missing reviewer | Add reviewer | Documents need review |

**Minimum guarantee**: If fewer than 2 worker roles inferred, fall back to standard set: planner + executor + tester + reviewer.

**Pipeline type tag** (for Step 5):

| Condition | Pipeline Type |
|-----------|---------------|
| Has writer role | Document |
| Has debugger role | Debug |
| Default | Standard |

### Step 3: Role Confirmation (Interactive)

Present the inferred roles to the user for confirmation.

```
AskUserQuestion({
  questions: [
    { question: "Inferred roles: <roles-summary>. Adjust?",
      header: "Confirm",
      options: ["Confirm (Recommended)", "Add role", "Remove role", "Re-describe"] }
  ]
})
```

| User Choice | Action |
|-------------|--------|
| Confirm | Proceed with inferred roles |
| Add role | AskUserQuestion for new role name + responsibility type |
| Remove role | AskUserQuestion for which role to remove |
| Re-describe | Return to Step 1, re-enter task description |

### Step 4: Capability Assignment (Per Role)

For each worker role, assign capabilities based on responsibility type.

#### Tool Assignment Table

| Responsibility Type | Extra Tools (beyond base set) | Adaptive Routing |
|---------------------|-------------------------------|------------------|
| Read-only analysis | Task(*) | No |
| Code generation | Write(*), Edit(*), Task(*) | Yes |
| Orchestration | Write(*), Task(*) | Yes |
| Validation | Write(*), Edit(*), Task(*) | No |

> **Base tools** (all roles): SendMessage, TaskUpdate, TaskList, TaskGet, TodoWrite, Read, Bash, Glob, Grep

#### Message Type Assignment Table

| Responsibility Type | Message Types |
|---------------------|---------------|
| Read-only analysis | `<role>_result` (analysis complete), `error` |
| Code generation | `<role>_complete`, `<role>_progress`, `error` |
| Orchestration | `<role>_ready`, `<role>_progress`, `error` |
| Validation | `<role>_result`, `fix_required`, `error` |

**Coordinator** gets special tools: TeamCreate, TeamDelete, AskUserQuestion, TaskCreate + all base tools.
**Coordinator** message types: `plan_approved`, `plan_revision`, `task_unblocked`, `shutdown`, `error`.

#### Toolbox Assignment Table

| Responsibility Type | Commands | Subagents | CLI Tools |
|---------------------|----------|-----------|-----------|
| Read-only analysis | review, analyze | (none) | gemini (analysis), codex (review) |
| Code generation | implement, validate | code-developer | (none) |
| Orchestration | explore, plan | cli-explore-agent, cli-lite-planning-agent | gemini (analysis) |
| Validation | validate | code-developer | (none) |

**Coordinator** always gets: commands=[dispatch, monitor], no subagents, no CLI tools.

### Step 5: Pipeline Definition

Sort roles into execution stages by weight, then build dependency chain.

#### Stage Weight Table

| Role | Weight | Stage Position |
|------|--------|----------------|
| analyst, debugger, security | 1 | Analysis/Exploration |
| planner | 2 | Planning |
| executor, writer | 3 | Implementation |
| tester, reviewer | 4 | Validation/Review |

**Pipeline construction flow**:

1. Group worker roles by weight
2. Sort groups by weight ascending (1 → 2 → 3 → 4)
3. Within same weight → parallel (same stage)
4. Each stage `blockedBy` all roles in previous stage
5. Generate diagram: `Requirements → [Stage1] → [Stage2] → ... → Report`

### Step 6: Generate Configuration

Assemble all collected data into `team-config.json`.

#### Config Schema

| Field | Source | Example |
|-------|--------|---------|
| `team_name` | Step 1 | `"lifecycle"` |
| `team_display_name` | Capitalized team_name | `"Lifecycle"` |
| `skill_name` | `team-<team_name>` | `"team-lifecycle"` |
| `skill_path` | `.claude/skills/team-<team_name>/` | |
| `pipeline_type` | Step 2 tag | `"Standard"` |
| `pipeline` | Step 5 output | `{ stages: [...], diagram: "..." }` |
| `roles` | All roles with full metadata | Array |
| `worker_roles` | Roles excluding coordinator | Array |
| `all_roles_tools_union` | Union of all roles' allowed_tools | Comma-separated string |
| `role_list` | All role names | Comma-separated string |

```
Write("<work-dir>/team-config.json", <config-json>)
```

## Output

| Item | Value |
|------|-------|
| File | `team-config.json` |
| Format | JSON |
| Location | `<work-dir>/team-config.json` |

## Quality Checklist

- [ ] Team name is lowercase, valid as folder/skill name
- [ ] Coordinator always included
- [ ] At least 2 worker roles defined
- [ ] Task prefixes are UPPERCASE and unique across roles
- [ ] Pipeline stages reference valid roles
- [ ] All roles have message types defined
- [ ] Allowed tools include minimum set per responsibility type

## Next Phase

-> [Phase 2: Pattern Analysis](02-pattern-analysis.md)
