import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../config';
import { verifySession } from '../../lib/auth';
import { saveUpload } from '../../lib/store';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!verifySession(cookies.get(ADMIN_COOKIE)?.value)) {
    return new Response('未授权', { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');

  const fail = (msg: string) =>
    new Response(null, { status: 303, headers: { location: `/admin/uploads?error=${encodeURIComponent(msg)}` } });

  if (!(file instanceof File) || file.size === 0) return fail('没有选择文件');

  try {
    const url = await saveUpload(file);
    const name = url.split('/').pop() ?? '';
    return new Response(null, {
      status: 303,
      headers: { location: `/admin/uploads?uploaded=${encodeURIComponent(name)}` },
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : '上传失败');
  }
};
