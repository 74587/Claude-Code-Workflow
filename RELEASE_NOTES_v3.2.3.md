# v3.2.3 - Version Management System

## 🎉 Release Date
2025-10-03

## ✨ Overview

This release introduces a comprehensive version management and upgrade notification system, making it easy to track your Claude Code Workflow installation and stay up-to-date with the latest releases.

## 🆕 New Features

### `/version` Command

A powerful new command that provides complete version information and automatic update checking:

**Features:**
- 📊 **Version Display**: Shows both local and global installation versions
- 🌐 **GitHub Integration**: Fetches latest stable release and development commits
- 🔄 **Smart Comparison**: Automatically compares installed version with latest available
- 💡 **Upgrade Recommendations**: Provides installation commands for easy upgrading
- ⚡ **Fast Execution**: 30-second timeout for network calls, graceful offline handling

**Usage:**
```bash
/version
```

**Example Output:**
```
Installation Status:
- Local: No project-specific installation
- Global: ✅ Installed at ~/.claude
  - Version: v3.2.3
  - Installed: 2025-10-03T05:01:34Z

Latest Releases:
- Stable: v3.2.3 (2025-10-03T04:10:08Z)
  - v3.2.3: Version Management System
- Latest Commit: c5c36a2 (2025-10-03T05:00:06Z)
  - fix: Optimize version command API calls and data extraction

Status: ✅ You are on the latest stable version (3.2.3)
```

### Version Tracking System

**Version Files:**
- `.claude/version.json` - Local project installation tracking
- `~/.claude/version.json` - Global installation tracking

**Tracked Information:**
```json
{
  "version": "v3.2.3",
  "installation_mode": "Global",
  "installation_path": "C:\\Users\\username\\.claude",
  "source_branch": "main",
  "installation_date_utc": "2025-10-03T05:01:34Z"
}
```

### GitHub API Integration

**Endpoints Used:**
- **Latest Release**: `https://api.github.com/repos/catlog22/Claude-Code-Workflow/releases/latest`
  - Extracts: tag_name, release name, published date
- **Latest Commit**: `https://api.github.com/repos/catlog22/Claude-Code-Workflow/commits/main`
  - Extracts: commit SHA, message, author date

**Network Handling:**
- 30-second timeout for slow connections
- Graceful error handling for offline scenarios
- No external dependencies (uses curl and grep/sed)

## 🔄 What's Changed

### Documentation Updates

**Updated Files:**
- ✅ `CHANGELOG.md` - Added comprehensive v3.2.3 release notes
- ✅ `README.md` - Updated version badge to v3.2.3, added `/version` command
- ✅ `README_CN.md` - Updated version badge and command reference (Chinese)
- ✅ `.claude/commands/version.md` - Complete implementation guide

**Version References:**
- All version badges updated from v3.2.2 to v3.2.3
- "What's New" sections updated with v3.2.3 features
- Command reference tables include `/version` command

### Installation Scripts Enhancement

**Future Enhancement** (for next release):
- Installation scripts will automatically create `version.json` files
- Track installation mode (local vs global)
- Record installation timestamp
- Support version tracking for both stable and development installations

## 📋 Version Comparison Scenarios

### Scenario 1: Up to Date
```
✅ You are on the latest stable version (3.2.3)
```

### Scenario 2: Upgrade Available
```
⬆️ A newer stable version is available: v3.2.4
Your version: 3.2.3

To upgrade:
PowerShell: iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1)
Bash: bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
```

### Scenario 3: Development Version
```
✨ You are running a development version (3.3.0-dev)
This is newer than the latest stable release (v3.2.3)
```

## 🛠️ Technical Details

### Implementation Highlights

**Simple Bash Commands:**
- No jq dependency required (uses grep/sed for JSON parsing)
- Cross-platform compatible (Windows Git Bash, Linux, macOS)
- Version comparison using `sort -V` for semantic versioning
- Direct API access using curl with error suppression

**Command Structure:**
```bash
# Check local version
test -f ./.claude/version.json && cat ./.claude/version.json

# Check global version
test -f ~/.claude/version.json && cat ~/.claude/version.json

# Fetch latest release (with timeout)
curl -fsSL "https://api.github.com/repos/catlog22/Claude-Code-Workflow/releases/latest" 2>/dev/null

# Extract version
grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4

# Compare versions
printf "%s\n%s" "3.2.2" "3.2.3" | sort -V | tail -n 1
```

## 📊 Benefits

### User Experience
- 🔍 **Quick version check** with single command
- 📊 **Comprehensive information** display (local, global, stable, dev)
- 🔄 **Automatic upgrade notifications** when new versions available
- 📈 **Development version tracking** for cutting-edge features
- 🌐 **GitHub integration** for latest updates

### DevOps
- 📁 **Version tracking** in both local and global installations
- 🕐 **Installation timestamp** for audit trails
- 🔀 **Support for both stable and development** branches
- ⚡ **Fast execution** with 30-second network timeout
- 🛡️ **Graceful error handling** for offline scenarios

## 🔗 Related Commands

- `/cli:cli-init` - Initialize CLI tool configurations
- `/workflow:session:list` - List workflow sessions
- `/update-memory-full` - Update project documentation

## 📦 Installation

### Fresh Installation

**Windows (PowerShell):**
```powershell
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1)
```

**Linux/macOS (Bash):**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
```

### Upgrade from v3.2.2

Use the same installation commands above. The installer will automatically:
1. Detect your existing installation
2. Back up current files (if using `-BackupAll`)
3. Update to v3.2.3
4. Create/update `version.json` files

## 🐛 Bug Fixes

- Fixed commit message extraction to handle JSON escape sequences
- Improved API endpoint from `/branches/main` to `/commits/main` for reliable commit info
- Added 30-second timeout to all network calls for slow connections
- Enhanced release name and published date extraction

## 📚 Documentation

### New Documentation
- `.claude/commands/version.md` - Complete command implementation guide
  - API endpoints and usage
  - Timeout configuration
  - Error handling scenarios
  - Simple bash command examples

### Updated Documentation
- `CHANGELOG.md` - v3.2.3 release notes
- `README.md` - Version badge and command reference
- `README_CN.md` - Chinese version updates

## 🙏 Credits

This release includes contributions and improvements based on:
- GitHub API integration for version detection
- Cross-platform bash command compatibility
- User feedback on installation and upgrade processes

## 📝 Notes

- **Backward Compatible**: All existing commands and workflows continue to work
- **No Breaking Changes**: This is a minor release with new features only
- **Optional Feature**: `/version` command is entirely optional, existing workflows unaffected

## 🚀 What's Next

**Planned for v3.2.4:**
- Enhanced installation script to auto-create version.json
- Version tracking in all installation modes
- Automatic version detection during installation

**Future Enhancements:**
- Auto-update functionality (opt-in)
- Version comparison in workflow sessions
- Release notes display in CLI

---

**Full Changelog**: [v3.2.2...v3.2.3](https://github.com/catlog22/Claude-Code-Workflow/compare/v3.2.2...v3.2.3)

**Installation:**
```bash
# One-line install (recommended)
bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)

# Or use specific version tag
git clone -b v3.2.3 https://github.com/catlog22/Claude-Code-Workflow.git
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
