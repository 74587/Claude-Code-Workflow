import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/__docusaurus/debug',
    component: ComponentCreator('/docs/__docusaurus/debug', 'e58'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/config',
    component: ComponentCreator('/docs/__docusaurus/debug/config', '2ce'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/content',
    component: ComponentCreator('/docs/__docusaurus/debug/content', '11b'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/globalData',
    component: ComponentCreator('/docs/__docusaurus/debug/globalData', 'f13'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/metadata',
    component: ComponentCreator('/docs/__docusaurus/debug/metadata', 'bff'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/registry',
    component: ComponentCreator('/docs/__docusaurus/debug/registry', '830'),
    exact: true
  },
  {
    path: '/docs/__docusaurus/debug/routes',
    component: ComponentCreator('/docs/__docusaurus/debug/routes', '13e'),
    exact: true
  },
  {
    path: '/docs/',
    component: ComponentCreator('/docs/', '43a'),
    routes: [
      {
        path: '/docs/',
        component: ComponentCreator('/docs/', '93c'),
        routes: [
          {
            path: '/docs/',
            component: ComponentCreator('/docs/', 'fdb'),
            routes: [
              {
                path: '/docs/commands/cli/cli-init',
                component: ComponentCreator('/docs/commands/cli/cli-init', '159'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/cli/codex-review',
                component: ComponentCreator('/docs/commands/cli/codex-review', 'c66'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/ccw',
                component: ComponentCreator('/docs/commands/general/ccw', '3c1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/ccw-coordinator',
                component: ComponentCreator('/docs/commands/general/ccw-coordinator', '3b4'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/ccw-debug',
                component: ComponentCreator('/docs/commands/general/ccw-debug', 'e0c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/ccw-plan',
                component: ComponentCreator('/docs/commands/general/ccw-plan', '9ae'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/ccw-test',
                component: ComponentCreator('/docs/commands/general/ccw-test', 'e6f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/codex-coordinator',
                component: ComponentCreator('/docs/commands/general/codex-coordinator', 'e7d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/general/flow-create',
                component: ComponentCreator('/docs/commands/general/flow-create', '507'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-convert-to-plan',
                component: ComponentCreator('/docs/commands/issue/issue-convert-to-plan', 'a36'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-discover',
                component: ComponentCreator('/docs/commands/issue/issue-discover', '5ae'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-execute',
                component: ComponentCreator('/docs/commands/issue/issue-execute', '20b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-from-brainstorm',
                component: ComponentCreator('/docs/commands/issue/issue-from-brainstorm', '10c'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-new',
                component: ComponentCreator('/docs/commands/issue/issue-new', 'abb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-plan',
                component: ComponentCreator('/docs/commands/issue/issue-plan', '57f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/issue/issue-queue',
                component: ComponentCreator('/docs/commands/issue/issue-queue', '316'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/memory/memory-compact',
                component: ComponentCreator('/docs/commands/memory/memory-compact', 'fbd'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/memory/memory-docs-full-cli',
                component: ComponentCreator('/docs/commands/memory/memory-docs-full-cli', '8b8'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/memory/memory-docs-related-cli',
                component: ComponentCreator('/docs/commands/memory/memory-docs-related-cli', '707'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/memory/memory-load',
                component: ComponentCreator('/docs/commands/memory/memory-load', '1db'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/memory/memory-update-full',
                component: ComponentCreator('/docs/commands/memory/memory-update-full', '3fa'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/commands/memory/memory-update-related',
                component: ComponentCreator('/docs/commands/memory/memory-update-related', 'c50'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/faq',
                component: ComponentCreator('/docs/faq', '296'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/overview',
                component: ComponentCreator('/docs/overview', 'f90'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/overview.zh',
                component: ComponentCreator('/docs/overview.zh', '7c8'),
                exact: true
              },
              {
                path: '/docs/workflows/faq',
                component: ComponentCreator('/docs/workflows/faq', '58c'),
                exact: true
              },
              {
                path: '/docs/workflows/introduction',
                component: ComponentCreator('/docs/workflows/introduction', '702'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/workflows/level-1-ultra-lightweight',
                component: ComponentCreator('/docs/workflows/level-1-ultra-lightweight', 'b4b'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/workflows/level-2-rapid',
                component: ComponentCreator('/docs/workflows/level-2-rapid', 'fe1'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/workflows/level-3-standard',
                component: ComponentCreator('/docs/workflows/level-3-standard', '65f'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/workflows/level-4-brainstorm',
                component: ComponentCreator('/docs/workflows/level-4-brainstorm', 'fae'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/workflows/level-5-intelligent',
                component: ComponentCreator('/docs/workflows/level-5-intelligent', 'fa9'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/',
                component: ComponentCreator('/docs/', '6df'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/docs/',
                component: ComponentCreator('/docs/', '907'),
                exact: true
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
