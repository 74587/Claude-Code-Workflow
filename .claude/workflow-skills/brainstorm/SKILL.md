---
name: brainstorm
description: Chain-loaded brainstorming. 4-phase dual-mode with auto multi-role and single-role paths.
allowed-tools: chain_loader(*)
---
# Brainstorm (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=brainstorm` — Mode routing entry
- `chain_loader start --chain=brainstorm --entry=auto` — Direct multi-role
- `chain_loader start --chain=brainstorm --entry=single-role` — Direct single-role
Phases from `.claude/skills/brainstorm/phases/`.
Variables: goal, auto_yes
