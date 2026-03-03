---
prefix: PLAN
inner_loop: true
subagents:
  - cli-explore-agent
  - action-planning-agent
message_types:
  success: plan_ready
  progress: plan_progress
  error: error
---

# Planner

Research and plan creation per roadmap phase. Gathers codebase context via cli-explore-agent, then generates wave-based execution plans with convergence criteria via action-planning-agent.

## Phase 2: Context Loading + Research

| Input | Source | Required |
|-------|--------|----------|
| roadmap.md | <session>/roadmap.md | Yes |
| config.json | <session>/config.json | Yes |
| Prior summaries | <session>/phase-{1..N-1}/summary-*.md | No |
| Wisdom | <session>/wisdom/ | No |

1. Read roadmap.md, extract phase goal, requirements (REQ-IDs), success criteria
2. Read config.json for depth setting (quick/standard/comprehensive)
3. Load prior phase summaries for dependency context
4. Detect gap closure mode (task description contains "Gap closure")
5. Launch cli-explore-agent with phase requirements as exploration query:
   - Target: files needing modification, patterns, dependencies, test infrastructure, risks
6. If depth=comprehensive: run Gemini CLI analysis (`--mode analysis --rule analysis-analyze-code-patterns`)
7. Write `<session>/phase-{N}/context.md` combining roadmap requirements + exploration results

## Phase 3: Plan Creation

1. Load context.md from Phase 2
2. Create output directory: `<session>/phase-{N}/.task/`
3. Delegate to action-planning-agent with:
   - Phase context + roadmap section + prior summaries
   - Task ID format: `IMPL-{phase}{seq}` (e.g., IMPL-101, IMPL-102)
   - Convergence criteria rules: measurable, goal-backward, includes file existence + export checks + test checks
   - Hard limits: <= 10 tasks per phase, valid DAG, no cycles
4. Agent produces: `IMPL_PLAN.md`, `.task/IMPL-*.json`, `TODO_LIST.md`
5. If gap closure: only create tasks for gaps, starting from next available ID

## Phase 4: Self-Validation

| Check | Pass Criteria | Action on Failure |
|-------|---------------|-------------------|
| Task JSON files exist | >= 1 IMPL-*.json found | Error to coordinator |
| Required fields | id, title, description, files, implementation, convergence | Log warning |
| Convergence criteria | Each task has >= 1 criterion | Log warning |
| No self-dependency | task.id not in task.depends_on | Log error, remove cycle |
| All deps valid | Every depends_on ID exists | Log warning |
| IMPL_PLAN.md exists | File present | Generate minimal version from task JSONs |

After validation, compute wave structure from dependency graph for reporting:
- Wave count = topological layers of DAG
- Report: task count, wave count, file list
