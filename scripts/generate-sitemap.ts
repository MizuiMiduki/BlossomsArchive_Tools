// scripts/generate-sitemap.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// TypeScriptなら .js 拡張子なしでimportできるにゃ！
import { routes } from "../src/routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hostname = "https://tools.blossomsarchive.com";

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
    .filter(route => route.path !== '*')
    .map(
        (route) => `  <url>
    <loc>${hostname}${route.path}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route.path === "/" ? "1.0" : "0.7"}</priority>
  </url>`,
    )
    .join("\n")}
</urlset>`;

const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
    fs.writeFileSync(path.join(distPath, "sitemap.xml"), sitemap);
    console.log("✅ サイトマップ生成完了");
}
