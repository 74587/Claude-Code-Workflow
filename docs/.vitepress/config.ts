import { defineConfig } from 'vitepress'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserOrOrgSite = Boolean(repoName && repoName.endsWith('.github.io'))

const base =
  process.env.CCW_DOCS_BASE ||
  (process.env.GITHUB_ACTIONS && repoName && !isUserOrOrgSite ? `/${repoName}/` : '/')

export default defineConfig({
  title: 'CCW Documentation',
  description: 'Claude Code Workspace - Advanced AI-Powered Development Environment',
  lang: 'zh-CN',
  base,

  // Ignore dead links for incomplete docs
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    [
      'script',
      {},
      `(() => {
  try {
    const theme = localStorage.getItem('ccw-theme') || 'blue'
    document.documentElement.setAttribute('data-theme', theme)

    const mode = localStorage.getItem('ccw-color-mode') || 'auto'
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  } catch {}
})()`
    ],
    ['meta', { name: 'theme-color', content: '#3b82f6' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en_US' }],
    ['meta', { name: 'og:locale:alternate', content: 'zh_CN' }]
  ],

  // Appearance
  appearance: false,

  // Vite build/dev optimizations
  vite: {
    optimizeDeps: {
      include: ['flexsearch']
    },
    build: {
      target: 'es2019',
      cssCodeSplit: true
    }
  },

  // Theme configuration
  themeConfig: {
    logo: '/logo.svg',

    // Right-side table of contents (outline)
    outline: {
      level: [2, 3],
      label: 'On this page'
    },

    // Navigation - 按照 Trellis 风格组织
    nav: [
      { text: 'Guide', link: '/guide/ch01-what-is-claude-dms3' },
      { text: 'Commands', link: '/commands/claude/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'Features', link: '/features/spec' },
      {
        text: 'Languages',
        items: [
          { text: '简体中文', link: '/zh/guide/ch01-what-is-claude-dms3' }
        ]
      }
    ],

    // Sidebar - 按照 Trellis 风格组织
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'What is Claude_dms3', link: '/guide/ch01-what-is-claude-dms3' },
            { text: 'Getting Started', link: '/guide/ch02-getting-started' },
            { text: 'Core Concepts', link: '/guide/ch03-core-concepts' },
            { text: 'Workflow Basics', link: '/guide/ch04-workflow-basics' },
            { text: 'Advanced Tips', link: '/guide/ch05-advanced-tips' },
            { text: 'Best Practices', link: '/guide/ch06-best-practices' }
          ]
        }
      ],
      '/commands/': [
        {
          text: 'Claude Commands',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/commands/claude/' },
            { text: 'Core Orchestration', link: '/commands/claude/core-orchestration' },
            { text: 'Workflow', link: '/commands/claude/workflow' },
            { text: 'Session', link: '/commands/claude/session' },
            { text: 'Issue', link: '/commands/claude/issue' },
            { text: 'Memory', link: '/commands/claude/memory' },
            { text: 'CLI', link: '/commands/claude/cli' },
            { text: 'UI Design', link: '/commands/claude/ui-design' }
          ]
        },
        {
          text: 'Codex Prompts',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/commands/codex/' },
            { text: 'Prep', link: '/commands/codex/prep' },
            { text: 'Review', link: '/commands/codex/review' }
          ]
        }
      ],
      '/skills/': [
        {
          text: 'Claude Skills',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/skills/claude-index' },
            { text: 'Collaboration', link: '/skills/claude-collaboration' },
            { text: 'Workflow', link: '/skills/claude-workflow' },
            { text: 'Memory', link: '/skills/claude-memory' },
            { text: 'Review', link: '/skills/claude-review' },
            { text: 'Meta', link: '/skills/claude-meta' }
          ]
        },
        {
          text: 'Codex Skills',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/skills/codex-index' },
            { text: 'Lifecycle', link: '/skills/codex-lifecycle' },
            { text: 'Workflow', link: '/skills/codex-workflow' },
            { text: 'Specialized', link: '/skills/codex-specialized' }
          ]
        }
      ],
      '/features/': [
        {
          text: 'Core Features',
          items: [
            { text: 'Spec System', link: '/features/spec' },
            { text: 'Memory System', link: '/features/memory' },
            { text: 'CLI Call', link: '/features/cli' },
            { text: 'Dashboard', link: '/features/dashboard' },
            { text: 'CodexLens', link: '/features/codexlens' },
            { text: 'API Settings', link: '/features/api-settings' },
            { text: 'System Settings', link: '/features/system-settings' }
          ]
        }
      ],
      '/mcp/': [
        {
          text: 'MCP Tools',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/mcp/tools' }
          ]
        }
      ],
      '/agents/': [
        {
          text: 'Agents',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/agents/' },
            { text: 'Built-in Agents', link: '/agents/builtin' },
            { text: 'Custom Agents', link: '/agents/custom' }
          ]
        }
      ],
      '/workflows/': [
        {
          text: 'Workflow System',
          collapsible: true,
          items: [
            { text: 'Overview', link: '/workflows/' },
            { text: '4-Level System', link: '/workflows/4-level' },
            { text: 'Best Practices', link: '/workflows/best-practices' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/catlog22/Claude-Code-Workflow' }
    ],

    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present CCW Contributors'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/catlog22/Claude-Code-Workflow/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    // Last updated
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'short'
      }
    },

    // Search (handled by custom FlexSearch DocSearch component)
    search: false
  },

  // Markdown configuration
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    languages: [
      'bash',
      'powershell',
      'json',
      'yaml',
      'toml',
      'javascript',
      'typescript',
      'vue',
      'markdown'
    ],
    config: (md) => {
      // Add markdown-it plugins if needed
    }
  },

  // locales
  locales: {
    root: {
      label: 'English',
      lang: 'en-US'
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'CCW 文档',
      description: 'Claude Code Workspace - 高级 AI 驱动开发环境',
      themeConfig: {
        outline: {
          level: [2, 3],
          label: '本页目录'
        },
        nav: [
          { text: '指南', link: '/zh/guide/ch01-what-is-claude-dms3' },
          { text: '命令', link: '/zh/commands/claude/' },
          { text: '技能', link: '/skills/' },
          { text: '功能', link: '/zh/features/spec' },
          {
            text: '语言',
            items: [
              { text: 'English', link: '/guide/ch01-what-is-claude-dms3' }
            ]
          }
        ],
        sidebar: {
          '/zh/guide/': [
            {
              text: '指南',
              items: [
                { text: 'Claude_dms3 是什么', link: '/zh/guide/ch01-what-is-claude-dms3' },
                { text: '快速开始', link: '/zh/guide/ch02-getting-started' },
                { text: '核心概念', link: '/zh/guide/ch03-core-concepts' },
                { text: '工作流基础', link: '/zh/guide/ch04-workflow-basics' },
                { text: '高级技巧', link: '/zh/guide/ch05-advanced-tips' },
                { text: '最佳实践', link: '/zh/guide/ch06-best-practices' }
              ]
            }
          ],
          '/zh/commands/': [
            {
              text: 'Claude 命令',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/commands/claude/' },
                { text: '核心编排', link: '/zh/commands/claude/core-orchestration' },
                { text: '工作流', link: '/zh/commands/claude/workflow' },
                { text: '会话管理', link: '/zh/commands/claude/session' },
                { text: 'Issue', link: '/zh/commands/claude/issue' },
                { text: 'Memory', link: '/zh/commands/claude/memory' },
                { text: 'CLI', link: '/zh/commands/claude/cli' },
                { text: 'UI 设计', link: '/zh/commands/claude/ui-design' }
              ]
            },
            {
              text: 'Codex Prompts',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/commands/codex/' },
                { text: 'Prep', link: '/zh/commands/codex/prep' },
                { text: 'Review', link: '/zh/commands/codex/review' }
              ]
            }
          ],
          '/zh/skills/': [
            {
              text: 'Claude Skills',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/skills/claude-index' },
                { text: '协作', link: '/zh/skills/claude-collaboration' },
                { text: '工作流', link: '/zh/skills/claude-workflow' },
                { text: '记忆', link: '/zh/skills/claude-memory' },
                { text: '审查', link: '/zh/skills/claude-review' },
                { text: '元技能', link: '/zh/skills/claude-meta' }
              ]
            },
            {
              text: 'Codex Skills',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/skills/codex-index' },
                { text: '生命周期', link: '/zh/skills/codex-lifecycle' },
                { text: '工作流', link: '/zh/skills/codex-workflow' },
                { text: '专项', link: '/zh/skills/codex-specialized' }
              ]
            }
          ],
          '/zh/features/': [
            {
              text: '核心功能',
              items: [
                { text: 'Spec 规范系统', link: '/zh/features/spec' },
                { text: 'Memory 记忆系统', link: '/zh/features/memory' },
                { text: 'CLI 调用', link: '/zh/features/cli' },
                { text: 'Dashboard 面板', link: '/zh/features/dashboard' },
                { text: 'CodexLens', link: '/zh/features/codexlens' },
                { text: 'API 设置', link: '/zh/features/api-settings' },
                { text: '系统设置', link: '/zh/features/system-settings' }
              ]
            }
          ],
          '/zh/workflows/': [
            {
              text: '工作流系统',
              collapsible: true,
              items: [
                { text: '概述', link: '/zh/workflows/' },
                { text: '四级体系', link: '/zh/workflows/4-level' },
                { text: '最佳实践', link: '/zh/workflows/best-practices' }
              ]
            }
          ]
        }
      }
    }
  }
})
