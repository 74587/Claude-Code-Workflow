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
ccw cli -p "<PROMPT>" --tool <tool-id> --mode <analysis|write|review>

# Model override
ccw cli -p "<PROMPT>" --tool <tool-id> --model <model-id> --mode <analysis|write>

# Code review (codex only)
ccw cli -p "<PROMPT>" --tool codex --mode review

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

```bash
# Use --rule to auto-load protocol and template as $PROTO and $TMPL
ccw cli -p "
PURPOSE: [what] + [why] + [success criteria] + [constraints/scope]
TASK: • [step 1: specific action] • [step 2: specific action] • [step 3: specific action]
MODE: [analysis|write]
CONTEXT: @[file patterns] | Memory: [session/tech/module context]
EXPECTED: [deliverable format] + [quality criteria] + [structure requirements]
RULES: $PROTO $TMPL | [domain constraints]
" --tool <tool-id> --mode <analysis|write> --rule <category-template>
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
  - Components: $PROTO + $TMPL + domain rules (variables loaded beforehand)
  - Bad Example: (missing)
  - Good Example: "$PROTO $TMPL | Focus on authentication | Ignore test files" (where PROTO and TMPL are pre-loaded variables)

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

**使用 `--rule` 选项自动加载模板**：

```bash
ccw cli -p "... RULES: \$PROTO \$TMPL | constraints" --tool gemini --mode analysis --rule analysis-review-architecture
```

**`--rule` 工作原理**：
1. 自动从 `~/.claude/workflows/cli-templates/prompts/` 发现模板
2. 根据 `--mode` 自动加载对应 protocol（analysis-protocol.md 或 write-protocol.md）
3. 设置环境变量 `$PROTO`（protocol）和 `$TMPL`（template）供子进程使用
4. 在提示词中用 `$PROTO` 和 `$TMPL` 引用

**模板选择**：从 Task-Template Matrix 选择或使用通用模板：
- `universal-rigorous-style` - 精确型任务
- `universal-creative-style` - 探索型任务

### Mode Protocol References

**`--rule` 自动处理 Protocol**：
- `--mode analysis` → `$PROTO` = analysis-protocol.md
- `--mode write` → `$PROTO` = write-protocol.md

**Protocol 映射**：

- **`analysis`** 模式
  - 权限：只读操作
  - 约束：禁止文件创建/修改/删除

- **`write`** 模式
  - 权限：创建/修改/删除文件
  - 约束：完整工作流执行能力

### Template System

**Base Path**: `~/.claude/workflows/cli-templates/prompts/`

**Naming Convention**: `category-function.txt`
- 第一段为分类（analysis, development, planning 等）
- 第二段为功能描述

**Universal Templates**:
- `universal-rigorous-style` - 精确型任务
- `universal-creative-style` - 探索型任务

**Task-Template Matrix**:

**Analysis**:
- Execution Tracing: `analysis-trace-code-execution`
- Bug Diagnosis: `analysis-diagnose-bug-root-cause`
- Code Patterns: `analysis-analyze-code-patterns`
- Document Analysis: `analysis-analyze-technical-document`
- Architecture Review: `analysis-review-architecture`
- Code Review: `analysis-review-code-quality`
- Performance: `analysis-analyze-performance`
- Security: `analysis-assess-security-risks`

**Planning**:
- Architecture: `planning-plan-architecture-design`
- Task Breakdown: `planning-breakdown-task-steps`
- Component Design: `planning-design-component-spec`
- Migration: `planning-plan-migration-strategy`

**Development**:
- Feature: `development-implement-feature`
- Refactoring: `development-refactor-codebase`
- Tests: `development-generate-tests`
- UI Component: `development-implement-component-ui`
- Debugging: `development-debug-runtime-issues`

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

- **`review`**
  - Permission: Read-only (code review output)
  - Use For: Git-aware code review of uncommitted changes, branch diffs, specific commits
  - Specification: **codex only** - uses `codex review` subcommand with `--uncommitted` by default
  - Tool Behavior:
    - `codex`: Executes `codex review --uncommitted [prompt]` for structured code review
    - Other tools (gemini/qwen/claude): Accept mode but no operation change (treated as analysis)

### Command Options

- **`--tool <tool>`**
  - Description: Tool from config (e.g., gemini, qwen, codex)
  - Default: First enabled tool in config

- **`--mode <mode>`**
  - Description: **REQUIRED**: analysis, write, review
  - Default: **NONE** (must specify)
  - Note: `review` mode triggers `codex review` subcommand for codex tool only

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

- **`--rule <template>`**
  - Description: 模板名称，自动加载 protocol + template 为 $PROTO 和 $TMPL 环境变量
  - Default: none
  - 根据 --mode 自动选择 protocol

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
RULES: \$PROTO \$TMPL | Focus on authentication | Ignore test files
" --tool gemini --mode analysis --rule analysis-assess-security-risks --cd src/auth
```

**Implementation Task** (New Feature):
```bash
ccw cli -p "
PURPOSE: Implement rate limiting for API endpoints to prevent abuse; must be configurable per-endpoint; backward compatible with existing clients
TASK: • Create rate limiter middleware with sliding window • Implement per-route configuration • Add Redis backend for distributed state • Include bypass for internal services
MODE: write
CONTEXT: @src/middleware/**/* @src/config/**/* | Memory: Using Express.js, Redis already configured, existing middleware pattern in auth.ts
EXPECTED: Production-ready code with: TypeScript types, unit tests, integration test, configuration example, migration guide
RULES: \$PROTO \$TMPL | Follow existing middleware patterns | No breaking changes
" --tool gemini --mode write --rule development-implement-feature
```

**Bug Fix Task**:
```bash
ccw cli -p "
PURPOSE: Fix memory leak in WebSocket connection handler causing server OOM after 24h; root cause must be identified before any fix
TASK: • Trace connection lifecycle from open to close • Identify event listener accumulation • Check cleanup on disconnect • Verify garbage collection eligibility
MODE: analysis
CONTEXT: @src/websocket/**/* @src/services/connection-manager.ts | Memory: Using ws library, ~5000 concurrent connections in production
EXPECTED: Root cause analysis with: memory profile, leak source (file:line), fix recommendation with code, verification steps
RULES: \$PROTO \$TMPL | Focus on resource cleanup
" --tool gemini --mode analysis --rule analysis-diagnose-bug-root-cause --cd src
```

**Refactoring Task**:
```bash
ccw cli -p "
PURPOSE: Refactor payment processing to use strategy pattern for multi-gateway support; no functional changes; all existing tests must pass
TASK: • Extract gateway interface from current implementation • Create strategy classes for Stripe, PayPal • Implement factory for gateway selection • Migrate existing code to use strategies
MODE: write
CONTEXT: @src/payments/**/* @src/types/payment.ts | Memory: Currently only Stripe, adding PayPal next sprint, must support future gateways
EXPECTED: Refactored code with: strategy interface, concrete implementations, factory class, updated tests, migration checklist
RULES: \$PROTO \$TMPL | Preserve all existing behavior | Tests must pass
" --tool gemini --mode write --rule development-refactor-codebase
```

**Code Review Task** (codex review mode):
```bash
# Review uncommitted changes (default)
ccw cli -p "Focus on security vulnerabilities and error handling" --tool codex --mode review

# Review with custom instructions
ccw cli -p "Check for breaking changes in API contracts and backward compatibility" --tool codex --mode review
```

> **Note**: `--mode review` only triggers special behavior for `codex` tool (uses `codex review --uncommitted`). Other tools accept the mode but execute as standard analysis.

---

### Permission Framework

**Single-Use Authorization**: Each execution requires explicit user instruction. Previous authorization does NOT carry over.

**Mode Hierarchy**:
- `analysis`: Read-only, safe for auto-execution
- `write`: Create/Modify/Delete files, full operations - requires explicit `--mode write`
- `review`: Git-aware code review (codex only), read-only output - requires explicit `--mode review`
- **Exception**: User provides clear instructions like "modify", "create", "implement"

---

## Best Practices

### Core Principles

- **Configuration-driven** - All tool selection from `cli-tools.json`
- **Tag-based routing** - Match task requirements to tool capabilities
- **Use tools early and often** - Tools are faster and more thorough
- **Unified CLI** - Always use `ccw cli -p` for consistent parameter handling
- **Default mode is analysis** - Omit `--mode` for read-only operations, explicitly use `--mode write` for file modifications
- **Use `--rule` for templates** - 自动加载 protocol + template 为 `$PROTO` 和 `$TMPL` 环境变量
- **Write protection** - Require EXPLICIT `--mode write` for file operations

### Workflow Principles

- **Use CCW unified interface** for all executions
- **Always include template** - 使用 `--rule <template-name>` 加载模板
- **Be specific** - Clear PURPOSE, TASK, EXPECTED fields
- **Include constraints** - File patterns, scope in RULES
- **Leverage memory context** when building on previous work
- **Discover patterns first** - Use rg/MCP before CLI execution
- **Default to full context** - Use `@**/*` unless specific files needed

### Planning Checklist

- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - `--mode analysis|write|review`
- [ ] **Context gathered** - File references + memory (default `@**/*`)
- [ ] **Directory navigation** - `--cd` and/or `--includeDirs`
- [ ] **Tool selected** - Explicit `--tool` or tag-based auto-selection
- [ ] **Rule template** - `--rule <template-name>` 自动加载 protocol + template
- [ ] **Constraints specified** - Scope, requirements

### Execution Workflow

1. **Load configuration** - Read `cli-tools.json` for available tools
2. **Match by tags** - Select tool based on task requirements
3. **Validate enabled** - Ensure selected tool is enabled
4. **Execute with mode** - Always specify `--mode analysis|write|review`
5. **Fallback gracefully** - Use secondary model or next matching tool on failure
