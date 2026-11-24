import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi, afterEach } from "vitest";
import JsonLdViewer from "../pages/JsonLdViewer";

describe("JsonLdViewer Component", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("初期描画で見出し、URL取得フォーム、モード切替タブ、外部リンクが表示されること", () => {
        render(() => <JsonLdViewer />);

        expect(
            screen.getByRole("heading", { level: 1, name: "JSON-LD 構造可視化・検証ツール" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /URLから取得/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /直接入力/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("確認するページのURL"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "JSON-LDを取得・解析" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "サンプルで試す" }),
        ).toBeInTheDocument();
        expect(
            screen.getByTitle("Google リッチリザルト テストを別タブで開く"),
        ).toBeInTheDocument();
    });

    it("URLを指定してMicrolinkから複数JSON-LDを取得し階層ツリーおよびエンティティを表示できること", async () => {
        globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.startsWith("https://api.microlink.io/")) {
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            url: "https://example.com/shop",
                            title: "サンプルショップ",
                            jsonld: [
                                JSON.stringify({
                                    "@context": "https://schema.org",
                                    "@type": "WebSite",
                                    name: "サンプルショップサイト",
                                    url: "https://example.com/shop",
                                }),
                                JSON.stringify({
                                    "@context": "https://schema.org",
                                    "@type": "Product",
                                    name: "特製メカニカルキーボード",
                                }),
                            ],
                        },
                    }),
                };
            }
            return { ok: false, status: 500 };
        });

        render(() => <JsonLdViewer />);

        const urlInput = screen.getByLabelText("確認するページのURL");
        fireEvent.input(urlInput, { target: { value: "https://example.com/shop" } });

        const submitBtn = screen.getByRole("button", { name: "JSON-LDを取得・解析" });
        fireEvent.click(submitBtn);

        expect(await screen.findByText(/2 エンティティ検出/)).toBeInTheDocument();

        const cardsTab = screen.getByRole("button", { name: /エンティティ一覧/ });
        fireEvent.click(cardsTab);

        expect(screen.getByText("WebSite")).toBeInTheDocument();
        expect(screen.getByText("Product")).toBeInTheDocument();
        expect(screen.getByText(/特製メカニカルキーボード/)).toBeInTheDocument();
    });

    it("URLから取得したHTMLにJSON-LDが含まれない場合に未検出メッセージが表示されること", async () => {
        globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.startsWith("https://api.allorigins.win/raw")) {
                return {
                    ok: true,
                    text: async () => "<!doctype html><html><head><title>Plain Page</title></head><body>No Schema</body></html>",
                };
            }
            return { ok: false, status: 404 };
        });

        render(() => <JsonLdViewer />);

        const urlInput = screen.getByLabelText("確認するページのURL");
        fireEvent.input(urlInput, { target: { value: "https://example.com/plain" } });

        const submitBtn = screen.getByRole("button", { name: "JSON-LDを取得・解析" });
        fireEvent.click(submitBtn);

        expect(
            await screen.findByText("指定されたページに JSON-LD 構造化データは検出されませんでした。"),
        ).toBeInTheDocument();
    });

    it("Microlinkが429でもAllOrigins/getでbody内@graph JSON-LDを取得・解析できること", async () => {
        const realisticHtml = `<!DOCTYPE html><html lang="ja"><head><title>Demo App</title></head><body><main><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Demo App","url":"https://example.com/demo-app/"},{"@type":"Organization","name":"Example Co., Ltd."},{"@type":"SoftwareApplication","name":"Demo App","applicationCategory":"EntertainmentApplication"}]}</script></main></body></html>`;

        globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.startsWith("https://api.microlink.io/")) {
                return { ok: false, status: 429 };
            }
            if (url.startsWith("https://api.allorigins.win/raw")) {
                return { ok: false, status: 408 };
            }
            if (url.startsWith("https://api.allorigins.win/get")) {
                return {
                    ok: true,
                    json: async () => ({ contents: realisticHtml }),
                };
            }
            return { ok: false, status: 500 };
        });

        render(() => <JsonLdViewer />);

        const urlInput = screen.getByLabelText("確認するページのURL");
        fireEvent.input(urlInput, { target: { value: "https://example.com/demo-app/" } });

        const submitBtn = screen.getByRole("button", { name: "JSON-LDを取得・解析" });
        fireEvent.click(submitBtn);

        expect(await screen.findByText(/3 エンティティ検出/)).toBeInTheDocument();
        expect(screen.getByText("@graph 構造")).toBeInTheDocument();
    });

    it("直接入力モードへ切り替えるとサンプルボタンやテキストエリアが表示され、サンプルを切り替えられること", () => {
        render(() => <JsonLdViewer />);

        const directTab = screen.getByRole("button", { name: /直接入力/ });
        fireEvent.click(directTab);

        expect(
            screen.getByLabelText("JSON-LD入力テキストエリア"),
        ).toBeInTheDocument();

        // 商品サンプルを読み込み
        const productBtn = screen.getByRole("button", { name: "商品" });
        fireEvent.click(productBtn);

        // エンティティ一覧タブに切り替え
        const cardsTab = screen.getByRole("button", { name: /エンティティ一覧/ });
        fireEvent.click(cardsTab);

        expect(screen.getByText("Product")).toBeInTheDocument();
        expect(
            screen.getByText(/ハイレゾ対応 高音質ワイヤレスヘッドホン Pro/),
        ).toBeInTheDocument();
    });

    it("クリアボタンを押すと入力欄が空になり入力待ちメッセージが表示されること", () => {
        render(() => <JsonLdViewer />);

        const directTab = screen.getByRole("button", { name: /直接入力/ });
        fireEvent.click(directTab);

        const clearBtn = screen.getByRole("button", { name: "クリア" });
        fireEvent.click(clearBtn);

        const textarea = screen.getByLabelText("JSON-LD入力テキストエリア") as HTMLTextAreaElement;
        expect(textarea.value).toBe("");
        expect(
            screen.getByText("URLを指定するか、JSON-LD / HTMLコードを入力してください"),
        ).toBeInTheDocument();
    });

    it("HTMLスニペットを入力した場合にスクリプトタグから自動抽出して解析されること", () => {
        render(() => <JsonLdViewer />);

        const directTab = screen.getByRole("button", { name: /直接入力/ });
        fireEvent.click(directTab);

        const textarea = screen.getByLabelText("JSON-LD入力テキストエリア") as HTMLTextAreaElement;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Event",
                    "name": "サマーテックカンファレンス2026",
                    "startDate": "2026-08-10T09:00:00+09:00",
                    "location": "東京国際フォーラム"
                }
                </script>
            </head>
            <body></body>
            </html>
        `;
        fireEvent.input(textarea, { target: { value: html } });

        // タブをエンティティ一覧に切り替え
        const cardsTab = screen.getByRole("button", { name: /エンティティ一覧/ });
        fireEvent.click(cardsTab);

        expect(screen.getByText("Event")).toBeInTheDocument();
        expect(screen.getByText(/サマーテックカンファレンス2026/)).toBeInTheDocument();
    });

    it("構文エラーのJSONを入力した場合に構文エラーのアラートが表示されること", () => {
        render(() => <JsonLdViewer />);

        const directTab = screen.getByRole("button", { name: /直接入力/ });
        fireEvent.click(directTab);

        const textarea = screen.getByLabelText("JSON-LD入力テキストエリア") as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "{ invalid json format :" } });

        expect(screen.getByText("構文エラー:")).toBeInTheDocument();
    });

    it("タブ切り替え（ツリー、エンティティ一覧、診断、整形コード）が機能すること", () => {
        render(() => <JsonLdViewer />);

        const directTab = screen.getByRole("button", { name: /直接入力/ });
        fireEvent.click(directTab);

        // 初期サンプルのArticleを読み込み
        const articleBtn = screen.getByRole("button", { name: "記事" });
        fireEvent.click(articleBtn);

        // 1. ツリータブ
        const treeTab = screen.getByRole("button", { name: /階層ツリー/ });
        fireEvent.click(treeTab);
        expect(screen.getByText("ノード階層構造")).toBeInTheDocument();

        // 2. 診断タブ
        const diagTab = screen.getByRole("button", { name: /診断/ });
        fireEvent.click(diagTab);
        expect(screen.getByText(/主要プロパティおよび構文チェックにおいて/)).toBeInTheDocument();

        // 3. 整形コードタブ
        const codeTab = screen.getByRole("button", { name: /整形コード/ });
        fireEvent.click(codeTab);
        expect(screen.getByText(/BlogPosting/)).toBeInTheDocument();
    });

    it("プロパティ検索フィルターに入力すると絞り込みが行われ、リセットで解除できること", () => {
        render(() => <JsonLdViewer />);

        const searchInput = screen.getByLabelText("プロパティ検索フィルター") as HTMLInputElement;
        fireEvent.input(searchInput, { target: { value: "headline" } });
        expect(searchInput.value).toBe("headline");

        const resetBtn = screen.getByRole("button", { name: "検索フィルターを解除" });
        fireEvent.click(resetBtn);
        expect(searchInput.value).toBe("");
    });

    it("コピーボタン押下時にクリップボードへの書き込みが実行されること", async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextMock,
            },
        });

        render(() => <JsonLdViewer />);

        const copyBtn = screen.getByRole("button", { name: "整形コピー" });
        fireEvent.click(copyBtn);

        expect(writeTextMock).toHaveBeenCalled();
    });

    it("ダウンロードボタン押下時に例外なく動作すること", () => {
        render(() => <JsonLdViewer />);

        const downloadBtn = screen.getByRole("button", { name: ".jsonld 保存" });
        expect(() => fireEvent.click(downloadBtn)).not.toThrow();
    });
});
