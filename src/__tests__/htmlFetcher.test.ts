import { describe, it, expect, vi, afterEach } from "vitest";
import {
    normalizeFetchUrl,
    isSameOriginUrl,
    isValidHtmlContent,
    buildMicrolinkUrl,
    extractJsonLdFromMicrolink,
    fetchPageSource,
} from "../utils/htmlFetcher";

describe("htmlFetcher Utilities (src/utils/htmlFetcher.ts)", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe("normalizeFetchUrl", () => {
        it("スキームが省略されている場合は https:// を付与すること", () => {
            expect(normalizeFetchUrl("example.com")).toBe("https://example.com");
            expect(normalizeFetchUrl("  example.com/path  ")).toBe("https://example.com/path");
            expect(normalizeFetchUrl("http://example.com")).toBe("http://example.com");
            expect(normalizeFetchUrl("https://example.com")).toBe("https://example.com");
            expect(normalizeFetchUrl("   ")).toBe("");
        });
    });

    describe("isSameOriginUrl", () => {
        it("現在の window.location.origin と一致するか正しく判定すること", () => {
            const origin = window.location.origin;
            expect(isSameOriginUrl(`${origin}/seo-checker`)).toBe(true);
            expect(isSameOriginUrl("https://other-domain.example/")).toBe(false);
            expect(isSameOriginUrl("not-a-valid-url")).toBe(false);
        });
    });

    describe("isValidHtmlContent", () => {
        it("有効なHTMLコンテンツのみ true を返すこと", () => {
            expect(isValidHtmlContent("<!doctype html><html><head></head></html>")).toBe(true);
            expect(isValidHtmlContent("<title>Sample</title>")).toBe(true);
            expect(isValidHtmlContent('<script type="application/ld+json">{}</script>')).toBe(true);
            expect(isValidHtmlContent('{"error": "rate limit"}')).toBe(false);
            expect(isValidHtmlContent("")).toBe(false);
        });
    });

    describe("buildMicrolinkUrl", () => {
        it("prerender=false と JSON-LD/SEOカスタムセレクタが付与されたURLを生成すること", () => {
            const url = buildMicrolinkUrl("https://example.com/blog");
            expect(url).toContain("https://api.microlink.io/?url=");
            expect(url).toContain("prerender=false");
            expect(url).toContain("data.jsonld.selectorAll=");
            expect(url).toContain("data.canonical.selector=");
            expect(url).toContain("data.robots.selector=");
            expect(url).toContain("data.h1.selectorAll=h1");
        });
    });

    describe("extractJsonLdFromMicrolink", () => {
        it("文字列やオブジェクトの配列から JSON-LD 文字列リストを抽出すること", () => {
            const payload = {
                data: {
                    jsonld: [
                        '{"@type":"WebSite","name":"A"}',
                        { "@type": "Organization", name: "B" },
                        "   ",
                    ],
                },
            };
            const list = extractJsonLdFromMicrolink(payload);
            expect(list.length).toBe(2);
            expect(list[0]).toBe('{"@type":"WebSite","name":"A"}');
            expect(JSON.parse(list[1]).name).toBe("B");
        });

        it("jsonld が存在しない場合は空配列を返すこと", () => {
            expect(extractJsonLdFromMicrolink({})).toEqual([]);
            expect(extractJsonLdFromMicrolink({ data: { title: "Only Title" } })).toEqual([]);
        });
    });

    describe("fetchPageSource", () => {
        it("同一オリジンURLの場合は直接 fetch して kind: html (direct) を返すこと", async () => {
            const targetUrl = `${window.location.origin}/sample`;
            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                text: async () => "<!doctype html><html><title>Local</title></html>",
            } as any);

            const res = await fetchPageSource(targetUrl);
            expect(res.kind).toBe("html");
            expect(res.source).toBe("direct");
            if (res.kind === "html") {
                expect(res.html).toContain("<title>Local</title>");
            }
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        it("クロスオリジンで Microlink が成功した場合に kind: microlink を返すこと", async () => {
            globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.startsWith("https://api.microlink.io/")) {
                    return {
                        ok: true,
                        json: async () => ({
                            data: {
                                title: "Fast Page",
                                jsonld: ['{"@type":"Article","headline":"H"}'],
                            },
                        }),
                    };
                }
                return { ok: false, status: 500 };
            });

            const res = await fetchPageSource("https://example.com/article");
            expect(res.kind).toBe("microlink");
            expect(res.source).toBe("microlink");
        });

        it("Microlink が失敗しても AllOrigins /raw が成功すれば kind: html (cors-proxy) を返すこと", async () => {
            globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.startsWith("https://api.allorigins.win/raw")) {
                    return {
                        ok: true,
                        text: async () => "<html><head><title>Proxy HTML</title></head></html>",
                    };
                }
                return { ok: false, status: 429 };
            });

            const res = await fetchPageSource("https://example.com/proxy");
            expect(res.kind).toBe("html");
            expect(res.source).toBe("cors-proxy");
            if (res.kind === "html") {
                expect(res.html).toContain("Proxy HTML");
            }
        });

        it("並列レースが全滅しても AllOrigins /get フォールバックが成功すれば html を返すこと", async () => {
            globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.startsWith("https://api.allorigins.win/get")) {
                    return {
                        ok: true,
                        json: async () => ({
                            contents: "<html><head><title>Get Fallback</title></head></html>",
                        }),
                    };
                }
                throw new Error("Network failure");
            });

            const res = await fetchPageSource("https://example.com/fallback");
            expect(res.kind).toBe("html");
            if (res.kind === "html") {
                expect(res.html).toContain("Get Fallback");
            }
        });

        it("すべての経路が失敗した場合にエラーをスローすること", async () => {
            globalThis.fetch = vi.fn().mockRejectedValue(new Error("All failed"));
            await expect(fetchPageSource("https://example.com/fail")).rejects.toThrow(
                "ページの取得に失敗しました",
            );
        });
    });
});
