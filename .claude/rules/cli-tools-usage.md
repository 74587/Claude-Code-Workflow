# Intelligent Tools Selection Strategy

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Tool Specifications](#tool-specifications)
3. [Prompt Template](#prompt-template)
4. [CLI Execution](#cli-execution)
5. [Configuration](#configuration)
6. [Best Practices](#best-practices)

---

## Quick Reference

## Quick Decision Tree

```
┌─ Task Analysis/Documentation?
│  └─→ Use Gemini (Fallback: Codex,Qwen)
│     └─→ MODE: analysis (default, read-only)
│
└─ Task Implementation/Bug Fix?
   └─→ Use Codex  (Fallback: Gemini,Qwen)
      └─→ MODE: auto (full operations) or write (file operations)
```


### Universal Prompt Template

```
PURPOSE: [what] + [why] + [success criteria] + [constraints/scope]
TASK: • [step 1: specific action] • [step 2: specific action] • [step 3: specific action]
MODE: [analysis|write|auto]
CONTEXT: @[file patterns] | Memory: [session/tech/module context]
EXPECTED: [deliverable format] + [quality criteria] + [structure requirements]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [domain constraints] | MODE=[permission]
```

### Intent Capture Checklist (Before CLI Execution)

**⚠️ CRITICAL**: Before executing any CLI command, verify these intent dimensions:
**Intent Validation Questions**:
- [ ] Is the objective specific and measurable?
- [ ] Are success criteria defined?
- [ ] Is the scope clearly bounded?
- [ ] Are constraints and limitations stated?
- [ ] Is the expected output format clear?
- [ ] Is the action level (read/write) explicit?

## Tool Selection Matrix

- **Read/Analyze**
  - Tool: Gemini/Qwen
  - MODE: `analysis`
  - When to Use: Code review, architecture analysis, pattern discovery, exploration

- **Write/Create**
  - Tool: Gemini/Qwen
  - MODE: `write`
  - When to Use: Documentation generation, file creation (non-code)

- **Implement/Fix**
  - Tool: Codex
  - MODE: `auto`
  - When to Use: Feature implementation, bug fixes, test creation, refactoring

## Essential Command Structure

```bash
ccw cli exec "<PROMPT>" --tool <gemini|qwen|codex> --mode <analysis|write|auto>
```

**⚠️ CRITICAL**: `--mode` parameter is **MANDATORY** for all CLI executions. No defaults are assumed.

### Core Principles

- **Use tools early and often** - Tools are faster and more thorough
- **Unified CLI** - Always use `ccw cli exec` for consistent parameter handling
- **Mode is MANDATORY** - ALWAYS explicitly specify `--mode analysis|write|auto` (no implicit defaults)
- **One template required** - ALWAYS reference exactly ONE template in RULES (use universal fallback if no specific match)
- **Write protection** - Require EXPLICIT `--mode write` or `--mode auto`
- **No escape characters** - NEVER use `\$`, `\"`, `\'` in CLI commands

---

## Tool Specifications

### MODE Options

- **`analysis`**
  - Permission: Read-only (default)
  - Use For: Code review, architecture analysis, pattern discovery
  - Specification: Auto for Gemini/Qwen

- **`write`**
  - Permission: Create/Modify/Delete
  - Use For: Documentation, code creation, file modifications
  - Specification: Requires `--mode write`

- **`auto`**
  - Permission: Full operations
  - Use For: Feature implementation, bug fixes, autonomous development
  - Specification: Codex only, requires `--mode auto`

### Mode Protocol References (MANDATORY)

**⚠️ REQUIRED**: Every CLI execution MUST include the corresponding mode protocol in RULES:

- **`analysis`**
  - Protocol (REQUIRED): `$(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md)`

- **`write/auto`**
  - Protocol (REQUIRED): `$(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md)`

**RULES Format** (protocol MUST be included):
```bash
# Analysis mode - MUST include analysis-protocol.md
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/...) | constraints

# Write/Auto mode - MUST include write-protocol.md
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/development/...) | constraints
```

**Validation**: CLI execution without mode protocol reference is INVALID

### Gemini & Qwen

**Via CCW**: `ccw cli exec "<prompt>" --tool gemini --mode analysis` or `--tool qwen --mode analysis`

**Characteristics**:
- Large context window, pattern recognition
- Best for: Analysis, documentation, code exploration, architecture review
- Recommended MODE: `analysis` (read-only) for analysis tasks, `write` for file creation
- Priority: Prefer Gemini; use Qwen as fallback

**Models** (override via `--model`):
- Gemini: `gemini-2.5-pro`
- Qwen: `coder-model`, `vision-model`

**Error Handling**: HTTP 429 may show error but still return results - check if results exist

### Codex

**Via CCW**: `ccw cli exec "<prompt>" --tool codex --mode auto`

**Characteristics**:
- Autonomous development, mathematical reasoning
- Best for: Implementation, testing, automation
- No default MODE - must explicitly specify `--mode write` or `--mode auto`

**Models**: `gpt-5.2`

### Session Resume

**Resume via `--resume` parameter**:

```bash
ccw cli exec "Continue analyzing" --tool gemini --mode analysis --resume              # Resume last session
ccw cli exec "Fix issues found" --tool codex --mode auto --resume <id>           # Resume specific session
```

- **`--resume` (empty)**: Resume most recent session
- **`--resume <id>`**: Resume specific execution ID

**Context Assembly** (automatic):
```
=== PREVIOUS CONVERSATION ===
USER PROMPT: [Previous prompt]
ASSISTANT RESPONSE: [Previous output]
=== CONTINUATION ===
[Your new prompt]
```

**Tool Behavior**: Codex uses native `codex resume`; Gemini/Qwen assembles context as single prompt

---

## Prompt Template

### Template Structure

Every command MUST include these fields:

- **PURPOSE**
  - Purpose: Goal + motivation + success
  - Components: What + Why + Success Criteria + Constraints
  - Bad Example: "Analyze code"
  - Good Example: "Identify security vulnerabilities in auth module to pass compliance audit; success = all OWASP Top 10 addressed; scope = src/auth/** only"

- **TASK**
  - Purpose: Actionable steps
  - Components: Specific verbs + targets
  - Bad Example: "• Review code • Find issues"
  - Good Example: "• Scan for SQL injection in query builders • Check XSS in template rendering • Verify CSRF token validation"

- **MODE**
  - Purpose: Permission level
  - Components: analysis / write / auto
  - Bad Example: (missing)
  - Good Example: "analysis" or "write"

- **CONTEXT**
  - Purpose: File scope + history
  - Components: File patterns + Memory
  - Bad Example: "@**/*"
  - Good Example: "@src/auth/**/*.ts @shared/utils/security.ts \| Memory: Previous auth refactoring (WFS-001)"

- **EXPECTED**
  - Purpose: Output specification
  - Components: Format + Quality + Structure
  - Bad Example: "Report"
  - Good Example: "Markdown report with: severity levels (Critical/High/Medium/Low), file:line references, remediation code snippets, priority ranking"

- **RULES**
  - Purpose: Template + constraints
  - Components: $(cat template) + domain rules
  - Bad Example: (missing)
  - Good Example: "$(cat ~/.claude/.../security.txt) \| Focus on authentication \| Ignore test files \| analysis=READ-ONLY"


### CONTEXT Configuration

**Format**: `CONTEXT: [file patterns] | Memory: [memory context]`

#### File Patterns

- **`@**/*`**: All files (default)
- **`@src/**/*.ts`**: TypeScript in src
- **`@../shared/**/*`**: Sibling directory (requires `--includeDirs`)
- **`@CLAUDE.md`**: Specific file

#### Memory Context

Include when building on previous work:

```bash
# Cross-task reference
Memory: Building on auth refactoring (commit abc123), implementing refresh tokens

# Cross-module integration
Memory: Integration with auth module, using shared error patterns from @shared/utils/errors.ts
```

**Memory Sources**:
- **Related Tasks**: Previous refactoring, extensions, conflict resolution
- **Tech Stack Patterns**: Framework conventions, security guidelines
- **Cross-Module References**: Integration points, shared utilities, type dependencies

#### Pattern Discovery Workflow

For complex requirements, discover files BEFORE CLI execution:

```bash
# Step 1: Discover files
rg "export.*Component" --files-with-matches --type ts

# Step 2: Build CONTEXT
CONTEXT: @components/Auth.tsx @types/auth.d.ts | Memory: Previous type refactoring

# Step 3: Execute CLI
ccw cli exec "..." --tool gemini --mode analysis --cd src
```

### RULES Configuration

**Format**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]`

**⚠️ MANDATORY**: Exactly ONE template reference is REQUIRED. Select from Task-Template Matrix or use universal fallback:
- `universal/00-universal-rigorous-style.txt` - For precision-critical tasks (default fallback)
- `universal/00-universal-creative-style.txt` - For exploratory tasks

**Command Substitution Rules**:
- Use `$(cat ...)` directly - do NOT read template content first
- NEVER use escape characters: `\$`, `\"`, `\'`
- Tilde expands correctly in prompt context

**Examples**:
```bash
# Specific template (preferred)
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt) | Focus on auth | analysis=READ-ONLY

# Universal fallback (when no specific template matches)
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/universal/00-universal-rigorous-style.txt) | Focus on security patterns | analysis=READ-ONLY
```

### Template System

**Base Path**: `~/.claude/workflows/cli-templates/prompts/`

**Naming Convention**:
- `00-*` - Universal fallbacks (when no specific match)
- `01-*` - Universal, high-frequency
- `02-*` - Common specialized
- `03-*` - Domain-specific

**Universal Templates**:

- **`universal/00-universal-rigorous-style.txt`**: Precision-critical, systematic methodology
- **`universal/00-universal-creative-style.txt`**: Exploratory, innovative solutions

**Task-Template Matrix**:

**Analysis**:
- Execution Tracing: `analysis/01-trace-code-execution.txt`
- Bug Diagnosis: `analysis/01-diagnose-bug-root-cause.txt`
- Code Patterns: `analysis/02-analyze-code-patterns.txt`
- Document Analysis: `analysis/02-analyze-technical-document.txt`
- Architecture Review: `analysis/02-review-architecture.txt`
- Code Review: `analysis/02-review-code-quality.txt`
- Performance: `analysis/03-analyze-performance.txt`
- Security: `analysis/03-assess-security-risks.txt`

**Planning**:
- Architecture: `planning/01-plan-architecture-design.txt`
- Task Breakdown: `planning/02-breakdown-task-steps.txt`
- Component Design: `planning/02-design-component-spec.txt`
- Migration: `planning/03-plan-migration-strategy.txt`

**Development**:
- Feature: `development/02-implement-feature.txt`
- Refactoring: `development/02-refactor-codebase.txt`
- Tests: `development/02-generate-tests.txt`
- UI Component: `development/02-implement-component-ui.txt`
- Debugging: `development/03-debug-runtime-issues.txt`

---

## CLI Execution

### Command Options

- **`--tool <tool>`**
  - Description: gemini, qwen, codex
  - Default: gemini

- **`--mode <mode>`**
  - Description: **REQUIRED**: analysis, write, auto
  - Default: **NONE** (must specify)

- **`--model <model>`**
  - Description: Model override
  - Default: auto-select

- **`--cd <path>`**
  - Description: Working directory
  - Default: current

- **`--includeDirs <dirs>`**
  - Description: Additional directories (comma-separated)
  - Default: none

- **`--timeout <ms>`**
  - Description: Timeout in milliseconds
  - Default: 300000

- **`--resume [id]`**
  - Description: Resume previous session
  - Default: -

- **`--no-stream`**
  - Description: Disable streaming
  - Default: false

### Directory Configuration

#### Working Directory (`--cd`)

When using `--cd`:
- `@**/*` = Files within working directory tree only
- CANNOT reference parent/sibling via @ alone
- Must use `--includeDirs` for external directories

#### Include Directories (`--includeDirs`)

**TWO-STEP requirement for external files**:
1. Add `--includeDirs` parameter
2. Reference in CONTEXT with @ patterns

```bash
# Single directory
ccw cli exec "CONTEXT: @**/* @../shared/**/*" --tool gemini --mode analysis --cd src/auth --includeDirs ../shared

# Multiple directories
ccw cli exec "..." --tool gemini --mode analysis --cd src/auth --includeDirs ../shared,../types,../utils
```

**Rule**: If CONTEXT contains `@../dir/**/*`, MUST include `--includeDirs ../dir`

**Benefits**: Excludes unrelated directories, reduces token usage

### CCW Parameter Mapping

CCW automatically maps to tool-specific syntax:

- **`--cd <path>`**
  - Gemini/Qwen: `cd <path> &&`
  - Codex: `-C <path>`

- **`--includeDirs <dirs>`**
  - Gemini/Qwen: `--include-directories`
  - Codex: `--add-dir` (per dir)

- **`--mode write`**
  - Gemini/Qwen: `--approval-mode yolo`
  - Codex: `-s danger-full-access`

- **`--mode auto`**
  - Gemini/Qwen: N/A
  - Codex: `-s danger-full-access`

### Command Examples

#### Task-Type Specific Templates

**Analysis Task** (Security Audit):
```bash
ccw cli exec "
PURPOSE: Identify OWASP Top 10 vulnerabilities in authentication module to pass security audit; success = all critical/high issues documented with remediation
TASK: • Scan for injection flaws (SQL, command, LDAP) • Check authentication bypass vectors • Evaluate session management • Assess sensitive data exposure
MODE: analysis
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Security report with: severity matrix, file:line references, CVE mappings where applicable, remediation code snippets prioritized by risk
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/03-assess-security-risks.txt) | Focus on authentication | Ignore test files | analysis=READ-ONLY
" --tool gemini --cd src/auth --timeout 600000
```

**Implementation Task** (New Feature):
```bash
ccw cli exec "
PURPOSE: Implement rate limiting for API endpoints to prevent abuse; must be configurable per-endpoint; backward compatible with existing clients
TASK: • Create rate limiter middleware with sliding window • Implement per-route configuration • Add Redis backend for distributed state • Include bypass for internal services
MODE: auto
CONTEXT: @src/middleware/**/* @src/config/**/* | Memory: Using Express.js, Redis already configured, existing middleware pattern in auth.ts
EXPECTED: Production-ready code with: TypeScript types, unit tests, integration test, configuration example, migration guide
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | Follow existing middleware patterns | No breaking changes | auto=FULL
" --tool codex --mode auto --timeout 1800000
```

**Bug Fix Task**:
```bash
ccw cli exec "
PURPOSE: Fix memory leak in WebSocket connection handler causing server OOM after 24h; root cause must be identified before any fix
TASK: • Trace connection lifecycle from open to close • Identify event listener accumulation • Check cleanup on disconnect • Verify garbage collection eligibility
MODE: analysis
CONTEXT: @src/websocket/**/* @src/services/connection-manager.ts | Memory: Using ws library, ~5000 concurrent connections in production
EXPECTED: Root cause analysis with: memory profile, leak source (file:line), fix recommendation with code, verification steps
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt) | Focus on resource cleanup | analysis=READ-ONLY
" --tool gemini --cd src --timeout 900000
```

**Refactoring Task**:
```bash
ccw cli exec "
PURPOSE: Refactor payment processing to use strategy pattern for multi-gateway support; no functional changes; all existing tests must pass
TASK: • Extract gateway interface from current implementation • Create strategy classes for Stripe, PayPal • Implement factory for gateway selection • Migrate existing code to use strategies
MODE: write
CONTEXT: @src/payments/**/* @src/types/payment.ts | Memory: Currently only Stripe, adding PayPal next sprint, must support future gateways
EXPECTED: Refactored code with: strategy interface, concrete implementations, factory class, updated tests, migration checklist
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/02-refactor-codebase.txt) | Preserve all existing behavior | Tests must pass | write=CREATE/MODIFY/DELETE
" --tool gemini --mode write --timeout 1200000
```
---

## Configuration

### Timeout Allocation

**Minimum**: 5 minutes (300000ms)

- **Simple**: 5-10min (300000-600000ms)
  - Examples: Analysis, search

- **Medium**: 10-20min (600000-1200000ms)
  - Examples: Refactoring, documentation

- **Complex**: 20-60min (1200000-3600000ms)
  - Examples: Implementation, migration

- **Heavy**: 60-120min (3600000-7200000ms)
  - Examples: Large codebase, multi-file

**Codex Multiplier**: 3x allocated time (minimum 15min / 900000ms)

```bash
ccw cli exec "<prompt>" --tool gemini --mode analysis --timeout 600000   # 10 min
ccw cli exec "<prompt>" --tool codex --mode auto --timeout 1800000   # 30 min
```

### Permission Framework

**Single-Use Authorization**: Each execution requires explicit user instruction. Previous authorization does NOT carry over.

**Mode Hierarchy**:
- `analysis`: Read-only, safe for auto-execution
- `write`: Create/Modify/Delete files - requires explicit `--mode write`
- `auto`: Full operations - requires explicit `--mode auto`
- **Exception**: User provides clear instructions like "modify", "create", "implement"

---

## Best Practices

### Workflow Principles

- **Use CCW unified interface** for all executions
- **Always include template** - Use Task-Template Matrix or universal fallback
- **Be specific** - Clear PURPOSE, TASK, EXPECTED fields
- **Include constraints** - File patterns, scope in RULES
- **Leverage memory context** when building on previous work
- **Discover patterns first** - Use rg/MCP before CLI execution
- **Default to full context** - Use `@**/*` unless specific files needed

### Workflow Integration

- **Understanding**: `ccw cli exec "<prompt>" --tool gemini`
- **Architecture**: `ccw cli exec "<prompt>" --tool gemini`
- **Implementation**: `ccw cli exec "<prompt>" --tool codex --mode auto`
- **Quality**: `ccw cli exec "<prompt>" --tool codex --mode write`

### Planning Checklist

- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - `--mode analysis|write|auto`
- [ ] **Context gathered** - File references + memory (default `@**/*`)
- [ ] **Directory navigation** - `--cd` and/or `--includeDirs`
- [ ] **Tool selected** - `--tool gemini|qwen|codex`
- [ ] **Template applied (REQUIRED)** - Use specific or universal fallback template
- [ ] **Constraints specified** - Scope, requirements
- [ ] **Timeout configured** - Based on complexity
