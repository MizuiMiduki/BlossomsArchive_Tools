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
});
