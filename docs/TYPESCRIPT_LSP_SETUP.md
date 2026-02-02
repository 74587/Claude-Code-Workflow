# Claude Code TypeScript LSP 配置指南

> 更新日期: 2026-01-20
> 适用版本: Claude Code v2.0.74+

---

## 目录

1. [方式一：插件市场（推荐）](#方式一插件市场推荐)
2. [方式二：MCP Server (cclsp)](#方式二mcp-server-cclsp)
3. [方式三：内置LSP工具](#方式三内置lsp工具)
4. [配置验证](#配置验证)
5. [故障排查](#故障排查)

---

## 方式一：插件市场（推荐）

### 步骤 1: 添加插件市场

在Claude Code中执行：

```bash
/plugin marketplace add boostvolt/claude-code-lsps
```

### 步骤 2: 安装TypeScript LSP插件

```bash
# TypeScript/JavaScript支持（推荐vtsls）
/plugin install vtsls@claude-code-lsps
```

### 步骤 3: 验证安装

```bash
/plugin list
```

应该看到：
```
✓ vtsls@claude-code-lsps (enabled)
✓ pyright-lsp@claude-plugins-official (enabled)
```

### 配置文件自动更新

安装后，`~/.claude/settings.json` 会自动添加：

```json
{
  "enabledPlugins": {
    "pyright-lsp@claude-plugins-official": true,
    "vtsls@claude-code-lsps": true
  }
}
```

### 支持的操作

- `goToDefinition` - 跳转到定义
- `findReferences` - 查找引用
- `hover` - 显示类型信息
- `documentSymbol` - 文档符号
- `getDiagnostics` - 诊断信息

---

## 方式二：MCP Server (cclsp)

### 优势

- **位置容错**：自动修正AI生成的不精确行号
- **更多功能**：支持重命名、完整诊断
- **灵活配置**：完全自定义LSP服务器

### 安装步骤

#### 1. 安装TypeScript Language Server

```bash
npm install -g typescript-language-server typescript
```

验证安装：
```bash
typescript-language-server --version
```

#### 2. 配置cclsp

运行自动配置：
```bash
npx cclsp@latest setup --user
```

或手动创建配置文件：

**文件位置**: `~/.claude/cclsp.json` 或 `~/.config/claude/cclsp.json`

```json
{
  "servers": [
    {
      "extensions": ["ts", "tsx", "js", "jsx"],
      "command": ["typescript-language-server", "--stdio"],
      "rootDir": ".",
      "restartInterval": 5,
      "initializationOptions": {
        "preferences": {
          "includeInlayParameterNameHints": "all",
          "includeInlayPropertyDeclarationTypeHints": true,
          "includeInlayFunctionParameterTypeHints": true,
          "includeInlayVariableTypeHints": true
        }
      }
    },
    {
      "extensions": ["py", "pyi"],
      "command": ["pylsp"],
      "rootDir": ".",
      "restartInterval": 5
    }
  ]
}
```

#### 3. 在Claude Code中启用MCP Server

添加到Claude Code配置：

```bash
# 查看当前MCP配置
cat ~/.claude/.mcp.json

# 如果没有，创建新的
```

**文件**: `~/.claude/.mcp.json`

```json
{
  "mcpServers": {
    "cclsp": {
      "command": "npx",
      "args": ["cclsp@latest"]
    }
  }
}
```

### cclsp可用的MCP工具

使用时，Claude Code会自动调用这些工具：

- `find_definition` - 按名称查找定义（支持模糊匹配）
- `find_references` - 查找所有引用
- `rename_symbol` - 重命名符号（带备份）
- `get_diagnostics` - 获取诊断信息
- `restart_server` - 重启LSP服务器

---

## 方式三：内置LSP工具

### 启用方式

设置环境变量：

**Linux/Mac**:
```bash
export ENABLE_LSP_TOOL=1
claude
```

**Windows (PowerShell)**:
```powershell
$env:ENABLE_LSP_TOOL=1
claude
```

**永久启用** (添加到shell配置):
```bash
# Linux/Mac
echo 'export ENABLE_LSP_TOOL=1' >> ~/.bashrc
source ~/.bashrc

# Windows (PowerShell Profile)
Add-Content $PROFILE '$env:ENABLE_LSP_TOOL=1'
```

### 限制

- 需要先安装语言服务器插件（见方式一）
- 不支持重命名等高级操作
- 无位置容错功能

---

## 配置验证

### 1. 检查LSP服务器是否可用

```bash
# 检查TypeScript Language Server
which typescript-language-server  # Linux/Mac
where typescript-language-server  # Windows

# 测试运行
typescript-language-server --stdio
```

### 2. 在Claude Code中测试

打开任意TypeScript文件，让Claude执行：

```typescript
// 测试LSP功能
LSP({
  operation: "hover",
  filePath: "path/to/your/file.ts",
  line: 10,
  character: 5
})
```

### 3. 检查插件状态

```bash
/plugin list
```

查看启用的插件：
```bash
cat ~/.claude/settings.json | grep enabledPlugins
```

---

## 故障排查

### 问题 1: "No LSP server available"

**原因**：TypeScript LSP插件未安装或未启用

**解决**：
```bash
# 重新安装插件
/plugin install vtsls@claude-code-lsps

# 检查settings.json
cat ~/.claude/settings.json
```

### 问题 2: "typescript-language-server: command not found"

**原因**：未安装TypeScript Language Server

**解决**：
```bash
npm install -g typescript-language-server typescript

# 验证
typescript-language-server --version
```

### 问题 3: LSP响应慢或超时

**原因**：项目太大或配置不当

**解决**：
```json
// 在tsconfig.json中优化
{
  "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", "dist"]
}
```

### 问题 4: 插件安装失败

**原因**：网络问题或插件市场未添加

**解决**：
```bash
# 确认插件市场已添加
/plugin marketplace list

# 如果没有，重新添加
/plugin marketplace add boostvolt/claude-code-lsps

# 重试安装
/plugin install vtsls@claude-code-lsps
```

---

## 三种方式对比

| 特性 | 插件市场 | cclsp (MCP) | 内置LSP |
|------|----------|-------------|---------|
| 安装复杂度 | ⭐ 低 | ⭐⭐ 中 | ⭐ 低 |
| 功能完整性 | ⭐⭐⭐ 完整 | ⭐⭐⭐ 完整+ | ⭐⭐ 基础 |
| 位置容错 | ❌ 无 | ✅ 有 | ❌ 无 |
| 重命名支持 | ✅ 有 | ✅ 有 | ❌ 无 |
| 自定义配置 | ⚙️ 有限 | ⚙️ 完整 | ❌ 无 |
| 生产稳定性 | ⭐⭐⭐ 高 | ⭐⭐ 中 | ⭐⭐⭐ 高 |

---

## 推荐配置

### 新手用户
**推荐**: 方式一（插件市场）
- 一条命令安装
- 官方维护，稳定可靠
- 满足日常使用需求

### 高级用户
**推荐**: 方式二（cclsp）
- 完整功能支持
- 位置容错（AI友好）
- 灵活配置
- 支持重命名等高级操作

### 快速测试
**推荐**: 方式三（内置LSP）+ 方式一（插件）
- 设置环境变量
- 安装插件
- 立即可用

---

## 附录：支持的语言

通过插件市场可用的LSP：

| 语言 | 插件名 | 安装命令 |
|------|--------|----------|
| TypeScript/JavaScript | vtsls | `/plugin install vtsls@claude-code-lsps` |
| Python | pyright | `/plugin install pyright@claude-code-lsps` |
| Go | gopls | `/plugin install gopls@claude-code-lsps` |
| Rust | rust-analyzer | `/plugin install rust-analyzer@claude-code-lsps` |
| Java | jdtls | `/plugin install jdtls@claude-code-lsps` |
| C/C++ | clangd | `/plugin install clangd@claude-code-lsps` |
| C# | omnisharp | `/plugin install omnisharp@claude-code-lsps` |
| PHP | intelephense | `/plugin install intelephense@claude-code-lsps` |
| Kotlin | kotlin-ls | `/plugin install kotlin-language-server@claude-code-lsps` |
| Ruby | solargraph | `/plugin install solargraph@claude-code-lsps` |

---

## 相关文档

- [Claude Code LSP 文档](https://docs.anthropic.com/claude-code/lsp)
- [cclsp GitHub](https://github.com/ktnyt/cclsp)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
- [Plugin Marketplace](https://github.com/boostvolt/claude-code-lsps)

---

**配置完成后，重启Claude Code以应用更改**
