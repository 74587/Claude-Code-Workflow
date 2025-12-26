---
name: project-analyze
description: Multi-phase iterative project analysis with Mermaid diagrams. Generates architecture reports, design reports, method analysis reports. Use when analyzing codebases, understanding project structure, reviewing architecture, exploring design patterns, or documenting system components. Triggers on "analyze project", "architecture report", "design analysis", "code structure", "system overview".
allowed-tools: Task, AskUserQuestion, Read, Bash, Glob, Grep, Write
---

# Project Analysis Skill

Generate comprehensive project analysis reports through multi-phase iterative workflow.

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Requirements Discovery                                │
│  → Read: phases/01-requirements-discovery.md                    │
│  → Collect: report type, depth level, scope                     │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Project Exploration                                   │
│  → Read: phases/02-project-exploration.md                       │
│  → Launch: parallel cli-explore-agents                          │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: Deep Analysis                                         │
│  → Read: phases/03-deep-analysis.md                             │
│  → Execute: Gemini CLI with exploration context                 │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3.5: Diagram Generation                                  │
│  → Read: phases/03.5-diagram-generation.md                      │
│  → Reference: ../_shared/mermaid-utils.md                       │
│  → Generate: Mermaid diagrams based on report type              │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: Report Generation                                     │
│  → Read: phases/04-report-generation.md                         │
│  → Reference: specs/quality-standards.md (Report Requirements)  │
│  → Assemble: Markdown report with embedded diagrams             │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: Iterative Refinement                                  │
│  → Read: phases/05-iterative-refinement.md                      │
│  → Reference: specs/quality-standards.md (Quality Gates)        │
│  → Validate: run quality checks before each iteration           │
│  → Loop: discovery-driven questions until all gates pass        │
└─────────────────────────────────────────────────────────────────┘
```

## Report Types

| Type | Output | Focus |
|------|--------|-------|
| `architecture` | ARCHITECTURE-REPORT.md | System structure, modules, dependencies |
| `design` | DESIGN-REPORT.md | Patterns, classes, interfaces |
| `methods` | METHODS-REPORT.md | Algorithms, critical paths, APIs |
| `comprehensive` | COMPREHENSIVE-REPORT.md | All above combined |

## Directory Setup

```bash
timestamp=$(date +%Y%m%d-%H%M%S)
dir=".workflow/.scratchpad/analyze-$timestamp"
mkdir -p "$dir/diagrams" "$dir/iterations"
echo "$dir"
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/01-requirements-discovery.md](phases/01-requirements-discovery.md) | User interaction, config collection |
| [phases/02-project-exploration.md](phases/02-project-exploration.md) | Parallel agent exploration |
| [phases/03-deep-analysis.md](phases/03-deep-analysis.md) | Gemini CLI analysis |
| [phases/03.5-diagram-generation.md](phases/03.5-diagram-generation.md) | Mermaid diagram generation |
| [phases/04-report-generation.md](phases/04-report-generation.md) | Report assembly |
| [phases/05-iterative-refinement.md](phases/05-iterative-refinement.md) | Discovery-driven refinement |
| [specs/quality-standards.md](specs/quality-standards.md) | Quality gates, error handling |
| [../_shared/mermaid-utils.md](../_shared/mermaid-utils.md) | Shared Mermaid utilities |

## Output Structure

```
.workflow/.scratchpad/analyze-{timestamp}/
├── analysis-config.json
├── exploration-*.json
├── deep-analysis.json
├── diagrams/
│   ├── manifest.json
│   ├── validation.json
│   └── *.mmd
├── {TYPE}-REPORT.md
└── iterations/
```
