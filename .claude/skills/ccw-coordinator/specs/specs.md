# CCW Coordinator Specifications

命令库、验证规则和注册表一体化规范。

---

## 命令库

### Planning Commands

| Command | Description | Level |
|---------|-------------|-------|
| `/workflow:lite-plan` | 轻量级规划 | L2 |
| `/workflow:plan` | 标准规划 | L3 |
| `/workflow:multi-cli-plan` | 多CLI协作规划 | L2 |
| `/workflow:brainstorm:auto-parallel` | 头脑风暴规划 | L4 |
| `/workflow:tdd-plan` | TDD规划 | L3 |

### Execution Commands

| Command | Description | Level |
|---------|-------------|-------|
| `/workflow:lite-execute` | 轻量级执行 | L2 |
| `/workflow:execute` | 标准执行 | L3 |
| `/workflow:test-cycle-execute` | 测试循环执行 | L3 |

### BugFix Commands

| Command | Description | Level |
|---------|-------------|-------|
| `/workflow:lite-fix` | 轻量级修复 | L2 |
| `/workflow:lite-fix --hotfix` | 紧急修复 | L2 |

### Testing Commands

| Command | Description | Level |
|---------|-------------|-------|
| `/workflow:test-gen` | 测试生成 | L3 |
| `/workflow:test-fix-gen` | 测试修复生成 | L3 |
| `/workflow:tdd-verify` | TDD验证 | L3 |

### Review Commands

| Command | Description | Level |
|---------|-------------|-------|
| `/workflow:review-session-cycle` | 会话审查 | L3 |
| `/workflow:review-module-cycle` | 模块审查 | L3 |
| `/workflow:review-fix` | 审查修复 | L3 |
| `/workflow:plan-verify` | 计划验证 | L3 |

### Documentation Commands

| Command | Description | Level |
|---------|-------------|-------|
| `/memory:docs` | 生成文档 | L2 |
| `/memory:update-related` | 更新相关文档 | L2 |
| `/memory:update-full` | 全面更新文档 | L2 |

### Issue Commands

| Command | Description |
|---------|-------------|
| `/issue:discover` | 发现Issue |
| `/issue:discover-by-prompt` | 基于提示发现Issue |
| `/issue:plan --all-pending` | 规划所有待处理Issue |
| `/issue:queue` | 排队Issue |
| `/issue:execute` | 执行Issue |

---

## 命令链推荐

### 标准开发流程

```
1. /workflow:lite-plan
2. /workflow:lite-execute
3. /workflow:test-cycle-execute
```

### 完整规划流程

```
1. /workflow:plan
2. /workflow:plan-verify
3. /workflow:execute
4. /workflow:review-session-cycle
```

### TDD 流程

```
1. /workflow:tdd-plan
2. /workflow:execute
3. /workflow:tdd-verify
```

### Issue 批处理流程

```
1. /issue:plan --all-pending
2. /issue:queue
3. /issue:execute
```

---

## 验证规则

### Rule 1: Single Planning Command

每条链最多包含一个规划命令。

| 有效 | 无效 |
|------|------|
| `plan → execute` | `plan → lite-plan → execute` |

### Rule 2: Compatible Pairs

规划和执行命令必须兼容。

| Planning | Execution | 兼容 |
|----------|-----------|------|
| lite-plan | lite-execute | ✓ |
| lite-plan | execute | ✗ |
| multi-cli-plan | lite-execute | ✓ |
| multi-cli-plan | execute | ✓ |
| plan | execute | ✓ |
| plan | lite-execute | ✗ |
| tdd-plan | execute | ✓ |
| tdd-plan | lite-execute | ✗ |

### Rule 3: Testing After Execution

测试命令必须在执行命令之后。

| 有效 | 无效 |
|------|------|
| `execute → test-cycle-execute` | `test-cycle-execute → execute` |

### Rule 4: Review After Execution

审查命令必须在执行命令之后。

| 有效 | 无效 |
|------|------|
| `execute → review-session-cycle` | `review-session-cycle → execute` |

### Rule 5: BugFix Standalone

`lite-fix` 必须单独执行，不能与其他命令组合。

| 有效 | 无效 |
|------|------|
| `lite-fix` | `plan → lite-fix → execute` |
| `lite-fix --hotfix` | `lite-fix → test-cycle-execute` |

### Rule 6: Dependency Satisfaction

每个命令的依赖必须在前面执行。

```javascript
test-fix-gen → test-cycle-execute  ✓
test-cycle-execute                 ✗
```

### Rule 7: No Redundancy

链条中不能有重复的命令。

| 有效 | 无效 |
|------|------|
| `plan → execute → test` | `plan → plan → execute` |

### Rule 8: Command Exists

所有命令必须在此规范中定义。

---

## 反模式（避免）

### ❌ Pattern 1: Multiple Planning

```
plan → lite-plan → execute
```
**问题**: 重复分析，浪费时间
**修复**: 选一个规划命令

### ❌ Pattern 2: Test Without Context

```
test-cycle-execute  (独立执行)
```
**问题**: 没有执行上下文，无法工作
**修复**: 先执行 `execute` 或 `test-fix-gen`

### ❌ Pattern 3: BugFix with Planning

```
plan → execute → lite-fix
```
**问题**: lite-fix 是独立命令，不应与规划混合
**修复**: 用 `lite-fix` 单独修复，或用 `plan → execute` 做大改

### ❌ Pattern 4: Review Without Changes

```
review-session-cycle  (独立执行)
```
**问题**: 没有 git 改动可审查
**修复**: 先执行 `execute` 生成改动

### ❌ Pattern 5: TDD Misuse

```
tdd-plan → lite-execute
```
**问题**: lite-execute 无法处理 TDD 任务结构
**修复**: 用 `tdd-plan → execute → tdd-verify`

---

## 命令注册表

### 命令元数据结构

```json
{
  "command_name": {
    "category": "Planning|Execution|Testing|Review|BugFix|Maintenance",
    "level": "L0|L1|L2|L3",
    "description": "命令描述",
    "inputs": ["input1", "input2"],
    "outputs": ["output1", "output2"],
    "dependencies": ["依赖命令"],
    "parameters": [
      {"name": "--flag", "type": "string|boolean|number", "default": "value"}
    ],
    "chain_position": "start|middle|middle_or_end|end|standalone",
    "next_recommended": ["推荐的下一个命令"]
  }
}
```

### 命令分组

| Group | Commands |
|-------|----------|
| planning | lite-plan, multi-cli-plan, plan, tdd-plan |
| execution | lite-execute, execute, develop-with-file |
| testing | test-gen, test-fix-gen, test-cycle-execute, tdd-verify |
| review | review-session-cycle, review-module-cycle, review-fix |
| bugfix | lite-fix, debug, debug-with-file |
| maintenance | clean, replan |
| verification | plan-verify, tdd-verify |

### 兼容性矩阵

| 组合 | 状态 |
|------|------|
| lite-plan + lite-execute | ✓ compatible |
| lite-plan + execute | ✗ incompatible - use plan |
| multi-cli-plan + lite-execute | ✓ compatible |
| plan + execute | ✓ compatible |
| plan + lite-execute | ✗ incompatible - use lite-plan |
| tdd-plan + execute | ✓ compatible |
| execute + test-cycle-execute | ✓ compatible |
| lite-execute + test-cycle-execute | ✓ compatible |
| test-fix-gen + test-cycle-execute | ✓ required |
| review-session-cycle + review-fix | ✓ compatible |
| lite-fix + test-cycle-execute | ✗ incompatible - lite-fix standalone |

---

## 验证工具

### chain-validate.cjs

位置: `tools/chain-validate.cjs`

验证命令链合法性：

```bash
node tools/chain-validate.cjs plan execute test-cycle-execute
```

输出:
```
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

## 命令注册表

### 工具位置

位置: `tools/command-registry.cjs` (skill 内置)

### 工作模式

**按需提取**: 只提取用户确定的任务链中的命令，不是全量扫描。

```javascript
// 用户任务链: [lite-plan, lite-execute]
const commandNames = command_chain.map(cmd => cmd.command);
const commandMeta = registry.getCommands(commandNames);
// 只提取这 2 个命令的元数据
```

### 功能

- 自动查找全局 `.claude/commands/workflow` 目录（相对路径 > 用户 home）
- 按需提取指定命令的 YAML 头元数据
- 缓存机制避免重复读取
- 提供批量查询接口

### 集成方式

在 action-command-execute 中自动集成：

```javascript
const CommandRegistry = require('./tools/command-registry.cjs');
const registry = new CommandRegistry();

// 只提取任务链中的命令
const commandNames = command_chain.map(cmd => cmd.command);
const commandMeta = registry.getCommands(commandNames);

// 使用元数据生成提示词
const cmdInfo = commandMeta[cmd.command];
// {
//   name: 'lite-plan',
//   description: '轻量级规划...',
//   argumentHint: '[-e|--explore] "task description"',
//   allowedTools: [...],
//   filePath: '...'
// }
```

### 提示词生成

智能提示词自动包含：

1. **任务上下文**: 用户任务描述
2. **前序产物**: 已完成命令的产物信息
3. **命令元数据**: 命令的参数提示和描述

```
任务: 实现用户注册功能

前序完成:
- /workflow:lite-plan: WFS-plan-001 (IMPL_PLAN.md)

命令: /workflow:lite-execute [--resume-session="session-id"]
```

详见 `tools/README.md`。
