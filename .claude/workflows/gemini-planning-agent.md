# Gemini Planning Agent Template

**Purpose**: Identify specific task scope, affected files, and concrete implementation plan

## Template Structure

```bash
gemini --all-files -p "@{[task-related-files]} @{CLAUDE.md,**/*CLAUDE.md}

Task-specific planning analysis for: [exact task description]

## Required Analysis:
1. **Task Scope Identification**:
   - What exactly needs to be built/modified/fixed?
   - Which specific components, files, or modules are affected?
   - What is the precise deliverable?

2. **File and Modification Mapping**:
   - List exact files that need modification (with file:line references where possible)
   - Identify specific functions, classes, or components to change
   - Find configuration files, tests, or documentation that need updates

3. **Dependencies and Integration Points**:
   - What modules/services depend on the changes?
   - What external APIs, databases, or services are involved?
   - Which existing functions will need to call the new code?

4. **Risk and Complexity Assessment**:
   - What could break from these changes?
   - Are there critical paths that need special testing?
   - What rollback strategy is needed?

5. **Implementation Sequence**:
   - What order should changes be made in?
   - Which changes are prerequisites for others?
   - What can be done in parallel?

## Output Requirements:
- **Concrete file list**: Exact files to modify with reasons
- **Specific entry points**: Functions/classes that need changes with line references
- **Clear sequence**: Step-by-step implementation order
- **Risk mitigation**: Specific testing requirements and rollback plans
- **Success criteria**: How to verify each step works

Focus on actionable, specific guidance rather than general patterns."
```

## Intelligent Usage Examples

```python
# API endpoint planning
def planning_agent_context(user_input):
    context = build_intelligent_context(
        user_input="Add user profile management API",
        analysis_type="planning-agent-context",
        domains=['api', 'backend', 'database'],
        tech_stack=['Node.js', 'Express', 'PostgreSQL']
    )
    
    return f"""
    gemini --all-files -p "@{{**/api/**/*,**/routes/**/*,**/controllers/**/*}} 
    @{{**/models/**/*,**/db/**/*}} @{{CLAUDE.md,api/CLAUDE.md,backend/CLAUDE.md}}
    
    Task-specific planning analysis for: Add user profile management API endpoints
    - Profile creation, update, retrieval, deletion endpoints
    - User avatar upload and management
    - Profile privacy settings and visibility controls
    
    Focus on exact file modification points and implementation sequence."
    """
```

## Context Application

- Create detailed, file-specific implementation plan
- Identify exact modification points with line references
- Establish concrete success criteria for each stage
- Plan specific testing and validation steps

## Usage Guidelines

**Use Planning Agent template when**:
- Before creating implementation plans for specific features or fixes
- You need to understand exact scope and modification points
- Focus on concrete deliverables rather than architectural overviews

**Template focuses on**:
- Task-specific analysis targeting exact requirements
- Actionable output with specific file:line references
- Repository context extracting patterns specific to the actual codebase
- Precise scope analyzing only what's needed for the immediate task