import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../config';
import {
  adminEnabled,
  checkPassword,
  clearFailures,
  noteFailure,
  signSession,
  waitForFailures,
} from '../../lib/auth';

export const prerender = false;

/** 登录：POST 校验口令并下发签名 Cookie */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!adminEnabled()) return new Response('后台未启用', { status: 403 });

  const key = clientAddress ?? 'unknown';
  await waitForFailures(key);

  const form = await request.formData();
  const password = String(form.get('password') ?? '');

  if (!checkPassword(password)) {
    noteFailure(key);
    return new Response(null, { status: 303, headers: { location: '/admin/login?error=1' } });
  }

  clearFailures(key);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: {
      location: '/admin',
      'set-cookie': `${ADMIN_COOKIE}=${signSession()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`,
    },
  });
};

/** 退出：清掉 Cookie */
export const DELETE: APIRoute = async () => logout();

export const ALL: APIRoute = async ({ request }) => {
  if (request.method === 'DELETE') return logout();
  return new Response('Method not allowed', { status: 405 });
};

function logout() {
  return new Response(null, {
    status: 303,
    headers: {
      location: '/admin/login',
      'set-cookie': `${ADMIN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    },
  });
}
