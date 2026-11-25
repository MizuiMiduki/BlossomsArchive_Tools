import fs from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { routes, SITE_URL, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "../routes";
import { buildIndexNowPayload, submitToIndexNow } from "../../scripts/submit-indexnow";

const ROOT_DIR = path.resolve(__dirname, "../..");

describe("IndexNow Protocol Integration Tests", () => {
    it("INDEXNOW_KEY が 32 文字の英小文字・16進数文字列であり、KEY_LOCATION が正しいこと", () => {
        expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
        expect(INDEXNOW_KEY_LOCATION).toBe(`${SITE_URL}/${INDEXNOW_KEY}.txt`);
    });

    it("public ディレクトリにキー認証用テキストファイルが存在し、内容がキーと一致すること", () => {
        const keyFilePath = path.join(ROOT_DIR, "public", `${INDEXNOW_KEY}.txt`);
        expect(fs.existsSync(keyFilePath)).toBe(true);
        const content = fs.readFileSync(keyFilePath, "utf8").trim();
        expect(content).toBe(INDEXNOW_KEY);
    });

    it("buildIndexNowPayload がホスト・キー・キー設置場所・公開URLリストを正しく構築すること", () => {
        const payload = buildIndexNowPayload();
        expect(payload.host).toBe(new URL(SITE_URL).hostname);
        expect(payload.key).toBe(INDEXNOW_KEY);
        expect(payload.keyLocation).toBe(INDEXNOW_KEY_LOCATION);

        const expectedUrls = routes
            .filter((r) => r.path !== "*" && !r.hidden)
            .map((r) => `${SITE_URL}${r.path === "/" ? "/" : r.path}`);

        expect(payload.urlList).toEqual(expectedUrls);
        expect(payload.urlList.length).toBeGreaterThanOrEqual(25);
        expect(payload.urlList).toContain(`${SITE_URL}/`);
        expect(payload.urlList).toContain(`${SITE_URL}/calculator`);
        expect(payload.urlList).toContain(`${SITE_URL}/sitemap-visualizer`);
    });

    it("カスタムオプションや環境変数が指定された場合、それらを優先してペイロードを生成すること", () => {
        const customPayload = buildIndexNowPayload({
            host: "https://example.com",
            key: "abcdef1234567890abcdef1234567890",
            routesList: [
                { path: "/tool-a", title: "Tool A", description: "Desc A" },
                { path: "/tool-b", title: "Tool B", description: "Desc B", hidden: true },
            ],
        });

        expect(customPayload.host).toBe("example.com");
        expect(customPayload.key).toBe("abcdef1234567890abcdef1234567890");
        expect(customPayload.keyLocation).toBe("https://example.com/abcdef1234567890abcdef1234567890.txt");
        expect(customPayload.urlList).toEqual(["https://example.com/tool-a"]);
    });

    it("submitToIndexNow が HTTP 200 または 202 を成功として正しく処理すること", async () => {
        const payload = buildIndexNowPayload();

        // HTTP 200 Mock
        const mockFetch200 = vi.fn().mockResolvedValue({
            status: 200,
        } as unknown as Response);

        const result200 = await submitToIndexNow(payload, mockFetch200 as unknown as typeof fetch);
        expect(result200.status).toBe(200);
        expect(result200.message).toContain("Successfully submitted");
        expect(mockFetch200).toHaveBeenCalledWith(
            "https://api.indexnow.org/indexnow",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify(payload),
            }),
        );

        // HTTP 202 Mock
        const mockFetch202 = vi.fn().mockResolvedValue({
            status: 202,
        } as unknown as Response);

        const result202 = await submitToIndexNow(payload, mockFetch202 as unknown as typeof fetch);
        expect(result202.status).toBe(202);
        expect(result202.message).toContain("Successfully submitted");
    });

    it("submitToIndexNow がエラーレスポンス（HTTP 400/403/500）のときに例外を送出すること", async () => {
        const payload = buildIndexNowPayload();

        const mockFetch403 = vi.fn().mockResolvedValue({
            status: 403,
            text: vi.fn().mockResolvedValue("Forbidden - Key not valid"),
        } as unknown as Response);

        await expect(
            submitToIndexNow(payload, mockFetch403 as unknown as typeof fetch),
        ).rejects.toThrow("IndexNow submission failed: HTTP 403 - Forbidden - Key not valid");
    });
});
