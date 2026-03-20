# Workflow Evaluation Criteria

Workflow 调优评估标准，由 Phase 03 (Analyze Step) 和 Phase 04 (Synthesize) 引用。

## Per-Step Dimensions

| Dimension | Description |
|-----------|-------------|
| Execution Success | 命令是否成功执行，退出码是否正确 |
| Output Completeness | 产物是否齐全，预期文件是否生成 |
| Artifact Quality | 产物内容质量 — 非空、格式正确、内容有意义 |
| Handoff Readiness | 产物是否满足下一步的输入要求，格式兼容性 |

## Per-Step Scoring Guide

| Range | Level | Description |
|-------|-------|-------------|
| 90-100 | Excellent | 执行完美，产物高质量，下游可直接消费 |
| 80-89 | Good | 执行成功，产物基本完整，微调即可衔接 |
| 70-79 | Adequate | 执行成功但产物有缺失或质量一般 |
| 60-69 | Needs Work | 部分失败或产物质量差，衔接困难 |
| 0-59 | Poor | 执行失败或产物无法使用 |

## Workflow-Level Dimensions

| Dimension | Description |
|-----------|-------------|
| Coherence | 步骤间的逻辑顺序是否合理，是否形成完整流程 |
| Handoff Quality | 步骤间的数据传递是否顺畅，格式是否匹配 |
| Redundancy | 是否存在步骤间的工作重叠或重复 |
| Efficiency | 整体流程是否高效，有无不必要的步骤 |
| Completeness | 是否覆盖所有必要环节，有无遗漏 |

## Analysis Depth Profiles

### Quick
- 每步 3-5 要点
- 关注: 执行成功、产出完整、明显问题
- 跨步骤: 基本衔接检查

### Standard
- 每步详细评估
- 关注: 执行质量、产出完整性、产物质量、衔接就绪度、潜在问题
- 跨步骤: 衔接质量、冗余检测、瓶颈识别

### Deep
- 每步深度审查
- 关注: 执行质量、产出正确性、结构质量、衔接完整性、错误处理、性能信号、架构影响、边界情况
- 跨步骤: 全面流程优化、重排建议、缺失步骤检测、架构改进

## Issue Severity Guide

| Severity | Description | Example |
|----------|-------------|---------|
| High | 阻断流程或导致错误结果 | 步骤执行失败、产物格式不兼容、关键数据丢失 |
| Medium | 影响质量但不阻断 | 产物不完整、衔接需手动调整、冗余步骤 |
| Low | 可改进但不影响功能 | 输出格式不一致、可优化的步骤顺序 |
