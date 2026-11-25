import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi, afterEach } from "vitest";
import SitemapVisualizer from "../pages/SitemapVisualizer";

describe("SitemapVisualizer Component", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("初期描画で見出し、URL入力フォーム、サンプルボタンが表示されること", () => {
        render(() => <SitemapVisualizer />);

        expect(
            screen.getByRole("heading", { level: 1, name: "サイトマップ構造可視化" }),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("サイトURLまたはsitemap.xmlのURL"),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "解析する" })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "多言語サイト (hreflang)" }),
        ).toBeInTheDocument();
    });

    it("多言語サンプルを読み込むとツリー・URL一覧・多言語対応表・統計タブと言語フィルターおよびTSVコピーが動作すること", () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextMock,
            },
        });

        render(() => <SitemapVisualizer />);

        fireEvent.click(screen.getByRole("button", { name: "多言語サイト (hreflang)" }));

        // ディレクトリツリーにホストとパスが表示されること
        expect(screen.getByText("example.com")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /ディレクトリツリー \(8\)/ })).toBeInTheDocument();

        // 言語フィルターで zh-Hans のみに絞り込めること
        fireEvent.click(screen.getByRole("button", { name: "zh-Hans (1)" }));
        expect(screen.getByRole("tab", { name: /ディレクトリツリー \(5\)/ })).toBeInTheDocument();

        // すべてに戻す
        fireEvent.click(screen.getByRole("button", { name: "すべて (8)" }));

        // URL一覧（表）タブ
        fireEvent.click(screen.getByRole("tab", { name: /URL一覧（表）/ }));
        expect(screen.getByText("https://example.com/ja/products/camera-lens")).toBeInTheDocument();

        // TSVコピー
        fireEvent.click(screen.getByRole("button", { name: /表をコピー \(TSV\)/ }));
        expect(writeTextMock).toHaveBeenCalledWith(
            expect.stringContaining("URL\t言語\t階層\t最終更新日"),
        );

        // 多言語対応表タブ
        fireEvent.click(screen.getByRole("tab", { name: /多言語対応表/ }));
        expect(screen.getByText("/products/camera-lens")).toBeInTheDocument();

        // 統計・診断タブ
        fireEvent.click(screen.getByRole("tab", { name: "統計・診断" }));
        expect(screen.getByText("階層深度別のURL分布")).toBeInTheDocument();

        // クリアボタンで初期状態に戻ること
        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        expect(
            screen.getByText("URLを入力して解析するか、サンプルを選択してください"),
        ).toBeInTheDocument();
    });

    it("URL入力から sitemap.xml を取得・解析して結果を表示できること", async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/ja/item-1</loc><lastmod>2026-11-22</lastmod></url>
  <url><loc>https://example.com/en/item-1</loc><lastmod>2026-11-22</lastmod></url>
</urlset>`;

        globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url === "https://example.com/sitemap.xml") {
                return { ok: true, text: async () => xml };
            }
            return { ok: false, status: 404 };
        });

        render(() => <SitemapVisualizer />);

        const input = screen.getByLabelText("サイトURLまたはsitemap.xmlのURL");
        fireEvent.input(input, { target: { value: "https://example.com/sitemap.xml" } });
        fireEvent.click(screen.getByRole("button", { name: "解析する" }));

        expect(await screen.findByText("example.com")).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /ディレクトリツリー \(2\)/ })).toBeInTheDocument();
    });

    it("空URLで送信した場合にエラーメッセージが表示されること", () => {
        render(() => <SitemapVisualizer />);
        fireEvent.click(screen.getByRole("button", { name: "解析する" }));
        expect(screen.getByRole("alert")).toBeInTheDocument();
    });
});
