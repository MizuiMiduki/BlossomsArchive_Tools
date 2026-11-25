import { describe, it, expect, vi, afterEach } from "vitest";
import {
    parseSitemapXml,
    extractSitemapsFromRobotsTxt,
    buildSiteTree,
    buildLocaleCoverageMatrix,
    analyzeSitemapEntries,
    buildSitemapTsv,
    detectEntryLocale,
    isSafeHttpUrl,
    normalizeLocaleCode,
    fetchAndResolveSitemap,
    SITEMAP_SAMPLES,
} from "../utils/sitemap";

describe("Sitemap Utilities (src/utils/sitemap.ts)", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe("isSafeHttpUrl / normalizeLocaleCode", () => {
        it("http/https のみ許可し危険なスキームを拒否すること", () => {
            expect(isSafeHttpUrl("https://example.com/sitemap.xml")).toBe(true);
            expect(isSafeHttpUrl("http://example.com/page")).toBe(true);
            expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
            expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
            expect(isSafeHttpUrl("")).toBe(false);
        });

        it("ロケールコードを正規化できること", () => {
            expect(normalizeLocaleCode("ja_jp")).toBe("ja-JP");
            expect(normalizeLocaleCode("zh-hans")).toBe("zh-Hans");
            expect(normalizeLocaleCode("EN")).toBe("en");
            expect(normalizeLocaleCode("X-Default")).toBe("x-default");
        });
    });

    describe("detectEntryLocale", () => {
        it("hreflang・パス先頭・クエリ・サブドメインから言語を推定できること", () => {
            expect(
                detectEntryLocale("https://example.com/about", [
                    { hreflang: "ja", href: "https://example.com/about" },
                ]),
            ).toBe("ja");
            expect(detectEntryLocale("https://example.com/en-us/docs", [])).toBe("en-US");
            expect(detectEntryLocale("https://example.com/page?lang=fr", [])).toBe("fr");
            expect(detectEntryLocale("https://de.example.com/products", [])).toBe("de");
            expect(detectEntryLocale("https://example.com/blog/post-1", [])).toBe("default");
        });
    });

    describe("parseSitemapXml", () => {
        it("多言語サンプル(hreflang + image)を正確に解析できること", () => {
            const parsed = parseSitemapXml(SITEMAP_SAMPLES.multilingual.xml);
            expect(parsed.kind).toBe("urlset");
            expect(parsed.urls.length).toBe(8);
            const jaHome = parsed.urls.find((u) => u.loc === "https://example.com/ja/");
            expect(jaHome).toBeDefined();
            expect(jaHome?.detectedLocale).toBe("ja");
            expect(jaHome?.alternates.length).toBe(4);
            expect(jaHome?.imageCount).toBe(1);
        });

        it("sitemapindex から子サイトマップ一覧を抽出できること", () => {
            const parsed = parseSitemapXml(SITEMAP_SAMPLES.index.xml);
            expect(parsed.kind).toBe("sitemapindex");
            expect(parsed.childSitemaps.length).toBe(3);
            expect(parsed.childSitemaps[0].loc).toBe("https://example.com/sitemap-ja.xml");
        });

        it("プレーンテキスト形式（1行1URL）および危険URL除外に対応すること", () => {
            const text = [
                "# comment",
                "https://example.com/ja/page1",
                "javascript:alert(1)",
                "https://example.com/en/page1",
            ].join("\n");
            const parsed = parseSitemapXml(text);
            expect(parsed.kind).toBe("text");
            expect(parsed.urls.length).toBe(2);
            expect(parsed.urls.map((u) => u.detectedLocale)).toEqual(["ja", "en"]);
        });

        it("未エスケープの & を含むXMLを自動補正して解析できること", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/search?a=1&b=2</loc></url>
</urlset>`;
            const parsed = parseSitemapXml(xml);
            expect(parsed.kind).toBe("urlset");
            expect(parsed.urls.length).toBe(1);
            expect(parsed.urls[0].loc).toBe("https://example.com/search?a=1&b=2");
            expect(parsed.errors.length).toBeGreaterThan(0);
        });

        it("RSS フィード形式のフォールバック解析に対応すること", () => {
            const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item><link>https://example.com/news/1</link><pubDate>2026-11-20</pubDate></item>
</channel></rss>`;
            const parsed = parseSitemapXml(rss);
            expect(parsed.kind).toBe("feed");
            expect(parsed.urls.length).toBe(1);
            expect(parsed.urls[0].loc).toBe("https://example.com/news/1");
        });
    });

    describe("extractSitemapsFromRobotsTxt", () => {
        it("複数の Sitemap: 行を重複排除して抽出できること", () => {
            const robots = `
User-agent: *
Disallow: /admin
Sitemap: https://example.com/sitemap.xml
sitemap: https://example.com/sitemap-en.xml
Sitemap: https://example.com/sitemap.xml
Sitemap: javascript:alert(1)
`;
            expect(extractSitemapsFromRobotsTxt(robots)).toEqual([
                "https://example.com/sitemap.xml",
                "https://example.com/sitemap-en.xml",
            ]);
        });
    });

    describe("buildSiteTree / buildLocaleCoverageMatrix / analyzeSitemapEntries / buildSitemapTsv", () => {
        it("ツリー構造・多言語マトリクス・統計・TSVが正しく生成されること", () => {
            const parsed = parseSitemapXml(SITEMAP_SAMPLES.multilingual.xml);
            const roots = buildSiteTree(parsed.urls);
            expect(roots.length).toBe(1);
            expect(roots[0].segment).toBe("example.com");
            expect(roots[0].totalUrls).toBe(8);

            const matrix = buildLocaleCoverageMatrix(parsed.urls);
            expect(matrix.locales).toContain("ja");
            expect(matrix.locales).toContain("en");
            expect(matrix.locales).toContain("zh-Hans");
            expect(matrix.locales).toContain("x-default");
            const lensRow = matrix.rows.find((r) => r.displayPath === "/products/camera-lens");
            expect(lensRow?.urlsByLocale["ja"]).toBe("https://example.com/ja/products/camera-lens");
            expect(lensRow?.urlsByLocale["en"]).toBe("https://example.com/en/products/camera-lens");

            const summary = analyzeSitemapEntries(parsed.urls);
            expect(summary.totalUrls).toBe(8);
            expect(summary.locales.length).toBe(3);
            expect(summary.imageTotal).toBe(3);

            const tsv = buildSitemapTsv(parsed.urls);
            expect(tsv).toContain("URL\t言語\t階層\t最終更新日");
            expect(tsv).toContain("https://example.com/ja/\tja");
        });
    });

    describe("fetchAndResolveSitemap", () => {
        it("トップURLから robots.txt 経由で sitemapindex を検出し子サイトマップを再帰展開できること", async () => {
            const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-ja.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-en.xml</loc></sitemap>
</sitemapindex>`;
            const jaXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/ja/guide</loc><lastmod>2026-11-20</lastmod></url>
</urlset>`;
            const enXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/en/guide</loc><lastmod>2026-11-20</lastmod></url>
</urlset>`;

            globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url === "https://example.com/robots.txt") {
                    return {
                        ok: true,
                        text: async () => "User-agent: *\nSitemap: https://example.com/sitemap_index.xml\n",
                    };
                }
                if (url === "https://example.com/sitemap_index.xml") {
                    return { ok: true, text: async () => indexXml };
                }
                if (url === "https://example.com/sitemap-ja.xml") {
                    return { ok: true, text: async () => jaXml };
                }
                if (url === "https://example.com/sitemap-en.xml") {
                    return { ok: true, text: async () => enXml };
                }
                return { ok: false, status: 404 };
            });

            const res = await fetchAndResolveSitemap("https://example.com");
            expect(res.discoveredVia).toBe("robots.txt");
            expect(res.childSitemaps.length).toBe(2);
            expect(res.urls.length).toBe(2);
            expect(res.urls.map((u) => u.detectedLocale)).toEqual(["ja", "en"]);
        });
    });
});
