---
name: python-tools-strategy
description: Command reference for Python-based tool invocation
type: command-reference
---

# Python Tools Command Reference

## ⚡ Quick Commands

**Smart Analysis**: `pycli --analyze --query "search term" --tool [gemini/codex]`
**Direct Tool Invocation**: `pycli --analyze --tool [gemini/codex] -p "prompt"`
**Vector Database Setup**: `pycli --init`
**Vector Database Update**: `pycli --update-embeddings`

## ⏰ When to Use What

### 🔄 Vector Database Timing
```bash
# FIRST TIME (run once per project)
pycli --init

# DAILY (when files change)
pycli --update-embeddings

# BEFORE ANALYSIS (check status)
pycli --status
```

### 🎯 Tool Selection Timing
- **Code Discovery** → Use `pycli --analyze --query` to find relevant files
- **Direct Analysis** → Use `pycli --analyze -p` when you know what to analyze
- **Development** → Use `--tool codex` for implementation tasks
- **Understanding** → Use `--tool gemini` for analysis and exploration

## 🎯 Core Commands

### Smart Analysis (Recommended)
```bash
# Find similar code patterns and analyze
pycli --analyze --query "authentication patterns" --tool gemini

# Search with development context
pycli --analyze --query "error handling" --tool codex

# Both discovery and analysis
pycli --analyze --query "database connections" --tool both
```

### Direct Tool Invocation
```bash
# Direct analysis with known context
pycli --analyze --tool gemini -p "analyze authentication patterns"

# Direct development task
pycli --analyze --tool codex -p "implement user login"

# Status and testing
pycli --status
pycli --test-search
```

### Vector Database Operations
```bash
# Initial setup (run once per project)
pycli --init

# Daily updates (run when files change)
pycli --update-embeddings

# Status check
pycli --status
```

## 📊 Command Matrix

| What You Want | Command | Use Case |
|---------------|---------|----------|
| **Smart analysis** | `pycli --analyze --query "pattern" --tool gemini` | Code discovery & analysis |
| **Direct analysis** | `pycli --analyze --tool gemini -p "prompt"` | Known target analysis |
| **Generate code** | `pycli --analyze --tool codex -p "task"` | Development |
| **Setup project** | `pycli --init` | First time setup |
| **Update search index** | `pycli --update-embeddings` | Maintenance |
| **Check status** | `pycli --status` | System health |

## 🚀 Usage Examples

### Replace Gemini Wrapper
```bash
# OLD: ~/.claude/scripts/gemini-wrapper -p "analyze auth patterns"
# NEW: pycli --analyze --tool gemini -p "analyze auth patterns"
```

### Replace Codex Commands
```bash
# OLD: codex --full-auto exec "implement login"
# NEW: pycli --analyze --tool codex -p "implement login"
```

### Smart Context Discovery
```bash
# Find relevant files first, then analyze
pycli --analyze --query "user authentication" --tool gemini

# Results include:
# - Hierarchical vector database search
# - Semantically similar files from project and parent directories
# - Generated tool command with intelligent context
# - Executed analysis with smart file selection
```

## 🔧 Command Options

### pycli (Unified Interface)
```bash
pycli [command] [options]

Commands:
  --init                Initialize vector database for current project
  --analyze             Run analysis with AI tools
  --status              Show system status and health
  --test-search         Test vector search functionality
  --update-embeddings   Update vector embeddings for changed files

Analysis Options:
  --tool [gemini|codex|both]   Which AI tool to use (default: gemini)
  -p, --prompt TEXT            Direct prompt for analysis
  --query TEXT                 Semantic search query for context discovery
  --top-k INTEGER              Number of similar files to find (default: 10)
  --similarity-threshold FLOAT Minimum similarity score (0.0-1.0)

Output Options:
  --quiet                      Suppress progress output
  --verbose                    Show detailed analysis information
  --output [patterns|json]     Output format (default: patterns)
```

### Installation & Setup
```bash
# Install pycli system
bash D:/Claude_dms3/.claude/scripts/install_pycli.sh

# Add to shell (automatic during install)
alias pycli='~/.claude/scripts/pycli'

# Verify installation
pycli --help
```

## 📋 Common Workflows

### 🚀 First-Time Setup (Vector Database)
```bash
# 1. Install pycli system
bash D:/Claude_dms3/.claude/scripts/install_pycli.sh

# 2. Initialize vector database for project
cd /path/to/your/project
pycli --init

# 3. Verify setup works
pycli --status

# 4. Test search functionality
pycli --test-search
```

### 🎯 Analysis Workflow (Recommended)
```bash
# 1. Update vectors (if files changed)
pycli --update-embeddings

# 2. Smart analysis with context discovery
pycli --analyze --query "what you're looking for" --tool gemini

# 3. Development with context
pycli --analyze --query "related patterns" --tool codex
```

### ⏰ When to Run Commands

#### 🔄 Vector Database Maintenance
```bash
# WHEN: First time using system
pycli --init

# WHEN: Files have been added/modified (daily/after coding)
pycli --update-embeddings

# WHEN: Before starting analysis (check if system ready)
pycli --status
```

#### 🎯 Analysis Timing
```bash
# WHEN: You need to find relevant code patterns
pycli --analyze --query "search term" --tool gemini

# WHEN: You have specific prompt and know context
pycli --analyze --tool gemini -p "specific prompt"

# WHEN: You want to develop/implement something
pycli --analyze --query "similar implementations" --tool codex
```

### Integration with Existing Tools
```bash
# In place of gemini-wrapper
pycli --analyze --tool gemini -p "$YOUR_PROMPT"

# In place of codex commands
pycli --analyze --tool codex -p "$YOUR_TASK"

# Enhanced with hierarchical context discovery
pycli --analyze --query "relevant context" --tool both
```

## 🎯 Quick Reference

### 🚀 Most Common Commands
```bash
# 1. Smart analysis (recommended first choice)
pycli --analyze --query "what you're looking for" --tool gemini

# 2. Direct tool call (when you know exactly what to analyze)
pycli --analyze --tool codex -p "what you want to do"

# 3. Keep embeddings updated (run after file changes)
pycli --update-embeddings
```

### ⚙️ Configuration (config.yaml)
```yaml
# Essential settings only
embeddings:
  enabled: true
  similarity_threshold: 0.3

tools:
  default_tool: "gemini"
  timeout: 300
```

### 🐛 Troubleshooting
```bash
# Check if everything works
pycli --status

# Rebuild if issues
pycli --init

# Test search functionality
pycli --test-search
```

## 🎪 Integration Decision Tree

```
Need to analyze code?
├─ Do you know specific files to analyze?
│  ├─ YES → Use: pycli --analyze --tool [gemini/codex] -p "prompt"
│  └─ NO → Use: pycli --analyze --query "search term" --tool [gemini/codex]
└─ Is vector database updated?
   ├─ UNSURE → Run: pycli --status
   ├─ NO → Run: pycli --update-embeddings
   └─ YES → Proceed with analysis
```

## 🏗️ Hierarchical Vector Database

### Key Features
- **Automatic Parent Discovery**: Subdirectories automatically use parent's vector database
- **No Redundant Vectorization**: Avoids duplicate processing in project subdirectories
- **Central Storage**: All vector databases stored in `~/.claude/vector_db/`
- **Path-based Organization**: Vector DBs organized by project directory structure

### How It Works
```bash
# Project structure
/home/user/myproject/
├── src/
│   └── auth/          # Uses parent's vector DB
└── tests/             # Uses parent's vector DB

# Vector database structure
~/.claude/vector_db/
└── home_user_myproject/    # Single DB for entire project
    ├── embeddings.pkl
    └── index.json
```

### Usage Examples
```bash
# Initialize at project root
cd /home/user/myproject
pycli --init

# Work in subdirectory (automatically finds parent DB)
cd src/auth
pycli --analyze --query "authentication patterns"  # Uses parent's DB

# Work in another subdirectory
cd ../../tests
pycli --analyze --query "test patterns"  # Uses same parent DB
```

## 🔧 Vector Database Setup & Maintenance

### ⚡ One-Time System Setup
```bash
# 1. Install dependencies (first time only)
cd .claude/python_script && pip install -r requirements.txt

# 2. Initialize vector database (creates embeddings)
python indexer.py --rebuild-index --update-embeddings

# 3. Verify setup works
python cli.py --status

# 4. Test search functionality
python cli.py --test-search
```

### 📋 What Happens During Setup
1. **File Indexing**: Scans project files and creates index
2. **Model Download**: Downloads AI model (first time only, ~500MB)
3. **Embedding Generation**: Creates vector representations of code
4. **Cache Creation**: Saves embeddings to `.claude/cache/embeddings/`

### 🎯 Verification Checklist
After setup, verify these work:
- [ ] `python cli.py --status` shows "System ready"
- [ ] `python cli.py --test-search` returns results
- [ ] Files exist: `.claude/cache/embeddings/embeddings.pkl`
- [ ] Search works: `python analyzer.py --query "test"`

### 🐛 Common Issues & Fixes

#### Nothing works / Setup failed
```bash
# Nuclear option - reset everything
rm -rf .claude/cache/embeddings/*
python indexer.py --rebuild-index --update-embeddings
```

#### Slow performance
```yaml
# In config.yaml - reduce batch size
embeddings:
  batch_size: 16
```

#### No search results found
```yaml
# In config.yaml - lower similarity threshold
embeddings:
  similarity_threshold: 0.1
```

#### Memory errors during setup
```yaml
# In config.yaml - use smaller batches
embeddings:
  batch_size: 8
```

#### Model download fails
```bash
# Manual model download
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

## 📋 Usage Rules & Best Practices

### 🎯 Core Rules

1. **Always check status first** - Run `python cli.py --status` before analysis
2. **Update after file changes** - Run `indexer.py --update-embeddings` when files modified
3. **Use vector search for discovery** - Use `analyzer.py --query` when exploring code
4. **Use direct tools for known targets** - Use `cli.py --analyze` for specific analysis
5. **Prefer context-aware tools** - Enhanced Python tools over legacy shell scripts

### ⏰ Maintenance Schedule

```bash
# DAILY (or after coding sessions)
python .claude/python_script/indexer.py --update-embeddings

# WEEKLY (or when config changes)
python .claude/python_script/cli.py --status  # Check system health

# MONTHLY (or after major project changes)
python .claude/python_script/indexer.py --rebuild-index --update-embeddings
```

### 🎯 Tool Selection Rules

#### Use `cli.py --analyze --query` when:
- ✅ Exploring unfamiliar codebase
- ✅ Looking for similar code patterns
- ✅ Need context discovery for complex tasks
- ✅ Want smart file selection for tool execution

#### Use `cli.py --analyze -p` when:
- ✅ You know exactly what files to analyze
- ✅ Direct prompt execution without context search
- ✅ Quick tool invocation with known targets

#### Use `indexer.py` when:
- ✅ First time setup
- ✅ Files have been added/modified
- ✅ System performance degraded
- ✅ Configuration changed

### 🔧 Configuration Guidelines

#### Minimal config.yaml
```yaml
embeddings:
  enabled: true
  similarity_threshold: 0.3
  model: "all-MiniLM-L6-v2"
  batch_size: 32

tools:
  default_tool: "gemini"
  timeout: 300
```

#### Performance tuning
```yaml
# Large codebase (>1000 files)
embeddings:
  batch_size: 64
  similarity_threshold: 0.4

# Memory constrained
embeddings:
  batch_size: 16
  similarity_threshold: 0.2

# High accuracy needed
embeddings:
  model: "all-mpnet-base-v2"
  similarity_threshold: 0.5
```

### 🚀 Migration from Legacy Tools

#### Replace gemini-wrapper
```bash
# OLD (shell-based)
~/.claude/scripts/gemini-wrapper -p "analyze authentication"

# NEW (Python-based with hierarchical vector context)
pycli --analyze --query "authentication" --tool gemini
```

#### Replace codex commands
```bash
# OLD (direct execution)
codex --full-auto exec "implement user login"

# NEW (context-aware development with hierarchical DB)
pycli --analyze --query "login implementation patterns" --tool codex
```

#### Integration workflow
1. **Install pycli** - Run installation script once
2. **Initialize projects** - Run `pycli --init` in each project root
3. **Replace commands** - Update scripts to use `pycli` instead of direct Python calls
4. **Enjoy hierarchical benefits** - Automatic parent DB discovery in subdirectories

## 🎉 Advanced Features

### Bash Wrapper Benefits
- **Unified Interface**: Single `pycli` command for all operations
- **Smart Path Detection**: Automatically finds project roots and vector databases
- **Environment Management**: Configurable Python interpreter path
- **Hierarchical Support**: Intelligent parent directory discovery

### Configuration Flexibility
```bash
# Edit pycli configuration
nano ~/.claude/scripts/pycli.conf

# Key settings:
# PYTHON_PATH - Python interpreter location
# VECTOR_DB_ROOT - Central vector database storage
# HIERARCHICAL_MODE - Enable parent DB discovery
```

### Integration Examples
```bash
# Add to your project's package.json scripts
{
  "scripts": {
    "analyze": "pycli --analyze --query",
    "init-ai": "pycli --init",
    "update-ai": "pycli --update-embeddings"
  }
}

# Use in Makefiles
analyze:
	pycli --analyze --query "$(QUERY)" --tool gemini

# Use in CI/CD pipelines
- name: Update AI Context
  run: pycli --update-embeddings
```