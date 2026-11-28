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
    });

    it("出力サイズや重複利用オプションを変更できること", () => {
        render(() => <MosaicArt />);
        const sizeSelect = screen.getByLabelText("出力画像サイズ") as HTMLSelectElement;
        fireEvent.change(sizeSelect, { target: { value: "2400" } });
        expect(sizeSelect.value).toBe("2400");

        const penaltySelect = screen.getByLabelText("重複利用の制限") as HTMLSelectElement;
        fireEvent.change(penaltySelect, { target: { value: "3" } });
        expect(penaltySelect.value).toBe("3");

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
        } finally {
            globalThis.Image = OriginalImage;
        }
    });

    it("色味ブレンド強度スライダーとタイル形状セレクトを変更できること", () => {
        render(() => <MosaicArt />);

        const blendSlider = screen.getByLabelText("元画像の色味ブレンド強度") as HTMLInputElement;
        expect(blendSlider.value).toBe("20");
        fireEvent.input(blendSlider, { target: { value: "45" } });
        expect(screen.getByText("45%")).toBeInTheDocument();

        const aspectSelect = screen.getByLabelText("タイル形状（縦横比）") as HTMLSelectElement;
        expect(aspectSelect.value).toBe("square");
        fireEvent.change(aspectSelect, { target: { value: "landscape" } });
        expect(aspectSelect.value).toBe("landscape");
    });

    it("サンプルタイル(24枚)ボタンでタイルを追加できること", async () => {
        const mockCtx = {
            fillStyle: "",
            fillRect: vi.fn(),
            createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
        };
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
            mockCtx as unknown as CanvasRenderingContext2D,
        );
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
            cb(new Blob(["sample"], { type: "image/png" }));
        });

        render(() => <MosaicArt />);
        const sampleBtn = screen.getByRole("button", { name: "サンプルタイル(24枚)を追加" });
        fireEvent.click(sampleBtn);

        expect(await screen.findByText("24 枚選択中")).toBeInTheDocument();

        const toggleBtn = screen.getByRole("button", { name: "一覧を折りたたむ" });
        fireEvent.click(toggleBtn);
        expect(screen.getByRole("button", { name: "一覧を表示する" })).toBeInTheDocument();
    });
});
