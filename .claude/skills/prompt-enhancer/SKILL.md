---
name: Prompt Enhancer
description: Transform vague prompts into actionable specs using intelligent analysis and session memory. Use when user input contains -e or --enhance flag.
allowed-tools: (none)
---

# Prompt Enhancer

**Transform**: Vague intent → Structured specification (Memory-based, Direct Output)

**Languages**: English + Chinese (中英文语义识别)

## Process (Internal → Direct Output)

**Internal Analysis**: Intelligently extract session context, identify tech stack, and structure into actionable format.

**Output**: Direct structured prompt (no intermediate steps shown)

## Output Format

```
📋 ENHANCED PROMPT

INTENT: [One-sentence technical goal with tech stack / 明确技术目标含技术栈]

TECH STACK: [Relevant technologies from memory / 相关技术栈]
- [Framework/Library: Purpose]

CONTEXT: [Session memory findings / 会话记忆发现]
- [Key context point 1]
- [Key context point 2]
- [Design patterns/constraints from session]

ACTION:
1. [Concrete step with technical details / 具体步骤含技术细节]
2. [Concrete step with technical details]
3. [Testing/validation step]

ATTENTION: [Critical constraints / 关键约束]
- [Security/compatibility/performance concerns]
- [Design pattern requirements]
```
## Workflow

```
Trigger → Internal Analysis → Direct Output
   ↓            ↓                  ↓
  P1-4    Semantic+Memory    Enhanced Prompt
          (3 dimensions)      (Structured)
```

1. **Detect**: Check triggers (P1-P4)
2. **Internal Analysis**:
   - Semantic (EN/CN) intent analysis
   - Memory extraction (tech stack, patterns, constraints)
   - Enhancement (structure + supplement + clarify)
3. **Output**: Present enhanced structured prompt directly

## Enhancement Checklist (Internal)

**Structure**:
- [ ] INTENT: Clear, one-sentence technical goal
- [ ] TECH STACK: Relevant technologies from session
- [ ] CONTEXT: Key session findings and constraints
- [ ] ACTION: Concrete steps with technical details
- [ ] ATTENTION: Critical constraints and patterns

**Supplement**:
- [ ] Add tech stack/frameworks mentioned in session
- [ ] Include design patterns if relevant
- [ ] Add testing/validation requirements
- [ ] Specify performance metrics if applicable

**Clarify**:
- [ ] Make vague intent explicit
- [ ] Resolve ambiguous references (it/that/这个/那个)
- [ ] Expand multi-module scope with dependencies
- [ ] Add missing context from memory

## Best Practices

- ✅ Detect `-e`/`--enhance` flags first (P1)
- ✅ Support EN + CN semantic keywords
- ✅ Extract **memory context ONLY** (no file reading)
- ✅ Add tech stack, design patterns, testing requirements
- ✅ Direct output (no intermediate steps)
- ✅ Use INTENT/TECH STACK/CONTEXT/ACTION/ATTENTION format
- ❌ NO tool calls (AskUserQuestion removed)
- ❌ NO Bash, Read, Glob, Grep operations
- ❌ NO file analysis or codebase scanning

## Key Changes

1. **Removed all tools** - Pure analysis and output
2. **Removed user confirmation** - Direct output for speed
3. **Added tech stack section** - Supplement with technologies
4. **Enhanced internal analysis** - 3 dimensions (structure + supplement + clarify)
5. **Focus on memory** - Session context only, no file reading
