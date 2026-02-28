# 高级技巧

## 一句话定位

**高级技巧是提升效率的关键** — CLI 工具链深度使用、多模型协作优化、记忆管理最佳实践。

---

## 5.1 CLI 工具链使用

### 5.1.1 CLI 配置

CLI 工具配置文件：`~/.claude/cli-tools.json`

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["分析", "Debug"],
      "type": "builtin"
    },
    "qwen": {
      "enabled": true,
      "primaryModel": "coder-model",
      "secondaryModel": "coder-model",
      "tags": [],
      "type": "builtin"
    },
    "codex": {
      "enabled": true,
      "primaryModel": "gpt-5.2",
      "secondaryModel": "gpt-5.2",
      "tags": [],
      "type": "builtin"
    }
  }
}
```

### 5.1.2 标签路由

根据任务类型自动选择模型：

| 标签 | 适用模型 | 任务类型 |
| --- | --- | --- |
| **分析** | Gemini | 代码分析、架构设计 |
| **Debug** | Gemini | 根因分析、问题诊断 |
| **实现** | Qwen | 功能开发、代码生成 |
| **审查** | Codex | 代码审查、Git 操作 |

### 5.1.3 CLI 命令模板

#### 分析任务

```bash
ccw cli -p "PURPOSE: 识别安全漏洞
TASK: • 扫描 SQL 注入 • 检查 XSS • 验证 CSRF
MODE: analysis
CONTEXT: @src/auth/**/*
EXPECTED: 安全报告，含严重性分级和修复建议
CONSTRAINTS: 聚焦认证模块" --tool gemini --mode analysis --rule analysis-assess-security-risks
```

#### 实现任务

```bash
ccw cli -p "PURPOSE: 实现速率限制
TASK: • 创建中间件 • 配置路由 • Redis 后端
MODE: write
CONTEXT: @src/middleware/**/* @src/config/**/*
EXPECTED: 生产代码 + 单元测试 + 集成测试
CONSTRAINTS: 遵循现有中间件模式" --tool qwen --mode write --rule development-implement-feature
```

### 5.1.4 规则模板

| 规则 | 用途 |
| --- | --- |
| **analysis-diagnose-bug-root-cause** | Bug 根因分析 |
| **analysis-analyze-code-patterns** | 代码模式分析 |
| **analysis-review-architecture** | 架构审查 |
| **analysis-assess-security-risks** | 安全评估 |
| **development-implement-feature** | 功能实现 |
| **development-refactor-codebase** | 代码重构 |
| **development-generate-tests** | 测试生成 |

---

## 5.2 多模型协作

### 5.2.1 模型选择指南

| 任务 | 推荐模型 | 理由 |
| --- | --- | --- |
| **代码分析** | Gemini | 擅长深度代码理解和模式识别 |
| **Bug 诊断** | Gemini | 强大的根因分析能力 |
| **功能开发** | Qwen | 代码生成效率高 |
| **代码审查** | Codex (GPT) | Git 集成好，审查格式标准 |
| **长文本** | Claude | 上下文窗口大 |

### 5.2.2 协作模式

#### 串行协作

```bash
# 步骤 1: Gemini 分析
ccw cli -p "分析代码架构" --tool gemini --mode analysis

# 步骤 2: Qwen 实现
ccw cli -p "基于分析结果实现功能" --tool qwen --mode write

# 步骤 3: Codex 审查
ccw cli -p "审查实现代码" --tool codex --mode review
```

#### 并行协作

使用 `--tool gemini` 和 `--tool qwen` 同时分析同一问题：

```bash
# 终端 1
ccw cli -p "从性能角度分析" --tool gemini --mode analysis &

# 终端 2
ccw cli -p "从安全角度分析" --tool codex --mode analysis &
```

### 5.2.3 会话恢复

跨模型会话恢复：

```bash
# 第一次调用
ccw cli -p "分析认证模块" --tool gemini --mode analysis

# 恢复会话继续
ccw cli -p "基于上次分析，设计改进方案" --tool qwen --mode write --resume
```

---

## 5.3 Memory 管理

### 5.3.1 Memory 分类

| 分类 | 用途 | 示例内容 |
| --- | --- | --- |
| **learnings** | 学习心得 | 新技术使用经验 |
| **decisions** | 架构决策 | 技术选型理由 |
| **conventions** | 编码规范 | 命名约定、模式 |
| **issues** | 已知问题 | Bug、限制、TODO |

### 5.3.2 Memory 命令

| 命令 | 功能 | 示例 |
| --- | --- | --- |
| **list** | 列出所有记忆 | `ccw memory list` |
| **search** | 搜索记忆 | `ccw memory search "认证"` |
| **export** | 导出记忆 | `ccw memory export <id>` |
| **import** | 导入记忆 | `ccw memory import "..."` |
| **embed** | 生成嵌入 | `ccw memory embed <id>` |

### 5.3.3 Memory 最佳实践

::: tip 提示
- **定期整理**: 每周整理一次 Memory，删除过时内容
- **结构化**: 使用标准格式，便于搜索和复用
- **上下文**: 记录决策背景，不只是结论
- **链接**: 相关内容互相引用
:::

### 5.3.4 Memory 模板

```markdown
## 标题
### 背景
- **问题**: ...
- **影响**: ...

### 决策
- **方案**: ...
- **理由**: ...

### 结果
- **效果**: ...
- **经验**: ...

### 相关
- [相关记忆 1](memory-id-1)
- [相关文档](link)
```

---

## 5.4 CodexLens 高级用法

### 5.4.1 混合搜索

结合向量搜索和关键词搜索：

```bash
# 纯向量搜索
ccw search --mode vector "用户认证"

# 混合搜索（默认）
ccw search --mode hybrid "用户认证"

# 纯关键词搜索
ccw search --mode keyword "authenticate"
```

### 5.4.2 调用链追踪

追踪函数的完整调用链：

```bash
# 向上追踪（谁调用了我）
ccw search --trace-up "authenticateUser"

# 向下追踪（我调用了谁）
ccw search --trace-down "authenticateUser"

# 完整调用链
ccw search --trace-full "authenticateUser"
```

### 5.4.3 语义搜索技巧

| 技巧 | 示例 | 效果 |
| --- | --- | --- |
| **功能描述** | "处理用户登录" | 找到登录相关代码 |
| **问题描述** | "内存泄漏的地方" | 找到潜在问题 |
| **模式描述** | "单例模式的实现" | 找到设计模式 |
| **技术描述** | "使用 React Hooks" | 找到相关用法 |

---

## 5.5 Hook 自动注入

### 5.5.1 Hook 类型

| Hook 类型 | 触发时机 | 用途 |
| --- | --- | --- |
| **pre-command** | 命令执行前 | 注入规范、加载上下文 |
| **post-command** | 命令执行后 | 保存 Memory、更新状态 |
| **pre-commit** | Git 提交前 | 代码审查、规范检查 |
| **file-change** | 文件变更时 | 自动格式化、更新索引 |

### 5.5.2 Hook 配置

在 `.claude/hooks.json` 中配置：

```json
{
  "pre-command": [
    {
      "name": "inject-specs",
      "description": "注入项目规范",
      "command": "cat .workflow/specs/project-constraints.md"
    },
    {
      "name": "load-memory",
      "description": "加载相关 Memory",
      "command": "ccw memory search \"{query}\""
    }
  ],
  "post-command": [
    {
      "name": "save-memory",
      "description": "保存重要决策",
      "command": "ccw memory import \"{content}\""
    }
  ]
}
```

---

## 5.6 性能优化

### 5.6.1 索引优化

| 优化项 | 说明 |
| --- | --- |
| **增量索引** | 只索引变更文件 |
| **并行索引** | 多进程并行处理 |
| **缓存策略** | 向量嵌入缓存 |

### 5.6.2 搜索优化

| 优化项 | 说明 |
| --- | --- |
| **结果缓存** | 相同查询返回缓存 |
| **分页加载** | 大结果集分页返回 |
| **智能去重** | 相似结果自动去重 |

---

## 5.7 快速参考

### CLI 命令速查

| 命令 | 功能 |
| --- | --- |
| `ccw cli -p "..." --tool gemini --mode analysis` | 分析任务 |
| `ccw cli -p "..." --tool qwen --mode write` | 实现任务 |
| `ccw cli -p "..." --tool codex --mode review` | 审查任务 |
| `ccw memory list` | 列出记忆 |
| `ccw memory search "..."` | 搜索记忆 |
| `ccw search "..."` | 语义搜索 |
| `ccw search --trace "..."` | 调用链追踪 |

### 规则模板速查

| 规则 | 用途 |
| --- | --- |
| `analysis-diagnose-bug-root-cause` | Bug 分析 |
| `analysis-assess-security-risks` | 安全评估 |
| `development-implement-feature` | 功能实现 |
| `development-refactor-codebase` | 代码重构 |
| `development-generate-tests` | 测试生成 |

---

## 下一步

- [最佳实践](ch06-best-practices.md) — 团队协作规范、代码审查流程、文档维护策略
