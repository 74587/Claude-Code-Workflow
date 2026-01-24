# Command Library

CCW Coordinator 支持的命令库。基于 CCW workflow 命令系统。

## Command Categories

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

| Command | Description | Level |
|---------|-------------|-------|
| `/issue:discover` | 发现Issue | Supplementary |
| `/issue:discover-by-prompt` | 基于提示发现Issue | Supplementary |
| `/issue:plan --all-pending` | 规划所有待处理Issue | Supplementary |
| `/issue:queue` | 排队Issue | Supplementary |
| `/issue:execute` | 执行Issue | Supplementary |

## Command Chains (Recommended)

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

## JSON Format

```json
{
  "workflow_commands": [
    {
      "category": "Planning",
      "commands": [
        { "name": "/workflow:lite-plan", "description": "轻量级规划" },
        { "name": "/workflow:plan", "description": "标准规划" },
        { "name": "/workflow:multi-cli-plan", "description": "多CLI协作规划" },
        { "name": "/workflow:brainstorm:auto-parallel", "description": "头脑风暴" },
        { "name": "/workflow:tdd-plan", "description": "TDD规划" }
      ]
    },
    {
      "category": "Execution",
      "commands": [
        { "name": "/workflow:lite-execute", "description": "轻量级执行" },
        { "name": "/workflow:execute", "description": "标准执行" },
        { "name": "/workflow:test-cycle-execute", "description": "测试循环执行" }
      ]
    },
    {
      "category": "BugFix",
      "commands": [
        { "name": "/workflow:lite-fix", "description": "轻量级修复" },
        { "name": "/workflow:lite-fix --hotfix", "description": "紧急修复" }
      ]
    },
    {
      "category": "Testing",
      "commands": [
        { "name": "/workflow:test-gen", "description": "测试生成" },
        { "name": "/workflow:test-fix-gen", "description": "测试修复" },
        { "name": "/workflow:tdd-verify", "description": "TDD验证" }
      ]
    },
    {
      "category": "Review",
      "commands": [
        { "name": "/workflow:review-session-cycle", "description": "会话审查" },
        { "name": "/workflow:review-module-cycle", "description": "模块审查" },
        { "name": "/workflow:review-fix", "description": "审查修复" },
        { "name": "/workflow:plan-verify", "description": "计划验证" }
      ]
    },
    {
      "category": "Documentation",
      "commands": [
        { "name": "/memory:docs", "description": "生成文档" },
        { "name": "/memory:update-related", "description": "更新相关文档" },
        { "name": "/memory:update-full", "description": "全面更新文档" }
      ]
    },
    {
      "category": "Issues",
      "commands": [
        { "name": "/issue:discover", "description": "发现Issue" },
        { "name": "/issue:discover-by-prompt", "description": "基于提示发现Issue" },
        { "name": "/issue:plan --all-pending", "description": "规划所有待处理Issue" },
        { "name": "/issue:queue", "description": "排队Issue" },
        { "name": "/issue:execute", "description": "执行Issue" }
      ]
    }
  ]
}
```
