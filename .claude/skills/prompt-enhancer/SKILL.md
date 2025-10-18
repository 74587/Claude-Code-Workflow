---
name: Prompt Enhancer
description: Transform vague prompts into actionable specs using session memory ONLY (no file analysis). AUTO-TRIGGER on (1) -e/--enhance flags, (2) vague keywords (fix/improve/refactor/修复/优化/重构), (3) unclear refs (it/that/这个/那个), (4) multi-module scope. Supports English + Chinese semantic recognition.
allowed-tools: (none)
---

# Prompt Enhancer

**Transform**: Vague intent → Structured specification (Memory-based, Direct Output)

**Languages**: English + Chinese (中英文语义识别)

## Triggers

| Priority | Condition | Examples | Action |
|----------|-----------|----------|--------|
| **P1** | `-e` / `--enhance` flag | "fix auth -e", "优化性能 --enhance" | Immediate enhancement |
| **P2** | Vague keywords | EN: fix/improve/refactor<br>CN: 修复/优化/重构/更新/改进 | Semantic analysis |
| **P3** | Unclear references | EN: it/that/the code<br>CN: 这个/那个/它/代码 | Context extraction |
| **P4** | Multi-module scope | >3 modules or critical systems | Dependency analysis |

## Process (Internal → Direct Output)

**Internal Analysis (Silent)**:

1. **Semantic Analysis**
   - Intent keywords (EN/CN): fix/修复, improve/优化, add/添加, refactor/重构
   - Scope identification: file → module → system
   - Domain mapping: auth/API/DB/UI/Performance

2. **Memory Extraction** (NO File Reading)
   - Recent user requests and context
   - Tech stack mentioned in session (frameworks, libraries, patterns)
   - Design patterns discussed or implied
   - User preferences and constraints
   - Known dependencies from conversation

3. **Enhancement Dimensions**
   - **Structure**: Convert to INTENT/CONTEXT/ACTION/ATTENTION format
   - **Supplement**: Add tech stack, design patterns, testing requirements
   - **Clarify**: Make intent explicit, resolve ambiguous references

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

## Semantic Patterns (EN + CN)

| Intent (EN/CN) | Semantic Meaning | Enhancement Focus |
|----------------|------------------|-------------------|
| fix/修复 + vague target | Debug & resolve | Root cause + tech stack + testing |
| improve/优化 + no metrics | Enhance/optimize | Performance metrics + patterns + benchmarks |
| add/添加 + feature | Implement feature | Integration points + edge cases + tests |
| refactor/重构 + module | Restructure | Design patterns + backward compatibility |
| update/更新 + version | Modernize | Migration path + breaking changes |
| clean up/清理 + area | Simplify/organize | Code quality patterns + tech debt |

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

## Examples

### Example 1: Vague Fix Request

**Input**: "fix auth -e" / "修复认证 --enhance"

**Internal Analysis**:
- Semantic: "fix/修复" → debug intent
- Memory: Recent mention of JWT, token expiration issues
- Tech stack: JWT, Express.js middleware (from session)
- Enhancement: Add testing, security patterns

**Output**:
```
📋 ENHANCED PROMPT

INTENT: Fix authentication token expiration handling in JWT-based auth system

TECH STACK:
- JWT: Token generation and validation
- Express.js: Middleware implementation
- Jest: Unit testing framework

CONTEXT:
- User reported token expiration issues in previous conversation
- Session indicates JWT-based authentication system
- Preference for backward compatibility with existing tokens

ACTION:
1. Analyze JWT token lifecycle and expiration validation logic
2. Implement proper token refresh mechanism with sliding expiration
3. Add middleware for token validation with detailed error handling
4. Write unit tests for token expiration and refresh scenarios
5. Update API documentation for token refresh endpoints

ATTENTION:
- Must maintain backward compatibility with existing valid tokens
- Security: Follow JWT best practices (HS256/RS256, secure secret storage)
- Testing: Cover edge cases (expired, malformed, missing tokens)
- Performance: Consider token validation caching for high-traffic endpoints
```

### Example 2: Vague Optimization Request

**Input**: "optimize performance --enhance" / "优化性能 -e"

**Internal Analysis**:
- Semantic: "optimize/优化" → performance intent
- Memory: Previous discussion about API response times, React rendering
- Tech stack: React, Node.js, PostgreSQL (from session)
- Enhancement: Add metrics, profiling, specific optimizations

**Output**:
```
📋 ENHANCED PROMPT

INTENT: Optimize API response times and React component rendering performance

TECH STACK:
- React: Component optimization (memo, useMemo, useCallback)
- Node.js: API endpoint optimization
- PostgreSQL: Query optimization and indexing

CONTEXT:
- User mentioned slow API responses (>2s) in previous conversation
- React app shows rendering performance issues on large lists
- PostgreSQL database queries identified as bottleneck

ACTION:
1. Profile API endpoints using Node.js profiler to identify slow queries
2. Optimize PostgreSQL queries with proper indexing and query analysis (EXPLAIN)
3. Implement React.memo for expensive list components
4. Add useMemo/useCallback for derived data and event handlers
5. Implement pagination/virtualization for large data lists
6. Add performance monitoring with metrics (response time, render time)
7. Write performance benchmarks and regression tests

ATTENTION:
- Metrics: Target <500ms API response, <100ms render time
- Patterns: Use React.memo judiciously (avoid over-optimization)
- Testing: Add performance regression tests with benchmarks
- Compatibility: Ensure optimizations don't break existing functionality
```
