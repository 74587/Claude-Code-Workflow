---
name: spec-generator
description: Chain-loaded spec generation. 8-phase with quality gate loop and auto-fix.
allowed-tools: chain_loader(*)
---
# Spec Generator (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=spec-generator` — Full spec generation
- `chain_loader start --chain=spec-generator --entry=continue` — Resume from quality gate
Phases from `.claude/skills/spec-generator/phases/`.
Variables: readiness_score, fix_iterations, goal, auto_yes
