---
name: document-analysis
description: Read-only technical document/paper analysis using Gemini/Qwen/Codex with systematic comprehension template for insights extraction
argument-hint: "[--tool codex|gemini|qwen] [--enhance] [--cd path] document path or topic"
allowed-tools: SlashCommand(*), Bash(*), Task(*), Read(*)
---

# CLI Mode: Document Analysis (/cli:mode:document-analysis)

## Purpose

Systematic analysis of technical documents, research papers, API documentation, and technical specifications.

**Tool Selection**:
- **gemini** (default) - Best for document comprehension and structure analysis
- **qwen** - Fallback when Gemini unavailable
- **codex** - Alternative for complex technical documents

**Key Feature**: `--cd` flag for directory-scoped document discovery

## Parameters

- `--tool <gemini|qwen|codex>` - Tool selection (default: gemini)
- `--enhance` - Enhance analysis target with `/enhance-prompt`
- `--cd "path"` - Target directory for document search
- `<document-path-or-topic>` (Required) - File path or topic description

## Tool Usage

**Gemini** (Primary):
```bash
/cli:mode:document-analysis "README.md"
/cli:mode:document-analysis --tool gemini "analyze API documentation"
```

**Qwen** (Fallback):
```bash
/cli:mode:document-analysis --tool qwen "docs/architecture.md"
```

**Codex** (Alternative):
```bash
/cli:mode:document-analysis --tool codex "research paper in docs/"
```

## Execution Flow

Uses **cli-execution-agent** for automated document analysis:

```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Systematic document comprehension and insights extraction",
  prompt=`
    Task: ${document_path_or_topic}
    Mode: document-analysis
    Tool: ${tool_flag || 'gemini'}
    Directory: ${cd_path || '.'}
    Enhance: ${enhance_flag}
    Template: ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-technical-document.txt

    Execute systematic document analysis:

    1. Document Discovery:
       - Locate target document(s) via path or topic keywords
       - Identify document type (README, API docs, research paper, spec, tutorial)
       - Detect document format (Markdown, PDF, plain text, reStructuredText)
       - Discover related documents (references, appendices, examples)
       - Use MCP/ripgrep for comprehensive file discovery

    2. Pre-Analysis Planning (Required):
       - Determine document structure (sections, hierarchy, flow)
       - Identify key components (abstract, methodology, implementation details)
       - Map dependencies and cross-references
       - Assess document scope and complexity
       - Plan analysis approach based on document type

    3. CLI Command Construction:
       - Tool: ${tool_flag || 'gemini'} (qwen fallback, codex for complex docs)
       - Directory: cd ${cd_path || '.'} &&
       - Context: @{document_paths} + @CLAUDE.md + related files
       - Mode: analysis (read-only)
       - Template: analysis/02-analyze-technical-document.txt

    4. Analysis Execution:
       - Apply 6-field template structure (PURPOSE, TASK, MODE, CONTEXT, EXPECTED, RULES)
       - Execute multi-phase analysis protocol with pre-planning
       - Perform self-critique before final output
       - Generate structured report with evidence-based insights

    5. Output Generation:
       - Comprehensive document analysis report
       - Structured insights with section references
       - Critical assessment with evidence
       - Actionable recommendations
       - Save to .workflow/active/WFS-[id]/.chat/doc-analysis-[timestamp].md (or .scratchpad/)
  `
)
```

## Core Rules

- **Read-only**: Analyzes documents, does NOT modify files
- **Evidence-based**: All claims must reference specific sections/pages
- **Pre-planning**: Requires analysis approach planning before execution
- **Precise language**: Direct, accurate wording - no persuasive embellishment
- **Output**: `.workflow/active/WFS-[id]/.chat/doc-analysis-[timestamp].md` (or `.scratchpad/` if no session)

## Document Types Supported

| Type | Focus Areas | Key Outputs |
|------|-------------|-------------|
| README | Purpose, setup, usage | Integration steps, quick-start guide |
| API Documentation | Endpoints, parameters, responses | API usage patterns, integration points |
| Research Paper | Methodology, findings, validity | Applicable techniques, implementation feasibility |
| Specification | Requirements, standards, constraints | Compliance checklist, implementation requirements |
| Tutorial | Learning path, examples, exercises | Key concepts, practical applications |
| Architecture Docs | System design, components, patterns | Design decisions, integration points, trade-offs |

## Best Practices

1. **Scope Definition**: Clearly define what aspects to analyze before starting
2. **Layered Reading**: Structure/Overview → Details → Critical Analysis → Synthesis
3. **Evidence Trail**: Track section references for all extracted information
4. **Gap Identification**: Note missing information or unclear sections explicitly
5. **Actionable Output**: Focus on insights that inform decisions or actions
