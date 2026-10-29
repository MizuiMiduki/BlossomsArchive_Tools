import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TextConverter from "../pages/TextConverter";

describe("TextConverter", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("初期状態でタイトルやモードボタン、エディターが表示されていること", () => {
        render(() => <TextConverter />);
        expect(screen.getByText("テキスト・HTML・Markdown変換ツール")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /HTML → Markdown/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Markdown → HTML/ })).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/変換したいテキストまたはHTML/)).toBeInTheDocument();
    });

    it("入力テキストを変更すると自動でMarkdownに変換されること", () => {
        render(() => <TextConverter />);
        const textarea = screen.getByPlaceholderText(/変換したいテキストまたはHTML/) as HTMLTextAreaElement;

        fireEvent.input(textarea, { target: { value: "<h1>見出しテスト</h1>" } });

        const outputTextarea = screen.getByPlaceholderText(/変換されたテキストがここに表示されます/) as HTMLTextAreaElement;
        expect(outputTextarea.value).toContain("# 見出しテスト");
    });

    it("モードを「Markdown → HTML」に切り替えるとHTMLに変換されること", () => {
        render(() => <TextConverter />);
        const mdToHtmlBtn = screen.getByRole("button", { name: /Markdown → HTML/ });
        fireEvent.click(mdToHtmlBtn);

        const textarea = screen.getByPlaceholderText(/変換したいテキストまたはHTML/) as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "# テスト見出し\n\n**太字**" } });

        const outputTextarea = screen.getByPlaceholderText(/変換されたテキストがここに表示されます/) as HTMLTextAreaElement;
        expect(outputTextarea.value).toContain("<h1>テスト見出し</h1>");
        expect(outputTextarea.value).toContain("<strong>太字</strong>");
    });

    it("「HTML → プレーンテキスト」モードでタグが除去されること", () => {
        render(() => <TextConverter />);
        const htmlToPlainBtn = screen.getByRole("button", { name: /HTML → プレーンテキスト/ });
        fireEvent.click(htmlToPlainBtn);

        const textarea = screen.getByPlaceholderText(/変換したいテキストまたはHTML/) as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "<p>こんにちは <strong>世界</strong></p>" } });

        const outputTextarea = screen.getByPlaceholderText(/変換されたテキストがここに表示されます/) as HTMLTextAreaElement;
        expect(outputTextarea.value).toBe("こんにちは 世界");
    });

    it("クリアボタンをクリックすると入力と出力が空になること", () => {
        render(() => <TextConverter />);
        const clearBtn = screen.getByRole("button", { name: "入力をクリア" });
        fireEvent.click(clearBtn);

        const textarea = screen.getByPlaceholderText(/変換したいテキストまたはHTML/) as HTMLTextAreaElement;
        const outputTextarea = screen.getByPlaceholderText(/変換されたテキストがここに表示されます/) as HTMLTextAreaElement;
        expect(textarea.value).toBe("");
        expect(outputTextarea.value).toBe("");
    });

    it("コピーボタンをクリックするとクリップボードにコピーされること", async () => {
        render(() => <TextConverter />);
        const textarea = screen.getByPlaceholderText(/変換したいテキストまたはHTML/) as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "<p>コピー用テスト</p>" } });

        const copyBtn = screen.getByRole("button", { name: /コピー/ });
        fireEvent.click(copyBtn);

        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it("「逆変換に切り替え (⇄)」ボタンで入力と出力がスワップされること", () => {
        render(() => <TextConverter />);
        const textarea = screen.getByPlaceholderText(/変換したいテキストまたはHTML/) as HTMLTextAreaElement;
        fireEvent.input(textarea, { target: { value: "<h2>入れ替え</h2>" } });

        const swapBtn = screen.getByRole("button", { name: /逆変換に切り替え/ });
        fireEvent.click(swapBtn);

        // スワップ後は Markdown → HTML モードになり、入力値に以前の出力値が入る
        expect(textarea.value).toContain("## 入れ替え");
    });
});
