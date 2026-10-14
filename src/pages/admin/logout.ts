import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../config';

export const prerender = false;

/** 退出登录：表单 POST 到这里，清掉会话 Cookie */
export const POST: APIRoute = async () =>
  new Response(null, {
    status: 303,
    headers: {
      location: '/admin/login',
      'set-cookie': `${ADMIN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    },
  });
