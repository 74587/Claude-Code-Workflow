# Maestro 品牌命名系统

> **文档版本**: 1.0.0
> **最后更新**: 2026-03-09
> **状态**: 已确定

## 概述

本文档定义了 Maestro 项目的完整品牌命名系统，包括总品牌、子品牌（工作流）、包名、CLI 命令、域名等命名规范。

### 品牌理念

**Maestro**（指挥家/编排大师）是一个智能编排平台，协调多个 AI CLI 工具，为开发者提供统一的工作流体验。

---

## 品牌架构

```
Maestro (总平台/编排系统)
├── Maestro Claude (基于 Claude Code 的工作流)
├── Maestro Codex (基于 Codex 的工作流)
├── Maestro Gemini (基于 Gemini 的工作流)
└── Maestro Qwen (基于 Qwen 的工作流)
```

### 设计原则

1. **清晰直观** - 工作流名称直接表明使用的 CLI 工具
2. **品牌统一** - 所有工作流都在 Maestro 品牌下
3. **易于扩展** - 未来添加新 CLI 时，命名规则保持一致
4. **技术透明** - 开发者清楚底层技术栈

---

## 完整命名规范

| 工作流 | 品牌名 | NPM 包 | CLI 命令 | GitHub Repo | 域名 |
|--------|--------|---------|----------|-------------|------|
| Claude Code 工作流 | **Maestro Claude** | `@maestro/claude` | `maestro claude` | `maestro-claude` | `claude.maestro.dev` |
| Codex 工作流 | **Maestro Codex** | `@maestro/codex` | `maestro codex` | `maestro-codex` | `codex.maestro.dev` |
| Gemini 工作流 | **Maestro Gemini** | `@maestro/gemini` | `maestro gemini` | `maestro-gemini` | `gemini.maestro.dev` |
| Qwen 工作流 | **Maestro Qwen** | `@maestro/qwen` | `maestro qwen` | `maestro-qwen` | `qwen.maestro.dev` |

### 命名规则

- **品牌名**: `Maestro <CLI名称>`
- **NPM 包**: `@maestro/<cli-name>`（小写，使用 scope）
- **CLI 命令**: `maestro <cli-name>`（小写）
- **GitHub 仓库**: `maestro-<cli-name>`（小写，连字符）
- **域名**: `<cli-name>.maestro.dev`（小写，子域名）

---

## 目录结构

### 推荐的项目结构

```
maestro/
├── packages/
│   ├── core/              # Maestro 核心引擎
│   │   ├── src/
│   │   └── package.json
│   ├── claude/            # Maestro Claude 工作流
│   │   ├── src/
│   │   └── package.json
│   ├── codex/             # Maestro Codex 工作流
│   │   ├── src/
│   │   └── package.json
│   ├── gemini/            # Maestro Gemini 工作流
│   │   ├── src/
│   │   └── package.json
│   ├── qwen/              # Maestro Qwen 工作流
│   │   ├── src/
│   │   └── package.json
│   └── podium/            # Maestro UI (原 CCW)
│       ├── frontend/
│       ├── backend/
│       └── package.json
├── docs/
│   ├── branding/          # 品牌文档
│   ├── guides/            # 使用指南
│   └── api/               # API 文档
├── .codex/                # Codex 配置和技能
├── .workflow/             # 工作流配置
├── package.json           # Monorepo 根配置
└── README.md
```

---

## CLI 使用示例

### 基本调用

```bash
# 使用 Claude Code 工作流
maestro claude --prompt "implement user authentication"

# 使用 Codex 工作流
maestro codex --analyze "src/**/*.ts"

# 使用 Gemini 工作流
maestro gemini --task "summarize this document"

# 使用 Qwen 工作流
maestro qwen --prompt "explain this code"
```

### 带参数调用

```bash
# Claude 工作流 - 代码生成
maestro claude generate --file "components/Button.tsx" --prompt "add loading state"

# Codex 工作流 - 代码分析
maestro codex search --pattern "useEffect" --path "src/"

# Gemini 工作流 - 多模态任务
maestro gemini analyze --image "screenshot.png" --prompt "describe this UI"

# Qwen 工作流 - 快速任务
maestro qwen translate --from "en" --to "zh" --text "Hello World"
```

### 工作流选择

```bash
# 查看可用工作流
maestro list

# 查看特定工作流信息
maestro info claude

# 设置默认工作流
maestro config set default-workflow claude
```

---

## 配置文件

### maestro.config.json

```json
{
  "version": "1.0.0",
  "workflows": {
    "claude": {
      "name": "Maestro Claude",
      "description": "Claude Code workflow for code generation and refactoring",
      "cli": "claude-code",
      "enabled": true,
      "defaultModel": "claude-sonnet-4",
      "capabilities": ["generate", "refactor", "explain", "chat"]
    },
    "codex": {
      "name": "Maestro Codex",
      "description": "Codex workflow for code analysis and understanding",
      "cli": "codex",
      "enabled": true,
      "defaultModel": "gpt-5.2",
      "capabilities": ["analyze", "search", "visualize", "index"]
    },
    "gemini": {
      "name": "Maestro Gemini",
      "description": "Gemini workflow for general-purpose AI tasks",
      "cli": "gemini",
      "enabled": true,
      "defaultModel": "gemini-2.5-pro",
      "capabilities": ["multimodal", "general", "experimental"]
    },
    "qwen": {
      "name": "Maestro Qwen",
      "description": "Qwen workflow for fast response and experimental tasks",
      "cli": "qwen",
      "enabled": true,
      "defaultModel": "coder-model",
      "capabilities": ["fast", "experimental", "assistant"]
    }
  },
  "branding": {
    "name": "Maestro",
    "tagline": "Orchestrate Your Development Workflow",
    "website": "https://maestro.dev",
    "repository": "https://github.com/maestro-suite/maestro"
  }
}
```

---

## 包名规范

### NPM 包

#### @maestro/claude

```json
{
  "name": "@maestro/claude",
  "version": "1.0.0",
  "description": "Maestro Claude - Claude Code workflow orchestration",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "maestro-claude": "./bin/cli.js"
  },
  "keywords": [
    "maestro",
    "claude",
    "claude-code",
    "workflow",
    "ai",
    "code-generation"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/maestro-suite/maestro-claude"
  }
}
```

#### @maestro/codex

```json
{
  "name": "@maestro/codex",
  "version": "1.0.0",
  "description": "Maestro Codex - Codex workflow orchestration",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "maestro-codex": "./bin/cli.js"
  },
  "keywords": [
    "maestro",
    "codex",
    "workflow",
    "ai",
    "code-analysis"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/maestro-suite/maestro-codex"
  }
}
```

### Python 包（如果需要）

#### maestro-claude

```toml
[project]
name = "maestro-claude"
version = "1.0.0"
description = "Maestro Claude - Claude Code workflow orchestration"
readme = "README.md"
requires-python = ">=3.8"
keywords = ["maestro", "claude", "workflow", "ai"]

[project.urls]
Homepage = "https://claude.maestro.dev"
Repository = "https://github.com/maestro-suite/maestro-claude"
```

---

## 品牌视觉

### Logo 设计

每个工作流使用不同的颜色来区分，但保持统一的设计语言：

| 工作流 | 主色 | 辅助色 | 图标元素 |
|--------|------|--------|----------|
| **Maestro Claude** | 橙色 `#FF6B35` | 深橙 `#D94F1C` | Claude 的 C 字母 + 指挥棒 |
| **Maestro Codex** | 绿色 `#00D084` | 深绿 `#00A86B` | Codex 的代码符号 + 指挥棒 |
| **Maestro Gemini** | 蓝色 `#4285F4` | 深蓝 `#1967D2` | Gemini 的双子星 + 指挥棒 |
| **Maestro Qwen** | 紫色 `#9C27B0` | 深紫 `#7B1FA2` | Qwen 的 Q 字母 + 指挥棒 |

### 总品牌色彩

- **主色**: 深蓝/午夜蓝 `#192A56` - 专业、稳定
- **强调色**: 活力青/薄荷绿 `#48D1CC` - 智能、创新
- **中性色**: 浅灰 `#F5F5F5`, 深灰 `#333333`

### 设计元素

- **指挥棒**: 所有 Logo 的核心元素，象征编排和指挥
- **声波/轨迹**: 动态的线条，表示工作流的流动
- **几何化**: 现代、简洁的几何图形

---

## 方案优点

### 1. 清晰直观
- 用户一眼就知道使用的是哪个 CLI 工具
- 不需要学习额外的术语映射

### 2. 易于理解
- 命名规则简单一致
- 新用户快速上手

### 3. 灵活扩展
- 未来添加新 CLI 时，命名规则保持一致
- 例如：添加 `Maestro GPT`、`Maestro Llama` 等

### 4. 品牌统一
- 所有工作流都在 Maestro 品牌下
- 强化 Maestro 作为编排平台的定位

### 5. 技术透明
- 开发者清楚底层使用的技术栈
- 便于调试和问题排查

---

## 注意事项

### 1. 商标问题

使用 "Maestro Claude"、"Maestro Codex" 等名称时，需要注意：

- ⚠️ 确保不侵犯原 CLI 的商标权
- ✅ 在文档中明确说明这些是"基于 XXX 的工作流"，而不是官方产品
- ✅ 添加免责声明：
  ```
  Maestro Claude 是基于 Claude Code 的工作流编排系统。
  Claude 和 Claude Code 是 Anthropic 的商标。
  本项目与 Anthropic 无关联。
  ```

### 2. 命名冲突

在发布前需要检查：

- [ ] npm 包名 `@maestro/claude`、`@maestro/codex` 等是否可用
- [ ] PyPI 包名 `maestro-claude`、`maestro-codex` 等是否可用
- [ ] GitHub 组织名 `maestro-suite` 是否可用
- [ ] 域名 `maestro.dev`、`claude.maestro.dev` 等是否可用

### 3. 用户认知

需要在文档中清楚说明：

- **Maestro** 是编排平台（总品牌）
- **Maestro Claude/Codex/Gemini/Qwen** 是工作流系统（子品牌）
- 底层使用的是对应的 CLI 工具（技术实现）

示例说明：
```
Maestro 是一个 AI 工作流编排平台。
Maestro Claude 是基于 Claude Code 的工作流系统，
它调用 Claude Code CLI 来执行代码生成和重构任务。
```

---

## 下一步行动

### 阶段 1: 资源可用性检查

- [ ] 检查域名可用性
  - [ ] `maestro.dev`
  - [ ] `claude.maestro.dev`
  - [ ] `codex.maestro.dev`
  - [ ] `gemini.maestro.dev`
  - [ ] `qwen.maestro.dev`

- [ ] 检查 npm 包名可用性
  - [ ] `@maestro/core`
  - [ ] `@maestro/claude`
  - [ ] `@maestro/codex`
  - [ ] `@maestro/gemini`
  - [ ] `@maestro/qwen`

- [ ] 检查 GitHub 可用性
  - [ ] 组织名 `maestro-suite`
  - [ ] 仓库名 `maestro`, `maestro-claude`, `maestro-codex` 等

### 阶段 2: 迁移计划

- [ ] 创建迁移文档（详见 `docs/migration/renaming-plan.md`）
- [ ] 重命名根目录：`Claude_dms3` → `maestro`
- [ ] 重组包结构：创建 `packages/` 目录
- [ ] 更新所有配置文件
- [ ] 更新代码中的引用

### 阶段 3: 实施和发布

- [ ] 执行迁移
- [ ] 更新文档和 README
- [ ] 创建 Logo 和品牌资产
- [ ] 发布到 npm/PyPI
- [ ] 配置域名和网站

---

## 参考资料

- [品牌架构设计](./brand-architecture.md)
- [迁移计划](../migration/renaming-plan.md)
- [视觉设计指南](./visual-identity.md)

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-03-09 | 初始版本，确定品牌命名系统 | - |
