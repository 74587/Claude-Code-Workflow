---
name: Parallel Dev Cycle
description: Multi-agent parallel development cycle with requirement analysis, exploration planning, code development, and validation. Supports continuous iteration with markdown progress documentation.
argument-hint: TASK="<task description>" [--cycle-id=<id>] [--auto] [--parallel=<count>]
---

# Parallel Dev Cycle - Multi-Agent Development Workflow

Multi-agent parallel development cycle using Codex subagent pattern with four specialized workers:
1. **Requirements Analysis & Extension** (RA) - Requirement analysis and self-enhancement
2. **Exploration & Planning** (EP) - Exploration and planning
3. **Code Development** (CD) - Code development with debug strategy support
4. **Validation & Archival Summary** (VAS) - Validation and archival summary

Each agent **maintains only one main document file**, supporting versioning, automatic archival, and complete history tracking.

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| TASK | No | Task description (for new cycle, mutually exclusive with --cycle-id) |
| --cycle-id | No | Existing cycle ID to continue (from API or previous session) |
| --auto | No | Auto-cycle mode (run all phases sequentially) |
| --parallel | No | Number of parallel agents (default: 4, max: 4) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input (Task)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
                  ┌──────────────────────┐
                  │  Orchestrator Agent  │  (Coordinator)
                  │  (spawned once)      │
                  └──────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        v                    v                    v
    ┌────────┐         ┌────────┐         ┌────────┐
    │  RA    │         │  EP    │         │  CD    │
    │Agent   │         │Agent   │         │Agent   │
    └────────┘         └────────┘         └────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             v
                         ┌────────┐
                         │  VAS   │
                         │ Agent  │
                         └────────┘
                             │
                             v
                  ┌──────────────────────┐
                  │    Summary Report    │
                  │  & Markdown Docs     │
                  └──────────────────────┘
```

## Key Design Principles

1. **Single File Per Agent**: Each agent maintains only one main file (clean and simple)
2. **Version-Based Overwrite**: Each version completely rewrites the main file
3. **Automatic Archival**: Old versions automatically archived to `history/` directory
4. **Complete Audit Trail**: Changes.log (NDJSON) preserves all change history
5. **Parallel Execution**: Four agents work simultaneously, no waiting
6. **File References**: Use short file paths instead of content passing
7. **Self-Enhancement**: RA agent proactively extends requirements based on context

## Session Structure

```
.workflow/.cycle/
+-- {cycleId}.json                                 # Master state file
+-- {cycleId}.progress/
    +-- ra/
    |   +-- requirements.md                        # Current version (complete rewrite)
    |   +-- changes.log                            # NDJSON complete history (append-only)
    |   └-- history/
    |       +-- requirements-v1.0.0.md             # Archived snapshot
    |       +-- requirements-v1.1.0.md             # Archived snapshot
    +-- ep/
    |   +-- plan.md                                # Current version
    |   +-- changes.log                            # NDJSON complete history
    |   └-- history/
    |       +-- plan-v1.0.0.md
    |       +-- plan-v1.1.0.md
    +-- cd/
    |   +-- implementation.md                      # Current version
    |   +-- debug-log.ndjson                       # Debug hypothesis tracking
    |   +-- changes.log                            # NDJSON complete history
    |   └-- history/
    |       +-- implementation-v1.0.0.md
    |       +-- implementation-v1.1.0.md
    +-- vas/
    |   +-- summary.md                             # Current version
    |   +-- changes.log                            # NDJSON complete history
    |   └-- history/
    |       +-- summary-v1.0.0.md
    |       +-- summary-v1.1.0.md
    └-- coordination/
        +-- timeline.md                            # Execution timeline
        +-- decisions.log                          # Decision log
```

## State Management

State schema is defined in [phases/state-schema.md](phases/state-schema.md). The master state file (`{cycleId}.json`) tracks:

- Cycle metadata (id, title, status, iterations)
- Agent states (status, output files, version)
- Shared context (requirements, plan, changes, test results)
- Coordination data (feedback log, decisions, blockers)

## Versioning Workflow

### Initial Version (v1.0.0)

```bash
/parallel-dev-cycle TASK="Implement OAuth login"
```

Generates:
```
requirements.md (v1.0.0)
plan.md (v1.0.0)
implementation.md (v1.0.0) - if applicable
summary.md (v1.0.0) - if applicable
```

### Iteration Versions (v1.1.0, v1.2.0)

```bash
/parallel-dev-cycle --cycle-id=cycle-v1-xxx --extend="Add GitHub support"
```

**Automatic handling**:
1. Read current `requirements.md (v1.0.0)`
2. Auto-archive to `history/requirements-v1.0.0.md`
3. Recreate `requirements.md (v1.1.0)` - complete overwrite
4. Append changes to `changes.log` (NDJSON)

## Changes.log Format (NDJSON)

Permanent audit log (append-only, never deleted):

```jsonl
{"timestamp":"2026-01-22T10:00:00+08:00","version":"1.0.0","agent":"ra","action":"create","change":"Initial requirements","iteration":1}
{"timestamp":"2026-01-22T11:00:00+08:00","version":"1.1.0","agent":"ra","action":"update","change":"Added Google OAuth requirement","iteration":2}
{"timestamp":"2026-01-22T11:30:00+08:00","version":"1.0.0","agent":"ep","action":"create","change":"Initial implementation plan","iteration":1}
```

## Usage

```bash
# Start new cycle
/parallel-dev-cycle TASK="Implement real-time notifications"

# Continue cycle
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123

# Iteration with extension
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123 --extend="Also add email notifications"

# Auto mode
/parallel-dev-cycle --auto TASK="Add OAuth authentication"
```

## Key Benefits

- **Simple**: Each agent maintains only 1 file + changes.log
- **Efficient**: Version rewrite without complex version marking
- **Traceable**: Complete history in `history/` and `changes.log`
- **Fast**: Agent reads current version quickly (no history parsing needed)
- **Auditable**: NDJSON changes.log fully traces every change
- **Self-Enhancing**: RA agent proactively extends requirements
- **Debug-Ready**: CD agent supports hypothesis-driven debugging

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/orchestrator.md](phases/orchestrator.md) | Orchestrator logic |
| [phases/state-schema.md](phases/state-schema.md) | State structure definition |
| [phases/agents/](phases/agents/) | Four agent role definitions |
| [specs/coordination-protocol.md](specs/coordination-protocol.md) | Communication protocol |
| [specs/versioning-strategy.md](specs/versioning-strategy.md) | Version management |
