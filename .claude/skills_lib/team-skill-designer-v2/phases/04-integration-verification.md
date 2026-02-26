# Phase 4: Integration Verification

Verify the generated skill package is internally consistent.

## Objective

- Verify SKILL.md role router references match actual role files
- Verify task prefixes are unique across all roles
- Verify message types are consistent between config and generated files
- Verify coordinator spawn template uses correct skill invocation
- Verify role file structural compliance
- Verify coordinator commands alignment
- Generate `integration-report.json`

## Input

| Source | Description |
|--------|-------------|
| `<work-dir>/preview/` | Phase 3 generated skill package |
| `team-config.json` | Phase 1 configuration |

## Execution Steps

### Step 1: Load Generated Files

1. Read `<work-dir>/team-config.json`
2. Read `<preview-dir>/SKILL.md`
3. Read each `<preview-dir>/roles/<role-name>/role.md`
4. Read each `<preview-dir>/roles/<role-name>/commands/*.md`

### Step 2: Run 6 Integration Checks

#### Check 1: Router Consistency

For each role in config, verify 3 conditions in SKILL.md:

| Item | Method | Pass Criteria |
|------|--------|---------------|
| Router entry | SKILL.md contains `"<role-name>"` | Found |
| Role file exists | `roles/<role-name>/role.md` is readable | File exists |
| Role link valid | SKILL.md contains `roles/<role-name>/role.md` | Found |

**Status**: PASS if all 3 conditions met for every role, FAIL otherwise.

#### Check 2: Prefix Uniqueness

| Item | Method | Pass Criteria |
|------|--------|---------------|
| All task prefixes | Collect `task_prefix` from each worker role | No duplicates |

**Status**: PASS if all prefixes unique, FAIL if any duplicate found.

#### Check 3: Message Type Consistency

For each worker role:

| Item | Method | Pass Criteria |
|------|--------|---------------|
| Config message types | List types from `role.message_types[]` | Baseline |
| Types in role file | Search role.md for each type string | All present |

**Status**: PASS if all configured types found in role file, WARN if any missing.

#### Check 4: Spawn Template Verification

For each worker role, verify in SKILL.md:

| Item | Method | Pass Criteria |
|------|--------|---------------|
| Spawn present | SKILL.md contains `name: "<role-name>"` | Found |
| Skill call correct | Contains `Skill(skill="<skill-name>", args="--role=<role-name>")` | Found |
| Prefix in prompt | Contains `<PREFIX>-*` | Found |

**Status**: PASS if all 3 conditions met, FAIL otherwise.

#### Check 5: Role File Pattern Compliance

For each role file, check structural elements:

| Item | Search Pattern | Required |
|------|---------------|----------|
| Role Identity section | `## Role Identity` | Yes |
| 5-Phase structure | `Phase 1` and `Phase 5` both present | Yes |
| Task lifecycle | `TaskList`, `TaskGet`, `TaskUpdate` all present | Yes |
| Message bus | `team_msg` present | Yes |
| SendMessage | `SendMessage` present | Yes |
| Error Handling | `## Error Handling` | Yes |

**Status**: PASS if all 6 items found, PARTIAL if some missing, MISSING if file not found.

#### Check 5b: Command File Verification

For each role's command files:

| Item | Search Pattern | Required |
|------|---------------|----------|
| Strategy section | `## Strategy` | Yes |
| Execution Steps | `## Execution Steps` | Yes |
| Error Handling | `## Error Handling` | Yes |
| When to Use | `## When to Use` | Yes |
| Self-contained | No `Read("../` cross-command references | Yes |

**Status**: PASS if all items found, PARTIAL if some missing, MISSING if file not found.

#### Check 6: Coordinator Commands Alignment

> **Critical**: dispatch.md and monitor.md are the most common source of integration failures.

**6a: dispatch.md role names**

| Item | Method | Pass Criteria |
|------|--------|---------------|
| Owner values | Extract all `owner: "<name>"` from dispatch.md | Every name exists in config roles |
| No ghost roles | Compare dispatch roles vs config roles | No invalid role names |

**6b: monitor.md spawn completeness**

| Item | Method | Pass Criteria |
|------|--------|---------------|
| Has `description:` | Search for `description:` | Found |
| Has `team_name:` | Search for `team_name:` | Found |
| Has `name:` param | Search for `name:` | Found |
| Has Skill callback | Search for `Skill(skill=` | Found |
| Has role boundaries | Search for role constraint / MUST keywords | Found |
| Not minimal prompt | No `prompt: \`Execute task` anti-pattern | Confirmed |

**6c: Pipeline alignment**

| Item | Method | Pass Criteria |
|------|--------|---------------|
| Pipeline task IDs | From `config.pipeline_tasks` (if defined) | Baseline |
| Dispatch task IDs | Extract `subject: "<id>"` from dispatch.md | Match pipeline |

**Status**: PASS if no mismatches, WARN if pipeline_tasks not defined, FAIL if mismatches found.

### Step 3: Generate Report

Compute overall status: PASS if all checks pass (excluding SKIP), NEEDS_ATTENTION otherwise.

#### Report Schema

| Field | Content |
|-------|---------|
| `team_name` | Config team name |
| `skill_name` | Config skill name |
| `checks.router_consistency` | Check 1 results per role |
| `checks.prefix_uniqueness` | Check 2 result |
| `checks.message_types` | Check 3 results per role |
| `checks.spawn_template` | Check 4 results per role |
| `checks.pattern_compliance` | Check 5 results per role |
| `checks.command_files` | Check 5b results per role |
| `checks.coordinator_commands` | Check 6a/6b/6c results |
| `overall` | PASS or NEEDS_ATTENTION |
| `file_count` | skill_md: 1, role_files: N, total: N+2 |

```
Write("<work-dir>/integration-report.json", <report-json>)
```

## Output

| Item | Value |
|------|-------|
| File | `integration-report.json` |
| Format | JSON |
| Location | `<work-dir>/integration-report.json` |

## Quality Checklist

- [ ] Every role in config has a router entry in SKILL.md
- [ ] Every role has a file in `roles/`
- [ ] Task prefixes are unique
- [ ] Spawn template uses correct `Skill(skill="...", args="--role=...")`
- [ ] Spawn template includes `description`, `team_name`, `name` parameters
- [ ] All role files have 5-phase structure
- [ ] All role files have message bus integration
- [ ] dispatch.md `owner` values all exist in config roles (no ghost roles)
- [ ] monitor.md spawn prompt contains full Skill callback (not minimal)
- [ ] Task IDs in dispatch.md match pipeline diagram in SKILL.md

## Next Phase

-> [Phase 5: Validation](05-validation.md)
