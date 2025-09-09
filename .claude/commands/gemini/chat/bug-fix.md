---
name: bug-fix
parent: /gemini/chat
description: Bug analysis and fix suggestions using specialized template
usage: /gemini:chat:bug-fix "bug description"
argument-hint: "description of the bug or error you're experiencing"
examples:
  - /gemini:chat:bug-fix "authentication null pointer error in login flow"
  - /gemini:chat:bug-fix "React component not re-rendering after state change"
  - /gemini:chat:bug-fix "database connection timeout in production"
allowed-tools: Bash(gemini:*)
model: sonnet
---

### 🐛 **Command Overview: `/gemini:chat:bug-fix`**

-   **Type**: Template-based Gemini CLI Wrapper
-   **Purpose**: Specialized bug analysis and fix suggestions using expert diagnostic template
-   **Template**: Bug fix analysis template for systematic problem diagnosis
-   **Core Tool**: `Bash(gemini:*)` - Executes Gemini CLI with bug-fix template

### 📥 **Parameters & Usage**

-   **`<bug description>` (Required)**: Description of the bug, error, or unexpected behavior
-   **`--all-files` (Optional)**: Includes entire codebase for comprehensive analysis
-   **`--save-session` (Optional)**: Saves the bug analysis to current workflow session

### 🔄 **Execution Workflow**

`Parse Bug Description` **->** `Load Bug-Fix Template` **->** `Assemble Context` **->** `Execute Gemini CLI` **->** `(Optional) Save Session`

### 📋 **Bug Analysis Focus**

The bug-fix template provides structured analysis covering:
- **Root Cause Analysis**: Systematic investigation of underlying issues
- **Code Path Tracing**: Following execution flow to identify failure points
- **Hypothesis Validation**: Testing theories about bug origins
- **Targeted Solutions**: Specific, minimal fixes rather than broad refactoring
- **Impact Assessment**: Understanding side effects of proposed fixes

### 📚 **Context Assembly**

Context includes:
1. **Bug-Fix Template**: @~/.claude/prompt-templates/bug-fix.md
2. **Project Guidelines**: @{CLAUDE.md,**/*CLAUDE.md}
3. **Relevant Files**: User-specified files or all files if `--all-files` used

### 📝 **Prompt Structure**

```
=== SYSTEM PROMPT ===
@~/.claude/prompt-templates/bug-fix.md

=== CONTEXT ===
@{CLAUDE.md,**/*CLAUDE.md}
@{target_files}

=== USER INPUT ===
[Bug description and any relevant details]
```

### ⚙️ **Implementation**

```pseudo
FUNCTION execute_bug_fix_analysis(bug_description, flags):
  // Load bug-fix template
  template = load_file(@~/.claude/prompt-templates/bug-fix.md)
  
  // Construct prompt with template
  prompt = "=== SYSTEM PROMPT ===\n" + template + "\n\n"
  prompt += "=== CONTEXT ===\n"
  prompt += "@{CLAUDE.md,**/*CLAUDE.md}\n"
  
  // Execute with appropriate context
  IF flags contain "--all-files":
    result = execute_tool("Bash(gemini:*)", "--all-files", "-p", prompt + bug_description)
  ELSE:
    prompt += "\n=== USER INPUT ===\n" + bug_description
    result = execute_tool("Bash(gemini:*)", "-p", prompt)
  
  // Save session if requested
  IF flags contain "--save-session":
    save_bug_analysis_session(bug_description, result)
  
  RETURN result
END FUNCTION
```

### 💾 **Session Integration**

When `--save-session` is used:
- Saves to `.workflow/WFS-[topic]/.chat/` directory
- File named: `bug-fix-YYYYMMDD-HHMMSS.md`
- Includes template used, bug description, analysis, and recommendations

**Session Template:**
```markdown
# Bug Fix Analysis: [Timestamp]

## Bug Description
[Original bug description]

## Template Used
bug-fix.md - Expert diagnostic analysis template

## Analysis Results
[Complete Gemini response with root cause analysis and fix suggestions]

## Recommended Actions
- [Immediate fixes]
- [Prevention measures]
- [Testing recommendations]
```