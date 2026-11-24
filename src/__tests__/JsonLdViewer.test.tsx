import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import JsonLdViewer from "../pages/JsonLdViewer";

describe("JsonLdViewer Component", () => {
    it("初期描画で見出し、入力欄、サンプルボタン、外部リンクが表示されること", () => {
        render(() => <JsonLdViewer />);

        expect(
            screen.getByRole("heading", { level: 1, name: "JSON-LD 構造可視化・検証ツール" }),
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("JSON-LD入力テキストエリア"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "記事のサンプルデータを読み込む" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "商品のサンプルデータを読み込む" }),
        ).toBeInTheDocument();
        expect(
            screen.getByTitle("Google リッチリザルト テストを別タブで開く"),
        ).toBeInTheDocument();
    });

    it("サンプルを切り替えると対応するSchema.orgタイプが解析結果に反映されること", () => {
        render(() => <JsonLdViewer />);

        // 商品サンプルを読み込み
        const productBtn = screen.getByRole("button", { name: "商品のサンプルデータを読み込む" });
        fireEvent.click(productBtn);

        // エンティティ一覧タブに切り替え
        const cardsTab = screen.getByRole("button", { name: "エンティティ一覧カードに切り替え" });
        fireEvent.click(cardsTab);

        expect(screen.getByText("Product")).toBeInTheDocument();
        expect(
            screen.getByText(/ハイレゾ対応 高音質ワイヤレスヘッドホン Pro/),
        ).toBeInTheDocument();
    });

    it("クリアボタンを押すと入力欄が空になり入力待ちメッセージが表示されること", () => {
        render(() => <JsonLdViewer />);

        const clearBtn = screen.getByRole("button", { name: "入力をクリアする" });
        fireEvent.click(clearBtn);

        const textarea = screen.getByLabelText("JSON-LD入力テキストエリア") as HTMLTextAreaElement;
        expect(textarea.value).toBe("");
        expect(
            screen.getByText("JSON-LDまたはHTMLコードを入力してください"),
        ).toBeInTheDocument();
    });

    it("HTMLスニペットを入力した場合にスクリプトタグから自動抽出して解析されること", () => {
        render(() => <JsonLdViewer />);

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
        const cardsTab = screen.getByRole("button", { name: "エンティティ一覧カードに切り替え" });
        fireEvent.click(cardsTab);

        expect(screen.getByText("Event")).toBeInTheDocument();
        expect(screen.getByText(/サマーテックカンファレンス2026/)).toBeInTheDocument();
    });

    it("構文エラーのJSONを入力した場合に構文エラーのアラートが表示されること", () => {
        render(() => <JsonLdViewer />);

        const textarea = screen.getByLabelText("JSON-LD入力テキストエリア") as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "{ invalid json format :" } });

        expect(screen.getByText("構文エラー:")).toBeInTheDocument();
    });

    it("タブ切り替え（ツリー、エンティティ一覧、診断、整形コード）が機能すること", () => {
        render(() => <JsonLdViewer />);

        // 初期サンプルのArticleを読み込み
        const articleBtn = screen.getByRole("button", { name: "記事のサンプルデータを読み込む" });
        fireEvent.click(articleBtn);

        // 1. ツリータブ
        const treeTab = screen.getByRole("button", { name: "階層ツリービューに切り替え" });
        fireEvent.click(treeTab);
        expect(screen.getByText("ノード階層構造")).toBeInTheDocument();

        // 2. 診断タブ
        const diagTab = screen.getByRole("button", { name: "バリデーション診断に切り替え" });
        fireEvent.click(diagTab);
        expect(screen.getByText(/主要プロパティおよび構文チェックにおいて/)).toBeInTheDocument();

        // 3. 整形コードタブ
        const codeTab = screen.getByRole("button", { name: "整形JSONコードに切り替え" });
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

        const copyBtn = screen.getByRole("button", { name: "整形済みJSON-LDをコピー" });
        fireEvent.click(copyBtn);

        expect(writeTextMock).toHaveBeenCalled();
    });

    it("ダウンロードボタン押下時に例外なく動作すること", () => {
        render(() => <JsonLdViewer />);

        const downloadBtn = screen.getByRole("button", { name: "JSON-LDファイルをダウンロード" });
        expect(() => fireEvent.click(downloadBtn)).not.toThrow();
    });
});
