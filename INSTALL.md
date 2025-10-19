# Claude Code Workflow (CCW) - Installation Guide

**English** | [中文](INSTALL_CN.md)

Interactive installation guide for Claude Code with Agent workflow coordination and distributed memory system.

## ⚡ One-Line Remote Installation (Recommended)

### All Platforms - Remote PowerShell Installation
```powershell
# Interactive remote installation from feature branch (latest)
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1)

# Global installation with unified file output system
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Global

# Force overwrite (non-interactive) - includes all new workflow file generation features
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Force -NonInteractive

# One-click backup all existing files (no confirmations needed)
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -BackupAll
```

**What the remote installer does:**
- ✅ Checks system requirements (PowerShell version, network connectivity)
- ✅ Downloads latest version from GitHub (main branch)
- ✅ Includes all new unified file output system features
- ✅ Automatically extracts and runs local installer
- ✅ Security confirmation and user prompts
- ✅ Automatic cleanup of temporary files
- ✅ Sets up .workflow/ directory structure for session management

**Note**: Interface is in English for cross-platform compatibility

## 📂 Local Installation

### All Platforms (PowerShell)
```powershell
# Clone the repository with latest features
cd Claude-Code-Workflow

# Windows PowerShell 5.1+ or PowerShell Core (Global installation only)
.\Install-Claude.ps1

# Linux/macOS PowerShell Core (Global installation only)
pwsh ./Install-Claude.ps1
```

**Note**: The feature branch contains all the latest unified file output system enhancements and should be used for new installations.

## Installation Options

### Remote Installation Parameters

All parameters can be passed to the remote installer:

```powershell
# Global installation
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Global

# Install to specific directory  
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Directory "C:\MyProject"

# Force overwrite without prompts
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Force -NonInteractive

# Install from specific branch
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Branch "dev"

# Skip backups (overwrite without backup - not recommended)
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -NoBackup

# Explicit automatic backup all existing files (default behavior since v1.1.0)
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -BackupAll
```

### Local Installation Options

### Global Installation (Default and Only Mode)
Install to user home directory (`~/.claude`):
```powershell
# All platforms - Global installation (default)
.\Install-Claude.ps1

# With automatic backup (default since v1.1.0)
.\Install-Claude.ps1 -BackupAll

# Disable automatic backup (not recommended)
.\Install-Claude.ps1 -NoBackup

# Non-interactive mode for automation
.\Install-Claude.ps1 -Force -NonInteractive
```

**Global installation structure:**
```
~/.claude/
├── agents/
├── commands/
├── output-styles/
├── settings.local.json
└── CLAUDE.md
```

**Note**: Starting from v1.2.0, only global installation is supported. Local directory and custom path installations have been removed to simplify the installation process and ensure consistent behavior across all platforms.

## Advanced Options

### 🛡️ Enhanced Backup Features (v1.1.0+)

The installer now includes **automatic backup as the default behavior** to protect your existing files:

**Backup Modes:**
- **Automatic Backup** (default since v1.1.0): Automatically backs up all existing files without prompts
- **Explicit Backup** (`-BackupAll`): Same as default behavior, explicitly specified for compatibility
- **No Backup** (`-NoBackup`): Disable backup functionality (not recommended)

**Backup Organization:**
- Creates timestamped backup folders (e.g., `claude-backup-20240117-143022`)
- Preserves directory structure within backup folders
- Maintains file relationships and paths

### Force Installation
Overwrite existing files:
```powershell
.\Install-Claude.ps1 -Force
```

### One-Click Backup
Automatically backup all existing files without confirmations:
```powershell
.\Install-Claude.ps1 -BackupAll
```

### Skip Backups
Don't create backup files:
```powershell
.\Install-Claude.ps1 -NoBackup
```

### Uninstall
Remove installation:
```powershell
.\Install-Claude.ps1 -Uninstall -Force
```

## Platform Requirements

### PowerShell (Recommended)
- **Windows**: PowerShell 5.1+ or PowerShell Core 6+
- **Linux**: PowerShell Core 6+
- **macOS**: PowerShell Core 6+

Install PowerShell Core:
- **Ubuntu/Debian**: `sudo apt install powershell`
- **CentOS/RHEL**: `sudo dnf install powershell`
- **macOS**: `brew install powershell`
- **Or download**: https://github.com/PowerShell/PowerShell


## Complete Installation Examples

### ⚡ Super Quick (One-Liner)
```powershell
# Complete installation in one command
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1) -Global

# Done! 🎉
# Start using Claude Code with Agent workflows!
```

### 📂 Manual Installation Method
```powershell
# Manual installation steps:
# 1. Install PowerShell Core (if needed)
# Windows: Download from GitHub
# Linux: sudo apt install powershell
# macOS: brew install powershell

# 2. Download Claude Code Workflow System
git clone https://github.com/catlog22/Claude-CCW.git
cd Dmsflow

# 3. Install globally (interactive)
.\Install-Claude.ps1 -Global

# 4. Start using Claude Code with Agent workflows!
# Use /workflow commands and memory system for development
```

## Prerequisites & Recommended Tools

To unlock the full potential of CCW, installing these additional tools is highly recommended.

### System Tools (Recommended)

These tools enhance file search and data processing capabilities.

-   **`ripgrep` (rg)**: A high-speed code search tool.
    -   **Windows**: `winget install BurntSushi.Ripper.MSVC` or `choco install ripgrep`
    -   **macOS**: `brew install ripgrep`
    -   **Linux**: `sudo apt-get install ripgrep` (Debian/Ubuntu) or `sudo dnf install ripgrep` (Fedora)
    -   **Verify**: `rg --version`

-   **`jq`**: A command-line JSON processor.
    -   **Windows**: `winget install jqlang.jq` or `choco install jq`
    -   **macOS**: `brew install jq`
    -   **Linux**: `sudo apt-get install jq` (Debian/Ubuntu) or `sudo dnf install jq` (Fedora)
    -   **Verify**: `jq --version`

### Model Context Protocol (MCP) Tools (Optional)

MCP tools provide advanced context retrieval from external sources, enhancing the AI's understanding. For installation, please refer to the official documentation for each tool.

| Tool | Purpose | Official Source |
|---|---|---|
| **Exa MCP** | For searching code and the web. | [mcp.js/packages/server-exa](https://github.com/modelcontextprotocol/mcp.js/tree/main/packages/server-exa) |
| **Code Index MCP** | For indexing and searching the local codebase. | [mcp.js/packages/server-code-index](https://github.com/modelcontextprotocol/mcp.js/tree/main/packages/server-code-index) |
| **Chrome DevTools MCP** | For interacting with web pages to extract layout and style information. | [mcp.js/packages/server-chrome-devtools](https://github.com/modelcontextprotocol/mcp.js/tree/main/packages/server-chrome-devtools) |

-   **Prerequisite**: Node.js and npm (or a compatible JavaScript runtime).
-   **Verify**: After installation, check if the servers can be started (consult MCP documentation for details).

### Optional AI CLI Tools

CCW uses wrapper scripts to interact with underlying AI models. For these wrappers to function, the respective CLI tools must be installed and configured on your system.

-   **Gemini CLI**: For analysis, documentation, and exploration.
    -   **Purpose**: Provides access to Google's Gemini models.
    -   **Installation**: Follow the official Google AI documentation to install and configure the Gemini CLI. Ensure the `gemini` command is available in your system's PATH.

-   **Codex CLI**: For autonomous development and implementation.
    -   **Purpose**: Provides access to OpenAI's Codex models for code generation and modification.
    -   **Installation**: Follow the installation instructions for the specific Codex CLI tool used in your environment. Ensure the `codex` command is available in your system's PATH.

-   **Qwen Code**: For architecture and code generation.
    -   **Purpose**: Provides access to Alibaba's Qwen models.
    -   **Installation**: Follow the official Qwen documentation to install and configure their CLI tool. Ensure the `qwen` command is available in your system's PATH.

## Verification

After installation, verify:

1. **Check installation:**
   ```bash
   # Global
   ls ~/.claude
   
   # Local
   ls ./.claude
   ```

2. **Test Claude Code:**
   - Open Claude Code in your project
   - Check that global `.claude` directory is recognized
   - Verify workflow commands and DMS commands are available
   - Test `/workflow` commands for agent coordination
   - Test `/workflow version` to check version information

## Troubleshooting

### PowerShell Execution Policy
If you get execution policy errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Workflow Commands Not Working
- Ensure `.claude` directory exists in your project
- Verify workflow.md and agent files are properly installed
- Check that Claude Code recognizes the configuration

### Permission Errors
- **Windows**: Run as Administrator
- **Linux/macOS**: Use `sudo` if needed for global PowerShell installation

## Support

- **Issues**: [GitHub Issues](https://github.com/catlog22/Claude-CCW/issues)
- **Documentation**: [Main README](README.md)
- **Workflow Documentation**: [.claude/commands/workflow.md](.claude/commands/workflow.md)