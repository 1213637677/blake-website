// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://blake.example.com',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx(), sitemap()],
  // Node 适配器会对 POST 做 origin 校验。不配置 allowedHosts 时
  // url.origin 会被推导成 http://localhost（丢端口），导致后台登录
  // 一律 403 Cross-site POST form submissions are forbidden。
  server: {
    allowedHosts: ['localhost', '127.0.0.1', 'blake.example.com'],
  },
  // Markdown is authored in the admin editor too, so keep rendering strict but readable.
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      // 不插软换行：ASCII 流程图靠列对齐表达结构，折行会破坏可读性。
      // 长代码行与宽流程图改为容器内横向滚动。
      wrap: false,
    },
  },
});
