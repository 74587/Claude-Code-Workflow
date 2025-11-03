# Changelog

All notable changes to Claude Code Workflow (CCW) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.2.0] - 2025-11-03

### 🎉 New Command: `/memory:docs` - Intelligent Documentation Workflow

This release introduces a powerful new documentation command that revolutionizes project documentation generation with intelligent planning, parallel execution, and smart task grouping.

#### ✅ Added

**New `/memory:docs` Command**:
- ✨ **Lightweight Documentation Planner** - Analyzes project structure and generates executable documentation tasks
- ✨ **Smart Task Grouping** - Dynamic grouping algorithm with ≤7 documents per task constraint
- ✨ **Context Sharing Optimization** - Prefer grouping 2 top-level directories for shared Gemini analysis
- ✨ **Parallel Execution** - Multiple task groups execute concurrently for faster completion
- ✨ **Path Mirroring Strategy** - Documentation structure mirrors source code hierarchy
- ✨ **Two Execution Modes** - Agent Mode (default) and CLI Mode (--cli-execute)
- ✨ **Two Documentation Modes** - Full mode (complete docs) and Partial mode (modules only)

**Task Grouping Algorithm**:
- 🎯 **Primary constraint**: Each task generates ≤7 documents (hard limit)
- 🎯 **Optimization goal**: Group 2 directories when possible for context sharing
- 🎯 **Conflict resolution**: Automatic splitting when exceeding document limit
- 🎯 **Context benefit**: Same-task directories analyzed via single Gemini call

**Workflow Phases**:
- 📋 **Phase 1**: Initialize session and create directory structure
- 📋 **Phase 2**: Pre-computed analysis (folder classification, structure analysis)
- 📋 **Phase 3**: Detect update mode (create vs. update)
- 📋 **Phase 4**: Smart task decomposition with document count control
- 📋 **Phase 5**: Generate executable task JSONs with dependency chains

**Documentation Types**:
- 📚 **Module Documentation**: API.md (code folders) + README.md (all folders)
- 📚 **Project Documentation**: README.md (overview and navigation)
- 📚 **Architecture Documentation**: ARCHITECTURE.md + EXAMPLES.md
- 📚 **API Documentation**: HTTP API reference (optional, auto-detected)

**Intelligent Features**:
- 🧠 **Auto-detection** - Skip tests/build/config/vendor directories automatically
- 🧠 **Folder Classification** - Code folders vs. Navigation folders
- 🧠 **Incremental Updates** - Preserve user modifications in existing docs
- 🧠 **Pre-computed Analysis** - Phase 2 analysis stored in `.process/`, reused across tasks
- 🧠 **Efficient Data Loading** - Existing docs loaded once, shared across all tasks

**Command Parameters**:
```bash
/memory:docs [path] [--tool <gemini|qwen|codex>] [--mode <full|partial>] [--cli-execute]
```

#### 🔧 Technical Highlights

**Session Structure**:
- `.workflow/WFS-docs-{timestamp}/` - Session root directory
- `.process/phase2-analysis.json` - Single JSON with all pre-computed analysis
- `.task/IMPL-*.json` - Executable task definitions with dependency chains

**Task Hierarchy** (Dynamic based on document count):
- **Level 1**: Module tree groups (parallel execution, ≤7 docs each)
- **Level 2**: Project README (depends on Level 1, full mode only)
- **Level 3**: ARCHITECTURE + EXAMPLES (depends on Level 2, full mode only)
- **Level 4**: HTTP API documentation (optional, auto-detected)

**Grouping Examples**:
- Small projects (≤7 docs): Single task with shared context
- Medium projects (>7 docs): Multiple groups with 2 dirs each
- Large projects (single dir >7 docs): Automatic subdirectory splitting

#### 🎯 Performance Benefits

**Resource Optimization**:
- ⚡ **Parallel Processing** - Multiple directory groups execute concurrently
- ⚡ **Context Sharing** - Single Gemini call per task group (2 directories)
- ⚡ **Efficient Analysis** - One-time analysis in Phase 2, reused by all tasks
- ⚡ **Predictable Sizing** - ≤7 docs per task ensures reliable completion
- ⚡ **Failure Isolation** - Task-level failures don't block entire workflow

**Data Efficiency**:
- 📊 Single `phase2-analysis.json` replaces 7+ temporary files
- 📊 Existing docs loaded once, shared across all tasks
- 📊 Pre-computed folder analysis eliminates redundant scanning

#### 📦 New Files

- `.claude/commands/memory/docs.md` - Complete command specification and workflow
- Integration with existing `@doc-generator` agent
- Compatible with workflow execution system (`/workflow:execute`)

#### 🔗 Integration

**Execute documentation workflow**:
```bash
/workflow:execute                                    # Auto-discover active session
/workflow:execute --resume-session="WFS-docs-..."   # Specify session
/task:execute IMPL-001                               # Execute individual task
```

**Related commands**:
- `/workflow:status` - View task progress
- `/workflow:session:complete` - Mark session complete

---

## [5.1.0] - 2025-10-27

### 🔄 Agent Architecture Consolidation

This release consolidates the agent architecture and enhances workflow commands for better reliability and clarity.

#### ✅ Added

**Agent System**:
- ✅ **Universal Executor Agent** - New consolidated agent replacing general-purpose agent
- ✅ **Enhanced agent specialization** - Better separation of concerns across agent types

**Workflow Improvements**:
- ✅ **Advanced context filtering** - Context-gather command now supports more sophisticated validation
- ✅ **Session state management** - Enhanced session completion with better cleanup logic

#### 📝 Changed

**Agent Architecture**:
- 🔄 **Removed general-purpose agent** - Consolidated into universal-executor for clarity
- 🔄 **Improved agent naming** - More descriptive agent names matching their specific roles

**Command Enhancements**:
- 🔄 **`/workflow:session:complete`** - Better state management and cleanup procedures
- 🔄 **`/workflow:tools:context-gather`** - Enhanced filtering and validation capabilities

#### 🗂️ Maintenance

**Code Organization**:
- 📦 **Archived legacy templates** - Moved outdated prompt templates to archive folder
- 📦 **Documentation cleanup** - Improved consistency across workflow documentation

#### 📦 Updated Files

- `.claude/agents/universal-executor.md` - New consolidated agent definition
- `.claude/commands/workflow/session/complete.md` - Enhanced session management
- `.claude/commands/workflow/tools/context-gather.md` - Improved context filtering
- `.claude/workflows/cli-templates/prompts/archive/` - Legacy template archive

---

## [5.0.0] - 2025-10-24

### 🎉 Less is More - Simplified Architecture Release

This major release embraces the "less is more" philosophy, removing external dependencies, streamlining workflows, and focusing on core functionality with standard, proven tools.

#### 🚀 Breaking Changes

**Removed Features**:
- ❌ **`/workflow:concept-clarify`** - Concept enhancement feature removed for simplification
- ❌ **MCP code-index dependency** - Replaced with standard `ripgrep` and `find` tools
- ❌ **`synthesis-specification.md` workflow** - Replaced with direct role analysis approach

**Command Changes**:
- ⚠️ Memory commands renamed for consistency:
  - `/update-memory-full` → `/memory:update-full`
  - `/update-memory-related` → `/memory:update-related`

#### ✅ Added

**Standard Tool Integration**:
- ✅ **ripgrep (rg)** - Fast content search replacing MCP code-index
- ✅ **find** - Native filesystem discovery for better cross-platform compatibility
- ✅ **Multi-tier fallback** - Graceful degradation when advanced tools unavailable

**Enhanced TDD Workflow**:
- ✅ **Conflict resolution mechanism** - Better handling of test-implementation conflicts
- ✅ **Improved task generation** - Enhanced phase coordination and quality gates
- ✅ **Updated workflow phases** - Clearer separation of concerns

**Role-Based Planning**:
- ✅ **Direct role analysis** - Simplified brainstorming focused on role documents
- ✅ **Removed synthesis layer** - Less abstraction, clearer intent
- ✅ **Better documentation flow** - From role analysis directly to action planning

#### 📝 Changed

**Documentation Updates**:
- ✅ **All docs updated to v5.0.0** - Consistent versioning across all files
- ✅ **Removed MCP badge** - No longer advertising experimental MCP features
- ✅ **Clarified test workflows** - Better explanation of generate → execute pattern
- ✅ **Fixed command references** - Corrected all memory command names
- ✅ **Updated UI design notes** - Clarified MCP Chrome DevTools retention for UI workflows

**File Discovery**:
- ✅ **`/memory:load`** - Now uses ripgrep/find instead of MCP code-index
- ✅ **Faster search** - Native tools provide better performance
- ✅ **Better reliability** - No external service dependencies

**UI Design Workflows**:
- ℹ️ **MCP Chrome DevTools retained** - Specialized tool for browser automation
- ℹ️ **Multi-tier fallback** - MCP → Playwright → Chrome → Manual
- ℹ️ **Purpose-built integration** - UI workflows require browser control

#### 🐛 Fixed

**Documentation Inconsistencies**:
- 🔧 Removed references to deprecated `/workflow:concept-clarify` command
- 🔧 Fixed incorrect memory command names in getting started guides
- 🔧 Clarified test workflow execution patterns
- 🔧 Updated MCP dependency references throughout specs
- 🔧 Corrected UI design tool descriptions

#### 📦 Updated Files

- `README.md` / `README_CN.md` - v5.0 version badge and core improvements
- `COMMAND_REFERENCE.md` - Updated command descriptions, removed deprecated commands
- `COMMAND_SPEC.md` - v5.0 technical specifications, clarified implementations
- `GETTING_STARTED.md` / `GETTING_STARTED_CN.md` - v5.0 features, fixed command names
- `INSTALL_CN.md` - v5.0 simplified installation notes

#### 🔍 Technical Details

**Performance Improvements**:
- Faster file discovery using native ripgrep
- Reduced external dependencies improves installation reliability
- Better cross-platform compatibility with standard Unix tools

**Architectural Benefits**:
- Simpler dependency tree
- Easier troubleshooting with standard tools
- More predictable behavior without external services

**Migration Notes**:
- Update memory command usage (see command changes above)
- Remove any usage of `/workflow:concept-clarify`
- No changes needed for core workflow commands (`/workflow:plan`, `/workflow:execute`)

---

## [4.6.2] - 2025-10-20

### 📝 Documentation Optimization

#### Improved

**`/memory:load` Command Documentation**: Optimized command specification from 273 to 240 lines (12% reduction)
- Merged redundant sections for better information flow
- Removed unnecessary internal implementation details
- Simplified usage examples while preserving clarity
- Maintained all critical information (parameters, workflow, JSON structure)
- Improved user-centric documentation structure

#### Updated

**COMMAND_SPEC.md**: Updated `/memory:load` specification to match actual implementation
- Corrected syntax: `[--tool gemini|qwen]` instead of outdated `[--agent] [--json]` flags
- Added agent-driven execution details
- Clarified core philosophy and token-efficiency benefits

**GETTING_STARTED.md**: Added "Quick Context Loading for Specific Tasks" section
- Positioned between "Full Project Index Rebuild" and "Incremental Related Module Updates"
- Includes practical examples and use case guidance
- Explains how `/memory:load` works and when to use it

---

## [4.6.0] - 2025-10-18

### 🎯 Concept Clarification & Agent-Driven Analysis

This release introduces a concept clarification quality gate and agent-delegated intelligent analysis, significantly enhancing workflow planning accuracy and reducing execution errors.

#### Added

**Concept Clarification Quality Gate** (`/workflow:concept-clarify`):
- **Dual-Mode Support**: Automatically detects and operates in brainstorm or plan workflows
  - **Brainstorm Mode**: Analyzes `synthesis-specification.md` after brainstorm synthesis
  - **Plan Mode**: Analyzes `ANALYSIS_RESULTS.md` between Phase 3 and Phase 4
- **Interactive Q&A System**: Up to 5 targeted questions to resolve ambiguities
  - Multiple-choice or short-answer format
  - Covers requirements, architecture, UX, implementation, risks
  - Progressive disclosure - one question at a time
- **Incremental Updates**: Saves clarifications after each answer to prevent context loss
- **Coverage Summary**: Generates detailed report with recommendations
- **Session Metadata**: Tracks verification status in workflow session
- **Phase 3.5 Integration**: Inserted as quality gate in `/workflow:plan`
  - Pauses auto-continue workflow for user interaction
  - Auto-skips if no critical ambiguities detected
  - Updates ANALYSIS_RESULTS.md with user clarifications

**Agent-Delegated Intelligent Analysis** (Phase 3 Enhancement):
- **CLI Execution Agent Integration**: Phase 3 now uses `cli-execution-agent`
  - Autonomous context discovery via MCP code-index
  - Enhanced prompt generation with discovered patterns
  - 5-phase agent workflow (understand → discover → enhance → execute → route)
- **MCP-Powered Context Discovery**: Automatic file and pattern discovery
  - `mcp__code-index__find_files`: Pattern-based file discovery
  - `mcp__code-index__search_code_advanced`: Content-based code search
  - `mcp__code-index__get_file_summary`: Structural analysis
- **Smart Tool Selection**: Agent automatically chooses Gemini for analysis tasks
- **Execution Logging**: Complete agent execution log saved to session
- **Session-Aware Routing**: Results automatically routed to correct session directory

**Enhanced Planning Workflow** (`/workflow:plan`):
- **5-Phase Model**: Upgraded from 4-phase to 5-phase workflow
  - Phase 1: Session Discovery
  - Phase 2: Context Gathering
  - Phase 3: Intelligent Analysis (agent-delegated)
  - Phase 3.5: Concept Clarification (quality gate)
  - Phase 4: Task Generation
- **Auto-Continue Enhancement**: Workflow pauses only at Phase 3.5 for user input
- **Memory Management**: Added memory state check before Phase 3.5
  - Automatic `/compact` execution if context usage >110K tokens
  - Prevents context overflow during intensive analysis

#### Changed

**concept-clarify.md** - Enhanced with Dual-Mode Support:
- **Mode Detection Logic**: Auto-detects workflow type based on artifact presence
  ```bash
  IF EXISTS(ANALYSIS_RESULTS.md) → plan mode
  ELSE IF EXISTS(synthesis-specification.md) → brainstorm mode
  ```
- **Dynamic File Handling**: Loads and updates appropriate artifact based on mode
- **Mode-Specific Validation**: Different validation rules for each mode
- **Enhanced Metadata**: Tracks `clarify_mode` in session verification data
- **Backward Compatible**: Preserves all existing brainstorm mode functionality

**plan.md** - Refactored for Agent Delegation:
- **Phase 3 Delegation**: Changed from direct `concept-enhanced` call to `cli-execution-agent`
  - Agent receives: sessionId, contextPath, task description
  - Agent executes: autonomous context discovery + Gemini analysis
  - Agent outputs: ANALYSIS_RESULTS.md + execution log
- **Phase 3.5 Integration**: New quality gate phase with interactive Q&A
  - Command: `SlashCommand(concept-clarify --session [sessionId])`
  - Validation: Checks for clarifications section and recommendation
  - Skip conditions: Auto-proceeds if no ambiguities detected
- **TodoWrite Enhancement**: Updated to track 5 phases including Phase 3.5
- **Data Flow Updates**: Enhanced context flow diagram showing agent execution
- **Coordinator Checklist**: Added Phase 3.5 verification steps

**README.md & README_CN.md** - Documentation Updates:
- **Version Badge**: Updated to v4.6.0
- **What's New Section**: Highlighted key features of v4.6.0
  - Concept clarification quality gate
  - Agent-delegated analysis
  - Dual-mode support
  - Test-cycle-execute documentation
- **Phase 5 Enhancement**: Added `/workflow:test-cycle-execute` documentation
  - Dynamic task generation explanation
  - Iterative testing workflow
  - CLI-driven analysis integration
  - Resume session support
- **Command Reference**: Added test-cycle-execute to workflow commands table

#### Improved

**Workflow Quality Gates**:
- 🎯 **Pre-Planning Verification**: concept-clarify catches ambiguities before task generation
- 🤖 **Intelligent Analysis**: Agent-driven Phase 3 provides deeper context discovery
- 🔄 **Interactive Control**: Users validate critical decisions at Phase 3.5
- ✅ **Higher Accuracy**: Clarified requirements reduce execution errors

**Context Discovery**:
- 🔍 **MCP Integration**: Leverages code-index for automatic pattern discovery
- 📊 **Enhanced Prompts**: Agent enriches prompts with discovered context
- 🎯 **Relevance Scoring**: Files ranked and filtered by relevance
- 📁 **Execution Transparency**: Complete agent logs for debugging

**User Experience**:
- ⏸️ **Single Interaction Point**: Only Phase 3.5 requires user input
- ⚡ **Auto-Skip Intelligence**: No questions if analysis is already clear
- 📝 **Incremental Saves**: Clarifications saved after each answer
- 🔄 **Resume Support**: Can continue interrupted test workflows

#### Technical Details

**Concept Clarification Architecture**:
```javascript
Phase 1: Session Detection & Mode Detection
  ↓
  IF EXISTS(process_dir/ANALYSIS_RESULTS.md):
    mode = "plan" → primary_artifact = ANALYSIS_RESULTS.md
  ELSE IF EXISTS(brainstorm_dir/synthesis-specification.md):
    mode = "brainstorm" → primary_artifact = synthesis-specification.md
  ↓
Phase 2: Load Artifacts (mode-specific)
  ↓
Phase 3: Ambiguity Scan (8 categories)
  ↓
Phase 4: Question Generation (max 5, prioritized)
  ↓
Phase 5: Interactive Q&A (one at a time)
  ↓
Phase 6: Incremental Updates (save after each answer)
  ↓
Phase 7: Completion Report with recommendations
```

**Agent-Delegated Analysis Flow**:
```javascript
plan.md Phase 3:
  Task(cli-execution-agent) →
    Agent Phase 1: Understand analysis intent
    Agent Phase 2: MCP code-index discovery
    Agent Phase 3: Enhance prompt with patterns
    Agent Phase 4: Execute Gemini analysis
    Agent Phase 5: Route to .workflow/[session]/.process/ANALYSIS_RESULTS.md
  → ANALYSIS_RESULTS.md + execution log
```

**Workflow Data Flow**:
```
User Input
  ↓
Phase 1: session:start → sessionId
  ↓
Phase 2: context-gather → contextPath
  ↓
Phase 3: cli-execution-agent → ANALYSIS_RESULTS.md (enhanced)
  ↓
Phase 3.5: concept-clarify → ANALYSIS_RESULTS.md (clarified)
  ↓ [User answers 0-5 questions]
  ↓
Phase 4: task-generate → IMPL_PLAN.md + task.json
```

#### Files Changed

**Commands** (3 files):
- `.claude/commands/workflow/concept-clarify.md` - Added dual-mode support (85 lines changed)
- `.claude/commands/workflow/plan.md` - Agent delegation + Phase 3.5 (106 lines added)
- `.claude/commands/workflow/tools/concept-enhanced.md` - Documentation updates

**Documentation** (3 files):
- `README.md` - Version update + test-cycle-execute documentation (25 lines changed)
- `README_CN.md` - Chinese version aligned with README.md (25 lines changed)
- `CHANGELOG.md` - This changelog entry

**Total Impact**:
- 6 files changed
- 241 insertions, 50 deletions
- Net: +191 lines

#### Backward Compatibility

**✅ Fully Backward Compatible**:
- Existing workflows continue to work unchanged
- concept-clarify preserves brainstorm mode functionality
- Phase 3.5 auto-skips when no ambiguities detected
- Agent delegation transparent to users
- All existing commands and sessions unaffected

#### Benefits

**Planning Accuracy**:
- 🎯 **Ambiguity Resolution**: Interactive Q&A eliminates underspecified requirements
- 📊 **Better Context**: Agent discovers patterns missed by manual analysis
- ✅ **Pre-Execution Validation**: Catches issues before task generation

**Workflow Efficiency**:
- ⚡ **Autonomous Discovery**: MCP integration reduces manual context gathering
- 🔄 **Smart Skipping**: No questions when analysis is already complete
- 📝 **Incremental Progress**: Saves work after each clarification

**Development Quality**:
- 🐛 **Fewer Errors**: Clarified requirements reduce implementation mistakes
- 🎯 **Focused Tasks**: Better analysis produces more precise task breakdown
- 📚 **Audit Trail**: Complete execution logs for debugging

#### Migration Notes

**No Action Required**:
- All changes are additive and backward compatible
- Existing workflows benefit from new features automatically
- concept-clarify can be used manually in existing sessions

**Optional Enhancements**:
- Use `/workflow:concept-clarify` manually before `/workflow:plan` for brainstorm workflows
- Review Phase 3 execution logs in `.workflow/[session]/.chat/` for insights
- Enable MCP tools for optimal agent context discovery

**New Workflow Pattern**:
```bash
# New recommended workflow with quality gates
/workflow:brainstorm:auto-parallel "topic"
/workflow:brainstorm:synthesis
/workflow:concept-clarify  # Optional but recommended
/workflow:plan "description"
# Phase 3.5 will pause for clarification Q&A if needed
/workflow:execute
```

---

## [4.4.1] - 2025-10-12

### 🔧 Implementation Approach Structure Refactoring

This release refactors the task generation system from a simple object-based implementation approach to a structured step-based approach with dependency management and CLI execution support.

#### Changed

**Implementation Approach Structure** (Major Refactoring):
- **Array Format**: Changed from single object to array of step objects
  - Before (v4.4.0): Single `implementation_approach` object with description
  - After (v4.4.1): Array of steps with sequential execution and dependencies
- **Step Structure**: Each step now includes:
  - `step`: Step number (1, 2, 3...)
  - `title`: Step title
  - `description`: Detailed description with variable references
  - `modification_points`: Specific modification targets
  - `logic_flow`: Business logic sequence
  - `command`: Optional CLI command for execution
  - `depends_on`: Array of step numbers (dependencies)
  - `output`: Variable name for step output (used in `[variable_name]` references)
- **Benefits**:
  - ✅ Multi-step workflows with clear dependencies
  - ✅ Variable substitution between steps (`[variable_name]`)
  - ✅ Better task decomposition clarity
  - ✅ Sequential execution with dependency resolution

**CLI Execution Mode Support**:
- **New `--cli-execute` Flag**: Added to workflow commands
  - `/workflow:plan --cli-execute` - Generate tasks with CLI execution
  - `/workflow:test-gen --cli-execute` - Generate test tasks with CLI execution
  - `/workflow:tools:task-generate --cli-execute` - Manual task generation with CLI
  - `/workflow:tools:task-generate-agent --cli-execute` - Agent task generation with CLI
  - `/workflow:tools:test-task-generate --cli-execute` - Test task generation with CLI
- **Codex Resume Mechanism**: Maintains session context across steps
  - First step: `codex exec "..."` (starts new session)
  - Subsequent steps: `codex exec "..." resume --last` (continues session)
  - Benefits: Context continuity, consistent implementation style

**Agent Updates**:
- **action-planning-agent.md**: Updated task generation with step-based approach
- **code-developer.md**: Added implementation approach execution logic
- **conceptual-planning-agent.md**: Added flow control format handling documentation
- **doc-generator.md**: Updated to process step-based implementation approach
- **test-fix-agent.md**: Added flow control execution and Codex mode support

**Workflow Command Updates**:
- **execute.md**: Updated task JSON examples with new structure
- **plan.md**: Added `--cli-execute` flag and command examples
- **test-gen.md**: Added `--cli-execute` flag support
- **docs.md**: Refactored from 1328 to 435 lines (67% reduction)
- **task-generate-agent.md**: Updated to generate step-based tasks
- **task-generate-tdd.md**: Enhanced with array format and CLI execution
- **task-generate.md**: Added CLI execution mode documentation
- **test-task-generate.md**: Added CLI execution mode support

**Core Architecture Updates**:
- **task-core.md**: Updated implementation approach structure
- **workflow-architecture.md**: Enhanced with flow control documentation (474 lines added)

#### Technical Details

**Step Execution Flow**:
```javascript
// Old approach (v4.4.0)
"implementation_approach": {
  "task_description": "Implement feature X",
  "modification_points": ["File A", "File B"],
  "logic_flow": ["Step 1", "Step 2"]
}

// New approach (v4.4.1)
"implementation_approach": [
  {
    "step": 1,
    "title": "Load requirements",
    "description": "Load and analyze [previous_output]",
    "modification_points": ["Parse requirements"],
    "logic_flow": ["Read input", "Extract data"],
    "depends_on": [],
    "output": "requirements"
  },
  {
    "step": 2,
    "title": "Implement feature",
    "description": "Implement using [requirements]",
    "modification_points": ["File A", "File B"],
    "logic_flow": ["Apply changes", "Validate"],
    "command": "codex exec '...' resume --last",
    "depends_on": [1],
    "output": "implementation"
  }
]
```

**CLI Command Examples**:
```bash
# Manual task generation with CLI execution
/workflow:tools:task-generate --session WFS-auth --cli-execute

# Agent task generation with CLI execution
/workflow:tools:task-generate-agent --session WFS-auth --cli-execute

# Test task generation with CLI execution
/workflow:tools:test-task-generate --session WFS-test --cli-execute

# Full planning workflow with CLI execution
/workflow:plan "Implement auth system" --cli-execute
```

#### Files Changed

**Agents** (5 files):
- `.claude/agents/action-planning-agent.md`
- `.claude/agents/code-developer.md`
- `.claude/agents/conceptual-planning-agent.md`
- `.claude/agents/doc-generator.md`
- `.claude/agents/test-fix-agent.md`

**Commands** (7 files):
- `.claude/commands/workflow/execute.md`
- `.claude/commands/workflow/plan.md`
- `.claude/commands/workflow/test-gen.md`
- `.claude/commands/workflow/tools/docs.md` (major refactoring: 1328→435 lines)
- `.claude/commands/workflow/tools/task-generate-agent.md`
- `.claude/commands/workflow/tools/task-generate-tdd.md`
- `.claude/commands/workflow/tools/task-generate.md`
- `.claude/commands/workflow/tools/test-task-generate.md`

**Core Architecture** (2 files):
- `.claude/workflows/task-core.md`
- `.claude/workflows/workflow-architecture.md` (+474 lines of flow control documentation)

**Total Impact**:
- 15 files changed
- +1341 lines, -782 lines
- Net: +559 lines
- Major improvements in task generation clarity and CLI execution support

#### Migration Guide

**For Existing Workflows**:
1. **Backward Compatible**: Old object-based approach still supported
2. **Gradual Migration**: Can mix old and new formats in same workflow
3. **Automatic Handling**: Agents detect and handle both formats

**For New Workflows**:
1. **Use Step-Based Approach**: Better for multi-step tasks
2. **Enable CLI Execution**: Use `--cli-execute` flag for automated execution
3. **Leverage Resume**: Use Codex resume for context continuity

**Example Migration**:
```bash
# Old workflow (v4.4.0)
/workflow:plan "Implement auth system"

# New workflow (v4.4.1) - with CLI execution
/workflow:plan "Implement auth system" --cli-execute
```

#### Benefits

**Task Generation**:
- 🎯 **Clearer Structure**: Step-based approach improves task clarity
- 🔄 **Better Dependencies**: Explicit dependency management between steps
- 📊 **Variable References**: Cross-step data flow with `[variable_name]`
- 🤖 **Automated Execution**: CLI execution mode reduces manual intervention

**Development Workflow**:
- ⚡ **Faster Execution**: Codex resume maintains context
- 🔍 **Better Traceability**: Each step's output explicitly tracked
- 🧪 **Easier Testing**: Isolated steps can be tested independently
- 📚 **Improved Documentation**: Flow control structure self-documenting

---

## [4.4.0] - 2025-10-11

### 🏗️ UI Design Workflow V3 - Layout/Style Separation Architecture

This release introduces a fundamental architectural refactoring that separates layout structure extraction from style token extraction, enabling the `generate` command to become a pure assembler.

#### Breaking Changes

**Command Renaming**:
```bash
# ❌ Old (v4.3.0 and earlier)
/workflow:ui-design:extract

# ✅ New (v4.4.0)
/workflow:ui-design:style-extract
```

**New Required Command**:
- **`/workflow:ui-design:layout-extract`**: Now mandatory for workflows using `generate`
- Layout templates must be generated before prototype assembly
- Both `imitate-auto` and `explore-auto` now include Phase 2.5 (layout extraction)

**Workflow Changes**:
```bash
# ❌ Old Flow (v4.3.0)
style-extract → consolidate → generate → update

# ✅ New Flow (v4.4.0)
style-extract → consolidate → layout-extract → generate (assembler) → update
```

#### Added

**New Command: `/workflow:ui-design:layout-extract`**:
- **Purpose**: Extract structural layout information separate from visual style
- **Features**:
  - Agent-powered structural analysis using `ui-design-agent`
  - Dual-mode operation: `imitate` (high-fidelity replication) / `explore` (multiple variants)
  - Device-aware layouts: desktop, mobile, tablet, responsive
  - Generates `layout-templates.json` with DOM structure and CSS layout rules
  - MCP-integrated layout pattern research (explore mode only)
  - Token-based CSS using `var()` placeholders for spacing and breakpoints
- **Output**: `layout-extraction/layout-templates.json` with:
  - DOM structure (semantic HTML5 with ARIA)
  - Component hierarchy (high-level layout regions)
  - CSS layout rules (Grid/Flexbox, no visual styling)
  - Device-specific structures and responsive breakpoints

**Enhanced Layout Extraction Architecture**:
```json
{
  "layout_templates": [
    {
      "target": "home",
      "variant_id": "layout-1",
      "device_type": "responsive",
      "design_philosophy": "3-column holy grail with fixed header",
      "dom_structure": { /* JSON object */ },
      "component_hierarchy": ["header", "main", "sidebar", "footer"],
      "css_layout_rules": "/* Grid/Flexbox only, uses var() */"
    }
  ]
}
```

**Device-Aware Layout Generation**:
- **Desktop**: 1920×1080px - Multi-column grids, spacious layouts
- **Mobile**: 375×812px - Single column, stacked sections, touch targets ≥44px
- **Tablet**: 768×1024px - Hybrid layouts, flexible columns
- **Responsive**: Mobile-first breakpoint-driven adaptive layouts

**MCP Integration (Explore Mode)**:
- `mcp__exa__web_search_exa` for layout pattern inspiration
- Pattern research: `{target} layout patterns {device_type}`
- Inspiration files: `layout-extraction/_inspirations/{target}-layout-ideas.txt`

#### Changed

**`/workflow:ui-design:style-extract` (Renamed from `extract`)**:
- **File Renamed**: `extract.md` → `style-extract.md`
- **Scope Clarified**: Focus exclusively on visual style (colors, typography, spacing)
- **Documentation Updated**: Added note about layout extraction separation
- **No Functionality Change**: All style extraction features preserved
- **Output**: Still generates `style-cards.json` with `proposed_tokens`

**`/workflow:ui-design:generate` (Refactored to Pure Assembler)**:
- **Before (v4.3.0)**: Layout design + style application agent
  - Agent made layout decisions during generation
  - Mixed structural and visual responsibilities
  - CSS contained both layout and style rules

- **After (v4.4.0)**: Pure assembly only
  - **Reads**: `layout-templates.json` + `design-tokens.json`
  - **Action**: Combines pre-extracted components:
    1. Build HTML from `dom_structure`
    2. Apply `css_layout_rules` (structure)
    3. Link design tokens CSS (visual style)
    4. Inject placeholder content
  - **No Design Logic**: All layout and style decisions pre-made
  - **Agent Prompt Updated**: Removed layout design instructions

**Agent Instructions Simplification** (`generate.md`):
```javascript
// ❌ Old (v4.3.0): Agent designs layout + applies style
Agent: "Design page layout based on requirements, then apply design tokens"

// ✅ New (v4.4.0): Agent only assembles
Agent: "
  [LAYOUT_STYLE_ASSEMBLY]
  Read layout-templates.json → Extract dom_structure, css_layout_rules
  Read design-tokens.json → Extract ALL token values
  Build HTML from dom_structure
  Build CSS from css_layout_rules + token values
  Write files IMMEDIATELY
"
```

**Workflow Commands Updated**:
- **`/workflow:ui-design:imitate-auto`**:
  - Added Phase 2.5: Layout Extraction (imitate mode, single variant)
  - Generates `layout-templates.json` before Phase 4 (UI Assembly)
  - Uses `--mode imitate` for high-fidelity layout replication

- **`/workflow:ui-design:explore-auto`**:
  - Added Phase 2.5: Layout Extraction (explore mode, multiple variants)
  - Generates `{targets × layout_variants}` layout templates
  - Uses `--mode explore` for structural variety
  - MCP-powered layout pattern research

**Output Structure Changes**:
```
{base_path}/
├── style-extraction/         # Visual tokens (unchanged)
│   └── style-cards.json
├── layout-extraction/        # NEW: Structural templates
│   ├── layout-templates.json
│   ├── layout-space-analysis.json (explore mode)
│   └── _inspirations/ (explore mode)
├── style-consolidation/      # Final design tokens (unchanged)
│   └── style-1/
│       └── design-tokens.json
└── prototypes/               # Assembled output (unchanged)
    └── {target}-style-{s}-layout-{l}.html
```

#### Improved

**Separation of Concerns**:
- 🎨 **Style (style-extract)**: Colors, typography, spacing → design-tokens.json
- 🏗️ **Layout (layout-extract)**: DOM structure, CSS layout → layout-templates.json
- 📦 **Assembly (generate)**: Combine structure + style → final prototypes
- ✅ **Result**: Each phase has single, clear responsibility

**Quality Improvements**:
- 🎯 **Better Layout Variety**: Explore mode generates structurally distinct layouts
- 🔄 **Reusability**: Layout templates can be combined with different styles
- 📊 **Clarity**: All structural decisions in layout-templates.json
- 🧪 **Testability**: Layout structure and visual style tested independently

**Performance Benefits**:
- ⚡ **Faster Generation**: Assembly is simpler than design + application
- 🔄 **Better Caching**: Layout templates reused across style variants
- 📉 **Reduced Complexity**: Generate agent has single responsibility

#### Technical Details

**Phase Flow Comparison**:

**Old Flow (v4.3.0)**:
```
Phase 1: style-extract → style-cards.json
Phase 2: consolidate → design-tokens.json
Phase 3: generate (design+apply) → prototypes
Phase 4: update
```

**New Flow (v4.4.0)**:
```
Phase 1: style-extract → style-cards.json
Phase 2: consolidate → design-tokens.json
Phase 2.5: layout-extract → layout-templates.json  [NEW]
Phase 3: generate (pure assembly) → prototypes
Phase 4: update
```

**Agent Task Changes**:

**Before (Mixed Responsibility)**:
```javascript
Agent Task: "
  Design page layout for {target}
  Apply design tokens from design-tokens.json
  Generate HTML + CSS
"
// Problems:
// - Layout decisions made during generation
// - Style application mixed with structure
// - Agent has dual responsibility
```

**After (Pure Assembly)**:
```javascript
Agent Task: "
  [LAYOUT_STYLE_ASSEMBLY]
  INPUT 1: layout-templates.json → dom_structure, css_layout_rules
  INPUT 2: design-tokens.json → token values

  ASSEMBLY:
  1. Build HTML from dom_structure
  2. Build CSS from css_layout_rules (replace var())
  3. Add visual styling using token values
  4. Write files IMMEDIATELY

  RULES:
  ✅ Pure assembly only
  ❌ NO layout design decisions
  ❌ NO style design decisions
"
```

**Layout Template Structure**:
```json
{
  "target": "home",
  "variant_id": "layout-1",
  "device_type": "responsive",
  "design_philosophy": "F-pattern with sticky nav",
  "dom_structure": {
    "tag": "body",
    "children": [
      {"tag": "header", "attributes": {"class": "layout-header"}},
      {"tag": "main", "attributes": {"class": "layout-main"}},
      {"tag": "footer", "attributes": {"class": "layout-footer"}}
    ]
  },
  "component_hierarchy": ["header", "main", "footer"],
  "css_layout_rules": ".layout-main { display: grid; grid-template-columns: 1fr 3fr; gap: var(--spacing-6); }"
}
```

**Token-Based CSS Pattern**:
```css
/* Layout rules use var() for spacing/breakpoints */
.layout-wrapper {
  display: grid;
  gap: var(--spacing-4);
  padding: var(--spacing-8);
}

@media (max-width: var(--breakpoint-md)) {
  .layout-wrapper {
    grid-template-columns: 1fr;
  }
}
```

#### Migration Guide

**For Existing Workflows**:
1. **Update Command Names**:
   ```bash
   # Old: /workflow:ui-design:extract
   # New: /workflow:ui-design:style-extract
   ```

2. **Add Layout Extraction Step**:
   ```bash
   # After consolidate, before generate:
   /workflow:ui-design:layout-extract --session WFS-xxx --targets "dashboard,settings" --mode explore --variants 3
   ```

3. **Update Orchestrator Workflows**:
   - `imitate-auto`: Automatically includes Phase 2.5
   - `explore-auto`: Automatically includes Phase 2.5
   - Manual workflows: Add `layout-extract` call

**Backward Compatibility**:
- ✅ Old `extract` command files archived (not deleted)
- ✅ New `style-extract` command name explicit and clear
- ✅ All output structures backward compatible
- ⚠️ **Breaking**: `generate` now requires `layout-templates.json` input

**For New Projects**:
- Use new workflow: `style-extract → consolidate → layout-extract → generate → update`
- Leverage layout variants: `--layout-variants` in explore-auto
- Device-specific layouts: `--device-type` parameter

#### Files Changed

**Renamed**:
- `.claude/commands/workflow/ui-design/extract.md` → `style-extract.md`

**Added**:
- `.claude/commands/workflow/ui-design/layout-extract.md` (new command, 370+ lines)

**Modified**:
- `.claude/commands/workflow/ui-design/generate.md`:
  - Refactored to pure assembler (agent instructions simplified)
  - Added Phase 2: Load Layout Templates
  - Updated agent prompt to focus on assembly only
  - Documentation updates for separation of concerns

- `.claude/commands/workflow/ui-design/imitate-auto.md`:
  - Added Phase 2.5: Layout Extraction (imitate mode)
  - Updated workflow orchestration
  - Phase numbering shifted (old Phase 3 → Phase 4)

- `.claude/commands/workflow/ui-design/explore-auto.md`:
  - Added Phase 2.5: Layout Extraction (explore mode)
  - Updated workflow orchestration
  - Matrix calculation updated: `style_variants × layout_variants × targets`
  - Phase numbering shifted (old Phase 3 → Phase 4)

- `.claude/commands/workflow/ui-design/consolidate.md`:
  - Documentation updates
  - Note added about layout-extract requirement

**Removed**:
- ❌ **V2 Commands Deprecated**: All `-v2` command variants removed
  - `generate-v2.md` removed (merged into main `generate.md`)
  - `explore-auto-v2.md` removed (merged into main `explore-auto.md`)
  - Self-contained CSS architecture now standard in all commands
  - No more v1/v2 split - unified workflow

**Total Impact**:
- 5 files changed
- 1 file renamed
- 1 new command (layout-extract, 370+ lines)
- 2 deprecated commands removed (generate-v2, explore-auto-v2)
- ~200 lines modified in existing commands
- Net: +400 lines (improved separation of concerns)

#### Benefits

**Architectural Clarity**:
- ✅ **Single Responsibility**: Each command has one job
- ✅ **Clear Contracts**: Explicit input/output for each phase
- ✅ **Better Testing**: Components testable independently
- ✅ **Maintainability**: Changes localized to relevant phase

**Developer Experience**:
- 🎯 **Predictable**: Layout structure visible before assembly
- 🔍 **Debuggable**: Easier to identify issues (layout vs style)
- 🔄 **Flexible**: Reuse layouts with different styles
- 📚 **Understandable**: Each phase has clear documentation

**Design Quality**:
- 🎨 **Style Independence**: Visual tokens separate from structure
- 🏗️ **Layout Variety**: Explore mode generates structurally different layouts
- 📐 **Device Optimization**: Layout templates device-specific
- ♿ **Accessibility**: Semantic HTML5 structure with ARIA

**Implementation Quality**:
- 🧩 **Modular**: Components can be developed independently
- 🔄 **Reusable**: Layout templates work with any style
- 🧪 **Testable**: Structure and style tested separately
- 📦 **Production-Ready**: Token-driven, semantic, accessible

---

## [4.3.0] - 2025-10-10

### 🎨 UI Design Workflow V2 - Self-Contained CSS Architecture

This release introduces a major architectural improvement to the UI Design Workflow, removing the placeholder mechanism and enabling agents to generate fully self-contained CSS files directly from design tokens.

#### Changed

**UI Design Workflow V2 Commands**:
- **`/workflow:ui-design:generate-v2`**: Enhanced prototype generation with self-contained CSS
  - Agents now read `design-tokens.json` and generate independent CSS files
  - CSS contains direct token values (e.g., `#3b82f6`) instead of `var()` references
  - HTML files reference CSS directly: `<link rel="stylesheet" href="page-style-1-layout-2.css">`
  - No more placeholder mechanism or post-processing steps

- **`/workflow:ui-design:explore-auto-v2`**: Updated to use new generation architecture
  - Automatic coordination with `generate-v2` command
  - Streamlined workflow without placeholder replacement

**Removed Dependencies**:
- ❌ **No more `tokens.css`**: Eliminated intermediate CSS variable files
- ❌ **No more Phase 1.6**: Removed token-to-CSS conversion step
- ❌ **No more placeholder replacement**: Scripts no longer process `{{STYLE_CSS}}` placeholders

**Agent Instructions Enhanced**:
- Agents receive `design-tokens.json` as primary design system reference
- Direct CSS generation instructions with token value extraction guidance
- Better adaptation to `design_attributes` (density, visual_weight, formality, etc.)
- Example instruction: "Use color values for backgrounds, typography values for fonts"

**Script Simplification** (`ui-generate-preview-v2.sh`):
- Removed placeholder replacement logic (32 lines removed)
- Focus solely on preview file generation (compare.html, index.html, PREVIEW.md)
- Cleaner, more focused responsibility

#### Improved

**Style Differentiation**:
- 🎨 **Better Style Diversity**: Agents can now freely adapt token values based on design philosophy
- 🎯 **Stronger Visual Identity**: Each style variant can use different color spaces, typography scales
- 💡 **Design-Aware Selection**: Agents intelligently select tokens matching design_attributes

**Workflow Simplicity**:
- 📉 **Reduced Complexity**: 346 lines of code removed (net reduction)
- ⚡ **Fewer Steps**: Eliminated intermediate conversion and replacement phases
- 🔧 **Easier Debugging**: All styling visible directly in generated CSS files
- 📝 **Clearer Agent Tasks**: Agents have single, focused responsibility

**CSS Generation Quality**:
- 🎨 **Fully Embodies Design**: CSS directly reflects design token values
- 🔄 **No External Dependencies**: Each CSS file is completely self-contained
- 📊 **Better Adaptation**: Agents can adjust values based on layout context
- 🎯 **Style-Specific Implementation**: Same layout + different style = truly different CSS

#### Technical Details

**Before (v4.2.x)**:
```html
<!-- Agent generates HTML with placeholders -->
<link rel="stylesheet" href="{{TOKEN_CSS}}">
<link rel="stylesheet" href="{{STRUCTURAL_CSS}}">

<!-- Phase 1.6: Convert design-tokens.json → tokens.css -->
<!-- Phase 3a: Replace placeholders with actual paths -->
```

**After (v4.3.0)**:
```html
<!-- Agent generates HTML with direct reference -->
<link rel="stylesheet" href="dashboard-style-1-layout-2.css">

<!-- CSS contains direct values from design-tokens.json -->
.button { background: #3b82f6; font-size: 16px; }
```

**Workflow Comparison**:
```
Old Flow:
Phase 1.5: Inspiration → Phase 1.6: Token Conversion → Phase 2: Agent Gen →
Phase 3a: Replace Placeholders → Phase 3b: Preview

New Flow:
Phase 1.5: Inspiration → Phase 2: Agent Gen (reads tokens.json directly) →
Phase 3: Preview
```

#### Benefits

**Developer Experience**:
- 🚀 **Faster Execution**: Removed 2 intermediate processing steps
- 📁 **Simpler Output**: No more tokens.css files to manage
- 🔍 **Easier Inspection**: All styling visible in prototype CSS files
- 🎯 **Clearer Intent**: Direct mapping from design tokens to CSS

**Design Quality**:
- 🎨 **Richer Style Variations**: Agents can adapt token usage creatively
- 💪 **Stronger Differentiation**: Each style truly looks different
- 🎯 **Context-Aware Styling**: Agents adjust tokens based on layout needs
- ✨ **Better Design Expression**: No constraints from CSS variable structure

**Maintainability**:
- 📉 **Less Code**: 346 lines removed (5 files modified)
- 🔧 **Fewer Moving Parts**: Removed token conversion and placeholder systems
- 📝 **Clearer Responsibilities**: Scripts focus on single purpose
- 🧪 **Easier Testing**: Self-contained files easier to validate

#### Files Changed

**Commands Updated**:
- `.claude/commands/workflow/ui-design/generate-v2.md`: Removed Phase 1.6 and Phase 3a, updated agent instructions
- `.claude/commands/workflow/ui-design/explore-auto-v2.md`: Updated to work with new architecture
- `.claude/commands/workflow/ui-design/generate.md`: Documentation updates
- `.claude/commands/workflow/ui-design/extract.md`: Documentation updates

**Scripts Modified**:
- `.claude/scripts/ui-generate-preview-v2.sh`: Removed placeholder replacement (32 lines)

**Total Impact**:
- 5 files changed
- 471 insertions, 817 deletions
- Net: -346 lines (31% reduction in UI generation code)

#### Migration Notes

**No Breaking Changes** for users:
- ✅ V2 commands are separate from V1 (`generate-v2` vs `generate`)
- ✅ Existing workflows continue to work unchanged
- ✅ New commands are opt-in

**For New Projects**:
- Use `/workflow:ui-design:generate-v2` for better style differentiation
- Use `/workflow:ui-design:explore-auto-v2` for automatic workflow

**Design Token Changes**:
- `design-tokens.json` structure unchanged
- `tokens.css` files no longer generated (V2 commands only)
- Style guides (`style-guide.md`) unchanged

## [4.2.1] - 2025-10-10

### 📝 Command Renaming & Documentation Refactoring

This release includes a command rename for better clarity and refactors UI design workflow documentation for improved maintainability.

#### Changed

**Command Renaming**:
- **`/workflow:concept-verify` → `/workflow:concept-clarify`**: Renamed for clearer intent
  - Better reflects the command's purpose of clarifying underspecified areas
  - Updated all internal references and documentation
  - Command functionality remains unchanged

**explore-auto.md** (formerly `auto.md`):
- **File Reorganization**: Reduced from 540 to 435 lines (19.4% reduction)
- **Merged Duplicate Content**: Consolidated Overview, Coordinator Role, and Execution Model into single "Overview & Execution Model" section
- **Simplified Core Rules**: From verbose descriptions to 5 concise rules
- **Streamlined TodoWrite Pattern**: From detailed steps to concise mode with comments
- **Preserved Functionality**: All 6-phase execution logic, intelligent parsing, interactive confirmation, and matrix mode intact

**imitate-auto.md** (NEW command):
- **File Reorganization**: Reduced from 566 to 475 lines (16.1% reduction)
- **Merged Sections**: Combined Overview, Core Philosophy, Execution Model, and Workflow Position into unified structure
- **Simplified Phase 0.5**: Screenshot capture logic complete but reduced redundant error handling
- **Consolidated Performance**: Merged "Key Differences" and "Performance Benefits" into single comparison table
- **Preserved Functionality**: All 5-phase execution, auto-screenshot mechanism, direct token extraction, and error handling intact

#### Improved

**Documentation Quality**:
- 📚 Clearer structure with merged duplicate concepts
- 🎯 Reduced redundancy across command documentation
- ✨ Consistent formatting and organization patterns
- 📖 Improved maintainability with better content separation
- 🔍 All key functionality points preserved and highlighted

**Total Impact**:
- **explore-auto.md**: 105 lines removed (19.4% reduction)
- **imitate-auto.md**: 91 lines removed (16.1% reduction)
- **Combined**: 196 lines of documentation optimized
- **Zero functionality loss**: All features, workflows, and technical details preserved

## [4.2.0] - 2025-10-09

### 🎯 Multi-Page Support Enhancement

Based on Gemini's analysis of the UI Design Workflow, this version implements four key optimizations to improve the multi-page design experience.

#### Added

- **Cross-Page Consistency Validation**: New `Phase 3.5` in `generate` command automatically validates design consistency (shared components, tokens, accessibility) across multiple pages
- **Side-by-Side Prototype Comparison**: `compare.html` preview tool now includes "Side-by-Side" tab to compare any two prototypes with intelligent consistency hints
- **Batch Prototype Selection**: `compare.html` features "By Style" and "By Layout" buttons for quick bulk prototype selection

#### Changed

- **Enhanced Page Inference**: `auto` command's page detection uses multiple regex patterns with interactive user confirmation
- **Improved Export**: Selection export from `compare.html` is now more structured with detailed metadata

## [4.1.1] - 2025-10-09

### 🔧 Symlink Fix & Agent Optimization

#### Fixed

- **Windows Symbolic Link Creation**: Corrected `auto.md` workflow to use `mklink /D` on Windows, preventing duplicate directories instead of symlinks

#### Changed

- **Agent Allocation Strategy**: `generate.md` now allocates tasks by layout (layout-based) instead of style, improving performance and consistency for high variant counts by having one agent handle one layout strategy across multiple styles

## [4.1.0] - 2025-10-09

### 🔄 Matrix-Only UI Design Workflow

#### Changed

- **Matrix Mode by Default**: UI Design workflow now exclusively uses `style × layout` matrix mode with `--style-variants` and `--layout-variants` as standard parameters
- **Path Standardization**: Standalone design sessions saved to `.workflow/.scratchpad/` adhering to project architecture
- **Simplified Orchestration**: `auto.md` command simplified to use single `SlashCommand` for generation phase, removing complex loop logic

#### Removed

- **Deprecated Parameters**: Removed `--variants` and `--creative-variants` in favor of explicit `--style-variants` and `--layout-variants`
- **Standard/Creative Modes**: Distinction between these modes removed

---

## [4.0.2] - 2025-10-09

### 🔄 UI Design Workflow - Complete Refactoring

**BREAKING CHANGES**: Complete refactoring to pure Claude-native execution, removing all external tool dependencies.

#### Breaking Changes

**Command Path Migration**:
```bash
# ❌ Old (v4.0.1 and earlier)
/workflow:design:style-extract
/workflow:design:style-consolidate
/workflow:design:ui-generate
/workflow:design:design-update
/workflow:design:auto

# ✅ New (v4.0.2)
/workflow:ui-design:extract
/workflow:ui-design:consolidate
/workflow:ui-design:generate
/workflow:ui-design:update
/workflow:ui-design:auto
```

**Parameter Removal**:
- **`--tool` parameter removed**: All commands now use Claude-native execution exclusively
- No more `--tool gemini` or `--tool codex` options
- Simplified command syntax

**Execution Model Changes**:
```bash
# ❌ Old: External CLI tools required
# Required: gemini-wrapper, codex, qwen-wrapper
/workflow:design:style-extract --tool gemini --images "refs/*.png"
/workflow:design:style-consolidate --tool gemini --variants "variant-1,variant-2"
/workflow:design:ui-generate --tool codex --pages "dashboard,auth"

# ✅ New: Pure Claude + agents
/workflow:ui-design:extract --images "refs/*.png" --variants 3
/workflow:ui-design:consolidate --variants "variant-1,variant-2"
/workflow:ui-design:generate --pages "dashboard,auth" --variants 2
```

#### Removed

**External Tool Dependencies**:
- `gemini-wrapper` calls removed from style-extract and style-consolidate
- `codex` calls removed from style-consolidate and ui-generate
- `qwen-wrapper` calls removed entirely
- All `bash()` wrapped CLI tool invocations eliminated

**Intermediate Output Files**:
- `semantic_style_analysis.json` (replaced by embedded data in style-cards.json)
- `initial_analysis.json` (analysis now done in single pass)
- `style-philosophy.md` (integrated into style-guide.md)
- Reduced from 7+ files to 4 essential files per phase

**Execution Modes**:
- "conventional" mode removed from ui-generate (codex dependency)
- "cli" mode removed from style-consolidate (external tool dependency)
- Unified to agent-only execution

#### Changed

**style-extract (`/workflow:ui-design:extract`)**:
- **Before**: Multi-step with gemini-wrapper + codex
  - Step 1: Claude analysis → initial_analysis.json
  - Step 2: gemini-wrapper → semantic_style_analysis.json
  - Step 3: codex → design-tokens.json + tailwind-tokens.js
  - Output: 4 files
- **After**: Single-pass Claude analysis
  - Step 1: Claude analysis → style-cards.json (with embedded proposed_tokens)
  - Output: 1 file
- **New structure**: `style-cards.json` includes complete `proposed_tokens` object per variant
- **Reproducibility**: 100% deterministic with Claude-only execution

**style-consolidate (`/workflow:ui-design:consolidate`)**:
- **Before**: Dual-tool approach
  - Step 1: gemini-wrapper → style-philosophy.md
  - Step 2: codex → design-tokens.json + validation
  - Mode detection: cli vs agent
- **After**: Single-pass Claude synthesis
  - Step 1: Claude reads `proposed_tokens` from style-cards.json
  - Step 2: Claude generates all 4 files in one prompt
  - Output: design-tokens.json, style-guide.md, tailwind.config.js, validation-report.json
- **Removed**: `--tool` parameter and mode detection logic

**ui-generate (`/workflow:ui-design:generate`)**:
- **Before**: Three execution modes
  - conventional: codex CLI calls
  - agent: Task(conceptual-planning-agent)
  - Mode detection based on `--tool` flag
- **After**: Unified agent-only execution
  - standard: Single Task(conceptual-planning-agent) for consistent variants
  - creative: Parallel Task(conceptual-planning-agent) for diverse layouts
  - Only `--variants` or `--creative-variants` determines mode
- **Removed**: `--tool` parameter, conventional mode

**design-update (`/workflow:ui-design:update`)**:
- **Before**: References `style-philosophy.md`
- **After**: Extracts philosophy from `style-guide.md`
- **Changed**: Adapted to new 4-file output structure from consolidate phase

**auto (`/workflow:ui-design:auto`)**:
- **Before**: Passed `--tool` flags to sub-commands
- **After**: No tool parameters, pure orchestration
- **Simplified**: Command construction logic (no mode detection)
- **Examples**: Updated all 3 example flows

#### Added

**Enhanced style-cards.json Structure**:
```json
{
  "extraction_metadata": {
    "session_id": "WFS-xxx",
    "input_mode": "image|text|hybrid",
    "timestamp": "ISO-8601",
    "variants_count": 3
  },
  "style_cards": [
    {
      "id": "variant-1",
      "name": "Modern Minimalist",
      "description": "...",
      "design_philosophy": "...",
      "preview": { "primary": "oklch(...)", ... },
      "proposed_tokens": {
        "colors": { /* complete color system */ },
        "typography": { /* complete typography system */ },
        "spacing": { /* complete spacing scale */ },
        "border_radius": { /* border radius scale */ },
        "shadows": { /* shadow system */ },
        "breakpoints": { /* responsive breakpoints */ }
      }
    }
  ]
}
```

**Unified Output Structure**:
- `style-extraction/`: style-cards.json (1 file)
- `style-consolidation/`: design-tokens.json, style-guide.md, tailwind.config.js, validation-report.json (4 files)
- `prototypes/`: HTML/CSS files + index.html + compare.html + PREVIEW.md

#### Improved

**Performance**:
- **Faster execution**: No external process spawning
- **Reduced I/O**: Fewer intermediate files
- **Parallel efficiency**: Native agent parallelization

**Reliability**:
- **Zero external dependencies**: No gemini-wrapper, codex, or qwen-wrapper required
- **No API failures**: Eliminates external API call failure points
- **Consistent output**: Deterministic JSON structure

**Maintainability**:
- **Simpler codebase**: 5 commands, unified patterns
- **Clear data flow**: style-cards → design-tokens → prototypes
- **Easier debugging**: All logic visible in command files

**Reproducibility**:
- **Deterministic structure**: Same inputs → same output structure
- **Version-controlled logic**: All prompts in .md files
- **No black-box tools**: Complete transparency

#### Migration Guide

**For Standalone Usage**:
```bash
# Old command format
/workflow:design:auto --tool gemini --prompt "Modern blog" --variants 3

# New command format (auto-migrated)
/workflow:ui-design:auto --prompt "Modern blog" --variants 3
```

**For Integrated Workflow Sessions**:
```bash
# Old workflow
/workflow:design:style-extract --session WFS-xxx --tool gemini --images "refs/*.png"
/workflow:design:style-consolidate --session WFS-xxx --tool gemini --variants "variant-1,variant-2"
/workflow:design:ui-generate --session WFS-xxx --tool codex --pages "dashboard,auth"
/workflow:design:design-update --session WFS-xxx

# New workflow (simplified)
/workflow:ui-design:extract --session WFS-xxx --images "refs/*.png" --variants 2
/workflow:ui-design:consolidate --session WFS-xxx --variants "variant-1,variant-2"
/workflow:ui-design:generate --session WFS-xxx --pages "dashboard,auth" --variants 2
/workflow:ui-design:update --session WFS-xxx
```

**Configuration Changes Required**: None - all external tool configurations can be removed

#### Files Changed

**Renamed/Relocated**:
- `.claude/commands/workflow/design/` → `.claude/commands/workflow/ui-design/`
- All command files updated with new paths

**Modified Commands**:
- `style-extract.md` → `extract.md` (complete rewrite)
- `style-consolidate.md` → `consolidate.md` (complete rewrite)
- `ui-generate.md` → `generate.md` (simplified)
- `design-update.md` → `update.md` (adapted to new structure)
- `auto.md` (updated orchestration)

**Documentation**:
- Updated all command examples
- Updated parameter descriptions
- Added Key Improvements sections
- Clarified Integration Points

## [4.0.1] - 2025-10-07

### 🎯 Intelligent Page Inference

**IMPROVEMENT**: `--pages` parameter is now **optional** with smart inference from prompt or session context.

**Changes**:
- `--pages` parameter: Now optional, intelligently inferred from:
  1. Explicit `--pages` if provided
  2. `--prompt` text analysis (e.g., "blog with home, article pages" → ["home", "article"])
  3. `--session` synthesis-specification.md extraction
  4. Default: ["home"]

**New Examples**:
```bash
# Simplest - pages inferred from prompt
/workflow:ui-design:auto --prompt "Modern blog with home, article and author pages"

# Explicit override if needed
/workflow:ui-design:auto --prompt "SaaS app" --pages "dashboard,settings,billing"
```

**Commands Updated**:
- `/workflow:ui-design:auto`: All parameters now optional
- `/workflow:ui-design:ui-generate`: `--pages` optional with smart inference

## [4.0.0] - 2025-10-07

### 🚀 UI Design Workflow V2 - Agent Mode & Flexible Inputs

**BREAKING CHANGES**: Complete redesign of UI design workflow with mandatory new parameter structure. All old command formats are deprecated.

This major release introduces agent-driven creative exploration, unified variant control, dual-mode support (standalone/integrated), and flexible input sources (images + text prompts).

#### Breaking Changes

**Required Migration**:
- **Old format no longer supported**: Commands using old parameter structure will fail
- **All parameters now optional**: Smart defaults and inference for all parameters
- **`--session`**: Optional, omitting enables standalone mode
- **`--images`**: Optional with default `design-refs/*`
- **`--pages`**: Optional, inferred from prompt or session (as of v4.0.1)
- **Removed `--style-overrides`**: Use `--prompt` instead

**Migration Guide**:
```bash
# ❌ Old (v3.5.0 and earlier) - NO LONGER WORKS
/workflow:ui-design:style-extract --session WFS-auth --images "design-refs/*.png"
/workflow:ui-design:ui-generate --session WFS-auth --pages "login,register"

# ✅ New (v4.0.1) - All parameters optional
/workflow:ui-design:style-extract --images "design-refs/*.png" --variants 3
/workflow:ui-design:ui-generate --variants 2

# ✅ Simplest form (pages inferred from prompt)
/workflow:ui-design:auto --prompt "Modern blog with home, article and author pages"

# ✅ With agent mode and explicit pages
/workflow:ui-design:auto --prompt "Modern SaaS" --pages "dashboard,settings" --variants 3 --use-agent
```

**Deprecated Commands**:
- Old `style-extract` format without `--variants`
- Old `ui-generate` format without `--use-agent` support
- `--style-overrides` parameter (replaced by `--prompt`)

#### Added

**Unified Variant Control**:
- **`--variants <count>`**: Single parameter controls both style cards AND UI prototypes generation
  - Default: 3 | Range: 1-5
  - Data flow: `auto.md` → `style-extract` → `ui-generate`
  - Example: `--variants 3` generates 3 style cards and 3 UI variants per page

**Agent Creative Exploration Mode** (`--use-agent`):
- **style-extract**: Parallel generation of distinctly different design directions
  - Conventional mode: Subtle variations within same core style
  - Agent mode: Dramatically different aesthetics (e.g., "Modern Minimalist" vs "Brutalist Tech" vs "Organic Warmth")
  - Uses `conceptual-planning-agent` for creative exploration
- **ui-generate**: Diverse layout strategies exploration
  - Conventional mode: Minor layout differences
  - Agent mode: Structural variations (F-Pattern, Asymmetric Grid, Card-Based Modular)
  - Parallel execution for efficiency

**Dual Mode Support**:
- **Integrated Mode** (with `--session`): Works within existing workflow session
  - Location: `.workflow/WFS-{session}/`
  - Reads from `.brainstorming/` artifacts
  - Phase 4 (design-update) updates synthesis-specification.md
- **Standalone Mode** (without `--session`): Independent quick prototyping
  - Auto-creates: `design-session-YYYYMMDD-HHMMSS/`
  - No dependency on brainstorming phase
  - Phase 4 (design-update) is skipped
  - Outputs final summary instead

**Dual Input Source Support**:
- **`--images`**: Reference image paths (optional, default: `design-refs/*`)
- **`--prompt`**: Text description of design style (NEW)
- **Hybrid Mode**: Both combined - text guides image analysis
- Input modes:
  - Pure image: Existing triple vision analysis
  - Pure text: Claude keywords → Gemini philosophy → Codex tokens
  - Hybrid: Text as context for visual analysis

#### Changed

**New Command Interface** (v4.0.1):
- **`/workflow:ui-design:auto`**:
  - All parameters optional with smart defaults
  - `--prompt <desc>`: Design description (infers pages automatically)
  - `--images <glob>`: Reference images (default: `design-refs/*`)
  - `--pages <list>`: Explicit page override (auto-inferred if omitted)
  - `--session <id>`, `--variants <count>`, `--use-agent`, `--batch-plan`
  - Examples:
    - Minimal: `/workflow:ui-design:auto --prompt "Modern blog with home and article pages"`
    - Agent Mode: `/workflow:ui-design:auto --prompt "SaaS dashboard and settings" --variants 3 --use-agent`
    - Hybrid: `/workflow:ui-design:auto --images "refs/*.png" --prompt "E-commerce: home, product, cart"`

- **`/workflow:ui-design:style-extract`**:
  - At least one of `--images` or `--prompt` recommended
  - All other parameters optional
  - Agent mode: Parallel generation of diverse design directions

- **`/workflow:ui-design:ui-generate`**:
  - All parameters optional (pages inferred from session or defaults to ["home"])
  - `--pages <list>`: Optional explicit page list
  - Agent mode: Parallel layout exploration (F-Pattern, Grid, Asymmetric)

#### Usage Examples

**Standalone Quick Prototyping**:
```bash
# Pure text with page inference (simplest)
/workflow:ui-design:auto --prompt "Modern minimalist blog with home, article and author pages, dark theme" --use-agent

# Pure image with inferred pages
/workflow:ui-design:auto --images "refs/*.png" --variants 2

# Hybrid input with explicit page override
/workflow:ui-design:auto --images "current-app.png" --prompt "Modernize to Linear.app style" --pages "tasks,settings" --use-agent
```

**Integrated Workflow Enhancement**:
```bash
# Within existing workflow (pages inferred from synthesis)
/workflow:ui-design:auto --session WFS-app-refresh --images "refs/*.png" --variants 3 --use-agent
```

#### Technical Details

**Agent Mode Architecture**:
- Uses `conceptual-planning-agent` for both style-extract and ui-generate phases
- Parallel task execution: N variants × M pages run concurrently
- Theme diversity strategies:
  - style-extract: Creative theme generation (Minimalist, Brutalist, Organic)
  - ui-generate: Layout strategy assignment (F-Pattern, Grid, Asymmetric)
- Quality assurance: All variants maintain strict token adherence and WCAG AA compliance

**Mode Detection Logic**:
```bash
# Session mode
IF --session provided: mode = "integrated"
ELSE: mode = "standalone", auto-create design-session-YYYYMMDD-HHMMSS/

# Execution mode
IF --use-agent: mode = "agent" (creative exploration)
ELSE: mode = "conventional" (triple vision)

# Input mode
IF --images AND --prompt: mode = "hybrid"
ELSE IF --images: mode = "image"
ELSE IF --prompt: mode = "text"
```

#### Upgrade Benefits

**Simplified Workflow**:
- Fewer required parameters (only `--pages` mandatory)
- Smart defaults reduce boilerplate
- Standalone mode for quick prototyping without workflow setup

**Enhanced Capabilities**:
- Agent-driven creative exploration produces diverse designs
- Parallel execution improves performance
- Text prompts enable design without reference images

**Quality Improvements**:
- All variants maintain strict token adherence
- WCAG AA compliance validated automatically
- Better separation of concerns (style vs layout)

## [3.5.0] - 2025-10-06

### 🎨 UI Design Workflow with Triple Vision Analysis & Interactive Preview

This release introduces a comprehensive UI design workflow system with triple vision analysis capabilities, interactive user checkpoints, zero agent overhead, and enhanced preview tools for real-time prototype comparison.

#### Added

**New UI Design Workflow System**:
- **`/workflow:ui-design:auto`**: Semi-autonomous UI design workflow orchestrator
  - Interactive checkpoints for user style selection and prototype confirmation
  - Optional batch task generation with `--batch-plan` flag
  - Pause-and-continue pattern at critical decision points
  - Automatic progression between phases after user input
  - Support for multiple UI variants per page (`--variants` parameter)

**Triple Vision Analysis Architecture**:
- **Phase 1: Claude Code Vision Analysis**: Quick initial visual analysis using native Read tool
- **Phase 2: Gemini Vision Analysis**: Deep semantic understanding of design intent
- **Phase 3: Codex Vision Analysis**: Structured pattern recognition with `-i` parameter
- **Phase 4: Consensus Synthesis**: Weighted combination by main Claude agent
- **Synthesis Strategy**:
  - Color system: Consensus with Codex precision preference
  - Typography: Gemini semantic + Codex measurements
  - Spacing: Cross-validation across all three sources
  - Design philosophy: Weighted with Gemini highest priority
  - Conflict resolution: Majority vote or synthesis-specification.md context

**Individual Design Commands**:

**`/workflow:ui-design:style-extract`** - Extract design styles from reference images
- **Usage**: `/workflow:ui-design:style-extract --session <session_id> --images "<glob_pattern>"`
- **Examples**:
  ```bash
  /workflow:ui-design:style-extract --session WFS-auth --images "design-refs/*.png"
  /workflow:ui-design:style-extract --session WFS-dashboard --images "refs/dashboard-*.jpg"
  ```
- **Features**:
  - Triple vision analysis (Claude Code + Gemini + Codex)
  - Generates `semantic_style_analysis.json`, `design-tokens.json`, `style-cards.json`
  - Outputs multiple style variant cards for user selection
  - Direct bash execution (no agent wrappers)
  - Supports PNG, JPG, WebP image formats
- **Output**: `.design/style-extraction/` with analysis files and 2-3 style variant cards

**`/workflow:ui-design:style-consolidate`** - Consolidate selected style variants
- **Usage**: `/workflow:ui-design:style-consolidate --session <session_id> --variants "<variant_ids>"`
- **Examples**:
  ```bash
  /workflow:ui-design:style-consolidate --session WFS-auth --variants "variant-1,variant-3"
  /workflow:ui-design:style-consolidate --session WFS-dashboard --variants "variant-2"
  ```
- **Features**:
  - Validates and merges design tokens from selected variants
  - Generates finalized `design-tokens.json`, `style-guide.md`, `tailwind.config.js`
  - WCAG AA compliance validation (contrast ≥4.5:1 for text)
  - Token coverage ≥90% requirement
  - OKLCH color format with fallback
- **Output**: `.design/style-consolidation/` with validated design system files

**`/workflow:ui-design:ui-generate`** - Generate production-ready UI prototypes *(NEW: with preview enhancement)*
- **Usage**: `/workflow:ui-design:ui-generate --session <session_id> --pages "<page_list>" [--variants <count>] [--style-overrides "<path_or_json>"]`
- **Examples**:
  ```bash
  /workflow:ui-design:ui-generate --session WFS-auth --pages "login,register"
  /workflow:ui-design:ui-generate --session WFS-dashboard --pages "dashboard" --variants 3
  /workflow:ui-design:ui-generate --session WFS-auth --pages "login" --style-overrides "overrides.json"
  ```
- **Features**:
  - Token-driven HTML/CSS generation with Codex
  - Support for `--style-overrides` parameter for runtime customization
  - Generates `{page}-variant-{n}.html`, `{page}-variant-{n}.css` per page
  - **🆕 Auto-generates preview files**: `index.html`, `compare.html`, `PREVIEW.md`
  - Semantic HTML5 with ARIA attributes
  - Responsive design with token-based breakpoints
  - Complete standalone prototypes (no external dependencies)
- **Output**: `.design/prototypes/` with HTML/CSS files and preview tools
- **Preview**: Open `index.html` in browser or start local server for interactive preview

**`/workflow:ui-design:design-update`** - Integrate design system into brainstorming
- **Usage**: `/workflow:ui-design:design-update --session <session_id> [--selected-prototypes "<prototype_ids>"]`
- **Examples**:
  ```bash
  /workflow:ui-design:design-update --session WFS-auth
  /workflow:ui-design:design-update --session WFS-auth --selected-prototypes "login-variant-1,register-variant-2"
  ```
- **Features**:
  - Updates `synthesis-specification.md` with UI/UX guidelines section
  - Creates/updates `ui-designer/style-guide.md`
  - Makes design tokens available for task generation phase
  - Merges selected prototype recommendations into brainstorming artifacts
- **Output**: Updated brainstorming files with design system integration

**`/workflow:ui-design:auto`** - Semi-autonomous orchestrator with interactive checkpoints
- **Usage**: `/workflow:ui-design:auto --session <session_id> --images "<glob>" --pages "<list>" [--variants <count>] [--batch-plan]`
- **Examples**:
  ```bash
  /workflow:ui-design:auto --session WFS-auth --images "design-refs/*.png" --pages "login,register"
  /workflow:ui-design:auto --session WFS-dashboard --images "refs/*.jpg" --pages "dashboard" --variants 3 --batch-plan
  ```
- **Features**:
  - Orchestrates entire design workflow with pause-and-continue checkpoints
  - Checkpoint 1: User selects style variants after extraction
  - Checkpoint 2: User confirms prototypes before design-update
  - Optional `--batch-plan` for automatic task generation after design-update
  - Progress tracking with TodoWrite integration
- **Workflow**: style-extract → [USER SELECTS] → style-consolidate → ui-generate → [USER CONFIRMS] → design-update → [optional batch-plan]

**Interactive Checkpoint System**:
- **Checkpoint 1 (After style-extract)**: User selects preferred style variants
  - Command: `/workflow:ui-design:style-consolidate --session WFS-xxx --variants "variant-1,variant-3"`
  - Workflow pauses until user runs consolidation command

- **Checkpoint 2 (After ui-generate)**: User confirms selected prototypes
  - Command: `/workflow:ui-design:design-update --session WFS-xxx --selected-prototypes "page-variant-1,page-variant-2"`
  - Workflow pauses until user runs design-update command

**Design System Features**:
- **OKLCH Color Format**: Perceptually uniform color space for design tokens
- **W3C Design Tokens Compatibility**: Standard-compliant token format
- **Style Override Mechanism**: Runtime token merging using jq
- **Batch Task Generation**: Automatic `/workflow:plan` invocation for each page
- **Accessibility Validation**: WCAG 2.1 AA compliance checks

**Preview Enhancement System** *(NEW)*:
- **`index.html`**: Master preview navigation page
  - Grid layout of all generated prototypes
  - Quick links to individual variants
  - Metadata display (session ID, timestamps, page info)
  - Direct access to implementation notes

- **`compare.html`**: Interactive side-by-side comparison
  - Iframe-based comparison for multiple variants
  - Responsive viewport toggles (Desktop 100%, Tablet 768px, Mobile 375px)
  - Synchronized scrolling option
  - Dynamic page switching dropdown
  - Real-time variant comparison

- **`PREVIEW.md`**: Comprehensive preview instructions
  - Direct browser opening guide
  - Local server setup (Python, Node.js, PHP, VS Code Live Server)
  - Browser compatibility notes
  - Troubleshooting guide
  - File structure overview

**Preview Workflow**:
```bash
# After ui-generate completes:
cd .workflow/WFS-{session}/.design/prototypes

# Option 1: Direct browser (simplest)
open index.html  # or double-click

# Option 2: Local server (recommended)
python -m http.server 8080  # Visit http://localhost:8080

# Features:
- index.html: Browse all prototypes
- compare.html: Side-by-side comparison with viewport controls
- Responsive preview: Test mobile, tablet, desktop views
- Synchronized scrolling: Compare layouts in sync
```

#### Changed

**Agent Architecture Simplification**:
- **Removed agent wrappers** from `style-extract` and `ui-generate` commands
  - Previously used `Task(conceptual-planning-agent)` for simple bash execution
  - Now executes `gemini-wrapper` and `codex` commands directly via Bash tool
  - Reduced execution overhead and complexity
  - Preserved all functionality while improving performance

**Command Execution Pattern**:
- **Direct Bash Execution**: All CLI tools now use direct bash commands
  - Gemini Vision: `bash(gemini-wrapper --approval-mode yolo -p "...")`
  - Codex Vision: `bash(codex -i {images} --full-auto exec "..." -s danger-full-access)`
  - Codex Token Generation: `bash(codex --full-auto exec "..." -s danger-full-access)`
  - No intermediate agent layers

**Workflow Integration**:
- Design phase now optional but recommended for UI-heavy projects
- Seamless integration with existing brainstorming → planning → execution flow
- Design artifacts automatically discovered by `task-generate` if present
- UI tasks automatically include `load_design_tokens` in flow_control

**Updated Documentation**:
- **README.md**: Added UI Design Workflow section in Getting Started
- **README_CN.md**: Chinese documentation updated with design workflow
- **Command Reference**: Added 5 new `/workflow:ui-design:*` commands
- **Phase Renumbering**: Shifted phases to accommodate new Phase 2 (UI Design)

#### Benefits

**User Experience**:
- 🎨 **Visual Validation**: Users confirm design before implementation starts
- ⏸️ **Interactive Control**: Critical design decisions require explicit user approval
- 👁️ **Comprehensive Analysis**: Three AI vision sources provide robust style extraction
- 🎯 **Zero Waiting**: Direct bash execution eliminates agent overhead
- 📦 **Automation Ready**: Optional batch task generation accelerates workflow

**Code Quality**:
- 🔒 **Token Enforcement**: 100% CSS values use custom properties (verified)
- ♿ **Accessibility**: WCAG AA validated at design phase
- 🎨 **Consistency**: Single source of truth for visual design (design-tokens.json)
- 🧪 **Production Ready**: Semantic HTML5, responsive, accessible prototypes

**Development Workflow**:
- 🔄 **Seamless Integration**: Optional design phase fits between brainstorming and planning
- 🚀 **Backward Compatible**: Existing workflows unaffected if design phase skipped
- 📊 **Better Planning**: Design system context improves task generation quality
- 🎯 **Focused Implementation**: Developers work from validated prototypes and tokens

#### Technical Details

**Triple Vision Analysis Flow**:
```
Reference Images
  ↓
Phase 2: Claude Code (Read tool) → claude_vision_analysis.json
Phase 3: Gemini Vision (gemini-wrapper) → gemini_vision_analysis.json
Phase 4: Codex Vision (codex -i) → codex_vision_analysis.json
  ↓
Phase 5: Main Claude Synthesis → semantic_style_analysis.json
  ↓
Phase 6: Codex Token Generation → design-tokens.json, style-cards.json
```

**Checkpoint Workflow Pattern**:
```
User: /workflow:ui-design:auto --session WFS-xxx --images "refs/*.png" --pages "dashboard,auth"
  ↓
Phase 1: style-extract (automatic)
  ↓ [CHECKPOINT 1: User selects style variants]
User: /workflow:ui-design:style-consolidate --session WFS-xxx --variants "variant-1,variant-3"
  ↓
Phase 3: ui-generate (automatic after Phase 2)
  ↓ [CHECKPOINT 2: User confirms prototypes]
User: /workflow:ui-design:design-update --session WFS-xxx --selected-prototypes "dashboard-variant-1,auth-variant-2"
  ↓
Phase 5: batch-plan (optional, automatic if --batch-plan flag)
```

**Output Structure**:
```
.workflow/WFS-{session}/.design/
├── style-extraction/
│   ├── claude_vision_analysis.json
│   ├── gemini_vision_analysis.json
│   ├── codex_vision_analysis.json
│   ├── semantic_style_analysis.json (synthesis)
│   ├── design-tokens.json (preliminary)
│   └── style-cards.json (variants for selection)
├── style-consolidation/
│   ├── style-philosophy.md
│   ├── design-tokens.json (final, validated)
│   ├── style-guide.md
│   ├── tailwind.config.js
│   └── validation-report.json
└── prototypes/
    ├── {page}-variant-{n}.html (per page, per variant)
    ├── {page}-variant-{n}.css (token-driven styles)
    ├── {page}-variant-{n}-notes.md (implementation notes)
    └── design-tokens.css (CSS custom properties)
```

**New Agent Documentation**:
- **`ui-design-agent.md`**: Specialized agent for UI/UX design workflows
  - Vision analysis, token generation, prototype creation capabilities
  - Multi-modal vision provider strategy (Gemini primary, Codex fallback)
  - Quality gates: WCAG AA, token coverage ≥90%, component mapping ≥95%
  - Flow control specification for 3 design phases

#### Use Cases

**When to Use Design Workflow**:
- User-facing applications with visual design requirements
- Design system creation and maintenance
- Brand-critical user interfaces
- Projects requiring accessibility compliance
- Multi-page applications with consistent styling

**When to Skip Design Workflow**:
- Backend APIs without UI components
- CLI tools and command-line applications
- Quick prototypes and MVPs
- Projects with existing design systems

---

## [3.4.2] - 2025-10-05

### 📚 CLI Documentation Refactoring

This release focuses on eliminating redundant documentation by establishing a single source of truth (SSOT) pattern for CLI command references.

#### Changed

**CLI Command Documentation Refactoring**:
- Refactored 7 CLI command documentation files to eliminate redundancy
- Removed **681 total lines** of duplicate content across all files
- Established implicit reference pattern to `intelligent-tools-strategy.md` (loaded in memory)
- Preserved all unique command-specific content and capabilities

**Specific File Reductions**:
- `analyze.md`: 117→61 lines (48% reduction)
- `chat.md`: 118→62 lines (47% reduction)
- `execute.md`: 180→100 lines (44% reduction)
- `codex-execute.md`: 481→473 lines (2% - preserved unique workflow content)
- `mode/bug-index.md`: 144→75 lines (48% reduction)
- `mode/code-analysis.md`: 188→76 lines (60% reduction)
- `mode/plan.md`: 100→76 lines (24% reduction)

**Removed Duplicate Sections**:
- Universal Command Template (now only in `intelligent-tools-strategy.md`)
- File Pattern Reference (centralized in strategy guide)
- Complex Pattern Discovery (centralized in strategy guide)
- MODE Field Definition (centralized in strategy guide)
- Enhancement Integration details (referenced implicitly)
- Session Persistence details (referenced implicitly)

**Preserved Unique Content**:
- Command-specific purpose and parameters
- Unique execution flows and capabilities
- Specialized features (YOLO permissions, task decomposition, resume patterns)
- Command-specific examples and workflows
- File pattern auto-detection logic for analyze command
- Group-based execution workflow for codex-execute command

#### Added

**Documentation Enhancement** (prior to refactoring):
- Enhanced file pattern examples and complex pattern discovery documentation
- Added semantic discovery workflow integration examples

#### Technical Details

**Single Source of Truth Pattern**:
All CLI commands now reference `intelligent-tools-strategy.md` for:
- Universal command template structure
- File pattern syntax and examples
- Complex pattern discovery workflows
- MODE field definitions and permissions
- Tool-specific features and capabilities

**Reference Pattern**:
```markdown
## Notes
- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
```

This approach reduces maintenance overhead while ensuring documentation consistency across all CLI commands.

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