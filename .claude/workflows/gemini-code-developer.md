# Gemini Code Developer Template

**Purpose**: Locate exact modification points and provide concrete implementation guidance

## Template Structure

```bash
gemini --all-files -p "@{[target-modification-files]} @{[similar-feature-files]} @{**/*test*/**/*,**/*.test.*,**/*.spec.*}

Implementation guidance for: [specific feature/function to implement]

## Required Analysis:
1. **Exact Modification Points**:
   - Find precise locations (file:line) where new code should be added
   - Identify existing functions that need modification
   - Locate where new imports/dependencies should be added

2. **Similar Code Examples**:
   - Find existing implementations similar to what needs to be built
   - Extract code patterns that should be followed
   - Identify utility functions that can be reused

3. **Code Structure and Patterns**:
   - How should the new code be structured based on existing patterns?
   - What naming conventions are used for similar features?
   - What error handling patterns should be followed?

4. **Testing Requirements**:
   - Find similar test cases for reference
   - Identify testing utilities and helpers available
   - Determine what specific test scenarios are needed

5. **Integration and Dependencies**:
   - What existing functions need to call the new code?
   - Which modules need to import the new functionality?
   - What configuration or setup is required?

## Output Requirements:
- **Precise insertion points**: Exact file:line locations for new code
- **Code skeleton**: Structure based on existing patterns with placeholder functions
- **Concrete examples**: Copy-paste reference code from similar features
- **Test template**: Specific test cases needed based on existing patterns
- **Integration checklist**: Exact functions/files that need to call or import new code

Focus on actionable implementation guidance with specific line references."
```

## Intelligent Usage Examples

```python
# React component implementation
def code_developer_context(user_input):
    context = build_intelligent_context(
        user_input="Create user profile edit component",
        analysis_type="code-developer-context",
        domains=['frontend', 'ui'],
        tech_stack=['React', 'TypeScript', 'Tailwind']
    )
    
    return f"""
    gemini --all-files -p "@{{src/components/**/*,src/pages/**/*}} 
    @{{**/*profile*,**/*user*,**/*form*}} @{{**/*.test.*,**/*.spec.*}}
    @{{CLAUDE.md,frontend/CLAUDE.md,react/CLAUDE.md}}
    
    Implementation guidance for: User profile edit component with form validation
    - Profile form fields: name, email, bio, avatar upload
    - Form validation using existing patterns
    - State management integration with user context
    
    Focus on exact insertion points and component structure based on similar forms."
    """
```

## Context Application

- Locate exact code insertion and modification points
- Follow repository-specific patterns and conventions
- Reuse existing utilities and established approaches
- Create comprehensive test coverage based on similar features

## Usage Guidelines

**Use Code Developer template when**:
- Before implementing specific functions, classes, or features
- You need exact insertion points and code structure guidance
- Focus on actionable implementation steps with line references

**Template focuses on**:
- Precise, task-focused analysis for actionable implementation
- Exact file:line references and concrete guidance
- Repository context with patterns specific to the actual codebase
- Specific scope analyzing only what's needed for the immediate task