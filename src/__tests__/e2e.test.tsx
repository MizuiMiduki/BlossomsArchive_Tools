import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, memoryHistory } from "@solidjs/router";
import Layout from "../components/Layout";
import Home from "../pages/Home";
import Calculator from "../pages/Calculator";
import PasswordGenerator from "../pages/PasswordGenerator";
import Lottery from "../pages/Lottery";
import CharsetConverter from "../pages/CharsetConverter";
import TextConverter from "../pages/TextConverter";
import SeoChecker from "../pages/SeoChecker";
import OgpChecker from "../pages/OgpChecker";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import Credits from "../pages/Credits";
import TimerStopwatch from "../pages/TimerStopwatch";
import Clock from "../pages/Clock";
import NotFound from "../pages/NotFound";

function createFullE2ERouter() {
    return createRouter({
        history: memoryHistory(),
        routes: [
            { path: "/", component: Home },
            { path: "/calculator", component: Calculator },
            { path: "/password-generator", component: PasswordGenerator },
            { path: "/lottery", component: Lottery },
            { path: "/charset-converter", component: CharsetConverter },
            { path: "/text-converter", component: TextConverter },
            { path: "/seo-checker", component: SeoChecker },
            { path: "/ogp-checker", component: OgpChecker },
            { path: "/timer", component: TimerStopwatch },
            { path: "/clock", component: Clock },
            { path: "/privacy", component: PrivacyPolicy },
            { path: "/credits", component: Credits },
            { path: "*404", component: NotFound },
        ],
    });
}

describe("E2E User Journey Tests (End-to-End Application Workflows)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.scrollTo = vi.fn();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it("Journey 1: ホーム画面からツールカード経由で電卓へ移動して計算・履歴再利用を行い、さらにサイドバーからパスワード生成へ遷移して生成・コピーを完了できること", async () => {
        const AppRouter = createFullE2ERouter();
        render(() => (
            <AppRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppRouter>
        ));

        // 1. ホーム画面の電卓カードをクリックして遷移
        expect(screen.getAllByText("電卓ツール").length).toBeGreaterThan(0);
        const calcLinks = screen
            .getAllByRole("link")
            .filter((a) => a.getAttribute("href") === "/calculator");
        expect(calcLinks.length).toBeGreaterThan(0);
        fireEvent.click(calcLinks[0]);

        // 2. 電卓で 12 × 3 = 36 を計算
        const display = (await screen.findByRole(
            "textbox",
        )) as HTMLInputElement;
        fireEvent.click(screen.getByRole("button", { name: "1" }));
        fireEvent.click(screen.getByRole("button", { name: "2" }));
        fireEvent.click(screen.getByRole("button", { name: "×" }));
        fireEvent.click(screen.getByRole("button", { name: "3" }));
        fireEvent.click(screen.getByRole("button", { name: "=" }));
        expect(display.value).toBe("36");

        // 履歴再利用
        fireEvent.click(screen.getByRole("button", { name: "クリア" }));
        expect(display.value).toBe("0");
        fireEvent.click(screen.getByText("12×3 = 36"));
        expect(display.value).toBe("12×3");

        // 3. サイドバーからパスワード生成ツールへ移動
        const pwLinks = screen
            .getAllByRole("link")
            .filter((a) => a.getAttribute("href") === "/password-generator");
        fireEvent.click(pwLinks[0]);

        expect(
            await screen.findByText("パスワード生成ツール"),
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "パスワードを自動生成" }),
        );
        const copyBtns = await screen.findAllByRole("button", {
            name: "コピー",
        });
        expect(copyBtns.length).toBe(5);
        fireEvent.click(copyBtns[0]);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it("Journey 2: テキスト変換ツールでMarkdown→HTML変換とHTML→プレーンテキスト変換を行い、続いてSEOチェッカーでHTML直接解析とレポートコピーを完了できること", async () => {
        const AppRouter = createFullE2ERouter();
        render(() => (
            <AppRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppRouter>
        ));

        // 1. サイドバーからテキスト・マークアップ変換へ移動
        const textConvLinks = screen
            .getAllByRole("link")
            .filter((a) => a.getAttribute("href") === "/text-converter");
        fireEvent.click(textConvLinks[0]);

        const mdToHtmlBtn = await screen.findByRole("button", {
            name: /Markdown → HTML/,
        });
        fireEvent.click(mdToHtmlBtn);

        const inputArea = screen.getByPlaceholderText(
            /変換したいテキスト/,
        ) as HTMLTextAreaElement;
        fireEvent.input(inputArea, {
            target: { value: "# E2E見出し\n\nこれは**太字**のテストです。" },
        });

        const outputArea = screen.getByPlaceholderText(
            /変換されたテキストがここに表示されます/,
        ) as HTMLTextAreaElement;
        expect(outputArea.value).toContain("<h1>E2E見出し</h1>");
        expect(outputArea.value).toContain("<strong>太字</strong>");

        // 2. サイドバーからメタタグ(SEO)確認へ移動
        const seoLinks = screen
            .getAllByRole("link")
            .filter((a) => a.getAttribute("href") === "/seo-checker");
        fireEvent.click(seoLinks[0]);

        expect(
            await screen.findByText("メタタグ(SEO)確認ツール"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByText("サンプルで試す"));
        expect(
            await screen.findByText("Google検索結果プレビュー (SERP Preview)"),
        ).toBeInTheDocument();

        const copyReportBtn = screen.getByText("SEO診断レポートを全コピー");
        fireEvent.click(copyReportBtn);
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it("Journey 3: テーマ切替（ダーク/ライト）、フッターからプライバシーポリシー・使用ライブラリへの遷移が正常に完了すること", async () => {
        const AppRouter = createFullE2ERouter();
        render(() => (
            <AppRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppRouter>
        ));

        // テーマトグル操作
        const themeToggle = screen.getByRole("button", {
            name: "Toggle Dark Mode",
        });
        fireEvent.click(themeToggle);
        expect(
            ["dark", "light"].includes(
                document.documentElement.getAttribute("data-theme") || "",
            ),
        ).toBe(true);

        // フッターからプライバシーポリシーへ遷移
        const privacyLinks = screen
            .getAllByRole("link")
            .filter((a) => a.getAttribute("href") === "/privacy");
        fireEvent.click(privacyLinks[0]);
        expect(
            await screen.findByText(/広告配信とアクセス解析ツールについて/),
        ).toBeInTheDocument();

        // フッターから使用ライブラリへ遷移
        const creditsLinks = screen
            .getAllByRole("link")
            .filter((a) => a.getAttribute("href") === "/credits");
        fireEvent.click(creditsLinks[0]);
        expect(await screen.findByText("Solid.js")).toBeInTheDocument();
    });

    it("Journey 4: 検索機能（かな正規化対応）と画面遷移、アナログ時計（目盛り・数字表示）の一連のワークフローが正常に動作すること", async () => {
        const AppRouter = createFullE2ERouter();
        render(() => (
            <AppRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppRouter>
        ));

        // 1. ホーム画面で "たいまー" (ひらがな) を検索
        const homeSearch = screen.getByPlaceholderText(/ツール名やキーワードで検索/i);
        fireEvent.input(homeSearch, { target: { value: "たいまー" } });

        // タイマーカードが表示され、電卓カードの見出しは非表示になる
        expect(screen.getAllByText("タイマー・ストップウォッチ").length).toBeGreaterThan(0);
        expect(screen.queryByRole("heading", { name: "電卓ツール" })).toBeNull();

        // タイマーカードをクリックして遷移
        const timerLink = screen
            .getAllByRole("link")
            .find((a) => a.getAttribute("href") === "/timer");
        expect(timerLink).toBeDefined();
        if (timerLink) fireEvent.click(timerLink);

        // タイマー画面の要素確認（「スタート」ボタン等）
        expect(await screen.findByRole("button", { name: "スタート" })).toBeInTheDocument();

        // 2. サイドバーの検索バーで "あなろぐ" (ひらがな) を検索してアナログ時計へ遷移
        const sidebarSearch = screen.getByPlaceholderText("メニューを検索...") as HTMLInputElement;
        fireEvent.input(sidebarSearch, { target: { value: "あなろぐ" } });

        const clockLink = screen
            .getAllByRole("link")
            .find((a) => a.getAttribute("href") === "/clock");
        expect(clockLink).toBeDefined();
        if (clockLink) fireEvent.click(clockLink);

        // 時計画面へ遷移したことを確認
        expect(await screen.findByText("リアルタイム時計")).toBeInTheDocument();
        const analogBtn = screen.getByRole("button", { name: "アナログ" });
        expect(analogBtn).toBeInTheDocument();

        // アナログ時計モードに切り替え
        fireEvent.click(analogBtn);

        // 文字盤SVGの数字（1〜12）が正しく描画されていること
        const hourTexts = document.querySelectorAll("svg text");
        expect(hourTexts.length).toBe(12);
        expect(Array.from(hourTexts).map((t) => t.textContent)).toContain("12");

        // ページ遷移によりサイドバー検索入力が自動リセットされていること
        expect(sidebarSearch.value).toBe("");
    });
});
