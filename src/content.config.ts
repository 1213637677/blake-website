import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const base = {
  title: z.string(),
  summary: z.string().default(''),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  pinned: z.boolean().default(false),
  cover: z.string().optional(),
};

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/posts' }),
  schema: z.object({
    ...base,
    kind: z.enum(['essay', 'learning', 'retro']).default('essay'),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/projects' }),
  schema: z.object({
    ...base,
    kind: z.enum(['work', 'personal']).default('personal'),
    stack: z.array(z.string()).default([]),
    period: z.string().default(''),
    links: z
      .array(z.object({ label: z.string(), href: z.string(), kind: z.enum(['demo', 'source', 'post']).default('source') }))
      .default([]),
    featured: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/notes' }),
  schema: z.object({
    ...base,
    link: z.string().optional(),
  }),
});

export const collections = { posts, projects, notes };
