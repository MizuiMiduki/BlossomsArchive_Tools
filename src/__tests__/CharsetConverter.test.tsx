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

    it("初期状態でタイトルや全タブが表示されていること", () => {
        render(() => <CharsetConverter />);
        expect(screen.getByText("文字コード総合変換ツール")).toBeInTheDocument();
        expect(screen.getByText("テキスト文字コード変換")).toBeInTheDocument();
        expect(screen.getByText("進数・コード表記変換")).toBeInTheDocument();
        expect(screen.getByText("1文字コード解析")).toBeInTheDocument();
        expect(screen.getByText("ファイル変換")).toBeInTheDocument();
        expect(screen.getByText("Unicode正規化 (NFC/NFD)")).toBeInTheDocument();
        expect(screen.getByText("文字化け修復")).toBeInTheDocument();
    });

    it("テキスト変換でサンプル挿入とプレビュー反映が動作すること", async () => {
        render(() => <CharsetConverter />);
        const sampleBtn = screen.getByRole("button", { name: "サンプル挿入" });
        fireEvent.click(sampleBtn);

        const inputArea = screen.getByPlaceholderText(
            "変換したいテキストをここに入力または貼り付け...",
        ) as HTMLTextAreaElement;
        expect(inputArea.value).toContain("文字コード変換テスト");

        const previewArea = screen.getByPlaceholderText(
            "変換後のテキストがここに表示されます...",
        ) as HTMLTextAreaElement;
        expect(previewArea.value).toContain("文字コード変換テスト");
    });

    it("進数・コード表記変換タブでHEXやUnicodeエスケープが表示されること", async () => {
        render(() => <CharsetConverter />);
        const cfTab = screen.getByRole("button", { name: "進数・コード表記変換" });
        fireEvent.click(cfTab);

        expect(
            screen.getByText("進数・コード表記・エスケープ相互変換"),
        ).toBeInTheDocument();
        expect(screen.getByText("16進数バイト列 (HEX)")).toBeInTheDocument();
        expect(screen.getByText("Unicode表記")).toBeInTheDocument();
        expect(screen.getByText("HTML数値文字参照 (NCR)")).toBeInTheDocument();
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

    it("Unicode正規化タブでNFCとNFDの表示があること", async () => {
        render(() => <CharsetConverter />);
        const normTab = screen.getByRole("button", { name: "Unicode正規化 (NFC/NFD)" });
        fireEvent.click(normTab);

        expect(
            screen.getByText("Unicode正規化ツール（NFC / NFD / NFKC / NFKD）"),
        ).toBeInTheDocument();
        expect(screen.getByText("NFC (標準合成形式)")).toBeInTheDocument();
        expect(screen.getByText("NFD (分解形式)")).toBeInTheDocument();
    });

    it("文字化け修復タブでサンプル復元が動作すること", async () => {
        render(() => <CharsetConverter />);
        const mojibakeTab = screen.getByRole("button", { name: "文字化け修復" });
        fireEvent.click(mojibakeTab);

        expect(
            screen.getByText("文字化け自動復元・修復ツール"),
        ).toBeInTheDocument();

        const sampleBtn = screen.getByRole("button", { name: "サンプル挿入（縺...）" });
        fireEvent.click(sampleBtn);

        expect(screen.getByText("こんにちは、世界")).toBeInTheDocument();
    });
});
