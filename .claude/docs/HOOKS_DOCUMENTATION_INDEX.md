# Claude Code Hooks - 文档索引

本目录包含 Claude Code 官方钩子系统的完整文档和分析报告。

---

## 📚 官方文档（已下载）

### 1. HOOKS_OFFICIAL_GUIDE.md
- **来源**: https://code.claude.com/docs/en/hooks-guide
- **内容**: 官方钩子指南，包含快速入门、常见用例、配置教程
- **适用**: 初次使用钩子系统的开发者

### 2. HOOKS_OFFICIAL_REFERENCE.md
- **来源**: https://code.claude.com/docs/en/hooks
- **内容**: 完整的技术参考，包含所有事件的 schema、输入输出格式、配置选项
- **适用**: 需要查阅具体事件参数和配置细节的开发者

### 3. HOOKS_QUICK_REFERENCE.md
- **内容**: 快速查阅指南，包含所有事件列表、配置模板、常见用例
- **适用**: 需要快速查找特定配置或事件信息的开发者

---

## 📊 分析报告

### 4. HOOKS_ANALYSIS_REPORT.md
- **内容**: 当前 CCW 钩子实现 vs 官方标准对比分析
- **包含**:
  - 当前实现存在的问题
  - 事件名称对比
  - 配置结构对比
  - 修复建议和优先级
- **适用**: 需要了解当前实现与官方标准差异的开发者

---

## 💻 示例代码

### 5. ../examples/hooks_bash_command_validator.py
- **来源**: https://github.com/anthropics/claude-code/blob/main/examples/hooks/bash_command_validator_example.py
- **内容**: 官方示例 - Bash 命令验证器
- **功能**: 拦截 Bash 命令，建议使用 ripgrep 替代 grep
- **适用**: 学习如何编写 PreToolUse 钩子的开发者

---

## 🎯 官方钩子事件列表

### 官方支持的 12 个钩子事件

| # | 事件名称 | 触发时机 | 可阻止 |
|---|---------|---------|--------|
| 1 | `SessionStart` | 会话开始或恢复 | ❌ |
| 2 | `UserPromptSubmit` | 用户提交提示词前 | ✅ |
| 3 | `PreToolUse` | 工具调用前 | ✅ |
| 4 | `PermissionRequest` | 权限对话出现时 | ✅ |
| 5 | `PostToolUse` | 工具调用成功后 | ❌ |
| 6 | `PostToolUseFailure` | 工具调用失败后 | ❌ |
| 7 | `Notification` | 通知发送时 | ❌ |
| 8 | `SubagentStart` | 子代理生成时 | ❌ |
| 9 | `SubagentStop` | 子代理完成时 | ✅ |
| 10 | `Stop` | Claude完成响应时 | ✅ |
| 11 | `PreCompact` | 上下文压缩前 | ❌ |
| 12 | `SessionEnd` | 会话终止时 | ❌ |

---

## ⚠️ 当前实现的主要问题

### 问题 1: 事件名称不符合官方标准

❌ **当前使用（错误）:**
```json
{
  "hooks": {
    "session-start": [],      // 错误
    "session-end": [],        // 错误
    "file-modified": [],      // 不存在
    "context-request": []     // 不存在
  }
}
```

✅ **官方标准（正确）:**
```json
{
  "hooks": {
    "SessionStart": [],       // 正确
    "SessionEnd": [],         // 正确
    "PostToolUse": [],        // 使用其他官方事件
    "PreToolUse": []          // 替代自定义事件
  }
}
```

### 问题 2: 配置结构不符合官方标准

❌ **当前结构（自定义）:**
```json
{
  "hooks": {
    "session-start": [
      {
        "name": "...",
        "enabled": true,
        "handler": "internal:context",
        "failMode": "silent"
      }
    ]
  }
}
```

✅ **官方结构（标准）:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "bash script.sh",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

---

## 🔗 外部资源

### 官方资源
- **官方指南**: https://code.claude.com/docs/en/hooks-guide
- **官方参考**: https://code.claude.com/docs/en/hooks
- **GitHub 示例**: https://github.com/anthropics/claude-code/tree/main/examples/hooks
- **配置博客**: https://claude.com/blog/how-to-configure-hooks

### 社区资源
- [Claude Code Hooks 从入门到实战 - 知乎](https://zhuanlan.zhihu.com/p/1969164730326324920)
- [GitHub: claude-code-best-practices](https://github.com/xiaobei930/claude-code-best-practices)
- [Claude Code power user customization](https://claude.com/blog/how-to-configure-hooks)

---

## 📖 推荐阅读顺序

### 对于初学者
1. `HOOKS_QUICK_REFERENCE.md` - 快速了解钩子概念
2. `HOOKS_OFFICIAL_GUIDE.md` - 学习如何配置和使用
3. `hooks_bash_command_validator.py` - 查看示例代码

### 对于开发者（修复当前实现）
1. `HOOKS_ANALYSIS_REPORT.md` - 了解问题和修复方案
2. `HOOKS_OFFICIAL_REFERENCE.md` - 查阅技术细节
3. `HOOKS_OFFICIAL_GUIDE.md` - 学习最佳实践

### 对于高级用户
1. `HOOKS_OFFICIAL_REFERENCE.md` - 完整技术参考
2. 官方 GitHub 仓库 - 更多示例
3. `HOOKS_QUICK_REFERENCE.md` - 快速查阅

---

## 🛠️ 快速开始

### 查看当前配置
```bash
# 在 Claude Code CLI 中
/hooks
```

### 创建第一个钩子（格式化代码）
`.claude/settings.json`:
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

### 调试钩子
```bash
claude --debug                  # 查看详细执行日志
```

在 CLI 中按 `Ctrl+O` 切换详细模式

---

## 📝 文档更新

- **创建时间**: 2026-02-01
- **官方文档版本**: 最新（截至 2026-02-01）
- **下次更新建议**: 当 Claude Code 发布新版本时

---

## 🔍 搜索关键词

钩子、Hooks、事件、Events、SessionStart、PreToolUse、PostToolUse、配置、Configuration、命令、Command、Prompt、Agent、阻止、Block、通知、Notification

---

**需要帮助？**

参考 `HOOKS_QUICK_REFERENCE.md` 获取快速答案，或查阅 `HOOKS_OFFICIAL_REFERENCE.md` 获取完整技术细节。
