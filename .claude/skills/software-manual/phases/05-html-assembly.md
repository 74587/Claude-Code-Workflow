# Phase 5: HTML Assembly

使用 `universal-executor` 子 Agent 生成最终 HTML，避免主 Agent 内存溢出。

## 核心原则

**主 Agent 负责编排，子 Agent 负责繁重计算。**

## 执行流程

```javascript
const config = JSON.parse(Read(`${workDir}/manual-config.json`));

// 委托给 universal-executor 执行 HTML 组装
const result = Task({
  subagent_type: 'universal-executor',
  run_in_background: false,
  prompt: buildAssemblyPrompt(config, workDir)
});

const buildResult = JSON.parse(result);
```

## Prompt 构建

```javascript
function buildAssemblyPrompt(config, workDir) {
  return `
[ROLE] HTML Assembler

[TASK]
生成 TiddlyWiki 风格的交互式 HTML 手册

[INPUT]
- 模板: .claude/skills/software-manual/templates/tiddlywiki-shell.html
- CSS: .claude/skills/software-manual/templates/css/wiki-base.css, wiki-dark.css
- 配置: ${workDir}/manual-config.json
- 章节: ${workDir}/sections/section-*.md
- 截图: ${workDir}/screenshots/

[STEPS]
1. 读取 HTML 模板和 CSS
2. 逐个读取 section-*.md，转换为 HTML tiddlers
3. 处理 <!-- SCREENSHOT: id="..." --> 标记，嵌入 Base64 图片
4. 生成目录、搜索索引
5. 组装最终 HTML，写入 ${workDir}/${config.software.name}-使用手册.html
6. 生成构建报告 ${workDir}/build-report.json

[HTML FEATURES]
- 搜索: 全文检索 + 高亮
- 折叠: 章节可展开/收起
- 标签: 分类过滤
- 主题: 亮/暗模式切换
- 离线: 所有资源内嵌

[RETURN JSON]
{
  "status": "completed",
  "output_file": "${config.software.name}-使用手册.html",
  "file_size": "<size>",
  "sections_count": <n>,
  "screenshots_embedded": <n>
}
`;
}
```

## Agent 职责

1. **读取模板** → HTML + CSS
2. **转换章节** → Markdown → HTML tiddlers
3. **嵌入截图** → Base64 编码
4. **生成索引** → 搜索数据
5. **组装输出** → 单文件 HTML

## Markdown 转换规则

Agent 内部实现：

```
# H1 → <h1>
## H2 → <h2>
### H3 → <h3>
```code``` → <pre><code>
**bold** → <strong>
*italic* → <em>
[text](url) → <a href>
- item → <li>
<!-- SCREENSHOT: id="xxx" --> → <figure><img src="data:..."></figure>
```

## Tiddler 结构

```html
<article class="tiddler" id="tiddler-{name}" data-tags="..." data-difficulty="...">
  <header class="tiddler-header">
    <h2><button class="collapse-toggle">▼</button> {title}</h2>
    <div class="tiddler-meta">{badges}</div>
  </header>
  <div class="tiddler-content">{html}</div>
</article>
```

## 输出

- `{软件名}-使用手册.html` - 最终 HTML
- `build-report.json` - 构建报告

## 质量门禁

- [ ] HTML 渲染正确
- [ ] 搜索功能可用
- [ ] 折叠/展开正常
- [ ] 主题切换持久化
- [ ] 截图显示正确
- [ ] 文件大小 < 10MB

## 下一阶段

→ [Phase 6: Iterative Refinement](06-iterative-refinement.md)
