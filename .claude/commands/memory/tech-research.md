---
name: tech-research
description: Generate tech stack SKILL packages using Exa research via agent delegation
argument-hint: "[session-id | tech-stack-name] [--regenerate] [--tool <gemini|qwen>]"
allowed-tools: SlashCommand(*), TodoWrite(*), Bash(*), Read(*), Write(*), Task(*)
---

# Tech Stack Research SKILL Generator

## Orchestrator Role

**Pure Orchestrator with Agent Delegation**: Coordinates tech stack research workflow, delegates Exa research to agents via Task tool.

**Auto-Continue Workflow**: Runs fully autonomously once triggered. Each phase completes and automatically triggers the next phase.

**Execution Paths**:
- **Full Path**: All 4 phases (no existing SKILL OR `--regenerate` specified)
- **Skip Path**: Phase 1 → Phase 4 (existing SKILL found AND no `--regenerate` flag)
- **Phase 4 Always Executes**: SKILL index is always generated or updated

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **Agent Delegation**: Phase 2 uses Task tool to delegate Exa research to agent
3. **Parse Agent Output**: Extract research results from agent's return message
4. **Auto-Continue**: After completing each phase, update TodoWrite and immediately execute next phase
5. **Track Progress**: Update TodoWrite after EVERY phase completion before starting next phase
6. **Direct Generation**: Phase 4 directly generates modular SKILL files using Write tool
7. **No Manual Steps**: User should never be prompted for decisions between phases

---

## 4-Phase Execution

### Phase 1: Context Extraction & Tech Stack Detection

**Goal**: Parse input, detect mode, extract tech stack, check existing SKILL

**Step 1: Detect Input Mode**

```bash
# Get input parameter (first argument after command)
input="$1"

# Detect mode
if [[ "$input" == WFS-* ]]; then
  MODE="session"
  session_id="$input"
else
  MODE="direct"
  tech_stack_input="$input"
fi
```

**Step 2A: Session Mode - Extract Tech Stack**

```bash
# Read session metadata
Read(.workflow/${session_id}/workflow-session.json)

# Read context package for tech stack info
Read(.workflow/${session_id}/.process/context-package.json)

# Extract tech_stack from context-package
# Example structure:
# {
#   "project_context": {
#     "tech_stack": {
#       "language": "TypeScript",
#       "frameworks": ["React", "Next.js"],
#       "libraries": ["axios", "zustand"]
#     }
#   }
# }

# Build tech stack name from components
# Format: "{language}-{framework1}-{framework2}"
# Example: "typescript-react-nextjs"
```

**Step 2B: Direct Mode - Parse Tech Stack**

```bash
# User provides tech stack name directly
tech_stack_name="$tech_stack_input"
# Example: "typescript", "python", "typescript-react-nextjs"
```

**Step 3: Decompose Composite Stack**

```bash
# Split by hyphen delimiter to detect components
IFS='-' read -ra COMPONENTS <<< "$tech_stack_name"

# COMPONENTS array examples:
# "typescript" → ["typescript"]
# "typescript-react-nextjs" → ["typescript", "react", "nextjs"]

# Identify main tech (first component) and additional components
main_tech="${COMPONENTS[0]}"
additional_components=("${COMPONENTS[@]:1}")  # Rest of array

# Determine if composite
if [ ${#additional_components[@]} -gt 0 ]; then
  is_composite=true
else
  is_composite=false
fi
```

**Step 4: Check Existing SKILL**

```bash
# Normalize tech stack name (lowercase, replace spaces with hyphens)
normalized_name=$(echo "$tech_stack_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

# Check if SKILL already exists
bash(test -d ".claude/skills/${normalized_name}" && echo "exists" || echo "not_exists")

# Count existing files
bash(find ".claude/skills/${normalized_name}" -name "*.md" 2>/dev/null | wc -l || echo 0)
```

**Step 5: Determine Execution Path**

**Decision Logic**:
```javascript
if (existing_files > 0 && !regenerate_flag) {
  // SKILL exists and no regenerate flag
  SKIP_GENERATION = true
  message = "Tech stack SKILL already exists, skipping Phase 2 and Phase 3. Use --regenerate to force regeneration."
} else if (regenerate_flag) {
  // Force regeneration: delete existing SKILL
  bash(rm -rf ".claude/skills/${normalized_name}" 2>/dev/null || true)
  SKIP_GENERATION = false
  message = "Regenerating tech stack SKILL from scratch."
} else {
  // No existing SKILL
  SKIP_GENERATION = false
  message = "No existing SKILL found, generating new tech stack documentation."
}
```

**Summary Variables**:
- `MODE`: `session` or `direct`
- `SESSION_ID`: Session ID (if session mode)
- `TECH_STACK_NAME`: Normalized name (e.g., "typescript-react-nextjs")
- `MAIN_TECH`: Primary technology (e.g., "typescript")
- `COMPONENTS`: Array of all components (e.g., ["typescript", "react", "nextjs"])
- `ADDITIONAL_COMPONENTS`: Array of additional components (e.g., ["react", "nextjs"])
- `IS_COMPOSITE`: Boolean - whether composite stack
- `EXISTING_FILES`: Count of existing SKILL files
- `SKIP_GENERATION`: Boolean - whether to skip Phase 2 & 3
- `TOOL`: `gemini` or `qwen` (default: gemini)
- `REGENERATE`: Boolean - force regeneration flag

**Completion & TodoWrite**:
- If `SKIP_GENERATION = true`: Mark phase 1 completed, phase 2&3 completed (skipped), phase 4 in_progress
- If `SKIP_GENERATION = false`: Mark phase 1 completed, phase 2 in_progress

**Next Action**:
- If skipping: Display skip message → Jump to Phase 4
- If not skipping: Display preparation results → Continue to Phase 2

---

### Phase 2: Agent-Delegated Exa Research

**Skip Condition**: This phase is **skipped if SKIP_GENERATION = true** (SKILL already exists without --regenerate flag)

**Goal**: Delegate Exa research to agent for comprehensive tech stack knowledge gathering

**Agent Task Specification**:

```
Task(
  subagent_type: "general-purpose",
  description: "Exa research for {tech_stack_name}",
  prompt: "
Execute comprehensive Exa research for the tech stack: {TECH_STACK_NAME}

**Tech Stack Components**:
- Main Technology: {MAIN_TECH}
- Additional Components: {ADDITIONAL_COMPONENTS} (if composite)

**Research Tasks**:

1. **Base Tech Stack Research** (3 parallel Exa queries):

   Query 1 - Core Principles & Best Practices:
   mcp__exa__get_code_context_exa({
     query: '{MAIN_TECH} core principles best practices design patterns 2025',
     tokensNum: 8000
   })

   Query 2 - Implementation Patterns & Architecture:
   mcp__exa__get_code_context_exa({
     query: '{MAIN_TECH} common patterns architecture examples implementation guide',
     tokensNum: 7000
   })

   Query 3 - Configuration & Tooling:
   mcp__exa__web_search_exa({
     query: '{MAIN_TECH} configuration setup tooling guide 2025',
     numResults: 5
   })

2. **Composite Stack Research** (if IS_COMPOSITE = true):

   For each component in ADDITIONAL_COMPONENTS:
   mcp__exa__get_code_context_exa({
     query: '{MAIN_TECH} {component} integration patterns best practices',
     tokensNum: 5000
   })

3. **Testing & Quality Research**:

   mcp__exa__get_code_context_exa({
     query: '{MAIN_TECH} testing strategies unit testing integration testing',
     tokensNum: 5000
   })

**Expected Output Structure**:

Return a structured JSON object with research results:

```json
{
  \"tech_stack_name\": \"{TECH_STACK_NAME}\",
  \"main_tech\": \"{MAIN_TECH}\",
  \"is_composite\": {IS_COMPOSITE},
  \"components\": [list of components],

  \"research_results\": {
    \"core_principles\": {
      \"content\": \"... extracted content ...\",
      \"sources\": [\"url1\", \"url2\"],
      \"token_count\": 8000
    },
    \"patterns\": {
      \"content\": \"... patterns and architectures ...\",
      \"sources\": [\"url3\", \"url4\"],
      \"token_count\": 7000
    },
    \"configuration\": {
      \"content\": \"... config and tooling ...\",
      \"sources\": [\"url5\", \"url6\"],
      \"token_count\": 5000
    },
    \"testing\": {
      \"content\": \"... testing strategies ...\",
      \"sources\": [\"url7\"],
      \"token_count\": 5000
    },
    \"framework_integration\": {
      \"{component1}\": {
        \"content\": \"... integration patterns ...\",
        \"sources\": [\"url8\"],
        \"token_count\": 5000
      },
      \"{component2}\": { ... }
    }
  },

  \"summary\": {
    \"total_queries\": number,
    \"total_sources\": number,
    \"total_tokens\": number
  }
}
```

**IMPORTANT**:
- Execute ALL Exa queries in parallel where possible
- Accumulate results in memory during research
- Return structured JSON at the end (not intermediate results)
- If Exa query fails, retry once or note failure in results
- DO NOT write any files - only return research data
  "
)
```

**Parse Agent Output**:

After agent completes, extract the JSON structure from agent's final message:

```javascript
// Agent returns message with JSON structure
const agentOutput = parseAgentResponse(agent_return_message)

// Extract key data
const researchResults = {
  tech_stack_name: agentOutput.tech_stack_name,
  main_tech: agentOutput.main_tech,
  is_composite: agentOutput.is_composite,
  components: agentOutput.components,

  // Research content sections
  core_principles: agentOutput.research_results.core_principles,
  patterns: agentOutput.research_results.patterns,
  configuration: agentOutput.research_results.configuration,
  testing: agentOutput.research_results.testing,
  framework_integration: agentOutput.research_results.framework_integration,

  // Metadata
  summary: agentOutput.summary
}

// Store in conversation memory for Phase 3
```

**Completion Criteria**:
- Agent task executed successfully
- Research results JSON extracted and parsed
- All required sections present (core_principles, patterns, configuration, testing)
- Framework integration data available (if composite)
- Summary metadata recorded

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**Next Action**: Display research summary (queries executed, sources consulted) → Auto-continue to Phase 3

---

### Phase 3: Content Synthesis & Modular Structuring

**Skip Condition**: This phase is **skipped if SKIP_GENERATION = true** (SKILL already exists without --regenerate flag)

**Goal**: Synthesize Exa research results into structured modular content

**Option A: Orchestrator Synthesis (Recommended for Speed)**

Directly extract and structure content from Phase 2 agent output:

**Step 1: Extract Core Sections**

```javascript
// Use research results from Phase 2 (already in memory)

const moduleSections = {
  principles: extractPrinciplesContent(researchResults.core_principles),
  patterns: extractPatternsContent(researchResults.patterns),
  practices: extractPracticesContent(researchResults.core_principles, researchResults.patterns),
  testing: extractTestingContent(researchResults.testing),
  config: extractConfigContent(researchResults.configuration),
  frameworks: extractFrameworksContent(researchResults.framework_integration)  // Only if composite
}
```

**Step 2: Structure Content for Each Module**

**principles.md Structure**:
```markdown
---
module: principles
tech_stack: {TECH_STACK_NAME}
---
# {TechStack} Core Principles

## Overview
{Brief introduction from research}

## Fundamental Concepts
{Extracted from core_principles.content}

### Concept 1: {Name}
{Description}

```{language}
// Code example from Exa research
```

### Concept 2: {Name}
{Description}

## Design Philosophy
{Extracted philosophies}

## References
{List sources from research_results.core_principles.sources}
```

**patterns.md Structure**:
```markdown
---
module: patterns
tech_stack: {TECH_STACK_NAME}
---
# {TechStack} Common Patterns

## Implementation Patterns

### Pattern 1: {Pattern Name}
**Use Case**: {When to use}

```{language}
// Code example from Exa research
```

**Key Points**:
- {Point 1}
- {Point 2}

### Pattern 2: {Pattern Name}
...

## Architectural Patterns
{Extracted from patterns.content}

## References
{List sources}
```

**practices.md Structure**:
```markdown
---
module: practices
tech_stack: {TECH_STACK_NAME}
---
# {TechStack} Best Practices

## Do's and Don'ts

### ✅ Best Practices
- DO: {Practice 1}
- DO: {Practice 2}

### ❌ Anti-Patterns
- DON'T: {Anti-pattern 1}
- DON'T: {Anti-pattern 2}

## Common Pitfalls
{Extracted warnings}

### Pitfall 1: {Name}
**Problem**: {Description}
**Solution**: {How to avoid}

## Code Quality Guidelines
{Extracted guidelines}

## References
{List sources}
```

**testing.md Structure**:
```markdown
---
module: testing
tech_stack: {TECH_STACK_NAME}
---
# {TechStack} Testing Strategies

## Testing Approaches

### Unit Testing
{Extracted strategies}

```{language}
// Unit test example from Exa
```

### Integration Testing
{Extracted strategies}

### End-to-End Testing
{Extracted strategies}

## Testing Frameworks
{List recommended frameworks}

## Best Practices
{Testing best practices}

## References
{List sources}
```

**config.md Structure**:
```markdown
---
module: config
tech_stack: {TECH_STACK_NAME}
---
# {TechStack} Configuration Guide

## Basic Setup

### Installation
```bash
# Installation commands from Exa research
```

### Project Initialization
{Setup steps}

## Configuration Files

### {config_file_name}
```{format}
// Configuration example from Exa
```

## Tooling

### Essential Tools
- {Tool 1}: {Description}
- {Tool 2}: {Description}

### IDE Setup
{IDE configuration recommendations}

## References
{List sources}
```

**frameworks.md Structure** (Only if IS_COMPOSITE = true):
```markdown
---
module: frameworks
tech_stack: {TECH_STACK_NAME}
components: {ADDITIONAL_COMPONENTS}
---
# {TechStack} Framework Integration

## Overview
Integration patterns for {MAIN_TECH} with {COMPONENTS}

## {Component 1} Integration

### Setup
{Integration setup from framework_integration[component1]}

```{language}
// Integration code example
```

### Best Practices
{Component-specific best practices}

## {Component 2} Integration
...

## Common Integration Patterns
{Cross-framework patterns}

## References
{List sources from all components}
```

**Step 3: Prepare Module Content Objects**

```javascript
const moduleContents = {
  "principles.md": generatePrinciplesMarkdown(moduleSections.principles),
  "patterns.md": generatePatternsMarkdown(moduleSections.patterns),
  "practices.md": generatePracticesMarkdown(moduleSections.practices),
  "testing.md": generateTestingMarkdown(moduleSections.testing),
  "config.md": generateConfigMarkdown(moduleSections.config),
}

// Add frameworks.md only if composite
if (IS_COMPOSITE) {
  moduleContents["frameworks.md"] = generateFrameworksMarkdown(moduleSections.frameworks)
}
```

**Option B: Agent Synthesis (More Thorough)**

Alternatively, delegate synthesis to another agent:

```
Task(
  subagent_type: "general-purpose",
  description: "Synthesize tech stack content",
  prompt: "
Synthesize the following Exa research results into 6 modular markdown files...

{Include research results from Phase 2}

Generate structured content for:
1. principles.md
2. patterns.md
3. practices.md
4. testing.md
5. config.md
6. frameworks.md (if composite)

Follow the markdown structures specified in Phase 3...
  "
)
```

**Completion Criteria**:
- All module contents prepared (5-6 modules depending on composite)
- Each module has structured markdown with code examples
- Source references included in each module
- Content ready for Phase 4 file writing

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**Next Action**: Display synthesis summary (modules prepared, total size estimate) → Auto-continue to Phase 4

---

### Phase 4: Generate SKILL Package Files

**Note**: This phase is **NEVER skipped** - it always executes to generate or update the SKILL package.

**Step 1: Create SKILL Directory**

```bash
bash(mkdir -p ".claude/skills/${TECH_STACK_NAME}")
```

**Step 2: Write Modular Files**

Use Write tool for each module file:

```javascript
// Write principles.md
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/principles.md`,
  content: moduleContents["principles.md"]
})

// Write patterns.md
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/patterns.md`,
  content: moduleContents["patterns.md"]
})

// Write practices.md
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/practices.md`,
  content: moduleContents["practices.md"]
})

// Write testing.md
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/testing.md`,
  content: moduleContents["testing.md"]
})

// Write config.md
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/config.md`,
  content: moduleContents["config.md"]
})

// Write frameworks.md (only if composite)
if (IS_COMPOSITE) {
  Write({
    file_path: `.claude/skills/${TECH_STACK_NAME}/frameworks.md`,
    content: moduleContents["frameworks.md"]
  })
}
```

**Step 3: Generate SKILL.md Index**

```markdown
---
name: {TECH_STACK_NAME}
description: {MAIN_TECH} development guidelines and best practices gathered from industry standards. Load when working with {TECH_STACK_NAME} projects or need {MAIN_TECH} reference.
version: 1.0.0
generated: {timestamp}
source: exa-research
---
# {TechStack} SKILL Package

## Overview
Comprehensive {TECH_STACK_NAME} development guidelines based on industry best practices and Exa research.

**Tech Stack**: {MAIN_TECH} {if composite: "+ {ADDITIONAL_COMPONENTS.join(', ')}"}

## Modular Documentation

### Core Understanding (~8K tokens)
- **[Principles](./principles.md)** - Core concepts, philosophies, and fundamental principles
- **[Patterns](./patterns.md)** - Implementation patterns with code examples and architectures

### Practical Guidance (~7K tokens)
- **[Best Practices](./practices.md)** - Do's, don'ts, anti-patterns, and quality guidelines
- **[Testing](./testing.md)** - Testing strategies, frameworks, and approaches

### Configuration & Integration (~7K tokens)
- **[Configuration](./config.md)** - Setup, tooling, and configuration guides
{if composite: "- **[Frameworks](./frameworks.md)** - Integration patterns for {ADDITIONAL_COMPONENTS.join(', ')}"}

## Loading Recommendations

**Quick Reference** (~10K tokens):
```
Skill(command: "{TECH_STACK_NAME}")
Then request: principles.md + practices.md
```

**Implementation Focus** (~12K tokens):
```
Load: patterns.md + config.md + testing.md
```

**Complete Package** (~22K tokens):
```
Load all modules for comprehensive reference
```

## Usage

Load this SKILL when:
- Starting a new {MAIN_TECH} project
- Reviewing {TECH_STACK_NAME} code
- Learning {MAIN_TECH} best practices
- Integrating {if composite: ADDITIONAL_COMPONENTS}
- Troubleshooting {MAIN_TECH} issues

## Research Metadata

- **Generated**: {timestamp}
- **Source**: Exa Research
- **Queries Executed**: {summary.total_queries}
- **Sources Consulted**: {summary.total_sources}
- **Total Research Tokens**: ~{summary.total_tokens}
- **Tech Stack Components**: {COMPONENTS.length}

## Tech Stack Details

**Primary**: {MAIN_TECH}
{if composite:
**Frameworks**: {ADDITIONAL_COMPONENTS.join(', ')}
}

**Module Count**: {5 or 6 depending on composite}
**Estimated Total Size**: ~22K tokens
```

**Step 4: Write SKILL.md Index**

```javascript
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/SKILL.md`,
  content: generatedSKILLIndexMarkdown
})
```

**Step 5: Write Metadata File**

```json
{
  "tech_stack_name": "{TECH_STACK_NAME}",
  "main_tech": "{MAIN_TECH}",
  "components": [array of components],
  "is_composite": boolean,
  "generated_at": "{ISO timestamp}",
  "source": "exa-research",
  "agent_delegated": true,
  "research_summary": {
    "total_queries": number,
    "total_sources": number,
    "total_tokens": number
  },
  "modules": {
    "principles": { "size_estimate": "~3K tokens" },
    "patterns": { "size_estimate": "~5K tokens" },
    "practices": { "size_estimate": "~4K tokens" },
    "testing": { "size_estimate": "~3K tokens" },
    "config": { "size_estimate": "~3K tokens" },
    "frameworks": { "size_estimate": "~4K tokens" }  // if composite
  },
  "last_updated": "{ISO timestamp}",
  "version": "1.0.0"
}
```

```javascript
Write({
  file_path: `.claude/skills/${TECH_STACK_NAME}/metadata.json`,
  content: JSON.stringify(metadataObject, null, 2)
})
```

**Completion Criteria**:
- SKILL directory created
- 5-6 modular files written (depending on composite)
- SKILL.md index written with module references
- metadata.json written with research summary
- All files use proper markdown formatting

**TodoWrite**: Mark phase 4 completed

**Final Action**: Report completion summary to user

**Return to User**:
```
✅ Tech Stack SKILL Package Generation Complete

Tech Stack: {TECH_STACK_NAME}
SKILL Location: .claude/skills/{TECH_STACK_NAME}/

Generated Files:
- SKILL.md (index with loading recommendations)
- principles.md (~3K tokens)
- patterns.md (~5K tokens)
- practices.md (~4K tokens)
- testing.md (~3K tokens)
- config.md (~3K tokens)
{if composite: "- frameworks.md (~4K tokens)"}
- metadata.json (research metadata)

Exa Research Summary:
- Queries Executed: {summary.total_queries}
- Sources Consulted: {summary.total_sources}
- Research Tokens: ~{summary.total_tokens}

Usage:
Skill(command: "{TECH_STACK_NAME}")  # Load this SKILL for {TECH_STACK_NAME} development

Loading Recommendations:
- Quick: principles.md + practices.md (~7K)
- Implementation: patterns.md + config.md (~8K)
- Complete: All modules (~22K)
```

---

## Implementation Details

### Critical Rules

1. **No User Prompts Between Phases**: Never ask user questions or wait for input between phases
2. **Immediate Phase Transition**: After TodoWrite update, immediately execute next phase command
3. **Agent Output Parsing**: Extract JSON structure from agent's final message in Phase 2
4. **Status-Driven Execution**: Check TodoList status after each phase:
   - If next task is "pending" → Mark it "in_progress" and execute
   - If all tasks are "completed" → Report final summary
5. **Phase Completion Pattern**:
   ```
   Phase N completes → Update TodoWrite (N=completed, N+1=in_progress) → Execute Phase N+1
   ```

### TodoWrite Patterns

#### Initialization (Before Phase 1)

**FIRST ACTION**: Create TodoList with all 4 phases
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "in_progress", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "pending", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "pending", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "pending", "activeForm": "Generating SKILL files"}
]})
```

**SECOND ACTION**: Execute Phase 1 immediately

#### Full Path (SKIP_GENERATION = false)

**After Phase 1**:
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "completed", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "in_progress", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "pending", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "pending", "activeForm": "Generating SKILL files"}
]})
// Auto-continue to Phase 2
```

**After Phase 2**:
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "completed", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "completed", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "in_progress", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "pending", "activeForm": "Generating SKILL files"}
]})
// Auto-continue to Phase 3
```

**After Phase 3**:
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "completed", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "completed", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "completed", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "in_progress", "activeForm": "Generating SKILL files"}
]})
// Auto-continue to Phase 4
```

**After Phase 4**:
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "completed", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "completed", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "completed", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "completed", "activeForm": "Generating SKILL files"}
]})
// Report completion summary to user
```

#### Skip Path (SKIP_GENERATION = true)

**After Phase 1** (detects existing SKILL, skips Phase 2 & 3):
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "completed", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "completed", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "completed", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "in_progress", "activeForm": "Generating SKILL files"}
]})
// Display skip message: "Tech stack SKILL already exists, skipping Phase 2 and Phase 3. Use --regenerate to force regeneration."
// Jump directly to Phase 4
```

**After Phase 4**:
```javascript
TodoWrite({todos: [
  {"content": "Extract context and detect tech stack", "status": "completed", "activeForm": "Extracting context"},
  {"content": "Delegate Exa research to agent", "status": "completed", "activeForm": "Delegating to agent"},
  {"content": "Synthesize content into modules", "status": "completed", "activeForm": "Synthesizing content"},
  {"content": "Generate SKILL package files", "status": "completed", "activeForm": "Generating SKILL files"}
]})
// Report completion summary to user
```

### Execution Flow Diagrams

#### Full Path Flow
```
User triggers command
  ↓
[TodoWrite] Initialize 4 phases (Phase 1 = in_progress)
  ↓
[Execute] Phase 1: Extract context, detect tech stack
  ↓
[TodoWrite] Phase 1 = completed, Phase 2 = in_progress
  ↓
[Execute] Phase 2: Task tool → Agent executes Exa research
  ↓
[Parse] Extract JSON from agent output
  ↓
[TodoWrite] Phase 2 = completed, Phase 3 = in_progress
  ↓
[Execute] Phase 3: Synthesize content into modules
  ↓
[TodoWrite] Phase 3 = completed, Phase 4 = in_progress
  ↓
[Execute] Phase 4: Write 5-6 modular files + SKILL.md + metadata.json
  ↓
[TodoWrite] Phase 4 = completed
  ↓
[Report] Display completion summary
```

#### Skip Path Flow
```
User triggers command
  ↓
[TodoWrite] Initialize 4 phases (Phase 1 = in_progress)
  ↓
[Execute] Phase 1: Detect existing SKILL
  ↓
[TodoWrite] Phase 1 = completed, Phase 2&3 = completed (skipped), Phase 4 = in_progress
  ↓
[Display] Skip message: "Tech stack SKILL already exists, skipping Phase 2 and Phase 3"
  ↓
[Execute] Phase 4: Update SKILL.md index only (fast path)
  ↓
[TodoWrite] Phase 4 = completed
  ↓
[Report] Display completion summary
```

### Error Handling

**Phase 1 Errors**:
- **Invalid session ID**: Report error, ask user to verify session exists
- **Missing context-package**: Warn user, fall back to direct mode (ask for tech stack name)
- **No tech stack detected**: Ask user to specify tech stack name directly

**Phase 2 Errors (Agent Delegation)**:
- **Agent task fails**: Retry once, if fails again report error to user
- **Exa API failures**: Agent should handle internally with retries
- **Incomplete research results**: Warn user, proceed with partial data if minimum sections available

**Phase 3 Errors**:
- **Parsing failures**: Fall back to basic content structure
- **Missing sections**: Generate placeholder content, note in metadata

**Phase 4 Errors**:
- **Write failures**: Report which files failed, suggest manual retry
- **Directory creation fails**: Check permissions, report to user

---

## Parameters

```bash
/memory:tech-research [session-id | "tech-stack-name"] [--regenerate] [--tool <gemini|qwen>]
```

- **session-id | tech-stack-name**: Input source (auto-detected by WFS- prefix)
  - **Session mode**: `WFS-user-auth-v2` - Extract tech stack from workflow session
  - **Direct mode**: `"typescript"`, `"python"`, `"typescript-react-nextjs"` - User specifies tech stack
- **--regenerate**: Force regenerate existing SKILL (optional)
  - When enabled: Deletes existing `.claude/skills/{tech_stack_name}/` before regeneration
  - Ensures fresh documentation from Exa research
- **--tool**: CLI tool for additional analysis (optional, default: gemini)
  - `gemini`: Use Gemini for supplemental analysis (future enhancement)
  - `qwen`: Use Qwen for supplemental analysis (future enhancement)
  - **Note**: Currently Phase 2 uses agent with Exa, this flag reserved for future use

---

## Examples

### Example 1: Direct Mode - Single Tech Stack

```bash
/memory:tech-research "typescript"
```

**Workflow**:
1. Phase 1: Detects direct mode, parses "typescript", checks existing SKILL
2. Phase 2: Agent executes 4 Exa queries (principles, patterns, config, testing)
3. Phase 3: Synthesizes content into 5 modular files
4. Phase 4: Generates SKILL package at `.claude/skills/typescript/`

**Generated Files**:
- `SKILL.md` (index)
- `principles.md`
- `patterns.md`
- `practices.md`
- `testing.md`
- `config.md`
- `metadata.json`

### Example 2: Direct Mode - Composite Tech Stack

```bash
/memory:tech-research "typescript-react-nextjs"
```

**Workflow**:
1. Phase 1: Detects composite stack, decomposes into ["typescript", "react", "nextjs"]
2. Phase 2: Agent executes 6 Exa queries:
   - Base: principles, patterns, config, testing
   - Components: react integration, nextjs integration
3. Phase 3: Synthesizes content into 6 modular files (adds frameworks.md)
4. Phase 4: Generates complete SKILL package

**Generated Files**:
- `SKILL.md` (index with framework integration)
- `principles.md`
- `patterns.md`
- `practices.md`
- `testing.md`
- `config.md`
- `frameworks.md` (React + Next.js integration)
- `metadata.json`

### Example 3: Session Mode - Extract from Workflow

```bash
/memory:tech-research WFS-user-auth-20251104
```

**Workflow**:
1. Phase 1: Detects session mode, reads workflow-session.json + context-package.json
2. Extracts tech stack: `{ language: "Python", frameworks: ["FastAPI", "SQLAlchemy"] }`
3. Builds tech stack name: "python-fastapi-sqlalchemy"
4. Phase 2: Agent executes Exa research for Python + FastAPI + SQLAlchemy
5. Phase 3: Synthesizes into 6 modules
6. Phase 4: Generates SKILL package at `.claude/skills/python-fastapi-sqlalchemy/`

### Example 4: Regenerate Existing SKILL

```bash
/memory:tech-research "react" --regenerate
```

**Workflow**:
1. Phase 1: Detects existing SKILL at `.claude/skills/react/`, deletes it due to --regenerate
2. Phase 2: Agent executes fresh Exa research for React (latest 2025 best practices)
3. Phase 3: Synthesizes updated content
4. Phase 4: Generates new SKILL package with latest information

### Example 5: Skip Path - Update Index Only

```bash
/memory:tech-research "python"
```

**Scenario**: SKILL already exists at `.claude/skills/python/` with 7 files

**Workflow**:
1. Phase 1: Detects existing SKILL (7 files), sets SKIP_GENERATION = true
2. Display: "Tech stack SKILL already exists, skipping Phase 2 and Phase 3. Use --regenerate to force regeneration."
3. Phase 4: Updates SKILL.md index only (adds new metadata, updates timestamps)
4. **Result**: ~5-10x faster than full generation

---

## Benefits

- ✅ **Agent-Powered Research**: Delegates Exa queries to agent for parallel execution
- ✅ **Pure Orchestrator**: Command only coordinates workflow, doesn't execute research
- ✅ **Modular Structure**: 6 independent files for flexible loading
- ✅ **Composite Stack Support**: Auto-detects and researches multiple frameworks
- ✅ **Dual-Mode Input**: Works with session IDs or direct tech stack names
- ✅ **Intelligent Skip**: Fast SKILL updates without full regeneration
- ✅ **Always Current**: Exa research pulls latest 2025 best practices
- ✅ **Auto-Continue**: Autonomous 4-phase execution with progress tracking
- ✅ **Comprehensive**: Covers principles, patterns, practices, testing, config, integration

## Architecture

```
tech-research (orchestrator)
  ├─ Phase 1: Context Extraction (bash, Read, direct logic)
  ├─ Phase 2: Agent Delegation (Task tool → Exa research agent)
  ├─ Phase 3: Content Synthesis (parse agent output, structure modules)
  └─ Phase 4: File Generation (Write tool, direct file creation, always runs)

Agent Responsibilities (Phase 2):
  ├─ Execute parallel Exa queries
  ├─ Accumulate research results
  ├─ Return structured JSON
  └─ Handle Exa failures/retries

Smart Skip Logic:
  ├─ Existing SKILL → Skip Phase 2 & 3 (5-10x faster)
  └─ --regenerate → Full path (fresh research)

Modular SKILL Output:
  ├─ SKILL.md (index, ~1K tokens)
  ├─ principles.md (~3K tokens)
  ├─ patterns.md (~5K tokens)
  ├─ practices.md (~4K tokens)
  ├─ testing.md (~3K tokens)
  ├─ config.md (~3K tokens)
  ├─ frameworks.md (~4K tokens, if composite)
  └─ metadata.json (research metadata)

Total: ~22K tokens per SKILL package
```

---

## Future Enhancements

1. **Multi-Language Support**: Detect and generate SKILLs in multiple languages (English, Chinese)
2. **Version Management**: Track SKILL versions, allow version pinning
3. **Incremental Updates**: Update specific modules without full regeneration
4. **SKILL Dependencies**: Link related SKILLs (e.g., TypeScript → React → Next.js)
5. **Custom Templates**: User-defined module templates for specific patterns
6. **CLI Tool Integration**: Use --tool flag to invoke Gemini/Qwen for additional analysis
7. **Validation**: Verify generated content quality, detect incomplete sections
8. **Export Formats**: Generate PDF/HTML versions of SKILL packages
