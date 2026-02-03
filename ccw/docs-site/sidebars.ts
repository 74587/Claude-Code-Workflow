import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'overview',
      label: 'Quick Start',
    },
    {
      type: 'category',
      label: 'Commands',
      collapsible: true,
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'General Commands',
          collapsible: true,
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'commands/general/ccw',
              label: 'ccw',
            },
            {
              type: 'doc',
              id: 'commands/general/ccw-plan',
              label: 'ccw-plan',
            },
            {
              type: 'doc',
              id: 'commands/general/ccw-test',
              label: 'ccw-test',
            },
            {
              type: 'doc',
              id: 'commands/general/ccw-coordinator',
              label: 'ccw-coordinator',
            },
            {
              type: 'doc',
              id: 'commands/general/ccw-debug',
              label: 'ccw-debug',
            },
            {
              type: 'doc',
              id: 'commands/general/flow-create',
              label: 'flow-create',
            },
            {
              type: 'doc',
              id: 'commands/general/codex-coordinator',
              label: 'codex-coordinator',
            },
          ],
        },
        {
          type: 'category',
          label: 'Issue Commands',
          collapsible: true,
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'commands/issue/issue-new',
              label: 'issue-new',
            },
            {
              type: 'doc',
              id: 'commands/issue/issue-discover',
              label: 'issue-discover',
            },
            {
              type: 'doc',
              id: 'commands/issue/issue-plan',
              label: 'issue-plan',
            },
            {
              type: 'doc',
              id: 'commands/issue/issue-queue',
              label: 'issue-queue',
            },
            {
              type: 'doc',
              id: 'commands/issue/issue-execute',
              label: 'issue-execute',
            },
            {
              type: 'doc',
              id: 'commands/issue/issue-from-brainstorm',
              label: 'issue-from-brainstorm',
            },
            {
              type: 'doc',
              id: 'commands/issue/issue-convert-to-plan',
              label: 'issue-convert-to-plan',
            },
          ],
        },
        {
          type: 'category',
          label: 'CLI Commands',
          collapsible: true,
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'commands/cli/cli-init',
              label: 'cli-init',
            },
            {
              type: 'doc',
              id: 'commands/cli/codex-review',
              label: 'codex-review',
            },
          ],
        },
        {
          type: 'category',
          label: 'Memory Commands',
          collapsible: true,
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'commands/memory/memory-update-full',
              label: 'memory-update-full',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-update-related',
              label: 'memory-update-related',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-load',
              label: 'memory-load',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-docs-full-cli',
              label: 'memory-docs-full-cli',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-docs-related-cli',
              label: 'memory-docs-related-cli',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-compact',
              label: 'memory-compact',
            },
          ],
        },
        {
          type: 'category',
          label: 'Memory Commands',
          collapsible: true,
          collapsed: false,
          items: [
            {
              type: 'doc',
              id: 'commands/memory/memory-update-full',
              label: 'memory-update-full',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-update-related',
              label: 'memory-update-related',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-load',
              label: 'memory-load',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-docs-full-cli',
              label: 'memory-docs-full-cli',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-docs-related-cli',
              label: 'memory-docs-related-cli',
            },
            {
              type: 'doc',
              id: 'commands/memory/memory-compact',
              label: 'memory-compact',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Workflows',
      collapsible: true,
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'workflows/introduction',
          label: 'Introduction',
        },
        {
          type: 'doc',
          id: 'workflows/level-1-ultra-lightweight',
          label: 'Level 1: Ultra Lightweight',
        },
        {
          type: 'doc',
          id: 'workflows/level-2-rapid',
          label: 'Level 2: Rapid',
        },
        {
          type: 'doc',
          id: 'workflows/level-3-standard',
          label: 'Level 3: Standard',
        },
        {
          type: 'doc',
          id: 'workflows/level-4-brainstorm',
          label: 'Level 4: Brainstorm',
        },
        {
          type: 'doc',
          id: 'workflows/level-5-intelligent',
          label: 'Level 5: Intelligent',
        },
      ],
    },
    {
      type: 'doc',
      id: 'faq',
      label: 'FAQ',
    },
  ],
};

export default sidebars;
