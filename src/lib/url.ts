/**
 * 生成尊重 base 路径的站内链接。
 * GitHub Pages 部署在子路径时自动补前缀，本地开发（base=/）无影响。
 */
export function url(path: string): string {
  const raw = import.meta.env.BASE_URL || '/';
  const base = raw.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : '/' + path;
  return base + suffix;
}
