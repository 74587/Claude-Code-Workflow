---
name: Prompt Enhancer
description: Transform vague prompts into actionable specs using session memory ONLY (no file analysis). AUTO-TRIGGER on (1) -e/--enhance flags, (2) vague keywords (fix/improve/refactor/修复/优化/重构), (3) unclear refs (it/that/这个/那个), (4) multi-module scope. Supports English + Chinese semantic recognition.
allowed-tools: AskUserQuestion
---

# Prompt Enhancer

**Transform**: Vague intent → Structured specification (Memory-based)

**Languages**: English + Chinese (中英文语义识别)

## Triggers

| Priority | Condition | Examples | Action |
|----------|-----------|----------|--------|
| **P1** | `-e` / `--enhance` flag | "fix auth -e", "优化性能 --enhance" | Immediate enhancement |
| **P2** | Vague keywords | EN: fix/improve/refactor<br>CN: 修复/优化/重构/更新/改进 | Semantic analysis |
| **P3** | Unclear references | EN: it/that/the code<br>CN: 这个/那个/它/代码 | Context extraction |
| **P4** | Multi-module scope | >3 modules or critical systems | Dependency analysis |

## Process (3 Steps - Streamlined)

### 1. Semantic Analysis (Quick)
Identify: Intent keywords (EN/CN) → Scope (file/module/system) → Domain (auth/API/DB/UI)

**English**: fix, improve, add, refactor, update, migrate
**Chinese**: 修复, 优化, 添加, 重构, 更新, 迁移, 改进, 清理

### 2. Memory-Only Extraction (NO File Reading)
Extract from **conversation memory ONLY**:
- Recent user requests and context
- Previous implementations/patterns discussed
- Known dependencies from session
- User preferences and constraints

**SKIP**: File reading, codebase scanning, Glob/Grep operations
**FOCUS**: Pure memory-based context extraction

### 3. User Confirmation with Optimization Direction (REQUIRED)
Present structured prompt → Ask: Continue? + Optimization suggestions needed?

## Output Format

```
📋 ENHANCED PROMPT

INTENT: [One-sentence technical goal / 明确技术目标]

CONTEXT: [Session memory findings / 会话记忆发现]
- [Key context point 1]
- [Key context point 2]
- [...]

ACTION:
1. [Concrete step / 具体步骤]
2. [Concrete step / 具体步骤]
3. [...]

ATTENTION: [Critical constraints / 关键约束]
- [Security/compatibility/testing concerns]

```

## Semantic Patterns (EN + CN)

| Intent (EN/CN) | Semantic Meaning | Focus |
|----------------|------------------|-------|
| fix/修复 + vague target | Debug & resolve | Root cause → preserve behavior |
| improve/优化 + no metrics | Enhance/optimize | Performance/readability |
| add/添加 + feature | Implement feature | Integration + edge cases |
| refactor/重构 + module | Restructure | Maintain behavior |
| update/更新 + version | Modernize | Version compatibility |
| clean up/清理 + area | Simplify/organize | Remove redundancy |

## Workflow

```
Trigger → Analyze → Extract → Present → Confirm → Execute
   ↓         ↓         ↓         ↓         ↓         ↓
  P1-4    EN/CN    Memory    Struct   Ask User  Direct
          detect    only      prompt              or refine
```

1. **Detect**: Check triggers (P1-P4)
2. **Analyze**: Semantic (EN/CN) analysis of user intent
3. **Extract**: Memory-only context extraction (NO file reading)
4. **Present**: Generate structured prompt output
5. **Confirm**: AskUserQuestion (Continue/Modify/Cancel)
6. **Execute**: Proceed based on user choice

## Confirmation (AskUserQuestion)

**Question**: "Enhanced prompt ready. Proceed or need adjustments? (已生成增强提示词，是否继续或需要调整？)"

**Options**:
1. **Continue as-is / 按此继续** - Proceed with current specification
2. **Suggest optimizations / 建议优化方向** - I need guidance on how to improve this
3. **Modify requirements / 修改需求** - Let me provide specific changes

```typescript
AskUserQuestion({
  questions: [{
    question: "Enhanced prompt ready. Proceed or need adjustments? (已生成增强提示词，是否继续或需要调整？)",
    header: "Next Step",
    multiSelect: false,
    options: [
      {
        label: "Continue as-is",
        description: "Proceed with current specification (按此继续)"
      },
      {
        label: "Suggest optimizations",
        description: "I need guidance on how to improve this (建议优化方向)"
      },
      {
        label: "Modify requirements",
        description: "Let me provide specific changes (修改需求)"
      }
    ]
  }]
})
```

## Best Practices

- ✅ Detect `-e`/`--enhance` flags first (P1)
- ✅ Support EN + CN semantic keywords
- ✅ Extract **memory context ONLY** (no file reading)
- ✅ Use INTENT/CONTEXT/ACTION/ATTENTION format
- ✅ ALWAYS confirm with AskUserQuestion
- ✅ Offer optimization guidance option
- ❌ NO Bash, Read, Glob, Grep operations
- ❌ NO direct file analysis

## Key Changes from Previous Version

1. **Removed file analysis** - Memory extraction only
2. **Simplified to 3 steps** - Faster workflow
3. **Updated confirmation options** - Added "Suggest optimizations"
4. **Removed file tools** - Only AskUserQuestion allowed
5. **Focus on speed** - Quick semantic analysis + memory extraction

## Examples

**Input**: "fix auth -e" / "优化性能 --enhance"

**Process**:
1. Detect P1 trigger (`-e` flag)
2. Semantic analysis: "fix/优化" intent
3. Extract from memory: Recent auth/performance discussions
4. Generate structured prompt
5. Ask user: Continue/Suggest optimizations/Modify

**Output**:
```
📋 ENHANCED PROMPT

INTENT: Fix authentication module issues based on recent session context

CONTEXT:
- User mentioned auth token expiration problems
- Previous discussion about JWT validation
- Session indicates preference for backward compatibility

ACTION:
1. Review authentication token handling logic
2. Implement proper JWT validation with expiration checks
3. Add unit tests for token refresh flow
4. Update documentation for auth changes

ATTENTION:
- Must maintain backward compatibility with existing tokens
- Security: Follow JWT best practices
- Testing: Ensure no breaking changes to API contracts
```

**Then ask**: Continue as-is / Suggest optimizations / Modify requirements
