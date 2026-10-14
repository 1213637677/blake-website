/**
 * 站点配置：改这里就能换掉全站的身份信息、导航与链接。
 * 内容与链接初始留空，按需填写。
 */

export const site = {
  name: 'Blake',
  fullName: 'Blake',
  /** 首页首屏的一句话定位 */
  tagline: '工程师 · 正在把做过的事和想过的事写下来',
  /** 首屏正文，可留空 */
  intro: '这里记录我的工作项目经历、学习过程和一些零散感悟。内容会持续补充。',
  /** 状态卡里的「现在在做什么」，留空则隐藏该行 */
  now: '',
  email: '',
  location: '',
  url: 'https://blake.example.com',
  /** 外链，留空数组则不渲染 */
  socials: [
    // { label: 'GitHub', href: 'https://github.com/...' },
    // { label: 'X', href: 'https://x.com/...' },
  ] as { label: string; href: string }[],
  /** 简历 PDF 路径（放 public/ 下），留空则不显示 */
  resume: '',
  /** 源码仓库地址（用于页脚「本站源码」） */
  repo: '',
  lang: 'zh-CN',
  locale: 'zh_CN',
};

export const nav = [
  { label: '首页', href: '/' },
  { label: '项目', href: '/projects' },
  { label: '文章', href: '/writing' },
  { label: '笔记', href: '/notes' },
  { label: '关于', href: '/about' },
];

/** 后台是否启用：设置 ADMIN_PASSWORD 后生效（且需 Node 运行时） */
export const ADMIN_COOKIE = 'blake_admin';

export const contentDirs = {
  posts: 'content/posts',
  projects: 'content/projects',
  notes: 'content/notes',
} as const;
