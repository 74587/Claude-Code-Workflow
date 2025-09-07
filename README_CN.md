# Claude Code Workflow (CCW) - 智能开发工作流系统

**中文** | [English](README.md)

**创新的AI驱动开发工作流编排系统，具备渐进式复杂度管理、文档-状态分离架构和智能多智能体协调功能。**

> 🚀 **Version 2.0+** - 下一代开发自动化，采用先进架构模式和智能工作流编排。

## 🏗️ 系统架构

Claude Code Workflow 实现了**4层智能开发架构**：

### 🧠 核心创新：文档-状态分离模式
- **Markdown 文件** → 规划、需求、任务结构、实现策略
- **JSON 文件** → 执行状态、进度跟踪、会话元数据、动态变更
- **自动同步引擎** → 双向协调，具备清晰的所有权规则

### ⚡ 渐进式复杂度管理
- **Level 0** (简单): <5任务，最小结构，直接执行
- **Level 1** (中等): 5-15任务，增强规划，智能体协调
- **Level 2** (复杂): >15任务，完整编排，迭代优化

### 🤖 智能体协调编排
- **5个专业智能体**：规划 → 开发 → 审查 → 质量 → 内存
- **上下文保持**：原始任务上下文在智能体链中保持
- **质量门控**：每个智能体验证输入并确保输出标准
- **自适应工作流**：工作流深度匹配任务复杂度要求

### 🔄 高级功能特性
- **会话优先架构**：所有命令自动发现并继承活跃会话上下文
- **嵌入式工作流逻辑**：命令包含内置文档生成功能
- **Gemini CLI 集成**：12+专业模板实现智能上下文管理
- **实时同步机制**：可靠的文档-状态协调和冲突解决

## 🆕 最新系统演进

### 文件输出系统实现

系统已完全增强，具备全面的文件生成功能：

**之前状态**：命令仅生成最少文件输出  
**当前状态**：统一文件输出系统，具备：
- 所有工作流命令生成结构化输出文件
- 一致的`.workflow/WFS-[topic-slug]/`目录结构  
- 交叉引用文档生成（IMPL_PLAN.md、TODO_LIST.md、reports/）
- 会话状态与文档跟踪同步
- 可导出状态报告和分析文件
- 具有JSON文件生成的分层任务管理

### 关键架构组件

#### 1. **智能体系统** 
- **概念规划智能体**：多角度头脑风暴，基于角色的模板
- **行动规划智能体**：基于PRD的实现规划  
- **代码开发者**：测试驱动开发，技术栈指南
- **代码审查智能体**：质量保证和安全验证
- **UI设计专家**：设计系统合规性
- **Memory Gemini Bridge**：分布式内存管理

#### 2. **动态模板加载**
- **规划模板**：10个基于角色的多角度分析模板
- **技术栈模板**：6个特定语言的核心开发指南
- **基于脚本的发现**：带YAML frontmatter的`plan-executor.sh`和`tech-stack-loader.sh`

#### 3. **工作流管理**
- **会话管理**：具有JSON持久化的完整工作流生命周期
- **双层跟踪**：工作流级别和任务级别管理
- **中断/恢复**：带检查点系统的安全状态管理
- **进度监控**：实时TodoWrite集成

#### 4. **统一文件输出架构**
所有工作流命令现在生成全面的结构化输出：

**文档生成命令**：
- `/workflow:context --export` - STATUS_REPORT.md、HEALTH_CHECK.md  
- `/workflow:implement` - TODO_LIST.md（所有复杂度）、IMPLEMENTATION_LOG.md
- `/workflow:issue create` - WORKFLOW_ISSUES.md、单个ISS-###.json文件
- `/workflow:sync --export-report` - 带备份跟踪的SYNC_REPORT.md
- `/brainstorm` - synthesis-analysis.md、recommendations.md、会话元数据

**文件结构标准**：
- 所有文件存储在`.workflow/WFS-[topic-slug]/`结构中
- workflow-session.json更新文档引用
- 带时间戳和元数据的交叉引用文档
- `.task/`目录中带JSON文件的分层任务管理

### 增强架构与集成
- **深度Gemini CLI集成**：跨工作流统一引用模式
- **任务驱动模块化编排**：改进的规划和执行架构
- **规划优先原则**：强制复杂任务结构化规划（>1000行）
- **Memory-Gemini-Bridge**：分布式内存系统自动同步

### 改进的命令系统
- **`/dmsflow version`**：实时版本检查和远程比较
- **`/dmsflow upgrade`**：带用户确认的无缝系统升级
- **增强工作流控制**：改进的中断/恢复机制
- **Agent协调**：更好的TodoWrite集成和进度跟踪

### 核心命令

- **`/workflow <复杂度> "任务"`** - 带智能会话管理的工作流编排
- **`/enhance-prompt "请求"`** - 将模糊请求转换为结构化需求
- **`/update_dms [模式] [目标]`** - 配备 memory-gemini-bridge 代理的智能分布式内存系统
- **`/dmsflow <version|upgrade>`** - 版本管理和自动升级实用工具
- **`/gemini-chat`** - 带模板自动选择和会话持久化的Gemini CLI交互
- **`/gemini-execute`** - 智能上下文推理执行器，支持会话保存
- **`/brainstorm`** - 多角度头脑风暴协调，具备会话状态管理

### 命令参考表格

#### 命令快速参考
| 命令 | 描述 | 基础语法 | 自动触发场景 |
|------|------|---------|-------------|
| `/workflow` | 智能工作流编排 | `/workflow <复杂度> "任务"` | 多模块任务、架构变更 |
| `/enhance-prompt` | 动态提示增强 | `/enhance-prompt [--gemini] "请求"` | 模糊请求、复杂需求 |
| `/update_dms` | Memory-Gemini-Bridge 协调 | `/update_dms [模式] [目标] [选项]` | 项目文档更新 |
| `/dmsflow` | 版本管理与升级 | `/dmsflow version\|upgrade` | 版本检查、系统升级 |

#### 核心参数参考
| 参数类型 | 选项 | 影响范围 | 触发条件 |
|---------|-----|---------|---------|
| **复杂度** | `simple` / `medium` / `complex` | 工作流深度、Gemini 激活 | >3模块 → complex |
| **DMS模式** | `full` / `fast` / `deep` | 内存系统更新范围 | full → memory-gemini-bridge |
| **分析类型** | `pattern` / `architecture` / `security` / `performance` / `feature` / `quality` / `dependencies` / `migration` / `custom` | Gemini 焦点、模板选择 | 关键词自动匹配 |
| **执行选项** | `--auto` / `--manual` / `--gemini` / `--yolo` / `--debug` / `--interactive` | Task 工具、交互模式 | 复杂度自动判断 |

#### 智能文件定位语法
| 语法模式 | 示例 | 用途 |
|---------|------|-----|
| 单文件 | `@{file.js}` | 精确定位 |
| 目录递归 | `@{src/**/*}` | 模块分析 |
| 多扩展名 | `@{**/*.{ts,tsx}}` | 类型筛选 |
| 多路径 | `@{src/*,lib/*,api/*}` | 跨模块分析 |
| 模式匹配 | `@{**/*auth*,**/*login*}` | 领域特定定位 |

#### 命令协作模式
| 场景 | 命令流程 | 执行过程 |
|-----|---------|---------|
| **功能开发** | enhance → workflow → update_dms | 增强需求 → 执行开发 → 更新文档 |
| **代码审查** | gemini → workflow review | 分析模式 → 审查验证 |
| **架构重构** | gemini architecture → workflow complex | 架构分析 → 复杂执行 |
| **快速修复** | workflow simple | 直接简单任务执行 |

#### 自动升级触发器
| 触发条件 | 阈值 | 升级行为 |
|---------|-----|---------|
| 模块数量 | >3个模块 | simple → medium |
| 代码行数 | >1000行 | 触发规划阶段 |
| 文件数量 | >10个文件 | 激活 Gemini 分析 |
| 关键词检测 | `auth` / `payment` / `security` | 强制 complex 模式 |
| 跨模块变更 | >5个模块影响 | 启用 Task 工具协调 |

## 安装

### 前置要求

- **PowerShell 5.1+**（Windows）或 **PowerShell Core 6+**（Linux/macOS）
- **Git** 用于仓库操作
- **Gemini CLI** 用于增强功能：[安装指南](https://github.com/google-gemini/gemini-cli)

### 安装

#### 推荐：克隆仓库

```bash
# 克隆并全局安装（默认且唯一模式）
git clone https://github.com/catlog22/Claude-CCW.git
cd Claude-CCW
.\Install-Claude.ps1
```

#### 替代：远程安装（推荐）

```powershell
# 一键远程全局安装（v2.0.0）
iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-CCW/main/install-remote.ps1)
```

**注意**：从 v1.2.0 开始，仅支持全局安装（`~/.claude/`），确保所有项目的一致行为。

#### 手动安装（脚本失效时）

如果自动化安装无法正常工作，可手动复制文件：

**全局安装：**
```bash
# 创建全局目录
mkdir -p ~/.claude

# 复制 .claude 目录内容
cp -r .claude/* ~/.claude/

# 复制 CLAUDE.md 到全局 .claude 目录
cp CLAUDE.md ~/.claude/
```

**项目安装：**
```bash
# 复制到当前项目
cp -r .claude ./
cp CLAUDE.md ./

# 或复制到指定项目
cp -r .claude /path/to/your/project/
cp CLAUDE.md /path/to/your/project/
```

**Windows（PowerShell）：**
```powershell
# 全局安装
New-Item -Path "$env:USERPROFILE\.claude" -ItemType Directory -Force
Copy-Item -Path ".claude\*" -Destination "$env:USERPROFILE\.claude\" -Recurse -Force
Copy-Item -Path "CLAUDE.md" -Destination "$env:USERPROFILE\.claude\CLAUDE.md"

# 项目安装
Copy-Item -Path ".claude" -Destination ".\" -Recurse -Force
Copy-Item -Path "CLAUDE.md" -Destination ".\CLAUDE.md"
```

## 快速开始

1. **安装** 全局系统：
   ```bash
   # 最新 v2.0.0 安装
   iex (iwr -useb https://raw.githubusercontent.com/catlog22/Claude-CCW/main/install-remote.ps1)
   ```
2. **自定义** 项目的 CLAUDE.md
3. **检查版本** 和 **升级** 系统：
   ```bash
   /dmsflow version   # 智能版本检查和远程比较
   /dmsflow upgrade   # 无缝升级到最新版本
   ```
   
   **v2.0 版本管理示例：**
   ```bash
   /dmsflow version
   # DMSFlow 版本信息
   # ================
   # 版本：2.1.0
   # 分支：feature/planning-agent-split-with-session-management  
   # 追踪提交：951afeb (tracked)
   # 远程提交：a1b2c3d (origin/HEAD~1)
   # 状态：🔄 有可用更新！运行 '/dmsflow upgrade' 升级。
   ```
4. **开始使用** 智能工作流：

```bash
# 简单工作流示例
/workflow simple "修复按钮样式"          # 直接：developer → review
/workflow medium "添加用户认证"          # 计划：planning → dev → review  
/workflow complex "实现微服务"           # 完整：planning → dev → review → iterate

# 增强命令
/enhance-prompt "改善应用性能"           # 结构化模糊请求
/enhance-prompt --gemini "重构认证系统"  # 强制Gemini分析增强
/gemini architecture "@src/**/* 系统分析" # 深度代码库分析
/update_dms src/auth/                   # 智能内存更新
```

## 🚀 增强提示词系统

### 智能建议机制
`/enhance-prompt` 命令会自动分析任务复杂度并提供下一步建议：

```bash
# 基本用法
/enhance-prompt "添加用户登录功能"
# ✅ 增强完成！
# 🎯 建议下一步：
# 1. 执行：/workflow medium "实现用户登录与FormValidator模式"
# 2. 研究：Task(general-purpose) - 仅用于研究现有模式
# 3. 简化：/workflow simple - 如果范围比预期简单

# 强制Gemini分析
/enhance-prompt --gemini "重构身份验证"
# ✅ 使用Gemini洞察增强完成！
# 🎯 建议：/workflow complex "使用JWT中间件重构身份验证"
```

### 🎯 智能建议规则

**建议决策矩阵**：
| 检测到的复杂度 | 推荐工作流 | 建议原因 |
|---------------|-----------|---------|
| **简单任务** | `/workflow simple` | 单文件变更，直接实现 |
| **中等任务** | `/workflow medium` | 多组件功能，需要规划 |
| **复杂任务** | `/workflow complex` | 系统级变更，需要完整生命周期 |
| **分析任务** | `Task(general-purpose)` | 研究任务，无需实现 |

**自动Gemini触发条件**：
- 关键词检测：`auth`、`payment`、`security`、`crypto`
- 复杂度指标：`complex`、`critical`级别
- 模块数量：影响 >3 个模块
- 架构关键词：`refactor`、`migrate`、`redesign`

### 💡 使用流程

1. **增强请求** → `/enhance-prompt "模糊需求"`
2. **获取建议** → 系统分析并推荐工作流
3. **执行建议** → 选择推荐的 `/workflow` 命令
4. **自动协调** → TodoWrite + Agent + DMS 自动管理

## 工作流系统

### 🎯 5阶段过程
1. **任务规划** - TodoWrite 创建进度跟踪
2. **上下文收集** - Gemini 收集代码库智能
3. **实现** - Agent 执行，实时更新
4. **质量审查** - 综合验证
5. **内存更新** - 自动 DMS 同步

### ⚡ 中断与恢复机制
工作流支持安全中断和无缝恢复：

```bash
# 中断与恢复控制
/workflow interrupt    # 安全中断，保存所有状态
/workflow continue     # 从上次中断点继续执行  
/workflow status       # 查看当前进度和状态
```

**中断特性**：
- **检查点保存**：每个 Agent 完成后自动保存状态
- **安全时机**：仅在 Agent 完成间隙中断，避免破坏执行
- **完整状态**：保存 TodoWrite、Agent 输出、上下文链
- **无缝恢复**：从最后完成的 Agent 继续，跳过已完成部分

### 复杂度级别
- **简单**：错误修复，单文件 → 直接实现
- **中等**：新功能，多文件 → 规划 + 实现
- **复杂**：架构更改 → 完整规划 + 迭代

## 🏗️ 架构概览

DMSFlow v2.0 实现了为智能开发自动化设计的复杂 **4层架构**：

### 1. 命令层
- **核心命令**：`/workflow`、`/enhance-prompt`、`/update_dms`、`/dmsflow`、`/gemini`
- **智能路由**：自动复杂度检测和agent协调
- **版本管理**：使用倒数第二个commit跟踪的智能升级系统

### 2. Agent层
- **规划Agent**：任务分解和结构化规划
- **代码开发者**：测试驱动开发和实现
- **代码审查Agent**：质量评估和安全验证
- **Memory-Gemini-Bridge**：分布式内存同步
- **UI设计专家**：设计系统合规性和UX一致性

### 3. 工作流层
- **Gemini集成模板**：12个专业化模板用于智能上下文管理
- **智能文件定位**：高级模式匹配和上下文检测
- **任务编排**：规划优先原则与自动升级
- **中断与恢复**：安全的工作流状态管理

### 4. 内存层
- **分布式CLAUDE.md**：分层项目文档
- **自动同步系统**：agent完成后实时内存更新
- **智能检测**：自动核心模块识别（>5文件或>500行代码）
- **版本跟踪**：带commit同步的自动更新文档

### 核心创新：智能版本管理
```
当前架构 → 前置提交跟踪 → 远程比较 → 更新检测
```
- **解决问题**：传统commit ID在文档更新后立即过时
- **解决方案**：跟踪倒数第二个commit ID，与远程仓库的倒数第二个commit比较
- **优势**：准确的版本检测、自动升级提示、可靠的更新机制

## 📁 项目结构

```
Claude-CCW/
├── .claude/
│   ├── agents/                    # 专业开发智能体
│   │   ├── conceptual-planning-agent.md
│   │   ├── action-planning-agent.md
│   │   ├── code-developer.md
│   │   ├── code-review-agent.md
│   │   └── [4个更多智能体]
│   ├── commands/                  # 带文件输出的命令实现
│   │   ├── workflow/              # 8个核心工作流命令（全部带文件生成）
│   │   ├── task/                  # 6个任务管理命令（JSON + 摘要文件）
│   │   ├── docs/                  # 文档管理命令  
│   │   └── [实用命令]
│   ├── planning-templates/        # 10个基于角色的规划模板
│   │   ├── system-architect.md
│   │   ├── ui-designer.md
│   │   └── [8个更多角色]
│   ├── tech-stack-templates/      # 6个特定语言指南
│   │   ├── javascript-dev.md
│   │   ├── python-dev.md
│   │   ├── react-dev.md
│   │   └── [3个更多语言]
│   ├── scripts/                   # 动态模板加载器和执行器
│   │   ├── plan-executor.sh
│   │   ├── tech-stack-loader.sh
│   │   └── gemini-chat-executor.sh
│   ├── workflows/                 # 工作流原则和标准
│   │   ├── file-structure-standards.md
│   │   ├── session-management-principles.md
│   │   └── [文档系统指南]
│   └── output-styles/             # 输出样式和协调模式
└── CLAUDE.md                      # 核心开发指南
```

## 最佳实践

- **渐进式进步** - 小的、可工作的更改
- **学习现有模式** - 实施前研究
- **使用 TodoWrite** 处理多步任务（>3个组件）
- **信任自动化** - 让系统处理 DMS 更新

## 内存系统

智能 CLAUDE.md 文件管理，自动同步：

- **分层结构**：项目 → 模块 → 实现级别
- **自动同步**：Agent 完成后更新
- **智能检测**：识别核心模块（>5文件或>500行）

```bash
/update_dms [路径]     # 快速更新（默认）
/update_dms deep       # 综合分析
/update_dms full       # 完全重建
```

## 📚 文档结构

系统使用模块化模板架构以增强可维护性：

### 工作流模板
- **[gemini-cli-guidelines.md](./.claude/workflows/gemini-cli-guidelines.md)** - 核心CLI使用模式和智能上下文原则
- **[gemini-agent-templates.md](./.claude/workflows/gemini-agent-templates.md)** - 简化的agent工作流单命令模板
- **[gemini-core-templates.md](./.claude/workflows/gemini-core-templates.md)** - 综合分析模板（模式、架构、安全、性能）
- **[gemini-dms-templates.md](./.claude/workflows/gemini-dms-templates.md)** - DMS特定文档管理模板
- **[gemini-intelligent-context.md](./.claude/workflows/gemini-intelligent-context.md)** - 智能文件定位和上下文检测算法

### Agent系统
- **[conceptual-planning-agent.md](./.claude/agents/conceptual-planning-agent.md)** - 高级策略规划和需求文档化，支持多角色头脑风暴
- **[action-planning-agent.md](./.claude/agents/action-planning-agent.md)** - 基于PRD文档的实现规划和任务分解
- **[code-developer.md](./.claude/agents/code-developer.md)** - 测试驱动开发和实现
- **[code-review-agent.md](./.claude/agents/code-review-agent.md)** - 质量评估和安全验证


### 命令参考
- **[workflow.md](./.claude/commands/workflow.md)** - 智能工作流编排
- **[enhance-prompt.md](./.claude/commands/enhance-prompt.md)** - 动态提示增强
- **[gemini.md](./.claude/commands/gemini.md)** - 深度代码库分析
- **[update_dms.md](./.claude/commands/update_dms.md)** - 分布式内存管理
- **[dmsflow.md](./.claude/commands/dmsflow.md)** - 智能版本管理和升级系统

## 自定义

**设置**：编辑 `.claude/settings.local.json` 进行权限和输出样式配置
**指南**：使用项目约定和架构决策自定义 `CLAUDE.md`

## 🎯 完整示例 - OAuth2 身份验证

展示完整工作流系统功能：

### 步骤1：增强模糊请求
```bash
/enhance-prompt "添加 OAuth2 用户登录"
# → 增强为结构化需求：Google 提供商、JWT 令牌、安全流程
```

### 步骤2：收集上下文智能
```bash
/gemini architecture "@src/**/* 身份验证系统结构"
/gemini security "@**/*auth* 现有安全模式" 
/gemini pattern "@**/*.{js,ts} OAuth 实现"
# → 提供当前模式、安全差距、集成点
```

### 步骤3：执行智能工作流
```bash
/workflow "使用 Google 提供商实现 OAuth2 身份验证"
# 自动流程：
# • TodoWrite 跟踪8个任务
# • Gemini 上下文集成
# • 规划生成 IMPLEMENTATION_PLAN.md、TASK_DECOMPOSITION.md
# • 代码开发者使用 TDD 实现
# • 代码审查验证安全
# • DMS 自动更新身份验证模块
```

### 步骤4：监控进度
```bash
# 实时 TodoWrite 更新：
# [✓] 分析 OAuth2 需求
# [⏳] 实现 Google 提供商集成  
# [ ] 添加 JWT 令牌验证
# [ ] 创建会话中间件
```

### 优势
- **单个命令** → 完整功能实现
- **模糊需求自动增强**
- **TodoWrite 实时进度跟踪**
- **多阶段验证质量保证**
- **自动 DMS 更新内存一致性**

## 故障排除

**命令无法识别**：确保项目中存在 `.claude` 目录
**安装失败**：检查 PowerShell 执行策略或使用克隆方法
**权限被拒绝**：以管理员身份运行或使用自定义安装路径

## 支持

- [GitHub Issues](https://github.com/catlog22/Claude-CCW/issues)
- [文档 Wiki](https://github.com/catlog22/Claude-CCW/wiki)
- [讨论](https://github.com/catlog22/Claude-CCW/discussions)
- [版本发布说明](https://github.com/catlog22/Claude-CCW/releases)

---

**Claude Code Workflow System** - 智能开发，Agent 协调和自动化质量治理