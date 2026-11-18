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

    it("複数同時選定・結果コピー・シェア・履歴クリアが正常に動作すること", () => {
        render(() => <Lottery />);
        const textarea = screen.getByPlaceholderText(/項目 A/) as HTMLTextAreaElement;

        fireEvent.input(textarea, {
            target: { value: "候補1\n候補2\n候補3\n候補4\n候補5" },
        });

        const countSelect = screen.getByLabelText("同時選定数") as HTMLSelectElement;
        fireEvent.change(countSelect, { target: { value: "3" } });

        fireEvent.click(screen.getByRole("button", { name: "抽選を実行" }));

        // 結果コピーと共有ボタン
        const copyBtn = screen.getByRole("button", { name: /クリップボードにコピー/ });
        fireEvent.click(copyBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();

        const shareBtn = screen.getByRole("button", { name: /共有 \/ 出力/ });
        fireEvent.click(shareBtn);

        // 履歴クリア
        const clearHistoryBtn = screen.getByRole("button", { name: /ログを消去/ });
        fireEvent.click(clearHistoryBtn);
    });
});
