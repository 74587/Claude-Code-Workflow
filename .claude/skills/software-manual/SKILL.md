---
name: software-manual
description: Generate interactive TiddlyWiki-style HTML software manuals with screenshots, API docs, and multi-level code examples. Use when creating user guides, software documentation, or API references. Triggers on "software manual", "user guide", "generate manual", "create docs".
allowed-tools: Task, AskUserQuestion, Read, Bash, Glob, Grep, Write, mcp__chrome__*
---

# Software Manual Skill

Generate comprehensive, interactive software manuals in TiddlyWiki-style single-file HTML format.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Context-Optimized Architecture                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Requirements      → manual-config.json                │
│           ↓                                                      │
│  Phase 2: Exploration       → exploration-*.json                │
│           ↓                                                      │
│  Phase 3: Parallel Agents   → sections/section-*.md             │
│           ↓ (6 Agents)                                          │
│  Phase 3.5: Consolidation   → consolidation-summary.md          │
│           ↓                                                      │
│  Phase 4: Screenshot        → screenshots/*.png                 │
│           Capture              (via Chrome MCP)                 │
│           ↓                                                      │
│  Phase 5: HTML Assembly     → {name}-使用手册.html              │
│           ↓                                                      │
│  Phase 6: Refinement        → iterations/                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

1. **主 Agent 编排，子 Agent 执行**: 所有繁重计算委托给 `universal-executor` 子 Agent
2. **Brief Returns**: Agents return path + summary, not full content (avoid context overflow)
3. **System Agents**: 使用 `cli-explore-agent` (探索) 和 `universal-executor` (执行)
4. **Chrome MCP Integration**: Batch screenshot capture with Base64 embedding
5. **Single-File HTML**: TiddlyWiki-style interactive document with embedded resources
6. **User-Friendly Writing**: Clear, step-by-step guides with difficulty levels

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Requirements Discovery (主 Agent)                     │
│  → AskUserQuestion: 收集软件类型、目标用户、文档范围             │
│  → Output: manual-config.json                                   │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Project Exploration (cli-explore-agent × N)           │
│  → 并行探索: architecture, ui-routes, api-endpoints, config     │
│  → Output: exploration-*.json                                   │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: Parallel Analysis (universal-executor × 6)            │
│  → 6 个子 Agent 并行: overview, ui-guide, api-docs, config,     │
│    troubleshooting, code-examples                               │
│  → Output: sections/section-*.md                                │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3.5: Consolidation (universal-executor)                  │
│  → 质量检查: 一致性、交叉引用、截图标记                          │
│  → Output: consolidation-summary.md, screenshots-list.json      │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4: Screenshot Capture (universal-executor + Chrome MCP)  │
│  → 批量截图: 调用 mcp__chrome__screenshot                        │
│  → Output: screenshots/*.png + manifest.json                    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 5: HTML Assembly (universal-executor)                    │
│  → 组装 HTML: MD→tiddlers, 嵌入 CSS/JS/图片                     │
│  → Output: {name}-使用手册.html                                  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 6: Iterative Refinement (主 Agent)                       │
│  → 预览 + 用户反馈 + 迭代修复                                    │
│  → Output: iterations/v*.html                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Configuration

| Agent | Role | Output File | Focus Areas |
|-------|------|-------------|-------------|
| overview | Product Manager | section-overview.md | Product intro, features, quick start |
| ui-guide | UX Expert | section-ui-guide.md | UI operations, step-by-step guides |
| api-docs | API Architect | section-api-reference.md | REST API, Frontend API |
| config | DevOps Engineer | section-configuration.md | Env vars, deployment, settings |
| troubleshooting | Support Engineer | section-troubleshooting.md | FAQs, error codes, solutions |
| code-examples | Developer Advocate | section-examples.md | Beginner/Intermediate/Advanced examples |

## Agent Return Format

```typescript
interface ManualAgentReturn {
  status: "completed" | "partial" | "failed";
  output_file: string;
  summary: string;                    // Max 50 chars
  screenshots_needed: Array<{
    id: string;                       // e.g., "ss-login-form"
    url: string;                      // Relative or absolute URL
    description: string;              // "Login form interface"
    selector?: string;                // CSS selector for partial screenshot
    wait_for?: string;                // Element to wait for
  }>;
  cross_references: string[];         // Other sections referenced
  difficulty_level: "beginner" | "intermediate" | "advanced";
}
```

## HTML Features (TiddlyWiki-style)

1. **Search**: Full-text search with result highlighting
2. **Collapse/Expand**: Per-section collapsible content
3. **Tag Navigation**: Filter by category tags
4. **Theme Toggle**: Light/Dark mode with localStorage persistence
5. **Single File**: All CSS/JS/images embedded as Base64
6. **Offline**: Works without internet connection
7. **Print-friendly**: Optimized print stylesheet

## Directory Setup

```javascript
// Generate timestamp directory name
const timestamp = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
const dir = `.workflow/.scratchpad/manual-${timestamp}`;

// Windows
Bash(`mkdir "${dir}\\sections" && mkdir "${dir}\\screenshots" && mkdir "${dir}\\api-docs" && mkdir "${dir}\\iterations"`);
```

## Output Structure

```
.workflow/.scratchpad/manual-{timestamp}/
├── manual-config.json              # Phase 1
├── exploration/                    # Phase 2
│   ├── exploration-architecture.json
│   ├── exploration-ui-routes.json
│   └── exploration-api-endpoints.json
├── sections/                       # Phase 3
│   ├── section-overview.md
│   ├── section-ui-guide.md
│   ├── section-api-reference.md
│   ├── section-configuration.md
│   ├── section-troubleshooting.md
│   └── section-examples.md
├── consolidation-summary.md        # Phase 3.5
├── api-docs/                       # API documentation
│   ├── frontend/                   # TypeDoc output
│   └── backend/                    # Swagger/OpenAPI output
├── screenshots/                    # Phase 4
│   ├── ss-*.png
│   └── screenshots-manifest.json
├── iterations/                     # Phase 6
│   ├── v1.html
│   └── v2.html
└── {软件名}-使用手册.html           # Final Output
```

## Reference Documents

| Document | Purpose |
|----------|---------|
| [phases/01-requirements-discovery.md](phases/01-requirements-discovery.md) | User config collection |
| [phases/02-project-exploration.md](phases/02-project-exploration.md) | Project type detection |
| [phases/03-parallel-analysis.md](phases/03-parallel-analysis.md) | 6 Agent orchestration |
| [phases/03.5-consolidation.md](phases/03.5-consolidation.md) | Cross-section synthesis |
| [phases/04-screenshot-capture.md](phases/04-screenshot-capture.md) | Chrome MCP integration |
| [phases/05-html-assembly.md](phases/05-html-assembly.md) | HTML generation |
| [phases/06-iterative-refinement.md](phases/06-iterative-refinement.md) | Quality iteration |
| [specs/quality-standards.md](specs/quality-standards.md) | Quality gates |
| [specs/writing-style.md](specs/writing-style.md) | User-friendly writing |
| [specs/html-template.md](specs/html-template.md) | HTML template spec |
| [templates/tiddlywiki-shell.html](templates/tiddlywiki-shell.html) | HTML template |
| [scripts/typedoc-runner.md](scripts/typedoc-runner.md) | TypeDoc execution |
| [scripts/swagger-runner.md](scripts/swagger-runner.md) | Swagger/OpenAPI |
| [scripts/screenshot-helper.md](scripts/screenshot-helper.md) | Chrome MCP guide |
