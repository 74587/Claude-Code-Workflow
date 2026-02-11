---
name: spec
description: Specification generator - 6 phase document chain producing product brief, PRD, architecture, and epics. Triggers on "generate spec", "create specification", "spec generator".
argument-hint: "[-y|--yes] [-c|--continue] \"idea or requirement description\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm decisions, use recommended defaults, skip interactive validation.

# Workflow Spec Command (/workflow:spec)

## Quick Start

```bash
# Basic usage
/workflow:spec "Build a task management system with real-time collaboration"

# Auto mode (skip all confirmations)
/workflow:spec -y "User authentication system with OAuth2 and 2FA"

# Continue existing session
/workflow:spec -c "task management"

# Combined
/workflow:spec -y -c "task management"
```

**Skill**: `spec-generator`
**Output Directory**: `.workflow/.spec/SPEC-{slug}-{YYYY-MM-DD}/`
**Core Flow**: Discovery -> Product Brief -> PRD -> Architecture -> Epics -> Readiness Check

## What This Command Does

Generates a complete specification package through 6 sequential phases:

1. **Discovery**: Analyze seed idea, explore codebase (optional), establish session
2. **Product Brief**: Multi-CLI analysis (Product/Technical/User perspectives)
3. **Requirements (PRD)**: Functional + non-functional requirements with MoSCoW priorities
4. **Architecture**: Component design, tech stack, ADRs with review
5. **Epics & Stories**: Implementation breakdown with dependency mapping
6. **Readiness Check**: Cross-document validation, quality scoring, handoff

## Output Artifacts

| Phase | Artifact | Description |
|-------|----------|-------------|
| 1 | `spec-config.json` | Session configuration and state |
| 1 | `discovery-context.json` | Codebase exploration (optional) |
| 2 | `product-brief.md` | Product brief with multi-perspective synthesis |
| 3 | `requirements.md` | Detailed PRD with acceptance criteria |
| 4 | `architecture.md` | Architecture decisions and component design |
| 5 | `epics.md` | Epic/Story breakdown with dependencies |
| 6 | `readiness-report.md` | Quality validation report |
| 6 | `spec-summary.md` | One-page executive summary |

## Flags

| Flag | Description |
|------|-------------|
| `-y`, `--yes` | Auto mode: skip all confirmations, use defaults |
| `-c`, `--continue` | Resume from last completed phase |

## After Completion

The readiness check (Phase 6) offers handoff to execution workflows:

- `/workflow:lite-plan` - Execute one Epic at a time (direct text input)
- `/workflow:req-plan-with-file` - Generate execution roadmap
- `/workflow:plan` - Full planning for entire scope
- `/issue:new` - Create issues per Epic

### Plan Integration (Automatic Bridge)

When selecting "Full planning" or "Create roadmap", Phase 6 automatically:

1. Creates a WFS session via `/workflow:session:start`
2. Generates `.brainstorming/` bridge files in the session directory:
   - `guidance-specification.md` — synthesized from spec outputs (product-brief + requirements + architecture key decisions)
   - `feature-specs/feature-index.json` — maps each Epic to a Feature entry
   - `feature-specs/F-{num}-{slug}.md` — individual feature spec per Epic
3. Invokes the downstream workflow (`/workflow:plan` or `/workflow:req-plan-with-file`)

The `context-search-agent` auto-discovers these `.brainstorming/` files and populates `context-package.json.brainstorm_artifacts`, which `action-planning-agent` consumes via the standard priority chain: `guidance_specification` → `feature_index` → `feature_specs`. No manual bridging required.

## When to Use

- Starting a new product/feature from scratch
- Need structured specification before implementation
- Want multi-perspective analysis of an idea
- Need traceable requirement -> architecture -> story chain
- Replacing ad-hoc brainstorming with structured output

## Compared to Other Workflows

| Workflow | Use When |
|----------|----------|
| `/workflow:spec` | Need full specification package before any coding |
| `/workflow:brainstorm-with-file` | Exploring ideas, not ready for structure |
| `/workflow:lite-plan` | Have clear requirements, ready to implement |
| `/workflow:plan` | Have requirements, need detailed task planning |
| `/workflow:req-plan-with-file` | Have requirements, need layered roadmap |

---

**Now execute spec-generator for**: $ARGUMENTS
