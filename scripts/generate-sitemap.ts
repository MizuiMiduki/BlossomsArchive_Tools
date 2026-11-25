// scripts/generate-sitemap.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { routes, SITE_URL, INDEXNOW_KEY } from "../src/routes";
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    getPathWithLocale,
    getHreflangLinks,
} from "../src/i18n/index";
import { buildIndexNowPayload } from "./submit-indexnow";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hostname = SITE_URL;
const validRoutes = routes.filter((route) => route.path !== "*");

const urlEntries: string[] = [];

for (const route of validRoutes) {
    const isHome = route.path === "/";
    const hreflangLinks = getHreflangLinks(route.path, hostname);
    const xhtmlLinks = hreflangLinks
        .map(
            (link) =>
                `    <xhtml:link rel="alternate" hreflang="${link.lang}" href="${link.href}" />`,
        )
        .join("\n");

    for (const locale of ALL_LOCALES) {
        const localizedPath = getPathWithLocale(route.path, locale);
        const loc = `${hostname}${localizedPath === "/" ? "/" : localizedPath}`;
        const priority = isHome
            ? locale === DEFAULT_LOCALE
                ? "1.0"
                : "0.9"
            : "0.7";

        urlEntries.push(`  <url>
    <loc>${loc}</loc>
${xhtmlLinks}
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`);
    }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join("\n")}
</urlset>`;

const indexNowPayload = buildIndexNowPayload({ includeLocales: true });

const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
    fs.writeFileSync(path.join(distPath, "sitemap.xml"), sitemap);
    console.log(`✅ サイトマップ生成完了 (${urlEntries.length} URLs across 6 languages)`);

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
