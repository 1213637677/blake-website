# Blake 个人网站

记录工作项目经历、学习过程与感悟的个人站点。Astro 静态构建，内容源是 Git 里的 Markdown，附带一个写回同一批文件的后台。

## 在线地址

https://1213637677.github.io/blake-website/

推送到 `main` 分支后 GitHub Actions 会自动构建并部署到 Pages。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 产物在 dist/
npm run preview

# 构建 Pages 版本（带 /blake-website 子路径）
SITE_URL=https://1213637677.github.io BASE_PATH=/blake-website npm run build
```

## 后台说明

`/admin` 需要 Node 运行时。**GitHub Pages 只托管静态文件，线上后台不可用**。本地开发时带口令启动：

```bash
ADMIN_PASSWORD=你的口令 npm run dev
```

访问 `/admin` 登录后，可新建/编辑/删除文章、项目、笔记（直接写回 `content/` 文件）。

## 写作流程

**方式 A：直接写文件（推荐）**

在 `content/` 下新建 Markdown：

```
content/posts/     文章（感悟、学习、复盘）
content/projects/  项目（工作 / 个人）
content/notes/     短笔记
```

frontmatter 字段见 `src/content.config.ts`，保存即生效，`git push` 触发部署。

**方式 B：浏览器后台**

```bash
ADMIN_PASSWORD=你的口令 npm run dev
```

访问 `/admin` 登录后可新建、编辑、删除条目和上传图片。数据写回 `content/` 与 `public/uploads/`，和方式 A 共用同一份文件。**注意**：后台需要 Node 运行时（本地或自托管），纯静态托管（GitHub Pages 等）下后台自动禁用，站点不受影响。

## 目录结构

```
content/            全部内容（Markdown）
public/uploads/     上传的图片
src/config.ts       站点信息、导航、社交链接——改这里即可
src/content.config.ts  内容 schema（Zod 校验）
src/pages/          路由
src/components/     组件
src/styles/         设计 token 与排版
docs/               产品文档与评估
```

## 部署

- **纯静态托管**（Vercel / Netlify / Cloudflare Pages / GitHub Pages）：`npm run build` 后把 `dist/` 交出去即可，后台功能自动关闭。
- **自托管 Node**：`node dist/server/entry.mjs`，配合 `ADMIN_PASSWORD` 启用后台。

部署前把 `astro.config.mjs` 和 `src/config.ts` 里的 `site.url` 换成你的域名。
