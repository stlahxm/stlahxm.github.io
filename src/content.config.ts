import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.enum(["경력", "프로젝트", "오픈소스", "활동"]),
    tags: z.array(z.string()),
    metric: z.string().optional(),
    badge: z.string(),
    cover: z.string().optional(),
    coverFit: z.enum(["photo", "logo"]).optional(),
  }),
});

export const collections = { posts };
