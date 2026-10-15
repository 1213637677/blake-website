import { getCollection, type CollectionEntry } from 'astro:content';

export type EntryKind = 'post' | 'project' | 'note';

export type Unified = {
  kind: EntryKind;
  slug: string;
  href: string;
  title: string;
  summary: string;
  date: Date;
  updated?: Date;
  tags: string[];
  cover?: string;
  pinned: boolean;
  /** 仅项目有 */
  featured?: boolean;
  stack?: string[];
  readingTime?: number;
};

const KIND_LABEL: Record<EntryKind, string> = {
  post: 'POST',
  project: 'PROJECT',
  note: 'LOG',
};

export function kindLabel(kind: EntryKind) {
  return KIND_LABEL[kind];
}

const CJK = /[\u4e00-\u9fff\u3040-\u30ff]/g;

export function readingTime(body: string): number {
  if (!body) return 1;
  const cjk = (body.match(CJK) ?? []).length;
  const words = body.replace(CJK, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

function hideDrafts(e: { data: { draft?: boolean } }) {
  return import.meta.env.PROD ? !e.data.draft : true;
}

export async function getPosts() {
  return (await getCollection('posts', hideDrafts)).sort(byDate);
}

export async function getProjects() {
  return (await getCollection('projects', hideDrafts)).sort(byDate);
}

export async function getNotes() {
  return (await getCollection('notes', hideDrafts)).sort(byDate);
}

function byDate(a: { data: { date: Date } }, b: { data: { date: Date } }) {
  return b.data.date.valueOf() - a.data.date.valueOf();
}

/** 首页混合时间线：三类内容按时间降序合并 */
export async function getTimeline(): Promise<Unified[]> {
  const [posts, projects, notes] = await Promise.all([getPosts(), getProjects(), getNotes()]);
  const items: Unified[] = [
    ...posts.map((p) => toUnified('post', p.id, `/writing/${p.id}`, p.data, p.body ?? '')),
    ...projects.map((p) => toUnified('project', p.id, `/projects/${p.id}`, p.data, p.body ?? '')),
    ...notes.map((n) => toUnified('note', n.id, `/notes#${n.id}`, n.data, n.body ?? '')),
  ];
  return items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.valueOf() - a.date.valueOf();
  });
}

function toUnified(
  kind: EntryKind,
  slug: string,
  href: string,
  data: Record<string, unknown>,
  body: string,
): Unified {
  return {
    kind,
    slug,
    href,
    title: String(data.title ?? slug),
    summary: String(data.summary ?? ''),
    date: data.date as Date,
    updated: data.updated as Date | undefined,
    tags: (data.tags as string[] | undefined) ?? [],
    cover: data.cover as string | undefined,
    pinned: Boolean(data.pinned),
    featured: data.featured as boolean | undefined,
    stack: data.stack as string[] | undefined,
    readingTime: readingTime(body),
  };
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const items = await getTimeline();
  const map = new Map<string, number>();
  for (const it of items) {
    for (const t of it.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export type AnyEntry = CollectionEntry<'posts'> | CollectionEntry<'projects'> | CollectionEntry<'notes'>;
