import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Case studies are Motive11's own write-ups for operators. markszymanski.co keeps a separate,
// longer success story for builders about the same work; the two are written independently on
// purpose, so editing one never changes the other. Quotes come from the testimonials API by id.
const caseStudies = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/case-studies" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      client: z.object({
        name: z.string(),
        industry: z.string(),
        location: z.string(),
        website: z.string().url().optional(),
      }),
      year: z.string(),
      work: z.string(),
      metric: z.object({ value: z.string(), label: z.string() }).optional(),
      cover: image(),
      coverAlt: z.string(),
      coverBg: z.enum(["orange", "charcoal", "clay", "sand"]),
      coverStyle: z.enum(["screenshot", "art"]).default("screenshot"),
      logo: z.string().optional(),
      logoDark: z.string().optional(),
      services: z.array(z.string()),
      testimonialIds: z.array(z.string()).default([]),
      order: z.number(),
      // Hidden ones build no page and show nowhere (Mark, November 23, 2026: the website-only stories come off
      // the site while it sells the Build). public/_redirects sends their old addresses to /case-studies.
      hidden: z.boolean().default(false),
    }),
});

export const collections = { "case-studies": caseStudies };
