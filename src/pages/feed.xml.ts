import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { site } from '../config';
import { getPosts, getProjects, getNotes } from '../lib/entries';

export const GET: APIRoute = async (context) => {
  const [posts, projects, notes] = await Promise.all([getPosts(), getProjects(), getNotes()]);

  const items = [
    ...posts.map((p) => ({
      title: p.data.title,
      description: p.data.summary,
      pubDate: p.data.date,
      link: `/writing/${p.id}/`,
      categories: p.data.tags,
    })),
    ...projects.map((p) => ({
      title: `[项目] ${p.data.title}`,
      description: p.data.summary,
      pubDate: p.data.date,
      link: `/projects/${p.id}/`,
      categories: p.data.tags,
    })),
    ...notes.map((n) => ({
      title: `[笔记] ${n.data.title}`,
      description: n.data.summary || n.body?.slice(0, 200) || '',
      pubDate: n.data.date,
      link: `/notes/#${n.id}`,
      categories: n.data.tags,
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: site.name,
    description: site.intro,
    site: context.site ?? site.url,
    items,
    customData: `<language>${site.lang}</language>`,
  });
};
