# Command Reference

This document provides a comprehensive reference for all commands available in the Claude Code Workflow (CCW) system.

> **Version 7.0.0 Update**: team-coordinate-v2/team-executor-v2/team-lifecycle-v5 architecture with unified team-worker agent, workflow session commands (start/resume/complete/sync), queue scheduler service, spec management enhancements, CLI multi-provider support, analysis viewer page, security enhancements, skill hub, terminal dashboard, orchestrator template editor, A2UI multi-select questions.

## CLI Commands (`/cli:*`)

| Command | Description |
|---|---|
| `/cli:cli-init`| Initialize CLI tool configurations (Gemini and Qwen) based on workspace analysis. |

> **Note**: For analysis, planning, and bug fixing, use workflow commands (`/workflow:lite-plan`, `/workflow:lite-fix`) or semantic invocation through natural language.

## Workflow Commands (`/workflow:*`)

These commands orchestrate complex, multi-phase development processes, from planning to execution.

### Session Management

| Command | Description |
|---|---|
| `/workflow:session:start` | Discover existing sessions or start a new workflow session with intelligent session management. |
| `/workflow:session:list` | List all workflow sessions with status. |
| `/workflow:session:resume` | Resume the most recently paused workflow session. |
| `/workflow:session:complete` | Mark the active workflow session as complete and remove active flag. |
| `/workflow:session:sync` | ⚡ **NEW** Sync workflow session state to disk during execution. |
| `/workflow:session:solidify` | ⚡ **NEW** Solidify workflow session artifacts and prepare for archiving. |

### Core Workflow

| Command | Description |
|---|---|
| `/workflow:plan` | Orchestrate 5-phase planning workflow with quality gate, executing commands and passing context between phases. |
| `/workflow:lite-plan` | Lightweight interactive planning and execution workflow with in-memory planning, smart code exploration, cost-aware parallel execution, and 50K context protection. |
| `/workflow:lite-fix` | ⚡ **NEW** Intelligent bug diagnosis and fix workflow with adaptive severity assessment, risk-aware verification, and optional hotfix mode. |
| `/workflow:lite-execute` | Execute tasks based on in-memory plan, prompt description, or file content. |
| `/workflow:replan` | Interactive workflow replanning with session-level artifact updates and boundary clarification through guided questioning. |
| `/workflow:execute` | Coordinate agents for existing workflow tasks with automatic discovery. |
| `/workflow:resume` | Intelligent workflow session resumption with automatic progress analysis. |
| `/workflow:review` | Optional specialized review (security, architecture, docs) for completed implementation. |
| `/workflow:status` | Generate on-demand views from JSON task data. |

### Brainstorming

| Command | Description |
|---|---|
| `/workflow:brainstorm:artifacts` | Generate role-specific guidance-specification.md dynamically based on selected roles. |
| `/workflow:brainstorm:auto-parallel` | Parallel brainstorming automation with dynamic role selection and concurrent execution. |
| `/workflow:brainstorm:synthesis` | Clarify and refine role analyses through intelligent Q&A and targeted updates. |
| `/workflow:brainstorm:api-designer` | Generate or update api-designer/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:data-architect` | Generate or update data-architect/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:product-manager` | Generate or update product-manager/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:product-owner` | Generate or update product-owner/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:scrum-master` | Generate or update scrum-master/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:subject-matter-expert` | Generate or update subject-matter-expert/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:system-architect` | Generate or update system-architect/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:ui-designer` | Generate or update ui-designer/analysis.md addressing guidance-specification discussion points. |
| `/workflow:brainstorm:ux-expert` | Generate or update ux-expert/analysis.md addressing guidance-specification discussion points. |

### Quality & Verification

| Command | Description |
|---|---|
| `/workflow:plan-verify`| Perform non-destructive cross-artifact consistency and quality analysis of IMPL_PLAN.md and task.json before execution. |

### Code Review Cycle

| Command | Description |
|---|---|
| `/workflow:review-module-cycle` | ⚡ **NEW** Independent multi-dimensional code review for specified modules/files across 7 dimensions with hybrid parallel-iterative execution. |
| `/workflow:review-session-cycle` | ⚡ **NEW** Session-based comprehensive code review analyzing git changes across 7 dimensions with deep-dive on critical issues. |
| `/workflow:review-fix` | ⚡ **NEW** Automated fixing of code review findings with AI-powered planning, intelligent grouping, and test-driven verification. |

### Test-Driven Development (TDD)

| Command | Description |
|---|---|
| `/workflow:tdd-plan` | Orchestrate TDD workflow planning with Red-Green-Refactor task chains. |
| `/workflow:tdd-verify` | Verify TDD workflow compliance and generate quality report. |

### Test Generation & Execution

| Command | Description |
|---|---|
| `/workflow:test-gen` | Generate test plan and tasks by analyzing completed implementation. Use `/workflow:execute` to run generated tasks. |
| `/workflow:test-fix-gen` | Generate test-fix plan and tasks from existing implementation or prompt. Use `/workflow:execute` to run generated tasks. |
| `/workflow:test-cycle-execute` | Execute test-fix workflow with dynamic task generation and iterative fix cycles. Tasks are executed by `/workflow:execute`. |

### UI Design Workflow

| Command | Description |
|---|---|
| `/workflow:ui-design:explore-auto` | Exploratory UI design workflow with style-centric batch generation. |
| `/workflow:ui-design:imitate-auto` | High-speed multi-page UI replication with batch screenshot capture. |
| `/workflow:ui-design:capture` | Batch screenshot capture for UI design workflows using MCP or local fallback. |
| `/workflow:ui-design:explore-layers` | Interactive deep UI capture with depth-controlled layer exploration. |
| `/workflow:ui-design:style-extract` | Extract design style from reference images or text prompts using Claude's analysis. |
| `/workflow:ui-design:layout-extract` | Extract structural layout information from reference images, URLs, or text prompts. |
| `/workflow:ui-design:generate` | Assemble UI prototypes by combining layout templates with design tokens (pure assembler). |
| `/workflow:ui-design:design-sync` | Synchronize finalized design system references to brainstorming artifacts. |
| `/workflow:ui-design:animation-extract` | Extract animation and transition patterns from URLs, CSS, or interactive questioning. |

### Internal Tools

These commands are primarily used internally by other workflow commands but can be used manually.

| Command | Description |
|---|---|
| `/workflow:tools:concept-enhanced` | Enhanced intelligent analysis with parallel CLI execution and design blueprint generation. |
| `/workflow:tools:conflict-resolution` | Detect and resolve conflicts between plan and existing codebase using CLI-powered analysis. |
| `/workflow:tools:context-gather` | Intelligently collect project context using universal-executor agent based on task description and package into standardized JSON. |
| `/workflow:tools:task-generate` | Generate task JSON files and IMPL_PLAN.md from analysis results with artifacts integration. |
| `/workflow:tools:task-generate-agent` | Autonomous task generation using action-planning-agent with discovery and output phases. |
| `/workflow:tools:task-generate-tdd` | Generate TDD task chains with Red-Green-Refactor dependencies. |
| `/workflow:tools:tdd-coverage-analysis` | Analyze test coverage and TDD cycle execution. |
| `/workflow:tools:test-concept-enhanced` | Analyze test requirements and generate test generation strategy using Gemini. |
| `/workflow:tools:test-context-gather` | Collect test coverage context and identify files requiring test generation. |
| `/workflow:tools:test-task-generate` | Generate test-fix task JSON with iterative test-fix-retest cycle specification. |

## Task Commands (`/task:*`)

Commands for managing individual tasks within a workflow session.

| Command | Description |
|---|---|
| `/task:create` | Create implementation tasks with automatic context awareness. |
| `/task:breakdown` | Intelligent task decomposition with context-aware subtask generation. |
| `/task:execute` | Execute tasks with appropriate agents and context-aware orchestration. |
| `/task:replan` | ⚠️ **DEPRECATED** Use `/workflow:replan` instead. Legacy command for task replanning (maintained for backward compatibility). |

## Issue Commands (`/issue:*`)

Commands for issue discovery, planning, and execution management.

### Issue Discovery & Creation

| Command | Description |
|---|---|
| `/issue:discover` | ⚡ **NEW** Discover issues from codebase analysis and error patterns. |
| `/issue:discover-by-prompt` | ⚡ **NEW** Discover issues based on natural language prompt description. |
| `/issue:new` | ⚡ **NEW** Create structured issue with title, context, priority, and labels. |

### Issue Planning & Queue

| Command | Description |
|---|---|
| `/issue:plan` | ⚡ **NEW** Generate solution plan for specified issue with task breakdown. |
| `/issue:queue` | ⚡ **NEW** Form execution queue from planned issues and tasks. |
| `/issue:execute` | ⚡ **NEW** Execute tasks from issue queue with orchestration. |
| `/issue:convert-to-plan` | ⚡ **NEW** Convert issue to executable implementation plan. |
| `/issue:from-brainstorm` | ⚡ **NEW** Create issue from brainstorming session artifacts. |

### Issue Management

| Command | Description |
|---|---|
| `/issue:manage` | ⚡ **NEW** Interactive issue management with menu-driven CRUD operations. |

> **Note**: Issue commands use the `ccw issue` CLI endpoints for data storage and retrieval.

## Memory and Versioning Commands

| Command | Description |
|---|---|
| `/memory:docs` | Plan documentation workflow with dynamic grouping for module trees, README, ARCHITECTURE, and HTTP API docs. |
| `/memory:docs-full-cli` | ⚡ **NEW** Generate full project documentation using CLI execution with batched agents and fallback chain. |
| `/memory:docs-related-cli` | ⚡ **NEW** Generate/update documentation for git-changed modules using CLI execution with batched agents. |
| `/memory:update-full` | Complete project-wide CLAUDE.md documentation update with layer-based execution. |
| `/memory:update-related` | Context-aware CLAUDE.md documentation updates based on recent git changes. |
| `/memory:load` | Quickly load key project context into memory based on a task description. |
| `/memory:load-skill-memory` | Activate SKILL package and intelligently load documentation based on task intent. |
| `/memory:skill-memory` | 4-phase autonomous orchestrator to generate SKILL.md with progressive loading index. |
| `/memory:code-map-memory` | 3-phase orchestrator for code analysis and Mermaid documentation generation. |
| `/memory:tech-research` | 3-phase orchestrator for tech stack research and SKILL package generation. |
| `/memory:workflow-skill-memory` | Process archived sessions to generate workflow-progress SKILL package. |
| `/version` | Display version information and check for updates. |
| `/enhance-prompt` | Context-aware prompt enhancement using session memory and codebase analysis. |

## Team Skills

Unified team coordination and execution skills with role-spec based architecture.

### Core Team Skills (v5/v2)

| Skill | Description |
|-------|-------------|
| `team-lifecycle-v5` | ⚡ **NEW** Unified team skill for full lifecycle (spec/impl/test/review) with team-worker agent architecture. Roles: analyst, writer, planner, executor, tester, reviewer, architect, fe-developer, fe-qa. |
| `team-coordinate-v2` | ⚡ **NEW** Universal team coordination with dynamic role generation. Generates role-specs at runtime and spawns team-worker agents. |
| `team-executor-v2` | ⚡ **NEW** Lightweight session execution - resumes existing team-coordinate-v2 sessions for pure execution. |

### V4/V3 Team Skills (Maintained)

| Skill | Description |
|-------|-------------|
| `team-lifecycle-v4` | Previous version lifecycle skill. Maintained for backward compatibility. |
| `team-lifecycle-v3` | Earlier version lifecycle skill. Maintained for backward compatibility. |
| `team-coordinate` | Original team coordinator. Use `team-coordinate-v2` for new projects. |
| `team-executor` | Original team executor. Use `team-executor-v2` for new projects. |

### Specialized Team Skills

| Skill | Description |
|-------|-------------|
| `team-brainstorm` | Multi-role brainstorming with role-specific analysis generation. |
| `team-issue` | Issue-driven development pipeline with discover, plan, and execute phases. |
| `team-iterdev` | Iterative development workflow with planning, implementation, and testing cycles. |
| `team-planex` | Planning and execution workflow with wave-based task management. |
| `team-frontend` | Frontend-specific development workflow with UI design and QA cycles. |
| `team-quality-assurance` | Quality assurance and testing workflow. |
| `team-roadmap-dev` | Roadmap development and management workflow. |
| `team-tech-debt` | Technical debt identification and remediation workflow. |
| `team-testing` | Comprehensive testing workflow. |
| `team-uidesign` | UI/UX design workflow with style extraction and prototyping. |
| `team-ultra-analyze` | Deep codebase analysis with multi-angle exploration. |
| `team-review` | Multi-dimensional code review workflow. |

### Deprecated Team Skills

| Skill | Status | Replacement |
|-------|--------|-------------|
| Various team commands (team-planex, team-iterdev, etc.) | ⚠️ **DEPRECATED** | Use `team-lifecycle-v5` for unified lifecycle management. |

## Internal Tools (Deprecated)

| Command | Description |
|---|---|
| `/workflow:tools:tdd-coverage-analysis` | ⚠️ **DEPRECATED** Use integrated test coverage analysis. |
| `/workflow:tools:test-concept-enhanced` | ⚠️ **DEPRECATED** Use `/workflow:test-gen` instead. |
| `/workflow:tools:context-gather` | ⚠️ **DEPRECATED** Context gathering is now integrated into main workflows. |
| `/workflow:tools:task-generate` | ⚠️ **DEPRECATED** Use `/workflow:lite-plan` or team-lifecycle task generation. |
| `/workflow:tools:task-generate-agent` | ⚠️ **DEPRECATED** Use unified task generation in workflows. |

