import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import TimelapseCalculator from "../pages/TimelapseCalculator";

describe("TimelapseCalculator Component", () => {
    it("初期描画で見出し、各種コントロール、初期計算結果が正しく表示されること", () => {
        render(() => <TimelapseCalculator />);

        expect(screen.getByText("タイムラプス撮影計算機")).toBeInTheDocument();
        expect(screen.getByText("動画の長さから逆算（おすすめ）")).toBeInTheDocument();
        expect(screen.getByText("実撮影時間から計算")).toBeInTheDocument();

        // 初期設定（15秒クリップ, 30fps, 3秒インターバル）
        // 総枚数 = 15 * 30 = 450枚
        // 撮影時間 = 450 * 3 = 1350秒 = 22分30秒
        expect(screen.getByText("450")).toBeInTheDocument();
        expect(screen.getByText(/22分 30秒/)).toBeInTheDocument();
    });

    it("動画の長さを変更すると総枚数と実撮影時間が再計算されること", () => {
        render(() => <TimelapseCalculator />);

        const clipSlider = screen.getByLabelText("作りたい動画の長さ（秒）");
        fireEvent.input(clipSlider, { target: { value: "30" } });

        // 30秒 * 30fps = 900枚
        // 900 * 3秒 = 2700秒 = 45分 0秒
        expect(screen.getByText("900")).toBeInTheDocument();
        expect(screen.getByText(/45分 0秒/)).toBeInTheDocument();
    });

    it("被写体別プリセットをクリックするとインターバルが切り替わること", () => {
        render(() => <TimelapseCalculator />);

        const starPreset = screen.getByText("星空・天の川");
        fireEvent.click(starPreset);

        // 星空は25秒間隔
        // 15秒 * 30fps = 450枚
        // 450 * 25秒 = 11250秒 = 3時間 7分 30秒
        expect(screen.getByText(/3時間 7分 30秒/)).toBeInTheDocument();
    });

    it("実撮影時間モードに切り替えて計算できること", () => {
        render(() => <TimelapseCalculator />);

        const modeBtn = screen.getByText("実撮影時間から計算");
        fireEvent.click(modeBtn);

        const hoursInput = screen.getByLabelText("撮影時間（時間）");
        fireEvent.input(hoursInput, { target: { value: "2" } });

        // 2時間 = 7200秒。3秒間隔なら 7200 / 3 = 2400枚
        // 30fpsなら 2400 / 30 = 80秒の動画
        expect(screen.getByText("2,400")).toBeInTheDocument();
        expect(screen.getByText(/80/)).toBeInTheDocument();
    });
});
