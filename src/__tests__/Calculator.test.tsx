import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import Calculator from "../pages/Calculator";

describe("Calculator", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("初期状態でディスプレイに '0' が表示されていること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;
        expect(display.value).toBe("0");
    });

    it("数字ボタンをクリックするとディスプレイに入力されること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;

        const btn7 = screen.getByRole("button", { name: "7" });
        const btn8 = screen.getByRole("button", { name: "8" });
        fireEvent.click(btn7);
        fireEvent.click(btn8);

        expect(display.value).toBe("78");
    });

    it("四則演算（足し算）が正常に計算されること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;

        fireEvent.click(screen.getByRole("button", { name: "7" }));
        fireEvent.click(screen.getByRole("button", { name: "+" }));
        fireEvent.click(screen.getByRole("button", { name: "8" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));

        expect(display.value).toBe("15");
    });

    it("クリアボタンでディスプレイが '0' にリセットされること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;

        fireEvent.click(screen.getByRole("button", { name: "9" }));
        expect(display.value).toBe("9");

        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        expect(display.value).toBe("0");
    });

    it("計算結果が履歴に追加され、履歴クリックで値を再読込できること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;

        fireEvent.click(screen.getByRole("button", { name: "4" }));
        fireEvent.click(screen.getByRole("button", { name: "×" }));
        fireEvent.click(screen.getByRole("button", { name: "5" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));

        expect(display.value).toBe("20");

        // 履歴リストの存在確認
        const historyItem = screen.getByText("4×5 = 20");
        expect(historyItem).toBeInTheDocument();

        // ディスプレイを一度クリア
        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        expect(display.value).toBe("0");

        // 履歴をクリックすると式が再読込される
        fireEvent.click(historyItem);
        expect(display.value).toBe("4×5");
    });
});
