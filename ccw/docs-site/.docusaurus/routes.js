import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/zh/',
    component: ComponentCreator('/docs/zh/', 'f41'),
    routes: [
      {
        path: '/docs/zh/',
        component: ComponentCreator('/docs/zh/', 'dbd'),
        routes: [
          {
            path: '/docs/zh/',
            component: ComponentCreator('/docs/zh/', 'c34'),
            routes: [
              {
                path: '/docs/zh/commands/cli/cli-init',
                component: ComponentCreator('/docs/zh/commands/cli/cli-init', 'fe3'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/cli/codex-review',
                component: ComponentCreator('/docs/zh/commands/cli/codex-review', 'e65'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/ccw',
                component: ComponentCreator('/docs/zh/commands/general/ccw', '83a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/ccw-coordinator',
                component: ComponentCreator('/docs/zh/commands/general/ccw-coordinator', 'f35'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/ccw-debug',
                component: ComponentCreator('/docs/zh/commands/general/ccw-debug', 'b0a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/ccw-plan',
                component: ComponentCreator('/docs/zh/commands/general/ccw-plan', '39d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/ccw-test',
                component: ComponentCreator('/docs/zh/commands/general/ccw-test', '765'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/codex-coordinator',
                component: ComponentCreator('/docs/zh/commands/general/codex-coordinator', '486'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/general/flow-create',
                component: ComponentCreator('/docs/zh/commands/general/flow-create', 'd53'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-convert-to-plan',
                component: ComponentCreator('/docs/zh/commands/issue/issue-convert-to-plan', '0df'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-discover',
                component: ComponentCreator('/docs/zh/commands/issue/issue-discover', '9b4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-execute',
                component: ComponentCreator('/docs/zh/commands/issue/issue-execute', 'cfd'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-from-brainstorm',
                component: ComponentCreator('/docs/zh/commands/issue/issue-from-brainstorm', 'd2f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-new',
                component: ComponentCreator('/docs/zh/commands/issue/issue-new', '7f9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-plan',
                component: ComponentCreator('/docs/zh/commands/issue/issue-plan', 'ed4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/issue/issue-queue',
                component: ComponentCreator('/docs/zh/commands/issue/issue-queue', 'a4b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/memory/memory-compact',
                component: ComponentCreator('/docs/zh/commands/memory/memory-compact', '8dc'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/memory/memory-docs-full-cli',
                component: ComponentCreator('/docs/zh/commands/memory/memory-docs-full-cli', '1a7'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/memory/memory-docs-related-cli',
                component: ComponentCreator('/docs/zh/commands/memory/memory-docs-related-cli', 'f28'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/memory/memory-load',
                component: ComponentCreator('/docs/zh/commands/memory/memory-load', 'aee'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/memory/memory-update-full',
                component: ComponentCreator('/docs/zh/commands/memory/memory-update-full', '2a1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/commands/memory/memory-update-related',
                component: ComponentCreator('/docs/zh/commands/memory/memory-update-related', '991'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/faq',
                component: ComponentCreator('/docs/zh/faq', '9bf'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/overview',
                component: ComponentCreator('/docs/zh/overview', '2d1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/workflows/faq',
                component: ComponentCreator('/docs/zh/workflows/faq', '319'),
                exact: true
              },
              {
                path: '/docs/zh/workflows/introduction',
                component: ComponentCreator('/docs/zh/workflows/introduction', 'dc8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/workflows/level-1-ultra-lightweight',
                component: ComponentCreator('/docs/zh/workflows/level-1-ultra-lightweight', '4d3'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/workflows/level-2-rapid',
                component: ComponentCreator('/docs/zh/workflows/level-2-rapid', 'e2a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/workflows/level-3-standard',
                component: ComponentCreator('/docs/zh/workflows/level-3-standard', '936'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/workflows/level-4-brainstorm',
                component: ComponentCreator('/docs/zh/workflows/level-4-brainstorm', '87d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/workflows/level-5-intelligent',
                component: ComponentCreator('/docs/zh/workflows/level-5-intelligent', 'b09'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/zh/',
                component: ComponentCreator('/docs/zh/', '0e3'),
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
