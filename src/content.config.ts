import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** 홈 카드용 짧은 한 줄 부제 — 없으면 description으로 대체 */
    blurb: z.string().optional(),
    pubDate: z.coerce.date(),
    category: z.enum(["경력", "프로젝트", "오픈소스", "활동"]),
    tags: z.array(z.string()),
    metric: z.string().optional(),
    stats: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    badge: z.string(),
    cover: z.string().optional(),
    coverFit: z.enum(["photo", "logo"]).optional(),
  }),
});

export const collections = { posts };
