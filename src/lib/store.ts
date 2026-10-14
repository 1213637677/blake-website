import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { contentDirs } from '../config';

export type CollectionName = 'posts' | 'projects' | 'notes';

const ROOT = process.cwd();

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function validSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length <= 80;
}

export function isCollection(name: string): name is CollectionName {
  return name === 'posts' || name === 'projects' || name === 'notes';
}

/** 解析并校验真实路径必须落在目标目录内，防目录穿越 */
function safePath(collection: CollectionName, slug: string): string {
  const dir = path.resolve(ROOT, contentDirs[collection]);
  const file = path.resolve(dir, `${slug}.md`);
  if (!file.startsWith(dir + path.sep)) throw new Error('非法路径');
  return file;
}

export type EntryFile = {
  collection: CollectionName;
  slug: string;
  data: Record<string, unknown>;
  body: string;
  file: string;
  mtime: number;
};

export async function listEntries(): Promise<EntryFile[]> {
  const out: EntryFile[] = [];
  for (const collection of Object.keys(contentDirs) as CollectionName[]) {
    const dir = path.resolve(ROOT, contentDirs[collection]);
    let files: string[];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
    } catch {
      continue;
    }
    for (const f of files) {
      const slug = f.replace(/\.(md|mdx)$/, '');
      const file = path.join(dir, f);
      const raw = await fs.readFile(file, 'utf8');
      const { data, content } = matter(raw);
      const stat = await fs.stat(file);
      out.push({ collection, slug, data: data as Record<string, unknown>, body: content, file, mtime: stat.mtimeMs });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export async function readEntry(collection: CollectionName, slug: string): Promise<EntryFile | null> {
  if (!validSlug(slug)) return null;
  const file = safePath(collection, slug);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const { data, content } = matter(raw);
    const stat = await fs.stat(file);
    return { collection, slug, data: data as Record<string, unknown>, body: content, file, mtime: stat.mtimeMs };
  } catch {
    return null;
  }
}

export type SaveInput = {
  collection: CollectionName;
  slug: string;
  /** 重命名时使用；为空表示不改名 */
  newSlug?: string;
  data: Record<string, unknown>;
  body: string;
};

export async function saveEntry(input: SaveInput): Promise<{ slug: string }> {
  const { collection, slug, data, body } = input;
  if (!validSlug(slug)) throw new Error('slug 只允许小写字母、数字与连字符');

  const target = input.newSlug && input.newSlug !== slug ? input.newSlug : slug;
  if (!validSlug(target)) throw new Error('新 slug 不合法');

  const file = safePath(collection, target);
  await fs.mkdir(path.dirname(file), { recursive: true });

  const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined));
  const out = matter.stringify(body.replace(/\s*$/, '\n'), cleaned);
  await fs.writeFile(file, out, 'utf8');

  if (target !== slug) {
    const old = safePath(collection, slug);
    try {
      await fs.unlink(old);
    } catch {
      // 原文件可能不存在（新建场景）
    }
  }

  return { slug: target };
}

export async function deleteEntry(collection: CollectionName, slug: string): Promise<void> {
  if (!validSlug(slug)) throw new Error('slug 不合法');
  const file = safePath(collection, slug);
  await fs.unlink(file);
}

/* ---------- 上传 ---------- */

const ALLOWED = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/svg+xml', 'svg'],
]);

export const MAX_UPLOAD = 4 * 1024 * 1024;

export async function saveUpload(file: File): Promise<string> {
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new Error(`不支持的文件类型：${file.type || '未知'}`);
  if (file.size > MAX_UPLOAD) throw new Error('文件超过 4MB');

  const dir = path.resolve(ROOT, 'public/uploads');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8);
  const name = `${stamp}-${rand}.${ext}`;
  const target = path.resolve(dir, name);
  if (!target.startsWith(dir + path.sep)) throw new Error('非法路径');

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
