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

    it("JPEG変換を実行するとCanvas経由でBlob URLが生成され保存リンクが表示されること", async () => {
        const mockCtx = {
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
        };
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
            mockCtx as unknown as CanvasRenderingContext2D,
        );
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (cb) => {
                cb(new Blob(["mock-jpeg"], { type: "image/jpeg" }));
            },
        );

        const OrigImage = globalThis.Image;
        class MockImage {
            width = 120;
            height = 80;
            onload: (() => void) | null = null;
            set src(_val: string) {
                setTimeout(() => this.onload?.(), 0);
            }
        }
        globalThis.Image = MockImage as unknown as typeof Image;

        try {
            const { container } = render(() => <ImageConverter />);
            const fileInput = container.querySelector(
                'input[type="file"]',
            ) as HTMLInputElement;
            const dummyFile = new File(["png-bytes"], "photo.png", {
                type: "image/png",
            });
            fireEvent.change(fileInput, { target: { files: [dummyFile] } });

            const formatSelect = screen.getByRole(
                "combobox",
            ) as HTMLSelectElement;
            fireEvent.change(formatSelect, { target: { value: "image/jpeg" } });

            const convertBtn = screen.getByRole("button", {
                name: "指定の形式に変換する",
            });
            fireEvent.click(convertBtn);

            const downloadLink = await screen.findByRole("link", {
                name: /画像をダウンロード/,
            });
            expect(downloadLink).toBeInTheDocument();
            expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 120, 80);
            expect(mockCtx.drawImage).toHaveBeenCalled();
        } finally {
            globalThis.Image = OrigImage;
        }
    });
});
