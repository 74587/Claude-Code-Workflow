# 常见工作流模式

Gemini CLI 不仅提供单个命令，更能通过智能编排将一系列命令组合成强大的工作流，帮助您高效完成复杂任务。本指南将介绍几种常见的工作流模式。

## 1. 工作流核心概念

在深入了解具体模式之前，理解工作流的架构至关重要。Gemini CLI 的工作流管理系统旨在提供一个灵活、可扩展的框架，用于定义、执行和协调复杂的开发任务。

- **工作流 (Workflows)**：一系列任务的组合，旨在实现特定的开发目标。
- **任务 (Tasks)**：工作流中的独立工作单元，可以简单也可以复杂，有状态、输入和输出。
- **智能体 (Agents)**：通常由大型语言模型驱动，负责执行任务或在工作流中做出决策。
- **上下文 (Context)**：当前工作流的相关动态信息，包括项目状态、代码片段、文档、用户输入等，是智能决策的关键。
- **记忆 (Memory)**：持久存储上下文、工作流历史和学习模式，支持工作流的恢复、适应和改进。

详情可参考 `../../workflows/workflow-architecture.md`。

## 2. 规划 -> 执行 (Plan -> Execute) 模式

这是最基础也是最常用的工作流模式，它将一个大的目标分解为可执行的步骤，并逐步实现。

**场景**: 您有一个需要从头开始实现的新功能或模块。

**主要命令**: 
- `plan`: 启动高级规划过程，分解目标。
- `breakdown`: 进一步细化和分解 `plan` 生成的任务。
- `create`: 创建具体的实施任务。
- `execute`: 执行创建好的任务以实现代码或解决方案。

**工作流示例**:
1.  **启动规划**: `gemini plan "开发一个用户认证服务"`
    - CLI 会与您互动，明确需求，并生成一个初步的规划（可能包含多个子任务）。
2.  **任务分解** (可选，如果规划足够细致可跳过):
    - 假设 `plan` 产生了一个任务 ID `task-auth-service`。
    - `gemini breakdown task-auth-service`
    - 可能进一步分解为 `task-register`, `task-login`, `task-password-reset`等。
3.  **创建具体实现任务**:
    - `gemini create "实现用户注册 API 接口"`
    - 这会生成一个专门针对此任务的 ID，例如 `task-id-register-api`。
4.  **执行实现任务**:
    - `gemini execute task-id-register-api`
    - CLI 将调用智能体自动编写和集成代码。

## 3. 测试驱动开发 (TDD) 模式

TDD 模式强调先编写测试，再编写满足测试的代码，然后重构。Gemini CLI 通过自动化 TDD 流程来支持这一模式。

**场景**: 您正在开发一个新功能，并希望通过 TDD 确保代码质量和正确性。

**主要命令**:
- `tdd-plan`: 规划 TDD 工作流，生成红-绿-重构任务链。
- `test-gen`: 根据功能描述生成测试用例。
- `execute`: 执行代码生成和测试。
- `tdd-verify`: 验证 TDD 工作流的合规性并生成质量报告。

**工作流示例**:
1.  **TDD 规划**: `gemini tdd-plan "实现一个购物车功能"`
    - CLI 将为您创建一个 TDD 任务链，包括测试生成、代码实现和验证。
2.  **生成测试**: (通常包含在 `tdd-plan` 的早期阶段，或可以单独调用)
    - `gemini test-gen source-session-id` (如果已有一个实现会话)
    - 这会产生失败的测试（红）。
3.  **执行代码实现和测试**: 
    - `gemini execute task-id-for-code-implementation`
    - 智能体会编写代码以通过测试，并将执行测试（变为绿）。
4.  **TDD 验证**: `gemini tdd-verify`
    - 验证整个 TDD 周期是否规范执行，以及生成测试覆盖率等报告。

## 4. UI 设计与实现工作流

Gemini CLI 可以辅助您进行 UI 的设计、提取和代码生成，加速前端开发。

**场景**: 您需要基于一些设计稿或现有网站来快速构建 UI 原型或实现页面。

**主要命令**:
- `ui-designer`: 启动 UI 设计分析。
- `layout-extract`: 从参考图像或 URL 提取布局信息。
- `style-extract`: 从参考图像或 URL 提取设计风格。
- `generate`: 组合布局和设计令牌生成 UI 原型。
- `update`: 使用最终设计系统参考更新设计产物。

**工作流示例**:
1.  **启动 UI 设计分析**: `gemini ui-designer`
    - 开始一个引导式的流程，定义您的 UI 设计目标。
2.  **提取布局**: `gemini layout-extract --urls "https://example.com/some-page"`
    - 从给定 URL 提取页面布局结构。
3.  **提取样式**: `gemini style-extract --images "./design-mockup.png"`
    - 从设计图中提取颜色、字体等视觉风格。
4.  **生成 UI 原型**: `gemini generate --base-path ./my-ui-project`
    - 结合提取的布局和样式，生成可工作的 UI 代码或原型。
5.  **更新与迭代**: `gemini update --session ui-design-session-id --selected-prototypes "proto-01,proto-03"`
    - 根据反馈和最终设计系统，迭代并更新生成的 UI 产物。

## 5. 上下文搜索策略

所有这些工作流都依赖于高效的上下文管理。Gemini CLI 采用多层次的上下文搜索策略，以确保智能代理获得最相关的信息。

- **相关性优先**: 优先收集与当前任务直接相关的上下文，而非大量数据。
- **分层搜索**: 从最直接的来源（如当前打开文件）开始，逐步扩展到项目文件、记忆库和外部资源。
- **语义理解**: 利用智能搜索理解查询的意图，而非仅仅是关键词匹配。

更多细节请查阅 `../../workflows/context-search-strategy.md`。
