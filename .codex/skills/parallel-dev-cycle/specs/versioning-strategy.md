# Document Versioning Strategy

文档版本管理策略：重新创建 vs 增量更新

## 推荐方案：重新创建 + 归档历史

每次迭代，**完全重写**主文档，旧版本自动归档到 `history/` 目录。

### 文件结构

```
.workflow/.cycle/cycle-v1-20260122-abc123.progress/
├── ra/
│   ├── requirements.md          # v1.2.0 (当前版本，重新创建)
│   ├── edge-cases.md            # v1.2.0 (当前版本，重新创建)
│   ├── changes.log              # NDJSON 完整变更历史（append-only）
│   └── history/
│       ├── requirements-v1.0.0.md   (归档)
│       ├── requirements-v1.1.0.md   (归档)
│       ├── edge-cases-v1.0.0.md     (归档)
│       └── edge-cases-v1.1.0.md     (归档)
├── ep/
│   ├── exploration.md           # v1.2.0 (当前)
│   ├── architecture.md          # v1.2.0 (当前)
│   ├── plan.json                # v1.2.0 (当前)
│   └── history/
│       ├── plan-v1.0.0.json
│       └── plan-v1.1.0.json
├── cd/
│   ├── implementation.md        # v1.2.0 (当前)
│   ├── code-changes.log         # NDJSON 完整历史
│   ├── issues.md                # 当前未解决问题
│   └── history/
│       ├── implementation-v1.0.0.md
│       └── implementation-v1.1.0.md
└── vas/
    ├── validation.md            # v1.2.0 (当前)
    ├── test-results.json        # v1.2.0 (当前)
    ├── summary.md               # v1.2.0 (当前)
    └── history/
        ├── validation-v1.0.0.md
        └── test-results-v1.0.0.json
```

## 文档模板优化

### Requirements.md (重新创建版本)

```markdown
# Requirements Specification - v1.2.0

## Document Metadata
| Field | Value |
|-------|-------|
| Version | 1.2.0 |
| Previous | 1.1.0 (Added Google OAuth) |
| Changes | Added MFA, GitHub provider |
| Date | 2026-01-23T10:00:00+08:00 |
| Cycle | cycle-v1-20260122-abc123 |
| Iteration | 3 |

---

## Functional Requirements

### FR-001: OAuth Authentication
**Description**: Users can log in using OAuth providers.

**Supported Providers**: Google, GitHub

**Priority**: High

**Status**: ✓ Implemented (v1.0.0), Enhanced (v1.1.0, v1.2.0)

**Success Criteria**:
- User can click provider button
- Redirect to provider
- Return with valid token
- Session created

---

### FR-002: Multi-Provider Support
**Description**: System supports multiple OAuth providers simultaneously.

**Providers**:
- Google (v1.1.0)
- GitHub (v1.2.0)

**Priority**: High

**Status**: ✓ Implemented

---

### FR-003: Multi-Factor Authentication
**Description**: Optional MFA for enhanced security.

**Method**: TOTP (Time-based One-Time Password)

**Priority**: Medium

**Status**: 🆕 New in v1.2.0

**Success Criteria**:
- User can enable MFA in settings
- TOTP QR code generated
- Verification on login

---

## Non-Functional Requirements

### NFR-001: Performance
Response time < 500ms for all OAuth flows.

**Status**: ✓ Met (v1.0.0)

---

## Edge Cases

### EC-001: OAuth Provider Timeout
**Scenario**: Provider doesn't respond in 5 seconds

**Expected**: Display error, offer retry

**Status**: ✓ Handled

---

### EC-002: Invalid MFA Code (NEW v1.2.0)
**Scenario**: User enters incorrect TOTP code

**Expected**: Display error, max 3 attempts, lock after

**Status**: 🔄 To be implemented

---

## Constraints
- Must use existing JWT session management
- No new database servers
- Compatible with existing user table

---

## Assumptions
- Users have access to authenticator app for MFA
- OAuth providers are always available

---

## Version History Summary

| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Initial OAuth login (Google only implicit) |
| 1.1.0 | 2026-01-22 | + Explicit Google OAuth support |
| 1.2.0 | 2026-01-23 | + GitHub provider, + MFA (current) |

**Detailed History**: See `history/` directory and `changes.log`
```

### Changes.log (NDJSON - 完整历史)

```jsonl
{"timestamp":"2026-01-22T10:00:00+08:00","iteration":1,"version":"1.0.0","action":"create","type":"requirement","id":"FR-001","description":"Initial OAuth requirement"}
{"timestamp":"2026-01-22T10:05:00+08:00","iteration":1,"version":"1.0.0","action":"create","type":"requirement","id":"NFR-001","description":"Performance requirement"}
{"timestamp":"2026-01-22T11:00:00+08:00","iteration":2,"version":"1.1.0","action":"update","type":"requirement","id":"FR-001","description":"Clarified Google OAuth support"}
{"timestamp":"2026-01-22T11:05:00+08:00","iteration":2,"version":"1.1.0","action":"create","type":"requirement","id":"FR-002","description":"Multi-provider support"}
{"timestamp":"2026-01-23T10:00:00+08:00","iteration":3,"version":"1.2.0","action":"create","type":"requirement","id":"FR-003","description":"MFA requirement"}
{"timestamp":"2026-01-23T10:05:00+08:00","iteration":3,"version":"1.2.0","action":"update","type":"requirement","id":"FR-002","description":"Added GitHub provider"}
```

## 实现流程

### Agent 工作流（RA 为例）

```javascript
// ==================== RA Agent 迭代流程 ====================

// 读取当前状态
const state = JSON.parse(Read(`.workflow/.cycle/${cycleId}.json`))
const currentVersion = state.requirements?.version || "0.0.0"
const iteration = state.current_iteration

// 如果是迭代（已有旧版本）
if (currentVersion !== "0.0.0") {
  // 1. 归档旧版本
  const oldFile = `.workflow/.cycle/${cycleId}.progress/ra/requirements.md`
  const archiveFile = `.workflow/.cycle/${cycleId}.progress/ra/history/requirements-v${currentVersion}.md`

  Copy(oldFile, archiveFile)  // 归档

  // 2. 读取旧版本（可选，用于理解上下文）
  const oldRequirements = Read(oldFile)

  // 3. 读取变更历史
  const changesLog = readNDJSON(`.workflow/.cycle/${cycleId}.progress/ra/changes.log`)
}

// 4. 生成新版本号
const newVersion = bumpVersion(currentVersion, 'minor')  // 1.1.0 -> 1.2.0

// 5. 生成新文档（完全重写）
const newRequirements = generateRequirements({
  version: newVersion,
  previousVersion: currentVersion,
  previousSummary: "Added Google OAuth support",
  currentChanges: "Added MFA and GitHub provider",
  iteration: iteration,
  taskDescription: state.description,
  changesLog: changesLog  // 用于理解历史
})

// 6. 写入新文档（覆盖旧的）
Write(`.workflow/.cycle/${cycleId}.progress/ra/requirements.md`, newRequirements)

// 7. 追加变更到 changes.log
appendNDJSON(`.workflow/.cycle/${cycleId}.progress/ra/changes.log`, {
  timestamp: getUtc8ISOString(),
  iteration: iteration,
  version: newVersion,
  action: "create",
  type: "requirement",
  id: "FR-003",
  description: "Added MFA requirement"
})

// 8. 更新状态
state.requirements = {
  version: newVersion,
  output_file: `.workflow/.cycle/${cycleId}.progress/ra/requirements.md`,
  summary: {
    functional_requirements: 3,
    edge_cases: 2,
    constraints: 3
  }
}

Write(`.workflow/.cycle/${cycleId}.json`, JSON.stringify(state, null, 2))
```

## 优势对比

| 方面 | 增量更新 | 重新创建 + 归档 |
|------|----------|----------------|
| **文档简洁性** | ❌ 越来越长 | ✅ 始终简洁 |
| **Agent 解析** | ❌ 需要解析历史 | ✅ 只看当前版本 |
| **维护复杂度** | ❌ 高（版本标记） | ✅ 低（直接重写） |
| **文件大小** | ❌ 膨胀 | ✅ 固定 |
| **历史追溯** | ✅ 在主文档 | ✅ 在 history/ + changes.log |
| **人类可读** | ❌ 需要跳过历史 | ✅ 直接看当前 |
| **Token 使用** | ❌ 多（读取完整历史） | ✅ 少（只读当前） |

## 归档策略

### 自动归档触发时机

```javascript
function shouldArchive(currentVersion, state) {
  // 每次版本更新时归档
  return currentVersion !== state.requirements?.version
}

function archiveOldVersion(cycleId, agent, filename, currentVersion) {
  const currentFile = `.workflow/.cycle/${cycleId}.progress/${agent}/${filename}`
  const archiveDir = `.workflow/.cycle/${cycleId}.progress/${agent}/history`
  const archiveFile = `${archiveDir}/${filename.replace('.', `-v${currentVersion}.`)}`

  // 确保归档目录存在
  mkdir -p ${archiveDir}

  // 复制（不是移动，保持当前文件直到新版本写入）
  Copy(currentFile, archiveFile)

  console.log(`Archived ${filename} v${currentVersion} to history/`)
}
```

### 清理策略（可选）

保留最近 N 个版本，删除更老的归档：

```javascript
function cleanupArchives(cycleId, agent, keepVersions = 3) {
  const historyDir = `.workflow/.cycle/${cycleId}.progress/${agent}/history`
  const archives = listFiles(historyDir)

  // 按版本号排序
  archives.sort((a, b) => compareVersions(extractVersion(a), extractVersion(b)))

  // 删除最老的版本（保留最近 N 个）
  if (archives.length > keepVersions) {
    const toDelete = archives.slice(0, archives.length - keepVersions)
    toDelete.forEach(file => Delete(`${historyDir}/${file}`))
  }
}
```

## Changes.log 的重要性

虽然主文档重新创建，但 **changes.log (NDJSON) 永久保留完整历史**：

```bash
# 查看所有变更
cat .workflow/.cycle/cycle-xxx.progress/ra/changes.log | jq .

# 查看某个需求的历史
cat .workflow/.cycle/cycle-xxx.progress/ra/changes.log | jq 'select(.id=="FR-001")'

# 按迭代查看变更
cat .workflow/.cycle/cycle-xxx.progress/ra/changes.log | jq 'select(.iteration==2)'
```

这样：
- **主文档**: 清晰简洁（当前状态）
- **Changes.log**: 完整追溯（所有历史）
- **History/**: 快照备份（按需查看）

## 推荐实施

1. ✅ 采用"重新创建"策略
2. ✅ 主文档只保留"上一版本简要说明"
3. ✅ 自动归档到 `history/` 目录
4. ✅ Changes.log (NDJSON) 保留完整历史
5. ✅ 可选：保留最近 3-5 个历史版本

这样既保持了文档简洁（Agent 友好），又保留了完整历史（审计友好）。
