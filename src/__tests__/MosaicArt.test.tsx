import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MosaicArt from "../pages/MosaicArt";

describe("MosaicArt Page Component", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.URL.createObjectURL = vi
            .fn()
            .mockReturnValue("blob:http://localhost/mock-blob");
        globalThis.URL.revokeObjectURL = vi.fn();
    });

    it("初期状態でタイトル、画像選択エリア、オプションが表示され生成ボタンが無効であること", () => {
        render(() => <MosaicArt />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("モザイクアート作成");
        expect(screen.getByText("1. 完成させたい画像（ターゲット）")).toBeInTheDocument();
        expect(screen.getByText("2. 構成する画像（タイル素材）")).toBeInTheDocument();
        expect(screen.getByText("3. 生成オプション")).toBeInTheDocument();

        // ターゲット画像とタイル未選択時は生成ボタンが disabled
        const generateBtn = screen.getByRole("button", { name: "モザイクアートを生成" });
        expect(generateBtn).toBeDisabled();
    });

    it("スライダーで分割数を変更できること", () => {
        render(() => <MosaicArt />);
        const rangeInput = screen.getByLabelText("タイルの分割数") as HTMLInputElement;
        expect(rangeInput).toBeInTheDocument();

        fireEvent.input(rangeInput, { target: { value: "60" } });
        expect(rangeInput.value).toBe("60");
        expect(screen.getByText("60 列")).toBeInTheDocument();

        fireEvent.input(rangeInput, { target: { value: "200" } });
        expect(rangeInput.value).toBe("200");
        expect(screen.getByText("200 列")).toBeInTheDocument();
    });

    it("出力サイズや重複利用オプションを変更できること", () => {
        render(() => <MosaicArt />);
        const sizeSelect = screen.getByLabelText("出力画像サイズ") as HTMLSelectElement;
        fireEvent.change(sizeSelect, { target: { value: "2400" } });
        expect(sizeSelect.value).toBe("2400");

        const penaltySelect = screen.getByLabelText("重複利用の制限") as HTMLSelectElement;
        fireEvent.change(penaltySelect, { target: { value: "3" } });
        expect(penaltySelect.value).toBe("3");
        fireEvent.change(penaltySelect, { target: { value: "-1" } });
        expect(penaltySelect.value).toBe("-1");

        const avoidCheckbox = screen.getByLabelText("隣接セルでの同一画像重複を防止") as HTMLInputElement;
        expect(avoidCheckbox.checked).toBe(true);
        fireEvent.click(avoidCheckbox);
        expect(avoidCheckbox.checked).toBe(false);
    });

    it("ターゲット画像と構成画像を選択すると生成ボタンが有効化され、生成を実行できること", async () => {
        // Mock Canvas & Context
        const mockCtx = {
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn().mockReturnValue({
                data: new Uint8ClampedArray(100 * 100 * 4).fill(200),
            }),
        };
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
            mockCtx as unknown as CanvasRenderingContext2D,
        );
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
            (cb) => {
                cb(new Blob(["mock-result"], { type: "image/png" }));
            },
        );

        // Mock Image loading
        const OriginalImage = globalThis.Image;
        class MockImage {
            src = "";
            width = 100;
            height = 100;
            naturalWidth = 100;
            naturalHeight = 100;
            onload: (() => void) | null = null;
            constructor() {
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            }
        }
        // @ts-expect-error Mock Image
        globalThis.Image = MockImage;

        try {
            const { container } = render(() => <MosaicArt />);

            const fileInputs = container.querySelectorAll('input[type="file"]');
            expect(fileInputs.length).toBeGreaterThanOrEqual(2);

            const targetInput = fileInputs[0] as HTMLInputElement;
            const tilesInput = fileInputs[1] as HTMLInputElement;

            // ターゲット画像選択
            const targetFile = new File(["target image"], "target.png", { type: "image/png" });
            fireEvent.change(targetInput, { target: { files: [targetFile] } });

            // 構成画像選択
            const tile1 = new File(["tile 1"], "tile1.jpg", { type: "image/jpeg" });
            const tile2 = new File(["tile 2"], "tile2.jpg", { type: "image/jpeg" });
            await fireEvent.change(tilesInput, { target: { files: [tile1, tile2] } });

            // タイルの非同期Image.onloadを待機
            await new Promise((r) => setTimeout(r, 50));

            // 生成ボタンが有効化されていることを確認
            const generateBtn = screen.getByRole("button", { name: "モザイクアートを生成" });
            expect(generateBtn).not.toBeDisabled();

            // 生成をクリック
            await fireEvent.click(generateBtn);

            // 生成完了後のプレビューまたはダウンロードリンクが表示されること
            await new Promise((r) => setTimeout(r, 200));

            const downloadLink = await screen.findByRole("link", { name: "モザイクアート画像をダウンロード" });
            expect(downloadLink).toBeInTheDocument();
            // 完了モーダルが表示され、「プレビュー画面へ戻る」で閉じられること
            const backToPreviewBtn = screen.getByRole("button", { name: "プレビュー画面へ戻る" });
            fireEvent.click(backToPreviewBtn);
            expect(screen.queryByRole("button", { name: "プレビュー画面へ戻る" })).not.toBeInTheDocument();

            // 余分な出力用 <canvas> がDOM上に重複表示されていないこと
            expect(container.querySelector("canvas")).toBeNull();

            // 完成品画像をタップするとライトボックスが開き、ズームや閉じ操作ができること
            const lightboxTrigger = screen.getByRole("button", {
                name: "完成モザイクアートをライトボックスで拡大表示",
            });
            fireEvent.click(lightboxTrigger);
            expect(
                screen.getByRole("dialog", { name: "モザイクアート拡大ライトボックス" }),
            ).toBeInTheDocument();

            const zoom4xBtn = screen.getByRole("button", { name: "4x" });
            fireEvent.click(zoom4xBtn);

            const closeBtn = screen.getByRole("button", { name: "閉じる" });
            fireEvent.click(closeBtn);
            expect(
                screen.queryByRole("dialog", { name: "モザイクアート拡大ライトボックス" }),
            ).not.toBeInTheDocument();
        } finally {
            globalThis.Image = OriginalImage;
        }
    });

    it("タイル形状セレクトを変更できること", () => {
        render(() => <MosaicArt />);

        const aspectSelect = screen.getByLabelText("タイル形状（縦横比）") as HTMLSelectElement;
        expect(aspectSelect.value).toBe("square");
        fireEvent.change(aspectSelect, { target: { value: "landscape" } });
        expect(aspectSelect.value).toBe("landscape");
    });

    it("構成画像追加後にサムネイル一覧を折りたたみ・再表示できること", async () => {
        const mockCtx = {
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn().mockReturnValue({
                data: new Uint8ClampedArray(16 * 16 * 4).fill(180),
            }),
        };
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
            mockCtx as unknown as CanvasRenderingContext2D,
        );

        const OriginalImage = globalThis.Image;
        class MockImage {
            src = "";
            width = 64;
            height = 64;
            naturalWidth = 64;
            naturalHeight = 64;
            onload: (() => void) | null = null;
            constructor() {
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            }
        }
        // @ts-expect-error Mock Image
        globalThis.Image = MockImage;

        try {
            const { container } = render(() => <MosaicArt />);
            fireEvent.click(screen.getByRole("tab", { name: "素材" }));
            const tilesInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
            const tileFile = new File(["tile"], "tile.png", { type: "image/png" });
            await fireEvent.change(tilesInput, { target: { files: [tileFile] } });

            expect(await screen.findByText("1 枚選択中")).toBeInTheDocument();

            const toggleBtn = screen.getByRole("button", { name: "一覧を折りたたむ" });
            fireEvent.click(toggleBtn);
            expect(screen.getByRole("button", { name: "一覧を表示する" })).toBeInTheDocument();
        } finally {
            globalThis.Image = OriginalImage;
        }
    });

    it("Exifフレーム形式のドックタブ（ベース・素材・設定・保存）を切り替えられること", () => {
        render(() => <MosaicArt />);
        const baseTab = screen.getByRole("tab", { name: "ベース" });
        const tilesTab = screen.getByRole("tab", { name: "素材" });
        const optionsTab = screen.getByRole("tab", { name: "設定" });
        const saveTab = screen.getByRole("tab", { name: "保存" });

        expect(baseTab).toHaveAttribute("aria-selected", "true");

        fireEvent.click(tilesTab);
        expect(tilesTab).toHaveAttribute("aria-selected", "true");
        expect(baseTab).toHaveAttribute("aria-selected", "false");

        fireEvent.click(optionsTab);
        expect(optionsTab).toHaveAttribute("aria-selected", "true");

        fireEvent.click(saveTab);
        expect(saveTab).toHaveAttribute("aria-selected", "true");
    });
});
