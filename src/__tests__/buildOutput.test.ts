import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { routes, getPageMetadata, SITE_URL } from "../routes";

const ROOT_DIR = path.resolve(process.cwd());
const DIST_DIR = path.join(ROOT_DIR, "dist");

describe("Static Build Output & Sitemap Integrity Tests", () => {
    it("dist/ がビルド済みの場合、全19ルートの静的HTMLが重複タグ・残存マーカーなしで正しく生成されていること", () => {
        if (!fs.existsSync(DIST_DIR)) return;

        for (const route of routes) {
            const htmlPath =
                route.path === "/"
                    ? path.join(DIST_DIR, "index.html")
                    : path.join(DIST_DIR, route.path.slice(1), "index.html");

            expect(fs.existsSync(htmlPath)).toBe(true);
            const html = fs.readFileSync(htmlPath, "utf8");
            const meta = getPageMetadata(route.path);

            // マーカーが残存していないこと
            expect(html).not.toContain("BA_TOOLS_SEO_START");
            expect(html).not.toContain("BA_TOOLS_SEO_END");

            // title / description / canonical / JSON-LD が重複なくちょうど1つずつ存在すること
            const titleMatches = html.match(/<title>[\s\S]*?<\/title>/g) ?? [];
            expect(titleMatches.length).toBe(1);
            expect(titleMatches[0]).toContain(meta.title);

            const descMatches =
                html.match(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/g) ?? [];
            expect(descMatches.length).toBe(1);

            const canonicalMatches =
                html.match(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/g) ?? [];
            expect(canonicalMatches.length).toBe(1);
            expect(canonicalMatches[0]).toContain(meta.url);

            const jsonLdMatches =
                html.match(
                    /<script\s+type="application\/ld\+json"\s+id="ba-tools-global-jsonld">([\s\S]*?)<\/script>/g,
                ) ?? [];
            expect(jsonLdMatches.length).toBe(1);

            // JSON-LD が有効なJSONとしてパースできること
            const firstJsonLd = jsonLdMatches[0] ?? "";
            const openTagEnd = firstJsonLd.indexOf(">");
            const closeTagStart = firstJsonLd.lastIndexOf("</script>");
            const jsonContent = firstJsonLd.slice(
                openTagEnd + 1,
                closeTagStart,
            );
            const parsedJsonLd = JSON.parse(jsonContent);
            expect(parsedJsonLd["@context"]).toBe("https://schema.org");

            // AIディスカバリ・初期H1・modulepreloadが含まれること
            expect(html).toContain('rel="ard"');
            expect(html).toContain('rel="modulepreload"');
            expect(html).toContain('<h1 class="ba-sr-only">');

            // PageSpeed LCP最適化: 初期App Shellプレレンダリング（ヘッダー・タイトル・説明文）が含まれること
            expect(html).toContain('BlossomsArchive Tools');
            expect(html).toContain('<header');
            expect(html).toContain('<h2');

            // FCP/LCP高速化: modulepreload、JSON-LDおよびメインモジュールスクリプトが#root以降（body後方）に配置され初期ペイントをブロックしないこと
            const rootPos = html.indexOf('<div id="root">');
            const preloadPos = html.indexOf('rel="modulepreload"');
            const jsonLdPos = html.indexOf('id="ba-tools-global-jsonld"');
            const scriptPos = html.indexOf('<script type="module"');
            expect(rootPos).toBeGreaterThan(0);
            expect(preloadPos).toBeGreaterThan(rootPos);
            expect(jsonLdPos).toBeGreaterThan(rootPos);
            expect(scriptPos).toBeGreaterThan(preloadPos);

            // PageSpeed最適化: クリティカルCSSと完全非同期CSSローディング、同一オリジンアイコン、アイコン初期巨大化防止
            expect(html).toContain('id="ba-tools-critical-css"');
            expect(html).toContain('media="print" onload="this.media=\'all\'"');
            expect(html).toContain('icon-32.png');
            expect(html).toContain('icon-192.png');
            expect(html).toContain(".ba-icon-sm");
            expect(html).toContain(".ba-icon-md");
            expect(html).toContain(".ba-btn--square");
        }

        // CSS二重配信防止 & 超軽量予算: 外部CSSが 20KB 未満であること
        const assetsDir = path.join(DIST_DIR, "assets");
        if (fs.existsSync(assetsDir)) {
            const cssFile = fs
                .readdirSync(assetsDir)
                .find((f) => f.startsWith("index-") && f.endsWith(".css"));
            expect(cssFile).toBeDefined();
            if (cssFile) {
                const cssBytes = fs.statSync(path.join(assetsDir, cssFile)).size;
                expect(cssBytes).toBeLessThan(20 * 1024);
            }
        }
    });

    it("dist/sitemap.xml が生成されており全公開ルートのURLを含んでいること", () => {
        const sitemapPath = path.join(DIST_DIR, "sitemap.xml");
        if (!fs.existsSync(sitemapPath)) return;

        const xml = fs.readFileSync(sitemapPath, "utf8");
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain("<urlset");

        for (const route of routes) {
            const expectedUrl =
                route.path === "/" ? `${SITE_URL}/` : `${SITE_URL}${route.path}`;
            expect(xml).toContain(`<loc>${expectedUrl}</loc>`);
        }
    });
});
