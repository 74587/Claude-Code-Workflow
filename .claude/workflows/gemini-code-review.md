# Gemini Code Review Template

**Purpose**: Understand specific changes and review against repository standards

## Template Structure

```bash
gemini --all-files -p "@{[modified-files]} @{[related-files]} @{[test-files-for-changes]}

Review context for recent changes:
Modified files: [list of specific files that were changed]
Original task: [what was being implemented]

## Required Analysis:
1. **Change Understanding**:
   - What was the specific goal of these modifications?
   - Which functions/classes were added or modified?
   - How do the changes relate to the original task requirements?

2. **Repository Convention Compliance**:
   - Do the changes follow naming conventions used in similar files?
   - Is the code structure consistent with existing patterns?
   - Are imports, error handling, and logging consistent?

3. **Impact and Integration Analysis**:
   - What other code might be affected by these changes?
   - Are all necessary integration points properly handled?
   - Do the changes maintain backward compatibility?

4. **Test Coverage and Quality**:
   - Are the specific changes properly tested?
   - Do test cases cover edge cases similar to existing tests?
   - Is the test structure consistent with repository patterns?

5. **Security and Performance**:
   - Are there security concerns specific to these changes?
   - Do the changes follow performance patterns used elsewhere?
   - Are there potential bottlenecks introduced?

## Output Requirements:
- **Specific issues**: Point to exact problems with file:line references
- **Convention violations**: Compare against similar code in the repository
- **Missing coverage**: Identify untested code paths with test examples
- **Integration gaps**: List functions/modules that need updates
- **Improvement suggestions**: Provide specific code improvements based on repository patterns

Focus on change-specific review rather than generic quality assessment."
```

## Intelligent Usage Examples

```python
# Authentication system review
def code_review_context(user_input):
    context = build_intelligent_context(
        user_input="Review OAuth2 implementation changes",
        analysis_type="code-review-context",
        domains=['auth', 'security', 'api'],
        tech_stack=['Node.js', 'JWT', 'Redis']
    )
    
    return f"""
    gemini --all-files -p "@{{**/auth/**/*,**/middleware/*auth*}} 
    @{{**/oauth/**/*,**/session/**/*}} @{{**/*test*/*auth*}}
    @{{CLAUDE.md,auth/CLAUDE.md,security/CLAUDE.md}}
    
    Review context for recent OAuth2 implementation changes:
    Modified files: auth/oauth-controller.js, middleware/auth-middleware.js
    Original task: Implement OAuth2 authorization code flow with PKCE
    
    Focus on security compliance and existing authentication patterns."
    """
```

## Context Application

- Review changes against repository-specific standards
- Compare implementation approach with similar features
- Validate test coverage for the specific functionality implemented
- Ensure integration points are properly handled

## Usage Guidelines

**Use Code Review template when**:
- After code has been written for a specific task
- You need to review changes against repository-specific standards
- Focus on understanding what was actually implemented and how it fits

**Template focuses on**:
- Change-specific review rather than generic quality assessment
- Specific issues with exact file:line references
- Repository context comparing against similar code
- Precise scope analyzing only what's relevant to the changes made