import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ExifFrame from "../pages/ExifFrameGenerator";
import piexif from "piexifjs";

// Canvas API の Mock 設定
beforeEach(() => {
    vi.restoreAllMocks();

    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 100 }),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        clip: vi.fn(),
        roundRect: vi.fn(),
        rect: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({
            addColorStop: vi.fn(),
        }),
        strokeRect: vi.fn(),
        arc: vi.fn(),
    })) as any;

    HTMLCanvasElement.prototype.toDataURL = vi
        .fn()
        .mockReturnValue("data:image/jpeg;base64,mockdata");

    // Global URL APIs Mock
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
});

describe("ExifFrameGenerator", () => {
    it("初期状態のレンダリング確認", () => {
        render(() => <ExifFrame />);
        expect(screen.getByText("📁 写真を選択する")).toBeInTheDocument();
        expect(screen.queryByText("✨ 額縁付き画像を生成")).not.toBeInTheDocument();
    });

    it("画像アップロード後に生成ボタンが表示されること", async () => {
        const { container } = render(() => <ExifFrame />);
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).not.toBeNull();

        const dummyFile = new File(["dummy content"], "sample.jpg", { type: "image/jpeg" });
        
        // Mock FileReader / Image loading
        const origImage = globalThis.Image;
        class MockImage {
            onload: () => void = () => {};
            src: string = "";
            width: number = 800;
            height: number = 600;
            constructor() {
                setTimeout(() => this.onload(), 10);
            }
        }
        globalThis.Image = MockImage as any;

        fireEvent.change(fileInput, { target: { files: [dummyFile] } });

        const generateBtn = await screen.findByText("✨ 額縁付き画像を生成");
        expect(generateBtn).toBeInTheDocument();

        globalThis.Image = origImage;
    });

    it("生成ボタン押下時に自動ダウンロードが発生せず、モーダルが開いてダウンロードボタンが表示されること", async () => {
        const { container } = render(() => <ExifFrame />);
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        const dummyFile = new File(["dummy content"], "test.jpg", { type: "image/jpeg" });

        class MockImage {
            onload: () => void = () => {};
            src: string = "";
            width: number = 800;
            height: number = 600;
            constructor() {
                setTimeout(() => this.onload(), 10);
            }
        }
        const origImage = globalThis.Image;
        globalThis.Image = MockImage as any;

        fireEvent.change(fileInput, { target: { files: [dummyFile] } });

        const generateBtn = await screen.findByText("✨ 額縁付き画像を生成");

        // document.createElement("a").click が呼ばれないことを検証するためのスパイ
        const createElementSpy = vi.spyOn(document, "createElement");

        fireEvent.click(generateBtn);

        // モーダルのヘッダーとダウンロードボタンが表示されていること
        expect(await screen.findByText("✨ 画像が生成されました")).toBeInTheDocument();
        const downloadLink = screen.getByText("📥 画像をダウンロードする");
        expect(downloadLink).toBeInTheDocument();
        expect(downloadLink.getAttribute("download")).toMatch(/^framed_test_\d{4}\.jpeg$/);

        // 自動ダウンロード用の a タグ生成・クリックが発生していないことを検証
        const anchorCalls = createElementSpy.mock.calls.filter((call) => call[0] === "a");
        expect(anchorCalls.length).toBe(0);

        // 1回目のダウンロードボタン押下で a タグが生成されクリックされること
        fireEvent.click(downloadLink);
        const anchorCallsAfterClick1 = createElementSpy.mock.calls.filter((call) => call[0] === "a");
        expect(anchorCallsAfterClick1.length).toBe(1);

        // 2回目のダウンロードボタン押下でも再度 a タグが生成されクリックされること（スマホ等の2回目不具合防止）
        fireEvent.click(downloadLink);
        const anchorCallsAfterClick2 = createElementSpy.mock.calls.filter((call) => call[0] === "a");
        expect(anchorCallsAfterClick2.length).toBe(2);

        globalThis.Image = origImage;
    });

    it("EXIF引き継ぎ保存時に Orientation が 1 に上書き補正されること", async () => {
        const mockExifObj = {
            "0th": {
                [piexif.ImageIFD.Orientation]: 6, // 元画像は90度回転（Portrait）
                [piexif.ImageIFD.ImageWidth]: 4000,
                [piexif.ImageIFD.ImageLength]: 3000,
            },
            Exif: {
                [piexif.ExifIFD.PixelXDimension]: 4000,
                [piexif.ExifIFD.PixelYDimension]: 3000,
            },
        };

        const loadSpy = vi.spyOn(piexif, "load").mockReturnValue(mockExifObj);
        const dumpSpy = vi.spyOn(piexif, "dump").mockReturnValue("dumped_exif");
        const insertSpy = vi.spyOn(piexif, "insert").mockReturnValue("data:image/jpeg;base64,with_exif");

        const { container } = render(() => <ExifFrame />);
        
        // 元のEXIF引き継ぎチェックボックスをONにする
        const exifCheckbox = screen.getByLabelText(/元のExifデータを引き継ぐ/i) as HTMLInputElement;
        fireEvent.click(exifCheckbox);
        expect(exifCheckbox.checked).toBe(true);

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const dummyFile = new File(["fake jpeg base64"], "exif_photo.jpg", { type: "image/jpeg" });

        class MockImage {
            onload: () => void = () => {};
            src: string = "";
            width: number = 800;
            height: number = 600;
            constructor() {
                setTimeout(() => this.onload(), 10);
            }
        }
        const origImage = globalThis.Image;
        globalThis.Image = MockImage as any;

        fireEvent.change(fileInput, { target: { files: [dummyFile] } });

        const generateBtn = await screen.findByText("✨ 額縁付き画像を生成");
        fireEvent.click(generateBtn);

        // piexif.dump に渡された exifObj の Orientation が 1 (Normal) に補正されたことを検証
        expect(loadSpy).toHaveBeenCalled();
        expect(dumpSpy).toHaveBeenCalled();
        const dumpedObj = dumpSpy.mock.calls[0][0] as any;
        expect(dumpedObj["0th"][piexif.ImageIFD.Orientation]).toBe(1);

        globalThis.Image = origImage;
    });
});
