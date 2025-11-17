# Command Template: Executor

**用途**：直接执行特定功能的执行器命令模板

**特征**：专注于自身功能实现，移除 Related Commands 段落

---

## 模板结构

```markdown
---
name: command-name
description: Brief description of what this command does
argument-hint: "[flags] arguments"
allowed-tools: Read(*), Edit(*), Write(*), Bash(*), TodoWrite(*)
---

# Command Name (/category:command-name)

## Overview
Clear description of what this command does and its purpose.

**Key Characteristics**:
- Executes specific functionality directly
- Does NOT orchestrate other commands
- Focuses on single responsibility
- Returns concrete results

## Core Functionality
- Function 1: Description
- Function 2: Description
- Function 3: Description

## Usage

### Command Syntax
```bash
/category:command-name [FLAGS] <ARGUMENTS>

# Flags
--flag1        Description
--flag2        Description

# Arguments
<arg1>         Description
<arg2>         Description (optional)
```

## Execution Process

### Step 1: Step Name
Description of what happens in this step

**Operations**:
- Operation 1
- Operation 2

**Validation**:
- Check 1
- Check 2

---

### Step 2: Step Name
[Repeat for each step]

---

## Input/Output

### Input Requirements
- Input 1: Description and format
- Input 2: Description and format

### Output Format
```
Output description and structure
```

## Error Handling

### Common Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Error message 1 | Root cause | How to fix |
| Error message 2 | Root cause | How to fix |

## Best Practices

1. **Practice 1**: Description and rationale
2. **Practice 2**: Description and rationale
3. **Practice 3**: Description and rationale
```

---

## 使用规则

### 核心原则
1. **移除 Related Commands** - 执行器不协调其他命令
2. **专注单一职责** - 每个执行器只做一件事
3. **清晰的步骤划分** - 明确执行流程
4. **完整的错误处理** - 列出常见错误和解决方案

### 可选段落
根据命令特性，以下段落可选：
- **Configuration**: 有配置参数时使用
- **Output Files**: 生成文件时使用
- **Exit Codes**: 有明确退出码时使用
- **Environment Variables**: 依赖环境变量时使用

### 格式要求
- 无 emoji/图标装饰
- 纯文本状态指示器
- 使用表格组织错误信息
- 提供实用的示例代码

## 示例参考

参考已重构的执行器命令：
- `.claude/commands/task/create.md`
- `.claude/commands/task/breakdown.md`
- `.claude/commands/task/execute.md`
- `.claude/commands/cli/execute.md`
- `.claude/commands/version.md`
