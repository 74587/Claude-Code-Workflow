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

CCW 框架指令存储在 `~/.claude/CLAUDE.CCW.md`（全局安装）。您的项目 `CLAUDE.md` 只需要一个 `@` 引用即可包含 CCW 指令：

```markdown
# 项目指令

- **CCW 指令**: @~/.claude/CLAUDE.CCW.md

## 编码标准
- 使用 TypeScript 确保类型安全
- 遵循 ESLint 配置
- 为所有新功能编写测试

## 架构
- 前端: Vue 3 + Vite
- 后端: Node.js + Express
- 数据库: PostgreSQL
```

使用 `ccw install` 的 Path 模式时，如果项目 `CLAUDE.md` 不存在，会自动创建包含 `@` 引用的最小文件。

### 目标生态系统选择

交互式安装时，可以选择安装哪些工作流生态系统：

- **All**（默认）— 安装 Claude + Codex + 其他工作流
- **Claude** — 仅安装 `.claude/` + `.ccw/`
- **Codex** — 仅安装 `.codex/`

也可以直接通过参数指定：

```bash
# 仅安装 Claude 工作流
ccw install --target claude

# 仅安装 Codex 工作流
ccw install --target codex

# 安装全部（默认）
ccw install --target all
```

## 更新 CCW

```bash
# 进入 CCW 克隆目录
cd ~/.claude/ccw-source

# 拉取最新代码
git pull origin main

# 升级所有安装
ccw upgrade
```

`ccw upgrade` 命令会：
- 更新所有已安装目录到最新源文件
- 更新 `~/.claude/CLAUDE.CCW.md` 到最新版本
- **迁移**：如果检测到旧版 `CLAUDE.md`（ccw 版本），会提示是否迁移到新的 `CLAUDE.CCW.md` 全局格式
- 保留用户设置和禁用状态

## 卸载

CCW 提供了智能卸载命令，会自动处理安装清单、孤立文件清理和全局文件保护。

### 使用 CCW 卸载命令（推荐）

```bash
ccw uninstall
```

卸载流程：

1. **扫描安装清单** - 自动检测所有已安装的 CCW 实例（Global 和 Path 模式）
2. **交互选择** - 显示安装列表，让您选择要卸载的实例
3. **智能保护** - 卸载 Path 模式时，如果存在 Global 安装，会自动保护全局文件（workflows、scripts、templates）
4. **孤立文件清理** - 自动清理不再被任何安装引用的 skills 和 commands 文件
5. **空目录清理** - 移除安装留下的空目录
6. **Git Bash 修复移除** - Windows 上最后一个安装卸载后，询问是否移除 Git Bash 多行提示修复

### 卸载输出示例

```
  Found installations:

  1. Global
     Path: /Users/username/my-project
     Date: 2026/3/2
     Version: 7.0.5
     Files: 156 | Dirs: 23

──────────────────────────────────────
? Select installation to uninstall: Global - /Users/username/my-project
? Are you sure you want to uninstall Global installation? Yes

✔ Removing files...
✔ Uninstall complete!

╔══════════════════════════════════════╗
║           Uninstall Summary          ║
╠══════════════════════════════════════╣
║ ✓ Successfully Uninstalled           ║
║                                      ║
║ Files removed: 156                   ║
║ Directories removed: 23              ║
║ Orphan files cleaned: 3              ║
║                                      ║
║ Manifest removed                     ║
╚══════════════════════════════════════╝
```

### 手动卸载 npm 包

如果需要完全移除 CCW npm 包：

```bash
# 卸载全局 npm 包
npm uninstall -g claude-code-workflow
```

### 手动删除 CCW 文件（不推荐）

如果必须手动删除，以下是 CCW 安装的具体路径：

```bash
# CCW 安装的目录（可安全删除）
rm -rf ~/.claude/commands/ccw.md
rm -rf ~/.claude/commands/ccw-coordinator.md
rm -rf ~/.claude/commands/workflow
rm -rf ~/.claude/commands/issue
rm -rf ~/.claude/commands/cli
rm -rf ~/.claude/commands/memory
rm -rf ~/.claude/commands/idaw
rm -rf ~/.claude/skills/workflow-*
rm -rf ~/~  or <project>/.claude/skills/team-*
rm -rf ~/.claude/skills/review-*
rm -rf ~/.claude/agents/team-worker.md
rm -rf ~/.claude/agents/cli-*-agent.md
rm -rf ~/.claude/workflows
rm -rf ~/.claude/scripts
rm -rf ~/.claude/templates
rm -rf ~/.claude/manifests
rm -rf ~/.claude/version.json

# Codex 相关目录
rm -rf ~/.codex/prompts
rm -rf ~/.codex/skills
rm -rf ~/.codex/agents

# CCW 核心目录
rm -rf ~/.ccw
```

::: danger 危险
**不要**执行 `rm -rf ~/.claude`，这会删除您的 Claude Code 个人配置：
- `~/.claude/settings.json` - 您的 Claude Code 设置
- `~/.claude/settings.local.json` - 本地覆盖设置
- MCP 服务器配置等

建议始终使用 `ccw uninstall` 进行受控卸载。
:::

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
