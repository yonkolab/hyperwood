import { themes as prismThemes } from 'prism-react-renderer';

const apiReferenceUrl =
  process.env.DOCS_API_REFERENCE_URL ?? 'http://localhost:8081/reference/';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Hyperwood Developer Docs',
  tagline: 'Onboarding, architecture, business rules, and module internals',
  favicon:
    'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>H</text></svg>',
  url: 'http://localhost',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: undefined,
        },
        blog: false,
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'guides',
        path: '../guides',
        routeBasePath: 'guides',
        sidebarPath: './sidebars-guides.js',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'specs',
        path: '../../openspec/specs',
        routeBasePath: 'specs',
        sidebarPath: './sidebars-specs.js',
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'Hyperwood',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'developerSidebar',
          label: 'Developer Docs',
          position: 'left',
        },
        {
          to: '/guides/getting-started',
          label: 'Guides',
          position: 'left',
        },
        {
          to: '/specs/identity-and-access/spec',
          label: 'Specs',
          position: 'left',
        },
        {
          href: apiReferenceUrl,
          label: 'API Reference',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Developer Docs',
              to: '/',
            },
            {
              label: 'Guides',
              to: '/guides/getting-started',
            },
            {
              label: 'Canonical Specs',
              to: '/specs/identity-and-access/spec',
            },
          ],
        },
        {
          title: 'Reference',
          items: [
            {
              label: 'API Reference',
              href: apiReferenceUrl,
            },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Hyperwood`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

export default config;
