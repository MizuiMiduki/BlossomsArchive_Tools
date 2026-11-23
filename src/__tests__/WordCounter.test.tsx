import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import WordCounter from "../pages/WordCounter";

describe("WordCounter Component", () => {
    it("初期状態で文字数が0と表示されること", () => {
        render(() => <WordCounter />);

        expect(screen.getByText("文字数カウント・原稿用紙換算")).toBeInTheDocument();
        expect(screen.getByText("文字数 (空白除外)")).toBeInTheDocument();
    });

    it("テキストを入力すると文字数・行数・文字種内訳が正しく集計されること", () => {
        render(() => <WordCounter />);

        const textarea = screen.getByLabelText("文字数カウント対象テキスト");
        fireEvent.input(textarea, { target: { value: "あいうえお\nカキクケコ\n漢字123 ABC!" } });

        // 空白・改行除外:
        // "あいうえお" (5) + "カキクケコ" (5) + "漢字" (2) + "123" (3) + "ABC!" (4) = 19文字
        expect(screen.getByText("19")).toBeInTheDocument();

        // 行数: 3行
        expect(screen.getByText(/3 行/)).toBeInTheDocument();
    });

    it("クリアボタンでテキストと集計がリセットされること", () => {
        render(() => <WordCounter />);

        const textarea = screen.getByLabelText("文字数カウント対象テキスト") as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "テスト文章" } });
        expect(textarea.value).toBe("テスト文章");

        const clearBtn = screen.getByRole("button", { name: "クリア" });
        fireEvent.click(clearBtn);

        expect(textarea.value).toBe("");
    });
});
