
# 🚀 Claude Code Workflow (CCW) - Getting Started Guide

Welcome to Claude Code Workflow (CCW)! This guide will help you get up and running in 5 minutes and experience AI-driven automated software development.

---

## ⏱️ 5-Minute Quick Start

Let's build a "Hello World" web application from scratch with a simple example.

### Step 1: Install CCW

First, make sure you have installed CCW according to the [Installation Guide](INSTALL.md).

### Step 2: Start a Workflow Session

Think of a "session" as a dedicated project folder. CCW will store all files related to your current task here.

```bash
/workflow:session:start "My First Web App"
```

You will see that the system has created a new session, for example, `WFS-my-first-web-app`.

### Step 3: Create an Execution Plan

Now, tell CCW what you want to do. CCW will analyze your request and automatically generate a detailed, executable task plan.

```bash
/workflow:plan "Create a simple Express API that returns Hello World at the root path"
```

This command kicks off a fully automated planning process, which includes:
1.  **Context Gathering**: Analyzing your project environment.
2.  **Agent Analysis**: AI agents think about the best implementation path.
3.  **Task Generation**: Creating specific task files (in `.json` format).

### Step 4: Execute the Plan

Once the plan is created, you can command the AI agents to start working.

```bash
/workflow:execute
```

You will see CCW's agents (like `@code-developer`) begin to execute tasks one by one. It will automatically create files, write code, and install dependencies.

### Step 5: Check the Status

Want to know the progress? You can check the status of the current workflow at any time.

```bash
/workflow:status
```

This will show the completion status of tasks, the currently executing task, and the next steps.

---

## 🧠 Core Concepts Explained

Understanding these concepts will help you use CCW more effectively:

-   **Workflow Session**
    > Like an independent sandbox or project space, used to isolate the context, files, and history of different tasks. All related files are stored in the `.workflow/WFS-<session-name>/` directory.

-   **Task**
    > An atomic unit of work, such as "create API route" or "write test case." Each task is a `.json` file that defines the goal, context, and execution steps in detail.

-   **Agent**
    > An AI assistant specialized in a specific domain. For example:
    > -   `@code-developer`: Responsible for writing and implementing code.
    > -   `@test-fix-agent`: Responsible for running tests and automatically fixing failures.
    > -   `@ui-design-agent`: Responsible for UI design and prototype creation.

-   **Workflow**
    > A series of predefined, collaborative commands used to orchestrate different agents and tools to achieve a complex development goal (e.g., `plan`, `execute`, `test-gen`).

---

## 🛠️ Common Scenarios

### Scenario 1: Developing a New Feature (as shown above)

This is the most common use case, following the "start session → plan → execute" pattern.

```bash
# 1. Start a session
/workflow:session:start "User Login Feature"

# 2. Create a plan
/workflow:plan "Implement JWT-based user login and registration"

# 3. Execute
/workflow:execute
```

### Scenario 2: UI Design

CCW has powerful UI design capabilities, capable of generating complex UI prototypes from simple text descriptions.

```bash
# 1. Start a UI design workflow
/workflow:ui-design:explore-auto --prompt "A modern, clean admin dashboard login page with username, password fields and a login button"

# 2. View the generated prototype
# After the command finishes, it will provide a path to a compare.html file. Open it in your browser to preview.
```

### Scenario 3: Fixing a Bug

CCW can help you analyze and fix bugs.

```bash
# 1. Use the bug-index command to analyze the problem
/cli:mode:bug-index "Incorrect success message even with wrong password on login"

# 2. The AI will analyze the relevant code and generate a fix plan. You can then execute this plan.
/workflow:execute
```

---

## ❓ Troubleshooting

-   **Problem: Prompt shows "No active session found"**
    > **Reason**: You haven't started a workflow session, or the current session is complete.
    > **Solution**: Use `/workflow:session:start "Your task description"` to start a new session.

-   **Problem: Command execution fails or gets stuck**
    > **Reason**: It could be a network issue, AI model limitation, or the task is too complex.
    > **Solution**:
    > 1.  First, try using `/workflow:status` to check the current state.
    > 2.  Check the log files in the `.workflow/WFS-<session-name>/.chat/` directory for detailed error messages.
    > 3.  If the task is too complex, try breaking it down into smaller tasks and then use `/workflow:plan` to create a new plan.

---

## 📚 Next Steps for Advanced Learning

Once you've mastered the basics, you can explore CCW's more powerful features:

1.  **Test-Driven Development (TDD)**: Use `/workflow:tdd-plan` to create a complete TDD workflow. The AI will first write failing tests, then write code to make them pass, and finally refactor.

2.  **Multi-Agent Brainstorming**: Use `/workflow:brainstorm:auto-parallel` to have multiple AI agents with different roles (like System Architect, Product Manager, Security Expert) analyze a topic simultaneously and generate a comprehensive report.

3.  **Custom Agents and Commands**: You can modify the files in the `.claude/agents/` and `.claude/commands/` directories to customize agent behavior and workflows to fit your team's specific needs.


Hope this guide helps you get started smoothly with CCW!
