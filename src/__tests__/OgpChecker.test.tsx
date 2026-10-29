import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OgpChecker, {
    parseOgpFromHtml,
    parseOgpFromMicrolink,
    buildDiagnostics,
    normalizeInputUrl,
    resolveUrl,
} from "../pages/OgpChecker";

describe("OgpChecker helper functions", () => {
    it("normalizeInputUrl がスキームなしURLに https:// を補完すること", () => {
        expect(normalizeInputUrl("example.com")).toBe("https://example.com");
        expect(normalizeInputUrl("http://example.com")).toBe("http://example.com");
        expect(normalizeInputUrl("https://example.com/page")).toBe(
            "https://example.com/page",
        );
        expect(normalizeInputUrl("   ")).toBe("");
    });

    it("resolveUrl が相対パスをベースURLから絶対URLに変換すること", () => {
        expect(resolveUrl("/images/ogp.png", "https://example.com/posts/1")).toBe(
            "https://example.com/images/ogp.png",
        );
        expect(
            resolveUrl("https://cdn.example.com/ogp.png", "https://example.com"),
        ).toBe("https://cdn.example.com/ogp.png");
    });

    it("parseOgpFromHtml がOGP・Twitterカード・基本メタタグを正しく抽出すること", () => {
        const html = `
            <!doctype html>
            <html>
            <head>
                <title>テストページ</title>
                <meta name="description" content="通常の説明文" />
                <link rel="canonical" href="https://example.com/test" />
                <meta property="og:title" content="OGPタイトル" />
                <meta property="og:description" content="OGP説明文" />
                <meta property="og:image" content="/assets/og.png" />
                <meta property="og:url" content="https://example.com/test" />
                <meta property="og:type" content="article" />
                <meta property="og:site_name" content="Example Site" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Twitterタイトル" />
            </head>
            <body></body>
            </html>
        `;

        const parsed = parseOgpFromHtml(html, "https://example.com/test");
        expect(parsed.pageTitle).toBe("テストページ");
        expect(parsed.metaDescription).toBe("通常の説明文");
        expect(parsed.canonicalUrl).toBe("https://example.com/test");
        expect(parsed.ogTitle).toBe("OGPタイトル");
        expect(parsed.ogDescription).toBe("OGP説明文");
        expect(parsed.ogImage).toBe("https://example.com/assets/og.png");
        expect(parsed.ogUrl).toBe("https://example.com/test");
        expect(parsed.ogType).toBe("article");
        expect(parsed.ogSiteName).toBe("Example Site");
        expect(parsed.twitterCard).toBe("summary_large_image");
        expect(parsed.twitterTitle).toBe("Twitterタイトル");

        const diag = buildDiagnostics(parsed);
        expect(diag.every((d) => d.status === "ok")).toBe(true);
    });

    it("parseOgpFromMicrolink がMicrolink APIのJSONレスポンスからOgpDataを構築できること", () => {
        const payload = {
            status: "success",
            data: {
                title: "Microlink Title",
                description: "Microlink Description",
                image: { url: "https://example.com/microlink.png" },
                url: "https://example.com/article",
                publisher: "Microlink Publisher",
                lang: "ja",
            },
        };
        const parsed = parseOgpFromMicrolink(
            payload,
            "https://example.com/article",
        );
        expect(parsed).not.toBeNull();
        expect(parsed?.ogTitle).toBe("Microlink Title");
        expect(parsed?.ogDescription).toBe("Microlink Description");
        expect(parsed?.ogImage).toBe("https://example.com/microlink.png");
        expect(parsed?.ogSiteName).toBe("Microlink Publisher");
    });
});

describe("OgpChecker Component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態でタイトル、URL入力フォーム、モード切替ボタンが表示されること", () => {
        render(() => <OgpChecker />);
        expect(
            screen.getByText("OGP確認・SNSシェアプレビューツール"),
        ).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("https://tools.blossomsarchive.com"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "OGPを取得・解析" }),
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: /URLから取得/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /HTML直接入力/ }),
        ).toBeInTheDocument();
    });

    it("「サンプルで試す」をクリックするとサンプルOGPのプレビューと診断結果が表示されること", async () => {
        render(() => <OgpChecker />);
        const sampleBtn = screen.getByRole("button", { name: "サンプルで試す" });
        fireEvent.click(sampleBtn);

        expect(
            await screen.findByText("SNSシェア表示プレビュー"),
        ).toBeInTheDocument();
        expect(screen.getByText("OGP設定診断チェック")).toBeInTheDocument();
        expect(
            screen.getAllByText(
                "OGP確認・SNSシェアプレビューツール | BlossomsArchive Tools",
            ).length,
        ).toBeGreaterThan(0);
    });

    it("HTML直接入力モードでHTMLを貼り付けて解析できること", async () => {
        render(() => <OgpChecker />);

        fireEvent.click(screen.getByRole("button", { name: /HTML直接入力/ }));

        const textarea = screen.getByLabelText("解析するHTMLソースコード");
        fireEvent.input(textarea, {
            target: {
                value: `<head>
                    <title>カスタムHTMLタイトル</title>
                    <meta property="og:title" content="直接入力OGPタイトル" />
                    <meta property="og:description" content="直接入力したOGP説明文です。" />
                    <meta property="og:image" content="https://example.com/custom.png" />
                    <meta name="twitter:card" content="summary" />
                </head>`,
            },
        });

        const analyzeBtn = screen.getByRole("button", {
            name: "HTMLを解析する",
        });
        expect(analyzeBtn).not.toBeDisabled();
        fireEvent.click(analyzeBtn);

        expect(
            await screen.findAllByText("直接入力OGPタイトル"),
        ).not.toHaveLength(0);
        expect(
            screen.getAllByText("直接入力したOGP説明文です。"),
        ).not.toHaveLength(0);
    });

    it("URL入力モードでURLからHTMLを取得してOGPが表示されること", async () => {
        const mockHtml = `<!doctype html>
        <html>
        <head>
            <meta property="og:title" content="Fetched Site Title" />
            <meta property="og:description" content="Fetched Site Description" />
            <meta property="og:image" content="https://example.com/fetched.jpg" />
            <meta property="og:url" content="https://example.com" />
            <meta property="og:type" content="website" />
            <meta name="twitter:card" content="summary_large_image" />
        </head>
        <body></body>
        </html>`;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => mockHtml,
        } as any);

        render(() => <OgpChecker />);

        const input = screen.getByLabelText("確認するページのURL");
        fireEvent.input(input, { target: { value: "https://example.com" } });

        const submitBtn = screen.getByRole("button", {
            name: "OGPを取得・解析",
        });
        expect(submitBtn).not.toBeDisabled();
        fireEvent.click(submitBtn);

        expect(
            await screen.findAllByText("Fetched Site Title"),
        ).not.toHaveLength(0);
        expect(
            screen.getAllByText("Fetched Site Description"),
        ).not.toHaveLength(0);

        const copyAllBtn = screen.getByRole("button", {
            name: "すべての情報をコピー",
        });
        fireEvent.click(copyAllBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it("直接fetchがCORSエラーの場合でもフォールバック経由でOGPを取得できること", async () => {
        const microlinkPayload = {
            status: "success",
            data: {
                title: "Fallback OGP Title",
                description: "Fallback OGP Description",
                image: { url: "https://example.org/fallback.png" },
                url: "https://example.org/post",
                publisher: "Example Org",
                lang: "ja",
            },
        };

        globalThis.fetch = vi.fn().mockImplementation(async (input: unknown) => {
            try {
                const targetUrl = new URL(String(input), "http://localhost");
                if (targetUrl.hostname === "api.microlink.io") {
                    return {
                        ok: true,
                        json: async () => microlinkPayload,
                    };
                }
            } catch {
                // ignore
            }
            throw new Error("CORS blocked");
        });

        render(() => <OgpChecker />);

        const input = screen.getByLabelText("確認するページのURL");
        fireEvent.input(input, { target: { value: "https://example.org/post" } });

        fireEvent.click(
            screen.getByRole("button", { name: "OGPを取得・解析" }),
        );

        expect(
            await screen.findAllByText("Fallback OGP Title"),
        ).not.toHaveLength(0);
        expect(
            screen.getAllByText("https://example.org/fallback.png"),
        ).not.toHaveLength(0);
    });

    it("URL取得がすべて失敗した場合にエラーメッセージが表示されること", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

        render(() => <OgpChecker />);

        const input = screen.getByLabelText("確認するページのURL");
        fireEvent.input(input, { target: { value: "https://example.com" } });

        fireEvent.click(
            screen.getByRole("button", { name: "OGPを取得・解析" }),
        );

        expect(
            await screen.findByText(/ページの取得に失敗しました/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "HTML直接入力へ切替" }),
        ).toBeInTheDocument();
    });
});
