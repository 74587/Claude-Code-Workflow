---
name: replan
description: Interactive workflow replanning with session-level artifact updates and boundary clarification through guided questioning
argument-hint: "[--session session-id] [task-id] \"requirements\"|file.md [--interactive]"
allowed-tools: Read(*), Write(*), Edit(*), TodoWrite(*), Glob(*), Bash(*)
---

# Workflow Replan Command (/workflow:replan)

## Overview
Intelligently replans workflow sessions or individual tasks with interactive boundary clarification and comprehensive artifact updates.

**Dual Mode Design**:
- **Session Replan Mode**: Updates multiple session artifacts (IMPL_PLAN.md, TODO_LIST.md, task JSONs)
- **Task Replan Mode**: Focused task updates within session context

## Core Principles
**Task System**: @~/.claude/workflows/task-core.md
**Workflow Architecture**: @~/.claude/workflows/workflow-architecture.md

## Key Features
- **Interactive Clarification**: Guided questioning to define modification boundaries
- **Session-Aware**: Understands and updates all session artifacts
- **Impact Analysis**: Automatically detects affected files and dependencies
- **Comprehensive Updates**: Modifies IMPL_PLAN.md, TODO_LIST.md, task JSONs, session metadata
- **Backup Management**: Preserves previous versions of all modified files
- **Change Tracking**: Documents all modifications with rationale

## Operation Modes

### Mode 1: Session Replan (Default)

#### Auto-detect Active Session
```bash
/workflow:replan "添加双因素认证支持"
```
Automatically detects active session from `.workflow/active/`

#### Explicit Session
```bash
/workflow:replan --session WFS-oauth-integration "添加双因素认证支持"
```

#### File-based Input
```bash
/workflow:replan --session WFS-oauth requirements-update.md
```

#### Interactive Mode
```bash
/workflow:replan --session WFS-oauth --interactive
```
Fully guided step-by-step modification process

### Mode 2: Task Replan

#### Direct Task Update
```bash
/workflow:replan IMPL-1 "修改为使用 OAuth2.0 标准"
```
Auto-detects session from active sessions

#### Task with Session
```bash
/workflow:replan --session WFS-oauth IMPL-2 "增加单元测试覆盖率到 90%"
```

#### Task Interactive Mode
```bash
/workflow:replan IMPL-1 --interactive
```

## Execution Flow

### Phase 1: Mode Detection & Session Discovery

**Step 1.1: Detect Operation Mode**
```bash
# Check if task ID provided (IMPL-N or IMPL-N.M format)
if [[ "$1" =~ ^IMPL-[0-9]+(\.[0-9]+)?$ ]]; then
  MODE="task"
  TASK_ID="$1"
else
  MODE="session"
fi
```

**Step 1.2: Discover/Validate Session**
```bash
# If --session provided, use it
# Otherwise, auto-detect active session
active_session=$(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | head -1)

# Validate session exists
if [ ! -d ".workflow/active/$SESSION_ID" ]; then
  echo "ERROR: Session $SESSION_ID not found"
  exit 1
fi
```

**Step 1.3: Load Session Context**
```bash
# Read session metadata
Read(file_path=".workflow/active/$SESSION_ID/workflow-session.json")

# List existing tasks
Glob(pattern=".workflow/active/$SESSION_ID/.task/IMPL-*.json")

# Read planning document
Read(file_path=".workflow/active/$SESSION_ID/IMPL_PLAN.md")
```

**Output**: Session validated, context loaded, mode determined

---

### Phase 2: Interactive Requirement Clarification

**Purpose**: Use guided questioning to precisely define modification scope and boundaries

#### Session Mode Clarification

**Question 1: Modification Scope**
```javascript
AskUserQuestion({
  questions: [{
    question: "修改范围是什么?",
    header: "Scope",
    options: [
      {
        label: "仅更新任务细节",
        value: "tasks_only",
        description: "只修改现有任务的实现细节,不改变整体规划"
      },
      {
        label: "修改规划方案",
        value: "plan_update",
        description: "需要更新 IMPL_PLAN.md 中的技术方案或架构设计"
      },
      {
        label: "重构任务结构",
        value: "task_restructure",
        description: "需要添加、删除或重组任务,更新 TODO_LIST.md"
      },
      {
        label: "全面重规划",
        value: "comprehensive",
        description: "大幅修改需求,需要更新所有规划文档和任务"
      }
    ],
    multiSelect: false
  }]
})
```

**Question 2: Affected Modules** (if scope >= plan_update)
```javascript
AskUserQuestion({
  questions: [{
    question: "哪些功能模块会受到影响?",
    header: "Modules",
    options: [
      // Dynamically generated from existing tasks' focus_paths
      { label: "认证模块 (src/auth)", value: "auth" },
      { label: "用户管理 (src/user)", value: "user" },
      { label: "API 接口 (src/api)", value: "api" },
      { label: "全部模块", value: "all" }
    ],
    multiSelect: true
  }]
})
```

**Question 3: Task Changes** (if scope >= task_restructure)
```javascript
AskUserQuestion({
  questions: [{
    question: "任务变更类型?",
    header: "Task Changes",
    options: [
      { label: "添加新任务", value: "add", description: "创建新的 IMPL-*.json 任务" },
      { label: "删除现有任务", value: "remove", description: "移除不需要的任务" },
      { label: "合并任务", value: "merge", description: "将多个任务合并为一个" },
      { label: "拆分任务", value: "split", description: "将一个任务拆分为多个子任务" },
      { label: "仅更新内容", value: "update", description: "保持任务结构,只修改内容" }
    ],
    multiSelect: true
  }]
})
```

**Question 4: Dependency Changes** (if task changes detected)
```javascript
AskUserQuestion({
  questions: [{
    question: "是否需要更新任务依赖关系?",
    header: "Dependencies",
    options: [
      { label: "是,需要重新梳理依赖", value: "yes" },
      { label: "否,保持现有依赖", value: "no" }
    ],
    multiSelect: false
  }]
})
```

#### Task Mode Clarification

**Question 1: Update Type**
```javascript
AskUserQuestion({
  questions: [{
    question: "需要更新任务的哪些部分?",
    header: "Update Type",
    options: [
      { label: "需求和验收标准 (requirements & acceptance)", value: "requirements" },
      { label: "实现方案 (implementation_approach)", value: "implementation" },
      { label: "文件范围 (focus_paths)", value: "paths" },
      { label: "依赖关系 (depends_on)", value: "dependencies" },
      { label: "全部更新", value: "all" }
    ],
    multiSelect: true
  }]
})
```

**Question 2: Ripple Effect**
```javascript
AskUserQuestion({
  questions: [{
    question: "此修改是否影响其他任务?",
    header: "Impact",
    options: [
      { label: "是,需要同步更新依赖任务", value: "yes" },
      { label: "否,仅影响当前任务", value: "no" },
      { label: "不确定,请帮我分析", value: "analyze" }
    ],
    multiSelect: false
  }]
})
```

**Output**:
- User selections stored in clarification context
- Modification boundaries clearly defined
- Impact scope determined

---

### Phase 3: Impact Analysis & Planning

**Step 3.1: Analyze Required Changes**

Based on clarification responses, determine affected files:

```typescript
interface ImpactAnalysis {
  affected_files: {
    impl_plan: boolean;           // IMPL_PLAN.md needs update
    todo_list: boolean;           // TODO_LIST.md needs update
    session_meta: boolean;        // workflow-session.json needs update
    tasks: string[];              // Array of task IDs (IMPL-*.json)
  };

  operations: {
    type: 'create' | 'update' | 'delete' | 'merge' | 'split';
    target: string;               // File path or task ID
    reason: string;               // Why this change is needed
  }[];

  backup_strategy: {
    timestamp: string;            // ISO timestamp for backup folder
    files: string[];              // All files to backup
  };
}
```

**Step 3.2: Generate Modification Plan**

```markdown
## 修改计划

### 影响范围
- [ ] IMPL_PLAN.md: 更新技术方案第 3 节
- [ ] TODO_LIST.md: 添加 2 个新任务,删除 1 个废弃任务
- [ ] IMPL-001.json: 更新实现方案
- [ ] IMPL-002.json: 添加依赖关系
- [ ] workflow-session.json: 更新任务计数

### 变更操作
1. **创建**: IMPL-004.json (双因素认证实现)
2. **更新**: IMPL-001.json (添加 2FA 准备工作)
3. **删除**: IMPL-003.json (已被新方案替代)

### 备份策略
备份到: .workflow/active/WFS-oauth/.process/backup/replan-2025-11-20T10-30-00/
```

**Step 3.3: User Confirmation**

```javascript
AskUserQuestion({
  questions: [{
    question: "确认执行上述修改计划?",
    header: "Confirm",
    options: [
      { label: "确认执行", value: "confirm", description: "开始应用所有修改" },
      { label: "调整计划", value: "adjust", description: "重新回答问题调整范围" },
      { label: "取消操作", value: "cancel", description: "放弃本次重规划" }
    ],
    multiSelect: false
  }]
})
```

**Output**: Modification plan confirmed or adjusted

---

### Phase 4: Backup Creation

**Step 4.1: Create Backup Directory**
```bash
timestamp=$(date -u +"%Y-%m-%dT%H-%M-%S")
backup_dir=".workflow/active/$SESSION_ID/.process/backup/replan-$timestamp"
mkdir -p "$backup_dir"
```

**Step 4.2: Backup All Affected Files**
```bash
# Backup planning documents
if [ -f ".workflow/active/$SESSION_ID/IMPL_PLAN.md" ]; then
  cp ".workflow/active/$SESSION_ID/IMPL_PLAN.md" "$backup_dir/"
fi

if [ -f ".workflow/active/$SESSION_ID/TODO_LIST.md" ]; then
  cp ".workflow/active/$SESSION_ID/TODO_LIST.md" "$backup_dir/"
fi

# Backup session metadata
cp ".workflow/active/$SESSION_ID/workflow-session.json" "$backup_dir/"

# Backup affected task JSONs
for task_id in "${affected_tasks[@]}"; do
  cp ".workflow/active/$SESSION_ID/.task/$task_id.json" "$backup_dir/"
done
```

**Step 4.3: Create Backup Manifest**
```bash
cat > "$backup_dir/MANIFEST.md" <<EOF
# Replan Backup Manifest

**Timestamp**: $timestamp
**Reason**: $replan_reason
**Scope**: $modification_scope

## Backed Up Files
$(ls -1 "$backup_dir" | grep -v MANIFEST.md)

## Restoration Command
\`\`\`bash
# To restore from this backup:
cp $backup_dir/* .workflow/active/$SESSION_ID/
\`\`\`
EOF
```

**Output**: All files safely backed up with manifest

---

### Phase 5: Apply Modifications

**Step 5.1: Update IMPL_PLAN.md** (if needed)

```typescript
// Identify sections to update based on affected modules
// Use Edit tool to modify specific sections

Edit({
  file_path: `.workflow/active/${SESSION_ID}/IMPL_PLAN.md`,
  old_string: "### 3.2 认证流程\n\n当前使用简单密码认证...",
  new_string: "### 3.2 认证流程\n\n采用双因素认证 (2FA):\n1. 用户名密码验证\n2. TOTP 令牌验证\n3. 会话令牌颁发..."
})

// Update modification date
Edit({
  file_path: `.workflow/active/${SESSION_ID}/IMPL_PLAN.md`,
  old_string: "**Last Modified**: 2025-11-15",
  new_string: "**Last Modified**: 2025-11-20"
})
```

**Step 5.2: Update TODO_LIST.md** (if needed)

```typescript
// Add new tasks
Edit({
  file_path: `.workflow/active/${SESSION_ID}/TODO_LIST.md`,
  old_string: "- [ ] IMPL-003: 实现用户登录",
  new_string: `- [ ] IMPL-003: 实现用户登录
- [ ] IMPL-004: 实现 TOTP 双因素认证`
})

// Mark deleted tasks as obsolete
Edit({
  file_path: `.workflow/active/${SESSION_ID}/TODO_LIST.md`,
  old_string: "- [ ] IMPL-005: 简单密码重置",
  new_string: "- [x] ~~IMPL-005: 简单密码重置~~ (已废弃,替换为 IMPL-004)"
})
```

**Step 5.3: Update Task JSONs**

For each affected task:

```typescript
// Read current task
const task = Read(`.workflow/active/${SESSION_ID}/.task/${task_id}.json`);

// Parse and modify
const updated_task = {
  ...task,
  context: {
    ...task.context,
    requirements: [
      ...task.context.requirements,
      "支持 TOTP 双因素认证"
    ],
    acceptance: [
      ...task.context.acceptance,
      "2FA 验证流程通过测试"
    ]
  },
  flow_control: {
    ...task.flow_control,
    implementation_approach: [
      {
        step: 1,
        title: "集成 TOTP 库",
        description: "添加 speakeasy 库用于生成和验证 TOTP 令牌",
        modification_points: [
          "安装 speakeasy npm 包",
          "创建 TOTP 工具函数"
        ],
        logic_flow: [
          "用户启用 2FA → 生成密钥",
          "生成 QR 码供用户扫描",
          "存储加密的 2FA 密钥"
        ],
        depends_on: [],
        output: "totp_setup"
      },
      // ... more steps
    ]
  }
};

// Write back
Write({
  file_path: `.workflow/active/${SESSION_ID}/.task/${task_id}.json`,
  content: JSON.stringify(updated_task, null, 2)
});
```

**Step 5.4: Create New Tasks** (if needed)

```typescript
const new_task = {
  id: "IMPL-004",
  title: "实现 TOTP 双因素认证",
  status: "pending",

  meta: {
    type: "feature",
    agent: "@code-developer"
  },

  context: {
    requirements: [
      "支持 TOTP 双因素认证",
      "用户可启用/禁用 2FA",
      "提供备用恢复码"
    ],
    focus_paths: ["src/auth/2fa", "src/utils/totp", "tests/auth"],
    acceptance: [
      "用户可以成功启用 2FA",
      "TOTP 验证码正确验证",
      "备用恢复码可以使用"
    ],
    depends_on: ["IMPL-001"]
  },

  flow_control: {
    pre_analysis: [],
    implementation_approach: [
      // ... implementation steps
    ],
    target_files: [
      "src/auth/2fa/totp.ts",
      "src/auth/2fa/recovery.ts",
      "tests/auth/2fa.test.ts"
    ]
  }
};

Write({
  file_path: `.workflow/active/${SESSION_ID}/.task/IMPL-004.json`,
  content: JSON.stringify(new_task, null, 2)
});
```

**Step 5.5: Delete Obsolete Tasks** (if needed)

```bash
# Move to backup instead of hard delete
mv ".workflow/active/$SESSION_ID/.task/IMPL-003.json" "$backup_dir/"
```

**Step 5.6: Update Session Metadata**

```typescript
const session = Read(`.workflow/active/${SESSION_ID}/workflow-session.json`);

const updated_session = {
  ...session,
  progress: {
    ...session.progress,
    current_tasks: ["IMPL-001", "IMPL-002", "IMPL-004"], // Updated list
    last_replan: new Date().toISOString(),
    replan_history: [
      ...(session.replan_history || []),
      {
        timestamp: new Date().toISOString(),
        reason: replan_reason,
        scope: modification_scope,
        backup_location: backup_dir,
        changes: {
          added_tasks: ["IMPL-004"],
          removed_tasks: ["IMPL-003"],
          updated_tasks: ["IMPL-001", "IMPL-002"]
        }
      }
    ]
  }
};

Write({
  file_path: `.workflow/active/${SESSION_ID}/workflow-session.json`,
  content: JSON.stringify(updated_session, null, 2)
});
```

**Output**: All modifications applied, artifacts updated

---

### Phase 6: Verification & Summary

**Step 6.1: Verify Consistency**

```bash
# Verify all task JSONs are valid
for task_file in .workflow/active/$SESSION_ID/.task/IMPL-*.json; do
  if ! jq empty "$task_file" 2>/dev/null; then
    echo "ERROR: Invalid JSON in $task_file"
    exit 1
  fi
done

# Verify task count within limits (max 10)
task_count=$(ls .workflow/active/$SESSION_ID/.task/IMPL-*.json | wc -l)
if [ "$task_count" -gt 10 ]; then
  echo "WARNING: Task count ($task_count) exceeds recommended limit of 10"
fi

# Verify dependency graph is acyclic
# (Check no circular dependencies)
```

**Step 6.2: Generate Change Summary**

```markdown
## 重规划完成

### 会话信息
- **Session**: WFS-oauth-integration
- **时间**: 2025-11-20 10:30:00 UTC
- **备份**: .workflow/active/WFS-oauth/.process/backup/replan-2025-11-20T10-30-00/

### 变更摘要
**范围**: 全面重规划 (comprehensive)
**原因**: 添加双因素认证支持

### 修改的文件
- ✓ IMPL_PLAN.md: 更新了第 3 节认证方案
- ✓ TODO_LIST.md: 添加 1 个任务,删除 1 个任务
- ✓ IMPL-001.json: 更新实现方案
- ✓ IMPL-002.json: 添加 2FA 相关依赖
- ✓ IMPL-004.json: 新建双因素认证任务
- ✓ workflow-session.json: 更新任务列表和历史记录

### 任务变更
- **新增**: IMPL-004 (实现 TOTP 双因素认证)
- **删除**: IMPL-003 (简单密码重置 - 已废弃)
- **更新**: IMPL-001, IMPL-002

### 下一步建议
1. 运行 `/workflow:action-plan-verify --session WFS-oauth` 验证规划质量
2. 运行 `/workflow:status` 查看更新后的任务列表
3. 运行 `/workflow:execute` 开始执行新规划

### 回滚方法
如需回滚到重规划前的状态:
\`\`\`bash
cp .workflow/active/WFS-oauth/.process/backup/replan-2025-11-20T10-30-00/* .workflow/active/WFS-oauth/
\`\`\`
```

**Output**: Summary displayed to user, replan complete

---

## TodoWrite Progress Tracking

### Session Mode Progress

```json
[
  {"content": "检测模式和发现会话", "status": "completed", "activeForm": "检测模式和发现会话"},
  {"content": "交互式需求明确", "status": "completed", "activeForm": "交互式需求明确"},
  {"content": "影响分析和计划生成", "status": "completed", "activeForm": "影响分析和计划生成"},
  {"content": "创建备份", "status": "completed", "activeForm": "创建备份"},
  {"content": "更新 IMPL_PLAN.md", "status": "completed", "activeForm": "更新 IMPL_PLAN.md"},
  {"content": "更新 TODO_LIST.md", "status": "completed", "activeForm": "更新 TODO_LIST.md"},
  {"content": "更新 3 个任务 JSON 文件", "status": "completed", "activeForm": "更新任务 JSON 文件"},
  {"content": "更新会话元数据", "status": "completed", "activeForm": "更新会话元数据"},
  {"content": "验证一致性", "status": "completed", "activeForm": "验证一致性"}
]
```

### Task Mode Progress

```json
[
  {"content": "检测会话和加载任务", "status": "completed", "activeForm": "检测会话和加载任务"},
  {"content": "交互式更新类型确认", "status": "completed", "activeForm": "交互式更新类型确认"},
  {"content": "分析影响范围", "status": "completed", "activeForm": "分析影响范围"},
  {"content": "创建备份", "status": "completed", "activeForm": "创建备份"},
  {"content": "更新 IMPL-001.json", "status": "completed", "activeForm": "更新 IMPL-001.json"},
  {"content": "更新会话元数据", "status": "completed", "activeForm": "更新会话元数据"}
]
```

## Error Handling

### Session Errors
```bash
# No active session found
ERROR: No active session found
Run /workflow:session:start to create a session

# Session not found
ERROR: Session WFS-invalid not found
Available sessions:
  - WFS-oauth-integration
  - WFS-user-profile

# No changes detected
WARNING: No modifications specified
Please provide requirements or use --interactive mode
```

### Task Errors
```bash
# Task not found
ERROR: Task IMPL-999 not found in session WFS-oauth
Available tasks: IMPL-001, IMPL-002, IMPL-003

# Task already completed
WARNING: Task IMPL-001 is completed
Consider creating a new task for additional work

# Circular dependency detected
ERROR: Circular dependency detected: IMPL-001 → IMPL-002 → IMPL-001
Please resolve dependency conflicts
```

### Validation Errors
```bash
# Task limit exceeded
ERROR: Replan would create 12 tasks (limit: 10)
Consider:
  1. Combining related tasks
  2. Splitting into multiple sessions
  3. Removing unnecessary tasks

# Invalid JSON generated
ERROR: Generated invalid JSON for IMPL-004
Backup preserved at: [backup_path]
Rolling back changes...
```

## Examples

### Example 1: Session Replan - Add Feature

```bash
/workflow:replan "添加双因素认证支持"

# Interactive clarification
Q: 修改范围是什么?
A: 全面重规划 (comprehensive)

Q: 哪些功能模块会受到影响?
A: [✓] 认证模块 (src/auth)
   [✓] API 接口 (src/api)

Q: 任务变更类型?
A: [✓] 添加新任务
   [✓] 仅更新内容

Q: 是否需要更新任务依赖关系?
A: 是,需要重新梳理依赖

# Modification plan shown...
# User confirms...

# Execution
✓ 创建备份
✓ 更新 IMPL_PLAN.md
✓ 更新 TODO_LIST.md
✓ 创建 IMPL-004.json
✓ 更新 IMPL-001.json, IMPL-002.json
✓ 更新 workflow-session.json

# Summary displayed
重规划完成!
新增 1 个任务,更新 2 个任务
备份位置: .workflow/active/WFS-oauth/.process/backup/replan-2025-11-20T10-30-00/
```

### Example 2: Task Replan - Update Requirements

```bash
/workflow:replan IMPL-001 "需要支持 OAuth2.0 标准,而不是自定义认证"

# Interactive clarification
Q: 需要更新任务的哪些部分?
A: [✓] 需求和验收标准 (requirements & acceptance)
   [✓] 实现方案 (implementation_approach)

Q: 此修改是否影响其他任务?
A: 是,需要同步更新依赖任务

# Impact analysis
分析发现以下任务受影响:
- IMPL-002 (依赖 IMPL-001 的认证结果)
- IMPL-003 (使用相同的认证接口)

# Modification plan
将更新:
- IMPL-001.json: 需求和实现方案
- IMPL-002.json: 依赖说明
- IMPL-003.json: 接口调用方式

# User confirms...

✓ 创建备份
✓ 更新 IMPL-001.json
✓ 更新 IMPL-002.json
✓ 更新 IMPL-003.json
✓ 更新 workflow-session.json

任务重规划完成!
更新了 3 个任务文件
```

### Example 3: Interactive Session Replan

```bash
/workflow:replan --interactive

# Step-by-step guided process
Q: 选择活动会话?
A: WFS-oauth-integration

Q: 你想要修改什么?
A: [text input] "需要添加 API 速率限制功能"

Q: 修改范围是什么?
A: 修改规划方案 (plan_update)

Q: 哪些功能模块会受到影响?
A: [✓] API 接口 (src/api)

Q: 任务变更类型?
A: [✓] 添加新任务

Q: 是否需要更新任务依赖关系?
A: 否,保持现有依赖

# Rest of the flow continues...
```

## Related Commands

**Prerequisites**:
- `/workflow:session:start` - Create or discover session before replanning
- `/workflow:plan` - Initial planning that creates session artifacts

**Related Operations**:
- `/workflow:action-plan-verify` - Verify replan quality after making changes
- `/workflow:status` - Review updated task breakdown
- `/task:replan` - Legacy command for project-level task replanning (deprecated)

**Follow-up Commands**:
- `/workflow:execute` - Execute updated plan
- `/workflow:review` - Review changes after implementation

## Migration from task:replan

### Key Differences

| Aspect | task:replan (Old) | workflow:replan (New) |
|--------|-------------------|------------------------|
| Scope | Single task or batch | Session-level or task-level |
| Context | Project-level (.task/) | Session-level (.workflow/active/) |
| Artifacts | Only task JSON | IMPL_PLAN.md, TODO_LIST.md, task JSONs, session metadata |
| Interaction | Minimal | Interactive boundary clarification |
| Backup | .task/backup/ | Session-specific .process/backup/ |

### Migration Guide

**Old command**:
```bash
/task:replan IMPL-1 "Add OAuth2 support"
```

**New command**:
```bash
/workflow:replan IMPL-1 "Add OAuth2 support"
```

**Batch mode** (old):
```bash
/task:replan --batch verification-report.md
```

**New approach** (use action-plan-verify + workflow:replan):
```bash
/workflow:action-plan-verify --session WFS-oauth
# Review recommendations, then:
/workflow:replan --session WFS-oauth "Apply verification recommendations"
```

## Implementation Notes

### File Structure Assumptions

```
.workflow/active/WFS-session-name/
├── workflow-session.json          # Session metadata
├── IMPL_PLAN.md                   # Planning document
├── TODO_LIST.md                   # Task checklist
├── .task/
│   ├── IMPL-001.json              # Task definitions
│   ├── IMPL-002.json
│   └── IMPL-003.json
└── .process/
    ├── context-package.json       # Context from planning
    └── backup/
        └── replan-2025-11-20T10-30-00/
            ├── MANIFEST.md
            ├── IMPL_PLAN.md
            ├── TODO_LIST.md
            ├── workflow-session.json
            └── IMPL-*.json
```

### Interactive Question Design Principles

1. **Progressive Disclosure**: Start broad, get specific based on answers
2. **Context-Aware Options**: Dynamically generate options from session data
3. **Clear Descriptions**: Each option explains what will happen
4. **Escape Hatches**: Always provide "cancel" or "adjust" options
5. **Validation**: Confirm plan before executing destructive operations

### Change Tracking Strategy

All modifications are tracked in:
1. **Session metadata**: `workflow-session.json` replan_history array
2. **Backup manifest**: MANIFEST.md in backup folder
3. **Git commits**: Encourage users to commit after replanning
