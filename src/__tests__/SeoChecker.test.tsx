import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SeoChecker, {
    parseSeoFromHtml,
    parseSeoFromMicrolink,
    buildSeoDiagnostics,
    calculateSeoScore,
    normalizeInputUrl,
    resolveUrl,
} from "../pages/SeoChecker";

describe("SeoChecker helper functions", () => {
    it("normalizeInputUrl がスキームなしURLに https:// を補完すること", () => {
        expect(normalizeInputUrl("example.com")).toBe("https://example.com");
        expect(normalizeInputUrl("http://example.com")).toBe("http://example.com");
        expect(normalizeInputUrl("https://example.com/page")).toBe(
            "https://example.com/page",
        );
        expect(normalizeInputUrl("   ")).toBe("");
    });

    it("resolveUrl が相対パスを絶対URLに解決すること", () => {
        expect(resolveUrl("/favicon.ico", "https://example.com/blog/1")).toBe(
            "https://example.com/favicon.ico",
        );
        expect(
            resolveUrl("https://cdn.example.com/icon.png", "https://example.com"),
        ).toBe("https://cdn.example.com/icon.png");
    });

    it("parseSeoFromHtml がtitle, description, canonical, robots, h1, JSON-LD等を正しく抽出すること", () => {
        const html = `
            <!doctype html>
            <html lang="ja">
            <head>
                <meta charset="utf-8" />
                <title>テスト用タイトルです | 30文字前後の最適な長さ</title>
                <meta name="description" content="これはSEOテスト用のメタディスクリプションです。約80文字から120文字程度の適切な要約文を設定してテストを行います。" />
                <link rel="canonical" href="https://example.com/test" />
                <meta name="robots" content="index, follow" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="icon" href="/favicon.png" />
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Article",
                    "headline": "テスト記事"
                }
                </script>
            </head>
            <body>
                <h1>テストのメイン見出し</h1>
            </body>
            </html>
        `;

        const parsed = parseSeoFromHtml(html, "https://example.com/test");
        expect(parsed.pageTitle).toBe("テスト用タイトルです | 30文字前後の最適な長さ");
        expect(parsed.metaDescription).toContain("これはSEOテスト用");
        expect(parsed.canonicalUrl).toBe("https://example.com/test");
        expect(parsed.robots).toBe("index, follow");
        expect(parsed.viewport).toBe("width=device-width, initial-scale=1.0");
        expect(parsed.charset).toBe("utf-8");
        expect(parsed.h1List).toEqual(["テストのメイン見出し"]);
        expect(parsed.jsonLdList.length).toBe(1);
        expect(parsed.jsonLdList[0].isValid).toBe(true);
        expect(parsed.jsonLdList[0].type).toBe("Article");

        const diagnostics = buildSeoDiagnostics(parsed);
        expect(diagnostics.some((d) => d.key === "title" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "description" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "canonical" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "robots" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "viewport" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "charset" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "h1" && d.status === "ok")).toBe(true);
        expect(diagnostics.some((d) => d.key === "json-ld" && d.status === "ok")).toBe(true);

        const score = calculateSeoScore(diagnostics);
        expect(score.score).toBeGreaterThanOrEqual(80);
    });

    it("noindexが指定されている場合にエラー診断を出すこと", () => {
        const html = `
            <!doctype html>
            <html>
            <head>
                <title>Noindex ページ</title>
                <meta name="robots" content="noindex, nofollow" />
            </head>
            <body></body>
            </html>
        `;
        const parsed = parseSeoFromHtml(html);
        const diag = buildSeoDiagnostics(parsed);
        const robotsDiag = diag.find((d) => d.key === "robots");
        expect(robotsDiag?.status).toBe("error");
        expect(robotsDiag?.message).toContain("noindex");
    });

    it("無効なJSON-LD構文がある場合にエラーを検出すること", () => {
        const html = `
            <!doctype html>
            <html>
            <head>
                <title>構文エラーテスト</title>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Article",
                    invalid json syntax here...
                }
                </script>
            </head>
            <body></body>
            </html>
        `;
        const parsed = parseSeoFromHtml(html);
        expect(parsed.jsonLdList.length).toBe(1);
        expect(parsed.jsonLdList[0].isValid).toBe(false);

        const diag = buildSeoDiagnostics(parsed);
        const jsonDiag = diag.find((d) => d.key === "json-ld");
        expect(jsonDiag?.status).toBe("error");
    });

    it("parseSeoFromMicrolink がMicrolink APIレスポンスからSeoDataを生成できること", () => {
        const payload = {
            status: "success",
            data: {
                title: "Microlink SEO Title",
                description: "Microlink SEO Description for Google search snippet",
                url: "https://example.com/seo-article",
                logo: { url: "https://example.com/favicon.png" },
                author: "Tester",
            },
        };
        const parsed = parseSeoFromMicrolink(
            payload,
            "https://example.com/seo-article",
        );
        expect(parsed).not.toBeNull();
        expect(parsed?.pageTitle).toBe("Microlink SEO Title");
        expect(parsed?.metaDescription).toContain("Microlink SEO Description");
        expect(parsed?.canonicalUrl).toBe("https://example.com/seo-article");
        expect(parsed?.faviconUrl).toBe("https://example.com/favicon.png");
    });
});

describe("SeoChecker Component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態でタイトル、URL入力フォーム、モード切替ボタンが表示されること", () => {
        render(() => <SeoChecker />);
        expect(screen.getByText("メタタグ(SEO)確認ツール")).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("https://tools.blossomsarchive.com"),
        ).toBeInTheDocument();
        expect(screen.getByText("🌐 URLから取得")).toBeInTheDocument();
        expect(
            screen.getByText("📝 HTML直接入力 / ファイル読込"),
        ).toBeInTheDocument();
        expect(screen.getByText("サンプルで試す")).toBeInTheDocument();
    });

    it("「サンプルで試す」をクリックするとGoogle検索結果プレビューと診断結果が表示されること", async () => {
        render(() => <SeoChecker />);
        const sampleBtn = screen.getByText("サンプルで試す");
        fireEvent.click(sampleBtn);

        expect(
            await screen.findByText("Google検索結果プレビュー (SERP Preview)"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("SEO重要項目診断チェック"),
        ).toBeInTheDocument();
        expect(screen.getByText("SEO健全度スコア")).toBeInTheDocument();
    });

    it("HTML直接入力モードでHTMLを貼り付けて解析できること", async () => {
        render(() => <SeoChecker />);
        const htmlTab = screen.getByText("📝 HTML直接入力 / ファイル読込");
        fireEvent.click(htmlTab);

        const textarea = screen.getByLabelText("解析するHTMLソースコード");
        fireEvent.input(textarea, {
            target: {
                value: `
                    <!doctype html>
                    <html>
                    <head>
                        <title>直接入力テストタイトル</title>
                        <meta name="description" content="直接入力テストの説明文です。" />
                        <link rel="canonical" href="https://custom.example.com" />
                    </head>
                    <body><h1>見出し1</h1></body>
                    </html>
                `,
            },
        });

        const parseBtn = screen.getByText("HTMLを解析する");
        fireEvent.click(parseBtn);

        const titles = await screen.findAllByText("直接入力テストタイトル");
        expect(titles.length).toBeGreaterThan(0);
        const descs = screen.getAllByText("直接入力テストの説明文です。");
        expect(descs.length).toBeGreaterThan(0);
    });

    it("デスクトップ表示とモバイル表示のプレビューを切り替えられること", async () => {
        render(() => <SeoChecker />);
        fireEvent.click(screen.getByText("サンプルで試す"));

        const mobileBtn = await screen.findByText("📱 モバイル (スマホ)");
        fireEvent.click(mobileBtn);
        expect(mobileBtn.className).toContain("btn-primary");

        const desktopBtn = screen.getByText("💻 デスクトップ (PC)");
        fireEvent.click(desktopBtn);
        expect(desktopBtn.className).toContain("btn-primary");
    });

    it("URLからHTMLを取得してSEO情報が表示されること", async () => {
        const mockHtml = `<!doctype html>
        <html>
        <head>
            <title>リモート取得ページ</title>
            <meta name="description" content="リモート取得の説明文です" />
        </head>
        <body></body>
        </html>`;

        const mockMicrolink = {
            status: "success",
            data: {
                title: "リモート取得ページ",
                description: "リモート取得の説明文です",
                url: "https://example.com/test-remote",
            },
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => mockHtml,
            json: async () => mockMicrolink,
        } as any);

        render(() => <SeoChecker />);
        const input = screen.getByLabelText("確認するページのURL");
        fireEvent.input(input, {
            target: { value: "https://example.com/test-remote" },
        });

        const submitBtn = screen.getByRole("button", {
            name: "SEOメタタグを解析",
        });
        fireEvent.click(submitBtn);

        const titles = await screen.findAllByText("リモート取得ページ");
        expect(titles.length).toBeGreaterThan(0);
        const descs = screen.getAllByText("リモート取得の説明文です");
        expect(descs.length).toBeGreaterThan(0);

        // レポート全コピー
        const copyAllBtn = screen.getByText("📋 SEO診断レポートを全コピー");
        fireEvent.click(copyAllBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it("URL取得がすべて失敗した場合にエラーメッセージが表示されること", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(
            new Error("Network connection error"),
        );

        render(() => <SeoChecker />);
        const input = screen.getByLabelText("確認するページのURL");
        fireEvent.input(input, {
            target: { value: "https://invalid-non-existent-site.example" },
        });

        const submitBtn = screen.getByRole("button", {
            name: "SEOメタタグを解析",
        });
        fireEvent.click(submitBtn);

        expect(
            await screen.findByText(/SEO情報の取得中にエラーが発生しました|ページの取得に失敗しました/),
        ).toBeInTheDocument();
    });
});
