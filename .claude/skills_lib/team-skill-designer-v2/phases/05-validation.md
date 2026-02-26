# Phase 5: Validation

Verify quality and deliver the final skill package.

## Objective

- SKILL.md structural completeness check
- Per-role structural completeness check
- Per-role command file quality check
- Quality scoring across 5 dimensions
- Deliver final skill package to `.claude/skills/team-<name>/`

## Input

| Source | Description |
|--------|-------------|
| `<work-dir>/preview/` | Phase 3 generated skill package |
| `integration-report.json` | Phase 4 integration check results |
| `specs/quality-standards.md` | Quality criteria (read in Phase 0) |

## Execution Steps

### Step 1: Load Files

1. Read `<work-dir>/team-config.json`
2. Read `<work-dir>/integration-report.json`
3. Read `<preview-dir>/SKILL.md`
4. Read each `<preview-dir>/roles/<role-name>/role.md`
5. Read each `<preview-dir>/roles/<role-name>/commands/*.md`

### Step 2: SKILL.md Structural Check

#### SKILL.md Structure Checklist

| # | Check Item | Search For |
|---|------------|------------|
| 1 | Frontmatter | `---` block at file start |
| 2 | Architecture Overview | `## Architecture Overview` |
| 3 | Role Router | `## Role Router` |
| 4 | Role Dispatch Code | `VALID_ROLES` |
| 5 | Orchestration Mode | `Orchestration Mode` |
| 6 | Available Roles Table | `| Role | Task Prefix` |
| 7 | Shared Infrastructure | `## Shared Infrastructure` |
| 8 | Role Isolation Rules | `Role Isolation` |
| 9 | Pipeline Diagram | `## Pipeline` |
| 10 | Coordinator Spawn Template | `Coordinator Spawn` |
| 11 | Spawn Skill Directive | `MUST` + primary directive |
| 12 | Spawn Description Param | `description:` in spawn block |
| 13 | Error Handling | `## Error Handling` |

**SKILL.md score** = (passed items / 13) * 100

### Step 3: Per-Role Structural Check

#### Role Structure Checklist

| # | Check Item | Search For |
|---|------------|------------|
| 1 | Role Identity | `## Role Identity` |
| 2 | Role Boundaries | `## Role Boundaries` |
| 3 | Output Tag | `Output Tag` |
| 4 | Message Types Table | `## Message Types` |
| 5 | Message Bus | `## Message Bus` |
| 6 | CLI Fallback | `CLI` fallback section |
| 7 | Toolbox Section | `## Toolbox` |
| 8 | 5-Phase Execution | `## Execution` |
| 9 | Phase 1 Task Discovery | `Phase 1` + `Task Discovery` |
| 10 | TaskList Usage | `TaskList` |
| 11 | TaskGet Usage | `TaskGet` |
| 12 | TaskUpdate Usage | `TaskUpdate` |
| 13 | team_msg Before SendMessage | `team_msg` |
| 14 | SendMessage to Coordinator | `SendMessage` |
| 15 | Error Handling | `## Error Handling` |

**Per-role score** = (passed items / 15) * 100

| Score | Status |
|-------|--------|
| >= 80% | PASS |
| < 80% | PARTIAL |
| File missing | MISSING (score = 0) |

### Step 3b: Command File Quality Check

For each role's command files:

#### Command Quality Checklist

| # | Check Item | Search For |
|---|------------|------------|
| 1 | When to Use section | `## When to Use` |
| 2 | Strategy section | `## Strategy` |
| 3 | Delegation mode declared | `Delegation Mode` |
| 4 | Execution Steps section | `## Execution Steps` |
| 5 | Error Handling section | `## Error Handling` |
| 6 | Output Format section | `## Output Format` |
| 7 | Self-contained (no cross-ref) | No `Read("../` patterns |

**Per-command score** = (passed items / 7) * 100. Role command score = average of all commands.

### Step 4: Quality Scoring

#### Quality Scoring Table

| Dimension | Weight | Source | Calculation |
|-----------|--------|--------|-------------|
| `skill_md` | Equal | Step 2 | SKILL.md checklist score |
| `roles_avg` | Equal | Step 3 | Average of all role scores |
| `integration` | Equal | Phase 4 report | PASS=100, otherwise=50 |
| `consistency` | Equal | Cross-check | Start at 100, -20 per mismatch (see below) |
| `command_quality` | Equal | Step 3b | Average of all command scores |

**Consistency deductions**:

| Mismatch | Deduction |
|----------|-----------|
| Skill name not in SKILL.md | -20 |
| Team name not in SKILL.md | -20 |
| Any role name not in SKILL.md | -10 per role |

**Overall score** = average of all 5 dimension scores.

#### Delivery Decision Table

| Score Range | Gate | Action |
|-------------|------|--------|
| >= 80% | PASS | Deliver to `.claude/skills/team-<name>/` |
| 60-79% | REVIEW | Deliver with warnings, suggest fixes |
| < 60% | FAIL | Do not deliver, return to Phase 3 for rework |

### Step 5: Generate Validation Report

#### Report Schema

| Field | Content |
|-------|---------|
| `team_name` | Config team name |
| `skill_name` | Config skill name |
| `timestamp` | ISO timestamp |
| `scores` | All 5 dimension scores |
| `overall_score` | Average score |
| `quality_gate` | PASS / REVIEW / FAIL |
| `skill_md_checks` | Step 2 results |
| `role_results` | Step 3 results per role |
| `integration_status` | Phase 4 overall status |
| `delivery.source` | Preview directory |
| `delivery.destination` | `.claude/skills/<skill-name>/` |
| `delivery.ready` | true if gate is not FAIL |

```
Write("<work-dir>/validation-report.json", <report-json>)
```

### Step 6: Deliver Final Package

**Only execute if `quality_gate` is not FAIL.**

1. Create destination directory structure:

```
Bash("mkdir -p .claude/skills/<skill-name>/roles/<role-name>/commands .claude/skills/<skill-name>/specs")
```

2. Copy files from preview to destination:

| Source | Destination |
|--------|-------------|
| `<preview-dir>/SKILL.md` | `.claude/skills/<skill-name>/SKILL.md` |
| `<preview-dir>/roles/<name>/role.md` | `.claude/skills/<skill-name>/roles/<name>/role.md` |
| `<preview-dir>/roles/<name>/commands/*.md` | `.claude/skills/<skill-name>/roles/<name>/commands/*.md` |
| `<preview-dir>/specs/team-config.json` | `.claude/skills/<skill-name>/specs/team-config.json` |

3. Report delivery summary:
   - Destination path
   - Skill name
   - Quality score and gate
   - Role list
   - Usage examples: `Skill(skill="<skill-name>", args="--role=<role-name>")`

4. List delivered files:

```
Bash("find .claude/skills/<skill-name> -type f | sort")
```

**If gate is FAIL**: Report failure with score, suggest returning to Phase 3 for rework.

## Output

| Item | Value |
|------|-------|
| File | `validation-report.json` |
| Format | JSON |
| Location | `<work-dir>/validation-report.json` |
| Delivery | `.claude/skills/team-<name>/` (if gate passes) |

## Quality Checklist

- [ ] SKILL.md passes all 13 routing-level structural checks
- [ ] All role files pass structural checks (>= 80%)
- [ ] All command files pass quality checks (>= 80%)
- [ ] Integration report is PASS
- [ ] Overall score >= 80%
- [ ] Final package delivered to `.claude/skills/team-<name>/`
- [ ] Usage instructions provided to user

## Completion

This is the final phase. The unified team skill is ready for use.
