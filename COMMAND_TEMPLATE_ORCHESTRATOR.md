# Command Template: Orchestrator

**用途**：协调多个子命令的编排器命令模板

**特征**：保留 Related Commands 段落，明确说明调用的命令链

---

## 模板结构

```markdown
---
name: command-name
description: Brief description of what this command orchestrates
argument-hint: "[flags] arguments"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Command Name (/category:command-name)

## Overview
Clear description of what this command orchestrates and its role.

**Key Characteristics**:
- Orchestrates X phases/commands
- Coordinates between multiple slash commands
- Does NOT execute directly - delegates to specialized commands
- Manages workflow state and progress tracking

## Core Responsibilities
- Responsibility 1: Description
- Responsibility 2: Description
- Responsibility 3: Description

## Execution Flow

### Phase 1: Phase Name
**Command**: `SlashCommand(command="/command:name args")`

**Input**: Description of inputs

**Expected Behavior**:
- Behavior 1
- Behavior 2

**Parse Output**:
- Extract: variable name (pattern description)

**Validation**:
- Validation rule 1
- Validation rule 2

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

---

### Phase 2: Phase Name
[Repeat structure for each phase]

---

## TodoWrite Pattern

Track progress through all phases:

```javascript
TodoWrite({todos: [
  {"content": "Execute phase 1", "status": "in_progress|completed", "activeForm": "Executing phase 1"},
  {"content": "Execute phase 2", "status": "pending|in_progress|completed", "activeForm": "Executing phase 2"},
  {"content": "Execute phase 3", "status": "pending|in_progress|completed", "activeForm": "Executing phase 3"}
]})
```

## Data Flow

```
Phase 1: command-1 → output-1
  ↓
Phase 2: command-2 (input: output-1) → output-2
  ↓
Phase 3: command-3 (input: output-2) → final-result
```

## Error Handling

| Phase | Error | Action |
|-------|-------|--------|
| 1 | Error description | Recovery action |
| 2 | Error description | Recovery action |

## Usage Examples

### Basic Usage
```bash
/category:command-name
/category:command-name --flag "argument"
```

## Related Commands

**Prerequisite Commands**:
- `/command:prerequisite` - Description of when to use before this

**Called by This Command**:
- `/command:phase1` - Description (Phase 1)
- `/command:phase2` - Description (Phase 2)
- `/command:phase3` - Description (Phase 3)

**Follow-up Commands**:
- `/command:next` - Description of what to do after this
```

---

## 使用规则

### 核心原则
1. **保留 Related Commands** - 明确说明命令调用链
2. **清晰的阶段划分** - 每个Phase独立可追踪
3. **数据流可视化** - 展示Phase间的数据传递
4. **TodoWrite追踪** - 实时更新执行进度

### Related Commands 分类
- **Prerequisite Commands**: 执行本命令前需要先运行的命令
- **Called by This Command**: 本命令会调用的子命令（按阶段分组）
- **Follow-up Commands**: 执行本命令后的推荐下一步

### 格式要求
- 无 emoji/图标装饰
- 纯文本状态指示器
- 使用表格组织错误信息
- 清晰的数据流图

## 示例参考

参考已重构的编排器命令：
- `.claude/commands/workflow/plan.md`
- `.claude/commands/workflow/execute.md`
- `.claude/commands/workflow/session/complete.md`
- `.claude/commands/workflow/session/start.md`
