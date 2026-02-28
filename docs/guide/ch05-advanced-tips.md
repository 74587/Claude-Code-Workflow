# Advanced Tips

## One-Line Positioning

**Advanced Tips are the key to efficiency improvement** — Deep CLI toolchain usage, multi-model collaboration optimization, memory management best practices.

---

## 5.1 CLI Toolchain Usage

### 5.1.1 CLI Configuration

CLI tool configuration file: `~/.claude/cli-tools.json`

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["analysis", "Debug"],
      "type": "builtin"
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "secondaryModel": "coder-model",
      "tags": [],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "secondaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

### 5.1.2 Tag Routing

Automatically select models based on task type:

| Tag | Applicable Model | Task Type |
| --- | --- | --- |
| **analysis** | Gemini | Code analysis, architecture design |
| **Debug** | Gemini | Root cause analysis, problem diagnosis |
| **implementation** | Qwen | Feature development, code generation |
| **review** | Codex | Code review, Git operations |

### 5.1.3 CLI Command Templates

#### Analysis Task

```bash
ccw cli -p "PURPOSE: Identify security vulnerabilities
TASK: • Scan for SQL injection • Check XSS • Verify CSRF
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: Security report with severity grading and fix recommendations
CONSTRAINTS: Focus on auth module" --tool gemini --mode analysis --rule analysis-assess-security-risks
```

#### Implementation Task

```bash
ccw cli -p "PURPOSE: Implement rate limiting
TASK: • Create middleware • Configure routes • Redis backend
MODE: write
CONTEXT: @src/middleware/**/* @src/config/**/*
EXPECTED: Production code + unit tests + integration tests
CONSTRAINTS: Follow existing middleware patterns" --tool qwen --mode write --rule development-implement-feature
```

### 5.1.4 Rule Templates

| Rule | Purpose |
| --- | --- |
| **analysis-diagnose-bug-root-cause** | Bug root cause analysis |
| **analysis-analyze-code-patterns** | Code pattern analysis |
| **analysis-review-architecture** | Architecture review |
| **analysis-assess-security-risks** | Security assessment |
| **development-implement-feature** | Feature implementation |
| **development-refactor-codebase** | Code refactoring |
| **development-generate-tests** | Test generation |

---

## 5.2 Multi-Model Collaboration

### 5.2.1 Model Selection Guide

| Task | Recommended Model | Reason |
| --- | --- | --- |
| **Code Analysis** | Gemini | Strong at deep code understanding and pattern recognition |
| **Bug Diagnosis** | Gemini | Powerful root cause analysis capability |
| **Feature Development** | Qwen | High code generation efficiency |
| **Code Review** | Codex (GPT) | Good Git integration, standard review format |
| **Long Text** | Claude | Large context window |

### 5.2.2 Collaboration Patterns

#### Serial Collaboration

```bash
# Step 1: Gemini analysis
ccw cli -p "Analyze code architecture" --tool gemini --mode analysis

# Step 2: Qwen implementation
ccw cli -p "Implement feature based on analysis" --tool qwen --mode write

# Step 3: Codex review
ccw cli -p "Review implementation code" --tool codex --mode review
```

#### Parallel Collaboration

Use `--tool gemini` and `--tool qwen` to analyze the same problem simultaneously:

```bash
# Terminal 1
ccw cli -p "Analyze from performance perspective" --tool gemini --mode analysis &

# Terminal 2
ccw cli -p "Analyze from security perspective" --tool codex --mode analysis &
```

### 5.2.3 Session Resume

Cross-model session resume:

```bash
# First call
ccw cli -p "Analyze authentication module" --tool gemini --mode analysis

# Resume session to continue
ccw cli -p "Based on previous analysis, design improvement plan" --tool qwen --mode write --resume
```

---

## 5.3 Memory Management

### 5.3.1 Memory Categories

| Category | Purpose | Example Content |
| --- | --- | --- |
| **learnings** | Learning insights | New technology usage experience |
| **decisions** | Architecture decisions | Technology selection rationale |
| **conventions** | Coding standards | Naming conventions, patterns |
| **issues** | Known issues | Bugs, limitations, TODOs |

### 5.3.2 Memory Commands

| Command | Function | Example |
| --- | --- | --- |
| **list** | List all memories | `ccw memory list` |
| **search** | Search memories | `ccw memory search "authentication"` |
| **export** | Export memory | `ccw memory export <id>` |
| **import** | Import memory | `ccw memory import "..."` |
| **embed** | Generate embeddings | `ccw memory embed <id>` |

### 5.3.3 Memory Best Practices

::: tip Tip
- **Regular cleanup**: Organize Memory weekly, delete outdated content
- **Structure**: Use standard format for easy search and reuse
- **Context**: Record decision background, not just conclusions
- **Linking**: Cross-reference related content
:::

### 5.3.4 Memory Template

```markdown
## Title
### Background
- **Problem**: ...
- **Impact**: ...

### Decision
- **Solution**: ...
- **Rationale**: ...

### Result
- **Effect**: ...
- **Lessons Learned**: ...

### Related
- [Related Memory 1](memory-id-1)
- [Related Documentation](link)
```

---

## 5.4 CodexLens Advanced Usage

### 5.4.1 Hybrid Search

Combine vector search and keyword search:

```bash
# Pure vector search
ccw search --mode vector "user authentication"

# Hybrid search (default)
ccw search --mode hybrid "user authentication"

# Pure keyword search
ccw search --mode keyword "authenticate"
```

### 5.4.2 Call Chain Tracing

Trace complete call chains of functions:

```bash
# Trace up (who called me)
ccw search --trace-up "authenticateUser"

# Trace down (who I called)
ccw search --trace-down "authenticateUser"

# Full call chain
ccw search --trace-full "authenticateUser"
```

### 5.4.3 Semantic Search Techniques

| Technique | Example | Effect |
| --- | --- | --- |
| **Functional description** | "handle user login" | Find login-related code |
| **Problem description** | "memory leak locations" | Find potential issues |
| **Pattern description** | "singleton implementation" | Find design patterns |
| **Technical description** | "using React Hooks" | Find related usage |

---

## 5.5 Hook Auto-Injection

### 5.5.1 Hook Types

| Hook Type | Trigger Time | Purpose |
| --- | --- | --- |
| **pre-command** | Before command execution | Inject specifications, load context |
| **post-command** | After command execution | Save Memory, update state |
| **pre-commit** | Before Git commit | Code review, standard checks |
| **file-change** | On file change | Auto-format, update index |

### 5.5.2 Hook Configuration

Configure in `.claude/hooks.json`:

```json
{
  "pre-command": [
    {
      "name": "inject-specs",
      "description": "Inject project specifications",
      "command": "cat .workflow/specs/project-constraints.md"
    },
    {
      "name": "load-memory",
      "description": "Load related Memory",
      "command": "ccw memory search \"{query}\""
    }
  ],
  "post-command": [
    {
      "name": "save-memory",
      "description": "Save important decisions",
      "command": "ccw memory import \"{content}\""
    }
  ]
}
```

---

## 5.6 Performance Optimization

### 5.6.1 Indexing Optimization

| Optimization | Description |
| --- | --- |
| **Incremental indexing** | Only index changed files |
| **Parallel indexing** | Multi-process parallel processing |
| **Caching strategy** | Vector embedding cache |

### 5.6.2 Search Optimization

| Optimization | Description |
| --- | --- |
| **Result caching** | Same query returns cached results |
| **Paginated loading** | Large result sets paginated |
| **Smart deduplication** | Auto-duplicate similar results |

---

## 5.7 Quick Reference

### CLI Command Cheatsheet

| Command | Function |
| --- | --- |
| `ccw cli -p "..." --tool gemini --mode analysis` | Analysis task |
| `ccw cli -p "..." --tool qwen --mode write` | Implementation task |
| `ccw cli -p "..." --tool codex --mode review` | Review task |
| `ccw memory list` | List memories |
| `ccw memory search "..."` | Search memories |
| `ccw search "..."` | Semantic search |
| `ccw search --trace "..."` | Call chain tracing |

### Rule Template Cheatsheet

| Rule | Purpose |
| --- | --- |
| `analysis-diagnose-bug-root-cause` | Bug analysis |
| `analysis-assess-security-risks` | Security assessment |
| `development-implement-feature` | Feature implementation |
| `development-refactor-codebase` | Code refactoring |
| `development-generate-tests` | Test generation |

---

## Next Steps

- [Best Practices](ch06-best-practices.md) — Team collaboration standards, code review process, documentation maintenance strategy
