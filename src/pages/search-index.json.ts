import type { APIRoute } from 'astro';
import { getPosts, getProjects, getNotes, readingTime } from '../lib/entries';

/** 构建期生成全文索引，供 /search 前端匹配。中文按 bigram 切分。 */
export const GET: APIRoute = async () => {
  const [posts, projects, notes] = await Promise.all([getPosts(), getProjects(), getNotes()]);

  const docs = [
    ...posts.map((p) => ({
      kind: 'post' as const,
      title: p.data.title,
      summary: p.data.summary,
      tags: p.data.tags,
      href: `/writing/${p.id}`,
      date: p.data.date.toISOString(),
      text: strip(p.body ?? '').slice(0, 1500),
      minutes: readingTime(p.body ?? ''),
    })),
    ...projects.map((p) => ({
      kind: 'project' as const,
      title: p.data.title,
      summary: p.data.summary,
      tags: [...p.data.tags, ...p.data.stack],
      href: `/projects/${p.id}`,
      date: p.data.date.toISOString(),
      text: strip(p.body ?? '').slice(0, 1500),
      minutes: undefined,
    })),
    ...notes.map((n) => ({
      kind: 'note' as const,
      title: n.data.title,
      summary: n.data.summary,
      tags: n.data.tags,
      href: `/notes#${n.id}`,
      date: n.data.date.toISOString(),
      text: strip(n.body ?? '').slice(0, 800),
      minutes: undefined,
    })),
  ];

  return new Response(JSON.stringify({ docs }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};

function strip(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^---[\s\S]*?---/, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
