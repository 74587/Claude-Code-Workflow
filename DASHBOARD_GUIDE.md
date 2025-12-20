# CCW Dashboard 用户指南

**版本**: 6.2.0
**更新日期**: 2025-12-20

CCW Dashboard 是 Claude Code Workflow 的可视化控制面板，提供项目管理、会话监控、代码索引、记忆管理等功能的统一界面。

---

## 目录

1. [快速启动](#快速启动)
2. [界面布局](#界面布局)
3. [导航结构](#导航结构)
4. [核心视图详解](#核心视图详解)
5. [实时功能](#实时功能)
6. [快捷键](#快捷键)
7. [个性化设置](#个性化设置)
8. [API 端点参考](#api-端点参考)

---

## 快速启动

```bash
# 启动 Dashboard（自动打开浏览器）
ccw view

# 指定项目路径
ccw view -p /path/to/project

# 指定端口
ccw serve --port 8080

# 仅启动服务器（不打开浏览器）
ccw serve
```

Dashboard 默认运行在 `http://localhost:3456`。

---

## 界面布局

CCW Dashboard 是一个单页应用（SPA），界面由四个核心部分组成：

```
┌─────────────────────────────────────────────────────────────┐
│                      顶部操作栏 (Header)                      │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   侧边栏     │              主内容区                         │
│   导航       │           (Main Content)                      │
│  (Sidebar)   │                                              │
│              │                                              │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│                        页脚 (Footer)                         │
└─────────────────────────────────────────────────────────────┘
```

### 顶部操作栏

| 元素 | 功能 |
|------|------|
| 品牌标识 | 显示 "Claude Code Workflow" |
| 项目路径选择器 | 切换最近项目或浏览新项目 |
| 刷新按钮 | 重新加载当前视图数据 |
| 语言切换 (EN/ZH) | 切换界面语言 |
| 主题切换 (☀/🌙) | 切换浅色/深色主题 |

### 侧边栏导航

侧边栏可折叠，按功能分组：

- **项目 (Project)**: 概览、文件浏览器、CLI 状态、历史记录、图谱
- **会话 (Sessions)**: 全部、活跃、已归档的工作流会话
- **轻量任务 (Lite Tasks)**: Lite Plan 和 Lite Fix 会话
- **配置**: MCP 服务器、Hooks 配置
- **记忆 (Memory)**: 上下文、核心记忆、提示历史、技能、规则、CLAUDE.md

---

## 导航结构

### 项目组 (Project)

| 视图 | 说明 |
|------|------|
| **概览** | 项目统计数据、会话总数、任务完成度 |
| **文件浏览器** | 文件树视图，支持预览文件内容 |
| **状态** | CLI 工具安装状态和配置 |
| **历史** | CLI 命令执行历史记录 |
| **图谱** | 代码关系可视化 |

### 会话组 (Sessions)

| 过滤器 | 说明 |
|--------|------|
| **全部** | 显示所有工作流会话 |
| **活跃** | 仅显示进行中的会话 |
| **已归档** | 仅显示已完成/归档的会话 |

### 轻量任务 (Lite Tasks)

| 类型 | 说明 |
|------|------|
| **Lite Plan** | 轻量级规划任务会话 |
| **Lite Fix** | 快速修复任务会话 |

### 配置组

| 视图 | 说明 |
|------|------|
| **MCP 服务器** | 管理 MCP 服务器配置 |
| **Hooks** | 配置工具生命周期钩子 |

### 记忆组 (Memory)

| 视图 | 说明 |
|------|------|
| **上下文** | 文件读写热点和活动热图 |
| **核心记忆** | 战略知识库和会话聚类 |
| **提示历史** | AI 交互历史记录 |
| **技能** | 可重用能力包管理 |
| **规则** | AI 交互指令规则 |
| **CLAUDE.md** | 项目配置文件管理 |

---

## 核心视图详解

### 1. 项目概览 (Project Overview)

显示项目的核心统计信息：

- **会话统计**: 总数、活跃数、已归档数
- **任务进度**: 完成率、进行中任务数
- **活跃会话轮播**: 快速预览当前活跃的会话

### 2. CLI 工具管理 (CLI Manager)

集中管理所有命令行工具的配置。

#### CLI 工具面板
- **状态显示**: Gemini、Qwen、Codex 的安装状态
- **默认工具**: 设置默认使用的 CLI 工具
- **模型配置**: 配置每个工具的主要和次要模型
- **安装/卸载**: 通过向导安装或卸载工具

#### CodexLens 管理
- **索引路径**: 查看和修改索引存储位置
- **索引操作**:
  - 初始化索引（向量模式/FTS 模式）
  - 清理当前项目索引
  - 清理所有索引
- **语义依赖**: 安装 Python 依赖
- **模型管理**: 下载/删除嵌入模型
- **测试搜索**: 验证索引功能

#### 索引统计
- 总索引大小
- 项目数量
- 向量索引数
- FTS 索引数

### 3. 代码图谱浏览器 (Graph Explorer)（隐藏）

基于 Cytoscape.js 的交互式代码关系可视化工具。

#### 数据源切换
- **代码关系**: 基于 CodexLens 索引的文件/类/函数关系
- **核心记忆**: 记忆条目和实体关系图

#### 交互功能
- **拖拽/缩放/平移**: 自由探索图谱
- **节点着色**: 根据类型和重要性区分
- **过滤器**:
  - 范围: 所有文件 / 按模块 / 按文件
  - 类型: CLASS / FUNCTION / IMPORTS / CALLS 等

#### 节点详情
- 点击节点显示详细信息
- 类型、路径、行号
- **影响分析**: 分析变更可能影响的文件和符号

### 4. MCP 服务器管理 (MCP Manager)

管理项目级和全局的 MCP 服务器配置。

#### 功能
- **服务器列表**: 查看已配置的服务器
- **创建服务器**: 新建服务器配置
- **编辑/删除**: 修改或移除服务器
- **模板安装**: 从预设模板安装服务器
- **状态监控**: 查看服务器运行状态

### 5. Hook 管理 (Hook Manager)

配置工具执行生命周期钩子。

#### 支持的钩子类型
- **PreToolUse**: 工具使用前触发
- **PostToolUse**: 工具使用后触发
- **Notification**: 通知类钩子

#### 配置方式
- 项目级钩子 (`.claude/settings.local.json`)
- 全局钩子 (`~/.claude/settings.json`)
- 向导创建复杂钩子
- 模板快速配置

### 6. 核心记忆 (Core Memory)

战略知识库管理系统。

#### 记忆列表
- 创建/编辑/归档/删除记忆条目
- 结构化的知识存储
- 标签和分类管理

#### 集群视图
- **自动聚类**: 语义分析相关会话
- **集群管理**:
  - 查看集群成员
  - 合并/拆分集群
  - 删除集群
- **时间线**: 会话活动时间线

#### 嵌入管理
- 生成语义嵌入向量
- 嵌入状态监控
- 批量嵌入操作

### 7. 技能管理 (Skills Manager)

管理可重用的 AI 能力包。

#### 技能分类
- **项目技能**: `./.claude/skills/`
- **用户技能**: `~/.claude/skills/`

#### 技能卡片信息
- 名称和描述
- 版本号
- 包含的工具数量
- 支持文件数量

#### 技能创建
- **导入模式**: 从现有文件夹导入
- **CLI 生成**: 通过描述让 AI 生成

### 8. 帮助视图 (Help View)

国际化帮助文档系统。

- 动态加载帮助内容
- 支持中英文切换
- 快速查找功能指南

---

## 实时功能

Dashboard 通过 WebSocket 连接提供实时数据同步。

### WebSocket 连接

- 端点: `/ws`
- 自动重连机制
- 心跳保活

### 实时事件类型

| 事件 | 说明 |
|------|------|
| `SESSION_CREATED` | 新会话创建 |
| `SESSION_UPDATED` | 会话状态更新 |
| `TASK_UPDATED` | 任务进度更新 |
| `CLI_EXECUTION_STARTED` | CLI 执行开始 |
| `CLI_EXECUTION_COMPLETED` | CLI 执行完成 |
| `CODEXLENS_INDEX_PROGRESS` | 索引进度更新 |
| `MEMORY_UPDATED` | 记忆数据更新 |
| `CLAUDE_FILE_SYNCED` | CLAUDE.md 同步 |
| `REFRESH_REQUIRED` | 需要刷新数据 |

### 静默刷新

对于非关键事件，Dashboard 会在后台静默更新数据，无需用户干预。

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Escape` | 关闭当前打开的模态框或侧边栏 |

---

## 个性化设置

### 主题

Dashboard 支持两种主题：

- **浅色模式 (Light)**: 默认主题，适合明亮环境
- **深色模式 (Dark)**: 护眼主题，适合暗光环境

点击顶部操作栏的太阳/月亮图标切换。

### 语言

Dashboard 支持两种语言：

- **English (EN)**: 英文界面
- **中文 (ZH)**: 简体中文界面

点击顶部操作栏的 EN/ZH 按钮切换。语言设置会保存到本地存储。

---

## API 端点参考

### 仪表盘数据

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/dashboard-data` | GET | 获取仪表盘主数据 |
| `/api/workspace/switch` | POST | 切换工作区 |

### 会话管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | GET | 获取会话列表 |
| `/api/sessions/{id}` | GET | 获取会话详情 |
| `/api/sessions/{id}/tasks` | GET | 获取会话任务 |

### 核心记忆

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/core-memory/list` | GET | 获取记忆列表 |
| `/api/core-memory/embed-status` | GET | 嵌入状态 |
| `/api/core-memory/embed` | POST | 生成嵌入 |
| `/api/core-memory/clusters` | GET | 获取集群列表 |
| `/api/core-memory/clusters` | POST | 创建集群 |
| `/api/core-memory/clusters/{id}` | GET | 获取集群详情 |
| `/api/core-memory/clusters/{id}` | PATCH | 更新集群 |
| `/api/core-memory/clusters/{id}` | DELETE | 删除集群 |
| `/api/core-memory/clusters/auto` | POST | 自动聚类 |
| `/api/core-memory/graph` | GET | 获取记忆图谱 |

### CodexLens

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/codexlens/config` | GET | 获取配置 |
| `/api/codexlens/config` | POST | 更新配置 |
| `/api/codexlens/indexes` | GET | 获取索引列表 |
| `/api/codexlens/init` | POST | 初始化索引 |
| `/api/codexlens/clean` | POST | 清理索引 |
| `/api/codexlens/semantic/status` | GET | 语义依赖状态 |
| `/api/codexlens/models` | GET | 获取模型列表 |

### 代码图谱

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/graph/nodes` | GET | 获取图谱节点 |
| `/api/graph/edges` | GET | 获取图谱边 |
| `/api/graph/impact` | POST | 影响分析 |

### 技能管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/skills` | GET | 获取技能列表 |
| `/api/skills/{name}` | GET | 获取技能详情 |
| `/api/skills/create` | POST | 创建技能 |
| `/api/skills/{name}` | DELETE | 删除技能 |

### MCP 服务器

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/mcp/servers` | GET | 获取服务器列表 |
| `/api/mcp/servers` | POST | 创建服务器 |
| `/api/mcp/servers/{id}` | PATCH | 更新服务器 |
| `/api/mcp/servers/{id}` | DELETE | 删除服务器 |

### CLI 工具

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cli/status` | GET | 工具状态 |
| `/api/cli/history` | GET | 执行历史 |
| `/api/cli/config` | GET/POST | 工具配置 |

---

## 故障排除

### Dashboard 无法启动

1. 检查端口是否被占用: `netstat -ano | findstr :3456`
2. 尝试使用其他端口: `ccw serve --port 8080`
3. 检查 Node.js 版本: `node --version` (需要 >= 16.0.0)

### WebSocket 连接失败

1. 检查防火墙设置
2. 确保后端服务正在运行
3. 刷新页面重新建立连接

### 数据不更新

1. 点击刷新按钮手动刷新
2. 检查 WebSocket 连接状态
3. 查看浏览器控制台是否有错误

---

## 相关文档

- [README.md](README.md) - 项目总览
- [GETTING_STARTED.md](GETTING_STARTED.md) - 快速入门
- [COMMAND_REFERENCE.md](COMMAND_REFERENCE.md) - 命令参考
- [CHANGELOG.md](CHANGELOG.md) - 更新日志

---

**CCW Dashboard** - Claude Code Workflow 的可视化控制中心
