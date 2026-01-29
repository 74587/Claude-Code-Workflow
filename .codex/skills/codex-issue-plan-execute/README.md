# Codex Issue Plan-Execute Skill

简化的 Codex issue 规划-执行工作流 Skill。

## 快速开始

### 安装

该 Skill 已经在 `~/.claude/skills/codex-issue-plan-execute/` 中生成。

### 使用方式

#### 方式 1：执行单个 issue

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute --issue ISS-001"
```

#### 方式 2：批量执行多个 issues

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute --issues ISS-001,ISS-002,ISS-003"
```

#### 方式 3：交互式选择

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute"
# 系统会显示 issues 列表，你可以交互式选择
```

#### 方式 4：恢复之前的执行

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute --resume .workflow/.scratchpad/codex-issue-20250129-120000"
```

## 工作流程

```
Initialize
  ↓
List Issues (显示所有 pending/planned issues)
  ↓
Plan Solutions (为选中的 issues 生成解决方案)
  ↓
Execute Solutions (按顺序执行解决方案)
  ↓
Complete (生成报告并完成)
```

### 每个阶段做什么

**Phase 1: Initialize**
- 创建工作目录
- 初始化状态 JSON
- 准备执行环境

**Phase 2: List Issues**
- 从 ccw issue 加载 issues
- 显示当前状态矩阵
- 收集用户的规划/执行选择

**Phase 3: Plan Solutions**
- 为每个 issue 生成规划 subagent
- 分析代码并设计解决方案
- 绑定 solution 到 issue
- 更新 issue 状态 → "planned"

**Phase 4: Execute Solutions**
- 加载已规划的解决方案
- 执行所有 tasks（implement → test → verify）
- 一次性提交所有更改
- 更新 solution 状态 → "completed"

**Phase 5: Complete**
- 生成执行报告
- 保存最终状态和统计信息
- 输出完成摘要

## 目录结构

```
codex-issue-plan-execute/
├── SKILL.md                              # 入口文件（你已读）
├── phases/
│   ├── orchestrator.md                   # Orchestrator 编排逻辑
│   ├── state-schema.md                   # 状态结构定义
│   └── actions/
│       ├── action-init.md                # 初始化
│       ├── action-list.md                # 列表显示
│       ├── action-plan.md                # 规划
│       ├── action-execute.md             # 执行
│       └── action-complete.md            # 完成
├── specs/
│   ├── issue-handling.md                 # Issue 处理规范
│   ├── solution-schema.md                # Solution 数据结构
│   ├── quality-standards.md              # 质量标准
│   └── subagent-roles.md                 # Subagent 角色定义
└── templates/
    └── (可选的 prompt 模板)
```

## 配置选项

### 命令行参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `--issue` | ISS-ID | 执行单个 issue |
| `--issues` | ID1,ID2,ID3 | 执行多个 issues |
| `--resume` | path | 从快照恢复 |
| `--skip-plan` | - | 跳过规划阶段，直接执行 |
| `--skip-execute` | - | 仅规划，不执行 |

## 关键特性

### ✓ 已实现

- [x] Autonomous 状态驱动编排
- [x] 双 Agent 规划-执行分离
- [x] 最小化队列（仅保留待执行项）
- [x] 批量 issue 处理
- [x] 完整状态持久化
- [x] 快照恢复能力
- [x] 详细执行报告

### ⌛ 可选增强

- [ ] 并行规划（当前串行）
- [ ] 冲突检测和优先级排序
- [ ] 自动重试失败项
- [ ] WebUI 显示进度
- [ ] Slack 通知

## 输出文件

执行完成后会在 `.workflow/.scratchpad/codex-issue-{timestamp}/` 生成：

```
state.json                 # 最终状态快照
state-history.json         # 状态变更历史
queue.json                 # 执行队列
execution-results.json     # 执行结果汇总
final-report.md            # 最终报告
solutions/
  ├── ISS-001-plan.json
  ├── ISS-001-execution.json
  ├── ISS-002-plan.json
  └── ...
snapshots/
  ├── snapshot-before-plan.json
  ├── snapshot-before-execute.json
  └── ...
```

## 故障排除

### Issue 无法加载

```bash
# 检查 issues 是否存在
ccw issue list --status registered

# 手动创建 issue
ccw issue init ISS-001 --title "My Issue"
```

### 规划失败

- 检查 `~/.codex/agents/issue-plan-agent.md` 是否存在
- 查看错误日志中的具体原因
- 从快照恢复后重试

### 执行失败

- 检查测试是否通过：`npm test`
- 查看 acceptance criteria 是否满足
- 从快照恢复：`codex ... --resume {snapshot_path}`

### 状态不一致

- 删除旧的 state.json 重新开始
- 或从最后一个有效快照恢复

## 性能指标

| 指标 | 预期值 |
|------|--------|
| 初始化 | < 1s |
| 列表加载 | < 2s |
| 单 issue 规划 | 30-60s |
| 单 issue 执行 | 1-5 min |
| 总处理时间（3 issues） | 5-20 min |

## 系统要求

- Codex CLI >= 2.0
- Node.js >= 14
- Git 仓库已初始化
- ccw issue 命令可用

## 贡献指南

### 修改 Action

编辑 `phases/actions/action-*.md` 文件

### 修改规范

编辑 `specs/*.md` 文件

### 测试 Skill

```bash
# 测试单个 issue
ccw codex issue:plan-execute --issue ISS-001

# 测试批量处理
ccw codex issue:plan-execute --issues ISS-001,ISS-002

# 检查输出
cat .workflow/.scratchpad/codex-issue-*/final-report.md
```

## 版本历史

- **v1.0** (2025-01-29)
  - 初始发布
  - Autonomous 编排模式
  - 双 Agent 规划-执行分离
  - 简化队列管理

## 许可证

与 Claude Code 相同

## 支持

遇到问题？

1. 查看 [SKILL.md](SKILL.md) 了解架构
2. 查看 `specs/` 下的规范文档
3. 检查执行日志和快照
4. 查看最终报告 `final-report.md`

---

**Ready to use!** 🚀

开始你的第一个 issue 规划-执行工作流：

```bash
codex -p "@.codex/prompts/codex-issue-plan-execute"
```
