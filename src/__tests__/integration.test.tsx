import fs from "node:fs";
import path from "node:path";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouter, memoryHistory, useNavigate } from "@solidjs/router";
import Layout from "../components/Layout";
import Home from "../pages/Home";
import Calculator from "../pages/Calculator";
import SeoChecker from "../pages/SeoChecker";
import TextConverter from "../pages/TextConverter";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import Credits from "../pages/Credits";
import NotFound from "../pages/NotFound";
import { routes, getPageMetadata, getPageJsonLd, SITE_URL } from "../routes";

describe("Integration Tests (Router + Layout + Metadata + Discovery Files)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        window.scrollTo = vi.fn();
    });

    it("Layout と Router の結合時にルート遷移で document.title・meta・canonical・JSON-LD・SNS共有URLが連動更新されること", async () => {
        function NavControls() {
            const navigate = useNavigate();
            return (
                <div data-testid="test-nav">
                    <button onClick={() => navigate("/calculator")}>
                        GoCalculator
                    </button>
                    <button onClick={() => navigate("/seo-checker")}>
                        GoSeoChecker
                    </button>
                    <button onClick={() => navigate("/text-converter")}>
                        GoTextConverter
                    </button>
                    <button onClick={() => navigate("/privacy")}>
                        GoPrivacy
                    </button>
                    <button onClick={() => navigate("/non-existent-path")}>
                        Go404
                    </button>
                </div>
            );
        }

        const AppRouter = createRouter({
            history: memoryHistory(),
            routes: [
                {
                    path: "/",
                    component: () => (
                        <>
                            <NavControls />
                            <Home />
                        </>
                    ),
                },
                {
                    path: "/calculator",
                    component: () => (
                        <>
                            <NavControls />
                            <Calculator />
                        </>
                    ),
                },
                {
                    path: "/seo-checker",
                    component: () => (
                        <>
                            <NavControls />
                            <SeoChecker />
                        </>
                    ),
                },
                {
                    path: "/text-converter",
                    component: () => (
                        <>
                            <NavControls />
                            <TextConverter />
                        </>
                    ),
                },
                {
                    path: "/privacy",
                    component: () => (
                        <>
                            <NavControls />
                            <PrivacyPolicy />
                        </>
                    ),
                },
                {
                    path: "/credits",
                    component: () => (
                        <>
                            <NavControls />
                            <Credits />
                        </>
                    ),
                },
                {
                    path: "*404",
                    component: () => (
                        <>
                            <NavControls />
                            <NotFound />
                        </>
                    ),
                },
            ],
        });

        render(() => (
            <AppRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppRouter>
        ));

        // 1. 初期ルート ("/") の確認
        await Promise.resolve();
        const homeMeta = getPageMetadata("/");
        expect(document.title).toBe(homeMeta.title);
        expect(
            document
                .querySelector('link[rel="canonical"]')
                ?.getAttribute("href"),
        ).toBe(`${SITE_URL}/`);

        // 2. "/calculator" への遷移とメタタグ・SNS共有URLの連動確認
        fireEvent.click(screen.getByText("GoCalculator"));
        expect(await screen.findByRole("textbox")).toBeInTheDocument();

        const calcMeta = getPageMetadata("/calculator");
        expect(document.title).toBe(calcMeta.title);
        expect(
            document
                .querySelector('meta[name="description"]')
                ?.getAttribute("content"),
        ).toBe(calcMeta.description);
        expect(
            document
                .querySelector('link[rel="canonical"]')
                ?.getAttribute("href"),
        ).toBe(`${SITE_URL}/calculator`);

        const jsonLdEl = document.getElementById("ba-tools-global-jsonld");
        expect(jsonLdEl?.textContent).toContain("/calculator");

        const xShareLink = screen.getByRole("link", { name: "X" });
        expect(xShareLink.getAttribute("href")).toContain(
            encodeURIComponent("/calculator"),
        );

        // 3. "/seo-checker" への遷移確認
        fireEvent.click(screen.getByText("GoSeoChecker"));
        expect(
            await screen.findByText("メタタグ(SEO)確認ツール"),
        ).toBeInTheDocument();
        expect(document.title).toBe(getPageMetadata("/seo-checker").title);

        // 4. 存在しないルートへの遷移で 404 NotFound が表示され、「ホームに戻る」で "/" に戻れること
        fireEvent.click(screen.getByText("Go404"));
        expect(await screen.findByText("404")).toBeInTheDocument();

        const backHomeLink = screen.getByRole("link", { name: "ホームに戻る" });
        fireEvent.click(backHomeLink);
        expect(
            (await screen.findAllByText("電卓ツール")).length,
        ).toBeGreaterThan(0);
    });

    it("全ルートのメタデータ・JSON-LD・ard.json・llms.txt が整合していること", () => {
        const rootDir = path.resolve(process.cwd());
        const ardPath = path.join(rootDir, "public", ".well-known", "ard.json");
        const llmsPath = path.join(rootDir, "public", "llms.txt");

        expect(fs.existsSync(ardPath)).toBe(true);
        expect(fs.existsSync(llmsPath)).toBe(true);

        const ardJson = JSON.parse(fs.readFileSync(ardPath, "utf8"));
        expect(ardJson).toBeTypeOf("object");
        expect(Array.isArray(ardJson.entries)).toBe(true);
        expect(ardJson.entries.length).toBeGreaterThan(0);

        const llmsText = fs.readFileSync(llmsPath, "utf8");
        expect(llmsText).toContain("BlossomsArchive Tools");

        for (const route of routes) {
            const meta = getPageMetadata(route.path);
            expect(meta.title.length).toBeGreaterThanOrEqual(15);
            expect(meta.description.length).toBeGreaterThanOrEqual(50);
            expect(meta.url.startsWith(SITE_URL)).toBe(true);

            const jsonLd = getPageJsonLd(route.path) as {
                "@context": string;
                "@graph": Array<Record<string, unknown>>;
            };
            expect(jsonLd["@context"]).toBe("https://schema.org");
            expect(Array.isArray(jsonLd["@graph"])).toBe(true);

            if (!route.hidden && route.path !== "/") {
                expect(llmsText).toContain(route.path);
            }
        }
    });

    it("サイドバー検索とルーティング遷移の結合: 検索フィルタリング・ページ遷移・検索欄自動リセット・アクティブリンク表示が連動すること", async () => {
        const AppRouter = createRouter({
            history: memoryHistory(),
            routes: [
                { path: "/", component: Home },
                { path: "/calculator", component: Calculator },
                { path: "/seo-checker", component: SeoChecker },
            ],
        });

        render(() => (
            <AppRouter>
                {(props) => <Layout>{props.children}</Layout>}
            </AppRouter>
        ));

        const sidebarSearchInput = screen.getByPlaceholderText("メニューを検索...") as HTMLInputElement;
        expect(sidebarSearchInput).toBeInTheDocument();

        // 1. "たいまー" (ひらがな) でサイドバー内を検索
        fireEvent.input(sidebarSearchInput, { target: { value: "たいまー" } });

        // タイマー・ストップウォッチリンク（keywords: "タイマー"）が表示されていること
        const timerLink = screen.getByRole("link", { name: "タイマー・ストップウォッチ" });
        expect(timerLink).toBeInTheDocument();

        // 電卓ツールリンクはサイドバーから除外されていること
        expect(screen.queryByRole("link", { name: "電卓ツール" })).toBeNull();

        // 2. 検索クリアボタンをクリックして復元できること
        const clearBtn = screen.getByRole("button", { name: "メニュー検索をクリア" });
        fireEvent.click(clearBtn);
        expect(sidebarSearchInput.value).toBe("");

        // 復元後、電卓ツールリンクが再表示されること
        const calcLink = screen.getByRole("link", { name: "電卓ツール" });
        expect(calcLink).toBeInTheDocument();

        // 3. 電卓ツールリンクをクリックして遷移
        fireEvent.click(calcLink);

        // 電卓画面が表示されたこと
        expect(await screen.findByRole("textbox")).toBeInTheDocument();

        // 4. 現在のルートリンクがアクティブ表示 (is-active) になっていること
        const allLinksAfterNav = screen.getAllByRole("link");
        const activeCalcLink = allLinksAfterNav.find(
            (a) => a.getAttribute("href") === "/calculator" && a.classList.contains("is-active"),
        );
        expect(activeCalcLink).toBeDefined();
    });
});
