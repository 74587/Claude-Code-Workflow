---
name: intelligent-tools-strategy
description: Strategic guide for intelligent tool selection - quick start and decision framework
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## ⚡ Quick Start

### Essential Commands

**Gemini** (Analysis & Pattern Recognition):
```bash
~/.claude/scripts/gemini-wrapper -p "analyze authentication patterns"
```

**Codex** (Development & Implementation):
```bash
codex --full-auto exec "implement user authentication system" -s danger-full-access
```

### ⚠️ CRITICAL Command Differences

| Tool | Command | Has Wrapper | Key Feature |
|------|---------|-------------|-------------|
| **Gemini** | `~/.claude/scripts/gemini-wrapper` | ✅ YES | Large context window, pattern recognition |
| **Codex** | `codex --full-auto exec ... -s danger-full-access` | ❌ NO | Autonomous development, math reasoning |

**❌ NEVER use**: `~/.claude/scripts/codex` - this wrapper does not exist!

### 🔒 Codex Sandbox Modes

Codex requires the `-s` (sandbox) parameter for write operations:

- **`-s read-only`**: Safe analysis mode, no file modifications
- **`-s workspace-write`**: Standard development mode, can modify project files
- **`-s danger-full-access`**: Full system access (RECOMMENDED for development tasks)

**Default Choice**: Use `-s danger-full-access` for all development and implementation tasks.

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

```bash
# Use Task agents to run both tools in parallel
Task(subagent_type="general-purpose",
     prompt="Use Gemini (see @~/.claude/workflows/tools-implementation-guide.md) for architectural analysis")
+
Task(subagent_type="general-purpose",
     prompt="Use Codex (see @~/.claude/workflows/tools-implementation-guide.md) for algorithmic analysis")
```

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

## 🎯 Quick Reference

### Gemini Quick Commands
```bash
# Pattern analysis
~/.claude/scripts/gemini-wrapper -p "analyze existing patterns in auth module"

# Architecture review
cd src && ~/.claude/scripts/gemini-wrapper -p "review overall architecture"

# Code conventions
~/.claude/scripts/gemini-wrapper -p "identify coding standards and conventions"
```

### Codex Quick Commands
```bash
# Feature development
codex --full-auto exec "implement JWT authentication with refresh tokens" -s danger-full-access

# Performance optimization
codex --full-auto exec "optimize database queries in user service" -s danger-full-access

# Security enhancement
codex --full-auto exec "add input validation and sanitization" -s danger-full-access
```

## 📋 Implementation Guidelines

1. **Default Selection**: Let project characteristics drive tool choice
2. **Start Simple**: Begin with single tool, escalate to parallel if needed
3. **Context First**: Understand scope before selecting approach
4. **Trust the Tools**: Let autonomous capabilities handle complexity

## 🔗 Detailed Implementation

For comprehensive syntax, patterns, and advanced usage:
- **Implementation Guide**: @~/.claude/workflows/tools-implementation-guide.md

## 📊 Tools Comparison Summary

| Feature | Gemini | Codex |
|---------|--------|-------|
| **Command Syntax** | Has wrapper script | Direct command only |
| **File Loading** | `--all-files` available | `@` patterns required |
| **Default Mode** | Interactive analysis | `--full-auto exec ... -s danger-full-access` automation |
| **Primary Use** | Analysis & planning | Development & implementation |
| **Context Window** | Very large | Standard with smart discovery |
| **Automation Level** | Manual implementation | Autonomous execution |
| **Best For** | Understanding codebases | Building features |

---

**Remember**: Choose based on task nature, not personal preference. Gemini excels at understanding, Codex excels at building.