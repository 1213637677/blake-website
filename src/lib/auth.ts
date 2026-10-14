import { createHmac, timingSafeEqual } from 'node:crypto';
import { ADMIN_COOKIE } from '../config';

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'dev-insecure';
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 签名会话值：`<exp>.<hmac>`，防止客户端伪造 */
export function signSession(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const mac = createHmac('sha256', secret()).update(String(exp)).digest('hex');
  return `${exp}.${mac}`;
}

export function verifySession(value: string | undefined): boolean {
  if (!value || !adminEnabled()) return false;
  const [expRaw, mac] = value.split('.');
  if (!expRaw || !mac) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac('sha256', secret()).update(expRaw).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const cookieName = ADMIN_COOKIE;

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  };
}

/** 简易限流：同一进程内按失败次数退避 */
const failures = new Map<string, number>();

export function noteFailure(key: string): number {
  const n = (failures.get(key) ?? 0) + 1;
  failures.set(key, n);
  return n;
}

export function clearFailures(key: string) {
  failures.delete(key);
}

export function waitForFailures(key: string): Promise<void> {
  const n = failures.get(key) ?? 0;
  const ms = Math.min(3000, n * 400);
  return ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}
