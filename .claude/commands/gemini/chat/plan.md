---
name: plan
parent: /gemini/chat
description: Project planning and architecture analysis using specialized template
usage: /gemini:chat:plan "planning topic"
argument-hint: "planning topic or architectural challenge to analyze"
examples:
  - /gemini:chat:plan "design user dashboard feature architecture"
  - /gemini:chat:plan "plan microservices migration strategy"
  - /gemini:chat:plan "implement real-time notification system"
allowed-tools: Bash(gemini:*)
model: sonnet
---

### 📋 **Command Overview: `/gemini:chat:plan`**

-   **Type**: Template-based Gemini CLI Wrapper
-   **Purpose**: Comprehensive project planning and architecture analysis using expert planning template
-   **Template**: Planning analysis template for systematic feature and system design
-   **Core Tool**: `Bash(gemini:*)` - Executes Gemini CLI with planning template

### 📥 **Parameters & Usage**

-   **`<planning topic>` (Required)**: Description of the feature, system, or architectural challenge to plan
-   **`--all-files` (Optional)**: Includes entire codebase for comprehensive planning context
-   **`--save-session` (Optional)**: Saves the planning analysis to current workflow session

### 🔄 **Execution Workflow**

`Parse Planning Topic` **->** `Load Planning Template` **->** `Assemble Context` **->** `Execute Gemini CLI` **->** `(Optional) Save Session`

### 📋 **Planning Analysis Focus**

The planning template provides structured analysis covering:
- **Requirements Analysis**: Understanding functional and non-functional requirements
- **Architecture Design**: System structure, components, and interactions
- **Implementation Strategy**: Step-by-step development approach
- **Risk Assessment**: Identifying potential challenges and mitigation strategies
- **Resource Planning**: Time, effort, and technology requirements

### 📚 **Context Assembly**

Context includes:
1. **Planning Template**: `@D:\Claude_dms3\.claude\prompt-templates\plan.md`
2. **Project Guidelines**: `@{CLAUDE.md,**/*CLAUDE.md}`
3. **Relevant Files**: User-specified files or all files if `--all-files` used

### 📝 **Prompt Structure**

```
=== SYSTEM PROMPT ===
@D:\Claude_dms3\.claude\prompt-templates\plan.md

=== CONTEXT ===
@{CLAUDE.md,**/*CLAUDE.md}
@{target_files}

=== USER INPUT ===
[Planning topic and any specific requirements or constraints]
```

### ⚙️ **Implementation**

```pseudo
FUNCTION execute_planning_analysis(planning_topic, flags):
  // Load planning template
  template = load_file("D:\Claude_dms3\.claude\prompt-templates\plan.md")
  
  // Construct prompt with template
  prompt = "=== SYSTEM PROMPT ===\n" + template + "\n\n"
  prompt += "=== CONTEXT ===\n"
  prompt += "@{CLAUDE.md,**/*CLAUDE.md}\n"
  
  // Execute with appropriate context
  IF flags contain "--all-files":
    result = execute_tool("Bash(gemini:*)", "--all-files", "-p", prompt + planning_topic)
  ELSE:
    prompt += "\n=== USER INPUT ===\n" + planning_topic
    result = execute_tool("Bash(gemini:*)", "-p", prompt)
  
  // Save session if requested
  IF flags contain "--save-session":
    save_planning_session(planning_topic, result)
  
  RETURN result
END FUNCTION
```

### 💾 **Session Integration**

When `--save-session` is used:
- Saves to `.workflow/WFS-[topic]/.chat/` directory
- File named: `plan-YYYYMMDD-HHMMSS.md`
- Includes template used, planning topic, analysis, and implementation roadmap

**Session Template:**
```markdown
# Planning Analysis: [Timestamp]

## Planning Topic
[Original planning topic description]

## Template Used
plan.md - Expert planning and architecture analysis template

## Analysis Results
[Complete Gemini response with requirements, architecture, and implementation plan]

## Implementation Roadmap
- [Phase 1: Foundation work]
- [Phase 2: Core implementation]
- [Phase 3: Integration and testing]

## Key Decisions
- [Architecture choices]
- [Technology selections]
- [Risk mitigation strategies]
```