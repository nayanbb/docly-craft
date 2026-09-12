import { tools } from "@/lib/tools";

const BASE_URL = "https://docly-tools.vercel.app";

export function createSitemap() {
  const staticPages = [
    "/",
    "/pdf-tools",
    "/image-tools",
    "/ai-tools",
    "/pricing",
    "/about",
    "/contact",
  ];

  const toolPages = tools
    .filter((tool) => tool.status === "available")
    .map((tool) => tool.route);

  const urls = [...staticPages, ...toolPages];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${BASE_URL}${url}</loc>
  </url>`,
  )
  .join("\n")}
</urlset>`;
}
