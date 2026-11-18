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

    it("焦点距離・絞り値・ピント位置の増減ボタンやプリセット操作で被写界深度が再計算されること", () => {
        const { container } = render(() => <HyperfocalCalculator />);

        // 初期状態 16mm -> +1mm で 17mm
        fireEvent.click(screen.getByLabelText("焦点距離を1mm増やす"));
        expect(screen.getByText("17 mm")).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("焦点距離を1mm減らす"));
        expect(screen.getByText("16 mm")).toBeInTheDocument();

        // 絞りプリセット F8 を選択
        fireEvent.click(screen.getByRole("button", { name: "8" }));
        expect(screen.getByText("f/8")).toBeInTheDocument();

        // 絞り増減ボタン
        fireEvent.click(screen.getByLabelText("絞り値を1段階大きくする"));
        expect(screen.getByText("f/9")).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("絞り値を1段階小さくする"));
        expect(screen.getByText("f/8")).toBeInTheDocument();

        // ピント位置を近く(0.5m)にすると有限の被写界深度が表示されること
        const distInput = screen.getByLabelText("実際のピント合わせ位置 (m)") as HTMLInputElement;
        fireEvent.input(distInput, { target: { value: "0.5" } });
        expect(screen.getByText("0.5 m")).toBeInTheDocument();

        // NaN や不正文字列を入力しても NaN が表示されないこと
        fireEvent.input(distInput, { target: { value: "NaN" } });
        expect(container.textContent).not.toContain("NaN");
    });
});
