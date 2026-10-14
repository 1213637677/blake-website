import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../config';
import { verifySession } from '../../lib/auth';
import { isCollection, saveEntry, validSlug } from '../../lib/store';

export const prerender = false;

const back = (msg?: string) =>
  new Response(null, {
    status: 303,
    headers: { location: `/admin${msg ? `?error=${encodeURIComponent(msg)}` : ''}` },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(ADMIN_COOKIE)?.value)) {
    return new Response('未授权', { status: 401 });
  }

  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? '').trim();

  const collection = get('collection');
  if (!isCollection(collection)) return back('类型不合法');

  const originalSlug = get('originalSlug');
  const title = get('title');
  if (!title) return back('标题不能为空');

  // slug：手填优先，否则由标题生成（中文转拼音失败时退化为日期前缀）
  let slug = get('slug');
  if (!slug) slug = slugify(title);
  if (!validSlug(slug)) return back('slug 只允许小写字母、数字与连字符，且不能以连字符开头');

  const split = (v: string) =>
    v
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const linksRaw = get('links');
  const links = linksRaw
    ? linksRaw
        .split('\n')
        .map((line) => line.split('|').map((s) => s.trim()))
        .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
        .map(([label, href, kind]) => ({
          label: label ?? '',
          href: href ?? '',
          kind: (['demo', 'source', 'post'].includes((kind ?? '').toLowerCase())
            ? (kind ?? '').toLowerCase()
            : 'source') as 'demo' | 'source' | 'post',
        }))
    : [];

  const data: Record<string, unknown> = {
    title,
    summary: get('summary'),
    date: get('date'),
    updated: get('updated'),
    tags: split(get('tags')),
    draft: form.get('draft') === 'on',
    pinned: form.get('pinned') === 'on',
  };

  if (collection === 'posts') {
    data.kind = get('kind') || 'essay';
  }

  if (collection === 'projects') {
    data.kind = get('kind') || 'personal';
    data.status = get('status') || 'shipped';
    data.role = get('role');
    data.period = get('period');
    data.cover = get('cover');
    data.stack = split(get('stack'));
    data.links = links;
    data.featured = form.get('featured') === 'on';
  }

  const body = String(form.get('body') ?? '');

  try {
    // 已有条目以原 slug 为基准，newSlug 变化时由 store 负责改名并清理旧文件
    const saved = await saveEntry({
      collection,
      slug: originalSlug || slug,
      newSlug: slug,
      data,
      body,
    });
    return new Response(null, {
      status: 303,
      headers: { location: `/admin/edit?c=${collection}&s=${saved.slug}` },
    });
  } catch (err) {
    return back(err instanceof Error ? err.message : '保存失败');
  }
};

function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (ascii) return ascii;

  // 纯中文标题：用时间戳 + 短随机，保证可读且不冲突
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `post-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
}
