import { describe, it, expect } from "vitest";
import {
    routes,
    getPageMetadata,
    getPageJsonLd,
    SITE_TITLE,
    SITE_URL,
    PUBLISHER_NAME,
} from "../routes";

describe("routes", () => {
    it("ルート配列が正しく定義されていること", () => {
        expect(Array.isArray(routes)).toBe(true);
        expect(routes.length).toBeGreaterThan(10);

        // 各ルートが必須プロパティを持つこと
        routes.forEach((route) => {
            expect(route.path).toBeDefined();
            expect(route.title).toBeDefined();
            expect(route.description).toBeDefined();
        });
    });

    it("ホーム (/) のメタデータが正しく取得できること", () => {
        const meta = getPageMetadata("/");
        expect(meta.title).toBe(SITE_TITLE);
        expect(meta.url).toBe(`${SITE_URL}/`);
    });

    it("各ツールページのメタデータにサイトタイトルが付与されること", () => {
        const meta = getPageMetadata("/calculator");
        expect(meta.title).toBe(`電卓ツール | ${SITE_TITLE}`);
        expect(meta.url).toBe(`${SITE_URL}/calculator`);

        const ogpMeta = getPageMetadata("/ogp-checker");
        expect(ogpMeta.title).toBe(`OGP確認 | ${SITE_TITLE}`);
        expect(ogpMeta.url).toBe(`${SITE_URL}/ogp-checker`);

        const seoMeta = getPageMetadata("/seo-checker");
        expect(seoMeta.title).toBe(`メタタグ(SEO)確認 | ${SITE_TITLE}`);
        expect(seoMeta.url).toBe(`${SITE_URL}/seo-checker`);
    });

    it("未定義ルート（404等）のメタデータがデフォルトにフォールバックすること", () => {
        const meta = getPageMetadata("/unknown-path");
        expect(meta.title).toBe(SITE_TITLE);
        expect(meta.description).toContain("BlossomsArchive Tools");
        expect(meta.url).toBe(`${SITE_URL}/unknown-path`);
    });

    describe("getPageJsonLd", () => {
        it("トップページ (/) 用のJSON-LDにWebSite、Organization、WebPageが含まれること", () => {
            const schema = getPageJsonLd("/");
            expect(schema["@context"]).toBe("https://schema.org");
            expect(Array.isArray(schema["@graph"])).toBe(true);

            const org = schema["@graph"].find((item) => item["@type"] === "Organization");
            expect(org).toBeDefined();
            expect(org.name).toBe(PUBLISHER_NAME);

            const website = schema["@graph"].find((item) => item["@type"] === "WebSite");
            expect(website).toBeDefined();
            expect(website.name).toBe(SITE_TITLE);
            expect(website.url).toBe(`${SITE_URL}/`);

            const webpage = schema["@graph"].find((item) => item["@type"] === "WebPage");
            expect(webpage).toBeDefined();
            expect(webpage.name).toBe(SITE_TITLE);
            expect(webpage.url).toBe(`${SITE_URL}/`);
        });

        it("ツールページ用のJSON-LDにWebApplication、WebPage、BreadcrumbListが含まれること", () => {
            const schema = getPageJsonLd("/seo-checker");
            expect(schema["@context"]).toBe("https://schema.org");

            const webpage = schema["@graph"].find((item) => item["@type"] === "WebPage");
            expect(webpage).toBeDefined();
            expect(webpage.name).toContain("メタタグ(SEO)確認");
            expect(webpage.url).toBe(`${SITE_URL}/seo-checker`);

            const webapp = schema["@graph"].find(
                (item) => item["@type"] === "WebApplication",
            );
            expect(webapp).toBeDefined();
            expect(webapp.name).toContain("メタタグ(SEO)確認");
            expect(webapp.url).toBe(`${SITE_URL}/seo-checker`);
            expect(webapp.offers.price).toBe("0");

            const breadcrumb = schema["@graph"].find(
                (item) => item["@type"] === "BreadcrumbList",
            );
            expect(breadcrumb).toBeDefined();
            expect(breadcrumb.itemListElement.length).toBe(2);
            expect(breadcrumb.itemListElement[0].name).toBe("ホーム");
            expect(breadcrumb.itemListElement[1].name).toBe("メタタグ(SEO)確認");
        });

        it("静的ページ (/privacy) 用のJSON-LDにWebPageとBreadcrumbListが含まれること", () => {
            const schema = getPageJsonLd("/privacy");
            const webpage = schema["@graph"].find(
                (item) => item["@type"] === "WebPage",
            );
            expect(webpage).toBeDefined();
            expect(webpage.name).toContain("プライバシーポリシー");

            const breadcrumb = schema["@graph"].find(
                (item) => item["@type"] === "BreadcrumbList",
            );
            expect(breadcrumb).toBeDefined();
            expect(breadcrumb.itemListElement[1].name).toBe("プライバシーポリシー");
        });
    });
});
