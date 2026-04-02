---
name: workflow-test-fix
description: Chain-loaded test-fix pipeline. 5-phase test generation and iterative execution.
allowed-tools: chain_loader(*)
---
# Workflow Test-Fix (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=workflow-test-fix` — Full test-fix pipeline
- `chain_loader start --chain=workflow-test-fix --entry=execute-only` — Test cycle only
Phases from `.claude/skills/workflow-test-fix/phases/`.
Variables: session_id, goal, auto_yes
