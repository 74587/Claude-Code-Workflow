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
│     └─→ MODE: analysis (read-only)
│
└─ Task Implementation/Bug Fix?
   └─→ Use Codex (Fallback: Gemini,Qwen)
      └─→ MODE: write (file operations)
```


### Universal Prompt Template

```
PURPOSE: [what] + [why] + [success criteria] + [constraints/scope]
TASK: • [step 1: specific action] • [step 2: specific action] • [step 3: specific action]
MODE: [analysis|write]
CONTEXT: @[file patterns] | Memory: [session/tech/module context]
EXPECTED: [deliverable format] + [quality criteria] + [structure requirements]
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/[mode]-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [domain constraints]
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

- **Write/Implement**
  - Tool: Codex (Fallback: Gemini/Qwen)
  - MODE: `write`
  - When to Use: Feature implementation, bug fixes, test creation, refactoring, documentation generation, file creation

## Essential Command Structure

```bash
ccw cli -p "<PROMPT>" --tool <gemini|qwen|codex> --mode <analysis|write>
```

**⚠️ CRITICAL**: `--mode` parameter is **MANDATORY** for all CLI executions. No defaults are assumed.

### Core Principles

- **Use tools early and often** - Tools are faster and more thorough
- **Unified CLI** - Always use `ccw cli -p` for consistent parameter handling
- **Mode is MANDATORY** - ALWAYS explicitly specify `--mode analysis|write` (no implicit defaults)
- **One template required** - ALWAYS reference exactly ONE template in RULES (use universal fallback if no specific match)
- **Write protection** - Require EXPLICIT `--mode write` for file operations
- **Use double quotes for shell expansion** - Always wrap prompts in double quotes `"..."` to enable `$(cat ...)` command substitution; NEVER use single quotes or escape characters (`\$`, `\"`, `\'`)

---

## Tool Specifications

### MODE Options

- **`analysis`**
  - Permission: Read-only
  - Use For: Code review, architecture analysis, pattern discovery, exploration
  - Specification: Safe for all tools (Gemini/Qwen/Codex)

- **`write`**
  - Permission: Create/Modify/Delete
  - Use For: Feature implementation, bug fixes, documentation, code creation, file modifications
  - Specification: Requires explicit `--mode write`

### Mode Protocol References (MANDATORY)

**⚠️ REQUIRED**: Every CLI execution MUST include the corresponding mode protocol in RULES:

#### Mode Rule= Templates

**Purpose**: Mode protocols define permission boundaries and operational constraints for each execution mode.

**Protocol Mapping**:

- **`analysis`** mode
  - Protocol: `$(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md)`
  - Permission: Read-only operations
  - Enforces: No file creation/modification/deletion

- **`write`** mode
  - Protocol: `$(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md)`
  - Permission: Create/Modify/Delete files
  - Enforces: Explicit write authorization and full workflow execution capability

**RULES Format** (protocol MUST be included):
```bash
# Analysis mode - MUST include analysis-protocol.md
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/...) | constraints

# Write mode - MUST include write-protocol.md
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/development/...) | constraints
```

**Validation**: CLI execution without mode protocol reference is INVALID

**Why Mode Rules Are Required**:
- Ensures consistent permission enforcement across all tools (Gemini/Qwen/Codex)
- Prevents accidental file modifications during analysis tasks
- Provides explicit authorization trail for write operations
- Enables safe automation with clear boundaries

### Gemini & Qwen

**Via CCW**: `ccw cli -p "<prompt>" --tool gemini --mode analysis` or `--tool qwen --mode analysis`

**Characteristics**:
- Large context window, pattern recognition
- Best for: Analysis, documentation, code exploration, architecture review
- Recommended MODE: `analysis` (read-only) for analysis tasks, `write` for file creation
- Priority: Prefer Gemini; use Qwen as fallback



**Error Handling**: HTTP 429 may show error but still return results - check if results exist

### Codex

**Via CCW**: `ccw cli -p "<prompt>" --tool codex --mode write`

**Characteristics**:
- Autonomous development, mathematical reasoning
- Best for: Implementation, testing, automation, bug fixes
- No default MODE - must explicitly specify `--mode analysis` or `--mode write`


### Session Resume

**When to Use**:
- Multi-round planning (analysis → planning → implementation)
- Multi-model collaboration (Gemini → Codex on same topic)
- Topic continuity (building on previous findings)

**Usage**:

```bash
ccw cli -p "Continue analyzing" --tool gemini --mode analysis --resume              # Resume last
ccw cli -p "Fix issues found" --tool codex --mode write --resume <id>              # Resume specific
ccw cli -p "Merge findings" --tool gemini --mode analysis --resume <id1>,<id2>     # Merge multiple
```

- **`--resume`**: Last session
- **`--resume <id>`**: Specific session
- **`--resume <id1>,<id2>`**: Merge sessions (comma-separated)

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
  - Purpose: Protocol + template + constraints
  - Components: $(cat protocol) + $(cat template) + domain rules
  - Bad Example: (missing)
  - Good Example: "$(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/03-assess-security-risks.txt) \| Focus on authentication \| Ignore test files"

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
ccw cli -p "..." --tool gemini --mode analysis --cd src
```

### RULES Configuration

**Format**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]`

**⚠️ MANDATORY**: Exactly ONE template reference is REQUIRED. Select from Task-Template Matrix or use universal fallback:
- `universal/00-universal-rigorous-style.txt` - For precision-critical tasks (default fallback)
- `universal/00-universal-creative-style.txt` - For exploratory tasks

**Command Substitution Rules**:
- Use `$(cat ...)` directly in **double quotes** - command substitution executes in your local shell BEFORE passing to ccw
- Shell expands `$(cat ...)` into file content automatically - do NOT read template content first
- NEVER use escape characters (`\$`, `\"`, `\'`) or single quotes - these prevent shell expansion
- Tilde (`~`) expands correctly in prompt context

**Critical**: Use double quotes `"..."` around the entire prompt to enable `$(cat ...)` expansion:
```bash
# ✓ CORRECT - double quotes allow shell expansion
ccw cli -p "RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) ..." --tool gemini

# ✗ WRONG - single quotes prevent expansion
ccw cli -p 'RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) ...' --tool gemini

# ✗ WRONG - escaped $ prevents expansion
ccw cli -p "RULES: \$(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) ..." --tool gemini
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
  - Description: **REQUIRED**: analysis, write
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

- **`--resume [id]`**
  - Description: Resume previous session
  - Default: -

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
ccw cli -p "CONTEXT: @**/* @../shared/**/*" --tool gemini --mode analysis --cd src/auth --includeDirs ../shared

# Multiple directories
ccw cli -p "..." --tool gemini --mode analysis --cd src/auth --includeDirs ../shared,../types,../utils
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

- **`--mode analysis`**
  - Gemini/Qwen: (default read-only)
  - Codex: (default read-only)

- **`--mode write`**
  - Gemini/Qwen: `--approval-mode yolo`
  - Codex: `-s danger-full-access`

### Command Examples

#### Task-Type Specific Templates

**Analysis Task** (Security Audit):
```bash
timeout 600 ccw cli -p "
PURPOSE: Identify OWASP Top 10 vulnerabilities in authentication module to pass security audit; success = all critical/high issues documented with remediation
TASK: • Scan for injection flaws (SQL, command, LDAP) • Check authentication bypass vectors • Evaluate session management • Assess sensitive data exposure
MODE: analysis
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Security report with: severity matrix, file:line references, CVE mappings where applicable, remediation code snippets prioritized by risk
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/03-assess-security-risks.txt) | Focus on authentication | Ignore test files
" --tool gemini --mode analysis --cd src/auth
```

**Implementation Task** (New Feature):
```bash
timeout 1800 ccw cli -p "
PURPOSE: Implement rate limiting for API endpoints to prevent abuse; must be configurable per-endpoint; backward compatible with existing clients
TASK: • Create rate limiter middleware with sliding window • Implement per-route configuration • Add Redis backend for distributed state • Include bypass for internal services
MODE: write
CONTEXT: @src/middleware/**/* @src/config/**/* | Memory: Using Express.js, Redis already configured, existing middleware pattern in auth.ts
EXPECTED: Production-ready code with: TypeScript types, unit tests, integration test, configuration example, migration guide
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | Follow existing middleware patterns | No breaking changes
" --tool codex --mode write
```

**Bug Fix Task**:
```bash
timeout 900 ccw cli -p "
PURPOSE: Fix memory leak in WebSocket connection handler causing server OOM after 24h; root cause must be identified before any fix
TASK: • Trace connection lifecycle from open to close • Identify event listener accumulation • Check cleanup on disconnect • Verify garbage collection eligibility
MODE: analysis
CONTEXT: @src/websocket/**/* @src/services/connection-manager.ts | Memory: Using ws library, ~5000 concurrent connections in production
EXPECTED: Root cause analysis with: memory profile, leak source (file:line), fix recommendation with code, verification steps
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt) | Focus on resource cleanup
" --tool gemini --mode analysis --cd src
```

**Refactoring Task**:
```bash
timeout 1200 ccw cli -p "
PURPOSE: Refactor payment processing to use strategy pattern for multi-gateway support; no functional changes; all existing tests must pass
TASK: • Extract gateway interface from current implementation • Create strategy classes for Stripe, PayPal • Implement factory for gateway selection • Migrate existing code to use strategies
MODE: write
CONTEXT: @src/payments/**/* @src/types/payment.ts | Memory: Currently only Stripe, adding PayPal next sprint, must support future gateways
EXPECTED: Refactored code with: strategy interface, concrete implementations, factory class, updated tests, migration checklist
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/development/02-refactor-codebase.txt) | Preserve all existing behavior | Tests must pass
" --tool gemini --mode write
```
---

## Configuration

### Timeout Allocation (Bash)

CLI internal timeout is disabled; controlled by external bash `timeout` command:

```bash
# Syntax: timeout <seconds> ccw cli ...
timeout 600 ccw cli -p "..." --tool gemini --mode analysis   # 10 minutes
timeout 1800 ccw cli -p "..." --tool codex --mode write      # 30 minutes
```

**Recommended Time Allocation**:

- **Simple** (5-10min): Analysis, search
  - `timeout 300` ~ `timeout 600`

- **Medium** (10-20min): Refactoring, documentation
  - `timeout 600` ~ `timeout 1200`

- **Complex** (20-60min): Implementation, migration
  - `timeout 1200` ~ `timeout 3600`

- **Heavy** (60-120min): Large codebase, multi-file
  - `timeout 3600` ~ `timeout 7200`

**Codex Multiplier**: 3x allocated time (minimum 15min / 900s)

### Permission Framework

**Single-Use Authorization**: Each execution requires explicit user instruction. Previous authorization does NOT carry over.

**Mode Hierarchy**:
- `analysis`: Read-only, safe for auto-execution
- `write`: Create/Modify/Delete files, full operations - requires explicit `--mode write`
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

### Planning Checklist

- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - `--mode analysis|write`
- [ ] **Context gathered** - File references + memory (default `@**/*`)
- [ ] **Directory navigation** - `--cd` and/or `--includeDirs`
- [ ] **Tool selected** - `--tool gemini|qwen|codex`
- [ ] **Template applied (REQUIRED)** - Use specific or universal fallback template
- [ ] **Constraints specified** - Scope, requirements
