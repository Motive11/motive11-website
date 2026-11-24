// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://motive11.com",
  // Astro 7 defaults to 'jsx', which drops the space between adjacent inline elements.
  compressHTML: true,
  fonts: [
    {
      provider: fontProviders.fontshare(),
      name: "Satoshi",
      cssVariable: "--font-satoshi",
      weights: [400, 500, 700],
      styles: ["normal"],
      fallbacks: ["sans-serif"],
    },
  ],
  image: {
    domains: ["cdn.markszymanski.co"],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap({
      // /book is a booking tool reached from links, not a page to rank; /me is Mark's own switch.
      filter: (page) => !page.includes("/book") && !page.endsWith("/me/") && !page.includes("/ai-onboarding-day"),
    }),
  ],
});
