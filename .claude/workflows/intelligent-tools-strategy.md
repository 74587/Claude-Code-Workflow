---
name: intelligent-tools-strategy
description: Strategic decision framework for intelligent tool selection
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## ⚡ Core Decision Framework

**Gemini**: Analysis & understanding large codebases
**Codex**: Development & autonomous implementation

> **Implementation Details**: See @~/.claude/workflows/tools-implementation-guide.md

## 🎯 Tool Selection Matrix

### When to Use Gemini
- **Command**: `~/.claude/scripts/gemini-wrapper -p "prompt"`
- **Strengths**: Large context window, pattern recognition across modules
- **Best For**:
  - Project architecture analysis (>50 files)
  - Cross-module pattern detection
  - Coding convention analysis
  - Refactoring with broad dependencies
  - Large codebase understanding

### When to Use Codex
- **Command**: `codex --full-auto exec "prompt" -s danger-full-access`
- **Strengths**: Mathematical reasoning, autonomous development
- **Best For**:
  - Complex algorithm analysis
  - Security vulnerability assessment
  - Performance optimization
  - Database schema design
  - API protocol specifications
  - Autonomous feature development

## 📊 Decision Framework

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
| Feature Implementation | Codex | Autonomous development capabilities |
| Architectural Review | Gemini | Large context analysis |

## 🔄 Parallel Analysis Strategy

For complex projects requiring both broad context and deep analysis:
- **Gemini** for architectural understanding
- **Codex** for focused development tasks
- Run both via Task agents when comprehensive coverage needed

## 📈 Complexity-Based Selection

### Simple Projects (≤50 files)
- **Content-driven choice**: Mathematical → Codex, Structural → Gemini

### Medium Projects (50-200 files)
- **Gemini first** for overview and patterns
- **Codex second** for specific implementations

### Large Projects (>200 files)
- **Parallel analysis** with both tools
- **Gemini** for architectural understanding
- **Codex** for focused development tasks

## 🎯 Strategic Guidelines

1. **Task-driven selection**: Let project characteristics drive tool choice
2. **Start simple**: Begin with single tool, escalate to parallel if needed
3. **Context first**: Understand scope before selecting approach
4. **Trust autonomous capabilities**: Let tools handle their specialized domains

## 🔗 Implementation Details

**Complete syntax and usage patterns**: @~/.claude/workflows/tools-implementation-guide.md

---

**Decision Principle**: Choose based on task nature - Gemini excels at understanding, Codex excels at building.