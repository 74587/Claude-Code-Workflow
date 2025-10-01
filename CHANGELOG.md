# Changelog

All notable changes to Claude Code Workflow (CCW) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.1] - 2025-10-01

### 🔧 Command Updates

#### Changed
- **Brainstorming Roles**: Removed `test-strategist` and `user-researcher` roles
  - `test-strategist` functionality integrated into automated test generation (`/workflow:test-gen`)
  - `user-researcher` functionality consolidated into `ux-expert` role
- **Available Roles**: Updated to 8 core roles for focused, efficient brainstorming
  - 🏗️ System Architect
  - 🗄️ Data Architect
  - 🎓 Subject Matter Expert
  - 📊 Product Manager
  - 📋 Product Owner
  - 🏃 Scrum Master
  - 🎨 UI Designer
  - 💫 UX Expert

### 📚 Documentation

#### Improved
- **README Optimization**: Streamlined README.md and README_CN.md by 81% (from ~750 lines to ~140 lines)
- **Better Structure**: Reorganized content with clearer sections and improved navigation
- **Quick Start Guide**: Added immediate usability guide for new users
- **Simplified Command Reference**: Consolidated command tables for easier reference
- **Maintained Essential Information**: Preserved all installation steps, badges, links, and critical functionality

#### Benefits
- **Faster Onboarding**: New users can get started in minutes with the Quick Start section
- **Reduced Cognitive Load**: Less verbose documentation with focused, actionable information
- **Consistent Bilingual Structure**: English and Chinese versions now have identical organization
- **Professional Presentation**: Cleaner, more modern documentation format

---

## [3.0.0] - 2025-09-30

### 🚀 Major Release - Unified CLI Command Structure

This is a **breaking change release** introducing a unified CLI command structure.

#### Added
- **Unified CLI Commands**: New `/cli:*` command set consolidating all tool interactions
- **Tool Selection Flag**: Use `--tool <gemini|qwen|codex>` to select AI tools
- **Command Verification**: Comprehensive workflow guide and command validation
- **MCP Tools Integration** *(Experimental)*: Enhanced codebase analysis through Model Context Protocol

#### Changed
- **BREAKING**: Tool-specific commands (`/gemini:*`, `/qwen:*`, `/codex:*`) deprecated
- **Command Structure**: All CLI commands now use unified `/cli:*` prefix
- **Default Tool**: Commands default to `gemini` when `--tool` flag not specified

#### Migration
| Old Command (v2) | New Command (v3.0.0) |
|---|---|
| `/gemini:analyze "..."` | `/cli:analyze "..."` |
| `/qwen:analyze "..."` | `/cli:analyze "..." --tool qwen` |
| `/codex:chat "..."` | `/cli:chat "..." --tool codex` |

---

## [2.0.0] - 2025-09-28

### 🚀 Major Release - Architectural Evolution

This is a **breaking change release** with significant architectural improvements and new capabilities.

### Added

#### 🏗️ Four-Layer Architecture
- **Interface Layer**: CLI Commands with Gemini/Codex/Qwen Wrappers
- **Session Layer**: Atomic session management with `.active-[session]` markers
- **Task/Data Layer**: JSON-first model with `.task/impl-*.json` hierarchy
- **Orchestration Layer**: Multi-agent coordination and dependency resolution

#### 🔄 Enhanced Workflow Lifecycle
- **6-Phase Development Process**: Brainstorm → Plan → Verify → Execute → Test → Review
- **Quality Gates**: Validation at each phase transition
- **Multi-perspective Planning**: Role-based brainstorming with synthesis

#### 🧪 Automated Test Generation
- **Implementation Analysis**: Scans completed IMPL-* tasks
- **Multi-layered Testing**: Unit, Integration, E2E, Performance, Security
- **Specialized Agents**: Dedicated test agents for different test types
- **Dependency Mapping**: Test execution follows implementation chains

#### ✅ Plan Verification System
- **Dual-Engine Validation**: Gemini (strategic) + Codex (technical) analysis
- **Cross-Validation**: Conflict detection between vision and constraints
- **Pre-execution Recommendations**: Actionable improvement suggestions

#### 🧠 Smart Tech Stack Detection
- **Intelligent Loading**: Only for development and code review tasks
- **Multi-Language Support**: TypeScript, React, Python, Java, Go, JavaScript
- **Performance Optimized**: Skips detection for non-relevant tasks
- **Context-Aware Development**: Applies appropriate tech stack principles

#### 🔮 Qwen CLI Integration
- **Architecture Analysis**: System design patterns and code quality
- **Code Generation**: Implementation scaffolding and components
- **Intelligent Modes**: Auto template selection and precise planning
- **Full Command Suite**: analyze, chat, execute, mode:auto, mode:bug-index, mode:plan

#### 🏷️ Issue Management Commands
- `/workflow:issue:create` - Create new project issues with priority/type
- `/workflow:issue:list` - List and filter issues by status/assignment
- `/workflow:issue:update` - Update existing issue status and assignments
- `/workflow:issue:close` - Close completed issues with resolution

#### 📋 Enhanced Workflow Commands
- `/workflow:plan-verify` - Pre-execution validation using dual analysis
- `/workflow:test-gen` - Generate comprehensive test workflows
- `/workflow:brainstorm:artifacts` - Generate structured planning documents
- `/workflow:plan-deep` - Deep technical planning with Gemini analysis

#### 🔧 Technical Improvements
- **Enhanced Scripts**: Improved gemini-wrapper and qwen-wrapper
- **Cross-Platform**: Windows path compatibility with proper quoting
- **Directory Navigation**: Intelligent context optimization
- **Flow Control**: Sequential execution with context accumulation
- **Agent Enhancements**: Smart context assessment and error handling

### Changed

#### 📚 Documentation Overhaul
- **README.md**: Updated to v2.0 with four-layer architecture
- **README_CN.md**: Chinese documentation aligned with v2.0 features
- **Unified Structure**: Consistent sections across language versions
- **Command Standardization**: Unified syntax and naming conventions

#### 🔄 Command Syntax Updates
- **Session Commands**: `/workflow:session list` → `/workflow:session:list`
- **File Naming**: Standardized to lowercase `.task/impl-*.json`
- **Session Markers**: Unified format `.active-[session]`

#### 🏗️ Architecture Improvements
- **JSON-First Data Model**: Single source of truth for all workflow state
- **Atomic Session Management**: Marker-based with zero-overhead switching
- **Task Hierarchy**: Standardized structure with intelligent decomposition

### Removed

#### ⚠️ BREAKING CHANGES
- **Python CLI Backend**: Removed all `pycli` references and components
- **Deprecated Scripts**:
  - `install_pycli.sh`
  - `pycli` and `pycli.conf`
  - `tech-stack-loader.sh`
  - Legacy path reading scripts
- **Obsolete Documentation**: Python backend references in READMEs
- **v1.3 Release Documentation**: Removed erroneous v1.3.0 release files and tags

### Fixed

#### 🐛 Bug Fixes & Consistency
- **Duplicate Content**: Removed duplicate "Automated Test Generation" sections
- **Script Entries**: Fixed duplicate get_modules_by_depth.sh references
- **File Path Inconsistencies**: Standardized case sensitivity
- **Command Syntax**: Unified command naming across documentation
- **Cross-Language Alignment**: Synchronized English and Chinese versions

### Security

#### 🔒 Security Enhancements
- **Approval Modes**: Enhanced control over automatic execution
- **YOLO Permissions**: Clear documentation of autonomous execution risks
- **Context Isolation**: Improved session management for concurrent workflows

---

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

---

## Migration Guides

### From v1.x to v2.0

**⚠️ Breaking Changes**: This is a major version with breaking changes.

1. **Update CLI Configuration**:
   ```bash
   # Required Gemini CLI settings
   echo '{"contextFileName": "CLAUDE.md"}' > ~/.gemini/settings.json
   ```

2. **Clean Legacy Components**:
   ```bash
   # Remove Python CLI references
   rm -f .claude/scripts/pycli*
   rm -f .claude/scripts/install_pycli.sh
   ```

3. **Update Command Syntax**:
   ```bash
   # Old: /workflow:session list
   # New: /workflow:session:list
   ```

4. **Verify Installation**:
   ```bash
   /workflow:session:list
   ```

### Configuration Requirements

**Required Dependencies**:
- Git (version control)
- Node.js (for Gemini CLI)
- Python 3.8+ (for Codex CLI)
- Qwen CLI (for architecture analysis)

**System Requirements**:
- OS: Windows 10+, Ubuntu 18.04+, macOS 10.15+
- Memory: 512MB minimum, 2GB recommended
- Storage: ~50MB core + project data

---

## Support & Resources

- **Repository**: https://github.com/catlog22/Claude-Code-Workflow
- **Issues**: https://github.com/catlog22/Claude-Code-Workflow/issues
- **Wiki**: https://github.com/catlog22/Claude-Code-Workflow/wiki
- **Discussions**: https://github.com/catlog22/Claude-Code-Workflow/discussions

---

*This changelog follows [Keep a Changelog](https://keepachangelog.com/) format and [Semantic Versioning](https://semver.org/) principles.*