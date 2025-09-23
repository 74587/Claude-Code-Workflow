---
name: python-tools-strategy
description: Strategic framework for Python-based intelligent tool selection
type: strategic-guideline
---

# Python Tools Selection Strategy

## ⚡ Core Framework

**Python CLI (pycli)**: Unified interface for intelligent context discovery and tool execution
**Vector Database**: Hierarchical semantic search with automatic parent discovery
**Smart Analysis**: Context-aware file selection with similarity scoring

### Decision Principles
- **Context first** - Use vector search for intelligent file discovery
- **Hierarchical by default** - Leverage parent directory vector databases automatically
- **Semantic over syntactic** - Find relevant code by meaning, not just keywords
- **Tool integration** - Seamlessly combine context discovery with Gemini/Codex execution

### Quick Decision Rules
1. **Need context discovery?** → Start with `pycli --analyze --query`
2. **Know exact files?** → Use `pycli --analyze -p` directly
3. **First time in project?** → Run `pycli --init` first
4. **Files changed?** → Update with `pycli --update-embeddings`

### Core Execution Rules
- **Default Tool**: Gemini for analysis, Codex for development
- **Similarity Threshold**: 0.3 minimum for relevant results
- **Hierarchical Search**: Automatic parent directory vector database discovery
- **Command Pattern**: Always use `pycli` wrapper for consistent interface

## 🎯 Universal Command Template

### Standard Format (REQUIRED)
```bash
# Smart Context Discovery
pycli --analyze --query "
PURPOSE: [clear analysis goal]
SEARCH: [semantic search terms]
TOOL: [gemini/codex/both]
EXPECTED: [expected context and output]
" --tool [gemini/codex]

# Direct Tool Execution
pycli --analyze --tool [gemini/codex] -p "
PURPOSE: [clear execution goal]
TASK: [specific execution task]
CONTEXT: [known file references]
EXPECTED: [expected deliverables]
"
```

### Template Structure
- [ ] **PURPOSE** - Clear goal and intent for analysis
- [ ] **SEARCH/TASK** - Semantic search terms or specific task
- [ ] **TOOL** - Gemini for analysis, Codex for development
- [ ] **CONTEXT** - File references and project context
- [ ] **EXPECTED** - Clear expected results and format

## 📊 Tool Selection Matrix

| Task Type | Command | Use Case | Context Strategy |
|-----------|---------|----------|------------------|
| **Context Discovery** | `pycli --analyze --query` | Code exploration, pattern finding | Vector similarity search |
| **Targeted Analysis** | `pycli --analyze --tool gemini -p` | Architecture review, understanding | Known file analysis |
| **Development** | `pycli --analyze --tool codex -p` | Feature implementation, bug fixes | Smart context + execution |
| **Setup** | `pycli --init` | Project initialization | Vector database creation |
| **Maintenance** | `pycli --update-embeddings` | Index updates after changes | Incremental vectorization |
| **Health Check** | `pycli --status` | System verification | Database validation |

## 🚀 Usage Patterns

### Workflow Integration (REQUIRED)
When planning any coding task, **ALWAYS** integrate Python CLI tools:

1. **Discovery Phase**: Use `pycli --analyze --query` for context
2. **Analysis Phase**: Use Gemini for understanding with smart context
3. **Implementation Phase**: Use Codex for development with relevant files
4. **Validation Phase**: Update embeddings and verify results

### Common Scenarios
```bash
# Project Context Discovery
pycli --analyze --query "
PURPOSE: Understand authentication architecture
SEARCH: authentication patterns, login systems, user management
TOOL: gemini
EXPECTED: Architecture overview and key implementation files
" --tool gemini

# Feature Development with Context
pycli --analyze --query "
PURPOSE: Implement user registration
SEARCH: user creation, validation patterns, database models
TOOL: codex
EXPECTED: Complete registration module with tests
" --tool codex

# Code Quality Analysis
pycli --analyze --query "
PURPOSE: Review error handling patterns
SEARCH: exception handling, error middleware, logging
TOOL: gemini
EXPECTED: Error handling assessment and recommendations
" --tool gemini
```

## 📋 Planning Checklist

For every development task:
- [ ] **Discovery completed** - Context discovery with vector search
- [ ] **Purpose defined** - Clear goal and intent documented
- [ ] **Tool selected** - Gemini for analysis, Codex for development
- [ ] **Context gathered** - Relevant files identified through similarity
- [ ] **Template applied** - Standard command format used
- [ ] **Embeddings updated** - Vector database reflects current state
- [ ] **Results validated** - Output quality and relevance verified

## 🎯 Key Features

### Python CLI (pycli)
- **Command**: `pycli --analyze`
- **Strengths**: Hierarchical vector search, semantic similarity, context discovery
- **Best For**: Intelligent file selection, context-aware analysis, project exploration

### Vector Database
- **Hierarchical**: Automatic parent directory discovery
- **Semantic**: Meaning-based similarity scoring
- **Efficient**: Incremental updates and smart caching
- **Scalable**: Project-wide context with subdirectory support

### Context Patterns
- Query-based: `--query "semantic search terms"`
- Direct prompt: `-p "specific task"`
- Tool selection: `--tool [gemini|codex|both]`
- Similarity control: `--top-k N --similarity-threshold X`

## 🔧 Best Practices

- **Start with discovery** - Use `--query` for context before direct prompts
- **Be semantic** - Use meaning-based search terms, not just keywords
- **Update regularly** - Run `--update-embeddings` after file changes
- **Validate context** - Check similarity scores and relevance before proceeding
- **Document patterns** - Reference successful query patterns for reuse
- **Leverage hierarchy** - Work in subdirectories, let parent DBs provide context

## 📁 Hierarchical Vector System

**Base Structure**: `~/.claude/vector_db/[project-path]/`

### Automatic Discovery
```
Project Structure                Vector Database Usage
/project/                       Creates: ~/.claude/vector_db/project/
├── src/                        → Uses parent DB automatically
│   ├── auth/                   → Uses parent DB automatically
│   └── api/                    → Uses parent DB automatically
└── tests/                      → Uses parent DB automatically
```

### Smart Context Integration
- **Parent Discovery**: Subdirectories automatically use parent vector DB
- **Semantic Search**: Find files by meaning, not just filename patterns
- **Similarity Scoring**: Relevance-based file selection with configurable thresholds
- **Incremental Updates**: Efficient re-indexing of only changed files

### Migration Benefits
```bash
# Enhanced Context Discovery (vs traditional grep/find)
# OLD: find . -name "*auth*" | head -10
# NEW: pycli --analyze --query "authentication patterns" --tool gemini

# OLD: grep -r "login" src/ | head -20
# NEW: pycli --analyze --query "login implementation" --tool codex

# OLD: ~/.claude/scripts/gemini-wrapper -p "analyze auth"
# NEW: pycli --analyze --query "authentication architecture" --tool gemini
```

## 🎯 Quick Setup Guide


### Project Setup (One-time per project)
```bash
# 1. Navigate to project root
cd /path/to/project

# 2. Initialize vector database
pycli --init

# 3. Verify setup
pycli --status
```

### Daily Workflow
```bash
# 1. Update embeddings (after file changes)
pycli --update-embeddings

# 2. Smart context discovery
pycli --analyze --query "your search terms" --tool gemini

# 3. Targeted development
pycli --analyze --query "implementation patterns" --tool codex
```

## 🎪 Decision Framework

```
Need intelligent code analysis?
├─ Know specific files to analyze?
│  ├─ YES → pycli --analyze --tool [gemini/codex] -p "prompt"
│  └─ NO → pycli --analyze --query "semantic search" --tool [gemini/codex]
├─ Vector database updated?
│  ├─ UNSURE → pycli --status
│  ├─ NO → pycli --update-embeddings
│  └─ YES → Proceed with analysis
└─ First time in project?
   └─ Run pycli --init first
```


