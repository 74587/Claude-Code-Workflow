# Phase 4: Report Generation

合并所有章节文件，生成最终分析报告。

> **规范参考**: [../specs/quality-standards.md](../specs/quality-standards.md)

## 输入

```typescript
interface ReportInput {
  output_dir: string;
  config: AnalysisConfig;
  consolidation: {
    quality_score: QualityScore;
    issues: { errors: Issue[], warnings: Issue[], info: Issue[] };
    stats: Stats;
  };
}
```

## 执行流程

```javascript
// 1. 检查质量门禁
if (consolidation.issues.errors.length > 0) {
  const response = await AskUserQuestion({
    questions: [{
      question: `发现 ${consolidation.issues.errors.length} 个严重问题，如何处理？`,
      header: "质量检查",
      multiSelect: false,
      options: [
        {label: "查看并修复", description: "显示问题列表，手动修复后重试"},
        {label: "忽略继续", description: "跳过问题检查，继续装配"},
        {label: "终止", description: "停止报告生成"}
      ]
    }]
  });

  if (response === "查看并修复") {
    return { action: "fix_required", errors: consolidation.issues.errors };
  }
  if (response === "终止") {
    return { action: "abort" };
  }
}

// 2. 读取章节文件
const sectionFiles = Glob(`${outputDir}/sections/section-*.md`);
const sections = sectionFiles.map(f => Read(f));

// 3. 读取汇总报告
const summary = Read(`${outputDir}/consolidation-summary.md`);

// 4. 装配报告
const report = assembleReport(config, sections, summary);

// 5. 写入最终文件
const fileName = `${config.type.toUpperCase()}-REPORT.md`;
Write(`${outputDir}/${fileName}`, report);
```

## 报告结构

### Architecture Report

```markdown
# Architecture Report

> Generated: {date}
> Scope: {config.scope}
> Quality Score: {overall}%

## Executive Summary

{3-5 key takeaways from consolidation-summary}

---

{section-overview.md 内容}

---

{section-layers.md 内容}

---

{section-dependencies.md 内容}

---

{section-dataflow.md 内容}

---

{section-entrypoints.md 内容}

---

## Recommendations

{从各章节汇总的建议}

---

## Appendix: Quality Report

{consolidation-summary.md 的质量评分和问题列表}
```

### Design Report

```markdown
# Design Report

> Generated: {date}
> Scope: {config.scope}
> Quality Score: {overall}%

## Executive Summary

{3-5 key takeaways}

---

{section-patterns.md 内容}

---

{section-classes.md 内容}

---

{section-interfaces.md 内容}

---

{section-state.md 内容}

---

## Design Recommendations

{汇总的设计建议}

---

## Appendix: Quality Report

{质量评分}
```

### Methods Report

```markdown
# Key Methods Report

> Generated: {date}
> Scope: {config.scope}
> Quality Score: {overall}%

## Executive Summary

{3-5 key takeaways}

---

{section-algorithms.md 内容}

---

{section-paths.md 内容}

---

{section-apis.md 内容}

---

{section-logic.md 内容}

---

## Optimization Suggestions

{汇总的优化建议}

---

## Appendix: Quality Report

{质量评分}
```

## 装配函数

```javascript
function assembleReport(config, sections, summary) {
  const reportTitles = {
    architecture: "Architecture Report",
    design: "Design Report",
    methods: "Key Methods Report",
    comprehensive: "Comprehensive Project Analysis"
  };

  const header = `# ${reportTitles[config.type]}

> Generated: ${new Date().toLocaleDateString('zh-CN')}
> Scope: ${config.scope}
> Depth: ${config.depth}
> Quality Score: ${summary.quality_score?.overall || 'N/A'}%

`;

  // Executive Summary from consolidation
  const execSummary = generateExecutiveSummary(summary, config.type);

  // Merge sections
  const mainContent = sections.join('\n\n---\n\n');

  // Recommendations from sections
  const recommendations = extractRecommendations(sections, config.type);

  // Quality appendix
  const appendix = generateQualityAppendix(summary);

  return header + execSummary + '\n\n---\n\n' + mainContent + '\n\n' + recommendations + '\n\n' + appendix;
}

function generateExecutiveSummary(summary, type) {
  return `## Executive Summary

### Key Findings
${summary.key_findings?.map(f => `- ${f}`).join('\n') || '- See detailed sections below'}

### Quality Overview
| Dimension | Score |
|-----------|-------|
| Completeness | ${summary.quality_score?.completeness || 'N/A'}% |
| Consistency | ${summary.quality_score?.consistency || 'N/A'}% |
| Depth | ${summary.quality_score?.depth || 'N/A'}% |

### Issues Summary
- Errors: ${summary.issues?.errors?.length || 0}
- Warnings: ${summary.issues?.warnings?.length || 0}
- Suggestions: ${summary.issues?.info?.length || 0}
`;
}

function extractRecommendations(sections, type) {
  const recommendationTitles = {
    architecture: "## Architectural Recommendations",
    design: "## Design Recommendations",
    methods: "## Optimization Suggestions",
    comprehensive: "## Recommendations & Next Steps"
  };

  // Extract recommendation sections from each section file
  let recommendations = `${recommendationTitles[type]}\n\n`;

  // Aggregate from sections
  recommendations += "Based on the analysis, the following recommendations are prioritized:\n\n";
  recommendations += "1. **High Priority**: Address critical issues identified in the quality report\n";
  recommendations += "2. **Medium Priority**: Resolve warnings to improve code quality\n";
  recommendations += "3. **Low Priority**: Consider enhancement suggestions for future iterations\n";

  return recommendations;
}

function generateQualityAppendix(summary) {
  return `---

## Appendix: Quality Report

### Overall Score: ${summary.quality_score?.overall || 'N/A'}%

| Dimension | Score | Status |
|-----------|-------|--------|
| Completeness | ${summary.quality_score?.completeness || 'N/A'}% | ${getStatus(summary.quality_score?.completeness)} |
| Consistency | ${summary.quality_score?.consistency || 'N/A'}% | ${getStatus(summary.quality_score?.consistency)} |
| Depth | ${summary.quality_score?.depth || 'N/A'}% | ${getStatus(summary.quality_score?.depth)} |
| Readability | ${summary.quality_score?.readability || 'N/A'}% | ${getStatus(summary.quality_score?.readability)} |

### Statistics
- Total Sections: ${summary.stats?.total_sections || 'N/A'}
- Total Diagrams: ${summary.stats?.total_diagrams || 'N/A'}
- Total Code References: ${summary.stats?.total_code_refs || 'N/A'}
- Total Words: ${summary.stats?.total_words || 'N/A'}
`;
}

function getStatus(score) {
  if (!score) return '?';
  if (score >= 90) return 'PASS';
  if (score >= 70) return 'WARNING';
  return 'FAIL';
}
```

## Output

- 最终报告: `{TYPE}-REPORT.md`
- 保留原始章节文件供追溯
