# 任务执行计划 JSON 表达结构设计

## 概述

本文档定义了任务执行计划的标准化JSON表达结构，用于描述、调度和跟踪复杂任务的执行流程。该结构支持依赖关系、并行执行、条件分支、错误处理和实时监控。

## 一、核心架构设计

### 1.1 执行计划层次结构

```
ExecutionPlan (执行计划)
├── MetaData (元数据)
├── ExecutionContext (执行上下文)
├── TaskGraph (任务图)
├── ExecutionPhases (执行阶段)
├── SchedulingRules (调度规则)
├── MonitoringConfig (监控配置)
└── ErrorHandling (错误处理)
```

### 1.2 执行模式分类

```typescript
type ExecutionMode = 
  | 'sequential'     // 顺序执行
  | 'parallel'       // 并行执行
  | 'pipeline'       // 管道执行
  | 'conditional'    // 条件执行
  | 'hybrid';        // 混合模式
```

## 二、JSON Schema 定义

### 2.1 执行计划根结构

```json
{
  "$schema": "https://claude-code.com/schemas/execution-plan/v1.1.json",
  "plan_id": "EXEC-WFS-oauth-system-001",
  "plan_name": "OAuth2 Authentication System Implementation",
  "version": "1.2.0",
  "created_at": "2025-09-06T14:30:00Z",
  "updated_at": "2025-09-06T15:45:00Z",
  "created_by": "planning-agent",
  
  "metadata": {
    "workflow_id": "WFS-oauth-system", 
    "session_id": "SESSION-20250906-001",
    "project_context": "Implement secure OAuth2 authentication with JWT tokens",
    "estimated_duration": "PT18H",
    "complexity": "high",
    "risk_level": "medium",
    "tags": ["authentication", "security", "oauth2", "jwt"],
    "stakeholders": ["backend-team", "security-team", "qa-team"]
  },
  
  "execution_context": {
    "environment": "development",
    "base_directory": "/project/oauth-system",
    "tech_stack": ["nodejs", "typescript", "postgresql", "redis"],
    "prerequisites": [
      "database_setup_complete",
      "development_environment_ready", 
      "dependencies_installed"
    ],
    "global_variables": {
      "API_VERSION": "v2",
      "DB_CONNECTION": "postgresql://localhost:5432/oauth_db",
      "REDIS_URL": "redis://localhost:6379"
    }
  },
  
  "task_graph": {
    "nodes": [
      {
        "task_id": "IMPL-001",
        "name": "Database Schema Design",
        "type": "design",
        "agent": "planning-agent",
        "estimated_duration": "PT2H",
        "priority": "high",
        "dependencies": [],
        "outputs": ["schema.sql", "migration_scripts"],
        "validation_criteria": ["schema_validates", "migrations_tested"]
      },
      {
        "task_id": "IMPL-002", 
        "name": "User Model Implementation",
        "type": "implementation",
        "agent": "code-developer",
        "estimated_duration": "PT3H",
        "priority": "high", 
        "dependencies": ["IMPL-001"],
        "inputs": ["schema.sql"],
        "outputs": ["user.model.ts", "user.repository.ts"],
        "validation_criteria": ["unit_tests_pass", "integration_tests_pass"]
      },
      {
        "task_id": "IMPL-003",
        "name": "JWT Token Service", 
        "type": "implementation",
        "agent": "code-developer",
        "estimated_duration": "PT4H",
        "priority": "critical",
        "dependencies": ["IMPL-002"],
        "inputs": ["user.model.ts"],
        "outputs": ["jwt.service.ts", "token.interface.ts"],
        "validation_criteria": ["security_audit_pass", "performance_test_pass"]
      },
      {
        "task_id": "IMPL-004",
        "name": "OAuth2 Flow Implementation",
        "type": "implementation", 
        "agent": "code-developer",
        "estimated_duration": "PT5H",
        "priority": "critical",
        "dependencies": ["IMPL-003"],
        "inputs": ["jwt.service.ts", "user.repository.ts"],
        "outputs": ["oauth2.controller.ts", "oauth2.service.ts"],
        "validation_criteria": ["oauth2_spec_compliance", "security_validated"]
      },
      {
        "task_id": "IMPL-005",
        "name": "API Middleware Integration",
        "type": "integration",
        "agent": "code-developer", 
        "estimated_duration": "PT2H",
        "priority": "normal",
        "dependencies": ["IMPL-004"],
        "inputs": ["oauth2.service.ts"],
        "outputs": ["auth.middleware.ts", "rate-limit.middleware.ts"],
        "validation_criteria": ["middleware_tests_pass", "integration_verified"]
      },
      {
        "task_id": "IMPL-006",
        "name": "Comprehensive Testing Suite",
        "type": "testing",
        "agent": "test-agent",
        "estimated_duration": "PT4H",
        "priority": "high",
        "dependencies": ["IMPL-005"],
        "inputs": ["oauth2.controller.ts", "auth.middleware.ts"],
        "outputs": ["test.suite.ts", "integration.test.ts", "security.test.ts"],
        "validation_criteria": ["95%_coverage", "all_tests_pass", "security_tests_pass"]
      }
    ],
    
    "edges": [
      {
        "from": "IMPL-001",
        "to": "IMPL-002", 
        "type": "hard_dependency",
        "condition": "deliverables_complete",
        "weight": 1.0
      },
      {
        "from": "IMPL-002",
        "to": "IMPL-003",
        "type": "hard_dependency", 
        "condition": "validation_passed",
        "weight": 1.0
      },
      {
        "from": "IMPL-003",
        "to": "IMPL-004",
        "type": "hard_dependency",
        "condition": "security_approved", 
        "weight": 1.0
      },
      {
        "from": "IMPL-004", 
        "to": "IMPL-005",
        "type": "hard_dependency",
        "condition": "integration_ready",
        "weight": 0.8
      },
      {
        "from": "IMPL-005",
        "to": "IMPL-006",
        "type": "soft_dependency",
        "condition": "implementation_stable",
        "weight": 0.6
      }
    ]
  },
  
  "execution_phases": [
    {
      "phase_id": "PHASE-001",
      "name": "Foundation Setup",
      "description": "Core database and model setup",
      "execution_mode": "sequential",
      "tasks": ["IMPL-001", "IMPL-002"],
      "estimated_duration": "PT5H",
      "success_criteria": [
        "database_schema_deployed",
        "user_model_functional", 
        "unit_tests_passing"
      ],
      "rollback_strategy": {
        "type": "database_rollback",
        "checkpoint": "pre_migration_state"
      }
    },
    {
      "phase_id": "PHASE-002", 
      "name": "Security Implementation",
      "description": "JWT and OAuth2 security layer",
      "execution_mode": "sequential",
      "tasks": ["IMPL-003", "IMPL-004"],
      "estimated_duration": "PT9H",
      "success_criteria": [
        "jwt_tokens_working",
        "oauth2_flow_complete",
        "security_audit_passed"
      ],
      "rollback_strategy": {
        "type": "code_rollback", 
        "checkpoint": "post_foundation_state"
      }
    },
    {
      "phase_id": "PHASE-003",
      "name": "Integration & Testing",
      "description": "System integration and comprehensive testing", 
      "execution_mode": "parallel",
      "tasks": ["IMPL-005", "IMPL-006"],
      "estimated_duration": "PT4H", 
      "success_criteria": [
        "middleware_integrated",
        "all_tests_passing",
        "performance_benchmarks_met"
      ],
      "rollback_strategy": {
        "type": "feature_rollback",
        "checkpoint": "pre_integration_state"
      }
    }
  ],
  
  "scheduling_rules": {
    "execution_strategy": "hybrid",
    "max_parallel_tasks": 3,
    "resource_allocation": {
      "code-developer": {
        "max_concurrent": 2,
        "priority_weight": 0.8
      },
      "planning-agent": {
        "max_concurrent": 1, 
        "priority_weight": 0.9
      },
      "test-agent": {
        "max_concurrent": 1,
        "priority_weight": 0.7
      }
    },
    
    "timing_constraints": {
      "business_hours_only": false,
      "max_daily_duration": "PT8H",
      "break_intervals": ["PT4H"],
      "maintenance_windows": ["02:00-04:00"]
    },
    
    "priority_rules": [
      {
        "rule": "critical_tasks_first",
        "condition": "priority == 'critical'",
        "weight_multiplier": 2.0
      },
      {
        "rule": "security_tasks_priority", 
        "condition": "tags.includes('security')",
        "weight_multiplier": 1.5
      },
      {
        "rule": "dependency_chain_priority",
        "condition": "is_on_critical_path",
        "weight_multiplier": 1.3
      }
    ],
    
    "load_balancing": {
      "strategy": "least_loaded_agent",
      "consider_task_type": true,
      "agent_affinity": true,
      "failover_enabled": true
    }
  },
  
  "monitoring_config": {
    "realtime_tracking": true,
    "progress_update_interval": 300,
    "checkpoint_frequency": "per_task",
    
    "metrics_collection": {
      "execution_time": true,
      "resource_usage": true, 
      "error_rates": true,
      "agent_performance": true,
      "dependency_wait_time": true
    },
    
    "notifications": [
      {
        "trigger": "task_completed",
        "channels": ["log", "console"],
        "include_metrics": true
      },
      {
        "trigger": "task_failed", 
        "channels": ["log", "console", "alert"],
        "include_stacktrace": true
      },
      {
        "trigger": "phase_completed",
        "channels": ["log", "console"],
        "include_summary": true
      },
      {
        "trigger": "execution_blocked",
        "channels": ["alert", "console"], 
        "escalation_delay": 300
      }
    ],
    
    "dashboard_config": {
      "enabled": true,
      "refresh_interval": 30,
      "show_critical_path": true,
      "show_agent_load": true,
      "show_timeline": true
    }
  },
  
  "error_handling": {
    "global_retry_policy": {
      "max_retries": 3,
      "backoff_strategy": "exponential",
      "base_delay": 60,
      "max_delay": 1800
    },
    
    "task_specific_policies": {
      "IMPL-003": {
        "max_retries": 5,
        "custom_validation": "security_check_required",
        "escalation_on_failure": "security-team"
      },
      "IMPL-006": {
        "max_retries": 2, 
        "allow_partial_success": true,
        "minimum_coverage": 0.90
      }
    },
    
    "failure_scenarios": [
      {
        "scenario": "agent_unavailable",
        "action": "reassign_to_backup_agent",
        "parameters": {
          "backup_agents": ["general-purpose"],
          "context_preservation": true
        }
      },
      {
        "scenario": "dependency_failure",
        "action": "pause_downstream_tasks",
        "parameters": {
          "notification_required": true,
          "manual_intervention": true
        }
      },
      {
        "scenario": "resource_exhaustion",
        "action": "reduce_parallelism", 
        "parameters": {
          "reduction_factor": 0.5,
          "temporary_duration": 1800
        }
      },
      {
        "scenario": "critical_task_failure",
        "action": "escalate_and_pause",
        "parameters": {
          "escalation_targets": ["project-lead", "tech-lead"],
          "pause_execution": true,
          "preserve_state": true
        }
      }
    ],
    
    "rollback_strategies": {
      "automatic_rollback": {
        "enabled": true,
        "trigger_conditions": [
          "critical_task_failure",
          "security_validation_failure", 
          "data_corruption_detected"
        ],
        "preserve_logs": true,
        "notify_stakeholders": true
      },
      
      "manual_rollback": {
        "checkpoints_available": true,
        "granularity": "per_phase",
        "rollback_verification": "required"
      }
    }
  },
  
  "execution_state": {
    "status": "planned",
    "current_phase": null,
    "active_tasks": [],
    "completed_tasks": [],
    "failed_tasks": [],
    "blocked_tasks": [],
    
    "progress": {
      "overall_percentage": 0,
      "tasks_completed": 0,
      "tasks_total": 6,
      "estimated_remaining": "PT18H",
      "actual_elapsed": "PT0H"
    },
    
    "resource_utilization": {
      "code-developer": {
        "active_tasks": 0,
        "load_percentage": 0,
        "queue_depth": 0
      },
      "planning-agent": {
        "active_tasks": 0, 
        "load_percentage": 0,
        "queue_depth": 0
      },
      "test-agent": {
        "active_tasks": 0,
        "load_percentage": 0, 
        "queue_depth": 0
      }
    },
    
    "execution_timeline": [],
    "performance_metrics": {},
    "last_checkpoint": null,
    "next_scheduled_task": "IMPL-001"
  },
  
  "validation_rules": {
    "pre_execution": [
      {
        "rule": "all_dependencies_available",
        "description": "验证所有依赖项已准备就绪"
      },
      {
        "rule": "agents_available",
        "description": "验证所需Agent可用"
      },
      {
        "rule": "resources_sufficient", 
        "description": "验证系统资源充足"
      }
    ],
    
    "during_execution": [
      {
        "rule": "task_validation_passed",
        "description": "每个任务必须通过验证标准"
      },
      {
        "rule": "dependency_constraints_met",
        "description": "依赖约束必须满足"
      },
      {
        "rule": "resource_limits_respected",
        "description": "不得超出资源限制"
      }
    ],
    
    "post_execution": [
      {
        "rule": "all_deliverables_produced",
        "description": "所有预期产出物已生成"
      },
      {
        "rule": "quality_gates_passed", 
        "description": "质量门禁检查通过"
      },
      {
        "rule": "integration_tests_passed",
        "description": "集成测试全部通过"
      }
    ]
  }
}
```

## 三、执行计划操作接口

### 3.1 执行计划操作

```typescript
// 执行计划操作接口
interface ExecutionPlanOperations {
  // 基础操作
  create(plan: ExecutionPlanDefinition): Promise<ExecutionPlan>;
  validate(plan: ExecutionPlan): Promise<ValidationResult>;
  execute(planId: string, options?: ExecutionOptions): Promise<ExecutionSession>;
  pause(planId: string): Promise<void>;
  resume(planId: string): Promise<void>;
  abort(planId: string, reason: string): Promise<void>;
  
  // 查询操作
  getStatus(planId: string): Promise<ExecutionStatus>;
  getProgress(planId: string): Promise<ProgressReport>;
  getMetrics(planId: string): Promise<PerformanceMetrics>;
  
  // 修改操作
  updatePlan(planId: string, updates: Partial<ExecutionPlan>): Promise<ExecutionPlan>;
  addTask(planId: string, task: TaskDefinition): Promise<void>;
  removeTask(planId: string, taskId: string): Promise<void>;
  modifyDependency(planId: string, dependency: DependencyUpdate): Promise<void>;
  
  // 高级操作
  optimizePlan(planId: string, criteria: OptimizationCriteria): Promise<OptimizedPlan>;
  simulateExecution(planId: string): Promise<SimulationResult>;
  generateReport(planId: string, format: 'json' | 'html' | 'markdown'): Promise<string>;
}
```

### 3.2 执行状态查询

```json
{
  "query_api": {
    "get_current_status": {
      "endpoint": "/execution-plans/{planId}/status",
      "response": {
        "plan_id": "EXEC-WFS-oauth-system-001",
        "status": "executing",
        "current_phase": "PHASE-002",
        "active_tasks": ["IMPL-003"],
        "progress": {
          "overall": 45,
          "current_phase": 60,
          "estimated_completion": "2025-09-07T08:30:00Z"
        },
        "agent_status": {
          "code-developer": "busy",
          "planning-agent": "idle", 
          "test-agent": "idle"
        }
      }
    },
    
    "get_execution_timeline": {
      "endpoint": "/execution-plans/{planId}/timeline",
      "response": [
        {
          "timestamp": "2025-09-06T14:30:00Z",
          "event": "execution_started",
          "details": {"phase": "PHASE-001"}
        },
        {
          "timestamp": "2025-09-06T16:45:00Z",
          "event": "task_completed", 
          "details": {"task_id": "IMPL-001", "duration": "PT2H15M"}
        },
        {
          "timestamp": "2025-09-06T17:00:00Z",
          "event": "task_started",
          "details": {"task_id": "IMPL-002", "agent": "code-developer"}
        }
      ]
    },
    
    "get_performance_metrics": {
      "endpoint": "/execution-plans/{planId}/metrics",
      "response": {
        "execution_efficiency": 0.87,
        "average_task_duration": "PT2H30M",
        "agent_utilization": {
          "code-developer": 0.85,
          "planning-agent": 0.60,
          "test-agent": 0.40
        },
        "bottlenecks": [
          {
            "task_id": "IMPL-003",
            "reason": "complexity_underestimated",
            "impact": "15_minute_delay"
          }
        ]
      }
    }
  }
}
```

## 四、执行计划模式库

### 4.1 常用执行模式模板

```json
{
  "execution_patterns": {
    "feature_development": {
      "name": "Feature Development Pattern",
      "description": "Standard feature implementation workflow",
      "phases": [
        {"name": "Design", "mode": "sequential"},
        {"name": "Implementation", "mode": "parallel"},
        {"name": "Testing", "mode": "sequential"},
        {"name": "Integration", "mode": "sequential"}
      ],
      "estimated_duration": "PT12H",
      "agent_requirements": ["planning-agent", "code-developer", "test-agent"],
      "success_rate": 0.92
    },
    
    "bug_fix": {
      "name": "Bug Fix Pattern",
      "description": "Rapid bug diagnosis and resolution",
      "phases": [
        {"name": "Diagnosis", "mode": "sequential"},
        {"name": "Fix Implementation", "mode": "sequential"}, 
        {"name": "Verification", "mode": "parallel"}
      ],
      "estimated_duration": "PT4H",
      "agent_requirements": ["code-developer", "test-agent"],
      "success_rate": 0.95
    },
    
    "refactoring": {
      "name": "Code Refactoring Pattern", 
      "description": "Safe code restructuring workflow",
      "phases": [
        {"name": "Analysis", "mode": "sequential"},
        {"name": "Planning", "mode": "sequential"},
        {"name": "Incremental Changes", "mode": "sequential"},
        {"name": "Validation", "mode": "parallel"}
      ],
      "estimated_duration": "PT8H",
      "agent_requirements": ["code-review-agent", "code-developer", "test-agent"],
      "success_rate": 0.88
    },
    
    "integration": {
      "name": "System Integration Pattern",
      "description": "Multi-component integration workflow", 
      "phases": [
        {"name": "Compatibility Check", "mode": "parallel"},
        {"name": "Interface Design", "mode": "sequential"},
        {"name": "Integration Implementation", "mode": "parallel"},
        {"name": "End-to-End Testing", "mode": "sequential"}
      ],
      "estimated_duration": "PT16H",
      "agent_requirements": ["planning-agent", "code-developer", "test-agent"],
      "success_rate": 0.83
    }
  }
}
```

### 4.2 执行优化建议

```json
{
  "optimization_recommendations": {
    "parallelization_opportunities": [
      {
        "phase": "PHASE-003",
        "suggestion": "IMPL-005和IMPL-006可以并行执行",
        "estimated_time_saving": "PT2H",
        "risk_level": "low"
      }
    ],
    
    "resource_optimization": [
      {
        "recommendation": "在PHASE-001期间，test-agent处于空闲状态",
        "suggestion": "可以提前开始测试用例设计",
        "impact": "提高资源利用率15%"
      }
    ],
    
    "critical_path_optimization": [
      {
        "current_critical_path": "IMPL-001 → IMPL-002 → IMPL-003 → IMPL-004",
        "bottleneck": "IMPL-003 (JWT Token Service)",
        "optimization": "考虑将JWT实现分解为更小的子任务",
        "potential_benefit": "减少关键路径风险"
      }
    ]
  }
}
```

## 五、实施指南

### 5.1 集成接口

```typescript
// Claude Code命令集成
interface TaskExecutionPlanIntegration {
  // 从任务分解生成执行计划
  generateFromBreakdown(taskBreakdown: TaskBreakdown): ExecutionPlan;
  
  // 与Agent系统集成
  executeWithAgents(plan: ExecutionPlan): Promise<ExecutionResult>;
  
  // 与监控系统集成
  setupMonitoring(plan: ExecutionPlan): MonitoringSession;
  
  // 与文档系统集成
  syncWithDocuments(plan: ExecutionPlan): Promise<DocumentSyncResult>;
}
```

### 5.2 使用示例

```bash
# 创建执行计划
/task:plan create --from-breakdown IMPL-001 --template=feature_development

# 验证执行计划  
/task:plan validate EXEC-WFS-oauth-system-001

# 执行计划
/task:plan execute EXEC-WFS-oauth-system-001 --mode=auto

# 监控执行状态
/task:plan status EXEC-WFS-oauth-system-001 --dashboard

# 优化执行计划
/task:plan optimize EXEC-WFS-oauth-system-001 --criteria=time_efficiency
```

---

*本JSON Schema版本: v1.1 | 设计日期: 2025-09-06 | 兼容性: Claude Code v2.0+*