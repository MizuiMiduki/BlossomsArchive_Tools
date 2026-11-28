import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ArCameraOverlay from "../pages/ArCameraOverlay";

describe("ArCameraOverlay Page", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        if (!URL.createObjectURL) {
            URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-ar");
        } else {
            vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/mock-ar");
        }
        URL.revokeObjectURL = vi.fn();
    });

    it("renders main heading, camera app HUD controls, and shutter button", () => {
        render(() => <ArCameraOverlay />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "ARカメラ・立ち絵重ね撮影",
        );
        expect(
            screen.getByRole("button", { name: "AR空間モード（リアル影）" }),
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            screen.getByRole("button", { name: "自由固定モード" }),
        ).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: "カメラを起動" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "撮影する (シャッター)" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "全画面" })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: "画像を選択" })).toBeInTheDocument();
        expect(
            screen.getByLabelText("写真やドライブから透過画像を選択"),
        ).not.toHaveAttribute("accept");
    });

    it("toggles fullscreen camera mode and settings drawer", async () => {
        render(() => <ArCameraOverlay />);

        const fsBtn = screen.getByRole("button", { name: "全画面" });
        await fireEvent.click(fsBtn);
        expect(screen.getByRole("button", { name: "全画面終了" })).toHaveAttribute("aria-pressed", "true");

        const drawerBtn = screen.getByRole("button", { name: "影・配置調整" });
        fireEvent.click(drawerBtn);
        expect(screen.getByRole("region", { name: "カメラ合成の配置とリアル影詳細設定" })).toBeInTheDocument();
        expect(screen.getByText("ARリアル影・ジャイロ")).toBeInTheDocument();

        const fixedBtn = screen.getByRole("button", { name: "自由固定モード" });
        fireEvent.click(fixedBtn);
        expect(fixedBtn).toHaveAttribute("aria-pressed", "true");
        expect(screen.queryByText("ARリアル影・ジャイロ")).not.toBeInTheDocument();
    });

    it("handles position lock toggle and range slider clamping inside settings drawer", () => {
        render(() => <ArCameraOverlay />);

        fireEvent.click(screen.getByRole("button", { name: "影・配置調整" }));

        const posXSlider = screen.getByLabelText(/横位置 \(X\)/) as HTMLInputElement;
        expect(posXSlider.disabled).toBe(false);

        fireEvent.input(posXSlider, { target: { value: "75" } });
        expect(screen.getByText("75.0%")).toBeInTheDocument();

        const lockBtn = screen.getByRole("button", { name: "位置ロック" });
        fireEvent.click(lockBtn);
        expect(screen.getByRole("button", { name: "固定ロック中" })).toHaveAttribute("aria-pressed", "true");
        expect(posXSlider.disabled).toBe(true);
    });

    it("shows friendly error message when camera API is unavailable", async () => {
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: undefined,
        });

        render(() => <ArCameraOverlay />);
        const startBtn = screen.getByRole("button", { name: "カメラを起動" });
        fireEvent.click(startBtn);

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "カメラアクセスAPI（getUserMedia）に対応していません",
        );
    });

    it("下部シャッターバーがモバイル幅でも折り返し・中央シャッター配置で見切れないレイアウトであること", () => {
        render(() => <ArCameraOverlay />);
        const shutterBtn = screen.getByRole("button", { name: "撮影する (シャッター)" });
        expect(shutterBtn).toBeInTheDocument();
        expect(shutterBtn.style.justifySelf).toBe("center");
        expect(shutterBtn.parentElement?.style.gridTemplateColumns).toBe("1fr auto 1fr");

        const lockBtn = screen.getByRole("button", { name: "位置ロック" });
        expect(lockBtn.parentElement?.style.flexWrap).toBe("wrap");
    });

    it("影の方向（光源方向自動推定）がデフォルトで有効であり、手動スライダー操作で自動推定が解除されること", () => {
        render(() => <ArCameraOverlay />);
        const drawerToggle = screen.getByRole("button", { name: "影・配置調整" });
        fireEvent.click(drawerToggle);

        const autoLightCheckbox = screen.getByLabelText("映像の明暗から光源方向を自動推定") as HTMLInputElement;
        expect(autoLightCheckbox.checked).toBe(true);

        const azimuthSlider = screen.getByLabelText(/光源の向き/) as HTMLInputElement;
        fireEvent.input(azimuthSlider, { target: { value: "90" } });
        expect(azimuthSlider.value).toBe("90");
        expect(autoLightCheckbox.checked).toBe(false);
    });

    it("設定ドロワーの閉じるボタンがスクロール領域外の固定ヘッダーに配置されていること", () => {
        render(() => <ArCameraOverlay />);
        fireEvent.click(screen.getByRole("button", { name: "影・配置調整" }));

        const closeBtn = screen.getByRole("button", { name: "調整パネルを閉じる" });
        const header = closeBtn.parentElement as HTMLElement;
        const drawer = header.parentElement as HTMLElement;
        expect(drawer.style.display).toBe("flex");
        expect(drawer.style.flexDirection).toBe("column");
        expect(header.style.flexShrink).toBe("0");

        fireEvent.click(closeBtn);
        expect(screen.queryByRole("button", { name: "調整パネルを閉じる" })).not.toBeInTheDocument();
    });

    it("上半身のみ表示などのために描画範囲外(-100%..200%)および拡大率4.0まで移動・拡大できること", () => {
        render(() => <ArCameraOverlay />);
        fireEvent.click(screen.getByRole("button", { name: "影・配置調整" }));

        const posXSlider = screen.getByLabelText(/横位置/) as HTMLInputElement;
        const posYSlider = screen.getByLabelText(/足元接地位置/) as HTMLInputElement;
        const scaleSlider = screen.getByLabelText(/サイズ/) as HTMLInputElement;

        fireEvent.input(posXSlider, { target: { value: "-45" } });
        expect(posXSlider.value).toBe("-45");

        fireEvent.input(posYSlider, { target: { value: "160" } });
        expect(posYSlider.value).toBe("160");

        fireEvent.input(scaleSlider, { target: { value: "3.5" } });
        expect(scaleSlider.value).toBe("3.5");
    });

    it("物の奥に立たせる前後合成（奥に配置）ペイントUIを操作できること", () => {
        render(() => <ArCameraOverlay />);
        const occlusionBtn = screen.getByRole("button", { name: "奥に配置" });
        fireEvent.click(occlusionBtn);

        expect(screen.getByRole("region", { name: "前後合成マスク操作" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "塗る" })).toBeInTheDocument();
        const eraserBtn = screen.getByRole("button", { name: "消しゴム" });
        fireEvent.click(eraserBtn);

        const brushSlider = screen.getByLabelText("遮蔽ブラシの太さ") as HTMLInputElement;
        fireEvent.input(brushSlider, { target: { value: "80" } });
        expect(brushSlider.value).toBe("80");

        fireEvent.click(screen.getByRole("button", { name: "完了" }));
        expect(screen.queryByRole("region", { name: "前後合成マスク操作" })).not.toBeInTheDocument();
    });

    it("バックグラウンドから復帰した際に起動中だったカメラが自動で再取得されること", async () => {
        const trackStop = vi.fn();
        const mockTrack = { readyState: "ended", stop: trackStop, addEventListener: vi.fn() };
        const mockStream = {
            getTracks: () => [mockTrack],
            getVideoTracks: () => [mockTrack],
        };
        const getUserMedia = vi.fn().mockResolvedValue(mockStream);
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: { getUserMedia },
        });
        Object.defineProperty(HTMLMediaElement.prototype, "play", {
            configurable: true,
            value: vi.fn().mockResolvedValue(undefined),
        });

        render(() => <ArCameraOverlay />);
        fireEvent.click(screen.getByRole("button", { name: "カメラを起動" }));
        await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

        // バックグラウンドからフォアグラウンドへ復帰（トラックが ended になっていた想定）
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
        });
        fireEvent(document, new Event("visibilitychange"));
        await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    });

    it("AR空間モードの初期状態でジャイロ空間アンカーが自動で有効化され、自由固定モード切替で解除されること", async () => {
        render(() => <ArCameraOverlay />);
        fireEvent.click(screen.getByRole("button", { name: "影・配置調整" }));

        await vi.waitFor(() => {
            expect(screen.getByRole("button", { name: "ジャイロON" })).toBeInTheDocument();
        });

        // 自由固定モードに切り替えるとジャイロが無効化され、AR空間モードに戻すと再びONになること
        fireEvent.click(screen.getByRole("button", { name: /自由固定モード/ }));
        expect(screen.queryByRole("button", { name: "ジャイロON" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /AR空間モード/ }));
        await vi.waitFor(() => {
            expect(screen.getByRole("button", { name: "ジャイロON" })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "ジャイロON" }));
        expect(screen.getByRole("button", { name: "ジャイロOFF" })).toBeInTheDocument();
    });

    it("AI自動判定(WebGPU)ボタンと完全端末内処理・AI学習不使用の明記が表示されること", () => {
        render(() => <ArCameraOverlay />);
        expect(
            screen.getByText(/外部送信・AI学習に使われることはありません/),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "奥に配置" }));
        expect(screen.getByRole("button", { name: "AI自動判定 (WebGPU)" })).toBeInTheDocument();
        expect(
            screen.getByText(/端末内（WebGPU）のみで解析・外部送信やAI学習には一切使用されません/),
        ).toBeInTheDocument();
    });

    it("キャラクターの身長(cm)とカメラ距離(m)を入力して実寸サイズを自動計算・反映できること", () => {
        render(() => <ArCameraOverlay />);
        fireEvent.click(screen.getByRole("button", { name: "影・配置調整" }));

        const heightInput = screen.getByLabelText("身長 (cm)") as HTMLInputElement;
        const distanceInput = screen.getByLabelText("距離 (m)") as HTMLInputElement;
        const scaleSlider = screen.getByLabelText(/サイズ/) as HTMLInputElement;

        fireEvent.input(heightInput, { target: { value: "180" } });
        fireEvent.input(distanceInput, { target: { value: "2.0" } });

        const scaledHigh = Number(scaleSlider.value);
        expect(scaledHigh).toBeGreaterThan(0.65);

        fireEvent.input(distanceInput, { target: { value: "5.0" } });
        const scaledFar = Number(scaleSlider.value);
        expect(scaledFar).toBeLessThan(scaledHigh);

        fireEvent.click(screen.getByRole("button", { name: "サイズを合わせる" }));
        expect(Number(scaleSlider.value)).toBe(scaledFar);
    });

    it("AR空間トラッキングの映像追従トグル(映像追従ON/OFF)を切り替えられること", () => {
        render(() => <ArCameraOverlay />);
        fireEvent.click(screen.getByRole("button", { name: "影・配置調整" }));

        const trackingBtn = screen.getByRole("button", { name: "映像追従ON" });
        expect(trackingBtn).toBeInTheDocument();
        fireEvent.click(trackingBtn);
        expect(screen.getByRole("button", { name: "映像追従OFF" })).toBeInTheDocument();
    });

    it("前後合成マスクペイント後にジャイロ画角が変化してもエラーなく追従し、マスク消去できること", async () => {
        const { container } = render(() => <ArCameraOverlay />);
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
            left: 0,
            top: 0,
            width: 320,
            height: 480,
            right: 320,
            bottom: 480,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });

        fireEvent.click(screen.getByRole("button", { name: "奥に配置" }));
        fireEvent.pointerDown(canvas, { clientX: 160, clientY: 240, pointerId: 1 });
        fireEvent.pointerMove(canvas, { clientX: 180, clientY: 250, pointerId: 1 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });

        // ジャイロによる画角変化をシミュレート
        const ev1 = new Event("deviceorientation") as DeviceOrientationEvent;
        Object.defineProperty(ev1, "alpha", { value: 10 });
        Object.defineProperty(ev1, "beta", { value: 80 });
        Object.defineProperty(ev1, "gamma", { value: 0 });
        window.dispatchEvent(ev1);

        const ev2 = new Event("deviceorientation") as DeviceOrientationEvent;
        Object.defineProperty(ev2, "alpha", { value: 25 });
        Object.defineProperty(ev2, "beta", { value: 78 });
        Object.defineProperty(ev2, "gamma", { value: 2 });
        window.dispatchEvent(ev2);

        fireEvent.click(screen.getByRole("button", { name: "マスク消去" }));
        expect(screen.getByRole("button", { name: "完了" })).toBeInTheDocument();
    });
});
