# Memory System

## One-Liner

**The Memory System is a cross-session knowledge persistence mechanism** — Stores project context, decisions, and learnings so AI remembers across sessions without re-explanation.

---

## Pain Points Solved

| Pain Point | Current State | Memory System Solution |
|------------|---------------|------------------------|
| **Cross-session amnesia** | New session requires re-explaining project | Persistent memory across sessions |
| **Lost decisions** | Architecture decisions forgotten | Decision log persists |
| **Repeated explanations** | Same context explained multiple times | Memory auto-injection |
| **Knowledge silos** | Each developer maintains own context | Shared team memory |

---

## vs Traditional Methods

| Dimension | CLAUDE.md | Notes | **Memory System** |
|-----------|-----------|-------|-------------------|
| Persistence | Static file | Manual | **Auto-extracted from sessions** |
| Search | Text search | Folder search | **Semantic vector search** |
| Updates | Manual edit | Manual note | **Auto-capture from conversations** |
| Sharing | Git | Manual | **Auto-sync via workflow** |

---

## Core Concepts

| Concept | Description | Location |
|---------|-------------|----------|
| **Core Memory** | Persistent project knowledge | `~/.claude/memory/` |
| **Session Memory** | Current session context | `.workflow/.memory/` |
| **Memory Entry** | Individual knowledge item | JSONL format |
| **Memory Index** | Searchable index | Embedding-based |

---

## Usage

### Viewing Memory

```bash
ccw memory list
ccw memory search "authentication"
```

### Memory Categories

- **Project Context**: Architecture, tech stack, patterns
- **Decisions**: ADRs, design choices
- **Learnings**: What worked, what didn't
- **Conventions**: Coding standards, naming

---

## Configuration

```json
// ~/.claude/cli-settings.json
{
  "memory": {
    "enabled": true,
    "maxEntries": 1000,
    "autoCapture": true,
    "embeddingModel": "text-embedding-3-small"
  }
}
```

---

## Related Links

- [Spec System](/features/spec) - Constraint injection
- [CLI Call](/features/cli) - Command line invocation
- [CodexLens](/features/codexlens) - Code indexing
