# Claude Code Hooks - 当前实现 vs 官方标准对比报告

## 执行摘要

当前 CCW 代码库中的钩子实现**不符合 Claude Code 官方标准**。存在以下主要问题：

1. ❌ **钩子事件名称不符合官方标准** - 使用了错误的事件名称
2. ❌ **配置结构不同** - 自定义了配置格式，不符合官方规范
3. ❌ **使用了不存在的事件类型** - 某些事件在官方钩子系统中不存在
4. ❌ **文档与实现不一致** - 代码中的注释引用的是自定义实现，而非官方标准

---

## 详细对比

### 1. 钩子事件名称对比

#### ❌ 当前实现（错误）

```json
{
  "hooks": {
    "session-start": [],           // ❌ 错误：应为 SessionStart
    "session-end": [],             // ❌ 错误：应为 SessionEnd
    "file-modified": [],           // ❌ 错误：官方不支持此事件
    "context-request": [],         // ❌ 错误：官方不支持此事件
    "PostToolUse": []              // ✅ 正确
  }
}
```

#### ✅ 官方标准（正确）

```json
{
  "hooks": {
    "SessionStart": [],            // ✅ 当会话开始或恢复时触发
    "UserPromptSubmit": [],        // ✅ 当用户提交提示词时触发
    "PreToolUse": [],              // ✅ 工具调用前触发，可以阻止
    "PermissionRequest": [],       // ✅ 权限对话出现时触发
    "PostToolUse": [],             // ✅ 工具调用成功后触发
    "PostToolUseFailure": [],      // ✅ 工具调用失败时触发
    "Notification": [],            // ✅ 通知发送时触发
    "SubagentStart": [],           // ✅ 子代理生成时触发
    "SubagentStop": [],            // ✅ 子代理完成时触发
    "Stop": [],                    // ✅ Claude 完成响应时触发
    "PreCompact": [],              // ✅ 上下文压缩前触发
    "SessionEnd": []               // ✅ 会话终止时触发
  }
}
```

### 2. 配置结构对比

#### ❌ 当前实现（自定义结构）

```json
{
  "hooks": {
    "session-start": [
      {
        "name": "Progressive Disclosure",
        "description": "Injects progressive disclosure index",
        "enabled": true,
        "handler": "internal:context",
        "timeout": 5000,
        "failMode": "silent"
      }
    ]
  },
  "hookSettings": {
    "globalTimeout": 60000,
    "defaultFailMode": "silent",
    "allowAsync": true,
    "enableLogging": true
  }
}
```

**问题：**
- 使用了非标准字段：`name`, `description`, `enabled`, `handler`, `failMode`
- 使用了自定义的 `hookSettings` 配置
- 结构过度复杂化

#### ✅ 官方标准（简洁标准）

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/script.sh",
            "timeout": 600,
            "async": false
          }
        ]
      }
    ]
  }
}
```

**优点：**
- 简洁明了的三层结构：事件 → 匹配器 → 处理器
- 标准的字段集：`type`, `command`, `timeout`, `async`
- 支持三种处理器类型：`command`, `prompt`, `agent`

### 3. 官方支持的钩子事件及其触发时机

| 事件名称 | 触发时机 | 可阻止 | 匹配器支持 |
|---------|---------|--------|-----------|
| `SessionStart` | 会话开始或恢复 | ❌ | startup, resume, clear, compact |
| `UserPromptSubmit` | 用户提交提示词前 | ✅ | ❌ |
| `PreToolUse` | 工具调用前 | ✅ | 工具名称 |
| `PermissionRequest` | 权限对话出现时 | ✅ | 工具名称 |
| `PostToolUse` | 工具调用成功后 | ❌ | 工具名称 |
| `PostToolUseFailure` | 工具调用失败时 | ❌ | 工具名称 |
| `Notification` | 通知发送时 | ❌ | 通知类型 |
| `SubagentStart` | 子代理生成时 | ❌ | 代理类型 |
| `SubagentStop` | 子代理完成时 | ✅ | 代理类型 |
| `Stop` | Claude 完成响应时 | ✅ | ❌ |
| `PreCompact` | 上下文压缩前 | ❌ | manual, auto |
| `SessionEnd` | 会话终止时 | ❌ | 终止原因 |

**当前实现不支持的事件：**
- ❌ `file-modified` - 官方系统中不存在
- ❌ `context-request` - 官方系统中不存在

### 4. 处理器类型对比

#### ❌ 当前实现

仅支持一种：`handler: "internal:context"`（自定义内部处理器）

#### ✅ 官方标准

支持三种标准类型：

1. **Command hooks** (`type: "command"`)
   ```json
   {
     "type": "command",
     "command": "bash /path/to/script.sh",
     "timeout": 600,
     "async": false
   }
   ```

2. **Prompt hooks** (`type: "prompt"`)
   ```json
   {
     "type": "prompt",
     "prompt": "Evaluate if this is safe to execute: $ARGUMENTS",
     "model": "haiku",
     "timeout": 30
   }
   ```

3. **Agent hooks** (`type: "agent"`)
   ```json
   {
     "type": "agent",
     "prompt": "Verify tests pass: $ARGUMENTS",
     "model": "haiku",
     "timeout": 60
   }
   ```

### 5. 匹配器对比

#### ❌ 当前实现

没有明确的匹配器概念，而是使用：
- `handler: "internal:context"` - 内部处理
- 没有工具级别的过滤

#### ✅ 官方标准

完整的匹配器系统：

```json
{
  "PreToolUse": [
    {
      "matcher": "Edit|Write",        // 仅在 Edit 或 Write 工具时触发
      "hooks": [ ... ]
    }
  ]
}
```

**支持的匹配器：**
- **工具事件**：`Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Task`, `WebFetch`, `WebSearch`
- **MCP工具**：`mcp__memory__.*`, `mcp__.*__write.*`
- **会话事件**：`startup`, `resume`, `clear`, `compact`
- **通知类型**：`permission_prompt`, `idle_prompt`, `auth_success`
- **代理类型**：`Bash`, `Explore`, `Plan`

### 6. 输入/输出机制对比

#### ❌ 当前实现

- 未定义标准的 stdin/stdout 通信协议
- 使用了自定义的环境变量：`$SESSION_ID`, `$FILE_PATH`, `$PROJECT_PATH`

#### ✅ 官方标准

**标准 JSON stdin 输入：**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/dir",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

**标准 exit code 输出：**
- **exit 0**: 成功，解析 stdout 的 JSON 决策
- **exit 2**: 阻止性错误，stderr 成为 Claude 的反馈
- **其他码**: 非阻止性错误，stderr 显示在详细模式

**标准 JSON stdout 输出：**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "explanation"
  }
}
```

### 7. 文件位置对比

#### 当前实现

示例配置文件位置：
- `ccw/src/templates/hooks-config-example.json`

#### ✅ 官方标准

标准配置位置（优先级顺序）：
1. `~/.claude/settings.json` - 全局用户配置
2. `.claude/settings.json` - 项目配置（可提交）
3. `.claude/settings.local.json` - 项目本地配置（gitignored）
4. 插件 `hooks/hooks.json` - 插件内部
5. Skill/Agent frontmatter - 技能或代理

---

## 代码库中的具体问题位置

### 1. 错误的配置示例

**文件:** `ccw/src/templates/hooks-config-example.json`

```json
{
  "hooks": {
    "session-start": [ ... ],      // ❌ 应为 SessionStart
    "session-end": [ ... ],        // ❌ 应为 SessionEnd
    "file-modified": [ ... ],      // ❌ 不存在的事件
    "context-request": [ ... ]     // ❌ 不存在的事件
  }
}
```

**应改为：**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Session started'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "prettier --write $FILE_PATH"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "clear",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Session ended'"
          }
        ]
      }
    ]
  }
}
```

### 2. 错误的命令注释

**文件:** `ccw/src/commands/hook.ts`

当前代码引用了自定义的钩子处理逻辑，但不符合官方标准。

---

## 修复建议

### 优先级 1：关键修复

- [ ] 更新 `hooks-config-example.json` 使用官方事件名称
- [ ] 更新配置结构以符合官方三层标准
- [ ] 移除不支持的事件类型：`file-modified`, `context-request`
- [ ] 文档化官方支持的事件列表

### 优先级 2：功能对齐

- [ ] 实现官方的标准 JSON stdin/stdout 通信
- [ ] 实现标准的 exit code 处理
- [ ] 支持标准的匹配器系统

### 优先级 3：增强

- [ ] 添加对 `prompt` 和 `agent` 处理器类型的支持
- [ ] 实现标准的异步钩子支持（`async: true`）
- [ ] 添加对环境变量持久化的支持（`CLAUDE_ENV_FILE`）

---

## 官方示例

### 例1：格式化代码后自动执行

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

### 例2：阻止编辑受保护文件

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ]
  }
}
```

### 例3：会话开始时重新注入上下文

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Use Bun, not npm. Run bun test before committing.'"
          }
        ]
      }
    ]
  }
}
```

### 例4：基于条件的权限决策

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Is this a safe command to run? $ARGUMENTS"
          }
        ]
      }
    ]
  }
}
```

---

## 参考资源

- 官方指南：https://code.claude.com/docs/en/hooks-guide
- 官方参考：https://code.claude.com/docs/en/hooks
- 官方示例：https://github.com/anthropics/claude-code/tree/main/examples/hooks

---

## 总结

当前 CCW 的钩子实现是基于自定义规范的，**完全不兼容** Claude Code 官方钩子系统。为了与官方标准对齐，需要进行彻底的重构，包括：

1. ✅ 采用官方的事件名称（已在 `.claude/docs/` 文件中提供）
2. ✅ 采用官方的三层配置结构
3. ✅ 实现官方的 JSON stdin/stdout 通信协议
4. ✅ 移除不存在的自定义事件
5. ✅ 支持官方的三种处理器类型

这样才能确保当用户将 CCW 的配置迁移到真实的 Claude Code CLI 时，能够正常工作。
