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
        scale: vi.fn(),
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
        expect(screen.getByText("⚡ 区切り文字")).toBeInTheDocument();
    });

    it("設定タブを切り替えると対応するパネルだけが表示されること", () => {
        const { container } = render(() => <ExifFrame />);
        const panel = (id: string) =>
            container.querySelector(`#exif-panel-${id}`) as HTMLElement;

        // 初期状態は「写真」タブ
        expect(panel("photo").hidden).toBe(false);
        expect(panel("text").hidden).toBe(true);
        expect(panel("layout").hidden).toBe(true);
        expect(panel("design").hidden).toBe(true);
        expect(panel("overlay").hidden).toBe(true);
        expect(panel("save").hidden).toBe(true);

        fireEvent.click(screen.getByRole("tab", { name: /文字/ }));
        expect(panel("text").hidden).toBe(false);
        expect(panel("photo").hidden).toBe(true);

        fireEvent.click(screen.getByRole("tab", { name: /重ね画像/ }));
        expect(panel("overlay").hidden).toBe(false);
        expect(panel("text").hidden).toBe(true);
        expect(
            screen.getByPlaceholderText("例: © 2026 Project / Character Name"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("tab", { name: /保存/ }));
        expect(panel("save").hidden).toBe(false);
        expect(panel("overlay").hidden).toBe(true);
        expect(
            screen.getByRole("tab", { name: /保存/ }).getAttribute("aria-selected"),
        ).toBe("true");

        fireEvent.click(screen.getByRole("tab", { name: /配置/ }));
        expect(panel("layout").hidden).toBe(false);
        expect(panel("save").hidden).toBe(true);
    });

    it("区切り文字プリセットの選択および自由入力の切り替えができること", () => {
        render(() => <ExifFrame />);
        const slashBtn = screen.getByTitle("スラッシュ ( / )");
        expect(slashBtn).toBeInTheDocument();
        fireEvent.click(slashBtn);

        const customBtn = screen.getByTitle("自由入力");
        expect(customBtn).toBeInTheDocument();
        fireEvent.click(customBtn);

        const customInput = screen.getByPlaceholderText("例: // や , など") as HTMLInputElement;
        expect(customInput).toBeInTheDocument();
        fireEvent.input(customInput, { target: { value: " // " } });
        expect(customInput.value).toBe(" // ");
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
        // FileReaderの非同期処理 (readAsDataURL) の完了を待機
        await new Promise((r) => setTimeout(r, 50));
        fireEvent.click(generateBtn);

        // piexif.dump に渡された exifObj の Orientation が 1 (Normal) に補正されたことを検証
        await vi.waitFor(() => {
            expect(loadSpy).toHaveBeenCalled();
            expect(dumpSpy).toHaveBeenCalled();
        });
        const dumpedObj = dumpSpy.mock.calls[0][0] as any;
        expect(dumpedObj["0th"][piexif.ImageIFD.Orientation]).toBe(1);

        globalThis.Image = origImage;
    });
});
