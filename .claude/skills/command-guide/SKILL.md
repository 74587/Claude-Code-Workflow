---
name: command-guide
description: Workflow command guide for Claude DMS3 (69 commands). Search/browse commands, get next-step recommendations, view documentation, report issues. Triggers "CCW-help", "CCW-issue", "how to use", "search commands", "what's next", beginner onboarding questions
allowed-tools: Read, Grep, Glob, AskUserQuestion
---

# Command Guide Skill

Comprehensive command guide for Claude DMS3 workflow system covering 69 commands across 4 categories (workflow, cli, memory, task).

## 🎯 Operation Modes

### Mode 1: Command Search 🔍

**When**: User searches by keyword, category, or use-case

**Triggers**: "搜索命令", "find command", "planning 相关", "search"

**Process**:
1. Identify search type (keyword/category/use-case)
2. Query appropriate index (all-commands/by-category/by-use-case)
3. Return matching commands with metadata
4. Suggest related commands

**Example**: "搜索 planning 命令" → Lists planning commands from `index/by-use-case.json`

---

### Mode 2: Smart Recommendations 🤖

**When**: User asks for next steps after a command

**Triggers**: "下一步", "what's next", "after /workflow:plan", "推荐"

**Process**:
1. Parse current context (last command/workflow state)
2. Query `index/command-relationships.json`
3. Return recommended next commands with rationale
4. Show common workflow patterns

**Example**: "执行完 /workflow:plan 后做什么？" → Recommends /workflow:execute or /workflow:action-plan-verify

---

### Mode 3: Full Documentation 📖

**When**: User requests command details

**Triggers**: "参数说明", "怎么用", "how to use", "详情"

**Process**:
1. Locate command in `index/all-commands.json`
2. Read original command file for full details
3. Present parameters, arguments, examples
4. Link to related commands

**Example**: "/workflow:plan 的参数是什么？" → Shows full parameter list and usage examples

---

### Mode 4: Beginner Onboarding 🎓

**When**: New user needs guidance

**Triggers**: "新手", "getting started", "如何开始", "常用命令"

**Process**:
1. Present progressive learning path
2. Show `index/essential-commands.json` (Top 14 commands)
3. Link to getting-started guide
4. Provide first workflow example

**Example**: "我是新手，如何开始？" → Learning path + Top 14 commands + quick start guide

---

### Mode 5: Issue Reporting 📝

**When**: User wants to report issue or request feature

**Triggers**: **"CCW-issue"**, **"CCW-help"**, "报告 bug", "功能建议", "问题咨询"

**Process**:
1. Use AskUserQuestion to confirm type (bug/feature/question)
2. Collect required information interactively
3. Select appropriate template (`templates/issue-{type}.md`)
4. Generate filled template and save/display

**Example**: "CCW-issue" → Interactive Q&A → Generates GitHub issue template

---

## 📚 Index Files

All command metadata is stored in JSON indexes for fast querying:

- **all-commands.json** - Complete catalog (69 commands) with full metadata
- **by-category.json** - Hierarchical organization (workflow/cli/memory/task)
- **by-use-case.json** - Grouped by scenario (planning/implementation/testing/docs/session)
- **essential-commands.json** - Top 14 most-used commands
- **command-relationships.json** - Next-step recommendations and dependencies

📖 Detailed structure: [Index Structure Reference](guides/index-structure.md)

---

## 🗂️ Supporting Guides

- **[Getting Started](guides/getting-started.md)** - 5-minute quickstart for beginners
- **[Workflow Patterns](guides/workflow-patterns.md)** - Common workflow examples (Plan→Execute, TDD, UI design)
- **[CLI Tools Guide](guides/cli-tools-guide.md)** - Gemini/Qwen/Codex usage
- **[Troubleshooting](guides/troubleshooting.md)** - Common issues and solutions
- **[Implementation Details](guides/implementation-details.md)** - Detailed logic for each mode
- **[Usage Examples](guides/examples.md)** - Example dialogues and edge cases

---

## 🛠️ Issue Templates

Generate standardized GitHub issue templates:

- **[Bug Report](templates/issue-bug.md)** - Report command errors or system bugs
- **[Feature Request](templates/issue-feature.md)** - Suggest new features or improvements
- **[Question](templates/issue-question.md)** - Ask usage questions or request help

Templates are auto-populated during Mode 5 (Issue Reporting) interaction.

---

## 📊 System Statistics

- **Total Commands**: 69
- **Categories**: 4 (workflow: 46, cli: 9, memory: 8, task: 4, general: 2)
- **Use Cases**: 5 (planning, implementation, testing, documentation, session-management)
- **Difficulty Levels**: 3 (Beginner, Intermediate, Advanced)
- **Essential Commands**: 14

---

## 🔧 Maintenance

### Updating Indexes

When commands are added/modified/removed:

```bash
bash scripts/update-index.sh
```

This script:
1. Scans all command files in `../../commands/`
2. Extracts metadata from YAML frontmatter
3. Analyzes command relationships
4. Regenerates all 5 index files

### Committing Updates

```bash
git add .claude/skills/command-guide/index/
git commit -m "docs: update command indexes"
git push
```

Team members get latest indexes via `git pull`.

---

## 📖 Related Documentation

- [Workflow Architecture](../../workflows/workflow-architecture.md) - System design overview
- [Intelligent Tools Strategy](../../workflows/intelligent-tools-strategy.md) - CLI tool selection
- [Context Search Strategy](../../workflows/context-search-strategy.md) - Search patterns
- [Task Core](../../workflows/task-core.md) - Task system fundamentals

---

**Version**: 1.0.0
**Last Updated**: 2025-01-06
**Maintainer**: Claude DMS3 Team
