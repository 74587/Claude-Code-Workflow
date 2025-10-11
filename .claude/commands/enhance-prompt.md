---
name: enhance-prompt
description: Context-aware prompt enhancement using session memory and codebase analysis
usage: /enhance-prompt <user_input>
argument-hint: "user input to enhance"
---

## Overview

Systematically enhances user prompts by combining session memory context with codebase patterns, translating ambiguous requests into actionable specifications.

## Core Protocol

**Enhancement Pipeline:**
`Intent Translation` → `Context Integration` → `Gemini Analysis (if needed)` → `Structured Output`

**Context Sources:**
- Session memory (conversation history, previous analysis)
- Codebase patterns (via Gemini when triggered)
- Implicit technical requirements

## Gemini Trigger Logic

```pseudo
FUNCTION should_use_gemini(user_prompt):
  critical_keywords = ["refactor", "migrate", "redesign", "auth", "payment", "security"]

  RETURN (
    prompt_affects_multiple_modules(user_prompt, threshold=3) OR
    any_keyword_in_prompt(critical_keywords, user_prompt)
  )
END
```

**Gemini Integration:** @~/.claude/workflows/intelligent-tools-strategy.md

## Enhancement Rules

### Intent Translation

| User Says | Translate To | Focus |
|-----------|--------------|-------|
| "fix" | Debug and resolve | Root cause → preserve behavior |
| "improve" | Enhance/optimize | Performance/readability |
| "add" | Implement feature | Integration + edge cases |
| "refactor" | Restructure quality | Maintain behavior |
| "update" | Modernize | Version compatibility |

### Context Integration Strategy

**Session Memory First:**
- Reference recent conversation context
- Reuse previously identified patterns
- Build on established understanding

**Codebase Analysis (via Gemini):**
- Only when complexity requires it
- Focus on integration points
- Identify existing patterns

**Example:**
```bash
# User: "add login"
# Session Memory: Previous auth discussion, JWT mentioned
# Inferred: JWT-based auth, integrate with existing session management
# Gemini (if multi-module): Analyze AuthService patterns, middleware structure
```

## Output Structure

```bash
INTENT: [Clear technical goal]
CONTEXT: [Session memory + codebase patterns]
ACTION: [Specific implementation steps]
ATTENTION: [Critical constraints]
```

### Output Examples

**Simple (no Gemini):**
```bash
# Input: "fix login button"
INTENT: Debug non-functional login button
CONTEXT: From session - OAuth flow discussed, known state issue
ACTION: Check event binding → verify state updates → test auth flow
ATTENTION: Preserve existing OAuth integration
```

**Complex (with Gemini):**
```bash
# Input: "refactor payment code"
INTENT: Restructure payment module for maintainability
CONTEXT: Session memory - PCI compliance requirements
         Gemini - PaymentService → StripeAdapter pattern identified
ACTION: Extract reusable validators → isolate payment gateway logic
ATTENTION: Zero behavior change, maintain PCI compliance, full test coverage
```

## Automatic Triggers

- Ambiguous language: "fix", "improve", "clean up"
- Multi-module impact (>3 modules)
- Architecture changes
- Critical systems: auth, payment, security
- Complex refactoring

## Key Principles

1. **Memory First**: Leverage session context before analysis
2. **Minimal Gemini**: Only when complexity demands it
3. **Context Reuse**: Build on previous understanding
4. **Clear Output**: Structured, actionable specifications
5. **Avoid Duplication**: Reference existing context, don't repeat