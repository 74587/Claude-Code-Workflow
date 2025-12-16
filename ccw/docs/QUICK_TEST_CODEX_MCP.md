# Codex MCP 快速测试指南

## 🎯 快速测试步骤

### 测试 1: CCW Tools 样式检查（1分钟）

1. 打开 Dashboard → MCP 管理
2. 确保在 **Claude 模式**
3. 查看 CCW Tools MCP 卡片
4. ✅ **验证点**:
   - 卡片有橙色边框（不是蓝色）
   - 左上角图标是橙色背景（不是蓝色）
   - "Available"徽章是橙色（不是蓝色）
   - "Core only"/"All"按钮是橙色文字

**预期效果**:
```
┌─────────────────────────────────────────┐
│ 🔧  CCW Tools MCP                      │  ← 橙色边框
│    [橙色图标] Available (橙色徽章)       │
│                                         │
│    [✓] Write/create files              │
│    [✓] Edit/replace content            │
│    ...                                 │
│                                         │
│    [橙色按钮] Core only  [橙色按钮] All │
│                                         │
│    [橙色安装按钮] Install to Workspace  │
└─────────────────────────────────────────┘
```

---

### 测试 2: Codex MCP 安装 + Toast 反馈（2分钟）

#### 步骤

1. **切换到 Codex 模式**
   - 点击页面顶部的 "Codex" 按钮
   - 确认右侧显示 `~/.codex/config.toml`

2. **选择并安装 CCW Tools**
   - 在 CCW Tools 卡片中勾选所有核心工具
   - 点击橙色"Install"按钮

3. **观察 Toast 消息**
   - **关键点**: 盯住屏幕底部中央
   - 应该看到绿色的成功消息
   - 消息内容: `"CCW Tools installed to Codex (4 tools)"` 或中文版本
   - 消息停留 **3.5秒**（不是2秒）

4. **验证安装结果**
   ```bash
   # 查看 Codex 配置文件
   cat ~/.codex/config.toml
   
   # 应该看到类似以下内容：
   # [mcp_servers.ccw-tools]
   # command = "npx"
   # args = ["-y", "ccw-mcp"]
   # env = { CCW_ENABLED_TOOLS = "write_file,edit_file,codex_lens,smart_search" }
   ```

#### ✅ 成功标准

| 项目 | 预期 | 通过? |
|------|------|-------|
| Toast 显示 | ✅ | ⬜ |
| Toast 内容正确 | ✅ | ⬜ |
| Toast 停留 3.5秒 | ✅ | ⬜ |
| config.toml 创建 | ✅ | ⬜ |
| 卡片状态更新 | ✅ | ⬜ |

---

### 测试 3: 从 Claude 复制到 Codex（3分钟）

#### 前置步骤：创建测试服务器

1. **切换到 Claude 模式**
2. **创建全局 MCP 服务器**:
   - 点击"全局可用 MCP"区域的"+ New Global Server"
   - 填写信息：
     - 名称: `test-filesystem`
     - 命令: `npx`
     - 参数（每行一个）:
       ```
       -y
       @modelcontextprotocol/server-filesystem
       /tmp
       ```
   - 点击"Create"

3. **验证创建成功**: 服务器应该出现在"全局可用 MCP"列表中

#### 测试步骤

1. **切换到 Codex 模式**
2. **找到复制区域**: 向下滚动到"Copy Claude Servers to Codex"
3. **找到测试服务器**: 应该看到 `test-filesystem` 卡片
4. **点击复制按钮**: 橙色的"→ Codex"按钮
5. **观察反馈**:
   - Toast 消息: `"Codex MCP server 'test-filesystem' added"`
   - 停留时间: 3.5秒
   - 卡片出现"Already added"绿色徽章
6. **验证结果**:
   ```bash
   cat ~/.codex/config.toml
   
   # 应该看到:
   # [mcp_servers.test-filesystem]
   # command = "npx"
   # args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
   ```

#### ✅ 成功标准

| 项目 | 预期 | 通过? |
|------|------|-------|
| Toast 显示（包含服务器名称） | ✅ | ⬜ |
| Toast 停留 3.5秒 | ✅ | ⬜ |
| config.toml 正确添加 | ✅ | ⬜ |
| "Already added"徽章显示 | ✅ | ⬜ |
| 服务器出现在 Codex 区域 | ✅ | ⬜ |

---

## 🔍 调试清单

### Toast 消息不显示？

**检查点**:
1. 打开浏览器开发者工具 (F12)
2. 切换到 **Console** 标签
3. 执行安装操作
4. 查看是否有错误（红色文字）

**常见错误**:
```javascript
// 如果看到这个错误，说明 API 调用失败
Failed to add Codex MCP server: ...

// 如果看到这个，说明 Toast 函数未定义
showRefreshToast is not defined
```

### 配置文件未创建？

**检查步骤**:
```bash
# 1. 检查目录是否存在
ls -la ~/.codex/

# 2. 如果不存在，手动创建
mkdir -p ~/.codex

# 3. 检查权限
ls -la ~/.codex/
# 应该看到: drwxr-xr-x (可读写)

# 4. 重试安装操作
```

### 样式不对？

**可能原因**:
- 浏览器缓存了旧的 CSS
- 需要硬刷新

**解决方法**:
```
按 Ctrl + Shift + R (Windows/Linux)
或 Cmd + Shift + R (Mac)
强制刷新页面
```

---

## 📊 测试报告模板

**测试时间**: ___________  
**浏览器**: Chrome / Firefox / Safari / Edge  
**操作系统**: Windows / macOS / Linux  

### 测试结果

| 测试项 | 通过 | 失败 | 备注 |
|--------|------|------|------|
| CCW Tools 橙色样式 | ⬜ | ⬜ | |
| Codex MCP 安装 | ⬜ | ⬜ | |
| Toast 消息显示 | ⬜ | ⬜ | |
| Toast 停留 3.5秒 | ⬜ | ⬜ | |
| Claude → Codex 复制 | ⬜ | ⬜ | |
| config.toml 正确性 | ⬜ | ⬜ | |

### 发现的问题

_请在这里描述任何问题_

### 截图

_如果有问题，请附上截图_

---

## 🎬 视频演示脚本

如果需要录制演示视频，按照以下脚本操作：

### 第1段：样式检查（15秒）

```
1. 打开 MCP 管理页面
2. 指向 CCW Tools 卡片
3. 圈出橙色边框
4. 圈出橙色图标
5. 圈出橙色按钮
```

### 第2段：Codex 安装演示（30秒）

```
1. 切换到 Codex 模式
2. 勾选核心工具
3. 点击 Install 按钮
4. 暂停并放大 Toast 消息（绿色成功消息）
5. 数秒数：1、2、3、3.5秒后消失
6. 显示 config.toml 文件内容
```

### 第3段：Claude → Codex 复制演示（45秒）

```
1. 切换到 Claude 模式
2. 创建测试服务器
3. 切换到 Codex 模式
4. 找到复制区域
5. 点击"→ Codex"按钮
6. 暂停并放大 Toast 消息（包含服务器名称）
7. 显示卡片状态变化（"Already added"徽章）
8. 显示 config.toml 更新后的内容
```

---

## ✅ 完整测试检查清单

打印此清单并在测试时勾选：

```
□ 启动 CCW Dashboard
□ 导航到 MCP 管理页面
□ 【Claude模式】CCW Tools 卡片样式正确（橙色）
□ 【Claude模式】创建全局 MCP 测试服务器
□ 【Codex模式】CCW Tools 卡片样式正确（橙色）
□ 【Codex模式】安装 CCW Tools
□ 【Codex模式】Toast 消息显示 3.5秒
□ 【Codex模式】config.toml 创建成功
□ 【Codex模式】从 Claude 复制测试服务器
□ 【Codex模式】Toast 消息包含服务器名称
□ 【Codex模式】卡片显示"Already added"
□ 【Codex模式】config.toml 包含新服务器
□ 清理测试数据（删除测试服务器）
□ 填写测试报告
```

---

## 🎉 成功！

如果所有测试通过，恭喜！功能工作正常。

如果有任何问题，请参考 `CODEX_MCP_TESTING_GUIDE.md` 的详细故障排查部分。
