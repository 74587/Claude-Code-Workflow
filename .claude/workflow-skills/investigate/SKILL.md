---
name: investigate
description: Chain-loaded investigation. 5-phase Iron Law methodology with root cause gate.
allowed-tools: chain_loader(*)
---
# Investigate (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=ccw-investigate` — Full investigation
- `chain_loader start --chain=ccw-investigate --entry=from-hypothesis` — Skip to hypothesis testing
Phases are inline in chain JSON.
Variables: root_cause, confidence
