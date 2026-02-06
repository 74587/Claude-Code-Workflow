import type { Config } from '@docusaurus/types';
import type { Options as PresetOptions } from '@docusaurus/preset-classic';
import type { ThemeConfig } from '@docusaurus/preset-classic';

const config: Config = {
  title: 'CCW Help Documentation',
  tagline: 'Professional Workflow Automation Platform',
  favicon: 'img/favicon.svg',

  url: 'http://localhost:3001',
  baseUrl: '/docs/',

  organizationName: 'ccw',
  projectName: 'docs',

  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    localeConfigs: {
      zh: {
        label: '简体中文',
        htmlLang: 'zh-CN',
      },
    },
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/ccw/docs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: ['./src/css/custom.css'],
        },
      } satisfies PresetOptions,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'CCW Help',
      logo: {
        alt: 'CCW Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} CCW. Built with Docusaurus.`,
    },
    prism: {
      additionalLanguages: ['typescript', 'javascript', 'bash', 'python', 'java', 'go', 'yaml', 'json'],
    },
  } satisfies ThemeConfig,

  markdown: {
    mermaid: true,
  },
};

export default config;
