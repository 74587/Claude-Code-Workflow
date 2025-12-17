// ==========================================
// HELP VIEW I18N
// Internationalization for help page (Chinese translations)
// ==========================================

console.log('[Help i18n] File loading started');

var helpI18n = {
  zh: {
    // Page Headers
    'help.title': '帮助与指南',
    'help.subtitle': '全面的命令参考、工作流程图和 CodexLens 快速入门指南',

    // Search
    'help.search.placeholder': '按名称、类别或描述搜索命令...',
    'help.search.results': '找到 {count} 个匹配 "{query}" 的命令',
    'help.search.noResults': '没有找到匹配您搜索的命令',

    // Tabs
    'help.tab.cli': 'CLI 命令',
    'help.tab.memory': '内存命令',
    'help.tab.workflow': '工作流命令',
    'help.tab.task': '任务命令',
    'help.tab.diagrams': '工作流程',
    'help.tab.codexlens': 'CodexLens',

    // Command Card
    'help.command.arguments': '参数',
    'help.command.difficulty.beginner': '初级',
    'help.command.difficulty.intermediate': '中级',
    'help.command.difficulty.advanced': '高级',

    // Workflow Diagrams
    'help.diagrams.title': '常见工作流场景',
    'help.diagrams.decision': '决策流程：选择规划方式',
    'help.diagrams.brainstorm': '头脑风暴',
    'help.diagrams.cliResume': 'CLI Resume机制',
    'help.diagrams.bugFix': 'Bug修复流程',
    'help.diagrams.lite': 'Lite轻量工作流',
    'help.diagrams.planFull': 'Plan完整规划',
    'help.diagrams.tdd': 'TDD测试驱动',
    'help.diagrams.fit': '适应视图',
    'help.diagrams.zoomIn': '放大',
    'help.diagrams.zoomOut': '缩小',
    'help.diagrams.legend': '图例',
    'help.diagrams.legend.prerequisites': '前置条件',
    'help.diagrams.legend.nextSteps': '下一步',
    'help.diagrams.legend.alternatives': '替代方案',
    'help.diagrams.notLoaded': 'Cytoscape.js 未加载',

    // Workflow Steps - Decision
    'help.workflows.decision.start': '任务开始',
    'help.workflows.decision.cliAnalyze': 'CLI分析理解项目',
    'help.workflows.decision.understand': '充分理解蓝图',
    'help.workflows.decision.simple': '简单任务',
    'help.workflows.decision.medium': '中等任务',
    'help.workflows.decision.complex': '复杂任务',
    'help.workflows.decision.claudeExec': 'Claude执行(优先)',
    'help.workflows.decision.cliExec': 'CLI执行',
    'help.workflows.decision.claudePlan': 'Claude自带Plan',

    // Workflow Steps - Brainstorm
    'help.workflows.brainstorm.start': '不确定方向',
    'help.workflows.brainstorm.question': '知道做什么吗？',
    'help.workflows.brainstorm.product': '不知道：探索产品',
    'help.workflows.brainstorm.design': '知道但不知怎么做',
    'help.workflows.brainstorm.next': '进入规划阶段',

    // Workflow Steps - CLI Resume
    'help.workflows.cliResume.firstExec': 'ccw cli exec "分析..."',
    'help.workflows.cliResume.saveContext': '保存会话上下文',
    'help.workflows.cliResume.resumeCmd': 'ccw cli exec --resume',
    'help.workflows.cliResume.merge': '合并历史对话',
    'help.workflows.cliResume.continue': '继续执行任务',
    'help.workflows.cliResume.splitOutput': '拆分结果存储',
    'help.workflows.cliResume.complete': '完成',

    // Workflow Steps - Bug Fix
    'help.workflows.bugFix.start': '发现Bug',
    'help.workflows.bugFix.cliAnalyze': 'CLI分析定位Bug',
    'help.workflows.bugFix.diagnosis': '诊断根因',
    'help.workflows.bugFix.impact': '影响评估',
    'help.workflows.bugFix.strategy': '修复策略',
    'help.workflows.bugFix.execute': '执行修复',
    'help.workflows.bugFix.complete': '完成',

    // Workflow Steps - Plan Full
    'help.workflows.planFull.start': '复杂项目开始',
    'help.workflows.planFull.cliAnalyze': 'CLI深度分析项目',
    'help.workflows.planFull.complete': '会话完成',

    // Workflow Steps - Lite
    'help.workflows.lite.start': '开始',
    'help.workflows.lite.confirm': '三维确认',
    'help.workflows.lite.complete': '完成',

    // Workflow Steps - TDD
    'help.workflows.tdd.start': '开始',
    'help.workflows.tdd.red': 'Red: 编写失败测试',
    'help.workflows.tdd.green': 'Green: 实现代码',
    'help.workflows.tdd.refactor': 'Refactor: 重构优化',
    'help.workflows.tdd.complete': '完成',

    // CodexLens
    'help.codexlens.title': 'CodexLens 快速入门',
    'help.codexlens.subtitle': '强大的代码索引和语义搜索工具',
    'help.codexlens.concepts': '核心概念',
    'help.codexlens.concept.indexing': '索引',
    'help.codexlens.concept.indexing.desc': '为快速检索构建代码库索引',
    'help.codexlens.concept.search': '搜索模式',
    'help.codexlens.concept.search.desc': '文本、语义和符号导航',
    'help.codexlens.concept.symbols': '符号导航',
    'help.codexlens.concept.symbols.desc': '跳转到定义、查找引用',
    'help.codexlens.commands': '常用命令',
    'help.codexlens.practices': '最佳实践',
    'help.codexlens.practice.1': '初次使用前先运行索引',
    'help.codexlens.practice.2': '使用语义搜索查找概念代码',
    'help.codexlens.practice.3': '利用符号导航探索大型代码库',
    'help.codexlens.practice.4': '代码更改后定期重新索引',
    'help.codexlens.resources': '资源',
    'help.codexlens.fullDocs': '完整文档',
    'help.codexlens.apiRef': 'API 参考',
    'help.codexlens.examples': '示例',

    // Empty States
    'help.empty.noCommands': '此类别中没有命令',
    'help.empty.loadFailed': '加载帮助数据失败'
  },

  en: {
    // Page Headers
    'help.title': 'Help & Guide',
    'help.subtitle': 'Comprehensive command reference, workflow diagrams, and CodexLens quick-start guide',

    // Search
    'help.search.placeholder': 'Search commands by name, category, or description...',
    'help.search.results': 'Found {count} commands matching "{query}"',
    'help.search.noResults': 'No commands found matching your search',

    // Tabs
    'help.tab.cli': 'CLI Commands',
    'help.tab.memory': 'Memory Commands',
    'help.tab.workflow': 'Workflow Commands',
    'help.tab.task': 'Task Commands',
    'help.tab.diagrams': 'Workflows',
    'help.tab.codexlens': 'CodexLens',

    // Command Card
    'help.command.arguments': 'Arguments',
    'help.command.difficulty.beginner': 'Beginner',
    'help.command.difficulty.intermediate': 'Intermediate',
    'help.command.difficulty.advanced': 'Advanced',

    // Workflow Diagrams
    'help.diagrams.title': 'Common Workflow Scenarios',
    'help.diagrams.decision': 'Decision: Choose Planning Approach',
    'help.diagrams.brainstorm': 'Brainstorming',
    'help.diagrams.cliResume': 'CLI Resume Mechanism',
    'help.diagrams.bugFix': 'Bug Fix Workflow',
    'help.diagrams.lite': 'Lite Workflow',
    'help.diagrams.planFull': 'Full Planning',
    'help.diagrams.tdd': 'TDD Development',
    'help.diagrams.fit': 'Fit to View',
    'help.diagrams.zoomIn': 'Zoom In',
    'help.diagrams.zoomOut': 'Zoom Out',
    'help.diagrams.legend': 'Legend',
    'help.diagrams.legend.prerequisites': 'Prerequisites',
    'help.diagrams.legend.nextSteps': 'Next Steps',
    'help.diagrams.legend.alternatives': 'Alternatives',
    'help.diagrams.notLoaded': 'Cytoscape.js not loaded',

    // Workflow Steps - Decision
    'help.workflows.decision.start': 'Task Start',
    'help.workflows.decision.cliAnalyze': 'CLI Analyze Project',
    'help.workflows.decision.understand': 'Understand Blueprint',
    'help.workflows.decision.simple': 'Simple Task',
    'help.workflows.decision.medium': 'Medium Task',
    'help.workflows.decision.complex': 'Complex Task',
    'help.workflows.decision.claudeExec': 'Claude Execute (Preferred)',
    'help.workflows.decision.cliExec': 'CLI Execute',
    'help.workflows.decision.claudePlan': 'Claude Built-in Plan',

    // Workflow Steps - Brainstorm
    'help.workflows.brainstorm.start': 'Uncertain Direction',
    'help.workflows.brainstorm.question': 'Know What to Build?',
    'help.workflows.brainstorm.product': 'No: Explore Product',
    'help.workflows.brainstorm.design': 'Yes but Not How',
    'help.workflows.brainstorm.next': 'Enter Planning Phase',

    // Workflow Steps - CLI Resume
    'help.workflows.cliResume.firstExec': 'ccw cli exec "analyze..."',
    'help.workflows.cliResume.saveContext': 'Save Session Context',
    'help.workflows.cliResume.resumeCmd': 'ccw cli exec --resume',
    'help.workflows.cliResume.merge': 'Merge Conversation History',
    'help.workflows.cliResume.continue': 'Continue Execution',
    'help.workflows.cliResume.splitOutput': 'Split & Store Results',
    'help.workflows.cliResume.complete': 'Complete',

    // Workflow Steps - Bug Fix
    'help.workflows.bugFix.start': 'Bug Discovered',
    'help.workflows.bugFix.cliAnalyze': 'CLI Analyze & Locate Bug',
    'help.workflows.bugFix.diagnosis': 'Root Cause Analysis',
    'help.workflows.bugFix.impact': 'Impact Assessment',
    'help.workflows.bugFix.strategy': 'Fix Strategy',
    'help.workflows.bugFix.execute': 'Execute Fix',
    'help.workflows.bugFix.complete': 'Complete',

    // Workflow Steps - Plan Full
    'help.workflows.planFull.start': 'Complex Project Start',
    'help.workflows.planFull.cliAnalyze': 'CLI Deep Analysis',
    'help.workflows.planFull.complete': 'Session Complete',

    // Workflow Steps - Lite
    'help.workflows.lite.start': 'Start',
    'help.workflows.lite.confirm': '3D Confirmation',
    'help.workflows.lite.complete': 'Complete',

    // Workflow Steps - TDD
    'help.workflows.tdd.start': 'Start',
    'help.workflows.tdd.red': 'Red: Write Failing Test',
    'help.workflows.tdd.green': 'Green: Implement Code',
    'help.workflows.tdd.refactor': 'Refactor: Optimize',
    'help.workflows.tdd.complete': 'Complete',

    // CodexLens
    'help.codexlens.title': 'CodexLens Quick Start',
    'help.codexlens.subtitle': 'Powerful code indexing and semantic search tool',
    'help.codexlens.concepts': 'Key Concepts',
    'help.codexlens.concept.indexing': 'Indexing',
    'help.codexlens.concept.indexing.desc': 'Build codebase index for fast retrieval',
    'help.codexlens.concept.search': 'Search Modes',
    'help.codexlens.concept.search.desc': 'Text, semantic, and symbol navigation',
    'help.codexlens.concept.symbols': 'Symbol Navigation',
    'help.codexlens.concept.symbols.desc': 'Jump to definition, find references',
    'help.codexlens.commands': 'Common Commands',
    'help.codexlens.practices': 'Best Practices',
    'help.codexlens.practice.1': 'Run index before first use',
    'help.codexlens.practice.2': 'Use semantic search to find conceptual code',
    'help.codexlens.practice.3': 'Leverage symbol navigation for large codebases',
    'help.codexlens.practice.4': 'Re-index periodically after code changes',
    'help.codexlens.resources': 'Resources',
    'help.codexlens.fullDocs': 'Full Documentation',
    'help.codexlens.apiRef': 'API Reference',
    'help.codexlens.examples': 'Examples',

    // Empty States
    'help.empty.noCommands': 'No commands in this category',
    'help.empty.loadFailed': 'Failed to load help data'
  }
};

// Helper function to get help translation
function ht(key, replacements) {
  var lang = typeof currentLang !== 'undefined' ? currentLang : 'en';
  var translations = helpI18n[lang] || helpI18n.en;
  var text = translations[key] || helpI18n.en[key] || key;

  // Replace placeholders like {count}, {query}
  if (replacements) {
    Object.keys(replacements).forEach(function(placeholder) {
      text = text.replace('{' + placeholder + '}', replacements[placeholder]);
    });
  }

  return text;
}

// Expose ht function globally
window.ht = ht;

// Debug log to verify loading
console.log('[Help i18n] ht function loaded and exposed to window:', typeof window.ht);
