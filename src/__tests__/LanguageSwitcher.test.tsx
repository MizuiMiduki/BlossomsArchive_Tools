import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { createRouter } from "@solidjs/router";
import LanguageSwitcher from "../components/LanguageSwitcher";

const Router = createRouter({
    routes: [
        { path: "/", component: () => <LanguageSwitcher /> },
        { path: "*", component: () => <LanguageSwitcher /> },
    ],
});

function renderWithRouter() {
    return render(() => <Router>{() => <LanguageSwitcher />}</Router>);
}

describe("LanguageSwitcher Component", () => {
    it("言語切替ボタンがアクセシブル名付きで描画されること", () => {
        renderWithRouter();
        const button = screen.getByRole("button", { name: "言語を変更" });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("aria-haspopup", "true");
        expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("ボタンクリックでドロップダウンが開き、全6言語のリンクが表示されること", async () => {
        renderWithRouter();
        const button = screen.getByRole("button", { name: "言語を変更" });

        fireEvent.click(button);
        expect(button).toHaveAttribute("aria-expanded", "true");

        // 6言語のリンクが存在すること
        expect(screen.getByRole("menuitem", { name: /日本語/ })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /English/ })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /한국어/ })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /简体中文/ })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /繁體中文/ })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Русский/ })).toBeInTheDocument();
    });

    it("ドロップダウンが開いている状態でEscキーを押すと閉じること", async () => {
        renderWithRouter();
        const button = screen.getByRole("button", { name: "言語を変更" });

        fireEvent.click(button);
        expect(screen.getByRole("menuitem", { name: /English/ })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("menuitem", { name: /English/ })).not.toBeInTheDocument();
    });
});
