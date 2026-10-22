import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import BudouX from "../components/BudouX";
import { parseBudouX, applyBudouX } from "../utils/budoux";

describe("BudouX Utility & Component", () => {
    describe("parseBudouX", () => {
        it("日本語の文を適切に文節ごとの配列に分割すること", () => {
            const result = parseBudouX("今日はとてもいい天気ですね。");
            expect(result.length).toBeGreaterThan(1);
            expect(result.join("")).toBe("今日はとてもいい天気ですね。");
        });

        it("空文字列を渡した場合は空配列を返すこと", () => {
            expect(parseBudouX("")).toEqual([]);
        });
    });

    describe("applyBudouX", () => {
        it("DOM要素にword-breakとoverflow-wrapスタイルを適用しゼロ幅スペースを挿入すること", () => {
            const p = document.createElement("p");
            p.textContent = "明日のスケジュールを確認します。";
            applyBudouX(p);

            expect(p.style.wordBreak).toBe("keep-all");
            expect(p.style.overflowWrap).toBe("anywhere");
            // ゼロ幅スペース (U+200B) が含まれていること
            expect(p.textContent).toContain("\u200B");
        });
    });

    describe("<BudouX /> コンポーネント", () => {
        it("デフォルトで span 要素として文節ごとに <wbr> を挿入してレンダリングすること", () => {
            const { container } = render(() => (
                <BudouX text="自然な改行位置を提供します。" />
            ));

            const span = container.querySelector("span");
            expect(span).not.toBeNull();
            expect(span?.style.wordBreak).toBe("keep-all");
            expect(span?.style.overflowWrap).toBe("anywhere");

            const wbrElements = container.querySelectorAll("wbr");
            expect(wbrElements.length).toBeGreaterThan(0);
            expect(span?.textContent).toBe("自然な改行位置を提供します。");
        });

        it("as プロパティでタグ（pなど）を変更できること", () => {
            const { container } = render(() => (
                <BudouX as="p" class="custom-p" text="段落テキストの改行" />
            ));

            const p = container.querySelector("p");
            expect(p).not.toBeNull();
            expect(p?.className).toContain("custom-p");
            expect(p?.style.wordBreak).toBe("keep-all");
        });

        it("children として渡されたテキストもパースされること", () => {
            render(() => <BudouX as="h2">見出しの文節改行テスト</BudouX>);
            expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
            expect(screen.getByText("見出しの文節改行テスト")).toBeInTheDocument();
        });
    });
});
