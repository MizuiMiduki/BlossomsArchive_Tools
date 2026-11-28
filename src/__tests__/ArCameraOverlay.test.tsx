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

    it("renders main heading, mode switchers, and camera controls", () => {
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
    });

    it("switches between AR mode and fixed overlay mode", () => {
        render(() => <ArCameraOverlay />);

        const fixedBtn = screen.getByRole("button", { name: "自由固定モード" });
        const arBtn = screen.getByRole("button", { name: "AR空間モード（リアル影）" });

        expect(screen.getByText("3. ARリアル影・空間リアリティ設定")).toBeInTheDocument();

        fireEvent.click(fixedBtn);
        expect(fixedBtn).toHaveAttribute("aria-pressed", "true");
        expect(arBtn).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByText("3. ARリアル影・空間リアリティ設定")).not.toBeInTheDocument();

        fireEvent.click(arBtn);
        expect(arBtn).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("3. ARリアル影・空間リアリティ設定")).toBeInTheDocument();
    });

    it("handles position lock toggle and range slider clamping", () => {
        render(() => <ArCameraOverlay />);

        const posXSlider = screen.getByLabelText(/横位置 \(X\)/) as HTMLInputElement;
        expect(posXSlider.disabled).toBe(false);

        fireEvent.input(posXSlider, { target: { value: "75" } });
        expect(screen.getByText("75.0%")).toBeInTheDocument();

        const lockToggle = screen.getByLabelText("位置ロック") as HTMLInputElement;
        fireEvent.click(lockToggle);
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
