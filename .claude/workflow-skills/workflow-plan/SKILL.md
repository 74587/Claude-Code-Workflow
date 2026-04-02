---
name: workflow-plan
description: Chain-loaded workflow planning. 6-phase with mode routing and conflict detection.
allowed-tools: chain_loader(*)
---
# Workflow Plan (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=workflow-plan` — Full pipeline
- `chain_loader start --chain=workflow-plan --entry=verify` — Verify only
- `chain_loader start --chain=workflow-plan --entry=replan` — Replan existing
Phases from `.claude/skills/workflow-plan/phases/`.
Variables: session_id, goal, auto_yes, conflict_risk
