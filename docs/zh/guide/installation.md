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
npm install -g claude-code-workflow
```

### 项目特定安装

```bash
# 在您的项目目录中
npm install --save-dev claude-code-workflow

# 使用 npx 运行
npx ccw [命令]
```

### 使用 Yarn

```bash
# 全局
yarn global add claude-code-workflow

# 项目特定
yarn add -D claude-code-workflow
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
npm update -g claude-code-workflow

# 或安装特定版本
npm install -g claude-code-workflow@latest
```

## 卸载

```bash
npm uninstall -g claude-code-workflow

# 删除配置（可选）
rm -rf ~/.claude
```

## 故障排除

### 权限问题

如果遇到权限错误：

```bash
# 使用 sudo（不推荐）
sudo npm install -g claude-code-workflow

# 或修复 npm 权限（推荐）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### PATH 问题

将 npm 全局 bin 添加到您的 PATH：

```bash
# 对于 bash/zsh
echo 'export PATH=$(npm config get prefix)/bin:$PATH' >> ~/.bashrc

# 对于 fish
echo 'set -gx PATH (npm config get prefix)/bin $PATH' >> ~/.config/fish/config.fish
```

::: info 下一步
安装完成后，查看[第一个工作流](./first-workflow.md)指南。
:::

## 快速开始示例

安装完成后，尝试以下命令验证一切正常：

```bash
# 1. 在您的项目中初始化
cd your-project
ccw init

# 2. 尝试简单的分析
ccw cli -p "分析项目结构" --tool gemini --mode analysis

# 3. 运行主编排器
/ccw "总结代码库架构"

# 4. 检查可用命令
ccw --help
```

### 预期输出

```
$ ccw --version
CCW v7.0.5

$ ccw init
✔ Created .claude/CLAUDE.md
✔ Created .ccw/workflows/
✔ Configuration complete

$ ccw cli -p "Analyze project" --tool gemini --mode analysis
Analyzing with Gemini...
✔ Analysis complete
```

### 常见首次使用问题

| 问题 | 解决方案 |
|-------|----------|
| `ccw: command not found` | 将 npm 全局 bin 添加到 PATH，或重新安装 |
| `Permission denied` | 使用 `sudo` 或修复 npm 权限 |
| `API key not found` | 在 `~/.claude/cli-tools.json` 中配置 API 密钥 |
| `Node version mismatch` | 更新到 Node.js >= 18.0.0 |
