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
});
