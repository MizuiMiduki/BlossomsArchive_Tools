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
        expect(screen.getByRole("button", { name: "ドライブ・ファイル" })).toBeInTheDocument();
        expect(
            screen.getByLabelText("ドライブやファイルアプリから透過画像を選択"),
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
});
