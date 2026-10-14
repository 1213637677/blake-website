/**
 * 给 Markdown 中以 / 开头的图片 src 补上 base 前缀（GitHub Pages 子路径部署需要）。
 */
export function rehypeBaseUrl() {
  return (tree) => {
    const base = process.env.BASE_PATH || '/';
    if (base === '/') return;

    const prefix = base.replace(/\/$/, '');

    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'img' && node.properties?.src) {
        const src = String(node.properties.src);
        if (src.startsWith('/') && !src.startsWith(prefix + '/')) {
          node.properties.src = prefix + src;
        }
      }
      if (node.children) node.children.forEach(visit);
    };

    visit(tree);
  };
}
