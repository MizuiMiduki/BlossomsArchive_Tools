import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Lottery from "../pages/Lottery";

describe("Lottery", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態で入力エリアと「抽選を実行」ボタンが表示されること", () => {
        render(() => <Lottery />);
        expect(screen.getByText("抽選・ランダム選定ツール")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "抽選を実行" })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/項目 A/)).toBeInTheDocument();
    });

    it("テキストエリアが空の状態で抽選を実行すると注意文が表示されること", () => {
        render(() => <Lottery />);
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("抽選対象を入力してください")).toBeInTheDocument();
    });

    it("リストを入力して抽選を実行すると当選結果が表示されること", () => {
        render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "りんご\nみかん\nバナナ" } });
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("選定結果")).toBeInTheDocument();
        expect(screen.getByText("実行ログ")).toBeInTheDocument();

        // りんご、みかん、バナナのいずれかが当選
        const isOneOfItems = ["りんご", "みかん", "バナナ"].some((fruit) =>
            screen.queryAllByText(fruit).length > 0,
        );
        expect(isOneOfItems).toBe(true);
    });

    it("「クリア」ボタンで入力と結果がリセットされること", () => {
        render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "A\nB\nC" } });
        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        expect(screen.getByText("選定結果")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        expect(textarea.value).toBe("");
        expect(screen.queryByText("選定結果")).not.toBeInTheDocument();
    });

    it("「当選時にリストから除外」が有効な場合、当選項目がテキストエリアから削除されること", () => {
        const { container } = render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "項目1\n項目2" } });

        // 除外チェックボックスをONにする
        const checkbox = container.querySelector("input.checkbox-primary") as HTMLInputElement;
        expect(checkbox).not.toBeNull();
        fireEvent.click(checkbox);

        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        // 1件引かれたので残りは1行
        const remainingItems = textarea.value.trim().split("\n");
        expect(remainingItems.length).toBe(1);
    });
});
