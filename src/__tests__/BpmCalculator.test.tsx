import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import BpmCalculator from "../pages/BpmCalculator";

describe("BpmCalculator Component", () => {
    it("初期描画でBPM 120のディレイタイム（4分音符 = 500ms）が表示されること", () => {
        render(() => <BpmCalculator />);

        expect(screen.getByText("BPM・ディレイタイム換算機")).toBeInTheDocument();

        // BPM 120 では 4分音符は 60000 / 120 = 500ms
        expect(screen.getByText("500 ms")).toBeInTheDocument();
        // 8分音符は 250ms
        expect(screen.getByText("250 ms")).toBeInTheDocument();
        // 全音符は 2000ms
        expect(screen.getByText("2,000 ms")).toBeInTheDocument();
    });

    it("BPMを変更すると各音符のディレイタイムが再計算されること", () => {
        render(() => <BpmCalculator />);

        const bpmInput = screen.getByLabelText("テンポ (BPM)");
        fireEvent.input(bpmInput, { target: { value: "60" } });

        // BPM 60 では 4分音符は 60000 / 60 = 1000ms
        expect(screen.getByText("1,000 ms")).toBeInTheDocument();
        expect(screen.getByText("500 ms")).toBeInTheDocument();
    });

    it("定番テンポプリセットをクリックするとBPMが更新されること", () => {
        render(() => <BpmCalculator />);

        const preset140 = screen.getByRole("button", { name: "140" });
        fireEvent.click(preset140);

        const bpmInput = screen.getByLabelText("テンポ (BPM)") as HTMLInputElement;
        expect(bpmInput.value).toBe("140");
    });

    it("タップボタンをクリックしてタップ計測が動作すること", () => {
        render(() => <BpmCalculator />);

        const tapBtn = screen.getByRole("button", { name: "リズムに合わせてタップ" });
        fireEvent.click(tapBtn);
        expect(screen.getByText(/リズムに合わせて続けてタップ/)).toBeInTheDocument();
    });
});
