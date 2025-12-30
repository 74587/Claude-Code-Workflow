---
description: Plan issue(s) into bound solutions (writes solutions JSONL via ccw issue bind)
argument-hint: "<issue-id>[,<issue-id>,...] [--all-pending] [--batch-size 3]"
---

# Issue Plan (Codex Version)

## Goal

Create executable solution(s) for issue(s) and bind the selected solution to each issue using `ccw issue bind`.

This workflow is **planning + registration** (no implementation): it explores the codebase just enough to produce a high-quality task breakdown that can be executed later (e.g., by `issue-execute.md`).

## Core Guidelines

**⚠️ Data Access Principle**: Issues and solutions files can grow very large. To avoid context overflow:

| Operation | Correct | Incorrect |
|-----------|---------|-----------|
| List issues (brief) | `ccw issue list --status pending --brief` | `Read('issues.jsonl')` |
| Read issue details | `ccw issue status <id> --json` | `Read('issues.jsonl')` |
| Update status | `ccw issue update <id> --status ...` | Direct file edit |
| Bind solution | `ccw issue bind <id> <sol-id>` | Direct file edit |

**Output Options**:
- `--brief`: JSON with minimal fields (id, title, status, priority, tags)
- `--json`: Full JSON (for detailed processing)

**ALWAYS** use CLI commands for CRUD operations. **NEVER** read entire `issues.jsonl` or `solutions/*.jsonl` directly.

## Inputs

- **Explicit issues**: comma-separated IDs, e.g. `ISS-123,ISS-124`
- **All pending**: `--all-pending` → plan all issues in `registered` status
- **Batch size**: `--batch-size N` (default `3`) → max issues per batch

## Output Requirements

For each issue:
- Register at least one solution and bind one solution to the issue (updates `.workflow/issues/issues.jsonl` and appends to `.workflow/issues/solutions/{issue-id}.jsonl`).
- Ensure tasks conform to `.claude/workflows/cli-templates/schemas/solution-schema.json`.
- Each task includes quantified `acceptance.criteria` and concrete `acceptance.verification`.

Return a final summary JSON:
```json
{
  "bound": [{ "issue_id": "...", "solution_id": "...", "task_count": 0 }],
  "pending_selection": [{ "issue_id": "...", "solutions": [{ "id": "...", "task_count": 0, "description": "..." }] }],
  "conflicts": [{ "file": "...", "issues": ["..."] }]
}
```

## Workflow

### Step 1: Resolve issue list

- If `--all-pending`:
  - Run `ccw issue list --status registered --json` and plan all returned issues.
- Else:
  - Parse IDs from user input (split by `,`), and ensure each issue exists:
    - `ccw issue init <issue-id> --title "Issue <issue-id>"` (safe if already exists)

### Step 2: Load issue details

For each issue ID:
- `ccw issue status <issue-id> --json`
- Extract the issue title/context/labels and any discovery hints (affected files, snippets, etc. if present).

### Step 3: Minimal exploration (evidence-based)

- If issue context names specific files or symbols: open them first.
- Otherwise:
  - Use `rg` to locate relevant code paths by keywords from the title/context.
  - Read 3+ similar patterns before proposing refactors or API changes.

### Step 4: Draft solutions and tasks (schema-driven)

Default to **one** solution per issue unless there are genuinely different approaches.

Task rules (from schema):
- `id`: `T1`, `T2`, ...
- `action`: one of `Create|Update|Implement|Refactor|Add|Delete|Configure|Test|Fix`
- `implementation`: step-by-step, executable instructions
- `test.commands`: include at least one command per task when feasible
- `acceptance.criteria`: testable statements
- `acceptance.verification`: concrete steps/commands mapping to criteria
- Prefer small, independently testable tasks; encode dependencies in `depends_on`.

### Step 5: Register & bind solutions via CLI

**Create solution** (via CLI endpoint):
```bash
ccw issue solution <issue-id> --data '{"description":"...", "approach":"...", "tasks":[...]}'
# Output: {"id":"SOL-{issue-id}-1", ...}
```

**CLI Features:**
| Feature | Description |
|---------|-------------|
| Auto-increment ID | `SOL-{issue-id}-{seq}` (e.g., `SOL-GH-123-1`) |
| Multi-solution | Appends to existing JSONL, supports multiple per issue |
| Trailing newline | Proper JSONL format, no corruption |

**Binding:**
- **Single solution**: Auto-bind: `ccw issue bind <issue-id> <solution-id>`
- **Multiple solutions**: Present alternatives in `pending_selection`, wait for user choice

### Step 6: Detect cross-issue file conflicts (best-effort)

Across the issues planned in this run:
- Build a set of touched files from each solution's `modification_points.file` (and/or task `scope` when explicit files are missing).
- If the same file appears in multiple issues, add it to `conflicts` with all involved issue IDs.
- Recommend a safe execution order (sequential) when conflicts exist.

### Step 7: Update issue status

After binding, update issue status to `planned`:
```bash
ccw issue update <issue-id> --status planned
```

## Quality Checklist

Before completing, verify:

- [ ] All input issues have solutions in `solutions/{issue-id}.jsonl`
- [ ] Single solution issues are auto-bound (`bound_solution_id` set)
- [ ] Multi-solution issues returned in `pending_selection` for user choice
- [ ] Each solution has executable tasks with `modification_points`
- [ ] Task acceptance criteria are quantified (not vague)
- [ ] Conflicts detected and reported (if multiple issues touch same files)
- [ ] Issue status updated to `planned` after binding

## Error Handling

| Error | Resolution |
|-------|------------|
| Issue not found | Auto-create via `ccw issue init` |
| No solutions generated | Display error, suggest manual planning |
| User cancels selection | Skip issue, continue with others |
| File conflicts | Detect and suggest resolution order |

## Done Criteria

- A bound solution exists for each issue unless explicitly deferred for user selection.
- All tasks validate against the solution schema fields (especially acceptance criteria + verification).
- The final summary JSON matches the required shape.

