---
name: plan
description: Development planning and implementation strategy using specialized templates with Codex
usage: /codex:mode:plan "planning topic"
argument-hint: "development planning topic or implementation challenge"
examples:
  - /codex:mode:plan "design user dashboard feature architecture"
  - /codex:mode:plan "plan microservices migration with implementation"
  - /codex:mode:plan "implement real-time notification system with React"
allowed-tools: Bash(codex:*)
model: sonnet
---

# Development Planning Command (/codex:mode:plan)

## Overview
Comprehensive development planning and implementation strategy using expert planning templates with Codex CLI.

**Core Guidelines**: @~/.claude/workflows/codex-unified.md

⚠️ **Critical Difference**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

## Usage

### Basic Development Planning
```bash
/codex:mode:plan "design authentication system with implementation"
```
**Executes**: `codex exec "@{**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/planning/task-breakdown.txt)"`

### Architecture Planning with Context
```bash
/codex:mode:plan "microservices migration strategy"
```
**Executes**: `codex exec "@{src/**/*,*.config.*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/planning/migration.txt)"`

### Feature Implementation Planning
```bash
/codex:mode:plan "real-time notifications with WebSocket integration"
```
**Executes**: `codex exec "@{**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

Additional Planning Context:
$(cat ~/.claude/workflows/cli-templates/prompts/planning/task-breakdown.txt)"`

## Codex-Specific Planning Patterns

**Essential File Patterns** (Required for comprehensive planning):
```bash
@{**/*}                    # All files for complete context
@{src/**/*}               # Source code architecture
@{*.config.*,package.json} # Configuration and dependencies
@{CLAUDE.md,**/*CLAUDE.md} # Project guidelines
@{docs/**/*,README.*}      # Documentation for context
@{test/**/*}              # Testing patterns
```

## Command Execution

**Planning Templates Used**: 
- Primary: `~/.claude/workflows/cli-templates/prompts/planning/task-breakdown.txt`
- Migration: `~/.claude/workflows/cli-templates/prompts/planning/migration.txt`
- Combined with development templates for implementation guidance

**Executes**:
```bash
codex exec "@{**/*} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/planning/task-breakdown.txt)

Context: Complete codebase analysis for informed planning
Planning Topic: [user_description]
Implementation Focus: Development strategy with code generation guidance"
```

## Planning Focus Areas

### Development Planning Provides:
- **Requirements Analysis**: Functional and technical requirements
- **Architecture Design**: System structure with implementation details  
- **Implementation Strategy**: Step-by-step development approach with code examples
- **Technology Selection**: Framework and library recommendations
- **Task Decomposition**: Detailed task breakdown with dependencies
- **Code Structure Planning**: File organization and module design
- **Testing Strategy**: Test planning and coverage approach
- **Integration Planning**: API design and data flow

### Codex Enhancement:
- **Implementation Guidance**: Actual code patterns and examples
- **Automated Scaffolding**: Template generation for planned components
- **Dependency Analysis**: Required packages and configurations
- **Pattern Detection**: Leverages existing codebase patterns

## Planning Templates

### Task Breakdown Planning
```bash
# Uses: planning/task-breakdown.txt
/codex:mode:plan "implement user authentication system"
# Provides: Detailed task list, dependencies, implementation order
```

### Migration Planning
```bash
# Uses: planning/migration.txt
/codex:mode:plan "migrate from REST to GraphQL API"
# Provides: Migration strategy, compatibility planning, rollout approach
```

### Feature Planning with Implementation
```bash
# Uses: development/feature.txt + planning/task-breakdown.txt
/codex:mode:plan "build real-time chat application"
# Provides: Architecture + implementation roadmap + code examples
```

## Options

| Option | Purpose |
|--------|---------|
| `--comprehensive` | Use `@{**/*}` for complete codebase context |
| `--save-session` | Save planning analysis to workflow session |
| `--with-implementation` | Include code generation in planning |
| `--template <name>` | Force specific planning template |

### Comprehensive Planning
```bash
/codex:mode:plan "design payment system architecture" --comprehensive
# Uses: @{**/*} pattern for maximum context
```

### Planning with Implementation
```bash
/codex:mode:plan "implement user dashboard" --with-implementation
# Combines planning templates with development templates for actionable output
```

## Session Output

When `--save-session` used, saves to:
`.workflow/WFS-[topic]/.chat/plan-[timestamp].md`

**Session includes:**
- Planning topic and requirements
- Template combination used
- Complete architecture analysis
- Implementation roadmap with tasks
- Code structure recommendations
- Technology stack decisions
- Integration strategies
- Next steps and action items

## Planning Template Structure

### Task Breakdown Template Output:
```markdown
# Development Plan: [Topic]

## Requirements Analysis
- Functional requirements
- Technical requirements
- Constraints and dependencies

## Architecture Design
- System components
- Data flow
- Integration points

## Implementation Strategy
- Development phases
- Task breakdown
- Dependencies and blockers
- Estimated effort

## Code Structure
- File organization
- Module design
- Component hierarchy

## Technology Decisions
- Framework selection
- Library recommendations
- Configuration requirements

## Testing Approach
- Testing strategy
- Coverage requirements
- Test automation

## Action Items
- [ ] Detailed task list with priorities
- [ ] Implementation order
- [ ] Review checkpoints
```

## Context-Aware Planning

### Existing Codebase Integration
```bash
/codex:mode:plan "add user roles and permissions system"
# Analyzes existing authentication patterns
# Plans integration with current user management
# Suggests compatible implementation approach
```

### Technology Stack Analysis
```bash
/codex:mode:plan "implement real-time features"
# Reviews current tech stack (React, Node.js, etc.)
# Recommends compatible WebSocket/SSE solutions
# Plans integration with existing architecture
```

## Planning Workflow Integration

### Pre-Development Planning
1. **Architecture Analysis**: Understand current system structure
2. **Requirement Planning**: Define scope and objectives
3. **Implementation Strategy**: Create detailed development plan
4. **Task Creation**: Generate actionable tasks for execution

### Planning to Execution Flow
```bash
# 1. Plan the implementation
/codex:mode:plan "implement user dashboard with analytics"

# 2. Execute the plan
/codex:execute "implement user dashboard based on planning analysis"

# 3. Review and iterate
/workflow:review
```

## Codex vs Gemini Planning

| Feature | Codex Planning | Gemini Planning |
|---------|----------------|-----------------|
| File Context | `@` patterns **required** | `--all-files` available |
| Output Focus | Implementation-ready plans | Analysis and strategy |
| Code Examples | Includes actual code patterns | Conceptual guidance |
| Integration | Direct execution pathway | Planning only |
| Templates | Development + planning combined | Planning focused |

## Advanced Planning Features

### Multi-Phase Planning
```bash
/codex:mode:plan "modernize legacy application architecture"
# Provides: Phase-by-phase migration strategy
# Includes: Compatibility planning, risk assessment
# Generates: Implementation timeline with milestones
```

### Cross-System Integration Planning
```bash
/codex:mode:plan "integrate third-party payment system with existing e-commerce"
# Analyzes: Current system architecture
# Plans: Integration approach and data flow
# Recommends: Security and error handling strategies
```

For detailed syntax, patterns, and advanced usage see:
**@~/.claude/workflows/codex-unified.md**