---
name: code-analysis
description: Deep code analysis and debugging using CLI tools with specialized template
usage: /cli:mode:code-analysis [--tool <codex|gemini|qwen>] [--enhance] [--cd "path"] "analysis target"
argument-hint: "[--tool codex|gemini|qwen] [--enhance] [--cd path] analysis target"
examples:
  - /cli:mode:code-analysis "analyze authentication flow logic"
  - /cli:mode:code-analysis --tool qwen --enhance "explain data transformation pipeline"
  - /cli:mode:code-analysis --tool codex --cd "src/core" "trace execution path for user registration"
allowed-tools: SlashCommand(*), Bash(*)
---

# CLI Mode: Code Analysis (/cli:mode:code-analysis)

## Purpose

Execute systematic code analysis and debugging using CLI tools with specialized code analysis template.

**Supported Tools**: codex, gemini (default), qwen

## Execution Flow

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[analysis-target]"` first
3. Parse analysis target (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with code-analysis template
6. Execute deep analysis
7. Save to session (if active)

## Core Rules

1. **Tool Selection**: Use `--tool` value or default to gemini
2. **Enhance First (if flagged)**: Execute `/enhance-prompt` before analysis
3. **Directory Context**: Use `cd` when `--cd` provided or auto-detected
4. **Template Required**: Always use code-analysis template
5. **Session Output**: Save to `.workflow/WFS-[id]/.chat/code-analysis-[timestamp].md`

## Analysis Capabilities

The code-analysis template provides:
- **Systematic Code Analysis**: Break down complex code into manageable parts
- **Execution Path Tracing**: Track variable states and call stacks
- **Control & Data Flow**: Understand code logic and data transformations
- **Call Flow Visualization**: Diagram function calling sequences
- **Logical Reasoning**: Explain "why" behind code behavior
- **Debugging Insights**: Identify potential bugs or inefficiencies

## Command Templates

### Gemini (Default)
```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [analysis goal from target]
TASK: Deep code analysis with execution path tracing
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Systematic analysis, call flow diagram, data transformations, logical explanation
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on [specific aspect]
"
```

### Qwen
```bash
cd [directory] && ~/.claude/scripts/qwen-wrapper --all-files -p "
PURPOSE: [analysis goal from target]
TASK: Architecture-level code analysis and pattern recognition
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Architectural insights, design patterns, code structure analysis
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on [specific aspect]
"
```

### Codex
```bash
codex -C [directory] --full-auto exec "
PURPOSE: [analysis goal from target]
TASK: Deep code inspection with debugging insights
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Execution trace, bug identification, optimization opportunities
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on [specific aspect]
" --skip-git-repo-check -s danger-full-access
```

## Examples

**Basic Code Analysis (Gemini)**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Analyze authentication flow logic
TASK: Trace authentication execution path and identify key functions
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Step-by-step flow, call diagram, data passing between functions
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on control flow and security
"
```

**Architecture Analysis (Qwen)**:
```bash
# User: /cli:mode:code-analysis --tool qwen "explain data transformation pipeline"

cd . && ~/.claude/scripts/qwen-wrapper --all-files -p "
PURPOSE: Explain data transformation pipeline architecture
TASK: Analyze data flow and transformation patterns
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Pipeline structure, transformation stages, data format changes
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on data flow and patterns
"
```

**Deep Debugging (Codex)**:
```bash
# User: /cli:mode:code-analysis --tool codex --cd "src/core" "trace execution path for user registration"

codex -C src/core --full-auto exec "
PURPOSE: Trace execution path for user registration
TASK: Deep analysis of registration flow with debugging insights
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Complete execution trace, variable states, potential issues
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on edge cases and error handling
" --skip-git-repo-check -s danger-full-access
```

**With Enhancement**:
```bash
# User: /cli:mode:code-analysis --enhance "why is login slow"

# Step 1: Enhance
/enhance-prompt "why is login slow"
# Returns:
# INTENT: Identify performance bottlenecks in login flow
# CONTEXT: Authentication module, database queries
# ACTION: Trace execution path → identify slow operations → suggest optimizations

# Step 2: Analyze with enhanced context
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Identify performance bottlenecks in login flow
TASK: Trace login execution path and measure operation costs
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} @{**/*auth*,**/*login*}
EXPECTED: Performance analysis, bottleneck identification, optimization recommendations
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on performance and database queries
"
```

## Analysis Output Structure

Based on code-analysis.md template, output includes:

### 1. 思考过程 (Thinking Process)
- Analysis strategy and approach
- Key assumptions about code behavior

### 2. 对问题的理解 (Understanding)
- Restate analysis target
- Confirm understanding of requirements

### 3. 核心解答 (Core Answer)
- Direct, concise answer to analysis question

### 4. 详细分析与调用逻辑 (Detailed Analysis)
- **代码段识别**: Relevant code sections
- **执行流程**: Step-by-step execution flow
- **调用图**: Visual call flow diagram with symbols:
  - `───►` Function call
  - `◄───` Return
  - `│` Continuation
  - `├─` Intermediate step
  - `└─` Last step in block
- **数据传递**: Data passing and state changes
- **逻辑解释**: Why code behaves this way

### 5. 总结 (Summary)
- Key findings and recommendations

## Session Output

**Location**: `.workflow/WFS-[topic]/.chat/code-analysis-[timestamp].md`

**Includes**:
- Analysis target
- Template used
- Complete structured analysis
- Call flow diagrams
- Debugging insights
- Recommendations

## Use Cases

| Use Case | Best Tool | Focus |
|----------|-----------|-------|
| **Understand execution flow** | gemini | Call sequences, data flow |
| **Architectural patterns** | qwen | Design patterns, structure |
| **Performance debugging** | codex | Bottlenecks, optimizations |
| **Bug investigation** | codex | Error paths, edge cases |
| **Code review** | gemini | Logic correctness, clarity |
| **Refactoring planning** | qwen | Structure improvements |

## Tool Selection Guide

- **Gemini**: Best for general code understanding and tracing
- **Qwen**: Best for architectural analysis and pattern recognition
- **Codex**: Best for deep debugging and performance analysis