# Autonomous Action Template

自主模式动作文件的模板。

## Purpose

生成 Autonomous 执行模式的 Action 文件，定义可独立执行的动作单元。

## Usage Context

| Phase | Usage |
|-------|-------|
| Phase 3 (Phase Generation) | `config.execution_mode === 'autonomous'` 时生成 |
| Generation Trigger | 为每个 `config.autonomous_config.actions` 生成一个 action 文件 |
| Output Location | `.claude/skills/{skill-name}/phases/actions/{action-id}.md` |

---

## 模板结构

```markdown
# Action: {{action_name}}

{{action_description}}

## Purpose

{{purpose}}

## Preconditions

{{preconditions_list}}

## Scripts

\`\`\`yaml
# 声明本动作使用的脚本（可选）
# - script-id        # 对应 scripts/script-id.py 或 .sh
\`\`\`

## Execution

\`\`\`javascript
async function execute(state) {
  {{execution_code}}

  // 调用脚本示例
  // const result = await ExecuteScript('script-id', { input: state.context.data });
  // if (!result.success) throw new Error(result.stderr);
}
\`\`\`

## State Updates

\`\`\`javascript
return {
  stateUpdates: {
    {{state_updates}}
  }
};
\`\`\`

## Error Handling

| Error Type | Recovery |
|------------|----------|
{{error_handling_table}}

## Next Actions (Hints)

{{next_actions_hints}}
```

## 变量说明

| 变量 | 说明 |
|------|------|
| `{{action_name}}` | 动作名称 |
| `{{action_description}}` | 动作描述 |
| `{{purpose}}` | 详细目的 |
| `{{preconditions_list}}` | 前置条件列表 |
| `{{execution_code}}` | 执行代码 |
| `{{state_updates}}` | 状态更新 |
| `{{error_handling_table}}` | 错误处理表格 |
| `{{next_actions_hints}}` | 后续动作提示 |

## 动作生命周期

```
状态驱动执行流:

  state.status === 'pending'
       ↓
  ┌─ Init ─┐          ← 1次执行，环境准备
  │ 创建工作目录        │
  │ 初始化 context     │
  │ status → running   │
  └────┬────┘
       ↓
  ┌─ CRUD Loop ─┐     ← N次迭代，核心业务
  │ 编排器选择动作  │    List / Create / Edit / Delete
  │ execute(state)  │    共享模式: 收集输入 → 操作 context.items → 返回更新
  │ 更新 state      │
  └────┬────┘
       ↓
  ┌─ Complete ─┐      ← 1次执行，保存结果
  │ 序列化输出    │
  │ status → completed │
  └──────────┘

共享状态结构:
  state.status          → 'pending' | 'running' | 'completed'
  state.context.items   → 业务数据数组
  state.completed_actions → 已执行动作 ID 列表
```

## 动作类型模板

### 1. 初始化动作 (Init)

**触发条件**: `state.status === 'pending'`，仅执行一次

```markdown
# Action: Initialize

初始化 Skill 执行状态。

## Purpose

设置初始状态，准备执行环境。

## Preconditions

- [ ] state.status === 'pending'

## Execution

\`\`\`javascript
async function execute(state) {
  Bash(\`mkdir -p "\${workDir}"\`);

  return {
    stateUpdates: {
      status: 'running',
      started_at: new Date().toISOString(),
      context: { items: [], metadata: {} }
    }
  };
}
\`\`\`

## Next Actions

- 成功: 进入主处理循环 (由编排器选择首个 CRUD 动作)
- 失败: action-abort
```

### 2. CRUD 动作 (List / Create / Edit / Delete)

**触发条件**: `state.status === 'running'`，循环执行直至用户退出

> 以 Create 为示例展示共享模式。List / Edit / Delete 遵循同一结构，仅 `执行逻辑` 和 `状态更新字段` 不同。

```markdown
# Action: Create Item

创建新项目。

## Purpose

收集用户输入，向 context.items 追加新记录。

## Preconditions

- [ ] state.status === 'running'

## Execution

\`\`\`javascript
async function execute(state) {
  // 1. 收集输入
  const input = await AskUserQuestion({
    questions: [{
      question: "请输入项目名称：",
      header: "名称",
      multiSelect: false,
      options: [{ label: "手动输入", description: "输入自定义名称" }]
    }]
  });

  // 2. 操作 context.items (核心逻辑因动作类型而异)
  const newItem = {
    id: Date.now().toString(),
    name: input["名称"],
    status: 'pending',
    created_at: new Date().toISOString()
  };

  // 3. 返回状态更新
  return {
    stateUpdates: {
      context: {
        ...state.context,
        items: [...(state.context.items || []), newItem]
      },
      last_action: 'create'
    }
  };
}
\`\`\`

## Next Actions

- 继续操作: 编排器根据 state 选择下一动作
- 用户退出: action-complete
```

**其他 CRUD 动作差异对照:**

| 动作 | 核心逻辑 | 额外前置条件 | 关键状态字段 |
|------|---------|------------|------------|
| List | `items.forEach(→ console.log)` | 无 | `current_view: 'list'` |
| Create | `items.push(newItem)` | 无 | `last_created_id` |
| Edit | `items.map(→ 替换匹配项)` | `selected_item_id !== null` | `updated_at` |
| Delete | `items.filter(→ 排除匹配项)` | `selected_item_id !== null` | 确认对话 → 执行 |

### 3. 完成动作 (Complete)

**触发条件**: 用户明确退出或终止条件满足，仅执行一次

```markdown
# Action: Complete

完成任务并退出。

## Purpose

序列化最终状态，结束 Skill 执行。

## Preconditions

- [ ] state.status === 'running'

## Execution

\`\`\`javascript
async function execute(state) {
  Write(\`\${workDir}/final-output.json\`, JSON.stringify(state.context, null, 2));

  const summary = {
    total_items: state.context.items?.length || 0,
    duration: Date.now() - new Date(state.started_at).getTime(),
    actions_executed: state.completed_actions.length
  };

  console.log(\`任务完成: \${summary.total_items} 项, \${summary.actions_executed} 次操作\`);

  return {
    stateUpdates: {
      status: 'completed',
      completed_at: new Date().toISOString(),
      summary
    }
  };
}
\`\`\`

## Next Actions

- 无（终止状态）
```

## 生成函数

```javascript
function generateAction(actionConfig, skillConfig) {
  return `# Action: ${actionConfig.name}

${actionConfig.description || `执行 ${actionConfig.name} 操作`}

## Purpose

${actionConfig.purpose || 'TODO: 描述此动作的详细目的'}

## Preconditions

${actionConfig.preconditions?.map(p => `- [ ] ${p}`).join('\n') || '- [ ] 无特殊前置条件'}

## Execution

\`\`\`javascript
async function execute(state) {
  // TODO: 实现动作逻辑
  
  return {
    stateUpdates: {
      completed_actions: [...state.completed_actions, '${actionConfig.id}']
    }
  };
}
\`\`\`

## State Updates

\`\`\`javascript
return {
  stateUpdates: {
    // TODO: 定义状态更新
${actionConfig.effects?.map(e => `    // Effect: ${e}`).join('\n') || ''}
  }
};
\`\`\`

## Error Handling

| Error Type | Recovery |
|------------|----------|
| 数据验证失败 | 返回错误，不更新状态 |
| 执行异常 | 记录错误，增加 error_count |

## Next Actions (Hints)

- 成功: 由编排器根据状态决定
- 失败: 重试或 action-abort
`;
}
```
