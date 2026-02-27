<div align="center">

<!-- Animated Header -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=Claude%20Code%20Workflow&fontSize=42&fontColor=fff&animation=twinkling&fontAlignY=32&desc=多智能体%20AI%20开发框架&descAlignY=52&descSize=18"/>

<!-- Badges -->
<p>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/releases"><img src="https://img.shields.io/badge/version-v7.0.0-6366F1?style=flat-square" alt="Version"/></a>
  <a href="https://www.npmjs.com/package/claude-code-workflow"><img src="https://img.shields.io/npm/v/claude-code-workflow?style=flat-square&color=cb3837" alt="npm"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-10B981?style=flat-square" alt="License"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/stargazers"><img src="https://img.shields.io/github/stars/catlog22/Claude-Code-Workflow?style=flat-square&color=F59E0B" alt="Stars"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/issues"><img src="https://img.shields.io/github/issues/catlog22/Claude-Code-Workflow?style=flat-square&color=EF4444" alt="Issues"/></a>
</p>

**[English](README.md) | [中文](README_CN.md)**

<br/>

<!-- Typing Animation -->
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=6366F1&center=true&vCenter=true&random=false&width=600&lines=JSON+驱动的多智能体框架;4+级工作流系统;语义化+CLI+编排;Gemini+%7C+Codex+%7C+OpenCode+%7C+Qwen+%7C+Claude" alt="Typing SVG" /></a>

</div>

<br/>

<!-- Quick Links -->
<div align="center">
  <a href="#-快速开始"><img src="https://img.shields.io/badge/🚀_快速开始-4285F4?style=flat-square" alt="Quick Start"/></a>
  <a href="WORKFLOW_GUIDE_CN.md"><img src="https://img.shields.io/badge/📖_工作流指南-34A853?style=flat-square" alt="Guide"/></a>
  <a href="#-cli-工具安装"><img src="https://img.shields.io/badge/🛠️_CLI_工具-EA4335?style=flat-square" alt="CLI Tools"/></a>
  <a href="#-架构概览"><img src="https://img.shields.io/badge/🏗️_架构-FBBC05?style=flat-square" alt="Architecture"/></a>
</div>

<br/>

---

## ✨ 核心特性

<div align="center">
<table>
<tr>
<td width="50%">

### 🎯 4 级工作流
从 `lite-lite-lite`（即时执行）到 `brainstorm`（多角色分析）

### 🔄 多 CLI 编排
Gemini、Qwen、Codex、Claude - 自动选择或手动指定

### ⚡ Team 架构 v2
基于角色的智能体，支持内循环执行

### 🔧 队列调度器
后台队列执行服务

</td>
<td width="50%">

### 📦 工作流会话命令
启动/恢复/完成/同步会话

### 🖥️ 终端仪表板
多终端网格带执行监控器

### 🎨 编排器编辑器
基于模板的可视化工作流编辑

### 💬 A2UI
智能体到用户的交互界面

</td>
</tr>
</table>
</div>

> 📖 **新用户？** 查看 [工作流指南](WORKFLOW_GUIDE_CN.md) 了解完整的 4 级工作流系统。

---

## 🚀 快速开始

### 安装 CCW

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

### 选择工作流级别

<div align="center">
<table>
<tr><th>级别</th><th>命令</th><th>使用场景</th></tr>
<tr><td><b>1</b></td><td><code>/workflow:lite-lite-lite</code></td><td>快速修复、配置调整</td></tr>
<tr><td><b>2</b></td><td><code>/workflow:lite-plan</code></td><td>明确的单模块功能</td></tr>
<tr><td><b>2</b></td><td><code>/workflow:lite-fix</code></td><td>Bug 诊断修复</td></tr>
<tr><td><b>2</b></td><td><code>/workflow:multi-cli-plan</code></td><td>多视角分析</td></tr>
<tr><td><b>3</b></td><td><code>/workflow:plan</code></td><td>多模块开发</td></tr>
<tr><td><b>3</b></td><td><code>/workflow:tdd-plan</code></td><td>测试驱动开发</td></tr>
<tr><td><b>4</b></td><td><code>/workflow:brainstorm:auto-parallel</code></td><td>新功能、架构设计</td></tr>
</table>
</div>

### 工作流示例

```bash
# Level 1: 即时执行
/workflow:lite-lite-lite "修复 README 中的拼写错误"

# Level 2: 轻量规划
/workflow:lite-plan "添加 JWT 认证"
/workflow:lite-fix "用户上传失败返回 413 错误"

# Level 3: 标准规划 + Session
/workflow:plan "实现支付网关集成"
/workflow:execute

# Level 4: 多角色头脑风暴
/workflow:brainstorm:auto-parallel "设计实时协作系统" --count 5
/workflow:plan --session WFS-xxx
/workflow:execute
```

---

## 🛠️ CLI 工具安装

<div align="center">
<table>
<tr><th>CLI</th><th>说明</th><th>官方文档</th></tr>
<tr><td><b>Gemini</b></td><td>Google AI 分析</td><td><a href="https://github.com/google-gemini/gemini-cli">google-gemini/gemini-cli</a></td></tr>
<tr><td><b>Codex</b></td><td>OpenAI 自主编码</td><td><a href="https://github.com/openai/codex">openai/codex</a></td></tr>
<tr><td><b>OpenCode</b></td><td>开源多模型</td><td><a href="https://github.com/opencode-ai/opencode">opencode-ai/opencode</a></td></tr>
<tr><td><b>Qwen</b></td><td>阿里云 Qwen-Code</td><td><a href="https://github.com/QwenLM">QwenLM/Qwen</a></td></tr>
</table>
</div>

---

## 🎭 语义化 CLI 调用

<div align="center">
<img src="https://img.shields.io/badge/只需描述-你想要什么-6366F1?style=flat-square"/>
<img src="https://img.shields.io/badge/CCW_处理-剩下的一切-10B981?style=flat-square"/>
</div>

<br/>

用户可以在提示词中 **语义指定 CLI 工具** - 系统自动调用对应的 CLI。

### 基础调用

<div align="center">

| 用户提示词 | 系统动作 |
|------------|----------|
| "使用 Gemini 分析 auth 模块" | 自动调用 `gemini` CLI 进行分析 |
| "让 Codex 审查这段代码" | 自动调用 `codex` CLI 进行审查 |
| "问问 Qwen 性能优化建议" | 自动调用 `qwen` CLI 进行咨询 |

</div>

### 多 CLI 编排

<div align="center">

| 模式 | 用户提示词示例 |
|------|----------------|
| **协同分析** | "使用 Gemini 和 Codex 协同分析安全漏洞" |
| **并行执行** | "让 Gemini、Codex、Qwen 并行分析架构设计" |
| **迭代优化** | "用 Gemini 诊断问题，然后 Codex 修复，迭代直到解决" |
| **流水线** | "Gemini 设计方案，Codex 实现，Claude 审查" |

</div>

<details>
<summary><b>📝 更多示例</b></summary>

```text
# 单 CLI 调用
用户: "使用 Gemini 分析数据库查询性能"
→ 系统自动调用: gemini CLI 执行分析任务

# 协同分析
用户: "使用 Gemini 和 Codex 协同审查认证流程"
→ 系统自动调用: gemini + codex CLI，综合分析结果

# 并行多视角
用户: "让所有可用的 CLI 并行分析这个架构设计"
→ 系统自动调用: gemini, codex, qwen 并行执行 → 合并报告

# 顺序流水线
用户: "用 Gemini 规划重构方案，然后 Codex 实现"
→ 系统自动调用: gemini（规划）→ codex（实现）顺序执行
```

</details>

### 自定义 CLI 注册

通过 Dashboard 界面 **注册任意 API 为自定义 CLI**：

```bash
ccw view  # 打开 Dashboard → Status → API Settings → 添加自定义 CLI
```

<div align="center">

| 字段 | 示例 |
|------|------|
| **名称** | `deepseek` |
| **端点** | `https://api.deepseek.com/v1/chat` |
| **API Key** | `your-api-key` |

</div>

> ⚙️ 注册一次，永久语义调用 - 无需修改代码。

---

## 🔍 ACE Tool 配置

ACE (Augment Context Engine) 提供强大的语义代码搜索能力。

<div align="center">

| 方式 | 链接 |
|------|------|
| **官方** | [Augment MCP 文档](https://docs.augmentcode.com/context-services/mcp/overview) |
| **代理** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

</div>

---

## 📚 CodexLens 本地搜索

> ⚠️ **开发中**: CodexLens 正在迭代优化中，部分功能可能不稳定。

<div align="center">
<table>
<tr><th>搜索模式</th><th>说明</th></tr>
<tr><td><b>FTS</b></td><td>全文搜索，基于 SQLite FTS5</td></tr>
<tr><td><b>Semantic</b></td><td>语义搜索，基于本地嵌入模型</td></tr>
<tr><td><b>Hybrid</b></td><td>混合搜索，结合 FTS + 语义 + 重排序</td></tr>
</table>
</div>

<details>
<summary><b>📦 安装</b></summary>

```bash
# 进入 codex-lens 目录
cd codex-lens

# 安装依赖
pip install -e .

# 初始化索引
codexlens index /path/to/project
```

通过 `ccw view` 打开 Dashboard，在 **CodexLens Manager** 中管理索引和执行搜索。

</details>

---

## 💻 CCW CLI 命令

### 🌟 推荐命令（核心功能）

<div align="center">
<table>
<tr><th>命令</th><th>说明</th><th>适用场景</th></tr>
<tr>
  <td><b>/ccw</b></td>
  <td>自动工作流编排器 - 分析意图、自动选择工作流级别、在主进程中执行命令链</td>
  <td>✅ 通用任务、自动选择工作流、快速开发</td>
</tr>
<tr>
  <td><b>/ccw-coordinator</b></td>
  <td>智能编排器 - 智能推荐命令链、支持手动调整、通过外部 CLI 执行、持久化状态</td>
  <td>🔧 复杂多步骤工作流、可自定义链、可恢复会话</td>
</tr>
</table>
</div>

**快速示例**：

```bash
# /ccw - 自动工作流选择（主进程）
/ccw "添加用户认证"                    # 自动根据意图选择工作流
/ccw "修复 WebSocket 中的内存泄漏"     # 识别为 bugfix 工作流
/ccw "使用 TDD 方式实现"                # 路由到 TDD 工作流

# /ccw-coordinator - 手动链编排（外部 CLI）
/ccw-coordinator "实现 OAuth2 系统"     # 分析 → 推荐链 → 用户确认 → 执行
```

**主要区别**：

| 方面 | /ccw | /ccw-coordinator |
|------|------|------------------|
| **执行方式** | 主进程（SlashCommand） | 外部 CLI（后台任务） |
| **选择方式** | 自动基于意图识别 | 智能推荐 + 可选调整 |
| **状态管理** | TodoWrite 跟踪 | 持久化 state.json |
| **适用场景** | 通用任务、快速开发 | 复杂链条、可恢复 |

---

### 其他 CLI 命令

```bash
ccw install           # 安装工作流文件
ccw view              # 打开 Dashboard
ccw cli -p "..."      # 执行 CLI 工具 (Gemini/Qwen/Codex)
ccw upgrade -a        # 升级所有安装
```

### Dashboard 功能

<div align="center">
<table>
<tr><th>功能</th><th>说明</th></tr>
<tr><td><b>会话概览</b></td><td>跟踪工作流会话和进度</td></tr>
<tr><td><b>CodexLens</b></td><td>FTS + 语义 + 混合代码搜索</td></tr>
<tr><td><b>图浏览器</b></td><td>交互式代码关系可视化</td></tr>
<tr><td><b>CLI 管理器</b></td><td>执行历史与会话恢复</td></tr>
</table>
</div>

---

## 📖 文档

<div align="center">

| 文档 | 说明 |
|------|------|
| [**工作流指南**](WORKFLOW_GUIDE_CN.md) | 4 级工作流系统（推荐） |
| [**快速开始**](GETTING_STARTED_CN.md) | 5 分钟快速入门 |
| [**Dashboard 指南**](DASHBOARD_GUIDE.md) | Dashboard 用户指南 |
| [**常见问题**](FAQ.md) | 常见问题解答 |
| [**更新日志**](CHANGELOG.md) | 版本历史 |

</div>

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     主干工作流 (4 级)                            │
│  ⚡ Level 1: lite-lite-lite (即时执行，无产物)                   │
│  📝 Level 2: lite-plan / lite-fix / multi-cli-plan (→ execute)  │
│  📊 Level 3: plan / tdd-plan / test-fix-gen (Session 持久化)     │
│  🧠 Level 4: brainstorm:auto-parallel → plan → execute          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Team 架构 v2                                 │
│  🤖 基于 role-spec 的 team-worker 智能体执行                     │
│  🔄 内循环框架用于顺序任务处理                                   │
│  📢 消息总线协议与团队协调                                       │
│  🧠 智慧积累 (learnings/decisions/conventions)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     队列调度服务                                  │
│  ⚙️ 后台执行服务与 API 端点                                      │
│  📊 队列管理与统一的 CLI 执行设置                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     终端仪表板与编排器                            │
│  🖥️ 多终端网格与执行监控器                                       │
│  🎨 基于模板的工作流编辑器与斜杠命令                             │
│  📡 通过 A2UI 实现实时智能体通信                                 │
└─────────────────────────────────────────────────────────────────┘
```

**核心原则：**
- ⚡ **依赖分析** 解决并行问题 - 主干工作流无需 worktree
- 🤖 **Team 架构 v2** 提供统一的基于角色的智能体执行与内循环
- 🔧 **队列调度器** 处理后台任务执行与统一设置
- 🖥️ **终端仪表板** 提供实时监控和控制
- 🎯 根据复杂度选择工作流级别 - 避免过度工程化

---

## 🎼 团队节拍控制 (Beat Model)

v2 团队架构引入了**事件驱动的节拍模型**，实现高效编排：

```
节拍循环 (单个节拍)
======================================================================
  事件                    协调器                    工作者
----------------------------------------------------------------------
  回调/恢复 --> +- 处理回调 ------+
                |  标记已完成      |
                |  检查流水线      |
                +- 处理下一批 -----+
                |  查找就绪任务    |
                |  生成工作者 -----+--> [team-worker A] 阶段 1-5
                |  (可并行)      --+--> [team-worker B] 阶段 1-5
                +- 停止 (空闲) ----+         |
                                             |
  回调 <--------------------------------------+
  (下一节拍)        SendMessage + TaskUpdate(completed)
======================================================================

  快速推进 (简单线性后继跳过协调器)
======================================================================
  [工作者 A] 阶段 5 完成
    +- 1个就绪任务？简单后继？ --> 直接生成 team-worker B
    +- 复杂情况？ --> SendMessage 给协调器
======================================================================
```

**核心优势：**
- 🎯 **事件驱动**：协调器仅在需要时唤醒（回调/恢复）
- ⚡ **快速推进**：简单后继直接生成，无需协调器往返
- 🔄 **动态流水线**：根据依赖图按任务生成
- 📊 **并行执行**：独立任务并发运行

---

## 🖥️ 前端亮点

### 终端仪表板 (Terminal Dashboard)

多终端网格布局，实时执行监控。

**功能特性：**
- 🖥️ 多终端网格，可调整窗格大小
- 📊 带智能体列表的执行监控器
- 📁 项目导航文件侧边栏
- 🎯 按项目标签分组会话
- 🌙 全屏/沉浸模式

### 编排器编辑器 (Orchestrator Editor)

可视化工作流模板编辑器，支持拖放。

**功能特性：**
- 🎨 基于 React Flow 的可视化编辑
- 📦 预构建工作流的模板库
- 🔧 节点配置属性面板
- ⚡ 斜杠命令集成

### 分析查看器 (Analysis Viewer)

带过滤功能的分析会话网格布局，支持全屏模式。

---

## 🤝 贡献

<div align="center">
  <a href="https://github.com/catlog22/Claude-Code-Workflow"><img src="https://img.shields.io/badge/GitHub-仓库-181717?style=flat-square" alt="GitHub"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/issues"><img src="https://img.shields.io/badge/Issues-报告问题-EF4444?style=flat-square" alt="Issues"/></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/贡献-指南-10B981?style=flat-square" alt="Contributing"/></a>
</div>

---

## 📄 许可证

<div align="center">

MIT License - 详见 [LICENSE](LICENSE)

</div>

---

## 💬 社区交流

<div align="center">

欢迎加入 CCW 交流群，与其他开发者一起讨论使用心得、分享经验！

<img src="assets/wechat-group-qr.png" width="300" alt="CCW 微信交流群"/>

<sub>扫码加入微信交流群（如二维码过期，请提 Issue 获取最新二维码）</sub>

</div>

---

<div align="center">

<!-- Footer -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer"/>

</div>
