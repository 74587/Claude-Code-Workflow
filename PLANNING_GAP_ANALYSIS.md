# Planning环节未考虑场景深度分析

**分析日期**: 2025-11-20
**分析范围**: `/workflow:plan`, `/workflow:lite-plan`, `/workflow:tdd-plan`, `/workflow:replan`, `/cli:discuss-plan`
**分析目的**: 识别软件开发生命周期中当前planning流程未充分支持的场景

---

## 执行摘要

当前planning系统设计完善，覆盖了标准软件开发流程的核心场景（新功能开发、TDD、重构、测试）。然而，通过对15类特殊开发场景的深入分析，发现以下关键空白：

**高优先级缺失**：
1. 遗留代码重构（无测试覆盖的安全重构）
2. 紧急修复流程（生产问题hotfix）
3. 数据迁移（需要回滚计划和验证）
4. 依赖升级（breaking changes处理）

**中优先级缺失**：
5. 增量式开发/Feature Flags
6. 多团队协作同步
7. 技术债务系统化管理
8. 性能优化专项（需要baseline和profiling）

---

## 1. 增量式开发/渐进式增强场景

### 场景描述
在现有功能基础上逐步增加复杂性，通过feature flags控制渐进式发布。

### 当前Planning的局限性

**现有流程假设**：
- `/workflow:plan` 生成的任务是完整的、独立的功能单元
- `IMPL_PLAN.md` 描述的是"一次性交付"的实现方案
- 验收标准(`context.acceptance`)是二元的（完成/未完成）

**实际需求**：
```json
{
  "feature_strategy": "incremental",
  "phases": [
    {
      "phase": 1,
      "scope": "basic_functionality",
      "feature_flag": "new_auth_v1",
      "rollout_percentage": 5,
      "metrics": ["error_rate < 1%", "latency_p99 < 200ms"]
    },
    {
      "phase": 2,
      "scope": "advanced_features",
      "feature_flag": "new_auth_v2",
      "dependency": "phase_1_metrics_green",
      "rollout_percentage": 25
    }
  ],
  "rollback_trigger": "automated_on_metric_threshold"
}
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **任务分解** | 单阶段完整交付 | ❌ 多阶段渐进式任务链 |
| **验收标准** | 功能完成度 | ❌ 按阶段的指标监控 |
| **回滚计划** | 无 | ❌ Feature flag回滚策略 |
| **A/B测试** | 无 | ❌ 实验组/对照组配置 |

### 影响范围
- **action-planning-agent.md**: 需要支持`phased_rollout`策略
- **workflow-architecture.md**: `flow_control.implementation_approach`需要增加`rollout_config`字段
- **Enhanced Task JSON Schema**: 需要新字段`deployment_strategy`

### 建议改进

**新增Planning模式**: `/workflow:plan --mode incremental`

```json
{
  "deployment_strategy": {
    "type": "feature_flag_rollout",
    "phases": [
      {
        "id": "alpha",
        "flag_config": {
          "name": "feature_x_alpha",
          "enabled_for": "internal_users"
        },
        "success_criteria": [
          "zero_critical_bugs",
          "positive_user_feedback > 80%"
        ],
        "duration": "1_week",
        "rollback_on": ["critical_bug", "negative_feedback > 30%"]
      }
    ],
    "monitoring": {
      "dashboards": ["feature_x_health"],
      "alerts": ["feature_x_error_rate"]
    }
  }
}
```

---

## 2. 遗留代码重构场景

### 场景描述
重构缺少测试覆盖的遗留代码，需要在不破坏现有功能的前提下逐步改进。

### 当前Planning的局限性

**现有流程假设**：
- Context gathering (`/workflow:tools:context-gather`) 假设代码库有良好的文档和测试
- TDD planning (`/workflow:tdd-plan`) 假设可以先写测试
- 验收标准假设可以通过测试验证

**遗留代码现实**：
```
Legacy System Characteristics:
├── No existing tests (coverage = 0%)
├── No documentation (last update: 5 years ago)
├── Original developers left
├── Critical business logic (cannot break)
├── Tightly coupled architecture
└── Unknown edge cases (production behavior is spec)
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **安全网构建** | 假设有测试 | ❌ Characterization tests生成 |
| **风险评估** | 基于代码分析 | ❌ 生产流量分析/影响范围评估 |
| **重构策略** | 直接重写 | ❌ Strangler Pattern/Branch by Abstraction |
| **验证方法** | 单元测试 | ❌ 影子模式(Shadow Mode)/流量回放 |

### 影响范围
- **test-context-gather**: 当前假设tests/目录存在，需要处理coverage=0场景
- **tdd-plan**: Red-Green-Refactor不适用，需要Golden Master Testing
- **conflict-resolution**: 需要识别"遗留代码约束"类型的冲突

### 建议改进

**新增Planning模式**: `/workflow:plan --legacy-refactor`

**Phase 1: 安全网构建**
```bash
# 1. 生成Characterization Tests（捕获当前行为）
/workflow:tools:legacy-safety-net --session WFS-refactor
  → 分析生产日志提取真实输入
  → 录制当前输出作为Golden Master
  → 生成快照测试覆盖关键路径

# Output: Approval Tests for critical workflows
```

**Phase 2: Strangler Pattern规划**
```json
{
  "refactor_strategy": "strangler_pattern",
  "steps": [
    {
      "step": 1,
      "action": "Create abstraction layer",
      "legacy_code_untouched": true,
      "new_interface": "PaymentGateway",
      "routing_logic": "feature_flag_controlled"
    },
    {
      "step": 2,
      "action": "Implement new module behind abstraction",
      "parallel_run": true,
      "comparison": "assert_output_parity(legacy, new)"
    },
    {
      "step": 3,
      "action": "Gradual traffic migration",
      "rollout": [1, 5, 25, 50, 100],
      "rollback_automatic": true
    }
  ]
}
```

---

## 3. 多团队协作场景

### 场景描述
跨团队开发，存在API依赖、共享代码库、并行开发同步等协作需求。

### 当前Planning的局限性

**现有session管理假设**：
```
.workflow/active/WFS-feature/  # 单团队单功能
```

**多团队现实**：
```
Teams:
├── Team A (Frontend) → 依赖 Team B的API
├── Team B (Backend) → 依赖 Team C的数据模型
└── Team C (Data) → 依赖 Team A的UI需求

Coordination Points:
├── API Contract定义 (需要提前锁定)
├── 集成测试环境 (需要协调部署窗口)
├── 共享组件库 (需要版本兼容性管理)
└── 代码review (需要跨团队审查)
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **依赖表达** | `task.depends_on` (同session内) | ❌ 跨session/跨团队依赖 |
| **API契约** | 代码实现后确定 | ❌ Contract-first设计 |
| **同步点** | 无 | ❌ Integration milestones |
| **冲突预防** | 同一代码库检测 | ❌ 共享模块版本协调 |

### 影响范围
- **workflow-session.json**: 需要`external_dependencies`字段
- **conflict-resolution**: 需要检测跨session的模块冲突
- **IMPL_PLAN.md**: 需要"Coordination Points"章节

### 建议改进

**新增命令**: `/workflow:plan --multi-team`

```json
{
  "session_id": "WFS-checkout-flow",
  "team": "frontend",
  "external_dependencies": [
    {
      "team": "backend",
      "session_id": "WFS-payment-api",
      "contract": {
        "type": "OpenAPI",
        "spec_path": "shared/contracts/payment-api-v2.yaml",
        "locked_at": "2025-10-15",
        "status": "approved"
      },
      "blocking_tasks": ["IMPL-1", "IMPL-2"],
      "ready_by": "2025-10-20"
    }
  ],
  "coordination_points": [
    {
      "milestone": "API Contract Freeze",
      "date": "2025-10-15",
      "attendees": ["frontend", "backend"],
      "deliverable": "OpenAPI spec v2 approved"
    },
    {
      "milestone": "Integration Test",
      "date": "2025-10-25",
      "environment": "staging",
      "cross_team_test_suite": "e2e/checkout_flow.spec.ts"
    }
  ]
}
```

---

## 4. 技术债务偿还场景

### 场景描述
系统化管理技术债务，在功能开发中平衡债务偿还，评估ROI和风险。

### 当前Planning的局限性

**现有任务类型**：
```json
{
  "meta": {
    "type": "feature|bugfix|refactor|test|docs"
  }
}
```

**技术债务特性**：
- 非紧急但长期累积会造成严重影响
- 需要量化（利息成本、偿还成本）
- 需要优先级排序
- 可能跨越多个模块

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **债务识别** | 手动发现 | ❌ 自动检测（复杂度、重复代码、过时依赖） |
| **债务量化** | 无 | ❌ 技术债务指标（利息成本、偿还工时） |
| **优先级评估** | 主观判断 | ❌ ROI评分（影响×紧迫度/偿还成本） |
| **穿插策略** | 无 | ❌ 在功能开发中配额式偿还债务 |

### 影响范围
- **workflow:plan**: 需要`--tech-debt-mode`识别债务
- **action-planning-agent**: 需要债务优先级算法
- **Enhanced Task JSON**: 需要`debt_metrics`字段

### 建议改进

**新增命令**: `/workflow:debt:assess`

```bash
/workflow:debt:assess --session WFS-feature
  → Scan codebase for debt indicators:
    - Cyclomatic complexity > 15
    - Duplicated code blocks > 50 lines
    - Dependencies with CVEs
    - TODO/FIXME comments > 6 months old
  → Generate debt inventory with ROI scores
  → Recommend debt paydown tasks
```

**Debt Task JSON Schema**:
```json
{
  "id": "DEBT-001",
  "title": "Refactor UserService god class",
  "meta": {
    "type": "tech_debt",
    "debt_category": "complexity"
  },
  "debt_metrics": {
    "interest_cost": {
      "description": "每次修改需要额外30%时间理解代码",
      "monthly_cost_hours": 8
    },
    "paydown_cost": {
      "estimated_hours": 16,
      "risk_level": "medium"
    },
    "roi_score": 6.0,
    "priority": "high"
  },
  "bundled_with_feature": "IMPL-003"
}
```

---

## 5. 性能优化专项场景

### 场景描述
系统性能优化需要baseline建立、profiling分析、多次迭代实验，与常规功能开发流程不同。

### 当前Planning的局限性

**现有验收标准**：
```json
{
  "acceptance": [
    "功能X实现完成",
    "测试覆盖率>80%"
  ]
}
```

**性能优化验收标准**：
```json
{
  "acceptance": [
    "P95延迟从500ms降低到100ms",
    "CPU使用率从80%降低到40%",
    "内存占用减少30%",
    "QPS提升至10000"
  ],
  "measurement_method": "load_test_with_k6",
  "baseline": "current_production_metrics",
  "confidence_interval": "99%",
  "sample_size": "10000_requests"
}
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **Baseline建立** | 无 | ❌ 自动收集当前性能指标 |
| **Profiling集成** | 无 | ❌ 集成profiling工具（flamegraph, perf） |
| **实验流程** | 无 | ❌ 优化→测量→对比→迭代循环 |
| **A/B对比** | 无 | ❌ 性能回归检测 |

### 影响范围
- **flow_control.pre_analysis**: 需要`establish_baseline`步骤
- **flow_control.implementation_approach**: 需要支持迭代式优化
- **verification**: 需要性能测试集成

### 建议改进

**新增Planning模式**: `/workflow:plan --performance-optimization`

```json
{
  "performance_optimization": {
    "phase_0_baseline": {
      "steps": [
        {
          "action": "Capture current metrics",
          "tools": ["k6_load_test", "flamegraph_profiling"],
          "output": "baseline_report.json"
        },
        {
          "action": "Identify bottlenecks",
          "analysis": "flamegraph analysis shows DB query N+1 problem",
          "target": "reduce_db_roundtrips"
        }
      ]
    },
    "phase_1_optimization": {
      "hypothesis": "Batch DB queries to reduce roundtrips",
      "implementation": "IMPL-001",
      "verification": {
        "load_test": "k6 run scenarios/checkout.js",
        "success_criteria": "p95_latency < 200ms",
        "comparison": "baseline vs optimized"
      }
    },
    "phase_2_iteration": {
      "condition": "if p95_latency still > 150ms",
      "next_hypothesis": "Add Redis caching layer",
      "max_iterations": 3
    }
  }
}
```

---

## 6. 安全加固专项场景

### 场景描述
安全审计发现的修复、威胁建模、合规性要求（GDPR、SOC2）等安全相关工作。

### 当前Planning的局限性

**现有风险检测**：
```json
{
  "conflict_detection": {
    "risk_level": "medium",
    "risk_factors": ["architecture_complexity"]
  }
}
```

**安全专项需求**：
- 威胁建模（STRIDE框架）
- 安全审计清单
- 合规性检查点
- 渗透测试后的修复优先级

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **威胁建模** | 无 | ❌ STRIDE/DREAD框架集成 |
| **漏洞优先级** | 无 | ❌ CVSS评分、利用难度评估 |
| **合规检查** | 无 | ❌ GDPR/HIPAA/SOC2检查清单 |
| **攻击面分析** | 无 | ❌ 入口点识别、数据流追踪 |

### 建议改进

**新增Planning模式**: `/workflow:plan --security-hardening`

```json
{
  "security_hardening": {
    "threat_model": {
      "framework": "STRIDE",
      "assets": ["user_credentials", "payment_data"],
      "threats": [
        {
          "id": "T-001",
          "type": "Spoofing",
          "scenario": "攻击者伪造JWT token",
          "likelihood": "high",
          "impact": "critical",
          "mitigation_task": "IMPL-001"
        }
      ]
    },
    "audit_findings": [
      {
        "id": "CVE-2024-1234",
        "severity": "high",
        "cvss_score": 8.5,
        "affected_component": "express@4.17.1",
        "remediation": "IMPL-002"
      }
    ],
    "compliance": {
      "framework": "GDPR",
      "requirements": [
        {
          "article": "Article 17 (Right to erasure)",
          "current_status": "non_compliant",
          "gap": "用户数据删除功能缺失",
          "implementation": "IMPL-003"
        }
      ]
    }
  }
}
```

---

## 7. 数据迁移场景

### 场景描述
数据库schema变更、数据格式转换、系统迁移等需要数据迁移的场景。

### 当前Planning的局限性

**现有flow_control**：
```json
{
  "implementation_approach": [
    {"step": 1, "title": "实现功能"},
    {"step": 2, "title": "编写测试"}
  ]
}
```

**数据迁移流程**：
```
1. 备份生产数据
2. 在staging环境验证迁移脚本
3. 准备回滚脚本
4. 制定停机时间窗口
5. 执行迁移
6. 验证数据一致性
7. 监控应用健康
8. 必要时执行回滚
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **回滚计划** | 无 | ❌ 强制要求回滚脚本 |
| **数据验证** | 无 | ❌ 一致性检查、数据抽样对比 |
| **分阶段迁移** | 无 | ❌ 增量迁移、双写策略 |
| **停机窗口** | 无 | ❌ 时间预估、通知机制 |

### 建议改进

**新增Planning模式**: `/workflow:plan --data-migration`

```json
{
  "data_migration": {
    "migration_type": "schema_change",
    "estimated_downtime": "30_minutes",
    "affected_tables": ["users", "orders"],
    "record_count": 10000000,
    "strategy": "online_migration",
    "phases": [
      {
        "phase": "pre_migration",
        "tasks": [
          "IMPL-001: 创建新schema",
          "IMPL-002: 实现双写逻辑（写旧表+新表）",
          "IMPL-003: 编写验证脚本"
        ]
      },
      {
        "phase": "migration",
        "tasks": [
          "IMPL-004: 批量迁移历史数据",
          "verification": "每1000条记录对比checksum"
        ]
      },
      {
        "phase": "post_migration",
        "tasks": [
          "IMPL-005: 切换读取到新表",
          "IMPL-006: 停止双写，删除旧表"
        ]
      }
    ],
    "rollback_plan": {
      "trigger": "data_inconsistency_detected",
      "steps": [
        "停止应用",
        "从备份恢复",
        "验证数据完整性"
      ],
      "script": "scripts/rollback_migration_001.sql"
    }
  }
}
```

---

## 8. 紧急修复场景

### 场景描述
生产环境严重问题需要立即修复，时间压力下简化流程。

### 当前Planning的局限性

**现有最快流程**: `/workflow:lite-plan`
- 仍然包含完整的exploration和planning阶段
- 没有"紧急模式"的流程简化
- 缺少hotfix分支管理

**紧急修复实际需求**：
```
时间线:
├── T+0: 生产故障告警
├── T+5min: 确认问题根因
├── T+15min: 代码修复完成
├── T+20min: 快速验证（非完整测试）
├── T+25min: 部署到生产
└── T+30min: 监控确认修复
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **流程简化** | 标准流程 | ❌ 紧急模式跳过非关键步骤 |
| **快速验证** | 完整测试套件 | ❌ Smoke test快速验证 |
| **Hotfix分支** | 标准分支策略 | ❌ 从production tag创建hotfix分支 |
| **事后补充** | 无 | ❌ 生成"技术债务"任务补充完整修复 |

### 建议改进

**新增命令**: `/workflow:hotfix`

```bash
/workflow:hotfix --critical "修复支付失败问题" --incident INC-2024-1015
```

**简化流程**：
```json
{
  "hotfix_mode": true,
  "incident_id": "INC-2024-1015",
  "severity": "critical",
  "phases": [
    {
      "phase": "diagnosis",
      "max_duration": "10_minutes",
      "action": "快速根因分析",
      "skip": ["deep_code_exploration"]
    },
    {
      "phase": "fix",
      "branch_strategy": "hotfix_from_production_tag",
      "implementation": "IMPL-HOTFIX-001",
      "skip": ["comprehensive_testing", "code_review"]
    },
    {
      "phase": "verification",
      "test_level": "smoke_test_only",
      "acceptance": ["关键路径验证通过"]
    },
    {
      "phase": "deployment",
      "approval": "incident_commander",
      "monitoring": "real_time_error_rate"
    }
  ],
  "follow_up_tasks": [
    {
      "id": "IMPL-001",
      "title": "补充完整测试覆盖",
      "type": "tech_debt",
      "due_date": "within_3_days"
    },
    {
      "id": "IMPL-002",
      "title": "根因分析报告",
      "type": "docs",
      "due_date": "within_1_week"
    }
  ]
}
```

---

## 9. 依赖升级场景

### 场景描述
升级第三方库、框架或运行时版本，处理breaking changes和兼容性问题。

### 当前Planning的局限性

**现有依赖处理**：
```json
{
  "dependencies": {
    "internal": [...],
    "external": [...]
  }
}
```
仅列出依赖，不处理升级策略。

**依赖升级实际需求**：
```
Example: React 17 → React 18
├── Breaking Changes识别
│   ├── 自动批处理行为变更
│   └── Suspense API变化
├── 兼容性测试
│   ├── 运行完整测试套件
│   └── 手动测试关键流程
├── 渐进式升级
│   ├── 先升级dev dependencies
│   └── 再升级production dependencies
└── 降级回退方案
    └── package.json.backup
```

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **Breaking Changes分析** | 无 | ❌ 自动扫描changelog |
| **兼容性测试** | 标准测试 | ❌ 依赖升级专项测试策略 |
| **降级方案** | 无 | ❌ 快速回退到旧版本 |
| **分阶段升级** | 无 | ❌ dev → staging → production策略 |

### 建议改进

**新增Planning模式**: `/workflow:plan --dependency-upgrade`

```bash
/workflow:plan --dependency-upgrade "React 17 → 18"
```

```json
{
  "dependency_upgrade": {
    "package": "react",
    "from_version": "17.0.2",
    "to_version": "18.2.0",
    "breaking_changes": [
      {
        "change": "Automatic batching",
        "impact": "setState调用行为变更",
        "affected_files": ["src/components/Form.tsx"],
        "mitigation": "IMPL-001: 审查状态更新逻辑"
      }
    ],
    "testing_strategy": {
      "unit_tests": "全量运行",
      "integration_tests": "全量运行",
      "e2e_tests": "关键路径",
      "manual_testing": "regression_test_checklist.md"
    },
    "rollout_plan": {
      "stage_1": "dev_environment",
      "stage_2": "staging_environment",
      "stage_3": "production_canary_10%",
      "stage_4": "production_full_rollout"
    },
    "rollback_plan": {
      "backup": "package.json + package-lock.json",
      "quick_revert": "git revert <commit> && npm install"
    }
  }
}
```

---

## 10. 实验性探索场景 (Spike/POC)

### 场景描述
技术可行性验证、原型开发、快速失败的研究性工作。

### 当前Planning的局限性

**现有验收标准**：
- 假设任务有明确的成功标准
- 假设所有任务都会"完成"

**Spike任务特点**：
- 时间盒限制（固定时间后必须停止）
- 可能结论是"不可行"（这也是成功）
- 输出是"学习成果"而非"生产代码"

### Gap分析

| 维度 | 当前支持 | 缺失功能 |
|------|---------|---------|
| **时间盒** | 无 | ❌ 固定时间预算（探索2天后必须决策） |
| **成功定义** | 功能完成 | ❌ "获得足够信息做决策"即成功 |
| **输出形式** | 代码 | ❌ ADR (Architecture Decision Record) |
| **并行探索** | 无 | ❌ 同时探索多个技术方案 |

### 建议改进

**新增Planning模式**: `/workflow:spike`

```bash
/workflow:spike --timebox 2days "评估三种状态管理方案"
```

```json
{
  "spike_config": {
    "research_question": "选择合适的状态管理方案",
    "timebox": "2_days",
    "parallel_explorations": [
      {
        "id": "SPIKE-001",
        "approach": "Redux Toolkit",
        "success_criteria": "实现一个代表性功能，评估开发体验"
      },
      {
        "id": "SPIKE-002",
        "approach": "Zustand",
        "success_criteria": "同样功能对比代码量和性能"
      },
      {
        "id": "SPIKE-003",
        "approach": "Jotai",
        "success_criteria": "评估学习曲线和文档质量"
      }
    ],
    "decision_criteria": [
      "开发体验 (权重40%)",
      "性能 (权重30%)",
      "生态系统 (权重20%)",
      "团队熟悉度 (权重10%)"
    ],
    "output": {
      "type": "ADR",
      "path": "docs/adr/0005-state-management-choice.md",
      "includes": [
        "各方案优缺点对比",
        "推荐方案和理由",
        "POC代码链接"
      ]
    },
    "post_spike": {
      "decision": "proceed_with_zustand",
      "follow_up_task": "IMPL-001: 迁移到Zustand"
    }
  }
}
```

---

## 11-15. 其他场景简要分析

### 11. 多版本并行维护场景
**Gap**: 当前session管理假设单版本开发
**需求**: 需要支持`version_branch`字段，安全补丁向多版本移植
**建议**: `/workflow:plan --version v2.x --backport-to v1.x,v1.y`

### 12. 监控和可观测性增强场景
**Gap**: 当前planning关注业务功能，忽略运维需求
**需求**: SLI/SLO定义、日志/指标/追踪规划、告警规则设计
**建议**: `/workflow:plan --observability` 生成包含监控配置的任务

### 13. 文档补充场景
**Gap**: 文档任务缺少模板和验证标准
**需求**: API文档自动生成、ADR模板、代码注释覆盖率
**建议**: `/workflow:plan --docs-type api|adr|inline` 根据类型生成结构化任务

### 14. DevOps流程改进场景
**Gap**: Planning聚焦应用代码，忽略基础设施代码
**需求**: Terraform/Ansible代码规划、CI/CD pipeline优化
**建议**: `/workflow:plan --infra-as-code` 支持IaC任务规划

### 15. 可访问性(A11y)改进场景
**Gap**: 缺少WCAG标准合规检查
**需求**: 屏幕阅读器测试、键盘导航、ARIA标签审计
**建议**: `/workflow:plan --a11y` 生成可访问性测试任务

---

## 优先级建议

### 🔴 高优先级（建议立即实现）

1. **遗留代码重构支持** (`/workflow:plan --legacy-refactor`)
   - **理由**: 大量实际项目面临遗留代码维护
   - **实现成本**: 中等（新增safety-net工具 + strangler pattern模板）
   - **影响范围**: test-context-gather, tdd-plan

2. **紧急修复流程** (`/workflow:hotfix`)
   - **理由**: 生产问题需要快速响应
   - **实现成本**: 低（简化现有流程 + hotfix分支策略）
   - **影响范围**: 新增独立命令

3. **数据迁移专项** (`/workflow:plan --data-migration`)
   - **理由**: 数据迁移风险高，需要强制回滚计划
   - **实现成本**: 中等（新增migration-specific验证步骤）
   - **影响范围**: flow_control schema, verification phase

### 🟡 中优先级（建议3个月内实现）

4. **依赖升级管理** (`/workflow:plan --dependency-upgrade`)
5. **增量式发布** (`/workflow:plan --mode incremental`)
6. **技术债务管理** (`/workflow:debt:assess`)
7. **性能优化专项** (`/workflow:plan --performance-optimization`)

### 🟢 低优先级（可选增强）

8-15. 其他场景

---

## 实现路线图

### Phase 1: 核心场景支持（Sprint 1-2）
- [ ] `/workflow:hotfix` - 紧急修复快速通道
- [ ] `/workflow:plan --legacy-refactor` - 遗留代码安全重构
- [ ] Enhanced Task JSON Schema扩展（支持新场景字段）

### Phase 2: 高级场景支持（Sprint 3-4）
- [ ] `/workflow:plan --data-migration` - 数据迁移规划
- [ ] `/workflow:plan --dependency-upgrade` - 依赖升级管理
- [ ] `/workflow:debt:assess` - 技术债务评估

### Phase 3: 专项优化（Sprint 5-6）
- [ ] `/workflow:plan --performance-optimization` - 性能优化流程
- [ ] `/workflow:plan --security-hardening` - 安全加固
- [ ] `/workflow:plan --multi-team` - 多团队协作

### Phase 4: 长尾场景（按需实现）
- [ ] `/workflow:spike` - 实验性探索
- [ ] 其他场景

---

## 技术实现建议

### 1. 扩展Enhanced Task JSON Schema

**当前schema** (5个核心字段):
```json
{
  "id": "...",
  "title": "...",
  "status": "...",
  "meta": {...},
  "context": {...},
  "flow_control": {...}
}
```

**扩展字段建议**:
```json
{
  "scenario_type": "legacy_refactor|data_migration|hotfix|...",
  "scenario_config": {
    // 场景特定配置，根据scenario_type动态验证
  }
}
```

### 2. 命令层扩展

**新增参数**: `--scenario <type>` 或 `--mode <type>`

```bash
/workflow:plan --scenario legacy-refactor "重构支付模块"
/workflow:plan --scenario data-migration "迁移用户表schema"
/workflow:hotfix --critical "修复内存泄漏"
```

### 3. Agent增强

**action-planning-agent.md** 需要支持:
- 场景识别逻辑
- 场景特定的pre_analysis步骤
- 场景特定的验收标准模板

---

## 结论

当前Planning系统在标准软件开发流程上设计优秀，但在以下15类特殊场景存在支持空白：

**关键发现**:
1. **遗留代码**、**紧急修复**、**数据迁移**是最紧迫的缺失场景
2. 当前系统架构具备良好扩展性，可通过scenario_type字段扩展
3. 建议采用渐进式实现策略，优先支持高影响场景

**影响评估**:
- **高**: 遗留代码重构、紧急修复、数据迁移（影响50%+实际项目）
- **中**: 依赖升级、技术债务、性能优化（影响30%项目）
- **低**: 其他场景（影响<20%项目，但对特定领域关键）

**下一步行动**:
1. 评审本分析报告，确认优先级
2. 设计Enhanced Task JSON Schema扩展方案
3. 实现Phase 1高优先级场景（预计2个sprint）
4. 迭代收集用户反馈，调整后续优先级

---

**文档版本**: 1.0
**作者**: Claude (Sonnet 4.5)
**审阅状态**: 待审阅
