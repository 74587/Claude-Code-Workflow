# CCW Coordinator

交互式命令编排工具：选择命令 → 形成命令链 → 通过 ccw cli 调用 Claude 循环执行

## 核心特性

- ✅ **仅支持 Claude**：所有执行通过 `ccw cli --tool claude` 调用
- ✅ **命令在提示词中**：提示词直接包含完整命令调用（如 `/workflow:lite-plan --yes "任务"`）
- ✅ **智能参数组装**：根据命令 YAML 头自动生成正确参数
- ✅ **循环执行**：每次根据上次完成情况组装下个命令的提示词

## 使用

```
/ccw-coordinator
或
/coordinator
```

## 流程

1. **用户描述任务**（如"实现用户注册功能"）
2. **Claude 推荐命令链**（如 lite-plan → lite-execute → test-cycle-execute）
3. **用户确认或调整**（可以修改顺序或添加/删除命令）
4. **循环执行**：
   - 第1个命令：`ccw cli -p "任务: xxx\n/workflow:lite-plan --yes \"xxx\"" --tool claude`
   - 第2个命令：`ccw cli -p "任务: xxx\n前序: ...\n/workflow:lite-execute --yes --in-memory" --tool claude`
   - ... 以此类推
5. **生成报告**（保存到 `.workflow/.ccw-coordinator/{timestamp}/`）

## 示例场景

### 标准开发流程

**任务**：实现用户注册功能

**推荐命令链**：
```
1. /workflow:lite-plan
2. /workflow:lite-execute
3. /workflow:test-cycle-execute
```

**执行过程**：
- `lite-plan` → 生成 IMPL_PLAN.md 和探索文件
- `lite-execute --in-memory` → 使用规划执行任务
- `test-cycle-execute --session="WFS-xxx"` → 运行测试

### Bug 修复

**任务**：修复登录页面验证失败问题

**推荐命令链**：
```
1. /workflow:lite-fix
```

**执行过程**：
- `lite-fix --yes "修复登录页面验证失败问题"` → 独立修复（不依赖规划）

### 完整规划流程

**任务**：重构认证模块

**推荐命令链**：
```
1. /workflow:plan
2. /workflow:execute
3. /workflow:review-session-cycle
```

**执行过程**：
- `plan` → 生成完整规划文档
- `execute --resume-session="WFS-xxx"` → 执行规划
- `review-session-cycle --session="WFS-xxx"` → 审查改动

## 提示词示例

### 第一个命令

```
任务: 实现用户注册功能，包括邮箱验证和密码加密

/workflow:lite-plan --yes "实现用户注册功能，包括邮箱验证和密码加密"
```

### 第二个命令

```
任务: 实现用户注册功能，包括邮箱验证和密码加密

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md, exploration-architecture.json)

/workflow:lite-execute --yes --in-memory
```

### 第三个命令

```
任务: 实现用户注册功能，包括邮箱验证和密码加密

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md)
- /workflow:lite-execute: WFS-register-2025-01-24 (完成)

/workflow:test-cycle-execute --yes --session="WFS-register-2025-01-24"
```

## 架构说明

```
用户触发: /ccw-coordinator
    ↓
Orchestrator (主流程状态机)
    ├─ action-init (初始化会话)
    ├─ action-command-selection (选择命令，Claude 推荐)
    ├─ action-command-build (调整命令链，可选)
    ├─ action-command-execute (循环调用 ccw cli)
    │   └─ for each command:
    │       1. 组装提示词
    │       2. ccw cli --tool claude
    │       3. 解析产物
    │       4. 更新状态
    └─ action-complete (生成报告)
```

## 输出结构

```
.workflow/.ccw-coordinator/{timestamp}/
├── state.json                    # 会话状态（命令链、执行结果）
├── command-chain.json            # 编排的完整命令链
├── execution-log.md              # 执行日志
├── final-summary.md              # 最终报告
├── commands/                     # 各命令执行详情
│   ├── 01-workflow-lite-plan.log
│   ├── 02-workflow-lite-execute.log
│   └── 03-workflow-test-cycle-execute.log
└── logs/                         # 错误和警告
    ├── errors.log
    └── warnings.log
```

## 文件说明

| 文件 | 用途 |
|------|------|
| SKILL.md | Skill 入口和架构说明 |
| phases/orchestrator.md | 编排器实现（状态机决策逻辑） |
| phases/state-schema.md | 状态结构定义 |
| phases/actions/action-command-execute.md | **核心**：循环执行逻辑 |
| specs/specs.md | 命令库、验证规则、注册表 |
| tools/chain-validate.cjs | 命令链验证工具 |
| tools/command-registry.cjs | 命令注册表（按需提取 YAML 头） |

## 详细文档

- 架构和设计原则 → **SKILL.md**
- 执行逻辑和提示词组装 → **phases/actions/action-command-execute.md**
- 命令库和验证规则 → **specs/specs.md**
