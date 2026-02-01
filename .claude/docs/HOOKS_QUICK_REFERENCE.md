# Claude Code Hooks - 快速参考

## 12 个官方钩子事件

| # | 事件名称 | 触发时机 | 可阻止 | 匹配器 |
|---|---------|---------|--------|--------|
| 1 | `SessionStart` | 会话开始/恢复 | ❌ | startup, resume, clear, compact |
| 2 | `UserPromptSubmit` | 用户提交提示词前 | ✅ | ❌ 不支持 |
| 3 | `PreToolUse` | 工具调用前 | ✅ | 工具名称 |
| 4 | `PermissionRequest` | 权限对话时 | ✅ | 工具名称 |
| 5 | `PostToolUse` | 工具成功后 | ❌ | 工具名称 |
| 6 | `PostToolUseFailure` | 工具失败后 | ❌ | 工具名称 |
| 7 | `Notification` | 发送通知时 | ❌ | 通知类型 |
| 8 | `SubagentStart` | 子代理开始 | ❌ | 代理类型 |
| 9 | `SubagentStop` | 子代理完成 | ✅ | 代理类型 |
| 10 | `Stop` | Claude完成响应 | ✅ | ❌ 不支持 |
| 11 | `PreCompact` | 上下文压缩前 | ❌ | manual, auto |
| 12 | `SessionEnd` | 会话终止 | ❌ | 终止原因 |

---

## 配置模板

### 基础结构

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "pattern",
        "hooks": [
          {
            "type": "command|prompt|agent",
            "command": "...",
            "timeout": 600,
            "async": false
          }
        ]
      }
    ]
  }
}
```

---

## 工具名称（用于匹配器）

### 内置工具
```
Bash, Edit, Write, Read, Glob, Grep, Task, WebFetch, WebSearch
```

### MCP 工具
```
mcp__<server>__<tool>
mcp__memory__.*
mcp__.*__write.*
```

---

## Exit Codes

| Code | 含义 | Claude反馈 |
|------|------|-----------|
| 0 | 成功 | 解析 stdout JSON，允许操作 |
| 2 | 阻止 | stderr 发送给 Claude，阻止操作 |
| 其他 | 错误 | stderr 仅在详细模式显示 |

---

## 标准 JSON 输入（stdin）

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

---

## 标准 JSON 输出（stdout, exit 0）

### PreToolUse
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "explanation"
  }
}
```

### UserPromptSubmit
```json
{
  "decision": "block",
  "reason": "explanation",
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "context string"
  }
}
```

### Stop
```json
{
  "decision": "block",
  "reason": "Must complete tasks X, Y, Z"
}
```

---

## 处理器类型

### 1. Command Hook
```json
{
  "type": "command",
  "command": "bash /path/to/script.sh",
  "timeout": 600,
  "async": false
}
```

### 2. Prompt Hook
```json
{
  "type": "prompt",
  "prompt": "Evaluate: $ARGUMENTS",
  "model": "haiku",
  "timeout": 30
}
```

响应格式：
```json
{
  "ok": true|false,
  "reason": "explanation if ok is false"
}
```

### 3. Agent Hook
```json
{
  "type": "agent",
  "prompt": "Verify tests pass: $ARGUMENTS",
  "model": "haiku",
  "timeout": 60
}
```

响应格式：与 Prompt Hook 相同

---

## 环境变量

### 标准变量
```bash
$CLAUDE_PROJECT_DIR          # 项目根目录
$CLAUDE_PLUGIN_ROOT          # 插件根目录（插件内部使用）
$CLAUDE_CODE_REMOTE          # "true" 在远程环境
```

### SessionStart 特殊变量
```bash
$CLAUDE_ENV_FILE             # 持久化环境变量的文件路径
```

用法：
```bash
#!/bin/bash
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
fi
```

---

## 常见用例

### 1. 格式化代码
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs prettier --write"
          }
        ]
      }
    ]
  }
}
```

### 2. 阻止危险命令
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm.sh"
          }
        ]
      }
    ]
  }
}
```

脚本 `block-rm.sh`:
```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')
if echo "$COMMAND" | grep -q 'rm -rf'; then
  echo "Blocked: rm -rf is not allowed" >&2
  exit 2
fi
exit 0
```

### 3. 通知用户
```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude needs your attention\"'"
          }
        ]
      }
    ]
  }
}
```

### 4. 确认任务完成
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all tasks complete: $ARGUMENTS"
          }
        ]
      }
    ]
  }
}
```

### 5. 异步运行测试
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/run-tests.sh",
            "async": true,
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### 6. 会话开始注入上下文
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm'"
          }
        ]
      }
    ]
  }
}
```

---

## 配置位置

| 位置 | 作用域 | 可共享 |
|------|--------|--------|
| `~/.claude/settings.json` | 全局用户 | ❌ |
| `.claude/settings.json` | 单个项目 | ✅ |
| `.claude/settings.local.json` | 单个项目 | ❌ (gitignored) |
| 插件 `hooks/hooks.json` | 插件启用时 | ✅ |
| Skill/Agent frontmatter | 组件活动时 | ✅ |

---

## 调试技巧

### 1. 详细模式
```bash
claude --debug                  # 查看完整钩子执行细节
Ctrl+O                          # 切换详细模式（实时）
```

### 2. 测试钩子脚本
```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
echo $?  # 检查退出码
```

### 3. 检查钩子配置
```
/hooks                          # 交互式钩子管理器
```

---

## 最佳实践

✅ **推荐：**
- 总是引用 shell 变量：`"$VAR"`
- 使用绝对路径：`"$CLAUDE_PROJECT_DIR"/script.sh`
- 设置合理的超时时间
- 验证和清理输入数据
- 在 Stop 钩子中检查 `stop_hook_active`
- 使用 async 进行长时间运行的操作

❌ **避免：**
- 直接信任输入数据
- 使用相对路径
- 在钩子输出中暴露敏感数据
- 创建无限循环（尤其在 Stop 钩子）
- 没有设置超时的阻塞操作

---

## 官方资源

- **指南**: https://code.claude.com/docs/en/hooks-guide
- **参考**: https://code.claude.com/docs/en/hooks
- **示例**: https://github.com/anthropics/claude-code/tree/main/examples/hooks

---

## 本地文档

- `HOOKS_OFFICIAL_GUIDE.md` - 官方指南中文版
- `HOOKS_OFFICIAL_REFERENCE.md` - 官方参考中文版
- `HOOKS_ANALYSIS_REPORT.md` - 当前实现对比分析
- `hooks_bash_command_validator.py` - 官方示例脚本
