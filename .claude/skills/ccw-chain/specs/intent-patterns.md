# Intent Detection Patterns

Complete reference for task_type pattern matching used in Phase 1.

## Pattern Priority Order

Patterns are matched in this order — first match wins.

| # | task_type | Regex Pattern | Category | Level |
|---|-----------|--------------|----------|-------|
| 1 | `bugfix-hotfix` | `(urgent\|production\|critical)` AND `(fix\|bug)` | Lightweight | 2 |
| 2 | `greenfield` | `从零开始\|from scratch\|0.*to.*1\|greenfield\|全新.*开发\|新项目\|new project\|build.*from.*ground` | Exploration | 3-4 |
| 3 | `brainstorm` | `brainstorm\|ideation\|头脑风暴\|创意\|发散思维\|creative thinking\|multi-perspective.*think\|compare perspectives\|探索.*可能` | Exploration | 4 |
| 4 | `brainstorm-to-issue` | `brainstorm.*issue\|头脑风暴.*issue\|idea.*issue\|想法.*issue\|从.*头脑风暴\|convert.*brainstorm` | Issue | 4 |
| 5 | `debug-file` | `debug.*document\|hypothesis.*debug\|troubleshoot.*track\|investigate.*log\|调试.*记录\|假设.*验证\|systematic debug\|深度调试` | With-File | 3 |
| 6 | `analyze-file` | `analyze.*document\|explore.*concept\|understand.*architecture\|investigate.*discuss\|collaborative analysis\|分析.*讨论\|深度.*理解\|协作.*分析` | With-File | 3 |
| 7 | `collaborative-plan` | `collaborative.*plan\|协作.*规划\|多人.*规划\|multi.*agent.*plan\|Plan Note\|分工.*规划` | With-File | 3 |
| 8 | `roadmap` | `roadmap\|路线.*图` | With-File | 4 |
| 9 | `spec-driven` | `spec.*gen\|specification\|PRD\|产品需求\|产品文档\|产品规格` | Exploration | 4 |
| 10 | `integration-test` | `integration.*test\|集成测试\|端到端.*测试\|e2e.*test\|integration.*cycle` | Cycle | 3 |
| 11 | `refactor` | `refactor\|重构\|tech.*debt\|技术债务` | Cycle | 3 |
| 12 | `team-planex` | `team.*plan.*exec\|team.*planex\|团队.*规划.*执行\|并行.*规划.*执行\|wave.*pipeline` | Team | Team |
| 13 | `multi-cli` | `multi.*cli\|多.*CLI\|多模型.*协作\|multi.*model.*collab` | Standard | 3 |
| 14 | `bugfix` | `fix\|bug\|error\|crash\|fail\|debug` | Lightweight | 2 |
| 15 | `issue-batch` | `(issues?\|batch)` AND `(fix\|resolve)` | Issue | Issue |
| 16 | `issue-transition` | `issue workflow\|structured workflow\|queue\|multi-stage` | Issue | 2.5 |
| 17 | `exploration` | `uncertain\|explore\|research\|what if` | Exploration | 4 |
| 18 | `quick-task` | `(quick\|simple\|small)` AND `(feature\|function)` | Lightweight | 2 |
| 19 | `ui-design` | `ui\|design\|component\|style` | Standard/Exploration | 3-4 |
| 20 | `tdd` | `tdd\|test-driven\|test first` | Standard | 3 |
| 21 | `test-fix` | `test fail\|fix test\|failing test` | Standard | 3 |
| 22 | `test-gen` | `generate test\|写测试\|add test\|补充测试` | Standard | 3 |
| 23 | `review` | `review\|code review` | Standard | 3 |
| 24 | `documentation` | `docs\|documentation\|readme` | Lightweight | 2 |
| — | `feature` | (default) | Lightweight/Standard | 2-3 |

## Complexity-Dependent Routing

Some task_types route differently based on complexity:

| task_type | Low | Medium | High |
|-----------|-----|--------|------|
| `feature` | Lightweight (rapid) | Lightweight (rapid) | Standard (coupled) |
| `greenfield` | Exploration (brainstorm-to-plan) | Exploration (greenfield-plan) | Exploration (greenfield-phased) |
| `ui-design` | Standard (ui) | Standard (ui) | Exploration (ui) |

## Example Inputs → Detected Types

| Input | Detected task_type | Category |
|-------|-------------------|----------|
| "Add API endpoint" | feature (low) | Lightweight |
| "Fix login timeout" | bugfix | Lightweight |
| "从零开始: 用户系统" | greenfield | Exploration |
| "头脑风暴: 通知系统" | brainstorm | Exploration |
| "深度调试 WebSocket" | debug-file | With-File |
| "协作分析: 认证架构" | analyze-file | With-File |
| "roadmap: OAuth + 2FA" | roadmap | With-File |
| "集成测试: 支付流程" | integration-test | Cycle |
| "重构 auth 模块" | refactor | Cycle |
| "OAuth2 system" (high) | feature (high) | Standard |
