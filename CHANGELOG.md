# Changelog

All notable changes to Claude Code Workflow (CCW) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.1] - 2025-10-04

### 🎯 Multi-Tool Support for Documentation Updates

This release adds flexible tool selection for CLAUDE.md documentation generation, allowing users to choose between Gemini, Qwen, or Codex based on their analysis needs.

#### Added

**Multi-Tool Support**:
- **`/update-memory-full --tool <gemini|qwen|codex>`**: Choose tool for full project documentation update
- **`/update-memory-related --tool <gemini|qwen|codex>`**: Choose tool for context-aware documentation update
- **Default**: Gemini (documentation generation, pattern recognition)
- **Qwen**: Architecture analysis, system design documentation
- **Codex**: Implementation validation, code quality analysis

**Script Enhancement** (`update_module_claude.sh`):
- Added third parameter for tool selection: `<module_path> [update_type] [tool]`
- Support for three tools with consistent parameter syntax:
  - `gemini --all-files --yolo -p` (default)
  - `qwen --all-files --yolo -p` (direct command, no wrapper)
  - `codex --full-auto exec` (with danger-full-access)
- Automatic tool routing via case statement
- Improved logging with tool information display

#### Changed

**Command Documentation**:
- Updated `/update-memory-full.md` with tool selection usage and examples
- Updated `/update-memory-related.md` with tool selection usage and examples
- Added tool selection strategy and rationale documentation

#### Technical Details

**Tool Execution Patterns**:
```bash
# Gemini (default)
gemini --all-files --yolo -p "$prompt"

# Qwen (architecture analysis)
qwen --all-files --yolo -p "$prompt"

# Codex (implementation validation)
codex --full-auto exec "$prompt" --skip-git-repo-check -s danger-full-access
```

**Backward Compatibility**:
- ✅ Existing commands without `--tool` parameter default to Gemini
- ✅ All three tools support Layer 1-4 template system
- ✅ No breaking changes to existing workflows

## [3.3.0] - 2025-10-04

### 🚀 CLI Tool Enhancements & Codex Multi-Step Execution

This release streamlines CLI tool documentation and introduces automated multi-step task execution with Codex.

#### Added

**New Command: `/cli:codex-execute`**:
- **Purpose**: Automated task decomposition and sequential execution with Codex
- **Features**:
  - Automatic task breakdown into 3-8 manageable subtasks
  - Sequential execution using `codex exec "..." resume --last` mechanism
  - TodoWrite progress tracking for each subtask
  - Optional Git verification after each subtask (`--verify-git` flag)
  - Supports both freeform descriptions and workflow task IDs
  - Automatic detection and loading of task JSON files
  - Context continuity across subtasks via resume mechanism
  - Integration with workflow system (optional)

**Codex Resume Mechanism**:
- **First Subtask**: Creates new Codex session with `codex exec`
- **Subsequent Subtasks**: Continues with `codex exec "..." resume --last`
- **Benefits**:
  - Session memory preserves previous decisions
  - Maintains implementation style consistency
  - Avoids redundant context re-injection
  - Enables incremental testing and validation

**Enhanced Codex Agent Configuration** (`.codex/AGENTS.md`):
- Added multi-task prompt format (Single-Task & Multi-Task)
- Enhanced MODE: auto with subtask execution flow
- New "Multi-Step Task Execution" section with:
  - Context continuity best practices
  - Subtask coordination guidelines
  - Example 3-subtask workflow demonstration
- Updated progress reporting for subtasks
- Version 2.1.0 with multi-step task execution support

#### Changed

**CLI Documentation Optimization**:
- **Streamlined Documentation**: Reduced redundancy by referencing `intelligent-tools-strategy.md`
- **Updated Commands**:
  - `/cli:analyze` - Simplified from ~200 to ~78 lines
  - `/cli:chat` - Simplified from ~161 to ~92 lines
  - `/cli:execute` - Simplified from ~235 to ~111 lines
- **Unified Command Templates**:
  - Separated Gemini/Qwen (uses `-p` parameter) from Codex (uses `exec` command)
  - Added Codex `-i` parameter documentation for image attachment
  - Consistent template structure across all CLI commands

**Intelligent Tools Strategy Updates**:
- Enhanced Codex session management documentation
- Added `codex exec "..." resume --last` syntax explanation
- Documented multi-task execution pattern
- Clarified image attachment workflow with resume

**Command Template Improvements**:
- **Gemini/Qwen**: `cd [dir] && ~/.claude/scripts/[tool]-wrapper -p "..."`
- **Codex**: `codex -C [dir] --full-auto exec "..." --skip-git-repo-check -s danger-full-access`
- **Codex with Resume**: `codex exec "..." resume --last --skip-git-repo-check -s danger-full-access`
- **Image Support**: `codex -C [dir] -i image.png --full-auto exec "..."`

#### Technical Details

**Multi-Step Execution Flow**:
```
Input → Parse (Description/Task ID) → Decompose into Subtasks → TodoWrite Tracking →
For Each Subtask:
  1. Execute with Codex (first: exec, subsequent: exec resume --last)
  2. [Optional] Git verification
  3. Mark complete in TodoWrite
→ Final Summary
```

**Subtask Decomposition Criteria**:
- Each subtask: 5-15 minutes completable
- Clear, testable outcomes
- Explicit dependencies
- Focused file scope (1-5 files per subtask)

**Error Handling**:
- Subtask failure: Pause for user intervention
- Git verification failure: Request user decision
- Codex session lost: Attempt retry with fresh session

**Integration Features**:
- Automatic task ID detection (e.g., `IMPL-001`, `TASK-123`)
- JSON task loading from `.task/[ID].json`
- Execution logging to `.chat/codex-execute-[timestamp].md`
- Summary generation to `.summaries/[TASK-ID]-summary.md`

#### Benefits

**Developer Experience**:
- 🚀 Automated task breakdown reduces planning overhead
- 📊 Clear progress tracking with TodoWrite integration
- 🔄 Context continuity improves code consistency
- ✅ Optional Git verification ensures code quality
- 🎯 Focused subtask execution reduces complexity

**Code Quality**:
- 🧪 Incremental testing after each subtask
- 🔍 Git verification catches unexpected changes
- 📝 Comprehensive execution logs for audit trail
- 🎨 Image attachment support for UI/design tasks

**Documentation**:
- 📚 Reduced documentation redundancy by ~60%
- 🔗 Clear references to master documentation
- ✨ Consistent command structure across all CLI tools
- 📖 Better separation of concerns (strategy vs. command docs)

---

## [3.2.3] - 2025-10-03

### ✨ Version Management System

This release introduces a comprehensive version management and upgrade notification system.

#### Added

**New Command: `/version`**:
- **Purpose**: Display version information and check for updates from GitHub
- **Features**:
  - Shows local and global installation versions
  - Fetches latest stable release from GitHub API
  - Displays latest development commit from main branch
  - Compares installed versions with remote versions
  - Provides upgrade recommendations with installation commands
  - Supports both stable and development version tracking

**Version Information Display**:
- **Local Version**: Shows project-specific installation (if exists)
- **Global Version**: Shows `~/.claude` installation with tracking mode
- **Latest Stable**: Displays latest release tag, name, and publish date
- **Latest Dev**: Shows latest commit hash, message, and date
- **Status Assessment**: Automatic version comparison and upgrade suggestions

**Version Tracking Files**:
- **`.claude/version.json`**: Local project version tracking
- **`~/.claude/version.json`**: Global installation version tracking
- **Fields**:
  - `version`: Version number or "latest" for main branch tracking
  - `installation_mode`: "Local" or "Global"
  - `installation_path`: Installation directory
  - `source_branch`: Source branch (usually "main")
  - `installation_date_utc`: ISO 8601 timestamp

**GitHub API Integration**:
- **Latest Release**: `https://api.github.com/repos/catlog22/Claude-Code-Workflow/releases/latest`
  - Extracts: `tag_name`, `name`, `published_at`
- **Latest Commit**: `https://api.github.com/repos/catlog22/Claude-Code-Workflow/commits/main`
  - Extracts: `sha`, `commit.message`, `commit.author.date`
- **Timeout**: 30-second timeout for slow connections
- **Error Handling**: Graceful fallback for network errors

**Command Output Scenarios**:

1. **Up to date**:
   ```
   ✅ You are on the latest stable version (3.2.3)
   ```

2. **Upgrade available**:
   ```
   ⬆️ A newer stable version is available: v3.2.3
   Your version: 3.2.2

   To upgrade:
   PowerShell: iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1)
   Bash: bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
   ```

3. **Development version**:
   ```
   ✨ You are running a development version (3.3.0-dev)
   This is newer than the latest stable release (v3.2.3)
   ```

#### Changed

**Documentation Updates**:
- Added `/version` command reference to README.md
- Added version management documentation to README_CN.md
- Created comprehensive `.claude/commands/version.md` implementation guide
- Updated command tables with version management examples

**Installation Scripts Enhancement**:
- Installation scripts now create `version.json` files automatically
- Track installation mode (local vs global)
- Record installation timestamp
- Support version tracking for both stable and development installations

#### Technical Details

**Implementation**:
- Uses simple bash commands (no jq dependency required)
- Fallback to grep/sed for JSON parsing
- Network calls with curl and error suppression
- Version comparison using `sort -V` for semantic versioning
- Cross-platform compatible (Windows Git Bash, Linux, macOS)

**Command Structure**:
```bash
/version                    # Display version and check for updates
```

**No parameters required** - command automatically:
1. Checks local version file (`./.claude/version.json`)
2. Checks global version file (`~/.claude/version.json`)
3. Fetches latest release from GitHub
4. Fetches latest commit from main branch
5. Compares versions and provides recommendations

#### Benefits

**User Experience**:
- 🔍 Quick version check with single command
- 📊 Comprehensive version information display
- 🔄 Automatic upgrade notifications
- 📈 Development version tracking support
- 🌐 GitHub API integration for latest updates

**DevOps**:
- 📁 Version tracking in both local and global installations
- 🕐 Installation timestamp for audit trails
- 🔀 Support for both stable and development branches
- ⚡ Fast execution with 30-second network timeout
- 🛡️ Graceful error handling for offline scenarios

---

## [3.2.0] - 2025-10-02

### 🔄 Test-Fix Workflow & Agent Architecture Simplification

This release simplifies the agent architecture and introduces an automated test-fix workflow based on the principle "Tests Are the Review".

#### Added

**New Agent: test-fix-agent**:
- **Purpose**: Execute tests, diagnose failures, and fix code until all tests pass
- **Philosophy**: When all tests pass, code is automatically approved (no separate review needed)
- **Responsibilities**:
  - Execute complete test suite for implemented modules
  - Parse test output and identify failures
  - Diagnose root cause of test failures
  - Modify source code to fix issues
  - Re-run tests to verify fixes
  - Certify code approval when all tests pass

**Enhanced test-gen Command**:
- Transforms from planning tool to workflow orchestrator
- Auto-generates TEST-FIX tasks for test-fix-agent
- Automatically executes test validation via `/workflow:execute`
- Eliminates manual planning document generation

**New Task Types**:
- `test-gen`: Test generation tasks (handled by @code-developer)
- `test-fix`: Test execution and fixing tasks (handled by @test-fix-agent)

#### Changed

**Agent Architecture Simplification**:
- **Removed**: `@code-review-agent` and `@code-review-test-agent`
  - Testing now serves as the quality gate
  - Passing tests = approved code
- **Enhanced**: `@code-developer` now writes implementation + tests together
  - Unified generative work (code + tests)
  - Maintains context continuity
- **Added**: `@general-purpose` for optional manual reviews
  - Used only when explicitly requested
  - Handles special cases and edge scenarios

**Task Type Updates**:
- `"test"` → `"test-gen"` (clearer distinction from test-fix)
- Agent mapping updated across all commands:
  - `feature|bugfix|refactor|test-gen` → `@code-developer`
  - `test-fix` → `@test-fix-agent`
  - `review` → `@general-purpose` (optional)

**Workflow Changes**:
```
Old: code-developer → test-agent → code-review-agent
New: code-developer (code+tests) → test-fix-agent (execute+fix) → ✅ approved
```

#### Removed

- `@code-review-agent` - Testing serves as quality gate
- `@code-review-test-agent` - Functionality split between code-developer and test-fix-agent
- Separate review step - Tests passing = code approved

---

## [3.1.0] - 2025-10-02

### 🧪 TDD Workflow Support

This release introduces comprehensive Test-Driven Development (TDD) workflow support with Red-Green-Refactor cycle enforcement.

#### Added

**TDD Workflow Commands**:
- **`/workflow:tdd-plan`**: 5-phase TDD planning orchestrator
  - Creates structured TDD workflow with TEST → IMPL → REFACTOR task chains
  - Enforces Red-Green-Refactor methodology through task dependencies
  - Supports both manual and agent modes (`--agent` flag)
  - Validates TDD structure (chains, dependencies, meta fields)
  - Outputs: `TDD_PLAN.md`, `IMPL_PLAN.md`, `TODO_LIST.md`

- **`/workflow:tdd-verify`**: 4-phase TDD compliance verification
  - Validates task chain structure (TEST-N.M → IMPL-N.M → REFACTOR-N.M)
  - Analyzes test coverage metrics (line, branch, function coverage)
  - Verifies Red-Green-Refactor cycle execution
  - Generates comprehensive compliance report with scoring (0-100)
  - Outputs: `TDD_COMPLIANCE_REPORT.md`

**TDD Tool Commands**:
- **`/workflow:tools:task-generate-tdd`**: TDD task chain generator
  - Uses Gemini AI to analyze requirements and create TDD breakdowns
  - Generates TEST, IMPL, REFACTOR tasks with proper dependencies
  - Creates task JSONs with `meta.tdd_phase` field ("red"/"green"/"refactor")
  - Assigns specialized agents (`@code-review-test-agent`, `@code-developer`)
  - Maximum 10 features (30 total tasks) per workflow

- **`/workflow:tools:tdd-coverage-analysis`**: Test coverage and cycle analysis
  - Extracts test files from TEST tasks
  - Runs test suite with coverage (supports npm, pytest, cargo, go test)
  - Parses coverage metrics (line, branch, function)
  - Verifies TDD cycle execution through task summaries
  - Outputs: `test-results.json`, `coverage-report.json`, `tdd-cycle-report.md`

**TDD Architecture**:
- **Task ID Format**: `TEST-N.M`, `IMPL-N.M`, `REFACTOR-N.M`
  - N = feature number (1-10)
  - M = sub-task number (1-N)

- **Dependency System**:
  - `IMPL-N.M` depends on `TEST-N.M`
  - `REFACTOR-N.M` depends on `IMPL-N.M`
  - Enforces execution order: Red → Green → Refactor

- **Meta Fields**:
  - `meta.tdd_phase`: "red" | "green" | "refactor"
  - `meta.agent`: "@code-review-test-agent" | "@code-developer"

**Compliance Scoring**:
```
Base Score: 100 points
Deductions:
- Missing TEST task: -30 points per feature
- Missing IMPL task: -30 points per feature
- Missing REFACTOR task: -10 points per feature
- Wrong dependency: -15 points per error
- Wrong agent: -5 points per error
- Wrong tdd_phase: -5 points per error
- Test didn't fail initially: -10 points per feature
- Tests didn't pass after IMPL: -20 points per feature
- Tests broke during REFACTOR: -15 points per feature
```

#### Changed

**Documentation Updates**:
- Updated README.md with TDD workflow section
- Added TDD Quick Start guide
- Updated command reference with TDD commands
- Version badge updated to v3.1.0

**Integration**:
- TDD commands work alongside standard workflow commands
- Compatible with `/workflow:execute`, `/workflow:status`, `/workflow:resume`
- Uses same session management and artifact system

#### Benefits

**TDD Best Practices**:
- ✅ Enforced test-first development through task dependencies
- ✅ Automated Red-Green-Refactor cycle verification
- ✅ Comprehensive test coverage analysis
- ✅ Quality scoring and compliance reporting
- ✅ AI-powered task breakdown with TDD focus

**Developer Experience**:
- 🚀 Quick TDD workflow creation with single command
- 📊 Detailed compliance reports with actionable recommendations
- 🔄 Seamless integration with existing workflow system
- 🧪 Multi-framework test support (Jest, Pytest, Cargo, Go)

---

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