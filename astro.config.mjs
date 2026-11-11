// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://hyperprobe.co',
  markdown: {
    processor: satteri({ features: { smartPunctuation: false } })
  },
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [sitemap()]
});
