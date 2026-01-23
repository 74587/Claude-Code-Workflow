---
name: Parallel Dev Cycle
description: Multi-agent parallel development cycle with requirement analysis, exploration planning, code development, and validation. Supports continuous iteration with markdown progress documentation.
argument-hint: TASK="<task description>" [--cycle-id=<id>] [--auto] [--parallel=<count>]
---

# Parallel Dev Cycle - Multi-Agent Development Workflow

Multi-agent parallel development cycle using Codex subagent pattern with four specialized workers:
1. **Requirements Analysis & Extension** (RA) - 需求分析及扩展
2. **Exploration & Planning** (EP) - 探索规划
3. **Code Development** (CD) - 代码开发
4. **Validation & Archival Summary** (VAS) - 验证及归档总结

每个 agent **仅维护一个主文档文件**，支持版本化、自动归档、完整历史追溯。

## Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| TASK | No | Task description (for new cycle, mutually exclusive with --cycle-id) |
| --cycle-id | No | Existing cycle ID to continue (from API or previous session) |
| --auto | No | Auto-cycle mode (run all phases sequentially) |
| --parallel | No | Number of parallel agents (default: 4, max: 4) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input (Task)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
                  ┌──────────────────────┐
                  │  Orchestrator Agent  │  (Coordinator)
                  │  (spawned once)      │
                  └──────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        v                    v                    v
    ┌────────┐         ┌────────┐         ┌────────┐
    │  RA    │         │  EP    │         │  CD    │
    │Agent   │         │Agent   │         │Agent   │
    └────────┘         └────────┘         └────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             v
                         ┌────────┐
                         │  VAS   │
                         │ Agent  │
                         └────────┘
                             │
                             v
                  ┌──────────────────────┐
                  │    Summary Report    │
                  │  & Markdown Docs     │
                  └──────────────────────┘
```

## Key Design Principles

1. **Single File Per Agent**: 每个 agent 仅维护一个主文件（精简清晰）
2. **Version-Based Overwrite**: 每个版本完全重写主文件
3. **Automatic Archival**: 旧版本自动归档到 `history/` 目录
4. **Complete Audit Trail**: Changes.log (NDJSON) 保留所有变更历史
5. **Parallel Execution**: 四个 agent 同时工作，无需等待
6. **File References**: 使用简短文件路径而非内容传递

## Session Structure

```
.workflow/.cycle/
+-- {cycleId}.json                                 # Master state file
+-- {cycleId}.progress/
    +-- ra/
    |   +-- requirements.md                        # v1.2.0 (当前，完全重写)
    |   +-- changes.log                            # NDJSON 完整历史（append-only）
    |   └-- history/
    |       +-- requirements-v1.0.0.md             # 归档快照
    |       +-- requirements-v1.1.0.md             # 归档快照
    +-- ep/
    |   +-- plan.md                                # v1.2.0 (当前)
    |   +-- changes.log                            # NDJSON 完整历史
    |   └-- history/
    |       +-- plan-v1.0.0.md
    |       +-- plan-v1.1.0.md
    +-- cd/
    |   +-- implementation.md                      # v1.2.0 (当前)
    |   +-- changes.log                            # NDJSON 完整历史
    |   └-- history/
    |       +-- implementation-v1.0.0.md
    |       +-- implementation-v1.1.0.md
    +-- vas/
    |   +-- summary.md                             # v1.2.0 (当前)
    |   +-- changes.log                            # NDJSON 完整历史
    |   └-- history/
    |       +-- summary-v1.0.0.md
    |       +-- summary-v1.1.0.md
    └-- coordination/
        +-- timeline.md                            # 执行时间线
        +-- decisions.log                          # 决策日志
```

## State Management

### Unified Cycle State

```json
{
  "cycle_id": "cycle-v1-20260122-abc123",
  "title": "Task title",
  "status": "running",
  "current_iteration": 2,
  "current_phase": "cd",

  "agents": {
    "ra": {
      "status": "completed",
      "version": "1.2.0",
      "output_file": ".workflow/.cycle/cycle-v1-xxx.progress/ra/requirements.md",
      "summary": { "requirements": 10, "edge_cases": 5 }
    },
    "ep": {
      "status": "completed",
      "version": "1.2.0",
      "output_file": ".workflow/.cycle/cycle-v1-xxx.progress/ep/plan.md",
      "summary": { "tasks": 8, "critical_path": 4 }
    },
    "cd": {
      "status": "running",
      "version": "1.1.0",
      "output_file": ".workflow/.cycle/cycle-v1-xxx.progress/cd/implementation.md",
      "summary": { "completed_tasks": 3, "files_modified": 5 }
    },
    "vas": {
      "status": "idle",
      "version": "0.0.0",
      "output_file": null
    }
  }
}
```

## Agent Output Format

### RA: requirements.md (单文件完整输出)

```markdown
# Requirements Specification - v1.2.0

## Document Status
| Field | Value |
|-------|-------|
| **Version** | 1.2.0 |
| **Previous Version** | 1.1.0 (Added Google OAuth) |
| **This Version** | Added MFA support, GitHub provider |
| **Iteration** | 3 |
| **Updated** | 2026-01-23T10:00:00+08:00 |

---

## Functional Requirements
- FR-001: OAuth authentication via Google/GitHub (v1.0.0, enhanced v1.1.0-1.2.0)
- FR-002: Multi-provider support (v1.1.0)
- FR-003: MFA/TOTP support (NEW v1.2.0)

## Non-Functional Requirements
- NFR-001: Response time < 500ms
- NFR-002: Support 1000 concurrent users

## Edge Cases
- EC-001: OAuth timeout → Fallback retry
- EC-002: Invalid TOTP → Max 3 attempts (NEW v1.2.0)

## Success Criteria
- [ ] All FRs implemented
- [ ] NFRs validated
- [ ] Coverage > 80%

---

## History Summary
| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Initial OAuth |
| 1.1.0 | 2026-01-22 | + Google OAuth |
| 1.2.0 | 2026-01-23 | + GitHub, + MFA (current) |

For detailed history, see `history/` and `changes.log`
```

### EP: plan.md (单文件完整输出)

```markdown
# Implementation Plan - v1.2.0

## Plan Status
| Field | Value |
|-------|-------|
| **Version** | 1.2.0 |
| **Previous** | 1.1.0 (Added GitHub integration) |
| **This Version** | Added MFA tasks (current) |
| **Total Tasks** | 10 |
| **Estimated Hours** | 20 |

---

## Architecture Highlights
- OAuth: passport-oauth2 library
- Providers: Google, GitHub
- Providers: Store in User.oauth_id, oauth_provider
- MFA: TOTP-based (NEW v1.2.0)

---

## Implementation Tasks
### Phase 1: Foundation (TASK-001-003)
- TASK-001: Setup OAuth config (1h, small)
- TASK-002: Update User model (2h, medium)
- TASK-003: Google OAuth strategy (4h, large)

### Phase 2: Multi-Provider (TASK-004-005)
- TASK-004: GitHub OAuth strategy (3h, medium) [NEW v1.2.0]
- TASK-005: Provider selection UI (2h, medium)

### Phase 3: MFA (TASK-006-008) [NEW v1.2.0]
- TASK-006: TOTP setup endpoint (3h, medium)
- TASK-007: TOTP verification (2h, medium)
- TASK-008: Recovery codes (1h, small)

### Phase 4: Testing & Docs (TASK-009-010)
- TASK-009: Integration tests (4h, large)
- TASK-010: Documentation (2h, medium)

---

## Critical Path
1. TASK-001 → TASK-002 → TASK-003 → TASK-005
2. TASK-006 → TASK-007 → TASK-008 → TASK-009

---

## Integration Points
- Location: src/middleware/auth.ts
- Database: User table oauth_* columns
- Frontend: login.tsx OAuth buttons

---

## History Summary
| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Basic OAuth plan |
| 1.1.0 | 2026-01-22 | + GitHub task |
| 1.2.0 | 2026-01-23 | + MFA tasks (current) |
```

### CD: implementation.md (单文件完整输出)

```markdown
# Implementation Progress - v1.1.0

## Progress Status
| Field | Value |
|-------|-------|
| **Version** | 1.1.0 |
| **Previous** | 1.0.0 (Initial OAuth) |
| **This Version** | GitHub OAuth support (current) |
| **Iteration** | 2 |
| **Updated** | 2026-01-23T09:30:00+08:00 |

---

## Completed Tasks
- ✓ TASK-001: Setup OAuth config (1h)
- ✓ TASK-002: Update User model (2h)
- ✓ TASK-003: Google OAuth strategy (4h)
- ✓ TASK-004: GitHub OAuth strategy (3h) [NEW v1.1.0]

## In Progress
- 🔄 TASK-005: Provider selection UI (50% complete)

## Next Tasks
- ☐ TASK-006: TOTP setup (v1.2.0)
- ☐ Tests & documentation

---

## Files Modified
| File | Action | Description |
|------|--------|-------------|
| src/config/oauth.ts | create | OAuth config (45 lines) |
| src/strategies/oauth-google.ts | create | Google strategy (120 lines) |
| src/strategies/oauth-github.ts | create | GitHub strategy (100 lines) [NEW v1.1.0] |
| src/models/User.ts | modify | +oauth_id, oauth_provider (8 lines) |
| src/routes/auth.ts | modify | +/auth/google, /auth/github (+75 lines) |

---

## Key Decisions Made
1. **OAuth Library**: passport-oauth2 (mature, well-maintained)
2. **Token Storage**: Database (for refresh tokens)
3. **Provider Selection**: Buttons on login page

---

## Issues & Blockers
### Current
- None

### Resolved (v1.0.0 → v1.1.0)
- ✓ OAuth callback URL validation (fixed)
- ✓ CORS issues (headers updated)

---

## Testing Status
| Test Type | v1.0.0 | v1.1.0 |
|-----------|--------|--------|
| Unit | 20/20 ✓ | 25/25 ✓ |
| Integration | 8/10 ⚠ | 12/14 ⚠ |
| E2E | 3/5 ⚠ | 5/8 ⚠ |

---

## History Summary
| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Google OAuth implementation |
| 1.1.0 | 2026-01-23 | + GitHub OAuth (current) |
```

### VAS: summary.md (单文件完整输出)

```markdown
# Validation & Summary Report - v1.0.0

## Validation Status
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **Test Pass Rate** | 92% | 90% | ✓ |
| **Code Coverage** | 87% | 80% | ✓ |
| **Requirements Met** | 3/3 | 100% | ✓ |
| **Critical Issues** | 0 | 0 | ✓ |
| **Production Ready** | YES | - | ✓ |

---

## Test Execution Results
- **Total Tests**: 50
- **Passed**: 46 (92%)
- **Failed**: 4 (8%)
- **Duration**: 2m 34s

### Failures
1. **oauth-refresh**: Expected token refresh, got error
   - Severity: Medium
   - Recommendation: Handle expired refresh tokens (v1.1.0 task)

2. **concurrent-login**: Race condition in session writes
   - Severity: High
   - Recommendation: Add mutex for session writes (v1.1.0 task)

3. **github-provider**: Timeout on provider response
   - Severity: Medium
   - Recommendation: Add retry logic with backoff

4. **totp-edge-case**: Invalid TOTP timing window
   - Severity: Low
   - Recommendation: Expand timing window by ±30s

---

## Code Coverage Analysis
- **Overall**: 87% (target: 80%) ✓
- **OAuth Module**: 95%
- **Routes**: 82%
- **User Model**: 78%

### Gaps
- Error recovery paths (15% uncovered)
- Concurrent request handling (20% uncovered)

---

## Requirements Verification
- ✓ FR-001: OAuth authentication (100% implemented)
- ✓ FR-002: Multi-provider support (Google: 100%, GitHub: 95%)
- ⚠ FR-003: MFA support (0% - planned v1.2.0)

- ✓ NFR-001: Response time < 500ms (avg 245ms)
- ✓ NFR-002: Handle 100 concurrent (sustained 120)

---

## Known Issues Summary
1. **MEDIUM**: OAuth refresh token edge case
   - Impact: Users may need re-auth
   - Status: Will fix in v1.1.0

2. **MEDIUM**: GitHub provider timeout
   - Impact: Occasional login failures
   - Status: Will fix in v1.1.0

---

## Deliverables Checklist
- ✓ Code implementation complete
- ✓ Unit tests written (20/20)
- ✓ Integration tests written (12/14)
- ✓ Documentation updated
- ✓ Security review: PASSED
- ✓ Performance benchmarks: MET

---

## Recommendations
1. **For v1.1.0**: Fix refresh token and concurrent login issues
2. **For v1.2.0**: Implement MFA/TOTP support
3. **For v1.3.0**: Add provider error recovery
4. **General**: Increase timeout tolerances

---

## Sign-Off
- **Status**: ✓ APPROVED FOR PRODUCTION
- **Validating Agent**: VAS-v1.0.0
- **Timestamp**: 2026-01-22T12:00:00+08:00
- **By**: Validation & Archival Specialist

---

## History Summary
| Version | Date | Summary |
|---------|------|---------|
| 1.0.0 | 2026-01-22 | Initial validation report (current) |
```

## Versioning Workflow

### 初始版本 (v1.0.0)

```bash
/parallel-dev-cycle TASK="Implement OAuth login"
```

生成：
```
requirements.md (v1.0.0)
plan.md (v1.0.0)
implementation.md (v1.0.0) - 如适用
summary.md (v1.0.0) - 如适用
```

### 迭代版本 (v1.1.0, v1.2.0)

```bash
/parallel-dev-cycle --cycle-id=cycle-v1-xxx --extend="Add GitHub support"
```

**自动处理**：
1. 读取当前 `requirements.md (v1.0.0)`
2. 自动归档到 `history/requirements-v1.0.0.md`
3. 重新创建 `requirements.md (v1.1.0)` - 完全覆盖
4. 追加变更到 `changes.log` (NDJSON)

## Changes.log Format (NDJSON)

保留永久审计日志（append-only，永不删除）：

```jsonl
{"timestamp":"2026-01-22T10:00:00+08:00","version":"1.0.0","agent":"ra","action":"create","change":"Initial requirements","iteration":1}
{"timestamp":"2026-01-22T11:00:00+08:00","version":"1.1.0","agent":"ra","action":"update","change":"Added Google OAuth requirement","iteration":2}
{"timestamp":"2026-01-22T11:30:00+08:00","version":"1.0.0","agent":"ep","action":"create","change":"Initial implementation plan","iteration":1}
{"timestamp":"2026-01-22T12:00:00+08:00","version":"1.1.0","agent":"ep","action":"update","change":"Added GitHub OAuth tasks","iteration":2}
{"timestamp":"2026-01-22T13:00:00+08:00","version":"1.0.0","agent":"cd","action":"create","change":"Started OAuth implementation","iteration":1}
```

## Usage

```bash
# 启动新循环
/parallel-dev-cycle TASK="Implement real-time notifications"

# 继续循环
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123

# 带扩展需求的迭代
/parallel-dev-cycle --cycle-id=cycle-v1-20260122-abc123 --extend="Also add email notifications"

# 自动模式
/parallel-dev-cycle --auto TASK="Add OAuth authentication"
```

## Key Benefits

✅ **简洁**: 每个 agent 只维护 1 个文件 + changes.log
✅ **高效**: 版本重写无需复杂版本标记
✅ **可查**: 完整历史在 `history/` 和 `changes.log`
✅ **快速**: Agent 读取当前版本快速（不需解析历史）
✅ **审计**: NDJSON changes.log 完整追溯每个变更

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/orchestrator.md](phases/orchestrator.md) | 协调器逻辑 |
| [phases/state-schema.md](phases/state-schema.md) | 状态结构 |
| [phases/agents/](phases/agents/) | 四个 agent 角色 |
| [specs/coordination-protocol.md](specs/coordination-protocol.md) | 通信协议 |
| [specs/versioning-strategy.md](specs/versioning-strategy.md) | 版本管理 |
