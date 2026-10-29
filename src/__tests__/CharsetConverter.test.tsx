import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CharsetConverter from "../pages/CharsetConverter";

describe("CharsetConverter", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-blob");
        globalThis.URL.revokeObjectURL = vi.fn();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態でタイトルや全タブが表示され、テキストエリアが空であること", () => {
        render(() => <CharsetConverter />);
        expect(screen.getByText("文字コード総合変換ツール")).toBeInTheDocument();
        expect(screen.getByText("テキスト文字コード変換")).toBeInTheDocument();
        expect(screen.getByText("進数・コード表記変換")).toBeInTheDocument();
        expect(screen.getByText("1文字コード解析")).toBeInTheDocument();
        expect(screen.getByText("ファイル変換")).toBeInTheDocument();
        expect(screen.getByText("Unicode正規化 (NFC/NFD)")).toBeInTheDocument();
        expect(screen.getByText("文字化け修復")).toBeInTheDocument();

        const inputArea = screen.getByPlaceholderText(
            "変換したいテキストをここに入力または貼り付け...",
        ) as HTMLTextAreaElement;
        expect(inputArea.value).toBe("");

        const previewArea = screen.getByPlaceholderText(
            "変換後のテキストがここに表示されます...",
        ) as HTMLTextAreaElement;
        expect(previewArea.value).toBe("");
    });

    it("テキスト入力でプレビュー反映とコピー・ダウンロードが動作すること", async () => {
        render(() => <CharsetConverter />);
        const inputArea = screen.getByPlaceholderText(
            "変換したいテキストをここに入力または貼り付け...",
        ) as HTMLTextAreaElement;
        fireEvent.input(inputArea, { target: { value: "テストテキスト" } });
        expect(inputArea.value).toBe("テストテキスト");

        const previewArea = screen.getByPlaceholderText(
            "変換後のテキストがここに表示されます...",
        ) as HTMLTextAreaElement;
        expect(previewArea.value).toBe("テストテキスト");

        const copyBtn = screen.getByRole("button", { name: "テキストをコピー" });
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("テストテキスト");

        const downloadBtn = screen.getByRole("button", { name: "ファイル保存" });
        fireEvent.click(downloadBtn);
        expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    });

    it("進数・コード表記変換タブでHEXやUnicodeエスケープが動作すること", async () => {
        render(() => <CharsetConverter />);
        const cfTab = screen.getByRole("button", { name: "進数・コード表記変換" });
        fireEvent.click(cfTab);

        expect(
            screen.getByText("進数・コード表記・エスケープ相互変換"),
        ).toBeInTheDocument();
        expect(screen.getByText("16進数バイト列 (HEX)")).toBeInTheDocument();
        expect(screen.getByText("Unicode表記")).toBeInTheDocument();
        expect(screen.getByText("HTML数値文字参照 (NCR)")).toBeInTheDocument();

        const textarea = screen.getByPlaceholderText("変換したいテキストを入力...") as HTMLTextAreaElement;
        expect(textarea.value).toBe("");
        fireEvent.input(textarea, { target: { value: "あ" } });
        expect(textarea.value).toBe("あ");
    });

    it("1文字コード解析インスペクタータブでテーブルが表示されること", async () => {
        render(() => <CharsetConverter />);
        const inspectorTab = screen.getByRole("button", { name: "1文字コード解析" });
        fireEvent.click(inspectorTab);

        expect(
            screen.getByText("1文字コード解析インスペクター"),
        ).toBeInTheDocument();
        expect(screen.getByText("Unicode")).toBeInTheDocument();
        expect(screen.getByText("UTF-8 (HEX)")).toBeInTheDocument();
    });

    it("Unicode正規化タブで初期値が空であり入力するとNFCとNFDが算出されること", async () => {
        render(() => <CharsetConverter />);
        const normTab = screen.getByRole("button", { name: "Unicode正規化 (NFC/NFD)" });
        fireEvent.click(normTab);

        expect(
            screen.getByText("Unicode正規化ツール（NFC / NFD / NFKC / NFKD）"),
        ).toBeInTheDocument();

        const normInput = screen.getByRole("textbox") as HTMLTextAreaElement;
        expect(normInput.value).toBe("");

        fireEvent.input(normInput, { target: { value: "テスト" } });
        expect(normInput.value).toBe("テスト");
    });

    it("文字化け修復タブで入力した文字化けテキストの復元候補が表示されること", async () => {
        render(() => <CharsetConverter />);
        const mojibakeTab = screen.getByRole("button", { name: "文字化け修復" });
        fireEvent.click(mojibakeTab);

        expect(
            screen.getByText("文字化け自動復元・修復ツール"),
        ).toBeInTheDocument();

        const mojibakeInput = screen.getByPlaceholderText(
            "文字化けした文字列をここに貼り付けてください...",
        ) as HTMLTextAreaElement;
        expect(mojibakeInput.value).toBe("");

        fireEvent.input(mojibakeInput, { target: { value: "縺薙ｓ縺ｫ縺｡縺ｯ" } });
        expect(screen.getByText("こんにちは")).toBeInTheDocument();
    });
});
