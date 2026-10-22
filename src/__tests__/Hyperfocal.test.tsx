import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import HyperfocalCalculator from "../pages/Hyperfocal";

describe("HyperfocalCalculator", () => {
    it("初期状態で設定パネルと計算結果が表示されること", () => {
        render(() => <HyperfocalCalculator />);
        expect(screen.getByText(/過焦点距離（パンフォーカス）計算ツール/)).toBeInTheDocument();
        expect(screen.getByText(/1\. カメラのセンサーサイズを選ぶ/)).toBeInTheDocument();

        // 過焦点距離のラベルまたは計算結果
        expect(screen.getByText(/一番お勧めのピント位置（過焦点距離）/)).toBeInTheDocument();
    });

    it("センサーサイズを切り替えられること", () => {
        render(() => <HyperfocalCalculator />);
        const sensorSelect = screen.getByDisplayValue(/APS-C \(Sony/) as HTMLSelectElement;

        fireEvent.change(sensorSelect, { target: { value: "fullframe" } });
        expect(sensorSelect.value).toBe("fullframe");
    });

    it("カスタムセンサーを選択するとCoC入力欄が表示されること", () => {
        render(() => <HyperfocalCalculator />);
        const sensorSelect = screen.getByDisplayValue(/APS-C/) as HTMLSelectElement;

        fireEvent.change(sensorSelect, { target: { value: "custom" } });
        expect(screen.getByText("⚙️ 許容錯乱円の直径 (CoC)")).toBeInTheDocument();
    });
});
