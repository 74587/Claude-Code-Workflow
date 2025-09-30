---
name: auto-squeeze
description: Orchestrate 3-phase brainstorming workflow by executing commands sequentially
usage: /workflow:brainstorm:auto-squeeze "<topic>"
argument-hint: "topic or challenge description for coordinated brainstorming"
examples:
  - /workflow:brainstorm:auto-squeeze "Build real-time collaboration feature"
  - /workflow:brainstorm:auto-squeeze "Optimize database performance for millions of users"
  - /workflow:brainstorm:auto-squeeze "Implement secure authentication system"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*)
---

# Workflow Brainstorm Auto-Squeeze Command

## Coordinator Role

**This command is a pure orchestrator**: Execute brainstorming commands in sequence (artifacts → roles → synthesis), auto-select relevant roles, and ensure complete brainstorming workflow execution.

**Execution Flow**:
1. Initialize TodoWrite → Execute Phase 1 (artifacts) → Validate framework → Update TodoWrite
2. Select 2-3 relevant roles → Display selection → Execute Phase 2 (role analyses) → Update TodoWrite
3. Execute Phase 3 (synthesis) → Validate outputs → Return summary

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **Auto-Select Roles**: Analyze topic keywords to select 2-3 most relevant roles (max 3)
3. **Display Selection**: Show selected roles to user before execution
4. **Sequential Execution**: Execute role commands one by one, not in parallel
5. **Complete All Phases**: Do not return to user until synthesis completes
6. **Track Progress**: Update TodoWrite after every command completion

## 3-Phase Execution

### Phase 1: Framework Generation

**Step 1.1: Role Selection**
Auto-select 2-3 roles based on topic keywords (see Role Selection Logic below)

**Step 1.2: Generate Role-Specific Framework**
**Command**: `SlashCommand(command="/workflow:brainstorm:artifacts \"[topic]\" --roles \"[role1,role2,role3]\"")`

**Input**: Selected roles from step 1.1

**Parse Output**:
- Verify topic-framework.md created with role-specific sections

**Validation**:
- File `.workflow/[session]/.brainstorming/topic-framework.md` exists
- Contains sections for each selected role
- Includes cross-role integration points

**TodoWrite**: Mark phase 1 completed, mark "Display selected roles" as in_progress

---

### Phase 2: Role Analysis Execution

**Step 2.1: Role Selection**
Use keyword analysis to auto-select 2-3 roles:

**Role Selection Logic**:
- **Technical/Architecture keywords**: `architecture|system|performance|database|api|backend|scalability`
  → system-architect, data-architect, security-expert
- **UI/UX keywords**: `user|ui|ux|interface|design|frontend|experience`
  → ui-designer, user-researcher
- **Product/Business keywords**: `product|feature|business|workflow|process|customer`
  → product-manager, business-analyst
- **Security keywords**: `security|auth|permission|encryption|compliance`
  → security-expert
- **Innovation keywords**: `innovation|new|disrupt|transform|emerging`
  → innovation-lead
- **Default**: ui-designer (if no clear match)

**Selection Rules**:
- Maximum 3 roles
- Select most relevant role first based on strongest keyword match
- Include complementary perspectives (e.g., if system-architect selected, also consider security-expert)

**Step 2.2: Display Selected Roles**
Show selection to user before execution:
```
Selected roles for analysis:
- ui-designer (UI/UX perspective)
- system-architect (Technical architecture)
- security-expert (Security considerations)
```

**Step 2.3: Execute Role Commands Sequentially**
Execute each selected role command one by one:

**Commands**:
- `SlashCommand(command="/workflow:brainstorm:ui-designer")`
- `SlashCommand(command="/workflow:brainstorm:system-architect")`
- `SlashCommand(command="/workflow:brainstorm:security-expert")`
- `SlashCommand(command="/workflow:brainstorm:user-researcher")`
- `SlashCommand(command="/workflow:brainstorm:product-manager")`
- `SlashCommand(command="/workflow:brainstorm:business-analyst")`
- `SlashCommand(command="/workflow:brainstorm:data-architect")`
- `SlashCommand(command="/workflow:brainstorm:innovation-lead")`
- `SlashCommand(command="/workflow:brainstorm:feature-planner")`

**Validation** (after each role):
- File `.workflow/[session]/.brainstorming/[role]/analysis.md` exists
- Contains role-specific analysis

**TodoWrite**: Mark each role task completed after execution, start next role as in_progress

---

### Phase 3: Synthesis Generation
**Command**: `SlashCommand(command="/workflow:brainstorm:synthesis")`

**Validation**:
- File `.workflow/[session]/.brainstorming/synthesis-report.md` exists
- Contains cross-references to role analyses using @ notation

**TodoWrite**: Mark phase 3 completed

**Return to User**:
```
Brainstorming complete for topic: [topic]
Framework: .workflow/[session]/.brainstorming/topic-framework.md
Roles analyzed: [role1], [role2], [role3]
Synthesis: .workflow/[session]/.brainstorming/synthesis-report.md
```

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Generate topic framework", "status": "in_progress", "activeForm": "Generating topic framework"},
  {"content": "Display selected roles", "status": "pending", "activeForm": "Displaying selected roles"},
  {"content": "Execute ui-designer analysis", "status": "pending", "activeForm": "Executing ui-designer analysis"},
  {"content": "Execute system-architect analysis", "status": "pending", "activeForm": "Executing system-architect analysis"},
  {"content": "Execute security-expert analysis", "status": "pending", "activeForm": "Executing security-expert analysis"},
  {"content": "Generate synthesis report", "status": "pending", "activeForm": "Generating synthesis report"}
]})

// After Phase 1
TodoWrite({todos: [
  {"content": "Generate topic framework", "status": "completed", "activeForm": "Generating topic framework"},
  {"content": "Display selected roles", "status": "in_progress", "activeForm": "Displaying selected roles"},
  {"content": "Execute ui-designer analysis", "status": "pending", "activeForm": "Executing ui-designer analysis"},
  {"content": "Execute system-architect analysis", "status": "pending", "activeForm": "Executing system-architect analysis"},
  {"content": "Execute security-expert analysis", "status": "pending", "activeForm": "Executing security-expert analysis"},
  {"content": "Generate synthesis report", "status": "pending", "activeForm": "Generating synthesis report"}
]})

// After displaying roles
TodoWrite({todos: [
  {"content": "Generate topic framework", "status": "completed", "activeForm": "Generating topic framework"},
  {"content": "Display selected roles", "status": "completed", "activeForm": "Displaying selected roles"},
  {"content": "Execute ui-designer analysis", "status": "in_progress", "activeForm": "Executing ui-designer analysis"},
  {"content": "Execute system-architect analysis", "status": "pending", "activeForm": "Executing system-architect analysis"},
  {"content": "Execute security-expert analysis", "status": "pending", "activeForm": "Executing security-expert analysis"},
  {"content": "Generate synthesis report", "status": "pending", "activeForm": "Generating synthesis report"}
]})

// Continue pattern for each role and synthesis...
```

## Data Flow

```
User Input (topic)
    ↓
Role Selection (analyze topic keywords)
    ↓ Output: 2-3 selected roles (e.g., ui-designer, system-architect, security-expert)
    ↓
Phase 1: artifacts "topic" --roles "role1,role2,role3"
    ↓ Input: topic + selected roles
    ↓ Output: role-specific topic-framework.md
    ↓
Display: Show selected roles to user
    ↓
Phase 2: Execute each role command sequentially
    ↓ Role 1 → reads role-specific section → analysis.md
    ↓ Role 2 → reads role-specific section → analysis.md
    ↓ Role 3 → reads role-specific section → analysis.md
    ↓
Phase 3: synthesis
    ↓ Input: role-specific framework + all role analyses
    ↓ Output: synthesis-report.md with role-targeted insights
    ↓
Return summary to user
```

**Session Context**: All commands use active brainstorming session, sharing:
- Role-specific topic framework
- Role-targeted analyses
- Cross-role integration points
- Synthesis with role-specific insights

**Key Improvement**: Framework is generated with roles parameter, ensuring all discussion points are relevant to selected roles

## Role Selection Examples

### Example 1: UI-Focused Topic
**Topic**: "Redesign user authentication interface"
**Keywords detected**: user, interface, design
**Selected roles**:
- ui-designer (primary: UI/UX match)
- user-researcher (secondary: user experience)
- security-expert (complementary: auth security)

### Example 2: Architecture Topic
**Topic**: "Design scalable microservices architecture"
**Keywords detected**: architecture, scalable, system
**Selected roles**:
- system-architect (primary: architecture match)
- data-architect (secondary: scalability/data)
- security-expert (complementary: system security)

### Example 3: Business Process Topic
**Topic**: "Optimize customer onboarding workflow"
**Keywords detected**: workflow, process, customer
**Selected roles**:
- business-analyst (primary: process match)
- product-manager (secondary: customer focus)
- ui-designer (complementary: user experience)

## Error Handling

- **Framework Generation Failure**: Stop workflow, report error, do not proceed to role selection
- **Role Analysis Failure**: Log failure, continue with remaining roles, note in final summary
- **Synthesis Failure**: Retry once, if still fails report partial completion with available analyses
- **Session Error**: Report session issue, prompt user to check session status

## Output Structure

```
.workflow/[session]/.brainstorming/
├── topic-framework.md          # Phase 1 output
├── [role1]/
│   └── analysis.md            # Phase 2 output (role 1)
├── [role2]/
│   └── analysis.md            # Phase 2 output (role 2)
├── [role3]/
│   └── analysis.md            # Phase 2 output (role 3)
└── synthesis-report.md        # Phase 3 output
```

## Coordinator Checklist

✅ Initialize TodoWrite with framework + display + N roles + synthesis tasks
✅ Execute Phase 1 (artifacts) immediately
✅ Validate topic-framework.md exists
✅ Analyze topic keywords for role selection
✅ Auto-select 2-3 most relevant roles (max 3)
✅ Display selected roles to user with rationale
✅ Execute each role command sequentially
✅ Validate each role's analysis.md after execution
✅ Update TodoWrite after each role completion
✅ Execute Phase 3 (synthesis) after all roles complete
✅ Validate synthesis-report.md exists
✅ Return summary with all generated files