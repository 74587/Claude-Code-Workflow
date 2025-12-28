# Phase 3: Parallel Analysis

使用 `universal-executor` 并行生成 6 个文档章节。

## Agent 配置

```javascript
const AGENT_CONFIGS = {
  overview: {
    role: 'Product Manager',
    output: 'section-overview.md',
    task: '撰写产品概览、核心功能、快速入门指南',
    focus: '产品定位、目标用户、5步快速入门、系统要求',
    input: ['exploration-architecture.json', 'README.md', 'package.json']
  },
  'ui-guide': {
    role: 'UX Expert',
    output: 'section-ui-guide.md',
    task: '撰写界面操作指南，分步骤说明各功能使用方法',
    focus: '界面布局、导航流程、功能操作、快捷键',
    input: ['exploration-ui-routes.json', 'pages/**', 'views/**']
  },
  'api-docs': {
    role: 'API Architect',
    output: 'section-api-reference.md',
    task: '撰写 REST API 和前端 API 参考文档',
    focus: 'API 概览、端点分类、请求/响应示例、错误码',
    input: ['exploration-api-endpoints.json', 'controllers/**', 'routes/**']
  },
  config: {
    role: 'DevOps Engineer',
    output: 'section-configuration.md',
    task: '撰写配置指南，涵盖环境变量、配置文件、部署设置',
    focus: '环境变量表格、配置文件格式、部署选项、安全设置',
    input: ['exploration-config.json', '.env.example', 'config/**']
  },
  troubleshooting: {
    role: 'Support Engineer',
    output: 'section-troubleshooting.md',
    task: '撰写故障排查指南，涵盖常见问题、错误码、FAQ',
    focus: '常见问题与解决方案、错误码参考、FAQ、获取帮助',
    input: ['all exploration files', 'error handling code']
  },
  'code-examples': {
    role: 'Developer Advocate',
    output: 'section-examples.md',
    task: '撰写多难度级别代码示例（入门40%/进阶40%/高级20%）',
    focus: '完整可运行代码、分步解释、预期输出、最佳实践',
    input: ['all exploration files', 'examples/**', 'tests/**']
  }
};
```

## 执行流程

```javascript
const config = JSON.parse(Read(`${workDir}/manual-config.json`));

// 并行启动 6 个 universal-executor
const tasks = Object.entries(AGENT_CONFIGS).map(([name, cfg]) =>
  Task({
    subagent_type: 'universal-executor',
    run_in_background: false,
    prompt: buildAgentPrompt(name, cfg, config, workDir)
  })
);

const results = await Promise.all(tasks);
```

## Prompt 构建

```javascript
function buildAgentPrompt(name, cfg, config, workDir) {
  return `
[ROLE] ${cfg.role}

[TASK]
${cfg.task}
输出: ${workDir}/sections/${cfg.output}

[INPUT]
- Read: ${workDir}/manual-config.json
- Read: ${cfg.input.map(f => `${workDir}/exploration/${f}`).join(', ')}

[STYLE]
- 用户友好语言，避免技术术语
- 步骤编号清晰
- 代码块标注语言
- 截图标记: <!-- SCREENSHOT: id="ss-xxx" url="/path" description="xxx" -->

[FOCUS]
${cfg.focus}

[RETURN JSON]
{
  "status": "completed",
  "output_file": "sections/${cfg.output}",
  "summary": "<50字>",
  "screenshots_needed": [],
  "cross_references": []
}
`;
}
```

## 结果收集

```javascript
const agentResults = results.map(r => JSON.parse(r));
const allScreenshots = agentResults.flatMap(r => r.screenshots_needed);

Write(`${workDir}/agent-results.json`, JSON.stringify({
  results: agentResults,
  screenshots_needed: allScreenshots,
  timestamp: new Date().toISOString()
}, null, 2));
```

## 质量检查

- [ ] Markdown 语法有效
- [ ] 无占位符文本
- [ ] 代码块标注语言
- [ ] 截图标记格式正确
- [ ] 交叉引用有效

## 下一阶段

→ [Phase 3.5: Consolidation](03.5-consolidation.md)
