# Issue System Status Reference

> CCW Issue Management 状态管理参考手册

## 概述

CCW Issue 系统包含三个核心实体，每个实体有独立的状态定义：

| 实体 | 描述 | 存储位置 |
|------|------|----------|
| **Issue** | 问题/任务 | `.workflow/issues/issues.jsonl` |
| **Queue** | 执行队列 | `.workflow/issues/queues/*.json` |
| **QueueItem** | 队列项（解决方案级别） | Queue 内的 `solutions[]` 数组 |

---

## Issue 状态

**类型定义**: `'registered' | 'planning' | 'planned' | 'queued' | 'executing' | 'completed' | 'failed' | 'paused'`

| 状态 | 含义 | 触发命令/场景 |
|------|------|---------------|
| `registered` | 已注册，待规划 | `ccw issue create`, `ccw issue init`, `ccw issue pull` |
| `planning` | 规划中 | 手动设置 `ccw issue update <id> --status planning` |
| `planned` | 已规划，solution 已绑定 | `ccw issue bind <issue-id> <solution-id>` |
| `queued` | 已加入执行队列 | `ccw issue queue add <issue-id>`, `ccw issue retry` |
| `executing` | 执行中 | `ccw issue next` |
| `completed` | 已完成 | `ccw issue done <item-id>` |
| `failed` | 执行失败 | `ccw issue done <item-id> --fail` |
| `paused` | 暂停 | 手动设置 `ccw issue update <id> --status paused` |

### Issue 状态流转图

```
                                    ┌─────────────────────────────────────┐
                                    │                                     ▼
registered ──→ planning ──→ planned ──→ queued ──→ executing ──→ completed
                                          ▲           │
                                          │           ▼
                                          └─────── failed
                                                      │
                                                      ▼
                                                   paused (手动)
```

---

## Queue 状态

**类型定义**: `'active' | 'completed' | 'archived' | 'failed' | 'merged'`

| 状态 | 含义 | 触发命令/场景 |
|------|------|---------------|
| `active` | 活跃队列，可执行 | 创建队列时默认, `ccw issue retry` 重置 |
| `completed` | 已完成（所有项完成） | 所有 QueueItem 状态为 `completed` |
| `archived` | 已归档 | `ccw issue queue archive` |
| `failed` | 有失败项 | 有 QueueItem 失败且所有项已终止 |
| `merged` | 已合并到其他队列 | `ccw issue queue merge <source> --queue <target>` |

### Queue 状态流转图

```
              ┌────────────────────────────────────────┐
              │                                        ▼
active ───────┼──────────────────────────────────→ completed ──→ archived
              │
              │         ┌───────────┐
              └────────→│  failed   │
                        └─────┬─────┘
                              │ retry
                              ▼
                           active

active ──────────────────────────────────────────→ merged
```

---

## QueueItem 状态

**类型定义**: `'pending' | 'ready' | 'executing' | 'completed' | 'failed' | 'blocked'`

| 状态 | 含义 | 触发命令/场景 |
|------|------|---------------|
| `pending` | 等待执行 | 创建队列项时默认, `ccw issue retry` 重置 |
| `ready` | 依赖满足，可执行 | 计算得出（非持久化），用于 DAG |
| `executing` | 执行中 | `ccw issue next` |
| `completed` | 已完成 | `ccw issue done <item-id>` |
| `failed` | 失败 | `ccw issue done <item-id> --fail` |
| `blocked` | 被依赖阻塞 | 计算得出（非持久化），用于 DAG |

### QueueItem 状态流转图

```
pending ──→ executing ──→ completed
   ▲            │
   │            ▼
   └───────── failed (retry 重置)
```

> **注意**: `ready` 和 `blocked` 是在 `ccw issue queue dag` 命令中动态计算的，不会持久化存储。

---

## 状态验证

系统内置状态验证函数，防止无效状态赋值：

```typescript
// 常量定义
const VALID_QUEUE_STATUSES = ['active', 'completed', 'archived', 'failed', 'merged'] as const;
const VALID_ITEM_STATUSES = ['pending', 'ready', 'executing', 'completed', 'failed', 'blocked'] as const;
const VALID_ISSUE_STATUSES = ['registered', 'planning', 'planned', 'queued', 'executing', 'completed', 'failed', 'paused'] as const;

// 验证函数
validateQueueStatus(status: string): status is QueueStatus
validateItemStatus(status: string): status is QueueItemStatus
validateIssueStatus(status: string): status is IssueStatus
```

---

## 常用命令速查

### 状态查询

```bash
# 查看所有 Issue
ccw issue list

# 按状态筛选 Issue
ccw issue list --status planned,queued

# 查看队列状态
ccw issue queue

# 查看队列 DAG（含 ready/blocked 计算状态）
ccw issue queue dag
```

### 状态更新

```bash
# 更新 Issue 状态
ccw issue update <issue-id> --status <status>

# 从队列同步 Issue 状态为 queued
ccw issue update --from-queue

# 重试失败项（QueueItem → pending, Issue → queued, Queue → active）
ccw issue retry [issue-id]
```

### 执行流程

```bash
# 添加到队列 (Issue → queued, 创建 QueueItem → pending)
ccw issue queue add <issue-id>

# 获取下一个执行项 (QueueItem → executing, Issue → executing)
ccw issue next

# 标记完成 (QueueItem → completed, Issue → completed)
ccw issue done <item-id>

# 标记失败 (QueueItem → failed, Issue → failed)
ccw issue done <item-id> --fail --reason "error message"
```

---

## 状态对照表

| 操作 | Issue 状态 | Queue 状态 | QueueItem 状态 |
|------|-----------|------------|----------------|
| 创建 Issue | `registered` | - | - |
| 绑定 Solution | `planned` | - | - |
| 加入队列 | `queued` | `active` | `pending` |
| 开始执行 | `executing` | `active` | `executing` |
| 执行完成 | `completed` | `completed`* | `completed` |
| 执行失败 | `failed` | `failed`* | `failed` |
| 重试 | `queued` | `active` | `pending` |
| 归档队列 | - | `archived` | - |
| 合并队列 | - | `merged` | - |

> *Queue 状态在所有项完成/失败后才会更新

---

## 相关文档

- [Queue 命令详解](./queue.md)
- [Execute 工作流](./execute.md)
- [Plan 规划流程](./plan.md)
