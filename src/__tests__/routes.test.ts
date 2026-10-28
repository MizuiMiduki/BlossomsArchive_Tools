import { describe, it, expect } from "vitest";
import { routes, getPageMetadata, SITE_TITLE, SITE_URL } from "../routes";

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
    });

    it("未定義ルート（404等）のメタデータがデフォルトにフォールバックすること", () => {
        const meta = getPageMetadata("/unknown-path");
        expect(meta.title).toBe(SITE_TITLE);
        expect(meta.description).toContain("BlossomsArchive Tools");
        expect(meta.url).toBe(`${SITE_URL}/unknown-path`);
    });
});
