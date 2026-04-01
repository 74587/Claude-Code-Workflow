---
name: ccw-chain
description: Chain-based CCW workflow orchestrator. Intent analysis, workflow routing, and Skill pipeline execution via progressive chain loading. Triggers on "ccw chain", "chain ccw", "workflow chain".
allowed-tools: Skill(*), TodoWrite(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*)
---

# CCW Chain Orchestrator

Chain-based version of the CCW workflow orchestrator. Uses the chain_loader tool for progressive step loading and LLM-driven decision routing. Each step node loads the **actual command/skill document** for that pipeline stage.

## Architecture

```
User Input → ccw-main (intent → clarity → route)
                        ↓
         ccw-{category} (select flow → step sequence)
                        ↓
         Each step loads actual skill/command doc from phases/
                        ↓
         LLM executes via Skill() call per loaded doc
```

## Chain Files (8 chains)

| Chain | Nodes | Purpose |
|-------|-------|---------|
| `ccw-main` | 5 | Entry: intent analysis → clarity check → category routing |
| `ccw-lightweight` | 8 | Level 2: rapid, bugfix, hotfix, docs |
| `ccw-standard` | 17 | Level 3: coupled, tdd, test-fix, review, multi-cli, ui |
| `ccw-exploration` | 22 | Level 4: brainstorm, spec-driven, full, greenfield |
| `ccw-with-file` | 9 | With-File: analyze, debug, collab-plan, roadmap |
| `ccw-cycle` | 4 | Cycle: integration-test, refactor |
| `ccw-issue` | 13 | Issue: batch, rapid-to-issue, brainstorm-to-issue |
| `ccw-team` | 1 | Team: team-planex |

## phases/ — Actual Command/Skill Documents

Step nodes reference actual docs via `content_ref`. The `phases/` directory contains:

**Commands** (flat files — copied from `.claude/commands/`):
- `analyze-with-file.md`, `brainstorm-with-file.md`, `collaborative-plan-with-file.md`
- `debug-with-file.md`, `integration-test-cycle.md`, `refactor-cycle.md`
- `roadmap-with-file.md`, `unified-execute-with-file.md`, `ui-design-explore-auto.md`
- `issue-discover.md`, `issue-plan.md`, `issue-queue.md`, `issue-execute.md`
- `issue-convert-to-plan.md`, `issue-from-brainstorm.md`

**Skills without phases** (flat files — copied from SKILL.md):
- `workflow-lite-plan.md`, `workflow-multi-cli-plan.md`, `team-planex.md`

**Skills with phases** (subdirectories — SKILL.md + phases/):
- `workflow-plan/`, `workflow-execute/`, `workflow-tdd-plan/`
- `workflow-test-fix/`, `review-cycle/`, `brainstorm/`, `spec-generator/`

## Execution Protocol

When chain_loader delivers a step node with a skill/command doc:

1. **Read** the loaded doc content to understand the skill's purpose and interface
2. **Assemble** the Skill call: `Skill(skill_name, args)`
   - First step in pipeline: `args = "${analysis.goal}"`
   - Subsequent steps: `args = ""` (auto-receives session context from prior step)
   - Special args noted in step name (e.g., `--bugfix`, `--hotfix`, `--plan-only`)
3. **Propagate -y**: If auto mode active, append `-y` to args
4. **Execute**: `Skill(skill_name, args)` — blocking, wait for completion
5. **Track**: Update TodoWrite status, proceed to next step via `done`

```javascript
// Auto mode detection
const autoYes = /\b(-y|--yes)\b/.test($ARGUMENTS);

// Skill call assembly with -y propagation
function assembleCommand(skillName, args, previousResult) {
  if (!args && previousResult?.session_id) {
    args = `--session="${previousResult.session_id}"`;
  }
  if (autoYes && !args.includes('-y') && !args.includes('--yes')) {
    args = args ? `${args} -y` : '-y';
  }
  return { skill: skillName, args };
}
```

## Auto Mode (`-y` / `--yes`)

- D1 Clarity Check: always choose "Clear" (skip clarification)
- Confirmation: skip, execute directly
- Error handling: auto-skip failed steps, continue pipeline
- Propagation: `-y` injected into every downstream Skill call

## Intent Analysis (ccw-main S1)

Detect task_type by regex priority — see `specs/intent-patterns.md` for full patterns.

Key mappings: task_type → category chain → specific flow

## Execution via chain_loader

```bash
# Start
ccw tool exec chain_loader '{"cmd":"start","skill":"ccw-chain","chain":"ccw-main"}'

# Progress through steps
ccw tool exec chain_loader '{"cmd":"done","session_id":"CL-ccw-chain-..."}'

# Decision nodes: pass choice index (1-based)
ccw tool exec chain_loader '{"cmd":"done","session_id":"CL-ccw-chain-...","choice":1}'
```

## Pipeline Examples

| Input | Chain Path | Pipeline |
|-------|-----------|----------|
| "Add API endpoint" | main→lightweight→Rapid | lite-plan → test-fix |
| "Fix login timeout" | main→lightweight→Bugfix | lite-plan(--bugfix) → test-fix |
| "OAuth2 system" (high) | main→standard→Coupled | plan → execute → review → test-fix |
| "brainstorm: notifications" | main→exploration→Brainstorm | brainstorm-file → plan → execute → test-fix |
| "debug WebSocket" | main→with-file→Debug | debug-with-file |
| "integration test: payments" | main→cycle→Integration | integration-test-cycle |
| "roadmap: OAuth + 2FA" | main→with-file→Roadmap | roadmap-file → team-planex |
