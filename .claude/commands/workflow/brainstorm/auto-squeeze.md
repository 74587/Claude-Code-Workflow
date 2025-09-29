---
name: auto-squeeze
description: Sequential command coordination for brainstorming workflow commands
usage: /workflow:brainstorm:auto-squeeze "<topic>"
argument-hint: "topic or challenge description for coordinated brainstorming"
examples:
  - /workflow:brainstorm:auto-squeeze "Build real-time collaboration feature"
  - /workflow:brainstorm:auto-squeeze "Optimize database performance for millions of users"
  - /workflow:brainstorm:auto-squeeze "Implement secure authentication system"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Glob(*)
---

# Sequential Auto Brainstorming Coordination Command

## Usage
```bash
/workflow:brainstorm:auto-squeeze "<topic>"
```

## Purpose
**Sequential command coordination for brainstorming workflow** by calling existing brainstorm commands using SlashCommand tool. This command orchestrates the complete brainstorming workflow from framework generation to synthesis in sequential order.

## Command Coordination Workflow

### Phase 1: Framework Generation
1. **Call artifacts command**: Execute `/workflow:brainstorm:artifacts "{topic}"`
2. **Verify framework creation**: Check for topic-framework.md existence
3. **Session validation**: Ensure active session continuity

### Phase 2: Role Analysis Coordination
1. **Role selection**: Auto-select 2-3 relevant roles based on topic keywords
2. **Display selected roles**: Clearly list the chosen roles before execution
   ```
   Selected roles for analysis:
   - ui-designer (UI/UX perspective)
   - system-architect (Technical architecture)
   - security-expert (Security considerations)
   ```
3. **Sequential execution**: Call each role command using SlashCommand
4. **Progress monitoring**: Track completion of each role analysis
5. **Role execution order**:
   - `/workflow:brainstorm:ui-designer` - UI/UX perspective
   - `/workflow:brainstorm:system-architect` - Technical architecture
   - `/workflow:brainstorm:security-expert` - Security considerations

### Phase 3: Synthesis Coordination
1. **Completion verification**: Ensure all role analyses are complete
2. **Call synthesis command**: Execute `/workflow:brainstorm:synthesis`
3. **Final validation**: Verify synthesis document creation

## Role Selection Logic

### Keyword-Based Role Mapping
- **Technical & Architecture**: `architecture|system|performance|database|security` → system-architect, data-architect, security-expert
- **Product & UX**: `user|ui|ux|interface|design|product|feature` → ui-designer, user-researcher, product-manager
- **Business & Process**: `business|process|workflow|cost|innovation` → business-analyst, innovation-lead
- **Default fallback**: ui-designer if no clear match

### Auto-Selection Rules
- **Maximum 3 roles**: Select most relevant based on topic analysis
- **Priority ordering**: Most relevant role first
- **Coverage ensure**: Include complementary perspectives

## Implementation Protocol

### Sequential Command Execution
```bash
# Phase 1: Generate framework
SlashCommand(command="/workflow:brainstorm:artifacts \"{topic}\"")

# Display selected roles
echo "Selected roles for analysis:"
echo "- ui-designer (UI/UX perspective)"
echo "- system-architect (Technical architecture)"
echo "- security-expert (Security considerations)"

# Phase 2: Execute selected roles sequentially
SlashCommand(command="/workflow:brainstorm:ui-designer")
SlashCommand(command="/workflow:brainstorm:system-architect")
SlashCommand(command="/workflow:brainstorm:security-expert")

# Phase 3: Generate synthesis
SlashCommand(command="/workflow:brainstorm:synthesis")
```

### Progress Tracking
```javascript
TodoWrite({
  todos: [
    {
      content: "Generate topic framework using artifacts command",
      status: "in_progress",
      activeForm: "Generating topic framework"
    },
    {
      content: "Display selected roles: ui-designer, system-architect, security-expert",
      status: "pending",
      activeForm: "Displaying selected roles for analysis"
    },
    {
      content: "Execute ui-designer role analysis",
      status: "pending",
      activeForm: "Executing ui-designer analysis"
    },
    {
      content: "Execute system-architect role analysis",
      status: "pending",
      activeForm: "Executing system-architect analysis"
    },
    {
      content: "Execute security-expert role analysis",
      status: "pending",
      activeForm: "Executing security-expert analysis"
    },
    {
      content: "Generate synthesis report",
      status: "pending",
      activeForm: "Generating synthesis report"
    }
  ]
});
```

### Verification Steps
Between each phase:
1. **Check command completion**: Verify previous command finished successfully
2. **Validate outputs**: Ensure expected files were created
3. **Update progress**: Mark current task complete, start next task
4. **Error handling**: Stop workflow if any command fails

## Error Handling

### Command Failure Recovery
- **Framework generation fails**: Stop workflow, report error
- **Role analysis fails**: Continue with remaining roles, note failure
- **Synthesis fails**: Attempt retry once, then report partial completion

### Session Management
- **Active session required**: Use existing session or create new one
- **Session continuity**: Maintain same session throughout workflow
- **Multi-session handling**: Prompt user if multiple active sessions

## Expected Output Structure

```
.workflow/WFS-{session}/.brainstorming/
├── topic-framework.md          # Generated by artifacts command
├── ui-designer/
│   └── analysis.md            # Generated by ui-designer command
├── system-architect/
│   └── analysis.md            # Generated by system-architect command
├── security-expert/
│   └── analysis.md            # Generated by security-expert command
└── synthesis-report.md        # Generated by synthesis command
```

## Test Scenarios

### Test Case 1: UI/UX Focus Topic
**Topic**: "Redesign user authentication interface"
**Expected roles**: ui-designer, user-researcher, security-expert
**Validation**: Check UI-focused analysis in each role output

### Test Case 2: Technical Architecture Topic
**Topic**: "Design scalable microservices architecture"
**Expected roles**: system-architect, data-architect, security-expert
**Validation**: Check technical depth in architecture analysis

### Test Case 3: Business Process Topic
**Topic**: "Optimize customer onboarding workflow"
**Expected roles**: business-analyst, product-manager, ui-designer
**Validation**: Check business process focus in analysis

## Quality Assurance

### Command Integration Verification
- **All commands execute independently**: Each command handles its own validation
- **No direct dependencies**: Commands work with framework reference
- **Consistent session usage**: All commands use same session directory
- **Proper error propagation**: Failed commands don't break workflow

### Output Quality Checks
- **Framework completeness**: topic-framework.md has all required sections
- **Role analysis depth**: Each role provides substantial analysis
- **Synthesis integration**: synthesis-report.md references all role analyses
- **Cross-references work**: @ notation links function correctly

## Success Criteria
1. **Complete workflow execution**: All phases complete without errors
2. **Proper file generation**: All expected output files created
3. **Content quality**: Each document contains substantial, relevant analysis
4. **Integration validation**: Synthesis properly references all role analyses
5. **Session consistency**: All outputs in correct session directory

---
*Sequential command coordination for brainstorming workflow*