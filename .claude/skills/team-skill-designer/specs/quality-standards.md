# Quality Standards for Team Commands

Quality assessment criteria for generated team command .md files.

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
- [ ] Role Identity (name, responsibility, communication)
- [ ] Message Bus section with team_msg examples
- [ ] Message Types table
- [ ] Toolbox section (Available Commands, Subagent Capabilities, CLI Capabilities)
- [ ] Phase 1: Task Discovery implementation
- [ ] Phase 2: Context Loading / delegation to commands
- [ ] Phase 3: Core Work / delegation to commands
- [ ] Phase 4: Validation/Summary / delegation to commands
- [ ] Phase 5: Report + Loop implementation
- [ ] Error Handling table
- [ ] Code examples in all phases

> **Note**: For `commands/*.md` file quality criteria, see [Command File Quality Standards](#command-file-quality-standards) below.

### 2. Pattern Compliance (25%)

| Score | Criteria |
|-------|----------|
| 100% | All 8 infrastructure patterns + selected collaboration patterns fully implemented |
| 80% | 6 core infra patterns + at least 1 collaboration pattern with convergence |
| 60% | Minimum 6 infra patterns, collaboration patterns present but incomplete |
| 40% | Missing critical patterns (message bus or task lifecycle) |
| 0% | No pattern compliance |

**Infrastructure Pattern Checklist:**
- [ ] Pattern 1: Message bus - team_msg before every SendMessage
- [ ] Pattern 1b: CLI fallback - `ccw team` CLI fallback section with parameter mapping
- [ ] Pattern 2: YAML front matter - all fields present, group: team
- [ ] Pattern 3: Task lifecycle - TaskList/Get/Update flow
- [ ] Pattern 4: Five-phase structure - all 5 phases present
- [ ] Pattern 5: Complexity-adaptive (if applicable)
- [ ] Pattern 6: Coordinator spawn compatible
- [ ] Pattern 7: Error handling table
- [ ] Pattern 8: Session files (if applicable)

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
| PASS | >= 80% | Deliver to `.claude/commands/team/{team-name}/` |
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

### Warnings (Should Fix)

- Missing error handling table
- Incomplete Phase implementation (skeleton only)
- Missing team_msg before some SendMessage calls
- Missing CLI fallback section (`### CLI 回退` with `ccw team` examples)
- No complexity-adaptive routing when role is complex

### Info (Nice to Have)

- Code examples could be more detailed
- Additional message type examples
- Session file structure documentation
- CLI integration examples

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
- [ ] `## Strategy` with `### Delegation Mode` (Subagent Fan-out / CLI Fan-out / Sequential Delegation / Direct)
- [ ] `## Execution Steps` with numbered steps and code blocks
- [ ] `## Error Handling` table with Scenario/Resolution

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
