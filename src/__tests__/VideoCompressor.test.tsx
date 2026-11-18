import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VideoCompressor from "../pages/VideoCompressor";

describe("VideoCompressor", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock-video");
        globalThis.URL.revokeObjectURL = vi.fn();
    });

    it("初期レンダリングでタイトル、説明、ドロップゾーンが表示されること", () => {
        render(() => <VideoCompressor />);

        // タイトルやバッジの検証
        expect(screen.getByText("動画圧縮・軽量化ツール")).toBeInTheDocument();
        expect(screen.getByText("完全ブラウザ完結")).toBeInTheDocument();
        expect(screen.getByText("サーバー送信ゼロで安心")).toBeInTheDocument();

        // ドロップゾーンとファイル選択ボタン
        expect(screen.getByText("動画ファイルをドラッグ＆ドロップ")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ファイルを選択" })).toBeInTheDocument();

        // FAQセクションの存在確認
        expect(screen.getByText("動画圧縮ツールの特徴と使い方")).toBeInTheDocument();
        expect(screen.getByText("よくある質問 (FAQ)")).toBeInTheDocument();
    });

    it("無効な形式のファイルを選択した際にエラーメッセージが表示されること", async () => {
        const { container } = render(() => <VideoCompressor />);
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).not.toBeNull();

        const invalidFile = new File(["not a video"], "document.pdf", { type: "application/pdf" });
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });

        expect(screen.getByText("動画ファイル（MP4, WebM, MOV等）を選択してください。")).toBeInTheDocument();
    });

    it("有効な動画ファイルを選択するとメタ情報と圧縮設定パネルが表示され、プリセットやスライダーを調整できること", async () => {
        const origCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation(
            ((tagName: string, options?: ElementCreationOptions) => {
                const el = origCreateElement(tagName, options);
                if (tagName.toLowerCase() === "video") {
                    Object.defineProperty(el, "videoWidth", { value: 1920 });
                    Object.defineProperty(el, "videoHeight", { value: 1080 });
                    Object.defineProperty(el, "duration", { value: 15 });
                    const origSrcDesc = Object.getOwnPropertyDescriptor(
                        HTMLMediaElement.prototype,
                        "src",
                    );
                    Object.defineProperty(el, "src", {
                        set(val: string) {
                            origSrcDesc?.set?.call(this, val);
                            setTimeout(() => {
                                el.dispatchEvent(new Event("loadedmetadata"));
                            }, 0);
                        },
                        get() {
                            return origSrcDesc?.get?.call(this) ?? "";
                        },
                    });
                }
                return el;
            }) as typeof document.createElement,
        );

        const { container } = render(() => <VideoCompressor />);
        const fileInput = container.querySelector(
            'input[type="file"]',
        ) as HTMLInputElement;
        const validVideo = new File(["mock-mp4-bytes"], "sample.mp4", {
            type: "video/mp4",
        });

        fireEvent.change(fileInput, { target: { files: [validVideo] } });

        // メタ情報と圧縮設定パネルが表示されること
        expect(await screen.findByText("1920 × 1080")).toBeInTheDocument();
        expect(screen.getByText("00:15")).toBeInTheDocument();
        expect(screen.getByText("MP4")).toBeInTheDocument();
        expect(screen.getByText("圧縮設定")).toBeInTheDocument();

        // 解像度スライダー操作で解像度表記が追従すること
        const scaleSlider = screen.getByLabelText("解像度スケーリング");
        fireEvent.input(scaleSlider, { target: { value: "50" } });
        expect(screen.getByText("解像度スケーリング: 50%")).toBeInTheDocument();
        expect(screen.getByText("960 × 540")).toBeInTheDocument();

        // ビットレートスライダー操作
        const bitrateSlider = screen.getByLabelText("映像ビットレート");
        fireEvent.input(bitrateSlider, { target: { value: "800" } });
        expect(screen.getByText("800 kbps")).toBeInTheDocument();
    });
});
