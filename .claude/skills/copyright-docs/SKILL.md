---
name: copyright-docs
description: Generate software copyright design specification documents compliant with China Copyright Protection Center (CPCC) standards. Creates complete design documents with Mermaid diagrams based on source code analysis. Use for software copyright registration, generating design specification, creating CPCC-compliant documents, or documenting software for intellectual property protection. Triggers on "软件著作权", "设计说明书", "版权登记", "CPCC", "软著申请".
allowed-tools: Task, AskUserQuestion, Read, Bash, Glob, Grep, Write
---

# Software Copyright Documentation Skill

Generate CPCC-compliant software design specification documents (软件设计说明书) through multi-phase code analysis.

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Metadata Collection                                   │
│  → Read: phases/01-metadata-collection.md                       │
│  → Collect: software name, version, category, scope             │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Deep Code Analysis                                    │
│  → Read: phases/02-deep-analysis.md                             │
│  → Launch: 6 parallel agents (architecture, functions,          │
│            algorithms, data_structures, interfaces, exceptions) │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: Diagram Generation                                    │
│  → Read: phases/03-diagram-generation.md                        │
│  → Reference: ../_shared/mermaid-utils.md                       │
│  → Generate: Mermaid diagrams for all 7 sections                │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: Document Assembly                                     │
│  → Read: phases/04-document-assembly.md                         │
│  → Reference: specs/cpcc-requirements.md                        │
│  → Assemble: 7-section CPCC-compliant document                  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: Compliance Review & Refinement                        │
│  → Read: phases/05-compliance-refinement.md                     │
│  → Reference: specs/cpcc-requirements.md (Compliance Checklist) │
│  → Validate: run CPCC compliance checks before each iteration   │
│  → Loop: discovery-driven questions until all checks pass       │
└─────────────────────────────────────────────────────────────────┘
```

## Document Sections (7 Required)

| Section | Title | Diagram |
|---------|-------|---------|
| 1 | 软件概述 | - |
| 2 | 系统架构图 | graph TD |
| 3 | 功能模块设计 | flowchart TD |
| 4 | 核心算法与流程 | flowchart TD |
| 5 | 数据结构设计 | classDiagram |
| 6 | 接口设计 | sequenceDiagram |
| 7 | 异常处理设计 | flowchart TD |

## Directory Setup

```bash
timestamp=$(date +%Y%m%d-%H%M%S)
dir=".workflow/.scratchpad/copyright-$timestamp"
mkdir -p "$dir/diagrams" "$dir/iterations"
echo "$dir"
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/01-metadata-collection.md](phases/01-metadata-collection.md) | Software info collection |
| [phases/02-deep-analysis.md](phases/02-deep-analysis.md) | 6-agent parallel analysis |
| [phases/03-diagram-generation.md](phases/03-diagram-generation.md) | Mermaid diagram generation |
| [phases/04-document-assembly.md](phases/04-document-assembly.md) | Document structure assembly |
| [phases/05-compliance-refinement.md](phases/05-compliance-refinement.md) | Iterative refinement loop |
| [specs/cpcc-requirements.md](specs/cpcc-requirements.md) | CPCC compliance checklist |
| [../_shared/mermaid-utils.md](../_shared/mermaid-utils.md) | Shared Mermaid utilities |

## Output Structure

```
.workflow/.scratchpad/copyright-{timestamp}/
├── project-metadata.json
├── analysis-architecture.json
├── analysis-functions.json
├── analysis-algorithms.json
├── analysis-data_structures.json
├── analysis-interfaces.json
├── analysis-exceptions.json
├── diagrams/
│   ├── manifest.json
│   ├── architecture.mmd
│   ├── functions.mmd
│   ├── class-diagram.mmd
│   ├── algorithm-*.mmd
│   └── sequence-*.mmd
├── iterations/
└── {软件名称}-软件设计说明书.md
```
