---
name: review-cycle
description: Chain-loaded review cycle. 3-mode routing for session, module, or fix review.
allowed-tools: chain_loader(*)
---
# Review Cycle (Chain-Loaded)
Use `chain_loader` to execute:
- `chain_loader start --chain=ccw-review-cycle` — Mode routing entry
- `chain_loader start --chain=ccw-review-cycle --entry=session` — Session review
- `chain_loader start --chain=ccw-review-cycle --entry=module` — Module review
- `chain_loader start --chain=ccw-review-cycle --entry=fix` — Fix review
Phases from `.claude/skills/review-cycle/`.
Variables: review_status, fix_count
