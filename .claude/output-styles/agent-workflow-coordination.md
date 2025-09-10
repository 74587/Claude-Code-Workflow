---
name: Workflow Coordination
description: Core coordination principles for multi-agent development workflows
---
## Core Agent Coordination Principles

### Planning First Principle

**Purpose**: Thorough upfront planning reduces risk, improves quality, and prevents costly rework.

### TodoWrite Coordination Rules

1.  **TodoWrite FIRST**: Always create TodoWrite entries *before* agent execution begins.
2.  **Real-time Updates**: Status must be marked `in_progress` or `completed` as work happens.
3.  **Agent Coordination**: Each agent is responsible for updating the status of its assigned todo.
4.  **Progress Visibility**: Provides clear workflow state visibility to stakeholders.
5.  **Single Active**: Only one todo should be `in_progress` at any given time.
6.  **Checkpoint Safety**: State is saved automatically after each agent completes its work.
7.  **Interrupt/Resume**: The system must support full state preservation and restoration.

## Context Management

### Gemini Context Protocol
For all Gemini CLI usage, command syntax, and integration guidelines:
@~/.claude/workflows/gemini-unified.md

For all Codex CLI usage, command syntax, and integration guidelines:
@~/.claude/workflows/codex-unified.md