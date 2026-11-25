// scripts/generate-sitemap.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { routes, SITE_URL, INDEXNOW_KEY } from "../src/routes";
import { buildIndexNowPayload } from "./submit-indexnow";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hostname = SITE_URL;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
    .filter(route => route.path !== '*')
    .map(
        (route) => `  <url>
    <loc>${hostname}${route.path === "/" ? "/" : route.path}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route.path === "/" ? "1.0" : "0.7"}</priority>
  </url>`,
    )
    .join("\n")}
</urlset>`;

const indexNowPayload = buildIndexNowPayload();

const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
    fs.writeFileSync(path.join(distPath, "sitemap.xml"), sitemap);
    console.log("✅ サイトマップ生成完了");

    fs.writeFileSync(
        path.join(distPath, "indexnow.json"),
        JSON.stringify(indexNowPayload, null, 2),
    );
    console.log("✅ IndexNow ペイロード生成完了 (dist/indexnow.json)");

    fs.writeFileSync(
        path.join(distPath, `${INDEXNOW_KEY}.txt`),
        INDEXNOW_KEY,
    );
    console.log(`✅ IndexNow 認証キーファイル生成完了 (dist/${INDEXNOW_KEY}.txt)`);
}
