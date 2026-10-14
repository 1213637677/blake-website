import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../config';
import { verifySession } from '../../lib/auth';
import { deleteEntry, isCollection, validSlug } from '../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(ADMIN_COOKIE)?.value)) {
    return new Response('未授权', { status: 401 });
  }

  const form = await request.formData();
  const collection = String(form.get('collection') ?? '');
  const slug = String(form.get('slug') ?? form.get('originalSlug') ?? '');

  const fail = (msg: string) =>
    new Response(null, { status: 303, headers: { location: `/admin?error=${encodeURIComponent(msg)}` } });

  if (!isCollection(collection)) return fail('类型不合法');
  if (!validSlug(slug)) return fail('slug 不合法');

  try {
    await deleteEntry(collection, slug);
  } catch (err) {
    return fail(err instanceof Error ? err.message : '删除失败');
  }

  return new Response(null, { status: 303, headers: { location: '/admin' } });
};
