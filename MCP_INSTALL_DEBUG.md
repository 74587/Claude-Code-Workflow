# CCW MCP 工具安装问题调试指南

## 🎯 已修复的所有问题（完整清单）

### 问题 1: API 端点不匹配 ✅ 已修复
**位置**: `components/mcp-manager.js`
**原因**: 前端调用 `/api/mcp-add-global`，后端定义 `/api/mcp-add-global-server`
**修复**:
- Line 960: `installCcwToolsMcp()` - 全局安装端点已修正
- Line 1024: `updateCcwToolsMcp()` - 全局更新端点已修正

### 问题 2: 未定义的函数引用 ✅ 已修复
**位置**: `views/mcp-manager.js`
**原因**: 调用不存在的函数 `installMcpToProject`，正确函数名是 `copyMcpServerToProject`
**修复**:
- Line 1352: "Install to Project" 按钮事件处理已修正
- Line 1847: 模板安装逻辑已修正

### 问题 3: 全局作用域污染导致按钮失效 ✅ 已修复
**位置**: `views/mcp-manager.js`
**原因**: CCW Tools 按钮使用内联 `onclick` 属性，函数不在全局作用域导致无响应
**修复**: 
- Lines 239, 424, 430, 437, 443: 所有 `onclick` 改为 `data-action` 属性
- Line 1397-1413: 添加健壮的事件监听器，使用 `addEventListener`

## 测试步骤

### 1. 重启 CCW View 服务

**重要：** 必须重启服务才能加载修复后的代码。

```bash
# 方法 1: 直接运行
cd D:\Claude_dms3\ccw
npm run dev

# 方法 2: 使用 ccw 命令
ccw view
```

### 2. 打开浏览器控制台

在浏览器中访问 `http://localhost:3456`，按 `F12` 打开开发者工具，切换到 **Console** 标签。

### 3. 测试安装按钮

#### 测试场景 A: 安装到工作空间 (Workspace)

1. 导航到 **MCP Manager** 页面
2. 找到 **CCW Tools MCP** 卡片
3. 选择至少一个工具（勾选复选框）
4. 点击 **"Install to Workspace"** 按钮
5. **观察控制台输出**：
   - ✅ 成功：看到 "Installing CCW Tools MCP to workspace..." 提示
   - ❌ 失败：看到错误信息

#### 测试场景 B: 安装到全局 (Global)

1. 选择至少一个工具
2. 点击 **"Install Globally"** 按钮
3. **观察控制台输出**

#### 测试场景 C: 更新工具配置

1. 如果已安装，修改工具选择（添加或删除工具）
2. 点击 **"Update in Workspace"** 或 **"Update Globally"** 按钮
3. **观察控制台输出**

#### 测试场景 D: 从其他项目安装

1. 滚动到 **"Available from Other Projects"** 部分
2. 找到想要安装的 MCP 服务器
3. 点击 **"Install to Project"** 按钮
4. **观察控制台输出**

## 常见错误排查

### 错误 1: 502 Bad Gateway

**原因：** CCW View 服务未正确运行

**解决方法：**
```bash
# 停止所有 node 进程
taskkill /F /IM node.exe

# 重新启动服务
cd D:\Claude_dms3\ccw
npm run dev
```

### 错误 2: 404 Not Found (API 端点)

**原因：** API 路由未正确加载

**解决方法：**
1. 确认已运行 `npm run build`
2. 检查 `dist/core/routes/mcp-routes.js` 是否存在
3. 重启服务

### 错误 3: 按钮点击无反应

**检查清单：**
- [ ] 是否选择了至少一个工具？（如果没有选择，会显示警告）
- [ ] 浏览器控制台是否有 JavaScript 错误？
- [ ] 网络标签是否显示 API 请求？

**调试方法：**
```javascript
// 在浏览器控制台执行以下命令测试函数是否可用
typeof installCcwToolsMcp  // 应该返回 "function"
typeof updateCcwToolsMcp   // 应该返回 "function"
```

### 错误 4: Network Error / CORS Error

**原因：** 前后端端口不一致

**解决方法：**
- 确认 CCW View 运行在正确的端口（默认 3456）
- 检查浏览器访问的 URL 是否正确

## 网络请求监控

在浏览器开发者工具的 **Network** 标签中，点击按钮后应该看到：

### 成功的请求示例

**请求：**
```
POST http://localhost:3456/api/mcp-add-global-server
```

**请求体：**
```json
{
  "serverName": "ccw-tools",
  "serverConfig": {
    "command": "npx",
    "args": ["-y", "ccw-mcp"],
    "env": {
      "CCW_ENABLED_TOOLS": "write_file,edit_file,codex_lens,smart_search"
    }
  }
}
```

**响应：**
```json
{
  "success": true,
  "serverName": "ccw-tools",
  "scope": "global"
}
```

### 失败的请求示例

**状态码：** 404, 500, 502

**常见错误响应：**
```json
{
  "error": "serverName and serverConfig are required",
  "status": 400
}
```

## 日志检查

### 服务器日志

CCW View 服务运行时的控制台输出应该显示：
```
CCW Dashboard running at http://localhost:3456
```

如果看到错误，记录完整错误信息。

### 浏览器日志

打开控制台（F12）后，所有与 MCP 相关的日志会显示：
- API 请求和响应
- JavaScript 错误
- 网络错误

## 成功安装的验证

安装成功后，应该：
1. 看到成功提示：`"CCW Tools installed to workspace (4 tools)"`
2. MCP 卡片显示 ✓ 图标和工具数量
3. 在项目根目录生成 `.mcp.json` 文件（workspace 安装）
4. 或在 `~/.claude.json` 中添加配置（global 安装）

## 手动验证配置文件

### Workspace 安装 (.mcp.json)

```bash
cat D:\Claude_dms3\.mcp.json
```

应该包含：
```json
{
  "mcpServers": {
    "ccw-tools": {
      "command": "npx",
      "args": ["-y", "ccw-mcp"],
      "env": {
        "CCW_ENABLED_TOOLS": "write_file,edit_file,codex_lens,smart_search"
      }
    }
  }
}
```

### Global 安装 (~/.claude.json)

```bash
# Windows
type %USERPROFILE%\.claude.json

# Linux/Mac
cat ~/.claude.json
```

应该包含 `mcpServers` 部分。

## 需要报告的信息

如果问题仍未解决，请提供：

1. **浏览器控制台完整错误信息**
2. **Network 标签中失败的 API 请求详情**
   - 请求 URL
   - 请求方法
   - 状态码
   - 响应内容
3. **CCW View 服务端日志**
4. **操作系统和浏览器版本**
5. **CCW 版本** (`ccw --version`)

## 快速测试脚本

在浏览器控制台运行以下脚本测试完整流程：

```javascript
// 测试 API 端点可用性
async function testMcpEndpoints() {
  const endpoints = [
    '/api/mcp-config',
    '/api/mcp-add-global-server',
    '/api/mcp-copy-server'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      console.log(`✓ ${endpoint}: ${response.status}`);
    } catch (error) {
      console.error(`✗ ${endpoint}: ${error.message}`);
    }
  }
}

testMcpEndpoints();
```

## 已知限制

- 必须至少选择一个工具才能安装
- 安装到全局需要写入 `~/.claude.json` 的权限
- Windows 用户确保路径使用正确的斜杠方向
