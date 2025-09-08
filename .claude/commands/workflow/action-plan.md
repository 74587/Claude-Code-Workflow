---
name: workflow-action-plan
description: Create implementation plans from various input sources
usage: /workflow:action-plan [input-source] [--complexity=<simple|decompose>]
argument-hint: [text|--from-file|--from-issue|--template|--interactive|--from-brainstorming] [optional: complexity]
examples:
  - /workflow:action-plan "Build authentication system"
  - /workflow:action-plan --from-file requirements.md
  - /workflow:action-plan --from-issue ISS-001
  - /workflow:action-plan --template web-api
  - /workflow:action-plan --interactive
  - /workflow:action-plan --from-brainstorming
---

# Workflow Action Plan Command (/workflow:action-plan)

## Overview
Creates actionable implementation plans from multiple input sources including direct text, files, issues, templates, interactive sessions, and brainstorming outputs. Supports flexible requirement gathering with optional task decomposition.

## Core Principles
**System:** @~/.claude/workflows/unified-workflow-system-principles.md

## Input Sources & Processing

### Direct Text Input (Default)
```bash
/workflow:action-plan "Build user authentication system with JWT and OAuth2"
```
**Processing**:
- Parse natural language requirements
- Extract technical components and constraints
- Identify implementation scope and objectives
- Generate structured plan from description

### File-based Input
```bash
/workflow:action-plan --from-file requirements.md
/workflow:action-plan --from-file PROJECT_SPEC.txt
```
**Supported formats**: .md, .txt, .json, .yaml
**Processing**:
- Read and parse file contents
- Extract structured requirements and specifications
- Identify task descriptions and dependencies
- Preserve original structure and priorities

### Issue-based Input
```bash
/workflow:action-plan --from-issue ISS-001
/workflow:action-plan --from-issue "feature-request"
```
**Supported sources**: Issue IDs, issue titles, GitHub URLs
**Processing**:
- Load issue description and acceptance criteria
- Parse technical requirements and constraints
- Extract related issues and dependencies
- Include issue context in planning

### Template-based Input
```bash
/workflow:action-plan --template web-api
/workflow:action-plan --template mobile-app "user management"
```
**Available templates**:
- `web-api`: REST API development template
- `mobile-app`: Mobile application template
- `database-migration`: Database change template
- `security-feature`: Security implementation template
**Processing**:
- Load template structure and best practices
- Prompt for template-specific parameters
- Customize template with user requirements
- Generate plan following template patterns

### Interactive Mode
```bash
/workflow:action-plan --interactive
```
**Guided Process**:
1. **Project Type**: Select development category
2. **Requirements**: Structured requirement gathering
3. **Constraints**: Technical and resource limitations
4. **Success Criteria**: Define completion conditions
5. **Plan Generation**: Create comprehensive plan

### Brainstorming Integration
```bash
/workflow:action-plan --from-brainstorming
```
**Prerequisites**: Completed brainstorming session
**Processing**:
- Read multi-agent brainstorming analyses
- Synthesize recommendations and insights
- Integrate diverse perspectives into unified plan
- Preserve brainstorming context and decisions

### Web-based Input
```bash
/workflow:action-plan --from-url "https://github.com/project/issues/45"
/workflow:action-plan --from-url "https://docs.example.com/spec"
```
**Processing**:
- Fetch content from web URLs
- Parse structured requirements from web pages
- Extract technical specifications
- Handle GitHub issues, documentation sites, specs

## Complexity Levels

### Simple (Default)
```bash
/workflow:action-plan "Build chat system"
```
**Output**: IMPL_PLAN.md document only
**Use case**: Documentation-focused planning, quick overviews
**Content**: Structured plan with task descriptions

### Decompose
```bash
/workflow:action-plan "Build chat system" --complexity=decompose
```
**Output**: IMPL_PLAN.md + task JSON files
**Use case**: Full workflow execution with automated task system
**Content**: Plan document + extracted task files in .task/ directory

## Input Processing Pipeline

### 1. Input Detection
```pseudo
function detect_input_type(args):
  if starts_with("--from-file"):
    return "file"
  elif starts_with("--from-issue"):
    return "issue"
  elif starts_with("--template"):
    return "template"
  elif args == "--interactive":
    return "interactive"
  elif args == "--from-brainstorming":
    return "brainstorming"
  elif starts_with("--from-url"):
    return "url"
  else:
    return "direct_text"
```

### 2. Content Extraction
**Per Input Type**:
- **Direct Text**: Parse natural language requirements
- **File**: Read file contents and structure
- **Issue**: Load issue data and related context
- **Template**: Load template and gather parameters
- **Interactive**: Conduct guided requirement session
- **Brainstorming**: Read brainstorming outputs
- **URL**: Fetch web content and parse

### 3. Requirement Analysis
- Structure extracted information
- Identify tasks and dependencies
- Determine technical requirements
- Extract success criteria
- Assess complexity and scope

### 4. Plan Generation
- Create IMPL_PLAN.md with structured content
- Include requirements, tasks, and success criteria
- Maintain traceability to input sources
- Format for readability and execution

### 5. Optional Decomposition
**If --complexity=decompose**:
- Parse IMPL_PLAN.md for task identifiers
- Create .task/impl-*.json files
- Establish task relationships
- Update session with task references

## Session Management

### Session Check Process
⚠️ **CRITICAL**: Check for existing active session before planning

1. **Check Active Session**: Check for `.workflow/.active-*` marker file
2. **Session Selection**: Use existing active session or create new
3. **Context Integration**: Load session state and existing context

### Session State Updates
```json
{
  "current_phase": "PLAN",
  "input_source": "direct_text|file|issue|template|interactive|brainstorming|url",
  "input_details": {
    "type": "detected_input_type",
    "source": "input_identifier_or_path",
    "processed_at": "2025-09-08T15:00:00Z"
  },
  "phases": {
    "PLAN": {
      "status": "completed",
      "complexity": "simple|decompose",
      "documents_generated": ["IMPL_PLAN.md"],
      "tasks_created": 0,
      "input_processed": true
    }
  }
}
```

## IMPL_PLAN.md Template

### Standard Structure
```markdown
# Implementation Plan - [Project Name]
*Generated from: [input_source]*

## Requirements
[Extracted requirements from input source]

## Technical Scope
[Technical components and architecture needs]

## Task Breakdown
- **IMPL-001**: [Task description]
- **IMPL-002**: [Task description]  
- **IMPL-003**: [Task description]

## Dependencies & Sequence
[Task execution order and relationships]

## Success Criteria
[Measurable completion conditions]

## Input Source Context
[Traceability information back to original input]
```

## Task Decomposition (Decompose Mode)

### Automatic Task Generation
**Process**:
1. Parse IMPL_PLAN.md for task patterns: `IMPL-\d+`
2. Extract task titles and descriptions
3. Create JSON files in `.task/` directory
4. Establish dependencies from plan structure

### Generated Task JSON Structure
```json
{
  "id": "impl-1",
  "title": "[Extracted from IMPL_PLAN.md]",
  "status": "pending",
  "type": "feature",
  "agent": "code-developer",
  "context": {
    "requirements": ["From input source"],
    "scope": ["Inferred from task description"],
    "acceptance": ["From success criteria"],
    "inherited_from": "WFS-[session]",
    "input_source": "direct_text|file|issue|template|interactive|brainstorming|url"
  },
  "relations": {
    "parent": null,
    "subtasks": [],
    "dependencies": []
  },
  "execution": {
    "attempts": 0,
    "last_attempt": null
  },
  "meta": {
    "created": "[timestamp]",
    "updated": "[timestamp]",
    "generated_from": "IMPL_PLAN.md"
  }
}
```

## Template System

### Available Templates

#### Web API Template
```markdown
Requirements:
- REST endpoints design
- Database schema
- Authentication/authorization
- API documentation
- Error handling
- Testing strategy
```

#### Mobile App Template
```markdown
Requirements:
- Platform selection (iOS/Android/Cross-platform)
- UI/UX design
- State management
- API integration
- Local storage
- App store deployment
```

#### Security Feature Template
```markdown
Requirements:
- Security requirements analysis
- Threat modeling
- Implementation approach
- Testing and validation
- Compliance considerations
- Documentation updates
```

### Template Customization
Templates prompt for:
- Project-specific requirements
- Technology stack preferences
- Scale and performance needs
- Integration requirements
- Timeline constraints

## Interactive Planning Process

### Step-by-Step Guidance
1. **Project Category**: Web app, mobile app, API, library, etc.
2. **Core Requirements**: Main functionality and features
3. **Technical Stack**: Languages, frameworks, databases
4. **Constraints**: Timeline, resources, performance needs
5. **Dependencies**: External systems, APIs, libraries
6. **Success Criteria**: How to measure completion
7. **Review & Confirmation**: Validate gathered information

## Error Handling

### Input Processing Errors
```bash
# File not found
❌ File requirements.md not found
→ Check file path and try again

# Invalid issue
❌ Issue ISS-001 not found
→ Verify issue ID or create issue first

# Template not available
❌ Template "custom-template" not available
→ Available templates: web-api, mobile-app, database-migration, security-feature

# URL fetch failed
❌ Cannot fetch content from URL
→ Check URL accessibility and format
```

## Integration Points

### Command Flow
```bash
# Planning from various sources
/workflow:action-plan [input-source]

# View generated plan
/context

# Execute tasks (if decomposed)
/task:execute impl-1

# Move to implementation
/workflow:vibe
```

### Session Integration
- Updates workflow-session.json with planning results
- Creates document references for generated files
- Establishes task system if decomposition enabled
- Preserves input source traceability

## Related Commands

- `/context` - View generated plan and task status
- `/task:execute` - Execute decomposed tasks
- `/workflow:vibe` - Coordinate multi-agent execution
- `/workflow:review` - Validate completed implementation

---

**System ensures**: Flexible planning from multiple input sources with optional task decomposition and full workflow integration