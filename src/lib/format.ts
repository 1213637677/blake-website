export function fmtDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function isoDate(d: Date): string {
  return d.toISOString();
}

export function year(d: Date): string {
  return String(d.getUTCFullYear());
}

/** 用于 datetime 属性与 RSS 的 RFC822 */
export function rfc822(d: Date): string {
  return d.toUTCString();
}

export function tagHref(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}`;
}

/** 中英文混排时给标题一个稳定的 slug（用于锚点） */
export function anchor(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
