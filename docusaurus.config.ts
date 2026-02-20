import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// GitHub Pages deployment settings
const organizationName = 'xxtars';
const projectName = 'affective-computing-research';

const config: Config = {
  title: 'Affective Computing Research',
  tagline: 'Researchers × Papers — a structured collection',
  favicon: 'img/emotional.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // GitHub Pages URL config
  url: `https://${organizationName}.github.io`,
  baseUrl: `/${projectName}/`,

  // GitHub pages deployment config.
  organizationName,
  projectName,

  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // "Edit this page" link target (optional but recommended)
          editUrl: `https://github.com/${organizationName}/${projectName}/tree/main/`,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // "Edit this page" link target (optional but recommended)
          editUrl: `https://github.com/${organizationName}/${projectName}/tree/main/`,
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card (optional)
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Affective Computing Research',
      logo: {
        alt: 'Awesome Affective Computing Logo',
        src: 'img/emotional.png',
      },
      items: [
        {to: '/researchers', label: 'Researchers', position: 'left'},
        {to: '/papers', label: 'Papers', position: 'left'},
        {
          href: `https://github.com/${organizationName}/${projectName}`,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Disclaimer',
          items: [
            {
              html: `
                <div class="footer-footnote">
                  <p>Most content is AI-assisted collection/analysis with personal summary and curation.</p>
                  <p>The researcher list is continuously updated and is not a ranking or complete coverage.</p>
                  <p>Outputs may contain mistakes, outdated information, omissions, or interpretation bias.</p>
                  <p>Please verify critical details with official paper pages, publisher records, Google Scholar, and OpenAlex.</p>
                </div>
              `,
            },
          ],
        },
        {
          title: 'Browse',
          items: [
            {
              label: 'Researchers',
              to: '/researchers',
            },
            {
              label: 'Papers',
              to: '/papers',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: `https://github.com/${organizationName}/${projectName}`,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Awesome Affective Computing. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
