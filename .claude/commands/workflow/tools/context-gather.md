---
name: gather
description: Intelligently collect project context using general-purpose agent based on task description and package into standardized JSON
argument-hint: "--session WFS-session-id \"task description\""
examples:
  - /workflow:tools:context-gather --session WFS-user-auth "Implement user authentication system"
  - /workflow:tools:context-gather --session WFS-payment "Refactor payment module API"
  - /workflow:tools:context-gather --session WFS-bugfix "Fix login validation error"
---

# Context Gather Command (/workflow:tools:context-gather)

## Overview
Agent-driven intelligent context collector that gathers relevant information from project codebase, documentation, and dependencies based on task descriptions, generating standardized context packages.

## Core Philosophy
- **Agent-Driven**: Delegate execution to general-purpose agent for autonomous operation
- **Two-Phase Flow**: Discovery (context loading) → Execution (context gathering and packaging)
- **Memory-First**: Reuse loaded documents from conversation memory
- **MCP-Enhanced**: Use MCP tools for advanced code analysis and file discovery
- **Intelligent Collection**: Auto-identify relevant resources based on keyword analysis
- **Comprehensive Coverage**: Collect code, documentation, configurations, and dependencies
- **Standardized Output**: Generate unified format context-package.json

## Execution Lifecycle

### Phase 1: Discovery & Context Loading
**⚡ Memory-First Rule**: Skip file loading if documents already in conversation memory

**Agent Context Package**:
```javascript
{
  "session_id": "WFS-[session-id]",
  "task_description": "[user provided task description]",
  "session_metadata": {
    // If in memory: use cached content
    // Else: Load from .workflow/{session-id}/workflow-session.json
  },
  "mcp_capabilities": {
    // Agent will use these tools to discover project context
    "code_index": true,
    "exa_code": true,
    "exa_web": true
  }
}

// Agent will autonomously execute:
// - Project structure analysis: bash(~/.claude/scripts/get_modules_by_depth.sh)
// - Documentation loading: Read(CLAUDE.md), Read(README.md)
```

**Discovery Actions**:
1. **Load Session Context** (if not in memory)
   ```javascript
   if (!memory.has("workflow-session.json")) {
     Read(.workflow/{session-id}/workflow-session.json)
   }
   ```

### Phase 2: Agent Execution (Context Gathering & Packaging)

**Agent Invocation**:
```javascript
Task(
  subagent_type="general-purpose",
  description="Gather project context and generate context package",
  prompt=`
## Execution Context

**Session ID**: WFS-{session-id}
**Task Description**: {task_description}
**Mode**: Agent-Driven Context Gathering

## Phase 1: Discovery Results (Provided Context)

### Session Metadata
{session_metadata_content}

### MCP Capabilities
- code-index: Available for file discovery and code search
- exa-code: Available for external research
- exa-web: Available for web search

## Phase 2: Context Gathering Task

### Core Responsibilities
1. **Project Structure Analysis**: Execute get_modules_by_depth.sh for architecture overview
2. **Documentation Loading**: Load CLAUDE.md, README.md and relevant documentation
3. **Keyword Extraction**: Extract core keywords from task description
4. **Smart File Discovery**: Use MCP code-index tools to locate relevant files
5. **Code Structure Analysis**: Analyze project structure to identify relevant modules
6. **Dependency Discovery**: Identify tech stack and dependency relationships
7. **Context Packaging**: Generate standardized JSON context package

### Execution Process

#### Step 0: Foundation Setup (Execute First)
1. **Project Structure Analysis**
   Execute to get comprehensive architecture overview:
   \`\`\`javascript
   bash(~/.claude/scripts/get_modules_by_depth.sh)
   \`\`\`

2. **Load Project Documentation** (if not in memory)
   Load core project documentation:
   \`\`\`javascript
   Read(CLAUDE.md)
   Read(README.md)
   // Load other relevant documentation based on session context
   \`\`\`

#### Step 1: Task Analysis
1. **Keyword Extraction**
   - Parse task description to extract core keywords
   - Identify technical domain (auth, API, frontend, backend, etc.)
   - Determine complexity level (simple, medium, complex)

2. **Scope Determination**
   - Define collection scope based on keywords
   - Identify potentially involved modules and components
   - Set file type filters

#### Step 2: MCP-Enhanced File Discovery
1. **Code File Location**
   Use MCP code-index tools:
   \`\`\`javascript
   // Find files by pattern
   mcp__code-index__find_files(pattern="*{keyword}*")

   // Search code content
   mcp__code-index__search_code_advanced(
     pattern="{keyword_patterns}",
     file_pattern="*.{ts,js,py,go,md}",
     context_lines=3
   )

   // Get file summaries
   mcp__code-index__get_file_summary(file_path="relevant/file.ts")
   \`\`\`

2. **Configuration Files Discovery**
   Locate: package.json, requirements.txt, Cargo.toml, tsconfig.json, etc.

3. **Test Files Location**
   Find test files related to task keywords

#### Step 3: Intelligent Filtering & Association
1. **Relevance Scoring**
   - Score based on keyword match degree
   - Score based on file path relevance
   - Score based on code content relevance

2. **Dependency Analysis**
   - Analyze import/require statements
   - Identify inter-module dependencies
   - Determine core and optional dependencies

#### Step 4: Context Packaging
Generate standardized context-package.json following the format below

### Required Output

**Output Location**: \`.workflow/{session-id}/.process/context-package.json\`

**Output Format**:
\`\`\`json
{
  "metadata": {
    "task_description": "Implement user authentication system",
    "timestamp": "2025-09-29T10:30:00Z",
    "keywords": ["user", "authentication", "JWT", "login"],
    "complexity": "medium",
    "tech_stack": ["typescript", "node.js", "express"],
    "session_id": "WFS-user-auth"
  },
  "assets": [
    {
      "type": "documentation",
      "path": "CLAUDE.md",
      "relevance": "Project development standards and conventions",
      "priority": "high"
    },
    {
      "type": "documentation",
      "path": ".workflow/docs/architecture/security.md",
      "relevance": "Security architecture design guidance",
      "priority": "high"
    },
    {
      "type": "source_code",
      "path": "src/auth/AuthService.ts",
      "relevance": "Existing authentication service implementation",
      "priority": "high"
    },
    {
      "type": "source_code",
      "path": "src/models/User.ts",
      "relevance": "User data model definition",
      "priority": "medium"
    },
    {
      "type": "config",
      "path": "package.json",
      "relevance": "Project dependencies and tech stack",
      "priority": "medium"
    },
    {
      "type": "test",
      "path": "tests/auth/*.test.ts",
      "relevance": "Authentication related test cases",
      "priority": "medium"
    }
  ],
  "tech_stack": {
    "frameworks": ["express", "typescript"],
    "libraries": ["jsonwebtoken", "bcrypt"],
    "testing": ["jest", "supertest"]
  },
  "statistics": {
    "total_files": 15,
    "source_files": 8,
    "docs_files": 4,
    "config_files": 2,
    "test_files": 1
  }
}
\`\`\`

### Quality Validation

Before completion, verify:
- [ ] context-package.json created in correct location
- [ ] Valid JSON format with all required fields
- [ ] Metadata includes task description, keywords, complexity
- [ ] Assets array contains relevant files with priorities
- [ ] Tech stack accurately identified
- [ ] Statistics section provides file counts
- [ ] File relevance accuracy >80%
- [ ] No sensitive information exposed

### Performance Optimization

**Large Project Optimization**:
- File count limit: Maximum 50 files per type
- Size filtering: Skip oversized files (>10MB)
- Depth limit: Maximum search depth of 3 levels
- Use MCP tools for efficient discovery

**MCP Tools Integration**:
Agent should use MCP code-index tools when available:
\`\`\`javascript
// Set project path
mcp__code-index__set_project_path(path="{current_project_path}")

// Refresh index
mcp__code-index__refresh_index()

// Find files by pattern
mcp__code-index__find_files(pattern="*{keyword}*")

// Search code content
mcp__code-index__search_code_advanced(
  pattern="{keyword_patterns}",
  file_pattern="*.{ts,js,py,go,md}",
  context_lines=3
)
\`\`\`

**Fallback Strategy**:
When MCP tools unavailable, agent should use traditional commands:
- \`find\` for file discovery
- \`rg\` or \`grep\` for content search
- Bash commands from project structure analysis

## Output

Generate context-package.json and report completion:
- Task description: {description}
- Keywords extracted: {count}
- Files collected: {total}
  - Source files: {count}
  - Documentation: {count}
  - Configuration: {count}
  - Tests: {count}
- Tech stack identified: {frameworks/libraries}
- Output location: .workflow/{session-id}/.process/context-package.json
\`
)
\`\`\`

## Command Integration

### Usage
```bash
# Basic usage
/workflow:tools:context-gather --session WFS-auth "Implement JWT authentication"

# Called by /workflow:plan
SlashCommand(command="/workflow:tools:context-gather --session WFS-[id] \\"[task description]\\"")
```

### Agent Context Passing

**Memory-Aware Context Assembly**:
```javascript
// Assemble minimal context package for agent
// Agent will execute project structure analysis and documentation loading
const agentContext = {
  session_id: "WFS-[id]",
  task_description: "[user provided task description]",

  // Use memory if available, else load
  session_metadata: memory.has("workflow-session.json")
    ? memory.get("workflow-session.json")
    : Read(.workflow/WFS-[id]/workflow-session.json),

  // MCP capabilities - agent will use these tools
  mcp_capabilities: {
    code_index: true,
    exa_code: true,
    exa_web: true
  }
}

// Note: Agent will execute these steps autonomously:
// - bash(~/.claude/scripts/get_modules_by_depth.sh) for project structure
// - Read(CLAUDE.md) and Read(README.md) for documentation
```

## Session ID Integration

### Session ID Usage
- **Required Parameter**: `--session WFS-session-id`
- **Session Context Loading**: Load existing session state and metadata
- **Session Continuity**: Maintain context across workflow pipeline phases

### Session Validation
```javascript
// Validate session exists
const sessionPath = `.workflow/${session_id}`;
if (!fs.existsSync(sessionPath)) {
  console.error(`❌ Session ${session_id} not found`);
  process.exit(1);
}
```

## Success Criteria
- Valid context-package.json generated in correct location
- Contains sufficient relevant information (>80% relevance)
- Execution completes within reasonable time (<2 minutes)
- All required fields present and properly formatted
- Agent reports completion status with statistics

