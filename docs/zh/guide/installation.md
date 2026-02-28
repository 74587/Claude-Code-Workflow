# 安装

了解如何在您的系统上安装和配置 CCW。

## 前置要求

安装 CCW 之前，请确保您有：

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 或 **yarn** >= 1.22.0
- **Git** 用于版本控制功能

## 安装 CCW

### 全局安装（推荐）

```bash
npm install -g @ccw/cli
```

### 项目特定安装

```bash
# 在您的项目目录中
npm install --save-dev @ccw/cli

# 使用 npx 运行
npx ccw [命令]
```

### 使用 Yarn

```bash
# 全局
yarn global add @ccw/cli

# 项目特定
yarn add -D @ccw/cli
```

## 验证安装

```bash
ccw --version
# 输出: CCW v1.0.0

ccw --help
# 显示所有可用命令
```

## 配置

### CLI 工具配置

创建或编辑 `~/.claude/cli-tools.json`：

```json
{
  "version": "3.3.0",
  "tools": {
    "gemini": {
      "enabled": true,
      "primaryModel": "gemini-2.5-flash",
      "secondaryModel": "gemini-2.5-flash",
      "tags": ["分析", "调试"],
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

### CLAUDE.md 指令

在项目根目录创建 `CLAUDE.md`：

```markdown
# 项目指令

## 编码标准
- 使用 TypeScript 确保类型安全
- 遵循 ESLint 配置
- 为所有新功能编写测试

## 架构
- 前端: Vue 3 + Vite
- 后端: Node.js + Express
- 数据库: PostgreSQL
```

## 更新 CCW

```bash
# 更新到最新版本
npm update -g @ccw/cli

# 或安装特定版本
npm install -g @ccw/cli@latest
```

## 卸载

```bash
npm uninstall -g @ccw/cli

# 删除配置（可选）
rm -rf ~/.claude
```

::: info 下一步
安装完成后，查看[第一个工作流](./first-workflow.md)指南。
:::
