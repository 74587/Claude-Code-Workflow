# pycli - Python CLI Wrapper with Hierarchical Vector Database

This directory contains the bash wrapper and configuration for the enhanced Python-based analysis CLI with hierarchical vector database support.

## 📁 Files

- **`pycli`** - Main bash wrapper script
- **`pycli.conf`** - Configuration file
- **`install_pycli.sh`** - Installation script
- **`README.md`** - This documentation

## 🚀 Quick Installation

```bash
# Run the installation script
bash install_pycli.sh

# Follow the prompts to configure your shell
# The script will automatically detect your Python installation

# Verify installation
pycli --help
```

## 🎯 Key Features

### Hierarchical Vector Database
- **Smart Parent Discovery**: Subdirectories automatically use parent's vector database
- **No Redundant Processing**: Avoids duplicate vectorization in project subdirectories
- **Central Storage**: All vector databases stored in `~/.claude/vector_db/`
- **Path-based Organization**: Organized by project directory structure

### Unified Interface
- **Single Command**: `pycli` replaces complex Python script calls
- **Intelligent Context**: Automatic file discovery with semantic search
- **Tool Integration**: Seamless integration with Gemini and Codex
- **Configuration Management**: Environment-specific Python interpreter paths

## 📋 Common Commands

```bash
# Initialize new project
cd /path/to/your/project
pycli --init

# Smart analysis
pycli --analyze --query "authentication patterns" --tool gemini

# Direct analysis
pycli --analyze --tool codex -p "implement user login"

# Maintenance
pycli --update-embeddings
pycli --status
```

## 🔧 Configuration

Edit `~/.claude/scripts/pycli.conf` after installation:

```bash
# Python interpreter path
PYTHON_PATH="/usr/bin/python3"

# Vector database root directory
VECTOR_DB_ROOT="$HOME/.claude/vector_db"

# Python scripts directory
PYTHON_SCRIPT_DIR="$HOME/.claude/python_script"
```

## 🏗️ How Hierarchical DB Works

```
Project Structure:          Vector Database:
/home/user/myproject/       ~/.claude/vector_db/
├── src/                    └── home_user_myproject/
│   ├── auth/                   ├── embeddings.pkl
│   └── api/                    └── index.json
└── tests/

# All subdirectories use the single parent DB
```

## 📖 Documentation

For complete usage information, see:
- **Strategy Guide**: `~/.claude/workflows/python-tools-strategy.md`
- **Installation Guide**: Run `bash install_pycli.sh` for guided setup

## 🎪 Migration from Legacy Tools

```bash
# Replace gemini-wrapper
# OLD: ~/.claude/scripts/gemini-wrapper -p "prompt"
# NEW: pycli --analyze --tool gemini -p "prompt"

# Replace codex commands
# OLD: codex --full-auto exec "task"
# NEW: pycli --analyze --tool codex -p "task"

# Enhanced with context discovery
pycli --analyze --query "relevant context" --tool both
```

## 🐛 Troubleshooting

```bash
# Check system status
pycli --status

# Rebuild everything
pycli --init

# Test search functionality
pycli --test-search

# View configuration
cat ~/.claude/scripts/pycli.conf
```

## 💡 Advanced Usage

### Project Integration
```bash
# Add to package.json
{
  "scripts": {
    "analyze": "pycli --analyze --query",
    "ai-init": "pycli --init",
    "ai-update": "pycli --update-embeddings"
  }
}

# Use in Makefiles
analyze:
	pycli --analyze --query "$(QUERY)" --tool gemini
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Update AI Context
  run: pycli --update-embeddings

- name: Analyze Changes
  run: pycli --analyze --query "code review" --tool gemini
```

---

For questions or issues, check the documentation or run `pycli --help`.