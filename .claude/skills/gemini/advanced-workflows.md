# Gemini Advanced Multi-Phase Workflows

> **📖 Template Structure**: See [Universal Template Structure](command-structure.md) for detailed field guidelines.

## Discovery → Analysis → Documentation Pipeline

This three-phase workflow demonstrates how to combine file discovery, deep analysis, and documentation generation.

### Phase 1: File Discovery (using ripgrep)

```bash
# Use ripgrep for semantic search
rg "export.*Component|export.*interface.*Props" --files-with-matches --type ts src/components/
```

### Phase 2: Deep Analysis

```bash
cd src && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze React component architecture to standardize component patterns and improve type safety
TASK: Review component structure, props interface design, state management approach, lifecycle usage, composition patterns, performance optimizations (memo, callback, useMemo)
MODE: analysis
CONTEXT: @{components/Auth.tsx,components/Profile.tsx,components/Dashboard.tsx,types/auth.d.ts,types/user.d.ts,hooks/useAuth.ts,hooks/useProfile.ts} React 18, TypeScript 5, using Context API for state, no Redux
EXPECTED: Component pattern analysis covering: 1) Component classification (Container/Presentational), 2) Props interface consistency report, 3) State management pattern evaluation, 4) Performance optimization opportunities, 5) Recommended component template, 6) Refactoring priority matrix
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on TypeScript type safety | Evaluate React 18 features usage | Consider testing implications | Follow functional component patterns | Assess accessibility compliance | Include bundle size impact
"
```

### Phase 3: Documentation Generation

```bash
~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Create component pattern guide based on analysis results
TASK: Generate comprehensive guide documenting: standard component template, props interface best practices, state management patterns, composition examples, testing strategies
MODE: write
CONTEXT: Analysis results from Phase 2 showing: 3 component patterns identified, 60% type safety compliance, 5 performance issues found
EXPECTED: Create COMPONENT_PATTERNS.md with sections: 1) Standard Template (with code), 2) Props Interface Guidelines, 3) State Management Recipes, 4) Composition Patterns, 5) Performance Best Practices, 6) Testing Strategies, 7) Migration Guide (from current to standard). Include before/after code examples for each pattern.
RULES: Use code fences with TypeScript syntax | Provide runnable examples | Include ESLint/Prettier configs | Add testing examples with React Testing Library | Reference React 18 documentation | Create visual component hierarchy diagrams | Add FAQ section for common issues
"
```

### Key Points

- **Three phases**: Discovery (rg) → Analysis (Gemini) → Documentation (Gemini write)
- **Context flow**: Phase 2 uses discovered files, Phase 3 references Phase 2 results
- **Comprehensive EXPECTED**: Detailed output structure with before/after examples
- **Progressive RULES**: Build on analysis findings, add implementation details
