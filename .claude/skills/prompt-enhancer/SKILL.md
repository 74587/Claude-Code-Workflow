---
name: Prompt Enhancer
description: Systematically enhance unclear and ambiguous user prompts by combining session memory with codebase analysis. AUTO-TRIGGER when user input is vague, lacks technical specificity (e.g., "fix", "improve", "clean up", "update", "refactor"), uses unclear references ("it", "that", "this thing"), or affects multiple modules or critical systems. Essential for transforming vague intent into actionable specifications.
allowed-tools: Bash, Read, Glob, Grep
---

# Prompt Enhancer

## Overview

Transforms ambiguous user requests into actionable technical specifications through semantic analysis and session memory integration.

**Core Capability**: Vague intent → Structured specification

## Enhancement Process

### Step 1: Semantic Analysis

Analyze user input to identify:
- **Intent keywords**: fix, improve, add, refactor, update, migrate
- **Technical scope**: single file vs multi-module
- **Domain context**: auth, payment, security, API, UI, database
- **Implied requirements**: performance, security, testing, documentation

### Step 2: Memory Analysis

Extract from conversation history:
- **Technical context**: Previous discussions, decisions, implementations
- **Known patterns**: Identified code patterns, architecture decisions
- **Current state**: What's been built, what's in progress
- **Dependencies**: Related modules, integration points
- **Constraints**: Security requirements, backward compatibility

### Step 3: Context Integration

Combine semantic and memory analysis to determine:
- **Precise intent**: Specific technical goal
- **Required actions**: Implementation steps with file references
- **Critical constraints**: Security, compatibility, testing requirements
- **Missing information**: What needs clarification

## Output Structure

Every enhanced prompt must follow this format:

```
INTENT: [Clear technical goal]
CONTEXT: [Session memory + semantic analysis]
ACTION: [Numbered implementation steps]
ATTENTION: [Critical constraints]
```

**Field Descriptions**:

- **INTENT**: One-sentence technical goal derived from semantic analysis
- **CONTEXT**: Session memory findings + semantic domain analysis
- **ACTION**: Numbered steps with specific file/module references
- **ATTENTION**: Critical constraints, security, compliance, tests

## Semantic Patterns

### Intent Translation

| User Input | Semantic Intent | Focus |
|------------|----------------|-------|
| "fix" + vague target | Debug and resolve | Root cause → preserve behavior |
| "improve" + no metrics | Enhance/optimize | Performance/readability |
| "add" + feature name | Implement feature | Integration + edge cases |
| "refactor" + module | Restructure | Maintain behavior |
| "update" + version | Modernize | Version compatibility |

### Scope Detection

**Single-file scope**:
- "fix button", "add validation", "update component"
- Use session memory only

**Multi-module scope** (>3 modules):
- "add authentication", "refactor payment", "migrate database"
- Analyze dependencies and integration points

**System-wide scope**:
- "improve performance", "add logging", "update security"
- Consider cross-cutting concerns

## Key Principles

1. **Memory First**: Check session memory before assumptions
2. **Semantic Precision**: Extract exact technical intent from vague language
3. **Context Reuse**: Build on previous understanding
4. **Clear Output**: Always structured format
5. **Avoid Duplication**: Reference context, don't repeat

## Best Practices

- **Semantic analysis**: Identify domain, scope, and intent keywords
- **Memory integration**: Extract all relevant context from conversation
- **Structured output**: Always use INTENT/CONTEXT/ACTION/ATTENTION format
- **Actionable steps**: Specific files, clear execution order
- **Critical constraints**: Security, compatibility, testing requirements
