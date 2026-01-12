# CLI Tools Execution Specification

## Table of Contents
1. [Configuration Reference](#configuration-reference)
2. [Tool Selection](#tool-selection)
3. [Prompt Template](#prompt-template)
4. [CLI Execution](#cli-execution)
5. [Execution Configuration](#execution-configuration)
6. [Best Practices](#best-practices)

---

## Configuration Reference

### Configuration File

**Path**: `.claude/cli-tools.json`

All tool availability, model selection, and routing are defined in this configuration file.

### Configuration Schema

```json
{
  "version": "3.0.0",
  "models": {
    "<tool-id>": ["<model-1>", "<model-2>", ...]
  },
  "tools": {
    "<tool-id>": {
      "enabled": true|false,
      "primaryModel": "<model-id>",
      "secondaryModel": "<model-id>",
      "tags": ["<tag-1>", "<tag-2>", ...]
    }
  },
  "customEndpoints": [
    {
      "id": "<endpoint-id>",
      "name": "<display-name>",
      "enabled": true|false,
      "tags": ["<tag-1>", "<tag-2>", ...]
    }
  ]
}
```

### Configuration Fields

| Field | Description |
|-------|-------------|
| `enabled` | Tool availability status |
| `primaryModel` | Default model for the tool |
| `secondaryModel` | Fallback model |
| `tags` | Capability tags for routing |

### Tool Types

| Type | Usage | Capabilities |
|------|-------|--------------|
| `builtin` | `--tool gemini` | Full (analysis + write tools) |
| `cli-wrapper` | `--tool doubao` | Full (analysis + write tools) |
| `api-endpoint` | `--tool g25` | **Analysis only** (no file write tools) |

> **Note**: `api-endpoint` tools only support analysis and code generation responses. They cannot create, modify, or delete files.

---

## Tool Selection

### Tag-Based Routing

Tools are selected based on **tags** defined in the configuration. Use tags to match task requirements to tool capabilities.

#### Common Tags

| Tag | Use Case |
|-----|----------|
| `analysis` | Code review, architecture analysis, exploration |
| `implementation` | Feature development, bug fixes |
| `documentation` | Doc generation, comments |
| `testing` | Test creation, coverage analysis |
| `refactoring` | Code restructuring |
| `security` | Security audits, vulnerability scanning |

### Selection Algorithm

```
1. Parse task intent → extract required capabilities
2. Load cli-tools.json → get enabled tools with tags
3. Match tags → filter tools supporting required capabilities
4. Select tool → choose by priority (explicit > tag-match > default)
5. Select model → use primaryModel, fallback to secondaryModel
```

### Selection Decision Tree

```
┌─ Explicit --tool specified?
│  └─→ YES: Use specified tool (validate enabled)
│
└─ NO: Tag-based selection
   ├─ Task requires tags?
   │  └─→ Match tools with matching tags
   │     └─→ Multiple matches? Use first enabled
   │
   └─ No tag match?
      └─→ Use default tool (first enabled in config)
```

### Command Structure

```bash
# Explicit tool selection
ccw cli -p "<PROMPT>" --tool <tool-id> --mode <analysis|write>

# Model override
ccw cli -p "<PROMPT>" --tool <tool-id> --model <model-id> --mode <analysis|write>

# Tag-based auto-selection (future)
ccw cli -p "<PROMPT>" --tags <tag1,tag2> --mode <analysis|write>
```

### Tool Fallback Chain

When primary tool fails or is unavailable:
1. Check `secondaryModel` for same tool
2. Try next enabled tool with matching tags
3. Fall back to default enabled tool

---

## Prompt Template

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
ccw cli -p "..." --tool <tool-id> --mode analysis --cd src
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
ccw cli -p "RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) ..." --tool <tool-id>

# ✗ WRONG - single quotes prevent expansion
ccw cli -p 'RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) ...' --tool <tool-id>

# ✗ WRONG - escaped $ prevents expansion
ccw cli -p "RULES: \$(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) ..." --tool <tool-id>
```

### Mode Protocol References (MANDATORY)

**⚠️ REQUIRED**: Every CLI execution MUST include the corresponding mode protocol in RULES:

#### Mode Rule Templates

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
- Ensures consistent permission enforcement across all tools
- Prevents accidental file modifications during analysis tasks
- Provides explicit authorization trail for write operations
- Enables safe automation with clear boundaries

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

### MODE Options

- **`analysis`**
  - Permission: Read-only
  - Use For: Code review, architecture analysis, pattern discovery, exploration
  - Specification: Safe for all tools

- **`write`**
  - Permission: Create/Modify/Delete
  - Use For: Feature implementation, bug fixes, documentation, code creation, file modifications
  - Specification: Requires explicit `--mode write`

### Command Options

- **`--tool <tool>`**
  - Description: Tool from config (e.g., gemini, qwen, codex)
  - Default: First enabled tool in config

- **`--mode <mode>`**
  - Description: **REQUIRED**: analysis, write
  - Default: **NONE** (must specify)

- **`--model <model>`**
  - Description: Model override
  - Default: Tool's primaryModel from config

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
ccw cli -p "CONTEXT: @**/* @../shared/**/*" --tool <tool-id> --mode analysis --cd src/auth --includeDirs ../shared

# Multiple directories
ccw cli -p "..." --tool <tool-id> --mode analysis --cd src/auth --includeDirs ../shared,../types,../utils
```

**Rule**: If CONTEXT contains `@../dir/**/*`, MUST include `--includeDirs ../dir`

**Benefits**: Excludes unrelated directories, reduces token usage

### Session Resume

**When to Use**:
- Multi-round planning (analysis → planning → implementation)
- Multi-model collaboration (tool A → tool B on same topic)
- Topic continuity (building on previous findings)

**Usage**:

```bash
ccw cli -p "Continue analyzing" --tool <tool-id> --mode analysis --resume              # Resume last
ccw cli -p "Fix issues found" --tool <tool-id> --mode write --resume <id>              # Resume specific
ccw cli -p "Merge findings" --tool <tool-id> --mode analysis --resume <id1>,<id2>      # Merge multiple
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

### Command Examples

#### Task-Type Specific Templates

**Analysis Task** (Security Audit):
```bash
ccw cli -p "
PURPOSE: Identify OWASP Top 10 vulnerabilities in authentication module to pass security audit; success = all critical/high issues documented with remediation
TASK: • Scan for injection flaws (SQL, command, LDAP) • Check authentication bypass vectors • Evaluate session management • Assess sensitive data exposure
MODE: analysis
CONTEXT: @src/auth/**/* @src/middleware/auth.ts | Memory: Using bcrypt for passwords, JWT for sessions
EXPECTED: Security report with: severity matrix, file:line references, CVE mappings where applicable, remediation code snippets prioritized by risk
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/03-assess-security-risks.txt) | Focus on authentication | Ignore test files
" --tool <tool-id> --mode analysis --cd src/auth
```

**Implementation Task** (New Feature):
```bash
ccw cli -p "
PURPOSE: Implement rate limiting for API endpoints to prevent abuse; must be configurable per-endpoint; backward compatible with existing clients
TASK: • Create rate limiter middleware with sliding window • Implement per-route configuration • Add Redis backend for distributed state • Include bypass for internal services
MODE: write
CONTEXT: @src/middleware/**/* @src/config/**/* | Memory: Using Express.js, Redis already configured, existing middleware pattern in auth.ts
EXPECTED: Production-ready code with: TypeScript types, unit tests, integration test, configuration example, migration guide
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | Follow existing middleware patterns | No breaking changes
" --tool <tool-id> --mode write
```

**Bug Fix Task**:
```bash
ccw cli -p "
PURPOSE: Fix memory leak in WebSocket connection handler causing server OOM after 24h; root cause must be identified before any fix
TASK: • Trace connection lifecycle from open to close • Identify event listener accumulation • Check cleanup on disconnect • Verify garbage collection eligibility
MODE: analysis
CONTEXT: @src/websocket/**/* @src/services/connection-manager.ts | Memory: Using ws library, ~5000 concurrent connections in production
EXPECTED: Root cause analysis with: memory profile, leak source (file:line), fix recommendation with code, verification steps
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt) | Focus on resource cleanup
" --tool <tool-id> --mode analysis --cd src
```

**Refactoring Task**:
```bash
ccw cli -p "
PURPOSE: Refactor payment processing to use strategy pattern for multi-gateway support; no functional changes; all existing tests must pass
TASK: • Extract gateway interface from current implementation • Create strategy classes for Stripe, PayPal • Implement factory for gateway selection • Migrate existing code to use strategies
MODE: write
CONTEXT: @src/payments/**/* @src/types/payment.ts | Memory: Currently only Stripe, adding PayPal next sprint, must support future gateways
EXPECTED: Refactored code with: strategy interface, concrete implementations, factory class, updated tests, migration checklist
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) $(cat ~/.claude/workflows/cli-templates/prompts/development/02-refactor-codebase.txt) | Preserve all existing behavior | Tests must pass
" --tool <tool-id> --mode write
```

---

## Execution Configuration

### Dynamic Timeout Allocation

**Minimum timeout: 5 minutes (300000ms)** - Never set below this threshold.

**Timeout Ranges**:
- **Simple** (analysis, search): 5-10min (300000-600000ms)
- **Medium** (refactoring, documentation): 10-20min (600000-1200000ms)
- **Complex** (implementation, migration): 20-60min (1200000-3600000ms)
- **Heavy** (large codebase, multi-file): 60-120min (3600000-7200000ms)

**Auto-detection**: Analyze PURPOSE and TASK fields to determine timeout

### Permission Framework

**Single-Use Authorization**: Each execution requires explicit user instruction. Previous authorization does NOT carry over.

**Mode Hierarchy**:
- `analysis`: Read-only, safe for auto-execution
- `write`: Create/Modify/Delete files, full operations - requires explicit `--mode write`
- **Exception**: User provides clear instructions like "modify", "create", "implement"

---

## Best Practices

### Core Principles

- **Configuration-driven** - All tool selection from `cli-tools.json`
- **Tag-based routing** - Match task requirements to tool capabilities
- **Use tools early and often** - Tools are faster and more thorough
- **Unified CLI** - Always use `ccw cli -p` for consistent parameter handling
- **Default mode is analysis** - Omit `--mode` for read-only operations, explicitly use `--mode write` for file modifications
- **One template required** - ALWAYS reference exactly ONE template in RULES (use universal fallback if no specific match)
- **Write protection** - Require EXPLICIT `--mode write` for file operations
- **Use double quotes for shell expansion** - Always wrap prompts in double quotes `"..."` to enable `$(cat ...)` command substitution; NEVER use single quotes or escape characters (`\$`, `\"`, `\'`)

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
- [ ] **Tool selected** - Explicit `--tool` or tag-based auto-selection
- [ ] **Template applied (REQUIRED)** - Use specific or universal fallback template
- [ ] **Constraints specified** - Scope, requirements

### Execution Workflow

1. **Load configuration** - Read `cli-tools.json` for available tools
2. **Match by tags** - Select tool based on task requirements
3. **Validate enabled** - Ensure selected tool is enabled
4. **Execute with mode** - Always specify `--mode analysis|write`
5. **Fallback gracefully** - Use secondary model or next matching tool on failure
