import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import PhotoComposite from "../pages/PhotoComposite";

describe("PhotoComposite", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("初期画面で見出し・アップロードボタン・レイヤー管理・書き出しボタンが表示されること", () => {
        render(() => <PhotoComposite />);
        expect(screen.getByRole("heading", { level: 1, name: "写真・立ち絵合成スタジオ" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "背景写真を選択" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "立ち絵を追加（複数可）" })).toBeInTheDocument();
        expect(screen.queryByText(/ドライブ対応/)).not.toBeInTheDocument();
        expect(screen.getByLabelText("写真ライブラリやドライブから背景写真を選択")).not.toHaveAttribute("accept");
        expect(screen.getByLabelText("写真ライブラリやドライブから立ち絵を追加（複数選択可）")).not.toHaveAttribute("accept");
        expect(screen.getByRole("button", { name: "AI自動馴染ませ（奥行き・地面壁・距離）" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "合成画像を保存" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "立ち絵レイヤー管理" })).toBeInTheDocument();
        expect(screen.getByText("立ち絵レイヤー (0体)")).toBeInTheDocument();
    });

    it("光源・影・被写界深度設定を操作できること", () => {
        render(() => <PhotoComposite />);
        const dofBtn = screen.getByRole("button", { name: "ボケOFF" });
        fireEvent.click(dofBtn);
        expect(screen.getByRole("button", { name: "ボケON" })).toBeInTheDocument();

        const fSlider = screen.getByLabelText(/絞り \(F値\)/) as HTMLInputElement;
        fireEvent.input(fSlider, { target: { value: "1.8" } });
        expect(screen.getByText("f/1.8")).toBeInTheDocument();

        const sortCheck = screen.getByLabelText("奥行き順に自動整列") as HTMLInputElement;
        expect(sortCheck.checked).toBe(true);
        fireEvent.click(sortCheck);
        expect(sortCheck.checked).toBe(false);
    });

    it("合成画像を保存ボタン押下でプレビューモーダルが開くこと", () => {
        const mockCtx = {
            clearRect: vi.fn(),
            createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            fillRect: vi.fn(),
            fillStyle: "",
        } as unknown as CanvasRenderingContext2D;
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx);
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => {
            cb(new Blob(["mock"], { type: "image/png" }));
        });
        if (!URL.createObjectURL) {
            URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock");
        } else {
            vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/mock");
        }

        render(() => <PhotoComposite />);
        fireEvent.click(screen.getByRole("button", { name: "合成画像を保存" }));
        expect(screen.getByRole("dialog", { name: "合成画像保存プレビュー" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "画像をダウンロード" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
        expect(screen.queryByRole("dialog", { name: "合成画像保存プレビュー" })).not.toBeInTheDocument();
    });

    it("非対応のファイル形式が選択された場合に案内メッセージを表示すること", () => {
        render(() => <PhotoComposite />);
        const bgInput = screen.getByLabelText("写真ライブラリやドライブから背景写真を選択") as HTMLInputElement;
        const badFile = new File(["hello"], "notes.txt", { type: "text/plain" });
        fireEvent.change(bgInput, { target: { files: [badFile] } });
        expect(screen.getByText("背景写真は PNG / JPEG / WebP などの画像ファイルを選択してください。")).toBeInTheDocument();
    });

    it("身長と距離の数値入力が入力途中で最低値に強制クランプされず自由に編集できること", () => {
        const OriginalImage = window.Image;
        class MockImage {
            width = 400;
            height = 800;
            naturalWidth = 400;
            naturalHeight = 800;
            onload: (() => void) | null = null;
            set src(_val: string) {
                if (this.onload) this.onload();
            }
        }
        vi.stubGlobal("Image", MockImage);
        if (!URL.createObjectURL) {
            URL.createObjectURL = vi.fn(() => "blob:http://localhost/char");
        } else {
            vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/char");
        }

        render(() => <PhotoComposite />);
        const charInput = screen.getByLabelText("写真ライブラリやドライブから立ち絵を追加（複数選択可）") as HTMLInputElement;
        const pngFile = new File([new Uint8Array([137, 80, 78, 71])], "chara.png", { type: "image/png" });
        fireEvent.change(charInput, { target: { files: [pngFile] } });

        const heightInput = screen.getByLabelText("身長 (cm)") as HTMLInputElement;
        const distInput = screen.getByLabelText("距離 (m)") as HTMLInputElement;

        // 途中の小さな値 (15cm, 0.1m) でも最低値20/0.3に強制リセットされないこと
        fireEvent.input(heightInput, { target: { value: "15" } });
        expect(heightInput.value).toBe("15");
        fireEvent.blur(heightInput);
        expect(heightInput.value).toBe("15");

        fireEvent.input(distInput, { target: { value: "0.1" } });
        expect(distInput.value).toBe("0.1");
        fireEvent.blur(distInput);
        expect(distInput.value).toBe("0.1");

        // 範囲外 (0) は blur 時のみ最小値へ正規化される
        fireEvent.input(heightInput, { target: { value: "0" } });
        fireEvent.blur(heightInput);
        expect(heightInput.value).toBe("1");

        vi.stubGlobal("Image", OriginalImage);
    });
});
