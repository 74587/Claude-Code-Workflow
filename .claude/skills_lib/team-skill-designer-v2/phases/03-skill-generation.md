# Phase 3: Skill Package Generation

> **COMPACT PROTECTION**: This is the core generation phase. If context compression has occurred and this file is only a summary, **MUST `Read` this file again before executing any Step**. Do not generate from memory.

Generate the unified team skill package: SKILL.md (role router) + per-role `role.md` + per-role `commands/*.md`.

## Objective

- Generate `SKILL.md` with role router and shared infrastructure
- Generate `roles/coordinator/role.md` + `commands/`
- Generate `roles/<worker>/role.md` + `commands/` for each worker role
- Generate `specs/team-config.json`
- All files written to `preview/` directory first

## Input

| Source | Description |
|--------|-------------|
| `team-config.json` | Phase 1 output (roles, pipeline, capabilities) |
| `pattern-analysis.json` | Phase 2 output (patterns, phase mapping, similarity) |
| `templates/skill-router-template.md` | SKILL.md generation template |
| `templates/role-template.md` | role.md generation template |
| `templates/role-command-template.md` | command file generation template |

## Execution Steps

### Step 1: Load Inputs + Create Preview Directory

1. Read `<work-dir>/team-config.json` and `<work-dir>/pattern-analysis.json`
2. Read all 3 template files from `templates/`
3. Create directory structure:

```
Bash("mkdir -p <preview-dir>/roles/<role-name>/commands <preview-dir>/specs")
```

Repeat for every role in config.

### Step 2: Generate SKILL.md (Role Router)

Use `templates/skill-router-template.md` as the base. Fill the template using config values.

#### Template Variable Mapping

| Template Variable | Config Source |
|-------------------|--------------|
| `<skill-name>` | `config.skill_name` |
| `<team-name>` | `config.team_name` |
| `<team-display-name>` | `config.team_display_name` |
| `<all-tools-union>` | `config.all_roles_tools_union` |
| `<roles-table>` | Generated from `config.roles[]` (see Roles Table below) |
| `<role-dispatch-entries>` | Per-role: `"<name>": { file, prefix }` |
| `<message-bus-table>` | Per worker role: name + message types |
| `<spawn-blocks>` | Per worker role: Task() spawn block |
| `<pipeline-diagram>` | `config.pipeline.diagram` |
| `<architecture-diagram>` | Generated from role names |

#### Roles Table Generation

For each role in `config.roles[]`, produce one row:

```
| <role-name> | <task-prefix> | <description> | [roles/<name>/role.md](roles/<name>/role.md) |
```

#### Spawn Block Generation

For each worker role, generate a `Task()` spawn block containing:
- `subagent_type: "general-purpose"`
- `team_name: <team-name>`
- `name: "<role-name>"`
- Prompt with: primary directive (MUST call Skill), role constraints, message bus requirement, workflow steps

**Spawn prompt must include**:
1. Primary directive: `Skill(skill="<skill-name>", args="--role=<role-name>")`
2. Task prefix constraint: only handle `<PREFIX>-*` tasks
3. Output tag: all messages tagged `[<role-name>]`
4. Communication rule: only talk to coordinator
5. Message bus: call `team_msg` before every `SendMessage`

```
Write("<preview-dir>/SKILL.md", <generated-skill-md>)
```

### Step 3: Generate Coordinator Role File

Build coordinator `role.md` with these sections:

| Section | Content Source |
|---------|---------------|
| Role Identity | Fixed: name=coordinator, prefix=N/A, type=Orchestration |
| Message Types | Fixed 5 types: plan_approved, plan_revision, task_unblocked, shutdown, error |
| Execution Phase 1 | Requirement clarification via AskUserQuestion |
| Execution Phase 2 | TeamCreate + spawn blocks (same as SKILL.md Step 2) |
| Execution Phase 3 | Task chain creation from `config.pipeline.stages` |
| Execution Phase 4 | Message-driven coordination loop |
| Execution Phase 5 | Report + next steps (new requirement or shutdown) |
| Error Handling | Fixed table: unresponsive, rejected plan, stuck tests, critical review |

#### Task Chain Generation

For each stage in `config.pipeline.stages[]`:
1. Create task: `TaskCreate({ subject: "<PREFIX>-001: <role> work" })`
2. Set owner: `TaskUpdate({ owner: "<role-name>" })`
3. Set dependencies: `addBlockedBy` = all prefixes from the previous stage

#### Coordination Handler Table

For each worker role, generate one row:

```
| <ROLE-UPPER>: <trigger> | team_msg log -> TaskUpdate <PREFIX> completed -> check next |
```

```
Write("<preview-dir>/roles/coordinator/role.md", <coordinator-md>)
```

Generate coordinator command files (dispatch.md, monitor.md) using `templates/role-command-template.md`.

### Step 4: Generate Worker Role Files

**For each worker role**, generate `role.md` using `templates/role-template.md`.

#### Per-Role Template Variable Mapping

| Template Variable | Source |
|-------------------|--------|
| `<role-name>` | `role.name` |
| `<task-prefix>` | `role.task_prefix` |
| `<responsibility-type>` | `role.responsibility_type` |
| `<description>` | `role.description` |
| `<message-types-table>` | From `role.message_types[]` |
| `<primary-msg-type>` | First non-error, non-progress message type |
| `<phase-2-name>` | From `pattern-analysis.phase_structure.phase2` |
| `<phase-3-name>` | From `pattern-analysis.phase_structure.phase3` |
| `<phase-4-name>` | From `pattern-analysis.phase_structure.phase4` |
| `<commands-table>` | From `role.commands[]` with phase mapping |
| `<subagents-table>` | From `role.subagents[]` |
| `<cli-tools-table>` | From `role.cli_tools[]` |

#### Role File Sections (v3 style)

Each generated `role.md` must contain:

1. **Role Identity**: name, prefix, output tag, responsibility, communication rule
2. **Role Boundaries**: MUST / MUST NOT lists
3. **Message Types**: table with type, direction, trigger
4. **Message Bus**: `team_msg` call pattern + CLI fallback
5. **Toolbox**: commands table, subagents table, CLI tools table
6. **Execution (5-Phase)**:
   - Phase 1: Task Discovery (TaskList -> filter by prefix -> TaskGet -> TaskUpdate in_progress)
   - Phase 2-4: Content varies by responsibility type (see Phase Content Table below)
   - Phase 5: Report to Coordinator (team_msg + SendMessage + TaskUpdate completed + check next)
7. **Error Handling**: table with scenario/resolution

#### Phase Content by Responsibility Type

| Type | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|
| Read-only analysis | Load plan + get changed files + read contents | Domain-specific analysis per file | Classify findings by severity |
| Code generation | Extract plan path + load plan tasks | Implement tasks (adaptive: direct edit or delegate to code-developer) | Self-validation (syntax check + auto-fix) |
| Orchestration | Assess complexity (Low/Medium/High) | Execute (adaptive: direct search or delegate to sub-agent) | Aggregate results |
| Validation | Detect changed files for scope | Iterative test-fix cycle (max 5 iterations) | Analyze results (iterations, pass rate) |

```
Write("<preview-dir>/roles/<role-name>/role.md", <role-md>)
```

### Step 5: Generate Command Files

#### Command Extraction Decision Table

| Condition | Extract to command file? |
|-----------|--------------------------|
| Role has subagents (delegation needed) | Yes |
| Role has CLI tools (fan-out needed) | Yes |
| Role has adaptive routing (complexity branching) | Yes |
| None of the above | No (all phases execute inline in role.md) |

For each role that needs command files, generate from `templates/role-command-template.md`.

#### Pre-built Command Patterns

| Command | Description | Delegation Mode | Used By Phase |
|---------|-------------|-----------------|---------------|
| explore | Multi-angle codebase exploration | Subagent Fan-out | Phase 2 |
| analyze | Multi-perspective code analysis | CLI Fan-out | Phase 3 |
| implement | Code implementation via delegation | Sequential Delegation | Phase 3 |
| validate | Iterative test-fix cycle | Sequential Delegation | Phase 3 |
| review | 4-dimensional code review | CLI Fan-out | Phase 3 |
| dispatch | Task chain creation (coordinator) | Direct | Phase 3 |
| monitor | Message-driven coordination (coordinator) | Message-Driven | Phase 4 |

If command name not in pre-built list, generate a skeleton with TODO placeholders.

```
Write("<preview-dir>/roles/<role-name>/commands/<cmd>.md", <cmd-content>)
```

### Step 6: Copy Team Config

```
Write("<preview-dir>/specs/team-config.json", <config-json>)
```

### Step 7: Preview Checkpoint

**PAUSE**: Present the generated preview structure to the user for confirmation before proceeding to Phase 4.

Display:
- File tree of `<preview-dir>/`
- Role count and names
- Pipeline diagram
- Total file count

Wait for user confirmation before advancing.

## Output

| Item | Value |
|------|-------|
| Directory | `<work-dir>/preview/` |
| Files | SKILL.md + roles/*/role.md + roles/*/commands/*.md + specs/team-config.json |

## Quality Checklist

- [ ] SKILL.md has frontmatter, architecture diagram, role router, role dispatch, shared infrastructure
- [ ] Every role has `role.md` with all 7 required sections
- [ ] Coordinator has dispatch.md and monitor.md command files
- [ ] Worker roles with delegation have command files
- [ ] All generated files use v3 style: text + decision tables + flow symbols, no pseudocode
- [ ] Spawn blocks include complete prompt with primary directive + constraints
- [ ] All `<placeholder>` variables resolved (no `${variable}` syntax in output)
- [ ] Pipeline diagram matches actual role stages

## Next Phase

-> [Phase 4: Integration Verification](04-integration-verification.md)
