---
name: Prompt Enhancer
description: Transform vague prompts into actionable specs using session memory + semantic analysis. AUTO-TRIGGER on (1) -e/--enhance flags, (2) vague keywords (fix/improve/refactor/修复/优化/重构), (3) unclear refs (it/that/这个/那个), (4) multi-module scope. Supports English + Chinese semantic recognition.
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion
---

# Prompt Enhancer

**Transform**: Vague intent → Structured specification

**Languages**: English + Chinese (中英文语义识别)

## Triggers

| Priority | Condition | Examples | Action |
|----------|-----------|----------|--------|
| **P1** | `-e` / `--enhance` flag | "fix auth -e", "优化性能 --enhance" | Immediate enhancement |
| **P2** | Vague keywords | EN: fix/improve/refactor<br>CN: 修复/优化/重构/更新/改进 | Semantic analysis |
| **P3** | Unclear references | EN: it/that/the code<br>CN: 这个/那个/它/代码 | Context extraction |
| **P4** | Multi-module scope | >3 modules or critical systems | Dependency analysis |

## Process (4 Steps)

### 1. Semantic Analysis
Identify: Intent keywords (EN/CN) → Scope (file/module/system) → Domain (auth/API/DB/UI)

**English**: fix, improve, add, refactor, update, migrate
**Chinese**: 修复, 优化, 添加, 重构, 更新, 迁移, 改进, 清理

### 2. Memory Extraction
Extract: Technical context → Current state → Dependencies → Constraints

### 3. Integration
Combine: Precise intent + Action steps (with files) + Critical constraints

### 4. User Confirmation (REQUIRED)
Use AskUserQuestion with 3 options → Execute/Review/Refine

## Output Format

```
INTENT: [One-sentence technical goal]
CONTEXT: [Session memory + domain analysis]
ACTION:
1. [Step with file references]
2. [Step with file references]
3. [...]
ATTENTION: [Security/compatibility/testing constraints]
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

### Scope Detection

| Input Pattern | Scope | Action |
|---------------|-------|--------|
| "fix button", "修复按钮" | Single file | Session memory only |
| "add auth", "添加认证" | Multi-module (>3) | Dependency analysis |
| "improve perf", "优化性能" | System-wide | Cross-cutting concerns |

## Workflow

```
Trigger → Analyze → Enhance → Confirm → Execute
   ↓         ↓         ↓         ↓         ↓
  P1-4    EN/CN    INTENT/    3 opts    Direct
          detect  ACTION              or iterate
```

1. **Detect**: Check triggers (P1-P4)
2. **Analyze**: Semantic (EN/CN) + Memory extraction
3. **Enhance**: Generate structured output
4. **Confirm**: AskUserQuestion (Execute/Review/Refine)
5. **Execute**: Proceed based on user choice

## Confirmation (AskUserQuestion)

**Question**: "已增强提示词，如何继续？/ Enhanced prompt ready. Proceed?"

**Options**:
1. **Execute now** / **立即执行** - Proceed immediately
2. **Review first** / **先查看** - Show full spec before execution
3. **Refine** / **优化需求** - Iterate with user input

```typescript
AskUserQuestion({
  questions: [{
    question: "I've enhanced your prompt. How would you like to proceed? (已增强提示词，如何继续？)",
    header: "Execution",
    multiSelect: false,
    options: [
      { label: "Execute now", description: "Proceed immediately with enhanced spec" },
      { label: "Review first", description: "Show full specification before execution" },
      { label: "Refine", description: "Let me adjust the requirements" }
    ]
  }]
})
```

## Best Practices

- ✅ Detect `-e`/`--enhance` flags first (P1)
- ✅ Support EN + CN semantic keywords
- ✅ Extract session memory context
- ✅ Use INTENT/CONTEXT/ACTION/ATTENTION format
- ✅ ALWAYS confirm with AskUserQuestion
- ✅ Execute directly if "Execute now" selected
- ✅ Include file references in ACTION steps

## Examples

**Input**: "fix auth -e" / "优化性能 --enhance"

**Output**:
```
INTENT: [Clear technical goal / 明确技术目标]
CONTEXT: [Session memory findings / 会话记忆发现]
ACTION:
1. [Step with files / 带文件引用的步骤]
2. [Step with files / 带文件引用的步骤]
ATTENTION: [Constraints / 约束条件]
```
**Confirm** → Execute/Review/Refine
