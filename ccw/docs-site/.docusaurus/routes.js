import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/docs',
    component: ComponentCreator('/docs/docs', '942'),
    routes: [
      {
        path: '/docs/docs',
        component: ComponentCreator('/docs/docs', 'a90'),
        routes: [
          {
            path: '/docs/docs',
            component: ComponentCreator('/docs/docs', 'c2e'),
            routes: [
              {
                path: '/docs/docs/commands/cli/cli-init',
                component: ComponentCreator('/docs/docs/commands/cli/cli-init', 'c74'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/cli/codex-review',
                component: ComponentCreator('/docs/docs/commands/cli/codex-review', '937'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/ccw',
                component: ComponentCreator('/docs/docs/commands/general/ccw', '3fb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/ccw-coordinator',
                component: ComponentCreator('/docs/docs/commands/general/ccw-coordinator', 'a90'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/ccw-debug',
                component: ComponentCreator('/docs/docs/commands/general/ccw-debug', '663'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/ccw-plan',
                component: ComponentCreator('/docs/docs/commands/general/ccw-plan', '40b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/ccw-test',
                component: ComponentCreator('/docs/docs/commands/general/ccw-test', '99d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/codex-coordinator',
                component: ComponentCreator('/docs/docs/commands/general/codex-coordinator', '996'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/general/flow-create',
                component: ComponentCreator('/docs/docs/commands/general/flow-create', 'd91'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-convert-to-plan',
                component: ComponentCreator('/docs/docs/commands/issue/issue-convert-to-plan', 'd90'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-discover',
                component: ComponentCreator('/docs/docs/commands/issue/issue-discover', '2a1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-execute',
                component: ComponentCreator('/docs/docs/commands/issue/issue-execute', 'abb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-from-brainstorm',
                component: ComponentCreator('/docs/docs/commands/issue/issue-from-brainstorm', '72b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-new',
                component: ComponentCreator('/docs/docs/commands/issue/issue-new', 'c58'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-plan',
                component: ComponentCreator('/docs/docs/commands/issue/issue-plan', 'fd2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/issue/issue-queue',
                component: ComponentCreator('/docs/docs/commands/issue/issue-queue', '1ce'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/memory/memory-compact',
                component: ComponentCreator('/docs/docs/commands/memory/memory-compact', '74c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/memory/memory-docs-full-cli',
                component: ComponentCreator('/docs/docs/commands/memory/memory-docs-full-cli', '7a4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/memory/memory-docs-related-cli',
                component: ComponentCreator('/docs/docs/commands/memory/memory-docs-related-cli', 'fb4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/memory/memory-load',
                component: ComponentCreator('/docs/docs/commands/memory/memory-load', 'c66'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/memory/memory-update-full',
                component: ComponentCreator('/docs/docs/commands/memory/memory-update-full', 'b80'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/commands/memory/memory-update-related',
                component: ComponentCreator('/docs/docs/commands/memory/memory-update-related', 'f0d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/faq',
                component: ComponentCreator('/docs/docs/faq', '4b2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/overview',
                component: ComponentCreator('/docs/docs/overview', '7df'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/workflows/faq',
                component: ComponentCreator('/docs/docs/workflows/faq', 'f47'),
                exact: true
              },
              {
                path: '/docs/docs/workflows/introduction',
                component: ComponentCreator('/docs/docs/workflows/introduction', '4cb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/workflows/level-1-ultra-lightweight',
                component: ComponentCreator('/docs/docs/workflows/level-1-ultra-lightweight', '5c4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/workflows/level-2-rapid',
                component: ComponentCreator('/docs/docs/workflows/level-2-rapid', 'ad8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/workflows/level-3-standard',
                component: ComponentCreator('/docs/docs/workflows/level-3-standard', '3ea'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/workflows/level-4-brainstorm',
                component: ComponentCreator('/docs/docs/workflows/level-4-brainstorm', 'f4f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/docs/workflows/level-5-intelligent',
                component: ComponentCreator('/docs/docs/workflows/level-5-intelligent', '84a'),
                exact: true,
                sidebar: "docs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
