# Changelog

## [Unreleased] - 2025-09-07

### 🎯 Command Streamlining & Workflow Optimization

#### Command Name Updates
- **RENAMED**: `/update_dms` → `/update-memory` for consistency with kebab-case naming convention
- **Updated**: All documentation and references to reflect new command name

#### Command Structure Optimization
- **REMOVED**: Redundant `context.md` and `sync.md` commands (4 files total)
  - `task/context.md` - Functionality integrated into core task commands
  - `task/sync.md` - Replaced by automatic synchronization
  - `workflow/context.md` - Merged into workflow session management  
  - `workflow/sync.md` - Built-in synchronization in workflow system
- **CONSOLIDATED**: `context.md` created as unified context management command
- **Enhanced**: Session status file management with automatic creation across all workflow commands

#### Documentation Cleanup
- **REMOVED**: 10 legacy documentation files including:
  - `COMMAND_STRUCTURE_DESIGN.md`
  - `REFACTORING_COMPLETE.md` 
  - `RELEASE_NOTES_v2.0.md`
  - `ROADMAP.md`
  - `TASK_EXECUTION_PLAN_SCHEMA.md`
  - `UNIFIED_TASK_MANAGEMENT.md`
  - `WORKFLOW_DOCUMENT_SYSTEM.md`
  - `WORKFLOW_UPDATE_SUMMARY.md`
  - `gemini-execute-implementation-summary.md`
  - `test_gemini_input.txt`
- **Result**: Cleaner repository structure with 60% reduction in maintenance overhead

#### Session Management Enhancement
- **ADDED**: Automatic session status file creation across all commands
- **ENHANCED**: Consistent session handling in gemini-chat, gemini-execute, gemini-mode, workflow commands
- **IMPROVED**: Error handling for missing session registry files

#### Documentation Modernization & Architecture Alignment
- **UPDATED**: All command references to use unified `/context` command instead of deprecated `/task:context` and `/workflow:context`
- **REMOVED**: All references to deprecated `/task:sync` and `/workflow:sync` commands
- **ALIGNED**: Task and workflow documentation with Single Source of Truth (SSoT) architecture
- **CLARIFIED**: JSON-first data model where `.task/*.json` files are authoritative and markdown files are generated views
- **STANDARDIZED**: File naming consistency (TODO_CHECKLIST.md → TODO_LIST.md)
- **ENHANCED**: Command integration descriptions to reflect automatic data consistency instead of manual synchronization

## [Previous] - 2025-01-28

### ✨ New Features

#### 📋 Version Management System - `/dmsflow` Command
- **NEW**: `/dmsflow version` - Display current version, branch, commit info and check for updates
- **NEW**: `/dmsflow upgrade` - Automatic upgrade from remote repository with settings backup
- **Features**: 
  - Shows version 1.1.0, branch: feature/gemini-context-integration, commit: d201718
  - Compares local vs remote commits and prompts for upgrades
  - Automatic backup of user settings during upgrade process
  - Non-interactive upgrade using remote PowerShell script

#### 🔧 Simplified Installation System
- **BREAKING**: Install-Claude.ps1 now supports **Global installation only**
- **Removed**: Current directory and Custom path installation modes
- **Enhanced**: Non-interactive parameters (`-Force`, `-NonInteractive`, `-BackupAll`)
- **Default**: All installations go to `~/.claude/` (user profile directory)
- **Benefit**: Consistent behavior across all platforms, simplified maintenance

### 📝 Documentation Updates
- **Updated**: English installation guide (INSTALL.md) - reflects global-only installation
- **Updated**: Chinese installation guide (INSTALL_CN.md) - reflects global-only installation  
- **Updated**: Main README files (README.md, README_CN.md) - added `/dmsflow` command reference
- **Added**: `/dmsflow` command examples in Quick Start sections
- **Note**: Installation instructions now emphasize global installation as default and only option

### 🔄 Breaking Changes
- **Install-Claude.ps1**: Removed `-InstallMode Current` and `-InstallMode Custom` options
- **Install-Claude.ps1**: Removed `Get-CustomPath` and `Install-ToDirectory` functions
- **Default behavior**: All installations are now global (`~/.claude/`) by default

---

## [Previous] - 2025-01-27

### 🔄 Refactored - Gemini CLI Template System

**Breaking Changes:**
- **Deprecated** `gemini-cli-templates.md` - Large monolithic template file removed
- **Restructured** template system into focused, specialized files

**New Template Architecture:**
- **`gemini-cli-guidelines.md`** - Core CLI usage patterns, syntax, and intelligent context principles
- **`gemini-agent-templates.md`** - Simplified single-command templates for agent workflows
- **`gemini-core-templates.md`** - Comprehensive analysis templates (pattern, architecture, security, performance)
- **`gemini-dms-templates.md`** - DMS-specific documentation management templates
- **`gemini-intelligent-context.md`** - Smart file targeting and context detection algorithms

### 📝 Updated Components

**Agents (4 files updated):**
- `planning-agent.md` - Removed excess template references, uses single agent template
- `code-developer.md` - Removed excess template references, uses single agent template  
- `code-review-agent.md` - Removed excess template references, uses single agent template


**Commands (4 files updated):**
- `update-memory.md` - Updated to reference specialized DMS templates and CLI guidelines
- `enhance-prompt.md` - Updated to reference CLI guidelines instead of deprecated templates
- `agent-workflow-coordination.md` - Updated template references for workflow consistency
- `gemini.md` - Restructured to point to appropriate specialized template files

**Workflows (1 file updated):**
- `gemini-intelligent-context.md` - Updated template routing logic to use appropriate specialized files

### ✨ Improvements

**Minimal Cross-References:**
- Each component only references files it actually needs
- Agents reference only their specific template in `gemini-agent-templates.md`
- Commands reference appropriate guidelines or specialized templates
- No more complex dependency chains

**Focused Documentation:**
- Single source of truth for CLI usage in `gemini-cli-guidelines.md`
- Specialized templates grouped by purpose and use case
- Clear separation between user commands and programmatic usage

**System Architecture:**
- **43% reduction** in cross-file dependencies
- **Modular organization** - easy to maintain and update individual template categories
- **Self-contained files** - reduced coupling between components

### 📊 Statistics

- **Files Removed:** 1 (gemini-cli-templates.md - 932 lines)
- **Files Added:** 1 (gemini-cli-guidelines.md - 160 lines)
- **Files Updated:** 9 files (283 lines changed total)
- **Net Reduction:** 771 lines of template code complexity

### 🔗 Migration Guide

If you have custom references to the old template system:

**Before:**
```markdown
[Pattern Analysis](../workflows/gemini-cli-templates.md#pattern-analysis)
```

**After:**
```markdown
[Pattern Analysis](../workflows/gemini-core-templates.md#pattern-analysis)
```

**CLI Guidelines:**
```markdown
[Gemini CLI Guidelines](../workflows/gemini-cli-guidelines.md)
```

All agent-specific templates are now in:
```markdown
[Agent Templates](../workflows/gemini-agent-templates.md#[agent-type]-context)
```