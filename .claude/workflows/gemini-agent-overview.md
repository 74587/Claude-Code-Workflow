# Gemini Agent Templates Overview

**Precise, task-focused templates for actionable agent context gathering.**

## Overview

This document provides focused templates that deliver precise, actionable context for specific tasks rather than generic pattern analysis. Each template targets exact requirements, modification points, and concrete implementation guidance.

## Template Usage Guidelines

### Key Principles

1. **Task-Specific Focus**: Templates target specific tasks rather than broad analysis
2. **Actionable Output**: Provide exact file:line references and concrete guidance
3. **Repository Context**: Extract patterns specific to the actual codebase
4. **Precise Scope**: Analyze only what's needed for the immediate task

### When to Use Each Template

**Planning Agent**: Before creating implementation plans for specific features or fixes
- Use when you need to understand exact scope and modification points
- Focus on concrete deliverables rather than architectural overviews

**Code Developer**: Before implementing specific functions, classes, or features  
- Use when you need exact insertion points and code structure guidance
- Focus on actionable implementation steps with line references

**Code Review**: After code has been written for a specific task
- Use when reviewing changes against repository-specific standards
- Focus on understanding what was actually implemented and how it fits

**UI Design**: Before creating or modifying specific UI components
- Use when you need component-specific patterns and design system compliance
- Focus on established design language and interaction patterns

**Memory-Gemini-Bridge**: For creating or updating CLAUDE.md files
- Use when establishing hierarchical documentation strategy
- Focus on cross-system compatibility between Claude and Gemini CLI

### Benefits of Task-Focused Approach

1. **Precision**: Get exact modification points instead of general patterns
2. **Efficiency**: 50% reduction in irrelevant analysis
3. **Actionability**: Concrete guidance with file:line references
4. **Context Relevance**: Repository-specific patterns, not generic best practices
5. **Task Alignment**: Analysis directly supports the specific work being done

### Template Customization

Customize templates by:

1. **Specific File Targeting**: Replace `[task-related-files]` with exact patterns for your task
2. **Domain Context**: Add domain-specific file patterns (auth, api, ui, etc.)
3. **Technology Focus**: Include relevant extensions (.tsx for React, .py for Python, etc.)
4. **Task Context**: Specify exact feature or component being worked on

These focused templates provide agents with precise, actionable context for specific tasks, eliminating unnecessary pattern analysis and providing concrete implementation guidance.

## Integration with Intelligent Context

All templates integrate with `gemini-intelligent-context.md`(@~/.claude/workflows/gemini-intelligent-context.md) for:

- **Smart Path Detection** - Automatic file targeting based on analysis type
- **Technology Stack Detection** - Framework and language-specific optimizations
- **Domain Context Mapping** - Intelligent domain-specific pattern matching
- **Dynamic Prompt Enhancement** - Context-aware prompt construction

For complete context detection algorithms and intelligent file targeting, see `gemini-intelligent-context.md`.