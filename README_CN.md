# Claude Code Workflow (CCW)

一个精密的多智能体自动化工作流框架，将复杂的软件开发任务从概念构思到实现审查转化为可管理、可追踪、AI协调的流程。

## 🏗️ 架构概览

Claude Code Workflow (CCW) 建立在两大基础支柱之上：

### **文档-状态分离**
- **文档 (*.md)**：存储人类可读的计划、策略、分析报告和总结
- **状态 (*.json)**：管理机器可读的、动态的工作流状态和任务定义
- 这种分离确保了健壮性、可恢复性和自动化处理能力

### **渐进式复杂度**
CCW 根据任务复杂度智能调整其文件结构和工作流程：
- **简单工作流**：用于单文件 Bug 修复的轻量级结构
- **中等工作流**：增强的文档和进度可视化
- **复杂工作流**：完整的文档套件，包含详细的实现计划和多轮迭代

## 🚀 核心功能

### 多智能体系统
- **概念规划智能体**：多视角头脑风暴和概念规划
- **行动规划智能体**：将高层概念转化为可执行的实施计划
- **代码开发智能体**：基于计划实现代码
- **代码审查智能体**：审查代码质量和合规性
- **记忆桥接智能体**：同步 Claude 和 Gemini 记忆，维护 CLAUDE.md 文件

### 工作流会话管理
- 创建、暂停、恢复、列出和切换工作流会话
- 自动初始化所需的文件和目录结构
- 层次化工作流文件系统 (`.workflow/WFS-[topic-slug]/`)

### 智能上下文生成
- 基于技术栈检测的动态上下文构建
- 项目结构分析和领域关键词提取
- 为 Gemini CLI 集成优化的文件定位

### 动态变更管理
- 问题跟踪和集成 (`/workflow:issue`)
- 自动重新规划能力 (`/task:replan`)
- 无缝适应需求变更

## 📁 目录结构

```
.claude/
├── agents/                 # AI 智能体定义和行为
├── commands/              # CLI 命令实现
├── output-styles/         # 输出格式模板
├── planning-templates/    # 角色特定的规划方法
├── prompt-templates/      # AI 交互模板
├── scripts/              # 自动化脚本
├── tech-stack-templates/ # 技术栈特定模板
├── workflows/            # 工作流定义和指南
└── settings.local.json   # 本地配置
```

## 🚀 快速开始

**一键安装：**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**验证安装：**
```bash
/workflow:session list
```

## 📚 完整命令参考

### 核心命令

| 命令 | 语法 | 描述 |
|---------|--------|-------------|
| `/enhance-prompt` | `/enhance-prompt <输入>` | 增强和构造用户输入，添加技术上下文 |
| `/gemini-chat` | `/gemini-chat <查询> [--all-files] [--compress]` | 使用智能模板与 Gemini CLI 进行交互对话 |
| `/gemini-execute` | `/gemini-execute <任务ID\|描述> [--yolo] [--debug]` | 智能执行器，自动推断文件上下文 |
| `/gemini-mode` | `/gemini-mode <分析类型> <目标> [选项]` | 模板驱动的代码库分析（模式、架构、安全） |
| `/update_dms` | `/update_dms [full\|fast\|deep] [路径]` | 分布式记忆系统管理，维护层级化 CLAUDE.md |

### 工作流管理

| 命令 | 语法 | 描述 |
|---------|--------|-------------|
| `/workflow:session` | `start\|pause\|resume\|list\|switch\|status [复杂度] ["任务"]` | 会话生命周期管理，支持复杂度自适应 |
| `/workflow:brainstorm` | `/brainstorm <主题> [--perspectives=角色1,角色2]` | 多智能体概念规划，提供不同专家视角 |
| `/workflow:action-plan` | `[--from-brainstorming] [--skip-brainstorming] [--replan]` | 将概念转化为可执行的实施计划 |
| `/workflow:implement` | `[--type=simple\|medium\|complex] [--auto-create-tasks]` | 进入实施阶段，基于复杂度组织流程 |
| `/workflow:review` | `[--auto-fix]` | 最终质量保证，自动化测试和验证 |
| `/workflow:issue` | `create\|list\|update\|integrate\|close [选项]` | 动态问题和变更请求管理 |
| `/workflow:context` | `[--detailed] [--health-check] [--export]` | 统一的工作流状态和进度概览 |
| `/workflow:sync` | `[--check] [--fix] [--force]` | 在所有文件间同步工作流状态 |

### 任务执行

| 命令 | 语法 | 描述 |
|---------|--------|-------------|
| `/task:create` | `"<标题>" [--type=类型] [--priority=级别]` | 创建层级化实施任务，自动生成 ID |
| `/task:breakdown` | `<任务ID> [--strategy=auto\|interactive] [--depth=1-3]` | 智能任务分解为可管理的子任务 |
| `/task:execute` | `<任务ID> [--mode=auto\|guided] [--agent=类型]` | 执行任务，自动选择智能体 |
| `/task:replan` | `[任务ID\|--all] [--reason] [--strategy=adjust\|rebuild]` | 动态任务重新规划，适应需求变更 |
| `/task:context` | `[任务ID\|--filter] [--analyze] [--update]` | 单任务上下文分析和依赖跟踪 |
| `/task:sync` | `[--force] [--dry-run]` | 保持任务文件和跟踪文档的一致性 |

## 🎯 使用工作流

### 复杂功能开发
```bash
# 1. 启动完整文档的复杂工作流
/workflow:session start complex "实现 OAuth2 认证系统"

# 2. 多视角头脑风暴
/brainstorm "OAuth2 架构设计" --perspectives=system-architect,security-expert,data-architect

# 3. 创建详细实施计划
/workflow:action-plan --from-brainstorming

# 4. 分解为可管理的任务
/task:create "后端 API 开发"
/task:breakdown IMPL-1 --strategy=auto

# 5. 智能自动化执行
/gemini-execute IMPL-1.1 --yolo
/gemini-execute IMPL-1.2 --yolo

# 6. 处理动态变更
/workflow:issue create --type=enhancement "添加社交登录支持"
/workflow:issue integrate ISS-001 --position=next

# 7. 监控和审查
/workflow:context --detailed
/workflow:review --auto-fix
```

### 快速Bug修复
```bash
# 1. 简单任务的轻量级会话
/workflow:session start simple "修复登录按钮对齐问题"

# 2. 直接分析和实施
/gemini-chat "分析 @{src/components/Login.js} 中登录按钮的 CSS 问题"

# 3. 创建并执行单一任务
/task:create "应用登录按钮的 CSS 修复"
/task:execute IMPL-1 --mode=auto

# 4. 快速审查
/workflow:review
```

### 高级代码分析
```bash
# 1. 安全审计
/gemini-mode security "扫描认证模块的安全漏洞"

# 2. 架构分析
/gemini-mode architecture "分析组件依赖和数据流"

# 3. 性能优化
/gemini-mode performance "识别 React 渲染的瓶颈"

# 4. 模式识别
/gemini-mode pattern "提取可重用的组件模式"
```

## 📊 基于复杂度的策略

| 复杂度 | 使用场景 | 命令策略 | 文档级别 |
|------------|-----------|------------------|-------------------|
| **简单** | Bug修复、文本更改、单文件更新 | 跳过头脑风暴 → 直接实施 → 最小任务 | 轻量（会话+日志） |
| **中等** | 多文件功能、重构、API更改 | 可选头脑风暴 → 行动计划 → 2级任务 → 进度跟踪 | 中等（+ TODO_LIST.md） |
| **复杂** | 架构更改、安全模块、系统级更新 | 必需头脑风暴 → 详细规划 → 3级任务 → 风险评估 | 完整（全套文档） |

## 🔧 技术亮点

- **智能上下文处理**：基于技术栈检测的动态上下文构建
- **模板驱动架构**：通过模板实现高度可定制和可扩展性
- **质量保证集成**：内置代码审查和测试策略阶段
- **分布式记忆系统 (DMS)**：通过 CLAUDE.md 文件维护项目级共享记忆
- **CLI 优先设计**：强大、正交的命令行界面，便于自动化

## 🎨 设计理念

- **结构化优于自由发挥**：引导式工作流防止混乱和遗漏
- **可追溯性与审计**：所有决策和变更的完整审计追踪
- **自动化与人工监督**：在关键决策点保持人工确认的高度自动化
- **关注点分离**：清晰的架构，职责分明
- **可扩展性**：易于通过新的智能体、命令和模板进行扩展

## 📚 文档

- **工作流指南**：查看 `workflows/` 目录获取详细的流程文档
- **智能体定义**：检查 `agents/` 了解 AI 智能体规范
- **模板库**：探索 `planning-templates/` 和 `prompt-templates/`
- **集成指南**：查阅 `workflows/gemini-*.md` 中的 Gemini CLI 集成

## 🤝 贡献

1. Fork 此仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 打开 Pull Request

## 📄 许可证

此项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔮 未来路线图

- 增强多语言支持
- 与其他 AI 模型集成
- 高级项目分析和洞察
- 实时协作功能
- 扩展的 CI/CD 管道集成

---

**Claude Code Workflow (CCW)** - 通过智能自动化和结构化工作流变革软件开发。