# Module README Documentation Template

Generate comprehensive module documentation focused on understanding and usage. Explain WHAT the module does, WHY it exists, and HOW to use it. Do NOT duplicate API signatures (those belong in API.md).

## Structure

### 1. Purpose

**What**: Clearly state what this module is responsible for
**Why**: Explain why this module exists and what problems it solves
**Boundaries**: Define what is IN scope and OUT of scope

Example:
> The `auth` module handles user authentication and authorization. It exists to centralize security logic and provide a consistent authentication interface across the application. It does NOT handle user profile management or session storage.

### 2. Core Concepts

List and explain key concepts, patterns, or abstractions used by this module:

- **Concept 1**: [Brief explanation of important concept]
- **Concept 2**: [Another key concept users should understand]
- **Pattern**: [Architectural pattern used, e.g., "Uses middleware pattern for request processing"]

### 3. Usage Scenarios

Provide 2-4 common use cases with code examples:

#### Scenario 1: [Common use case title]
```typescript
// Brief example showing how to use the module for this scenario
import { functionName } from './module';

const result = functionName(input);
```

#### Scenario 2: [Another common use case]
```typescript
// Another practical example
```

### 4. Dependencies

#### Internal Dependencies
List other project modules this module depends on and explain why:
- **[Module Name]** - [Why this dependency exists and what it provides]

#### External Dependencies
List third-party libraries and their purpose:
- **[Library Name]** (`version`) - [What functionality it provides to this module]

### 5. Configuration

#### Environment Variables
List any environment variables the module uses:
- `ENV_VAR_NAME` - [Description, type, default value]

#### Configuration Options
If the module accepts configuration objects:
```typescript
// Example configuration
const config = {
  option1: value,  // Description of option1
  option2: value,  // Description of option2
};
```

### 6. Testing

Explain how to test code that uses this module:
```bash
# Command to run tests for this module
npm test -- path/to/module
```

**Test Coverage**: [Brief note on what's tested]

### 7. Common Issues

List 2-3 common problems and their solutions:

#### Issue: [Common problem description]
**Solution**: [How to resolve it]

---

## Rules

1. **No API duplication** - Refer to API.md for signatures
2. **Focus on understanding** - Explain concepts, not just code
3. **Practical examples** - Show real usage, not trivial cases
4. **Clear dependencies** - Help readers understand module relationships
5. **Concise** - Each section should be scannable and to-the-point

---

**Module Path**: [Auto-fill with actual module path]
**Last Updated**: [Auto-generated timestamp]
**See also**: [Link to API.md for interface details]
