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
        expect(screen.getByRole("button", { name: "背景写真を選択（ドライブ対応）" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "立ち絵を追加（複数・ドライブ対応）" })).toBeInTheDocument();
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
});
