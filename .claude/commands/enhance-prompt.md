---
name: enhance-prompt
description: Dynamic prompt enhancement for complex requirements - Structured enhancement of user prompts before agent execution
usage: /enhance-prompt <user_input>
argument-hint: [--gemini] "user input to enhance"
examples:
  - /enhance-prompt "add user profile editing"
  - /enhance-prompt "fix login button"
  - /enhance-prompt "clean up the payment code"
---

### 🚀 **Command Overview: `/enhance-prompt`**

-   **Type**: Prompt Engineering Command
-   **Purpose**: To systematically enhance raw user prompts, translating them into clear, context-rich, and actionable specifications before agent execution.
-   **Key Feature**: Dynamically integrates with Gemini for deep, codebase-aware analysis.

### 📥 **Command Parameters**

-   `<user_input>`: **(Required)** The raw text prompt from the user that needs enhancement.
-   `--gemini`: **(Optional)** An explicit flag to force the full Gemini collaboration flow, ensuring codebase analysis is performed even for simple prompts.

### 🔄 **Core Enhancement Protocol**

This is the standard pipeline every prompt goes through for structured enhancement.

`Step 1: Intent Translation` **->** `Step 2: Context Extraction` **->** `Step 3: Key Points Identification` **->** `Step 4: Optional Gemini Consultation`

### 🧠 **Gemini Collaboration Logic**

This logic determines when to invoke Gemini for deeper, codebase-aware insights.

```pseudo
FUNCTION decide_enhancement_path(user_prompt, options):
  // Set of keywords that indicate high complexity or architectural changes.
  critical_keywords = ["refactor", "migrate", "redesign", "auth", "payment", "security"]

  // Conditions for triggering Gemini analysis.
  use_gemini = FALSE
  IF options.gemini_flag is TRUE:
    use_gemini = TRUE
  ELSE IF prompt_affects_multiple_modules(user_prompt, threshold=3):
    use_gemini = TRUE
  ELSE IF any_keyword_in_prompt(critical_keywords, user_prompt):
    use_gemini = TRUE

  // Execute the appropriate enhancement flow.
  enhanced_prompt = run_standard_enhancement(user_prompt) // Steps 1-3

  IF use_gemini is TRUE:
    // This action corresponds to calling the Gemini CLI tool programmatically.
    // e.g., `gemini --all-files -p "..."` based on the derived context.
    gemini_insights = execute_tool("gemini","-P" enhanced_prompt) // Calls the Gemini CLI
    enhanced_prompt.append(gemini_insights)

  RETURN enhanced_prompt
END FUNCTION
```

### 📚 **Enhancement Rules**

-   **Ambiguity Resolution**: Generic terms are translated into specific technical intents.
    -   `"fix"` → Identify the specific bug and preserve existing functionality.
    -   `"improve"` → Enhance performance or readability while maintaining compatibility.
    -   `"add"` → Implement a new feature and integrate it with existing code.
    -   `"refactor"` → Restructure code to improve quality while preserving external behavior.
-   **Implicit Context Inference**: Missing technical context is automatically inferred.
    ```bash
    # User: "add login"
    # Inferred Context:
    # - Authentication system implementation
    # - Frontend login form + backend validation
    # - Session management considerations
    # - Security best practices (e.g., password handling)
    ```
-   **Technical Translation**: Business goals are converted into technical specifications.
    ```bash
    # User: "make it faster"
    # Translated Intent:
    # - Identify performance bottlenecks
    # - Define target metrics/benchmarks
    # - Profile before optimizing
    # - Document performance gains and trade-offs
    ```

### 🗺️ **Enhancement Translation Matrix**

| User Says          | → Translate To          | Key Context             | Focus Areas                 |
| ------------------ | ----------------------- | ----------------------- | --------------------------- |
| "make it work"     | Fix functionality       | Debug implementation    | Root cause → fix → test     |
| "add [feature]"    | Implement capability    | Integration points      | Core function + edge cases  |
| "improve [area]"   | Optimize/enhance        | Current limits          | Measurable improvements     |
| "fix [bug]"        | Resolve issue           | Bug symptoms            | Root cause + prevention     |
| "refactor [code]"  | Restructure quality     | Structure pain points   | Maintain behavior           |
| "update [component]" | Modernize               | Version compatibility   | Migration path              |

### ⚡ **Automatic Invocation Triggers**

The `/enhance-prompt` command is designed to run automatically when the system detects:
-   Ambiguous user language (e.g., "fix", "improve", "clean up").
-   Tasks impacting multiple modules or components (>3).
-   Requests for system architecture changes.
-   Modifications to critical systems (auth, payment, security).
-   Complex refactoring requests.

### 🛠️ **Gemini Integration Protocol (Internal)**

**Gemini Integration**: @~/.claude/workflows/gemini-cli-guidelines.md

This section details how the system programmatically interacts with the Gemini CLI.
-   **Primary Tool**: All Gemini analysis is performed via direct calls to the `gemini` command-line tool (e.g., `gemini --all-files -p "..."`).
-   **Central Guidelines**: All CLI usage patterns, syntax, and context detection rules are defined in the central guidelines document:
-   **Specialized Templates**: For specific analysis types, the system references dedicated templates:
    -   **Pattern/Architecture**: `gemini-core-templates.md`
    -   **Security**: `gemini-core-templates.md` (for vulnerability scanning)
    -   **Documentation**: `gemini-dms-templates.md`

### 📝 **Enhancement Examples**

This card contains the original, unmodified examples to demonstrate the command's output.

#### Example 1: Feature Request (with Gemini Integration)
```bash
# User Input: "add user profile editing"

# Standard Enhancement:
TRANSLATED_INTENT: Implement user profile editing feature
DOMAIN_CONTEXT: User management system
ACTION_TYPE: Create new feature
COMPLEXITY: Medium (multi-component)

# Gemini Analysis Added:
GEMINI_PATTERN_ANALYSIS: FormValidator used in AccountSettings, PreferencesEditor
GEMINI_ARCHITECTURE: UserService → ProfileRepository → UserModel pattern

# Final Enhanced Structure:
ENRICHED_CONTEXT:
- Frontend: Profile form using FormValidator pattern
- Backend: API endpoints following UserService pattern
- Database: User model via ProfileRepository
- Auth: Permission checks using AuthGuard pattern

KEY_POINTS:
- Data validation using existing FormValidator
- Image upload via SecureUploadService
- Field permissions with AuthGuard middleware

ATTENTION_AREAS:
- Security: Use SecureUploadService for file handling
- Performance: Lazy loading patterns (ProfileImage.tsx)
```

#### Example 2: Bug Fix
```bash
# User Input: "login button doesn't work"

# Enhanced Structure:
TRANSLATED_INTENT: Debug and fix non-functional login button
DOMAIN_CONTEXT: Authentication UI
ACTION_TYPE: Fix bug
COMPLEXITY: Simple (single component)

KEY_POINTS:
- Identify root cause (event/state/API)
- Preserve existing auth flow
- Add error handling if missing

ATTENTION_AREAS:
- Don't break existing functionality
- Test edge cases and user states
```

#### Example 3: Refactoring Request
```bash
# User Input: "clean up the payment code"

# Enhanced Structure:
TRANSLATED_INTENT: Refactor payment module for maintainability
DOMAIN_CONTEXT: Payment processing system
ACTION_TYPE: Refactor
COMPLEXITY: Complex (critical system)

KEY_POINTS:
- Maintain exact functionality
- Improve code organization
- Extract reusable components

ATTENTION_AREAS:
- Critical: No behavior changes
- Security: Maintain PCI compliance
- Testing: Comprehensive coverage
```

### ✨ **Key Benefits**

1.  **Clarity**: Ambiguous requests become clear specifications.
2.  **Completeness**: Implicit requirements become explicit.
3.  **Context**: Missing context is automatically inferred.
4.  **Codebase Awareness**: Gemini provides actual patterns from the project.
5.  **Quality**: Attention areas prevent common mistakes.
6.  **Efficiency**: Agents receive structured, actionable input.
7.  **Smart Flow Control**: Seamless integration with workflows.
