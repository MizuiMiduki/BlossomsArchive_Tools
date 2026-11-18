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

    it("引き算・割り算・小数計算の丸め誤差補正（0.1 + 0.2 = 0.3）が正しく計算されること", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;

        // 0.1 + 0.2 = 0.3
        fireEvent.click(screen.getByRole("button", { name: "0" }));
        fireEvent.click(screen.getByRole("button", { name: "." }));
        fireEvent.click(screen.getByRole("button", { name: "1" }));
        fireEvent.click(screen.getByRole("button", { name: "+" }));
        fireEvent.click(screen.getByRole("button", { name: "0" }));
        fireEvent.click(screen.getByRole("button", { name: "." }));
        fireEvent.click(screen.getByRole("button", { name: "2" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("0.3");

        // 引き算と割り算: (9 - 3) -> 6 ÷ 2 = 3
        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        fireEvent.click(screen.getByRole("button", { name: "9" }));
        fireEvent.click(screen.getByRole("button", { name: "-" }));
        fireEvent.click(screen.getByRole("button", { name: "3" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("6");

        fireEvent.click(screen.getByRole("button", { name: "÷" }));
        fireEvent.click(screen.getByRole("button", { name: "2" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("3");
    });

    it("ゼロ除算や不正な構文に対して Error を表示しクラッシュしないこと", () => {
        render(() => <Calculator />);
        const display = screen.getByRole("textbox") as HTMLInputElement;

        // 8 ÷ 0 = Error
        fireEvent.click(screen.getByRole("button", { name: "8" }));
        fireEvent.click(screen.getByRole("button", { name: "÷" }));
        fireEvent.click(screen.getByRole("button", { name: "0" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("Error");

        // クリアして不正な連続演算子 5 × ÷ = Error
        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        fireEvent.click(screen.getByRole("button", { name: "5" }));
        fireEvent.click(screen.getByRole("button", { name: "×" }));
        fireEvent.click(screen.getByRole("button", { name: "÷" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("Error");
    });
});
