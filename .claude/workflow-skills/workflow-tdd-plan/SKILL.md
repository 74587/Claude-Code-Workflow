---
name: workflow-tdd-plan
description: Chain-loaded TDD planning. 7-phase with Red-Green-Refactor task generation.
allowed-tools: chain_loader(*)
---
# Workflow TDD Plan (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=workflow-tdd-plan` — Full TDD pipeline
- `chain_loader start --chain=workflow-tdd-plan --entry=verify` — TDD verify only
Phases from `.claude/skills/workflow-tdd-plan/phases/`.
Variables: session_id, goal, auto_yes, conflict_risk
