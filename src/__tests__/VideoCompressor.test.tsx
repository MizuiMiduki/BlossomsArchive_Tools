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
});
