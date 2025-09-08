---
name: brainstorm:synthesis
description: Synthesize all brainstorming role perspectives into comprehensive analysis and recommendations
usage: /brainstorm:synthesis
argument-hint: "no arguments required - analyzes existing brainstorming session outputs"
examples:
  - /brainstorm:synthesis
allowed-tools: Read(*), Write(*), TodoWrite(*), Glob(*)
---

## 🧩 **命令定义: Brainstorm Synthesis**

### 核心功能
- **跨角色综合**: 整合所有角色的头脑风暴分析结果
- **洞察提炼**: 识别共识点、分歧点和创新机会
- **决策支持**: 生成优先级建议和行动计划
- **报告生成**: 创建综合性的头脑风暴总结报告

### 分析范围
- **产品管理**: 用户需求、商业价值、市场机会
- **技术架构**: 系统设计、技术选型、实施可行性
- **用户体验**: 界面设计、可用性、可访问性
- **数据架构**: 数据模型、处理流程、分析能力
- **安全专家**: 威胁评估、安全控制、合规要求
- **用户研究**: 行为洞察、需求验证、体验优化
- **业务分析**: 流程优化、成本效益、变更管理
- **创新领导**: 技术趋势、创新机会、未来规划
- **功能规划**: 开发计划、质量保证、交付管理

## ⚙️ **执行协议**

### Phase 1: 会话检测与数据收集
```bash
# 自动检测活动会话
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    load_context_from(session_id)
ELSE:
    ERROR: "No active brainstorming session found. Please run role-specific brainstorming commands first."
    EXIT
```

### Phase 2: 角色输出扫描
```bash
# 扫描所有角色的头脑风暴输出
SCAN_DIRECTORY: .workflow/WFS-{session}/.brainstorming/
COLLECT_OUTPUTS: [
    product-manager/analysis.md,
    system-architect/analysis.md,
    ui-designer/analysis.md,
    data-architect/analysis.md,
    security-expert/analysis.md,
    user-researcher/analysis.md,
    business-analyst/analysis.md,
    innovation-lead/analysis.md,
    feature-planner/analysis.md
]
```

### Phase 3: TodoWrite 初始化
设置综合分析任务跟踪：
```json
[
  {"content": "Initialize synthesis brainstorming session", "status": "completed", "activeForm": "Initializing synthesis"},
  {"content": "Collect and analyze all role perspectives", "status": "in_progress", "activeForm": "Collecting role analyses"},
  {"content": "Identify cross-role insights and patterns", "status": "pending", "activeForm": "Identifying insights"},
  {"content": "Generate consensus and disagreement analysis", "status": "pending", "activeForm": "Analyzing consensus"},
  {"content": "Create prioritized recommendations matrix", "status": "pending", "activeForm": "Creating recommendations"},
  {"content": "Generate comprehensive synthesis report", "status": "pending", "activeForm": "Generating synthesis report"},
  {"content": "Create action plan with implementation priorities", "status": "pending", "activeForm": "Creating action plan"}
]
```

### Phase 4: 综合分析执行

#### 4.1 数据收集和预处理
```pseudo
FOR each role_directory in brainstorming_roles:
    IF role_directory exists:
        role_analysis = Read(role_directory + "/analysis.md")
        role_recommendations = Read(role_directory + "/recommendations.md") IF EXISTS
        role_insights[role] = extract_key_insights(role_analysis)
        role_recommendations[role] = extract_recommendations(role_analysis)
        role_concerns[role] = extract_concerns_risks(role_analysis)
    END IF
END FOR
```

#### 4.2 跨角色洞察分析
```pseudo
# 共识点识别
consensus_areas = identify_common_themes(role_insights)
agreement_matrix = create_agreement_matrix(role_recommendations)

# 分歧点分析  
disagreement_areas = identify_conflicting_views(role_insights)
tension_points = analyze_role_conflicts(role_recommendations)

# 创新机会提取
innovation_opportunities = extract_breakthrough_ideas(role_insights)
synergy_opportunities = identify_cross_role_synergies(role_insights)
```

#### 4.3 优先级和决策矩阵生成
```pseudo
# 创建综合评估矩阵
FOR each recommendation:
    impact_score = calculate_business_impact(recommendation, role_insights)
    feasibility_score = calculate_technical_feasibility(recommendation, role_insights)  
    effort_score = calculate_implementation_effort(recommendation, role_insights)
    risk_score = calculate_associated_risks(recommendation, role_insights)
    
    priority_score = weighted_score(impact_score, feasibility_score, effort_score, risk_score)
END FOR

SORT recommendations BY priority_score DESC
```

## 📊 **输出结构**

### 保存位置
```
.workflow/WFS-{topic-slug}/.brainstorming/
├── synthesis-report.md          # 综合分析报告
├── recommendations-matrix.md    # 优先级推荐矩阵
├── action-plan.md              # 实施行动计划
├── consensus-analysis.md       # 共识和分歧分析
└── brainstorm-summary.json     # 机器可读的综合数据
```

### 核心输出文档

#### synthesis-report.md 结构
```markdown
# Brainstorming Synthesis Report: {Topic}
*Generated: {timestamp} | Session: WFS-{topic-slug}*

## Executive Summary
### Key Findings Overview
### Strategic Recommendations
### Implementation Priority
### Success Metrics

## Participating Perspectives Analysis
### Roles Analyzed: {list_of_completed_roles}
### Coverage Assessment: {completeness_percentage}%
### Analysis Quality Score: {quality_assessment}

## Cross-Role Insights Synthesis

### 🤝 Consensus Areas
**Strong Agreement (3+ roles)**:
1. **{consensus_theme_1}**
   - Supporting roles: {role1, role2, role3}
   - Key insight: {shared_understanding}
   - Business impact: {impact_assessment}

2. **{consensus_theme_2}**
   - Supporting roles: {role1, role2, role4}
   - Key insight: {shared_understanding}
   - Business impact: {impact_assessment}

### ⚡ Breakthrough Ideas
**Innovation Opportunities**:
1. **{breakthrough_idea_1}**
   - Origin: {source_role}
   - Cross-role support: {supporting_roles}
   - Innovation potential: {potential_assessment}

2. **{breakthrough_idea_2}**
   - Origin: {source_role}  
   - Cross-role support: {supporting_roles}
   - Innovation potential: {potential_assessment}

### 🔄 Areas of Disagreement
**Tension Points Requiring Resolution**:
1. **{disagreement_area_1}**
   - Conflicting views: {role1_view} vs {role2_view}
   - Root cause: {underlying_issue}
   - Resolution approach: {recommended_resolution}

2. **{disagreement_area_2}**
   - Conflicting views: {role1_view} vs {role2_view}
   - Root cause: {underlying_issue}
   - Resolution approach: {recommended_resolution}

## Comprehensive Recommendations Matrix

### 🎯 High Priority (Immediate Action)
| Recommendation | Business Impact | Technical Feasibility | Implementation Effort | Risk Level | Supporting Roles |
|----------------|-----------------|----------------------|---------------------|------------|------------------|
| {rec_1}        | High           | High                 | Medium              | Low        | PM, Arch, UX     |
| {rec_2}        | High           | Medium               | Low                 | Medium     | BA, PM, FP       |

### 📋 Medium Priority (Strategic Planning)
| Recommendation | Business Impact | Technical Feasibility | Implementation Effort | Risk Level | Supporting Roles |
|----------------|-----------------|----------------------|---------------------|------------|------------------|
| {rec_3}        | Medium         | High                 | High                | Medium     | Arch, DA, Sec    |
| {rec_4}        | Medium         | Medium               | Medium              | Low        | UX, UR, PM       |

### 🔬 Research Priority (Future Investigation)
| Recommendation | Business Impact | Technical Feasibility | Implementation Effort | Risk Level | Supporting Roles |
|----------------|-----------------|----------------------|---------------------|------------|------------------|
| {rec_5}        | High           | Unknown              | High                | High       | IL, Arch, PM     |
| {rec_6}        | Medium         | Low                  | High                | High       | IL, DA, Sec      |

## Implementation Strategy

### Phase 1: Foundation (0-3 months)
- **Focus**: High-priority, low-effort recommendations
- **Key Actions**: {action_list}
- **Success Metrics**: {metrics_list}
- **Required Resources**: {resource_list}

### Phase 2: Development (3-9 months)
- **Focus**: Medium-priority strategic initiatives
- **Key Actions**: {action_list}
- **Success Metrics**: {metrics_list}
- **Required Resources**: {resource_list}

### Phase 3: Innovation (9+ months)
- **Focus**: Research and breakthrough opportunities
- **Key Actions**: {action_list}
- **Success Metrics**: {metrics_list}
- **Required Resources**: {resource_list}

## Risk Assessment and Mitigation

### Critical Risks Identified
1. **{risk_1}**: {description} | Mitigation: {strategy}
2. **{risk_2}**: {description} | Mitigation: {strategy}

### Success Factors
- {success_factor_1}
- {success_factor_2}
- {success_factor_3}

## Next Steps and Follow-up
### Immediate Actions Required
### Decision Points Needing Resolution  
### Continuous Monitoring Requirements
### Future Brainstorming Sessions Recommended

---
*This synthesis integrates insights from {role_count} perspectives to provide comprehensive strategic guidance.*
```

## 🔄 **会话集成**

### 状态同步
综合分析完成后，更新 `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "status": "completed",
      "synthesis_completed": true,
      "completed_at": "timestamp",
      "participating_roles": ["product-manager", "system-architect", "ui-designer", ...],
      "key_outputs": {
        "synthesis_report": ".workflow/WFS-{topic}/.brainstorming/synthesis-report.md",
        "action_plan": ".workflow/WFS-{topic}/.brainstorming/action-plan.md",
        "recommendations_matrix": ".workflow/WFS-{topic}/.brainstorming/recommendations-matrix.md"
      },
      "metrics": {
        "roles_analyzed": 9,
        "consensus_areas": 5,
        "breakthrough_ideas": 3,
        "high_priority_recommendations": 8,
        "implementation_phases": 3
      }
    }
  }
}
```

## ✅ **质量标准**

### 必须包含的综合元素
- [ ] 所有可用角色分析的整合
- [ ] 明确的共识和分歧识别
- [ ] 量化的优先级推荐矩阵
- [ ] 可执行的实施计划
- [ ] 全面的风险评估和缓解

### 综合分析质量检查
- [ ] **完整性**: 整合所有可用的角色分析
- [ ] **洞察力**: 识别跨角色的深层次模式
- [ ] **可操作性**: 提供具体可执行的建议
- [ ] **平衡性**: 考虑所有角色的观点和关切
- [ ] **前瞻性**: 包含长期战略和创新考量

### 输出验证标准
- [ ] 推荐优先级基于多维度评估
- [ ] 实施计划考虑资源和时间约束  
- [ ] 风险评估全面且有缓解策略
- [ ] 成功指标明确可测量
- [ ] 后续行动清晰具体