import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImageConverter from "../pages/ImageConverter";

describe("ImageConverter", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-blob");
        globalThis.URL.revokeObjectURL = vi.fn();
    });

    it("初期状態でファイル選択エリアとフォーマット選択が表示されていること", () => {
        render(() => <ImageConverter />);
        expect(screen.getByText("画像形式変換ツール")).toBeInTheDocument();
        expect(screen.getByText("ドラッグ＆ドロップ、またはファイルを選択")).toBeInTheDocument();
        expect(screen.getByText("変換後の画像形式（フォーマット）")).toBeInTheDocument();

        // 変換ボタンはファイル未選択時はdisabled
        const convertBtn = screen.getByRole("button", { name: "指定の形式に変換する" });
        expect(convertBtn).toBeDisabled();
    });

    it("ファイルを選択すると変換ボタンが有効化されること", async () => {
        const { container } = render(() => <ImageConverter />);
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).not.toBeNull();

        const dummyFile = new File(["dummy content"], "test.png", { type: "image/png" });
        fireEvent.change(fileInput, { target: { files: [dummyFile] } });

        const convertBtn = screen.getByRole("button", { name: "指定の形式に変換する" });
        expect(convertBtn).not.toBeDisabled();
        expect(screen.getByText("test.png")).toBeInTheDocument();
    });

    it("フォーマットを変更できること", () => {
        render(() => <ImageConverter />);
        const formatSelect = screen.getByRole("combobox") as HTMLSelectElement;

        fireEvent.change(formatSelect, { target: { value: "image/webp" } });
        expect(formatSelect.value).toBe("image/webp");
    });
});
