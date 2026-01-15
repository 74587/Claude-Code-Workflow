# CCW Issue Loop 工作流完全指南

> 两阶段生命周期设计，支持在项目迭代中积累问题并集中解决

---

## 目录

1. [什么是 Issue Loop 工作流](#什么是-issue-loop-工作流)
2. [核心架构](#核心架构)
3. [两阶段生命周期](#两阶段生命周期)
4. [命令详解](#命令详解)
5. [使用场景](#使用场景)
6. [推荐策略](#推荐策略)
7. [串行无监管执行](#串行无监管执行)
8. [最佳实践](#最佳实践)

---

## 什么是 Issue Loop 工作流

Issue Loop 是 CCW (Claude Code Workflow) 中的批量问题处理工作流，专为处理项目迭代过程中积累的多个问题而设计。与单次修复不同，Issue Loop 采用 **"积累 → 规划 → 队列 → 执行"** 的模式，实现问题的批量发现和集中解决。

### 核心理念

```
传统模式：发现问题 → 立即修复 → 发现问题 → 立即修复 → ...
                    ↓
Issue Loop：持续积累 → 集中规划 → 队列优化 → 批量执行
```

**优势**：
- 避免频繁上下文切换
- 冲突检测和依赖排序
- 并行执行支持
- 完整的追踪和审计

---

## 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Issue Loop Workflow                          │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Accumulation (积累)                                   │
│    /issue:discover, /issue:discover-by-prompt, /issue:new       │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Batch Resolution (批量解决)                           │
│    /issue:plan → /issue:queue → /issue:execute                  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流转

```
issues.jsonl → solutions/<id>.jsonl → queues/<queue-id>.json → 执行
     ↓                 ↓                      ↓
   Issue 记录      解决方案           优先级排序 + 冲突检测
```

---

## 两阶段生命周期

### Phase 1: Accumulation (积累阶段)

在项目正常迭代过程中，持续发现和记录问题：

| 触发场景 | 对应命令 | 说明 |
|----------|----------|------|
| 任务完成后 Review | `/issue:discover` | 自动分析代码发现潜在问题 |
| 代码审查发现 | `/issue:new` | 手动创建结构化 Issue |
| 测试失败 | `/issue:discover-by-prompt` | 根据描述创建 Issue |
| 用户反馈 | `/issue:new` | 手动录入反馈问题 |

**Issue 状态流转**：
```
registered → planned → queued → executing → completed
                                                ↓
                                      issue-history.jsonl
```

### Phase 2: Batch Resolution (批量解决阶段)

积累足够 Issue 后，集中处理：

```
Step 1: /issue:plan --all-pending    # 为所有待处理 Issue 生成解决方案
Step 2: /issue:queue                  # 形成执行队列（冲突检测 + 排序）
Step 3: /issue:execute                # 批量执行（串行或并行）
```

---

## 命令详解

### 积累阶段命令

#### `/issue:new`
手动创建结构化 Issue：
```bash
ccw issue init <id> --title "Issue 标题" --priority P2
```

#### `/issue:discover`
自动分析代码发现问题：
```bash
# 使用 gemini 进行多视角分析
# 发现：bug、安全问题、性能问题、代码规范等
```

#### `/issue:discover-by-prompt`
根据描述创建 Issue：
```bash
# 输入问题描述，自动生成结构化 Issue
```

### 批量解决阶段命令

#### `/issue:plan`
为 Issue 生成解决方案：
```bash
ccw issue plan --all-pending    # 规划所有待处理 Issue
ccw issue plan ISS-001          # 规划单个 Issue
```

**输出**：每个 Issue 生成包含以下内容的解决方案：
- 修改点 (modification_points)
- 实现步骤 (implementation)
- 测试要求 (test)
- 验收标准 (acceptance)

#### `/issue:queue`
形成执行队列：
```bash
ccw issue queue                 # 创建新队列
ccw issue queue add <id>        # 添加到当前队列
ccw issue queue list            # 查看队列历史
```

**关键功能**：
- 冲突检测：使用 Gemini CLI 分析解决方案间的文件冲突
- 依赖排序：根据依赖关系确定执行顺序
- 优先级加权：高优先级 Issue 优先执行

#### `/issue:execute`
执行队列中的解决方案：
```bash
ccw issue next                  # 获取下一个待执行解决方案
ccw issue done <item_id>        # 标记完成
ccw issue done <id> --fail      # 标记失败
```

### 管理命令

```bash
ccw issue list                  # 列出活跃 Issue
ccw issue status <id>           # 查看 Issue 详情
ccw issue history               # 查看已完成 Issue
ccw issue update --from-queue   # 从队列同步状态
```

---

## 使用场景

### 场景 1: 项目迭代后的技术债务清理

```
1. 完成 Sprint 功能开发
2. 执行 /issue:discover 发现技术债务
3. 积累一周后，执行 /issue:plan --all-pending
4. 使用 /issue:queue 形成队列
5. 使用 codex 执行 /issue:execute 批量处理
```

### 场景 2: 代码审查后的批量修复

```
1. 完成 PR 代码审查
2. 对每个发现执行 /issue:new 创建 Issue
3. 积累本次审查的所有发现
4. 执行 /issue:plan → /issue:queue → /issue:execute
```

### 场景 3: 测试失败的批量处理

```
1. 运行测试套件
2. 对失败的测试执行 /issue:discover-by-prompt
3. 一次性规划所有失败修复
4. 串行执行确保不引入新问题
```

### 场景 4: 安全漏洞批量修复

```
1. 安全扫描发现多个漏洞
2. 每个漏洞创建 Issue 并标记 P1 优先级
3. 使用 /issue:queue 自动按严重度排序
4. 执行修复并验证
```

---

## 推荐策略

### 何时使用 Issue Loop

| 条件 | 推荐 |
|------|------|
| 问题数量 >= 3 | Issue Loop |
| 问题涉及多个模块 | Issue Loop |
| 问题间可能有依赖 | Issue Loop |
| 需要冲突检测 | Issue Loop |
| 单个简单 bug | `/workflow:lite-fix` |
| 紧急生产问题 | `/workflow:lite-fix --hotfix` |

### 积累策略

**推荐阈值**：
- 积累 5-10 个 Issue 后集中处理
- 或按时间周期（如每周五下午）统一处理
- 紧急问题除外，立即标记 P1 并单独处理

### 队列策略

```javascript
// 冲突检测规则
if (solution_A.files ∩ solution_B.files !== ∅) {
  // 存在文件冲突，需要串行执行
  queue.addDependency(solution_A, solution_B)
}

// 优先级排序
sort by:
  1. priority (P1 > P2 > P3)
  2. dependencies (被依赖的先执行)
  3. complexity (低复杂度先执行)
```

---

## 串行无监管执行

**推荐使用 Codex 命令进行串行无监管执行**：

```bash
codex -p "@.codex/prompts/issue-execute.md"
```

### 执行流程

```
INIT: ccw issue next
  ↓
WHILE solution exists:
  ├── 1. 解析 solution JSON
  ├── 2. 逐个执行 tasks:
  │     ├── IMPLEMENT: 按步骤实现
  │     ├── TEST: 运行测试验证
  │     └── VERIFY: 检查验收标准
  ├── 3. 提交代码 (每个 solution 一次 commit)
  ├── 4. 报告完成: ccw issue done <id>
  └── 5. 获取下一个: ccw issue next
  ↓
COMPLETE: 输出最终报告
```

### Worktree 模式（推荐并行执行）

```bash
# 创建隔离的工作树
codex -p "@.codex/prompts/issue-execute.md --worktree"

# 恢复中断的执行
codex -p "@.codex/prompts/issue-execute.md --worktree /path/to/existing"
```

**优势**：
- 并行执行器不冲突
- 主工作目录保持干净
- 执行完成后易于清理
- 支持中断恢复

### 执行规则

1. **永不中途停止** - 持续执行直到队列为空
2. **一次一个解决方案** - 完全完成（所有任务 + 提交 + 报告）后继续
3. **解决方案内串行** - 每个任务的实现/测试/验证按顺序完成
4. **测试必须通过** - 任何任务测试失败则修复后继续
5. **每解决方案一次提交** - 所有任务共享一次 commit
6. **自我验证** - 所有验收标准必须通过
7. **准确报告** - 使用 `ccw issue done` 报告完成
8. **优雅处理失败** - 失败时报告并继续下一个

### Commit 格式

```
[commit_type](scope): [solution.description]

## Solution Summary
- **Solution-ID**: SOL-ISS-20251227-001-1
- **Issue-ID**: ISS-20251227-001
- **Risk/Impact/Complexity**: low/medium/low

## Tasks Completed
- [T1] 实现用户认证: Modify src/auth/
- [T2] 添加测试覆盖: Add tests/auth/

## Files Modified
- src/auth/login.ts
- tests/auth/login.test.ts

## Verification
- All unit tests passed
- All acceptance criteria verified
```

---

## 最佳实践

### 1. Issue 质量

创建高质量的 Issue 描述：
```json
{
  "title": "清晰简洁的标题",
  "context": {
    "problem": "具体问题描述",
    "impact": "影响范围",
    "reproduction": "复现步骤（如适用）"
  },
  "priority": "P1-P5"
}
```

### 2. Solution 审查

在执行前审查生成的解决方案：
```bash
ccw issue status <id>  # 查看解决方案详情
```

检查点：
- 修改点是否准确
- 测试覆盖是否充分
- 验收标准是否可验证

### 3. 队列监控

```bash
ccw issue queue         # 查看当前队列状态
ccw issue queue list    # 查看队列历史
```

### 4. 失败处理

```bash
# 单个失败
ccw issue done <id> --fail --reason '{"task_id": "T1", "error": "..."}'

# 重试失败项
ccw issue retry --queue QUE-xxx
```

### 5. 历史追溯

```bash
ccw issue history              # 查看已完成 Issue
ccw issue history --json       # JSON 格式导出
```

---

## 工作流对比

| 维度 | Issue Loop | lite-fix | coupled |
|------|------------|----------|---------|
| **适用场景** | 批量问题 | 单个 bug | 复杂功能 |
| **问题数量** | 3+ | 1 | 1 |
| **生命周期** | 两阶段 | 单次 | 多阶段 |
| **冲突检测** | 有 | 无 | 无 |
| **并行支持** | Worktree 模式 | 无 | 无 |
| **追踪审计** | 完整 | 基础 | 完整 |

---

## 快速参考

### 完整流程命令

```bash
# 1. 积累阶段
/issue:new              # 手动创建
/issue:discover         # 自动发现

# 2. 规划阶段
/issue:plan --all-pending

# 3. 队列阶段
/issue:queue

# 4. 执行阶段（推荐使用 codex）
codex -p "@.codex/prompts/issue-execute.md"

# 或手动执行
/issue:execute
```

### CLI 命令速查

```bash
ccw issue list                  # 列出 Issue
ccw issue status <id>           # 查看详情
ccw issue plan --all-pending    # 批量规划
ccw issue queue                 # 创建队列
ccw issue next                  # 获取下一个
ccw issue done <id>             # 标记完成
ccw issue history               # 查看历史
```

---

## 总结

Issue Loop 工作流是 CCW 中处理批量问题的最佳选择，通过两阶段生命周期设计，实现了问题的高效积累和集中解决。配合 Codex 的串行无监管执行能力，可以在保证质量的同时大幅提升效率。

**记住**：
- 积累足够数量（5-10 个）后再集中处理
- 使用 Codex 进行串行无监管执行
- 利用 Worktree 模式实现并行执行
- 保持 Issue 描述的高质量
