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

## 🛠️ 安装

### 快速安装（推荐）

**一键远程安装：**

```powershell
# PowerShell (Windows/Linux/macOS)
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-CCW/main/install-remote.ps1" -UseBasicParsing).Content
```

**带参数安装：**
```powershell
# 全局安装
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-CCW/main/install-remote.ps1" -UseBasicParsing).Content | ForEach-Object { iex "$_ -Global" }

# 自定义目录安装
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-CCW/main/install-remote.ps1" -UseBasicParsing).Content | ForEach-Object { iex "$_ -Directory 'C:\MyCustomPath'" }

# 强制安装（覆盖现有文件）
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-CCW/main/install-remote.ps1" -UseBasicParsing).Content | ForEach-Object { iex "$_ -Force" }
```

### 手动安装

1. 克隆此仓库：
```bash
git clone https://github.com/catlog22/Claude-CCW.git
cd Claude-CCW
```

2. 运行本地安装脚本：
```powershell
# Windows PowerShell
.\Install-Claude.ps1

# 带参数
.\Install-Claude.ps1 -InstallMode Global -Force
```

3. 或手动设置环境：
```bash
# 复制到您的 Claude Code 配置目录
cp -r .claude ~/.claude/
# 或在 Windows 上
xcopy .claude %USERPROFILE%\.claude /E /I
```

4. 验证安装：
```bash
/workflow:session list
```

### 安装选项

| 参数 | 说明 | 示例 |
|-----------|-------------|---------|
| `-Global` | 系统级安装 | `-Global` |
| `-Directory` | 自定义安装路径 | `-Directory "C:\CCW"` |
| `-Force` | 覆盖现有安装 | `-Force` |
| `-NoBackup` | 跳过现有文件备份 | `-NoBackup` |
| `-NonInteractive` | 静默安装 | `-NonInteractive` |
| `-Branch` | 从特定分支安装 | `-Branch "develop"` |

## 📖 使用指南

### 启动复杂工作流

1. **初始化会话**：
```bash
/workflow:session start complex "实现 OAuth2 用户认证系统"
```

2. **概念规划**（可选但推荐）：
```bash
/brainstorm "设计 OAuth2 认证系统架构" --perspectives=system-architect,security-expert,data-architect
```

3. **创建行动计划**：
```bash
/workflow:action-plan --from-brainstorming
```

4. **任务创建与分解**：
```bash
/task:create "后端 API 开发"
/task:breakdown IMPL-1
```

5. **执行任务**：
```bash
/task:execute IMPL-1.1
```

6. **处理变更**：
```bash
/workflow:issue create --type=bug "JWT 令牌刷新逻辑漏洞"
/workflow:issue integrate ISS-001 --position=immediate
```

7. **监控进度**：
```bash
/workflow:context --detailed
/task:context IMPL-1.2
```

8. **审查与完成**：
```bash
/workflow:review
```

## 🎯 关键命令

| 命令 | 用途 |
|---------|---------|
| `/workflow:session` | 管理工作流会话 |
| `/brainstorm` | 多视角概念规划 |
| `/workflow:action-plan` | 将概念转化为实施计划 |
| `/task:breakdown` | 将任务分解为可执行单元 |
| `/task:execute` | 执行特定任务 |
| `/workflow:issue` | 管理问题和变更 |
| `/gemini-execute` | 增强的 Gemini CLI 集成 |
| `/update_dms` | 维护分布式记忆系统 |

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