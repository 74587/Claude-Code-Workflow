# MCP Manager - 使用指南

## 概述

全新的 MCP 管理器提供了统一的界面来管理 MCP 服务器，支持多种安装方式和配置管理。

## 主要特性

### 1. 统一的 MCP 编辑弹窗
- **三种模式**：
  - 创建模式（Create）：创建新的 MCP 服务器
  - 编辑模式（Edit）：编辑现有 MCP 服务器
  - 查看模式（View）：只读查看 MCP 服务器详情

- **两种服务器类型**：
  - STDIO (Command-based)：通过命令行启动的 MCP 服务器
  - HTTP (URL-based)：通过 HTTP/HTTPS 访问的 MCP 服务器

### 2. 多种安装目标

支持安装到以下位置：

| 目标 | 配置文件 | 说明 |
|------|---------|------|
| **Claude** | `.mcp.json` | 项目级配置，推荐用于 Claude CLI |
| **Codex** | `~/.codex/config.toml` | Codex 全局配置 |
| **Project** | `.mcp.json` | 项目级配置（与 Claude 相同） |
| **Global** | `~/.claude.json` | 全局配置，所有项目可用 |

### 3. MCP 模板系统

- **保存模板**：从现有 MCP 服务器创建可复用模板
- **浏览模板**：按分类查看所有已保存的模板
- **一键安装**：从模板快速安装 MCP 服务器到任意目标

### 4. 统一的服务器管理

- **查看所有服务器**：
  - Project（项目级）
  - Global（全局级）
  - Codex（Codex 全局）
  - Enterprise（企业级，只读）

- **操作**：
  - 启用/禁用
  - 查看详情
  - 编辑配置
  - 删除服务器
  - 保存为模板

## 使用方法

### 创建新的 MCP 服务器

1. 点击 **"Create New"** 按钮
2. 填写服务器信息：
   - **名称**：唯一标识符（必填）
   - **描述**：简要说明（可选）
   - **分类**：从预定义分类中选择

3. 选择服务器类型：
   - **STDIO**：填写 `command`、`args`、`env`、`cwd`
   - **HTTP**：填写 `url`、HTTP 头

4. （可选）勾选 **"Save as Template"** 保存为模板

5. 选择安装目标（Claude/Codex/Project/Global）

6. 点击 **"Install"** 完成安装

### STDIO 服务器示例

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
  "env": {
    "DEBUG": "true"
  }
}
```

### HTTP 服务器示例

```json
{
  "url": "https://api.example.com/mcp",
  "http_headers": {
    "Authorization": "Bearer YOUR_TOKEN",
    "X-API-Key": "YOUR_KEY"
  }
}
```

### 从模板安装

1. 点击 **"Templates"** 按钮
2. 浏览分类中的模板
3. 点击模板卡片上的 **"Install"** 按钮
4. 在弹窗中修改配置（如需要）
5. 选择安装目标
6. 点击 **"Install"**

### 编辑现有服务器

1. 在服务器列表中找到目标服务器
2. 点击 **编辑图标**（✏️）
3. 修改配置
4. 点击 **"Update"** 保存更改

### 管理服务器

- **启用/禁用**：点击开关图标（🔄）
- **查看详情**：点击眼睛图标（👁️）
- **保存为模板**：点击书签图标（🔖）
- **删除**：点击垃圾桶图标（🗑️）

## CLI 模式切换

支持两种 CLI 模式：

- **Claude 模式**：管理 `~/.claude.json` 和 `.mcp.json` 中的服务器
- **Codex 模式**：管理 `~/.codex/config.toml` 中的服务器

在界面顶部切换 CLI 模式以查看和管理相应的服务器。

## 统计信息

仪表板顶部显示以下统计：

- **Total Servers**：总服务器数量
- **Enabled**：已启用的服务器数量
- **Claude**：Claude 相关服务器数量（Project + Global）
- **Codex**：Codex 服务器数量

## 服务器分类

预定义分类：
- Development Tools
- Data & APIs
- Files & Storage
- AI & ML
- DevOps
- Custom

## API 支持

后端 API 已完整实现，支持：

### Claude MCP API
- `POST /api/mcp-copy-server` - 安装到项目/全局
- `POST /api/mcp-remove-server` - 从项目删除
- `POST /api/mcp-add-global-server` - 添加全局服务器
- `POST /api/mcp-remove-global-server` - 删除全局服务器
- `POST /api/mcp-toggle` - 启用/禁用服务器

### Codex MCP API
- `POST /api/codex-mcp-add` - 添加 Codex 服务器
- `POST /api/codex-mcp-remove` - 删除 Codex 服务器
- `POST /api/codex-mcp-toggle` - 启用/禁用 Codex 服务器
- `GET /api/codex-mcp-config` - 获取 Codex 配置

### 模板 API
- `GET /api/mcp-templates` - 获取所有模板
- `POST /api/mcp-templates` - 保存模板
- `DELETE /api/mcp-templates/:name` - 删除模板
- `GET /api/mcp-templates/search?q=keyword` - 搜索模板
- `GET /api/mcp-templates/categories` - 获取所有分类

## 配置文件格式

### .mcp.json (项目级)
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"],
      "env": {}
    }
  }
}
```

### .claude.json (全局级)
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

### config.toml (Codex)
```toml
[mcp_servers.server-name]
command = "node"
args = ["server.js"]
enabled = true
```

## 故障排除

### 常见问题

1. **服务器无法启用**
   - 检查命令是否正确
   - 确认依赖是否已安装
   - 查看环境变量是否正确

2. **无法保存到 Codex**
   - 确认 `~/.codex` 目录存在
   - 检查文件权限

3. **模板无法加载**
   - 刷新页面重试
   - 检查浏览器控制台错误信息

### 调试技巧

- 打开浏览器开发者工具查看网络请求
- 检查控制台日志
- 查看配置文件是否正确生成

## 兼容性

- **支持的配置格式**：
  - `.mcp.json` (JSON)
  - `.claude.json` (JSON)
  - `config.toml` (TOML for Codex)

- **浏览器支持**：
  - Chrome/Edge (推荐)
  - Firefox
  - Safari

## 最佳实践

1. **使用 .mcp.json 优先**：
   - 便于版本控制
   - 项目独立配置
   - Claude 和 Codex 都能识别

2. **分类管理模板**：
   - 为模板选择合适的分类
   - 添加清晰的描述
   - 避免重复的模板名称

3. **环境变量安全**：
   - 敏感信息使用环境变量
   - 不要在配置文件中硬编码 token
   - 使用 `.env` 文件管理密钥

4. **服务器命名规范**：
   - 使用小写字母和连字符
   - 避免特殊字符
   - 名称具有描述性

## 更新日志

### v2.0 (当前版本)
- ✅ 全新的统一编辑弹窗
- ✅ 支持多种安装目标（Claude/Codex/Project/Global）
- ✅ 完整的模板系统
- ✅ STDIO 和 HTTP 服务器类型支持
- ✅ 统一的服务器列表视图
- ✅ 实时统计信息
- ✅ 国际化支持（英文/中文）
- ✅ 响应式设计

### 从旧版本迁移

旧版本的 MCP 配置会自动识别，无需手动迁移。新版本完全兼容旧配置文件。

## 支持

如有问题或建议，请联系开发团队或提交 issue。
