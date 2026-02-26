# Quality Standards for Team Skills (v2)

Quality assessment criteria for generated team skill packages (v3 style: text + decision tables, no pseudocode).

## When to Use

| Phase | Usage | Section |
|-------|-------|---------|
| Phase 5 | Score generated command | All dimensions |
| Phase 3 | Guide generation quality | Checklist |

---

## Quality Dimensions

### 1. Completeness (25%)

| Score | Criteria |
|-------|----------|
| 100% | All 15 required sections present with substantive content |
| 80% | 12+ sections present, minor gaps in non-critical areas |
| 60% | Core sections present (front matter, message bus, 5 phases, error handling) |
| 40% | Missing critical sections |
| 0% | Skeleton only |

**Required Sections Checklist (role.md files):**
- [ ] Role Identity (name, task prefix, output tag, responsibility)
- [ ] Role Boundaries (MUST / MUST NOT)
- [ ] Toolbox section (Available Commands with markdown links)
- [ ] Phase 2: Context Loading (decision tables, no pseudocode)
- [ ] Phase 3: Core Work (decision tables + tool call templates)
- [ ] Phase 4: Validation/Summary (checklist tables)
- [ ] Error Handling table
- [ ] Phase 1/5: Reference to SKILL.md Shared Infrastructure (not inline)
- [ ] No JavaScript pseudocode in any phase
- [ ] All branching logic expressed as decision tables

**Required Sections Checklist (SKILL.md):**
- [ ] Frontmatter (name, description, allowed-tools)
- [ ] Architecture Overview (role routing diagram with flow symbols)
- [ ] Role Router (Input Parsing + Role Registry table with markdown links)
- [ ] Shared Infrastructure (Worker Phase 1 Task Discovery + Phase 5 Report templates)
- [ ] Pipeline Definitions with Cadence Control (beat diagram + checkpoints)
- [ ] Compact Protection (Phase Reference table with Compact column)
- [ ] Coordinator Spawn Template
- [ ] Role Isolation Rules table
- [ ] Error Handling table

**SKILL.md MUST NOT contain:**
- [ ] ❌ No JavaScript pseudocode (VALID_ROLES object, routing functions, etc.)
- [ ] ❌ No role-specific implementation logic (belongs in role.md or commands/*.md)
- [ ] ❌ No `${variable}` notation (use `<placeholder>` instead)

> **Note**: For `commands/*.md` file quality criteria, see [Command File Quality Standards](#command-file-quality-standards) below.

### 2. Pattern Compliance (25%)

| Score | Criteria |
|-------|----------|
| 100% | All 9 infrastructure patterns + selected collaboration patterns fully implemented |
| 80% | 7 core infra patterns + at least 1 collaboration pattern with convergence |
| 60% | Minimum 6 infra patterns, collaboration patterns present but incomplete |
| 40% | Missing critical patterns (message bus or task lifecycle) |
| 0% | No pattern compliance |

**Infrastructure Pattern Checklist:**
- [ ] Pattern 1: Message bus - team_msg before every SendMessage
- [ ] Pattern 1b: CLI fallback section
- [ ] Pattern 2: YAML front matter - all fields present
- [ ] Pattern 3: Task lifecycle - TaskList/Get/Update flow
- [ ] Pattern 4: Five-phase structure (Phase 1/5 shared in SKILL.md, Phase 2-4 in role.md)
- [ ] Pattern 5: Complexity-adaptive (if applicable)
- [ ] Pattern 6: Coordinator spawn compatible
- [ ] Pattern 7: Error handling table
- [ ] Pattern 8: Session files (if applicable)
- [ ] Pattern 9: Compact Protection (Phase Reference table + re-read directives)

**Collaboration Pattern Checklist:**
- [ ] At least one CP selected (CP-1 minimum)
- [ ] Each selected CP has convergence criteria defined
- [ ] Each selected CP has feedback loop mechanism
- [ ] Each selected CP has timeout/fallback behavior
- [ ] CP-specific message types registered in message bus section
- [ ] Escalation path defined (CP-5) for error scenarios

### 3. Integration (25%)

| Score | Criteria |
|-------|----------|
| 100% | All integration checks pass, spawn snippet ready |
| 80% | Minor integration notes, no blocking issues |
| 60% | Some checks need attention but functional |
| 40% | Task prefix conflict or missing critical tools |
| 0% | Incompatible with team system |

### 4. Consistency (25%)

| Score | Criteria |
|-------|----------|
| 100% | Role name, task prefix, message types consistent throughout |
| 80% | Minor inconsistencies in non-critical areas |
| 60% | Some mixed terminology but intent clear |
| 40% | Confusing or contradictory content |
| 0% | Internally inconsistent |

---

## Quality Gates

| Gate | Threshold | Action |
|------|-----------|--------|
| PASS | >= 80% | Deliver to `.claude/skills/team-{name}/` |
| REVIEW | 60-79% | Fix recommendations, re-validate |
| FAIL | < 60% | Major rework needed, re-run from Phase 3 |

---

## Issue Classification

### Errors (Must Fix)

- Missing YAML front matter
- Missing `group: team`
- No message bus section
- No task lifecycle (TaskList/Get/Update)
- No SendMessage to coordinator
- Task prefix conflicts with existing
- **Coordinator dispatch `owner` values not in Role Registry** — all task owners must match a role in SKILL.md Role Registry table
- **Monitor spawn prompt missing Skill callback** — spawn prompt must contain `Skill(skill="team-xxx", args="--role=yyy")`
- **Spawn template missing `description` parameter** — Task() requires `description` as a mandatory field
- **Spawn template missing `team_name` or `name` parameter** — agent will not join the team or have identity

### Warnings (Should Fix)

- Missing error handling table
- Incomplete Phase implementation (skeleton only)
- Missing team_msg before some SendMessage calls
- Missing CLI fallback section (`### CLI 回退` with `ccw team` examples)
- No complexity-adaptive routing when role is complex
- **Dispatch task IDs not aligned with pipeline diagram** — task IDs (e.g., RESEARCH-001, DRAFT-001) must match the pipeline defined in SKILL.md
- **Coordinator commands reference roles not in Message Routing Tables** — all roles in dispatch/monitor must appear in SKILL.md Available Roles table

### Info (Nice to Have)

- Decision tables could cover more edge cases
- Additional tool call examples
- Session file structure documentation

---

## Coordinator Commands Consistency Standards

Quality assessment for coordinator's `dispatch.md` and `monitor.md` command files. These files are the most common source of integration failures.

### 6. Coordinator-SKILL Alignment (Applies to coordinator commands)

| Score | Criteria |
|-------|----------|
| 100% | All 5 alignment checks pass |
| 80% | 4/5 pass, one minor mismatch |
| 60% | 3/5 pass, cosmetic role naming issues |
| 40% | Critical mismatch: roles not in VALID_ROLES or missing Skill callback |
| 0% | dispatch/monitor written independently of SKILL.md |

#### Check 1: Role Name Alignment

- [ ] Every `owner` value in dispatch.md TaskCreate calls exists in SKILL.md Role Registry table
- [ ] No invented role names (e.g., "spec-writer" when Role Registry has "writer")
- [ ] No typos or case mismatches in role names

#### Check 2: Task ID-Pipeline Alignment

- [ ] Task IDs in dispatch.md match the pipeline diagram in SKILL.md
- [ ] Task prefix mapping is consistent (e.g., RESEARCH-* → analyst, DRAFT-* → writer)
- [ ] Dependency chain in dispatch.md matches pipeline flow arrows

#### Check 3: Spawn Template Completeness

- [ ] monitor.md Task() calls include ALL required parameters: `description`, `team_name`, `name`, `prompt`
- [ ] Spawn prompt contains `Skill(skill="team-xxx", args="--role=yyy")` callback
- [ ] Spawn prompt includes role boundaries (task prefix constraint, output tag, communication rules)
- [ ] Spawn prompt is NOT a minimal generic instruction (e.g., "Execute task X")

#### Check 4: Message Routing Table Alignment

- [ ] All roles in dispatch.md appear in monitor.md's Message Routing Tables
- [ ] All message types used by roles are listed in the routing tables
- [ ] Sender roles in routing tables match Role Registry entries

#### Check 5: v3 Style Compliance

- [ ] No JavaScript pseudocode in any generated file
- [ ] All branching logic expressed as decision tables
- [ ] Code blocks contain only actual tool calls
- [ ] `<placeholder>` notation used (not `${variable}`)
- [ ] Phase 1/5 reference SKILL.md Shared Infrastructure (not inline)

---

## Command File Quality Standards

Quality assessment criteria for generated command `.md` files in `roles/{name}/commands/`.

### 5. Command File Quality (Applies to folder-based roles)

| Score | Criteria |
|-------|----------|
| 100% | All 4 dimensions pass, all command files self-contained |
| 80% | 3/4 dimensions pass, minor gaps in one area |
| 60% | 2/4 dimensions pass, some cross-references or missing sections |
| 40% | Missing required sections or broken references |
| 0% | No command files or non-functional |

#### Dimension 1: Structural Completeness

Each command file MUST contain:
- [ ] `## When to Use` - Trigger conditions
- [ ] `## Strategy` with delegation mode (Subagent / CLI / Sequential / Direct)
- [ ] `## Execution Steps` with decision tables and tool call templates
- [ ] `## Error Handling` table with Scenario/Resolution
- [ ] `## Output Format` section

#### Dimension 2: Self-Containment

- [ ] No `Ref:` or cross-references to other command files
- [ ] No imports or dependencies on sibling commands
- [ ] All context loaded within the command (task, plan, files)
- [ ] Any subagent can `Read()` the command and execute independently

#### Dimension 3: Toolbox Consistency

- [ ] Every command listed in role.md Toolbox has a corresponding file in `commands/`
- [ ] Every file in `commands/` is listed in role.md Toolbox
- [ ] Phase mapping in Toolbox matches command's `## When to Use` phase reference
- [ ] Delegation mode in command matches role's subagent/CLI capabilities

#### Dimension 4: Pattern Compliance

- [ ] Pre-built command patterns (explore, analyze, implement, validate, review, dispatch, monitor) follow templates/role-command-template.md
- [ ] Custom commands follow the template skeleton structure
- [ ] Delegation mode is appropriate for the command's complexity
- [ ] Output format is structured and parseable by the calling role.md
