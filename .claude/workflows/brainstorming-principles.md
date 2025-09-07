# Brainstorming System Principles

## Core Philosophy
**"Diverge first, then converge"** - Generate multiple solutions from diverse perspectives, then synthesize and prioritize.

## Project Structure Establishment (MANDATORY FIRST STEP)

### Automatic Directory Creation
Before ANY agent coordination begins, the brainstorming command MUST establish the complete project structure:

1. **Create Session Directory**:
   ```bash
   mkdir -p .workflow/WFS-[topic-slug]/.brainstorming/
   ```

2. **Create Agent Output Directories**: 
   ```bash
   # Create directories ONLY for selected participating agent roles
   mkdir -p .workflow/WFS-[topic-slug]/.brainstorming/{selected-agent1,selected-agent2,selected-agent3}
   # Example: mkdir -p .workflow/WFS-user-auth/.brainstorming/{system-architect,ui-designer,product-manager}
   ```

3. **Initialize Session State**:
   - Create workflow-session.json with brainstorming phase tracking
   - Set up document reference structure
   - Establish agent coordination metadata

### Pre-Agent Verification
Before delegating to conceptual-planning-agent, VERIFY:
- [ ] Topic slug generated correctly
- [ ] All required directories exist  
- [ ] workflow-session.json initialized
- [ ] Agent roles selected and corresponding directories created

## Brainstorming Modes

### Creative Mode (Default)
- **Techniques**: SCAMPER, Six Thinking Hats, wild ideas
- **Focus**: Innovation and unconventional solutions

### Analytical Mode  
- **Techniques**: Root cause analysis, data-driven insights
- **Focus**: Evidence-based systematic problem-solving

### Strategic Mode
- **Techniques**: Systems thinking, scenario planning
- **Focus**: Long-term strategic positioning

## Documentation Structure

### Workflow Integration
Brainstorming sessions are integrated with the unified workflow system under `.workflow/WFS-[topic-slug]/.brainstorming/`. 

**Directory Creation**: If `.workflow/WFS-[topic-slug]/` doesn't exist, create it automatically before starting brainstorming.

**Topic Slug Format**: Convert topic to lowercase with hyphens (e.g., "User Authentication System" → `WFS-user-authentication-system`)

```
.workflow/WFS-[topic-slug]/
└── .brainstorming/
    ├── session-summary.md              # Main session documentation
    ├── synthesis-analysis.md           # Cross-role integration
    ├── recommendations.md              # Prioritized solutions
    ├── system-architect/               # Architecture perspective
    │   ├── analysis.md
    │   └── technical-specifications.md
    ├── ui-designer/                    # Design perspective  
    │   ├── analysis.md
    │   └── user-experience-plan.md
    ├── product-manager/                # Product perspective
    │   ├── analysis.md
    │   └── business-requirements.md
    ├── data-architect/                 # Data perspective
    │   ├── analysis.md
    │   └── data-model-design.md
    ├── test-strategist/                # Testing perspective
    │   ├── analysis.md
    │   └── test-strategy-plan.md
    ├── security-expert/                # Security perspective
    │   ├── analysis.md
    │   └── security-assessment.md
    ├── user-researcher/                # User research perspective
    │   ├── analysis.md
    │   └── user-insights.md
    ├── business-analyst/               # Business analysis perspective
    │   ├── analysis.md
    │   └── process-optimization.md
    ├── innovation-lead/                # Innovation perspective
    │   ├── analysis.md
    │   └── future-roadmap.md
    └── feature-planner/                # Feature planning perspective
        ├── analysis.md
        └── feature-specifications.md
```

## Session Metadata
Each brainstorming session maintains metadata in `session-summary.md` header:

```markdown
# Brainstorming Session: [Topic]

**Session ID**: WFS-[topic-slug]  
**Topic**: [Challenge description]  
**Mode**: creative|analytical|strategic  
**Perspectives**: [role1, role2, role3...]  
**Facilitator**: conceptual-planning-agent  
**Date**: YYYY-MM-DD  

## Session Overview
[Brief session description and objectives]
```

## Quality Standards
- **Clear Structure**: Follow Explore → Ideate → Converge → Document phases
- **Diverse Perspectives**: Include multiple role viewpoints
- **Actionable Outputs**: Generate concrete next steps
- **Comprehensive Documentation**: Capture all insights and recommendations

## Unified Workflow Integration

### Document-State Separation
Following unified workflow system principles:
- **Markdown Files** → Brainstorming insights, role analyses, synthesis results  
- **JSON Files** → Session state, role completion tracking, workflow coordination  
- **Auto-sync** → Integration with `workflow-session.json` for seamless workflow transition

### Session Coordination
Brainstorming sessions integrate with the unified workflow system:

```json
// workflow-session.json integration
{
  "session_id": "WFS-[topic-slug]",
  "type": "complex",  // brainstorming typically creates complex workflows
  "current_phase": "PLAN",  // conceptual phase
  "brainstorming": {
    "status": "active|completed", 
    "mode": "creative|analytical|strategic",
    "roles_completed": ["system-architect", "ui-designer"],
    "current_role": "data-architect",
    "output_directory": ".workflow/WFS-[topic-slug]/.brainstorming/",
    "agent_document_paths": {
      "system-architect": ".workflow/WFS-[topic-slug]/.brainstorming/system-architect/",
      "ui-designer": ".workflow/WFS-[topic-slug]/.brainstorming/ui-designer/",
      "product-manager": ".workflow/WFS-[topic-slug]/.brainstorming/product-manager/",
      "data-architect": ".workflow/WFS-[topic-slug]/.brainstorming/data-architect/"
    }
  }
}
```

### Directory Auto-Creation
Before starting brainstorming session:
```bash
# Create workflow structure and ONLY selected agent directories
mkdir -p .workflow/WFS-[topic-slug]/.brainstorming/
# Create directories for selected agents only
for agent in selected_agents; do
  mkdir -p .workflow/WFS-[topic-slug]/.brainstorming/$agent
done
```

### Agent Document Assignment Protocol
When coordinating with conceptual-planning-agent, ALWAYS specify exact output location:

**Correct Agent Delegation:**
```
Task(conceptual-planning-agent): "Conduct brainstorming analysis for: [topic]. Use [mode] approach. Required perspective: [role]. 

Load role definition using: ~/.claude/scripts/plan-executor.sh [role]

OUTPUT REQUIREMENT: Save all generated documents to: .workflow/WFS-[topic-slug]/.brainstorming/[role]/
- analysis.md (main perspective analysis) 
- [role-specific-output].md (specialized deliverable)
"
```

### Brainstorming Output
The brainstorming phase produces comprehensive role-based analysis documents that serve as input for subsequent workflow phases.