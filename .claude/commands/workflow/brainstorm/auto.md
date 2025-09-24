---
name: auto
description: Intelligent brainstorming automation with dynamic role selection and guided context gathering
usage: /workflow:brainstorm:auto "<topic>"
argument-hint: "topic or challenge description"
examples:
  - /workflow:brainstorm:auto "Build real-time collaboration feature"
  - /workflow:brainstorm:auto "Optimize database performance for millions of users"
  - /workflow:brainstorm:auto "Implement secure authentication system"
allowed-tools: Task(*), TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*)
---

# Workflow Brainstorm Auto Command

## Usage
```bash
/workflow:brainstorm:auto "<topic>"
```

## Role Selection Logic
- **Technical & Architecture**: `architecture|system|performance|database|security` → system-architect, data-architect, security-expert
- **Product & UX**: `user|ui|ux|interface|design|product|feature` → ui-designer, user-researcher, product-manager
- **Business & Process**: `business|process|workflow|cost|innovation|testing` → business-analyst, innovation-lead, test-strategist
- **Multi-role**: Complex topics automatically select 2-3 complementary roles
- **Default**: `product-manager` if no clear match

**Template Loading**: `bash($(cat ~/.claude/workflows/cli-templates/planning-roles/<role-name>.md))`
**Template Source**: `.claude/workflows/cli-templates/planning-roles/`
**Available Roles**: business-analyst, data-architect, feature-planner, innovation-lead, product-manager, security-expert, system-architect, test-strategist, ui-designer, user-researcher

**Example**:
```bash
bash($(cat ~/.claude/workflows/cli-templates/planning-roles/system-architect.md))
bash($(cat ~/.claude/workflows/cli-templates/planning-roles/ui-designer.md))
ls ~/.claude/workflows/cli-templates/planning-roles/  # Show all available roles
```

## Core Workflow

### Analysis & Planning Process
The command performs dedicated role analysis through:

**0. Session Management** ⚠️ FIRST STEP
- **Active session detection**: Check `.workflow/.active-*` markers
- **Session selection**: Prompt user if multiple active sessions found
- **Auto-creation**: Create `WFS-[topic-slug]` only if no active session exists
- **Context isolation**: Each session maintains independent brainstorming state

**1. Role Selection & Template Loading**
- **Keyword analysis**: Extract topic keywords and map to planning roles
- **Template loading**: Load role templates via `bash($(cat ~/.claude/workflows/cli-templates/planning-roles/<role>.md))`
- **Role validation**: Verify against `.claude/workflows/cli-templates/planning-roles/`
- **Multi-role detection**: Select 1-3 complementary roles based on topic complexity

**2. Sequential Role Processing** ⚠️ CRITICAL ARCHITECTURE
- **One Role = One Agent**: Each role gets dedicated conceptual-planning-agent
- **Context gathering**: Role-specific questioning with validation
- **Agent submission**: Complete context handoff to single-role agents
- **Progress tracking**: Real-time TodoWrite updates per role

**3. Analysis Artifacts Generated**
- **Role contexts**: `.brainstorming/[role]-context.md` - User responses per role
- **Agent outputs**: `.brainstorming/[role]/analysis.md` - Dedicated role analysis
- **Session metadata**: `.brainstorming/auto-session.json` - Agent assignments and validation
- **Synthesis**: `.brainstorming/synthesis/integrated-analysis.md` - Multi-role integration

## Implementation Standards

### Dedicated Agent Architecture ⚠️ CRITICAL
Agents receive dedicated role assignments with complete context isolation:

```json
"agent_assignment": {
  "role": "system-architect",
  "agent_id": "conceptual-planning-agent-system-architect",
  "context_source": ".brainstorming/system-architect-context.md",
  "output_location": ".brainstorming/system-architect/",
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_role_template",
        "action": "Load system-architect planning template",
        "command": "bash($(cat ~/.claude/workflows/cli-templates/planning-roles/system-architect.md))",
        "output_to": "role_template"
      },
      {
        "step": "load_user_context",
        "action": "Load user responses and context for role analysis",
        "command": "bash(cat .brainstorming/system-architect-context.md)",
        "output_to": "user_context"
      },
      {
        "step": "load_content_analysis",
        "action": "Load existing content analysis documents if available",
        "command": "bash(find .brainstorming/ -name '*.md' -path '*/analysis/*' -o -name 'content-analysis.md' | head -5 | xargs cat 2>/dev/null || echo 'No content analysis found')",
        "output_to": "content_analysis"
      },
      {
        "step": "load_session_metadata",
        "action": "Load session metadata and previous analysis state",
        "command": "bash(cat .brainstorming/auto-session.json 2>/dev/null || echo '{}')",
        "output_to": "session_metadata"
      }
    ],
    "implementation_approach": {
      "task_description": "Execute dedicated system-architect conceptual analysis for: [topic]",
      "role_focus": "system-architect",
      "user_context": "Direct user responses from context gathering phase",
      "deliverables": "conceptual_analysis, strategic_recommendations, role_perspective"
    }
  }
}
```

**Context Accumulation & Role Isolation**:
1. **Role template loading**: Planning role template with domain expertise via CLI
2. **User context loading**: Direct user responses and context from interactive questioning
3. **Content analysis integration**: Existing analysis documents and session metadata
4. **Context validation**: Minimum response requirements with re-prompting
5. **Conceptual analysis**: Role-specific perspective on topic without implementation details
6. **Agent delegation**: Complete context handoff to dedicated conceptual-planning-agent with all references

**Content Sources**:
- Role templates: `bash($(cat ~/.claude/workflows/cli-templates/planning-roles/<role>.md))` from `.claude/workflows/cli-templates/planning-roles/`
- User responses: `bash(cat .brainstorming/<role>-context.md)` from interactive questioning phase
- Content analysis: `bash(find .brainstorming/ -name '*.md' -path '*/analysis/*')` existing analysis documents
- Session metadata: `bash(cat .brainstorming/auto-session.json)` for analysis state and context
- Conceptual focus: Strategic and planning perspective without technical implementation

**Trigger Conditions**: Topic analysis matches role domains, user provides adequate context responses, role template successfully loaded

### Role Processing Standards

**Core Principles**:
1. **Sequential Processing** - Complete each role fully before proceeding to next
2. **Context Validation** - Ensure adequate detail before agent submission
3. **Dedicated Assignment** - One conceptual-planning-agent per role
4. **Progress Tracking** - Real-time TodoWrite updates for role processing stages

**Implementation Rules**:
- **Maximum 3 roles**: Auto-selected based on topic complexity and domain overlap
- **Context validation**: Minimum response length and completeness checks
- **Agent isolation**: Each agent receives only role-specific context
- **Error recovery**: Role-specific validation and retry logic

**Role Question Templates**:
- **system-architect**: Scale requirements, integration needs, technology constraints, non-functional requirements
- **security-expert**: Sensitive data types, compliance requirements, threat concerns, auth/authz needs
- **ui-designer**: User personas, platform support, design guidelines, accessibility requirements
- **product-manager**: Business objectives, stakeholders, success metrics, timeline constraints
- **data-architect**: Data types, volume projections, compliance needs, analytics requirements

### Session Management ⚠️ CRITICAL
- **⚡ FIRST ACTION**: Check for all `.workflow/.active-*` markers before role processing
- **Multiple sessions support**: Different Claude instances can have different active brainstorming sessions
- **User selection**: If multiple active sessions found, prompt user to select which one to work with
- **Auto-session creation**: `WFS-[topic-slug]` only if no active session exists
- **Session continuity**: MUST use selected active session for all role processing
- **Context preservation**: Each role's context and agent output stored in session directory
- **Session isolation**: Each session maintains independent brainstorming state and role assignments

## Document Generation

**Workflow**: Role Selection → Context Gathering → Agent Delegation → Documentation → Synthesis

**Always Created**:
- **auto-session.json**: Agent assignments, context validation, completion tracking
- **[role]-context.md**: User responses per role with question-answer pairs

**Auto-Created (per role)**:
- **[role]/analysis.md**: Main role analysis from dedicated agent
- **[role]/recommendations.md**: Role-specific recommendations
- **[role]-template.md**: Loaded role planning template

**Auto-Created (multi-role)**:
- **synthesis/integrated-analysis.md**: Cross-role integration and consensus analysis
- **synthesis/consensus-matrix.md**: Agreement/disagreement analysis
- **synthesis/priority-recommendations.md**: Prioritized action items

**Document Structure**:
```
.workflow/WFS-[topic]/.brainstorming/
├── auto-session.json           # Session metadata and agent tracking
├── system-architect-context.md # User responses for system-architect
├── system-architect-template.md# Loaded role template
├── system-architect/           # Dedicated agent outputs
│   ├── analysis.md
│   ├── recommendations.md
│   └── deliverables/
├── ui-designer-context.md      # User responses for ui-designer
├── ui-designer/                # Dedicated agent outputs
│   └── analysis.md
└── synthesis/                  # Multi-role integration
    ├── integrated-analysis.md
    ├── consensus-matrix.md
    └── priority-recommendations.md
```

## Reference Information

### Role Processing Schema (Sequential Architecture)
Each role processing follows dedicated agent pattern:
- **role**: Selected planning role name
- **template**: Loaded from cli-templates/planning-roles/
- **context**: User responses with validation
- **agent**: Dedicated conceptual-planning-agent instance
- **output**: Role-specific analysis directory

### File Structure Reference
**Architecture**: @~/.claude/workflows/workflow-architecture.md
**Role Templates**: @~/.claude/workflows/cli-templates/planning-roles/

### Execution Integration
Documents created for synthesis and action planning:
- **auto-session.json**: Agent tracking and session metadata
- **[role]-context.md**: Context loading for role analysis
- **[role]/analysis.md**: Role-specific analysis outputs
- **synthesis/**: Multi-role integration for comprehensive planning

## Error Handling
- **Role selection failure**: Default to `product-manager` with explanation
- **Context validation failure**: Re-prompt with minimum requirements
- **Agent execution failure**: Role-specific retry with corrected context
- **Template loading issues**: Graceful degradation with fallback questions
- **Multi-role conflicts**: Synthesis agent handles disagreement resolution

## Quality Standards

### Dedicated Agent Excellence
- **Single role focus**: Each agent handles exactly one role - no multi-role assignments
- **Complete context**: Each agent receives comprehensive role-specific context
- **Sequential processing**: Roles processed one at a time with full validation
- **Dedicated output**: Each agent produces role-specific analysis and deliverables

### Context Collection Excellence
- **Role-specific questioning**: Targeted questions for each role's domain expertise
- **Context validation**: Verification before agent submission to ensure completeness
- **User guidance**: Clear explanations of role perspective and question importance
- **Response quality**: Minimum response requirements with re-prompting for insufficient detail