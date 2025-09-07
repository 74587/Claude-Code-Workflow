---
name: brainstorm
description: Multi-perspective brainstorming coordination command that orchestrates multiple agents for comprehensive ideation and solution exploration
usage: /brainstorm <topic|challenge> [--mode=<creative|analytical|strategic>] [--perspectives=<role1,role2,...>] [--execution=<serial|parallel>]
argument-hint: "brainstorming topic or challenge description" [optional: mode, perspectives, execution]
examples:
  - /brainstorm "innovative user authentication methods"
  - /brainstorm "solving scalability challenges" --mode=analytical
  - /brainstorm "redesigning the onboarding experience" --perspectives=ui-designer,user-researcher,product-manager
  - /brainstorm "reducing system complexity" --mode=strategic --execution=parallel
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

### 🚀 **Command Overview: `/brainstorm`**

-   **Type**: Coordination Command
-   **Purpose**: To orchestrate multiple specialized agents for comprehensive multi-perspective brainstorming on challenges and opportunities.
-   **Core Tools**: `Task(conceptual-planning-agent)`, `TodoWrite(*)`
-   **Core Principles**: @~/.claude/workflows/core-principles.md
-   **Integration Rules**:
    -   @~/.claude/workflows/brainstorming-principles.md
    -   @~/.claude/workflows/todowrite-coordination-rules.md

### 🔄 **Overall Brainstorming Protocol**

`Phase 1: Coordination Setup` **->** `Phase 1.5: User Discussion & Validation` **->** `Phase 2: Agent Coordination` **->** `Phase 3: Synthesis & Documentation`

### ⚙️ **Brainstorming Modes**

-   **`creative` (Default)**
    -   **Approach**: Divergent thinking, "what if" scenarios.
    -   **Agent Selection**: Auto-selects `innovation-lead`, `ui-designer`, `user-researcher`, and a business agent.
    -   **Execution**: Typically parallel.
-   **`analytical`**
    -   **Approach**: Root cause analysis, data-driven insights.
    -   **Agent Selection**: Auto-selects `business-analyst`, `data-architect`, `system-architect`, and a domain expert.
    -   **Execution**: Typically serial.
-   **`strategic`**
    -   **Approach**: Systems thinking, long-term visioning.
    -   **Agent Selection**: Auto-selects `innovation-lead`, `product-manager`, `business-analyst`, and a technical expert.
    -   **Execution**: Mixed serial/parallel.

### 🚦 **Execution Patterns**

-   **`serial` (Default)**
    -   **Use Case**: When perspectives need to build on each other.
    -   **Process**: Agents run one at a time, informed by previous outputs.
-   **`parallel`**
    -   **Use Case**: When diverse, independent perspectives are needed quickly.
    -   **Process**: All selected agents run simultaneously.
-   **`hybrid`**
    -   **Use Case**: Complex, multi-phase brainstorming.
    -   **Process**: Combines parallel initial ideation with serial refinement phases.

### 🎭 **Available Perspectives (Agent Roles)**

-   `product-manager`: User needs, business value, market positioning.
-   `system-architect`: Technical architecture, scalability, integration.
-   `ui-designer`: User experience, interface design, usability.
-   `data-architect`: Data flow, storage, analytics, insights.
-   `security-expert`: Security implications, threat modeling, compliance.
-   `user-researcher`: User behavior, pain points, research insights.
-   `business-analyst`: Process optimization, efficiency, ROI.
-   `innovation-lead`: Emerging trends, disruptive technologies, opportunities.
-   `feature-planner`: Feature planning and development strategy.
-   `test-strategist`: Testing strategy and quality assurance.

### 🤖 **Agent Selection & Loading Logic**

This logic determines which agents participate in the brainstorming session.

```pseudo
FUNCTION select_agents(mode, perspectives_arg):
    IF perspectives_arg is provided:
        // User explicitly defines roles via --perspectives flag
        RETURN perspectives_arg.split(',')
    ELSE:
        // Automatic selection based on mode or topic analysis
        CASE topic_type:
            WHEN "Technical Challenge":
                selected = ["system-architect", "security-expert"]
                IF topic is data_heavy: ADD "data-architect"
                RETURN selected
            WHEN "User-Facing Feature":
                RETURN ["ui-designer", "user-researcher", "product-manager"]
            WHEN "Business Process":
                RETURN ["business-analyst", "product-manager"]
            WHEN "Innovation/Strategy":
                RETURN ["innovation-lead", "product-manager"]
            DEFAULT:
                // Fallback to mode-based selection
                CASE mode:
                    WHEN "creative": RETURN ["innovation-lead", "ui-designer", "user-researcher", ...]
                    WHEN "analytical": RETURN ["business-analyst", "data-architect", "system-architect", ...]
                    WHEN "strategic": RETURN ["innovation-lead", "product-manager", "business-analyst", ...]
                END CASE
        END CASE
    END IF
END FUNCTION

FUNCTION load_agent_role(role_name):
  // Dynamically loads role capabilities using the specified shell script
  execute_tool("Bash", "~/.claude/scripts/plan-executor.sh " + role_name)
END FUNCTION
```

### 🏗️ **Phase 1: Coordination Setup Protocol**

⚠️ **CRITICAL**: Before brainstorming, MUST check for existing active session to avoid creating duplicate sessions.

**Session Check Process:**
1. **Query Session Registry**: Check `.workflow/session_status.jsonl` for active sessions. If the file doesn't exist, create it.
2. **Session Selection**: Use existing active session or create new one only if none exists
3. **Context Integration**: Load existing session state and continue brainstorming phase

`Check Active Session` **->** `Generate Topic Slug (WFS-[topic-slug]) if needed` **->** `Create Project Directories (.workflow/WFS-[slug]/.brainstorming/{agent1}, {agent2}, ...)` **->** `Initialize/Update session-state.json` **->** `Verify Structure` **->** `Initialize TodoWrite`

### 📝 **Initial TodoWrite Structure (Template)**

This `TodoWrite` call establishes the complete workflow plan at the beginning of the session.
```
TodoWrite([
  {"content": "Establish project structure and initialize session", "status": "completed", "activeForm": "Establishing project structure"},
  {"content": "Set up brainstorming session and select perspectives", "status": "in_progress", "activeForm": "Setting up brainstorming session"},
  {"content": "Discuss [agent1] scope and gather user requirements", "status": "pending", "activeForm": "Discussing [agent1] requirements with user"},
  {"content": "Coordinate [selected_agent1] perspective analysis", "status": "pending", "activeForm": "Coordinating [agent1] perspective"},
  {"content": "Discuss [agent2] scope and gather user requirements", "status": "pending", "activeForm": "Discussing [agent2] requirements with user"},
  {"content": "Coordinate [selected_agent2] perspective analysis", "status": "pending", "activeForm": "Coordinating [agent2] perspective"},
  {"content": "Discuss [agent3] scope and gather user requirements", "status": "pending", "activeForm": "Discussing [agent3] requirements with user"},
  {"content": "Coordinate [selected_agent3] perspective analysis", "status": "pending", "activeForm": "Coordinating [agent3] perspective"},
  {"content": "Synthesize multi-perspective insights", "status": "pending", "activeForm": "Synthesizing insights"},
  {"content": "Generate prioritized recommendations", "status": "pending", "activeForm": "Generating recommendations"},
  {"content": "Create comprehensive brainstorming documentation", "status": "pending", "activeForm": "Creating documentation"}
])
```

### 💬 **Phase 1.5: Mandatory User Discussion Protocol**

This validation loop is **required** before *each* agent is executed.

```pseudo
FUNCTION validate_and_run_agents(selected_agents):
  FOR EACH agent in selected_agents:
    // Update the task list to show which discussion is active
    update_todowrite("Discuss " + agent + " scope", "in_progress") // Corresponds to TodoWrite(*) tool

    present_agent_scope(agent)
    user_context = ask_context_questions(agent) // Example questions in next card
    present_task_roadmap(agent)

    LOOP:
      user_response = get_user_input("Ready to proceed with " + agent + " analysis?")
      IF user_response is "Yes, proceed" or similar:
        // User has given explicit approval
        update_todowrite("Discuss " + agent + " scope", "completed") // Corresponds to TodoWrite(*)
        execute_agent_task(agent, user_context) // Proceeds to Phase 2 for this agent
        BREAK
      ELSE IF user_response is "No", "Wait", or requests changes:
        // User has feedback, revise the plan
        revise_approach(user_feedback)
        present_task_roadmap(agent) // Re-present the revised plan
      END IF
    END LOOP
  END FOR
END FUNCTION
```

### ❓ **User Discussion Question Templates**

-   **System Architect**: Technical constraints? Integrations? Scalability needs?
-   **UI Designer**: Primary users? Usability challenges? Brand guidelines? Accessibility?
-   **Product Manager**: Business goals? Key stakeholders? Market factors? Success metrics?
-   **Data Architect**: Data sources? Privacy/compliance? Quality challenges?
-   **Security Expert**: Threat models? Compliance needs (GDPR, etc.)? Security level?

### 🧠 **Phase 2: Agent Coordination Logic**

This logic executes after user approval for each agent.

```pseudo
FUNCTION execute_agent_task(agent, user_context):
    update_todowrite("Coordinate " + agent + " perspective", "in_progress") // Corresponds to TodoWrite(*) tool

    // This action corresponds to calling the allowed tool: Task(conceptual-planning-agent)
    // The specific prompt templates are provided in the source documentation.
    status = execute_tool("Task(conceptual-planning-agent)", agent, user_context)

    IF status is 'SUCCESS':
      update_todowrite("Coordinate " + agent + " perspective", "completed")
    ELSE:
      // Handle potential agent execution failure
      log_error("Agent " + agent + " failed.")
      HALT_WORKFLOW()
    END IF
END FUNCTION
```

### 📋 **Agent Execution Task Templates (Serial & Parallel)**

These templates show the exact structure of the `Task(conceptual-planning-agent)` call.

-   **For Serial Execution (one agent at a time):**
    ```
    Task(conceptual-planning-agent): "Conduct brainstorming analysis for: [topic]. Use [mode] brainstorming approach. Required perspective: [agent1]. 

    Load role definition using: ~/.claude/scripts/plan-executor.sh [agent1]

    USER CONTEXT FROM DISCUSSION:
    - Specific focus areas: [user_specified_challenges_goals]
    - Constraints and requirements: [user_specified_constraints]
    - Expected outcomes: [user_expected_outcomes]
    - Additional user requirements: [other_user_inputs]

    OUTPUT REQUIREMENT: Save all generated documents to: .workflow/WFS-[topic-slug]/.brainstorming/[agent1]/
    - analysis.md (main perspective analysis incorporating user context) 
    - [agent1-specific-output].md (specialized deliverable addressing user requirements)

    Apply the returned planning template and generate comprehensive analysis from this perspective, ensuring all user-specified requirements and context are fully incorporated."
    ```
-   **For Parallel Execution (multiple agents at once):**
    ```
    Task(conceptual-planning-agent): "Conduct multi-perspective brainstorming analysis for: [topic]. Use [mode] brainstorming approach. Required perspectives: [agent1, agent2, agent3]. 

    For each perspective, follow this protocol:
    1. Load role definition using: ~/.claude/scripts/plan-executor.sh [role]
    2. Incorporate user discussion context for each agent:
       - [Agent1]: Focus areas: [user_input_agent1], Constraints: [constraints_agent1], Expected outcomes: [outcomes_agent1]
       - [Agent2]: Focus areas: [user_input_agent2], Constraints: [constraints_agent2], Expected outcomes: [outcomes_agent2]
       - [Agent3]: Focus areas: [user_input_agent3], Constraints: [constraints_agent3], Expected outcomes: [outcomes_agent3]
    3. OUTPUT REQUIREMENT: Save documents to: .workflow/WFS-[topic-slug]/.brainstorming/[role]/
       - analysis.md (main perspective analysis incorporating user context) 
       - [role-specific-output].md (specialized deliverable addressing user requirements)

    Apply all perspectives in parallel analysis, ensuring each agent's output incorporates their specific user discussion context and is saved to their designated directory."
    ```

### 🏁 **Phase 3: Synthesis & Documentation Flow**

`Integrate All Agent Insights` **->** `Prioritize Solutions (by feasibility & impact)` **->** `Generate Comprehensive Summary Document` **->** `Mark All Todos as 'completed'`

### ✅ **Core Principles & Quality Standards**

-   **User-Driven Process**: Every agent execution **must** be preceded by user discussion and explicit approval.
-   **Context Integration**: All user inputs (focus areas, constraints, goals) must be fully incorporated into agent analysis.
-   **`TodoWrite` First**: A `TodoWrite` plan must be established before any agent coordination begins.
-   **Single Active Task**: Only one `TodoWrite` item should be marked `"in_progress"` at any time.
-   **Transparent & Flexible**: The user understands what each agent will do and can provide feedback to revise the plan.

### 📄 **Synthesis Output Structure**

A guide for the final comprehensive report generated at the end of the workflow.
-   **Session Summary**:
    -   Coordination approach (serial/parallel)
    -   Agent perspectives involved
    -   Brainstorming mode applied
-   **Individual Agent Insights**:
    -   Summary of each agent's analysis.
    -   Note areas of agreement or disagreement.
-   **Cross-Perspective Synthesis**:
    -   Identify convergent themes and breakthrough ideas.
-   **Actionable Recommendations**:
    -   Categorize actions (immediate, strategic, research).
-   **Implementation Guidance**:
    -   Suggested phases, resource needs, success metrics.

## 📁 **File Generation System**

### Automatic File Generation
Every brainstorming session generates a comprehensive set of structured output files:

#### Generated File Structure
```
.workflow/WFS-[topic-slug]/.brainstorming/
├── synthesis-analysis.md          # Cross-perspective analysis
├── recommendations.md             # Actionable recommendations
├── brainstorm-session.json       # Session metadata
├── [agent1]/                      # Individual agent outputs
│   ├── analysis.md               # Main perspective analysis
│   └── [specific-deliverable].md # Agent-specific outputs
├── [agent2]/
│   ├── analysis.md
│   └── [specific-deliverable].md
└── artifacts/                     # Supporting materials
    ├── user-context.md           # Captured user discussion
    ├── session-transcript.md     # Brainstorming session log
    └── export/                   # Export formats
        ├── brainstorm-summary.pdf
        └── recommendations.json
```

### Core Output Documents

#### 1. synthesis-analysis.md
Cross-perspective synthesis of all agent insights:
```markdown
# Brainstorming Synthesis Analysis
*Session: WFS-[topic-slug] | Generated: 2025-09-07 16:00:00*

## Session Overview
- **Topic**: [brainstorming topic]
- **Mode**: [creative|analytical|strategic]
- **Execution**: [serial|parallel]
- **Participants**: [list of agent roles]
- **Duration**: [session duration]

## Individual Agent Insights Summary

### 🎨 UI Designer Perspective
**Focus Areas**: User experience, interface design, usability
**Key Insights**:
- Modern, intuitive design approach
- Mobile-first considerations
- Accessibility requirements
**Recommendations**: [specific design recommendations]

### 🏗️ System Architect Perspective  
**Focus Areas**: Technical architecture, scalability, integration
**Key Insights**:
- Microservices architecture benefits
- Database optimization strategies
- Security considerations
**Recommendations**: [specific technical recommendations]

[Additional agent perspectives...]

## Cross-Perspective Analysis

### Convergent Themes
1. **User-Centric Approach**: All agents emphasized user experience priority
2. **Scalability Focus**: Common concern for system growth capacity
3. **Security Integration**: Unanimous priority on security-by-design

### Breakthrough Ideas
1. **Unified Authentication System**: Cross-platform identity management
2. **Progressive Web App**: Mobile and desktop feature parity
3. **AI-Powered Analytics**: Smart user behavior insights

### Areas of Disagreement
1. **Technology Stack**: [description of disagreement and perspectives]
2. **Implementation Timeline**: [varying estimates and approaches]

## Strategic Synthesis
[Integrated analysis combining all perspectives into coherent strategy]

---
*Generated by /brainstorm synthesis phase*
```

#### 2. recommendations.md
Actionable recommendations categorized by priority and scope:
```markdown
# Brainstorming Recommendations
*Session: WFS-[topic-slug] | Generated: 2025-09-07 16:15:00*

## Executive Summary
[High-level summary of key recommendations]

## Immediate Actions (0-2 weeks)
### High Priority - Critical
- **REC-001**: [Recommendation title]
  - **Context**: [Background and rationale]
  - **Action**: [Specific steps to take]
  - **Resources**: [Required resources/skills]
  - **Impact**: [Expected outcomes]
  - **Owner**: [Suggested responsible party]

### Medium Priority - Important
- **REC-002**: [Recommendation title]
  [Same structure as above]

## Strategic Actions (2-8 weeks)
### Architecture & Infrastructure
- **REC-003**: [Technical improvements]
- **REC-004**: [System optimizations]

### User Experience & Design
- **REC-005**: [UX improvements]  
- **REC-006**: [Design system updates]

## Research Actions (Future Investigation)
### Technical Research
- **REC-007**: [Emerging technology evaluation]
- **REC-008**: [Performance optimization study]

### Market Research
- **REC-009**: [User behavior analysis]
- **REC-010**: [Competitive analysis]

## Implementation Roadmap
### Phase 1: Foundation (Weeks 1-2)
- Execute REC-001, REC-002
- Establish core infrastructure

### Phase 2: Development (Weeks 3-6) 
- Implement REC-003, REC-004, REC-005
- Build core features

### Phase 3: Enhancement (Weeks 7-8)
- Deploy REC-006
- Optimize and refine

## Success Metrics
- [Quantifiable measures of success]
- [Key performance indicators]

## Risk Assessment
- [Potential obstacles and mitigation strategies]

---
*Generated by /brainstorm recommendations synthesis*
```

#### 3. brainstorm-session.json
Session metadata and tracking:
```json
{
  "session_id": "WFS-[topic-slug]",
  "brainstorm_id": "BRM-2025-09-07-001",
  "topic": "[brainstorming topic]",
  "mode": "creative",
  "execution": "parallel",
  "created_at": "2025-09-07T15:30:00Z",
  "completed_at": "2025-09-07T16:30:00Z",
  "duration_minutes": 60,
  "participants": {
    "agents": ["ui-designer", "system-architect", "product-manager"],
    "user_interaction": true
  },
  "outputs": {
    "agent_analyses": {
      "ui-designer": {
        "analysis_path": ".brainstorming/ui-designer/analysis.md",
        "deliverable_path": ".brainstorming/ui-designer/design-mockups.md",
        "completed_at": "2025-09-07T15:50:00Z"
      },
      "system-architect": {
        "analysis_path": ".brainstorming/system-architect/analysis.md",
        "deliverable_path": ".brainstorming/system-architect/architecture-proposal.md",
        "completed_at": "2025-09-07T15:55:00Z"
      },
      "product-manager": {
        "analysis_path": ".brainstorming/product-manager/analysis.md",
        "deliverable_path": ".brainstorming/product-manager/feature-roadmap.md",
        "completed_at": "2025-09-07T16:00:00Z"
      }
    },
    "synthesis": {
      "analysis_path": "synthesis-analysis.md",
      "recommendations_path": "recommendations.md",
      "completed_at": "2025-09-07T16:30:00Z"
    }
  },
  "user_context": {
    "focus_areas": "[captured from user discussion]",
    "constraints": "[user-specified limitations]",
    "expected_outcomes": "[user goals and expectations]"
  },
  "metrics": {
    "insights_generated": 24,
    "recommendations_count": 10,
    "breakthrough_ideas": 3,
    "consensus_areas": 3,
    "disagreement_areas": 2
  }
}
```

### Session Integration
After brainstorming completion, the main workflow-session.json is updated:
```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "completed",
      "completed_at": "2025-09-07T16:30:00Z",
      "output_directory": ".workflow/WFS-[topic-slug]/.brainstorming/",
      "documents_generated": [
        "synthesis-analysis.md",
        "recommendations.md", 
        "brainstorm-session.json"
      ],
      "agents_participated": ["ui-designer", "system-architect", "product-manager"],
      "insights_available": true
    }
  },
  "documents": {
    "brainstorming": {
      "synthesis-analysis.md": {
        "status": "generated",
        "path": ".workflow/WFS-[topic-slug]/.brainstorming/synthesis-analysis.md",
        "generated_at": "2025-09-07T16:30:00Z",
        "type": "synthesis_analysis"
      },
      "recommendations.md": {
        "status": "generated", 
        "path": ".workflow/WFS-[topic-slug]/.brainstorming/recommendations.md",
        "generated_at": "2025-09-07T16:30:00Z",
        "type": "actionable_recommendations"
      }
    }
  }
}
```

### Export and Integration Features
- **PDF Export**: Automatic generation of consolidated brainstorming report
- **JSON Export**: Machine-readable recommendations for integration tools
- **Action Plan Integration**: Direct feeding into `/workflow:action-plan --from-brainstorming`
- **Cross-Referencing**: Links to specific agent insights from synthesis documents
