import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import HeadphoneDriveability from "../pages/HeadphoneDriveability";

describe("HeadphoneDriveability", () => {
    it("初期状態で入力項目と計算結果が表示されること", () => {
        render(() => <HeadphoneDriveability />);
        expect(screen.getByText("イヤホン・ヘッドホンの鳴らしやすさ")).toBeInTheDocument();
        expect(screen.getByText("インピーダンス (Ω)")).toBeInTheDocument();
        expect(screen.getByText("鳴らしやすさスコア")).toBeInTheDocument();
        expect(screen.getByText("必要電圧")).toBeInTheDocument();
        expect(screen.getByText("必要電力")).toBeInTheDocument();
    });

    it("インピーダンスや感度を変更すると再計算されること", () => {
        const { container } = render(() => <HeadphoneDriveability />);
        const impedanceInput = container.querySelector('input[type="number"]') as HTMLInputElement;
        expect(impedanceInput).not.toBeNull();

        fireEvent.input(impedanceInput, { target: { value: "300" } });
        expect(impedanceInput.value).toBe("300");

        // 必要出力（電圧・電力）が表示されていること
        expect(screen.getByText("1.732 Vrms")).toBeInTheDocument();
        expect(screen.getByText("10.00 mW")).toBeInTheDocument();
    });

    it("感度単位（dB/mW と dB/Vrms）および公差（±%）を変更すると範囲表示とスコアが更新されること", () => {
        render(() => <HeadphoneDriveability />);

        const unitSelect = screen.getByLabelText("感度の単位") as HTMLSelectElement;
        fireEvent.change(unitSelect, { target: { value: "v" } });
        expect(unitSelect.value).toBe("v");
        expect(screen.getByText(/感度 \(dB\/Vrms\)/)).toBeInTheDocument();

        const toleranceInput = screen.getByLabelText("公差 (±%)") as HTMLInputElement;
        fireEvent.input(toleranceInput, { target: { value: "10" } });
        // 32Ω ±10% => 28.80–35.20 Ω
        expect(screen.getByText("28.80–35.20 Ω")).toBeInTheDocument();
    });

    it("無効な数値（0以下、空文字、上限超過）を入力した際にNaNを出さずエラー案内を表示すること", () => {
        const { container } = render(() => <HeadphoneDriveability />);
        const impedanceInput = screen.getByLabelText("インピーダンス (Ω)") as HTMLInputElement;

        fireEvent.input(impedanceInput, { target: { value: "0" } });
        expect(
            screen.getByText("正のインピーダンスと有効な数値を入力してください。"),
        ).toBeInTheDocument();
        expect(container.textContent).not.toContain("NaN");

        fireEvent.input(impedanceInput, { target: { value: "-16" } });
        expect(
            screen.getByText("正のインピーダンスと有効な数値を入力してください。"),
        ).toBeInTheDocument();

        // 正常値に戻して目標音圧を上限超過(150dB)にした場合
        fireEvent.input(impedanceInput, { target: { value: "32" } });
        const targetSplInput = screen.getByLabelText("目標ピーク音圧 (dB SPL)") as HTMLInputElement;
        fireEvent.input(targetSplInput, { target: { value: "150" } });
        expect(
            screen.getByText("正のインピーダンスと有効な数値を入力してください。"),
        ).toBeInTheDocument();
    });
});
