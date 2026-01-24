# Prompt Templates for CLI Execution

通过 `ccw cli --tool claude` 执行各类命令的提示词模板和实际示例。

---

## 模板格式

```
任务: {task_description}

{前序完成信息（如果有）}
{完整的命令调用}
```

### 组件说明

| 组件 | 说明 | 例子 |
|------|------|------|
| `任务:` | 用户的任务描述 | "实现用户注册功能" |
| 前序完成 | 已完成命令的会话和产物 | "- /workflow:lite-plan: WFS-001 (IMPL_PLAN.md)" |
| 命令行 | 完整的命令调用 | "/workflow:lite-plan --yes \"任务\"" |

---

## 1. 规划命令 (Planning)

### 1.1 lite-plan

**模板**：
```
任务: {task_description}

/workflow:lite-plan --yes "{task_description}"
```

**实例 - 简单任务**：
```
任务: 添加用户登出功能

/workflow:lite-plan --yes "添加用户登出功能"
```

**实例 - 复杂任务**：
```
任务: 重构认证模块，实现 JWT 刷新令牌和会话管理

/workflow:lite-plan --yes "重构认证模块，实现 JWT 刷新令牌和会话管理"
```

**实例 - 带探索强制**：
```
任务: 优化数据库查询性能

/workflow:lite-plan --yes --explore "优化数据库查询性能"
```

### 1.2 plan

**模板**：
```
任务: {task_description}

/workflow:plan --yes "{task_description}"
```

**实例**：
```
任务: 实现支付系统集成 (Stripe)

/workflow:plan --yes "实现支付系统集成 (Stripe)"
```

### 1.3 multi-cli-plan

**模板**：
```
任务: {task_description}

/workflow:multi-cli-plan --yes "{task_description}"
```

**实例**：
```
任务: 设计微服务架构并实现 API 网关

/workflow:multi-cli-plan --yes "设计微服务架构并实现 API 网关"
```

---

## 2. 执行命令 (Execution)

### 2.1 lite-execute（有规划产物）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:lite-plan: {session_id} ({artifact_files})

/workflow:lite-execute --yes --in-memory
```

**实例**：
```
任务: 实现用户注册功能

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md, exploration-architecture.json, exploration-security.json)

/workflow:lite-execute --yes --in-memory
```

### 2.2 lite-execute（无规划产物）

**模板**：
```
任务: {task_description}

/workflow:lite-execute --yes "{task_description}"
```

**实例**：
```
任务: 修复页面布局响应式问题

/workflow:lite-execute --yes "修复页面布局响应式问题"
```

### 2.3 execute（有规划会话）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:plan: {session_id} ({artifact_files})

/workflow:execute --yes --resume-session="{session_id}"
```

**实例**：
```
任务: 实现微服务网关

前序完成:
- /workflow:plan: WFS-gateway-2025-01-24 (IMPL_PLAN.md, .workflow/tasks/)

/workflow:execute --yes --resume-session="WFS-gateway-2025-01-24"
```

---

## 3. Bug 修复命令 (BugFix)

### 3.1 lite-fix（轻量级修复）

**模板**：
```
任务: {task_description}

/workflow:lite-fix --yes "{task_description}"
```

**实例**：
```
任务: 修复登录表单验证失败问题

/workflow:lite-fix --yes "修复登录表单验证失败问题"
```

### 3.2 lite-fix --hotfix（紧急修复）

**模板**：
```
任务: {task_description}

/workflow:lite-fix --yes --hotfix "{task_description}"
```

**实例**：
```
任务: 紧急修复生产环境支付流程中断

/workflow:lite-fix --yes --hotfix "紧急修复生产环境支付流程中断"
```

---

## 4. 测试命令 (Testing)

### 4.1 test-cycle-execute（有前序执行）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:lite-execute: {session_id} ({artifact_files})

/workflow:test-cycle-execute --yes --session="{session_id}"
```

**实例**：
```
任务: 实现用户注册功能

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md)
- /workflow:lite-execute: WFS-register-2025-01-24 (完成)

/workflow:test-cycle-execute --yes --session="WFS-register-2025-01-24"
```

### 4.2 test-gen（生成测试）

**模板**：
```
任务: {task_description}

/workflow:test-gen --yes "{task_description}"
```

**实例**：
```
任务: 为认证模块生成单元测试

/workflow:test-gen --yes "为认证模块生成单元测试"
```

### 4.3 test-fix-gen（生成测试和修复）

**模板**：
```
任务: {task_description}

/workflow:test-fix-gen --yes "{task_description}"
```

**实例**：
```
任务: 生成并修复数据库连接超时问题的测试

/workflow:test-fix-gen --yes "生成并修复数据库连接超时问题的测试"
```

---

## 5. 代码审查命令 (Review)

### 5.1 review-session-cycle（审查执行会话）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:execute: {session_id} ({artifact_files})

/workflow:review-session-cycle --yes --session="{session_id}"
```

**实例**：
```
任务: 实现支付系统集成

前序完成:
- /workflow:plan: WFS-payment-2025-01-24 (IMPL_PLAN.md)
- /workflow:execute: WFS-payment-2025-01-24 (完成)

/workflow:review-session-cycle --yes --session="WFS-payment-2025-01-24"
```

### 5.2 review-module-cycle（审查特定模块）

**模板**：
```
任务: {task_description}

/workflow:review-module-cycle --yes "{module_path}" --dimensions="{dimensions}"
```

**实例**：
```
任务: 审查认证模块的安全性

/workflow:review-module-cycle --yes "src/auth" --dimensions="security,error-handling"
```

### 5.3 review-fix（审查和修复）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:review-session-cycle: {session_id} ({findings})

/workflow:review-fix --yes --session="{session_id}"
```

**实例**：
```
任务: 修复代码审查发现的问题

前序完成:
- /workflow:review-session-cycle: WFS-payment-2025-01-24 (审查完成)

/workflow:review-fix --yes --session="WFS-payment-2025-01-24"
```

---

## 6. 验证命令 (Verification)

### 6.1 plan-verify（计划验证）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:plan: {session_id} (IMPL_PLAN.md)

/workflow:plan-verify --yes --session="{session_id}"
```

**实例**：
```
任务: 验证支付系统实现计划

前序完成:
- /workflow:plan: WFS-payment-2025-01-24 (IMPL_PLAN.md)

/workflow:plan-verify --yes --session="WFS-payment-2025-01-24"
```

### 6.2 tdd-verify（TDD 验证）

**模板**：
```
任务: {task_description}

前序完成:
- /workflow:execute: {session_id} (完成)

/workflow:tdd-verify --yes --session="{session_id}"
```

**实例**：
```
任务: 验证 TDD 流程合规性

前序完成:
- /workflow:execute: WFS-tdd-auth-2025-01-24 (完成)

/workflow:tdd-verify --yes --session="WFS-tdd-auth-2025-01-24"
```

---

## 7. 常见命令链提示词

### 7.1 标准开发流程：plan → execute → test

**第 1 步 - 规划**：
```
任务: 实现用户注册功能，包括邮箱验证和密码加密

/workflow:lite-plan --yes "实现用户注册功能，包括邮箱验证和密码加密"
```

**第 2 步 - 执行**：
```
任务: 实现用户注册功能，包括邮箱验证和密码加密

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md, exploration-architecture.json, exploration-security.json)

/workflow:lite-execute --yes --in-memory
```

**第 3 步 - 测试**：
```
任务: 实现用户注册功能，包括邮箱验证和密码加密

前序完成:
- /workflow:lite-plan: WFS-register-2025-01-24 (IMPL_PLAN.md)
- /workflow:lite-execute: WFS-register-2025-01-24 (完成)

/workflow:test-cycle-execute --yes --session="WFS-register-2025-01-24"
```

### 7.2 完整规划流程：plan → execute → review → review-fix

**第 1 步 - 规划**：
```
任务: 重构认证模块，实现 OAuth2 和会话管理

/workflow:plan --yes "重构认证模块，实现 OAuth2 和会话管理"
```

**第 2 步 - 执行**：
```
任务: 重构认证模块，实现 OAuth2 和会话管理

前序完成:
- /workflow:plan: WFS-auth-2025-01-24 (IMPL_PLAN.md, .workflow/tasks/)

/workflow:execute --yes --resume-session="WFS-auth-2025-01-24"
```

**第 3 步 - 审查**：
```
任务: 重构认证模块，实现 OAuth2 和会话管理

前序完成:
- /workflow:plan: WFS-auth-2025-01-24 (IMPL_PLAN.md)
- /workflow:execute: WFS-auth-2025-01-24 (完成)

/workflow:review-session-cycle --yes --session="WFS-auth-2025-01-24"
```

**第 4 步 - 审查修复**：
```
任务: 重构认证模块，实现 OAuth2 和会话管理

前序完成:
- /workflow:plan: WFS-auth-2025-01-24 (IMPL_PLAN.md)
- /workflow:execute: WFS-auth-2025-01-24 (完成)
- /workflow:review-session-cycle: WFS-auth-2025-01-24 (审查完成)

/workflow:review-fix --yes --session="WFS-auth-2025-01-24"
```

### 7.3 Bug 修复 + 测试

**第 1 步 - 修复**：
```
任务: 修复页面加载超时问题

/workflow:lite-fix --yes "修复页面加载超时问题"
```

**第 2 步 - 测试**：
```
任务: 修复页面加载超时问题

前序完成:
- /workflow:lite-fix: WFS-fix-timeout-2025-01-24 (完成)

/workflow:test-cycle-execute --yes --session="WFS-fix-timeout-2025-01-24"
```

---

## 8. 参数组装规则

### 规则 1：任务描述

- 规划命令（`lite-plan`, `plan` 等）**必须** 包含任务描述
- 格式：`命令 --yes "任务描述"`

### 规则 2：会话复用

- 执行命令在有规划产物时使用 `--in-memory`
- 其他命令使用 `--session="WFS-xxx"` 引用前序会话

### 规则 3：自动确认

- 所有命令都添加 `--yes` 标志跳过交互式确认

### 规则 4：文件路径

- 需要文件路径时（如 `review-module-cycle`），使用相对于项目根的路径
- 例：`src/auth`, `src/modules/payment`

---

## 9. 特殊情况处理

### 9.1 特殊字符转义

**问题**：提示词中包含双引号

**解决**：
```bash
# 在双引号内使用 \"
ccw cli -p "任务: 实现 \"特殊\" 功能\n/workflow:lite-plan ..." --tool claude
```

### 9.2 多行任务描述

**问题**：任务描述很长

**解决**：
```
任务: 实现完整的支付系统，包括：
- Stripe 集成
- 订单管理
- 发票生成
- 退款处理

/workflow:plan --yes "实现完整的支付系统：Stripe 集成、订单管理、发票生成、退款处理"
```

### 9.3 特殊路径处理

**问题**：路径包含空格

**解决**：
```
任务: 审查用户管理模块

/workflow:review-module-cycle --yes "src/modules/user management" --dimensions="security"
```

---

## 10. 调试技巧

### 查看实际调用

在 `action-command-execute.md` 中添加日志：

```javascript
console.log(`[DEBUG] Assembling prompt for: ${cmd.command}`)
console.log(`[DEBUG] Prompt:\n${prompt}`)
console.log(`[DEBUG] CLI Call:\nccw cli -p "${escapedPrompt}" --tool claude --mode write -y`)
```

### 验证产物提取

检查 `.workflow/.ccw-coordinator/{timestamp}/commands/` 目录下的日志文件，查看 CLI 输出和产物提取结果。

### 测试提示词

手动调用 ccw cli 测试：

```bash
ccw cli -p "任务: 测试任务\n/workflow:lite-plan --yes \"测试任务\"" --tool claude --mode write -y
```
