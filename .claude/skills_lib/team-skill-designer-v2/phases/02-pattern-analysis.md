# Phase 2: Pattern Analysis

Analyze applicable patterns for each role in the team.

## Objective

- Per-role: find most similar existing command reference
- Per-role: select infrastructure + collaboration patterns
- Per-role: map 5-phase structure to role responsibilities
- Generate `pattern-analysis.json`

## Input

| Source | Description |
|--------|-------------|
| `team-config.json` | Phase 1 output |
| `specs/team-design-patterns.md` | Infrastructure patterns (read in Phase 0) |
| `specs/collaboration-patterns.md` | Collaboration patterns (read in Phase 0) |

## Execution Steps

### Step 1: Load Configuration

```
Read("<work-dir>/team-config.json")
```

### Step 2: Per-Role Similarity Mapping

For each worker role, find the most similar existing command based on responsibility type.

#### Similarity Mapping Table

| Responsibility Type | Primary Reference | Secondary Reference | Reason |
|---------------------|-------------------|---------------------|--------|
| Read-only analysis | review | plan | Both analyze code and report findings with severity classification |
| Code generation | execute | test | Both write/modify code and self-validate |
| Orchestration | plan | coordinate | Both coordinate sub-tasks and produce structured output |
| Validation | test | review | Both validate quality with structured criteria |

For each worker role:
1. Look up responsibility type in table above
2. Record `similar_to.primary` and `similar_to.secondary`
3. Set `reference_command` = `.claude/commands/team/<primary>.md`

### Step 3: Per-Role Phase Mapping

Map the generic 5-phase structure to role-specific phase names.

#### Phase Structure Mapping Table

| Responsibility Type | Phase 2 | Phase 3 | Phase 4 |
|---------------------|---------|---------|---------|
| Read-only analysis | Context Loading | Analysis Execution | Finding Summary |
| Code generation | Task & Plan Loading | Code Implementation | Self-Validation |
| Orchestration | Context & Complexity Assessment | Orchestrated Execution | Result Aggregation |
| Validation | Environment Detection | Execution & Fix Cycle | Result Analysis |

> Phase 1 is always "Task Discovery" and Phase 5 is always "Report to Coordinator" for all roles.

### Step 4: Per-Role Infrastructure Patterns

#### Core Patterns (mandatory for all roles)

| Pattern | Name |
|---------|------|
| pattern-1 | Message Bus |
| pattern-2 | YAML Front Matter (adapted: no YAML in skill role files) |
| pattern-3 | Task Lifecycle |
| pattern-4 | Five Phase |
| pattern-6 | Coordinator Spawn |
| pattern-7 | Error Handling |

#### Conditional Pattern Selection Table

| Condition | Add Pattern |
|-----------|-------------|
| Role has `adaptive_routing = true` | pattern-5 (Complexity Adaptive) |
| Responsibility type is Code generation or Orchestration | pattern-8 (Session Files) |

#### Pattern 9 Selection

| Condition | Uses Pattern 9 |
|-----------|----------------|
| Role has subagents defined (length > 0) | Yes |
| Role has CLI tools defined (length > 0) | Yes |
| Neither | No |

### Step 5: Command-to-Phase Mapping

For each worker role, map commands to phases and determine extraction reasons.

**Per-command extraction reasons**:

| Condition | Extraction Reason |
|-----------|-------------------|
| Role has subagents | `subagent-delegation` |
| Role has CLI tools | `cli-fan-out` |
| Role has adaptive routing | `complexity-adaptive` |

Record `phase_commands` mapping (from config): which command runs in which phase.

### Step 6: Collaboration Pattern Selection

Select team-level collaboration patterns based on team composition.

#### Collaboration Pattern Selection Decision Table

| Condition | Pattern | Name |
|-----------|---------|------|
| Always | CP-1 | Linear Pipeline (base) |
| Any role has Validation or Read-only analysis type | CP-2 | Review-Fix Cycle |
| Any role has Orchestration type | CP-3 | Fan-out/Fan-in |
| Worker roles >= 4 | CP-6 | Incremental Delivery |
| Always | CP-5 | Escalation Chain |
| Always | CP-10 | Post-Mortem |

#### Convergence Defaults Table

| Pattern | Max Iterations | Success Gate |
|---------|----------------|--------------|
| CP-1 | 1 | all_stages_completed |
| CP-2 | 5 | verdict_approve_or_conditional |
| CP-3 | 1 | quorum_100_percent |
| CP-5 | null | issue_resolved_at_any_level |
| CP-6 | 3 | all_increments_validated |
| CP-10 | 1 | report_generated |

### Step 7: Read Reference Commands

For each unique `similar_to.primary` across all roles:

```
Read(".claude/commands/team/<primary-ref>.md")
```

Store content for Phase 3 reference. Skip silently if file not found.

### Step 8: Generate Analysis Document

Assemble all analysis results into `pattern-analysis.json`.

#### Output Schema

| Field | Source |
|-------|--------|
| `team_name` | config |
| `role_count` / `worker_count` | config |
| `role_analysis[]` | Steps 2-5 (per-role: similarity, phases, patterns, commands) |
| `collaboration_patterns[]` | Step 6 |
| `convergence_config[]` | Step 6 |
| `referenced_commands[]` | Step 7 |
| `pipeline` | config |
| `skill_patterns` | Fixed: role_router, shared_infrastructure, progressive_loading |
| `command_architecture` | Per-role command mapping + pattern-9 flag |

```
Write("<work-dir>/pattern-analysis.json", <analysis-json>)
```

## Output

| Item | Value |
|------|-------|
| File | `pattern-analysis.json` |
| Format | JSON |
| Location | `<work-dir>/pattern-analysis.json` |

## Quality Checklist

- [ ] Every worker role has similarity mapping
- [ ] Every worker role has 5-phase structure
- [ ] Infrastructure patterns include all mandatory patterns
- [ ] Collaboration patterns selected at team level
- [ ] Referenced commands are readable
- [ ] Skill-specific patterns documented

## Next Phase

-> [Phase 3: Skill Package Generation](03-skill-generation.md)
