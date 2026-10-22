import { render, fireEvent, screen } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ThemeToggle from "../components/ThemeToggle";

describe("ThemeToggle", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        document.documentElement.removeAttribute("data-theme");
    });

    it("初期レンダリングでテーマ切り替えボタンが表示されること", () => {
        render(() => <ThemeToggle />);
        const btn = screen.getByRole("button", { name: "Toggle Dark Mode" });
        expect(btn).toBeInTheDocument();
    });

    it("ボタンをクリックするとテーマが切り替わり、localStorageとdata-theme属性が更新されること", () => {
        render(() => <ThemeToggle />);
        const btn = screen.getByRole("button", { name: "Toggle Dark Mode" });

        // 初期がlightの場合、クリックでdarkに
        fireEvent.click(btn);
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
        expect(localStorage.getItem("theme")).toBe("dark");
        expect(btn.textContent).toContain("☀️");

        // もう一度クリックでlightに
        fireEvent.click(btn);
        expect(document.documentElement.getAttribute("data-theme")).toBe("light");
        expect(localStorage.getItem("theme")).toBe("light");
        expect(btn.textContent).toContain("🌙");
    });
});
