---
name: intelligent-tools
description: Strategic tool selection guide - references unified tool documentation
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## Overview
This document provides strategic guidance for selecting the appropriate analysis tool based on task characteristics and project requirements.

## Tool Documentation References
- **Gemini CLI**: @~/.claude/workflows/gemini-unified.md
- **Codex CLI**: @~/.claude/workflows/codex-unified.md

## Tool Characteristics Comparison

### Gemini
- **Strengths**:
  - Large context window for analyzing many files simultaneously
  - Excellent pattern recognition across modules
  - Superior for architectural and structural analysis
- **Optimal Use Cases**:
  - Large codebase analysis (>50 files)
  - Cross-module pattern detection
  - Coding convention analysis
  - Refactoring with broad dependencies

### Codex
- **Strengths**:
  - Superior mathematical and algorithmic reasoning
  - Deeper technical knowledge base
  - Better for focused, deep analysis
- **Optimal Use Cases**:
  - Complex algorithm analysis
  - Security vulnerability assessment
  - Performance optimization
  - Database schema design
  - API protocol specifications

## Strategic Selection Matrix

| Analysis Need | Recommended Tool | Rationale |
|--------------|------------------|-----------|
| Project Architecture | Gemini | Needs broad context across many files |
| Algorithm Optimization | Codex | Requires deep mathematical reasoning |
| Security Analysis | Codex | Leverages deeper security knowledge |
| Code Patterns | Gemini | Pattern recognition across modules |
| Refactoring | Gemini | Needs understanding of all dependencies |
| API Design | Codex | Technical specification expertise |
| Test Coverage | Gemini | Cross-module test understanding |
| Performance Tuning | Codex | Mathematical optimization capabilities |

## Parallel Analysis Strategy

For complex projects requiring both broad context and deep analysis:

```bash
# Use Task agents to run both tools in parallel
Task(subagent_type="general-purpose",
     prompt="Use Gemini (see @~/.claude/workflows/gemini-unified.md) for architectural analysis")
+
Task(subagent_type="general-purpose",
     prompt="Use Codex (see @~/.claude/workflows/codex-unified.md) for algorithmic analysis")
```

## Implementation Guidelines

1. **Default Selection**: Let project characteristics drive tool choice
2. **Complexity Thresholds**:
   - Simple projects (≤50 files): Either tool based on content type
   - Medium projects (50-200 files): Gemini for overview, Codex for specifics
   - Large projects (>200 files): Parallel analysis with both tools

3. **Content-Based Selection**:
   - Mathematical/algorithmic content → Codex
   - Architectural/structural content → Gemini
   - Mixed content → Both via Task agents

## Usage in Commands

Commands should reference this strategy guide for tool selection decisions.
Specific tool usage syntax and examples are documented in their respective unified guides.

**See also**:
- Gemini detailed usage: @~/.claude/workflows/gemini-unified.md
- Codex detailed usage: @~/.claude/workflows/codex-unified.md