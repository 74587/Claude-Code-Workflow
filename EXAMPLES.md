# EXAMPLES: Claude_dms3 Usage Examples

## Related Files
- `GETTING_STARTED.md` - Initial setup and quick start guide.
- `EXAMPLES.md` (root) - Comprehensive real-world examples across various development phases.
- `.claude/skills/command-guide/guides/examples.md` - Specific command usage examples across different modes.

## Introduction
This document provides practical, end-to-end examples demonstrating the core usage of the Claude_dms3 system. It covers everything from quick start guides to complex development workflows, illustrating how specialized AI agents and integrated tools can automate and streamline software engineering tasks.

**Prerequisites**: Ensure Claude_dms3 is installed and configured as per the [Installation Guide](INSTALL.md) and that you have a basic understanding of the core concepts explained in [GETTING_STARTED.md](GETTING_STARTED.md).

## Quick Start Example

Let's create a "Hello World" web application using a simple Express API.

### Step 1: Create an Execution Plan
Tell Claude_dms3 what you want to build. The system will analyze your request and automatically generate a detailed, executable task plan.

```bash
/workflow:plan "Create a simple Express API that returns Hello World at the root path"
```

*   **Explanation**: The `/workflow:plan` command initiates a fully automated planning process. This includes context gathering from your project, analysis by AI agents to determine the best implementation path, and the generation of specific task files (in `.json` format) in a new workflow session (`.workflow/active/WFS-create-a-simple-express-api/`).

### Step 2: Execute the Plan
Once the plan is created, command the AI agents to start working.

```bash
/workflow:execute
```

*   **Explanation**: Claude_dms3's agents, such as `@code-developer`, will begin executing the planned tasks one by one. This involves creating files, writing code, and installing necessary dependencies to fulfill the "Hello World" API request.

### Step 3: Check the Status (Optional)
Monitor the progress of the current workflow at any time.

```bash
/workflow:status
```

*   **Explanation**: This command provides an overview of task completion, the currently executing task, and the upcoming steps in the workflow.

## Core Use Cases

### 1. Full-Stack Todo Application Development
**Objective**: Build a complete todo application with a React frontend and an Express backend, including user authentication, real-time updates, and dark mode.

#### Phase 1: Planning with Multi-Agent Brainstorming
Utilize brainstorming to analyze the complex requirements from multiple perspectives before implementation.

```bash
# Multi-perspective analysis for the full-stack application
/workflow:brainstorm:auto-parallel "Full-stack todo application with user authentication, real-time updates, and dark mode"

# Review brainstorming artifacts, then create the implementation plan
/workflow:plan

# Verify the plan quality
/workflow:action-plan-verify
```

#### Phase 2: Implementation
Execute the generated plan to build the application components.

```bash
# Execute the plan
/workflow:execute

# Monitor progress
/workflow:status
```

#### Phase 3: Testing
Generate and execute comprehensive tests for the implemented features.

```bash
# Generate comprehensive tests
/workflow:test-gen WFS-todo-application # WFS-todo-application is the session ID

# Execute test tasks
/workflow:execute

# Run an iterative test-fix cycle if needed
/workflow:test-cycle-execute
```

#### Phase 4: Quality Review & Completion
Review the implemented solution for security, architecture, and overall quality, then complete the session.

```bash
# Security review
/workflow:review --type security

# Architecture review
/workflow:review --type architecture

# General quality review
/workflow:review

# Complete the session
/workflow:session:complete
```

### 2. RESTful API with Authentication
**Objective**: Create a RESTful API with JWT authentication and role-based access control for a `posts` resource.

```bash
# Initiate detailed planning for the API
/workflow:plan "RESTful API with JWT authentication, role-based access control (admin, user), and protected endpoints for posts resource"

# Verify the plan for consistency and completeness
/workflow:action-plan-verify

# Execute the implementation plan
/workflow:execute
```

*   **Implementation includes**:
    *   **Authentication Endpoints**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
    *   **Protected Resources**: `GET /api/posts` (public), `GET /api/posts/:id` (public), `POST /api/posts` (authenticated), `PUT /api/posts/:id` (authenticated, owner or admin), `DELETE /api/posts/:id` (authenticated, owner or admin).
    *   **Middleware**: `authenticate` (verifies JWT token), `authorize(['admin'])` (role-based access), `validateRequest` (input validation), `errorHandler` (centralized error handling).

### 3. Test-Driven Development (TDD)
**Objective**: Implement user authentication (login, registration, password reset) using a TDD approach.

```bash
# Start the TDD workflow for user authentication
/workflow:tdd-plan "User authentication with email/password login, registration, and password reset"

# Execute the TDD cycles (Red-Green-Refactor)
/workflow:execute

# Verify TDD compliance (optional)
/workflow:tdd-verify
```

*   **TDD cycle tasks created**: Claude_dms3 will create tasks in cycles (e.g., Registration, Login, Password Reset), where each cycle involves writing a failing test, implementing the feature to pass the test, and then refactoring the code.

## Advanced & Integration Examples

### 1. Monolith to Microservices Refactoring
**Objective**: Refactor a monolithic application into a microservices architecture with an API gateway, service discovery, and message queue.

#### Phase 1: Analysis
Perform deep architecture analysis and multi-role brainstorming.

```bash
# Deep architecture analysis to create a migration strategy
/cli:mode:plan --tool gemini "Analyze current monolithic architecture and create microservices migration strategy"

# Multi-role brainstorming for microservices design
/workflow:brainstorm:auto-parallel "Migrate monolith to microservices with API gateway, service discovery, and message queue" --count 5
```

#### Phase 2: Planning
Create a detailed migration plan based on the analysis.

```bash
# Create a detailed migration plan for the first phase
/workflow:plan "Phase 1 microservices migration: Extract user service and auth service from monolith"

# Verify the plan
/workflow:action-plan-verify
```

#### Phase 3: Implementation
Execute the migration plan and review the architecture.

```bash
# Execute the migration tasks
/workflow:execute

# Review the new microservices architecture
/workflow:review --type architecture
```

### 2. Real-Time Chat Application
**Objective**: Build a real-time chat application with WebSocket, message history, and file sharing.

#### Complete Workflow
This example combines brainstorming, UI design, planning, implementation, testing, and review.

```bash
# 1. Brainstorm for comprehensive feature specification
/workflow:brainstorm:auto-parallel "Real-time chat application with WebSocket, message history, file upload, user presence, typing indicators" --count 5

# 2. UI Design exploration
/workflow:ui-design:explore-auto --prompt "Modern chat interface with message list, input box, user sidebar, file preview" --targets "chat-window,message-bubble,user-list" --style-variants 2

# 3. Sync selected designs (assuming a session ID from the UI design step)
/workflow:ui-design:design-sync --session <session-id>

# 4. Plan the implementation
/workflow:plan

# 5. Verify the plan
/workflow:action-plan-verify

# 6. Execute the implementation
/workflow:execute

# 7. Generate tests for the application
/workflow:test-gen <session-id>

# 8. Execute the generated tests
/workflow:execute

# 9. Review the security and architecture
/workflow:review --type security
/workflow:review --type architecture

# 10. Complete the session
/workflow:session:complete
```

## Testing Examples

### 1. Adding Tests to Existing Code
**Objective**: Generate comprehensive tests for an existing authentication module.

```bash
# Create a test generation workflow for the authentication implementation
/workflow:test-gen WFS-authentication-implementation # WFS-authentication-implementation is the session ID

# Execute the test tasks (generate and run tests)
/workflow:execute

# Run a test-fix cycle until all tests pass
/workflow:test-cycle-execute --max-iterations 5
```

*   **Tests generated**: Unit tests for each function, integration tests for the auth flow, edge case tests (invalid input, expired tokens), security tests (SQL injection, XSS), and performance tests.

### 2. Bug Fixing - Complex Bug Investigation
**Objective**: Debug a memory leak in a React application caused by uncleared event listeners.

#### Investigation
Start a dedicated session for thorough investigation.

```bash
# Start a new session for memory leak investigation
/workflow:session:start "Memory Leak Investigation"

# Perform deep bug analysis using Gemini
/cli:mode:bug-diagnosis --tool gemini "Memory leak in React components - event listeners not cleaned up"

# Create a fix plan based on the analysis
/workflow:plan "Fix memory leaks in React components: cleanup event listeners and cancel subscriptions"
```

#### Implementation
Execute the fixes and generate tests to prevent regression.

```bash
# Execute the memory leak fixes
/workflow:execute

# Generate tests to prevent future regressions
/workflow:test-gen WFS-memory-leak-investigation

# Execute the generated tests
/workflow:execute
```

## Best Practices & Troubleshooting

### Best Practices for Effective Usage

1.  **Start with clear objectives**: Define what you want to build, list key features, and specify technologies.
2.  **Use appropriate workflow**:
    *   Simple tasks: `/workflow:lite-plan`
    *   Complex features: `/workflow:brainstorm` → `/workflow:plan`
    *   Existing code: `/workflow:test-gen` or `/cli:analyze`
3.  **Leverage quality gates**:
    *   Run `/workflow:action-plan-verify` before execution.
    *   Use `/workflow:review` after implementation.
    *   Generate tests with `/workflow:test-gen`.
4.  **Maintain memory**:
    *   Update memory after major changes with `/memory:update-full` or `/memory:update-related`.
    *   Use `/memory:load` for quick, task-specific context.
5.  **Complete sessions**: Always run `/workflow:session:complete` to generate lessons learned and archive the session.

### Troubleshooting Common Issues

*   **Problem: Prompt shows "No active session found"**
    *   **Reason**: You haven't started a workflow session, or the current session is complete.
    *   **Solution**: Use `/workflow:session:start "Your task description"` to start a new session.

*   **Problem: Command execution fails or gets stuck**
    *   **Reason**: Could be a network issue, AI model limitation, or the task is too complex.
    *   **Solution**:
        1.  First, try `/workflow:status` to check the current state.
        2.  Check log files in the `.workflow/WFS-<session-name>/.chat/` directory for detailed error messages.
        3.  If the task is too complex, break it down into smaller tasks and use `/workflow:plan` to create a new plan.

## Conclusion

This document provides a foundational understanding of how to leverage Claude_dms3 for various software development tasks, from initial planning to complex refactoring and comprehensive testing. By following these examples and best practices, users can effectively harness the power of AI-driven automation to enhance their development workflows.