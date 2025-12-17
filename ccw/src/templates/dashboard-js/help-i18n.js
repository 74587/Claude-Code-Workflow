// ==========================================
// HELP VIEW I18N
// Internationalization for help page (Chinese translations)
// ==========================================

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
    'help.diagrams.tdd': 'TDD 开发',
    'help.diagrams.feature': '功能开发',
    'help.diagrams.bugfix': 'Bug 调查',
    'help.diagrams.review': '代码审查',
    'help.diagrams.fit': '适应视图',
    'help.diagrams.zoomIn': '放大',
    'help.diagrams.zoomOut': '缩小',
    'help.diagrams.legend': '图例',
    'help.diagrams.legend.prerequisites': '前置条件',
    'help.diagrams.legend.nextSteps': '下一步',
    'help.diagrams.legend.alternatives': '替代方案',
    'help.diagrams.notLoaded': 'Cytoscape.js 未加载',

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
    'help.diagrams.tdd': 'TDD Development',
    'help.diagrams.feature': 'Feature Development',
    'help.diagrams.bugfix': 'Bug Investigation',
    'help.diagrams.review': 'Code Review',
    'help.diagrams.fit': 'Fit to View',
    'help.diagrams.zoomIn': 'Zoom In',
    'help.diagrams.zoomOut': 'Zoom Out',
    'help.diagrams.legend': 'Legend',
    'help.diagrams.legend.prerequisites': 'Prerequisites',
    'help.diagrams.legend.nextSteps': 'Next Steps',
    'help.diagrams.legend.alternatives': 'Alternatives',
    'help.diagrams.notLoaded': 'Cytoscape.js not loaded',

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
